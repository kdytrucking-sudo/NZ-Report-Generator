"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Report, getReport, initializeReportFromStructure, syncReportFields, ReportField, updateReport } from "@/lib/firestore-reports";
import { getPDFExtractPrompt } from "@/lib/firestore-ai";
import styles from "./page.module.css";

export default function PreprocessPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reportId = searchParams.get("id");

    const [user, setUser] = useState<any>(null);
    const [report, setReport] = useState<Report | null>(null);

    // Status State
    const [statusSteps, setStatusSteps] = useState([
        { id: 1, text: "Connecting to database...", status: "pending" },
        { id: 2, text: "Reading structure...", status: "pending" },
        { id: 3, text: "Initializing report record...", status: "pending" },
    ]);
    const [initDone, setInitDone] = useState(false);

    // AI State
    const [extractedData, setExtractedData] = useState<any[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractValues, setExtractValues] = useState<{ [key: number]: string }>({}); // Editable values key by index

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                if (reportId) {
                    await initProcess(currentUser.uid, reportId);
                } else {
                    router.push("/dashboard");
                }
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [reportId, router]);

    const updateStep = (id: number, status: string) => {
        setStatusSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    };

    const initProcess = async (uid: string, rId: string) => {
        try {
            updateStep(1, "doing");
            let rep = await getReport(uid, rId);
            updateStep(1, "done");

            if (rep) {
                if (rep.metadata?.status === 'initializing') {
                    updateStep(2, "doing");
                    updateStep(3, "doing");
                    rep = await initializeReportFromStructure(uid, rId);
                    updateStep(2, "done");
                    updateStep(3, "done");
                } else {
                    updateStep(2, "done");
                    updateStep(3, "done");
                }
                setReport(rep);
                setInitDone(true);
            }
        } catch (error) {
            console.error(error);
            alert("Initialization failed.");
        }
    };

    const handleAIExtract = async () => {
        if (!report || !user) return;
        setIsExtracting(true);
        try {
            const promptSettings = await getPDFExtractPrompt(user.uid);
            if (!promptSettings) {
                alert("Please configure AI Prompt settings first in Settings > AI.");
                setIsExtracting(false);
                return;
            }

            const formData = new FormData();
            if (report.files.title?.url) formData.append("titleUrl", report.files.title.url);
            if (report.files.brief?.url) formData.append("briefUrl", report.files.brief.url);

            formData.append("systemPrompt", promptSettings.systemPrompt);
            formData.append("userPrompt", promptSettings.userPrompt);
            formData.append("extractionHints", promptSettings.extractionHints);
            formData.append("outputJSONStructure", promptSettings.outputJSONStructure);
            formData.append("modelName", promptSettings.modelName);
            formData.append("temperature", promptSettings.temperature.toString());
            formData.append("topP", promptSettings.topP.toString());
            formData.append("topK", promptSettings.topK.toString());
            formData.append("maxOutputTokens", promptSettings.maxOutputTokens.toString());

            const res = await fetch("/api/pdf-extract-test", { method: "POST", body: formData });
            const result = await res.json();

            if (result.error) throw new Error(result.error);

            const rawData = result.data;

            // Flatten JSON to find all objects with 'placeholder' and 'value'
            const flatData: any[] = [];
            const traverse = (obj: any) => {
                if (!obj || typeof obj !== 'object') return;

                // If it looks like a Field Item
                if (obj.placeholder && obj.value !== undefined) {
                    flatData.push(obj);
                    return;
                }

                // Otherwise recurse
                for (const key in obj) {
                    traverse(obj[key]);
                }
            };
            traverse(rawData);

            setExtractedData(flatData);

            const initValues: any = {};
            flatData.forEach((item, idx) => {
                initValues[idx] = item.value;
            });
            setExtractValues(initValues);

        } catch (error: any) {
            console.error(error);
            alert("AI Error: " + error.message);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleUpdateDatabase = async () => {
        if (!report || !user || !initDone) return;

        const sourceFields: { [key: string]: ReportField } = {};

        extractedData.forEach((item, idx) => {
            sourceFields[`extracted_${idx}`] = {
                id: `extracted_${idx}`,
                label: item.label || "Unknown",
                placeholder: item.placeholder,
                value: extractValues[idx],
                displayType: 'text',
                type: 'string',
                ifValidation: false
            };
        });

        const updatedReport = syncReportFields(report, sourceFields);

        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, { metadata, baseInfo, content });
            setReport(updatedReport);
            alert("Database updated successfully!");
        } catch (e) {
            console.error(e);
            alert("Failed to update database.");
        }
    };

    const handleNext = () => {
        if (!report) return;
        router.push(`/report/meta?id=${report.id}`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Data Pre-processing</h1>
                <p className={styles.subtitle}>Initializing report and extracting data from files.</p>
            </div>

            {/* Status Bar */}
            <div className={styles.statusBar}>
                {statusSteps.map(step => (
                    <div key={step.id} className={styles.progressItem}>
                        <div className={`${styles.progressIcon} ${step.status === 'done' ? styles.iconDone : step.status === 'doing' ? styles.iconDoing : styles.iconPending}`}>
                            {step.status === 'done' && (
                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            )}
                        </div>
                        <span style={{ fontWeight: step.status === 'pending' ? 'normal' : '600', color: step.status === 'pending' ? '#94a3b8' : '#334155' }}>
                            {step.text}
                        </span>
                    </div>
                ))}
            </div>

            {initDone && report && (
                <div className={styles.mainGrid}>
                    {/* Files Column */}
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Source Files</h2>
                        <div className={styles.fileItem}>
                            <strong>Title:</strong> {report.files.title?.name || "N/A"}
                        </div>
                        <div className={styles.fileItem}>
                            <strong>Brief:</strong> {report.files.brief?.name || "N/A"}
                        </div>
                        <div style={{ marginTop: 'auto' }}>
                            <p className="text-xs text-gray-500 mb-2">
                                AI will read these PDF/Doc files to extract data based on your "PDF Extract" Settings.
                            </p>
                            <button className={styles.extractBtn} onClick={handleAIExtract} disabled={isExtracting}>
                                {isExtracting ? "Extracting..." : "AI Extract Data"}
                            </button>
                        </div>
                    </div>

                    {/* Extracted Data Editor */}
                    <div className={styles.card} style={{ gridColumn: '2 / -1' }}>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                            <h2 className={styles.cardTitle} style={{ border: 'none', marginBottom: 0 }}>Extracted Data</h2>
                            <button className={styles.primaryBtn} onClick={handleUpdateDatabase} disabled={extractedData.length === 0}>
                                Update Report Database
                            </button>
                        </div>

                        {extractedData.length === 0 ? (
                            <div className="flex items-center justify-center h-40 text-gray-400">
                                No data extracted yet. Click "AI Extract Data".
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className={styles.editorTable}>
                                    <thead>
                                        <tr>
                                            <th>Label</th>
                                            <th>Placeholder</th>
                                            <th style={{ minWidth: '200px' }}>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {extractedData.map((row, idx) => (
                                            <tr key={idx}>
                                                <td style={{ verticalAlign: 'top', paddingTop: '0.75rem' }}>{row.label}</td>
                                                <td className="font-mono text-xs text-blue-600" style={{ verticalAlign: 'top', paddingTop: '0.75rem' }}>{row.placeholder}</td>
                                                <td>
                                                    {row.displayType === 'textarea' ? (
                                                        <textarea
                                                            className={styles.textarea}
                                                            rows={3}
                                                            value={extractValues[idx] || ""}
                                                            onChange={(e) => setExtractValues(prev => ({ ...prev, [idx]: e.target.value }))}
                                                        />
                                                    ) : row.displayType === 'date' ? (
                                                        <input
                                                            type="date"
                                                            className={styles.input}
                                                            value={extractValues[idx] || ""}
                                                            onChange={(e) => setExtractValues(prev => ({ ...prev, [idx]: e.target.value }))}
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            className={styles.input}
                                                            value={extractValues[idx] || ""}
                                                            onChange={(e) => setExtractValues(prev => ({ ...prev, [idx]: e.target.value }))}
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className={styles.footer}>
                        <button className={styles.secondaryBtn} onClick={() => router.push('/dashboard')}>Cancel</button>
                        <button className={styles.primaryBtn} onClick={handleNext}>Next: Meta Info &rarr;</button>
                    </div>
                </div>
            )}
        </div>
    );
}
