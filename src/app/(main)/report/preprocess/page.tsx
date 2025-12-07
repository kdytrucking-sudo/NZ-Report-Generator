"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Report, getReport, initializeReportFromStructure, syncReportFields, ReportField, updateReport } from "@/lib/firestore-reports";
import { getPDFExtractPrompt } from "@/lib/firestore-ai";
import { getStaticInfo, StaticInformation } from "@/lib/firestore-static";
import { getMultiChoiceCards, MultiChoiceCard } from "@/lib/firestore-multi-choice";
import { formatDateForInput, formatDateForStorage } from "@/lib/date-utils";
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

    // Static Data State
    const [staticData, setStaticData] = useState<Partial<StaticInformation>>({});
    const [staticLoading, setStaticLoading] = useState(false);

    const handleLoadStatic = async () => {
        if (!user) return;
        setStaticLoading(true);
        try {
            const data = await getStaticInfo(user.uid);
            if (data) {
                setStaticData(data);
            } else {
                alert("No static information found. Please configure it in Settings.");
            }
        } catch (error) {
            console.error(error);
            alert("Failed to load static info.");
        } finally {
            setStaticLoading(false);
        }
    };

    const handleUpdateStaticToReport = async () => {
        if (!report || !user) return;

        const data = staticData as StaticInformation;
        const mapping = [
            { key: 'nzEconomyOverview', placeholder: data.nzEconomyOverview_ph || '{%NZ_Economy_Overview}' },
            { key: 'globalEconomyOverview', placeholder: data.globalEconomyOverview_ph || '{%Global_Economy_Overview}' },
            { key: 'residentialMarket', placeholder: data.residentialMarket_ph || '{%Residential_Market}' },
            { key: 'recentMarketDirection', placeholder: data.recentMarketDirection_ph || '{%Recent_Market_Direction}' },
            { key: 'marketVolatility', placeholder: data.marketVolatility_ph || '{%Market_Volatility}' },
            { key: 'localEconomyImpact', placeholder: data.localEconomyImpact_ph || '{%Local_Economy_Impact}' }
        ];

        const sourceFields: { [key: string]: ReportField } = {};

        mapping.forEach((m, idx) => {
            const val = (data as any)[m.key as any];
            if (val) {
                sourceFields[`static_${idx}`] = {
                    id: `static_${idx}`,
                    label: m.key,
                    placeholder: m.placeholder,
                    value: val,
                    displayType: 'textarea',
                    type: 'string',
                    ifValidation: false
                };
            }
        });

        const updatedReport = syncReportFields(report, sourceFields);

        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, { metadata, baseInfo, content });
            setReport(updatedReport);
            alert("Static data updated to report!");
        } catch (e) {
            console.error(e);
            alert("Failed to update report with static data.");
        }
    };

    // SWOT (Multi-Choice) Data State
    const [swotCards, setSwotCards] = useState<MultiChoiceCard[]>([]);
    const [swotSelections, setSwotSelections] = useState<{ [cardId: string]: { selectedOptions: string[], textValue: string } }>({});
    const [swotLoading, setSwotLoading] = useState(false);

    const handleLoadSwot = async () => {
        if (!user) return;
        setSwotLoading(true);
        try {
            const cards = await getMultiChoiceCards(user.uid);
            setSwotCards(cards);

            // Initialize selections
            const initialSelections: any = {};
            cards.forEach(card => {
                initialSelections[card.id] = { selectedOptions: [], textValue: "" };
            });
            setSwotSelections(initialSelections);
        } catch (error) {
            console.error(error);
            alert("Failed to load SWOT data.");
        } finally {
            setSwotLoading(false);
        }
    };

    const handleOptionToggle = (cardId: string, optionValue: string) => {
        setSwotSelections(prev => {
            const cardState = prev[cardId] || { selectedOptions: [], textValue: "" };
            const isSelected = cardState.selectedOptions.includes(optionValue);

            let newOptions;
            if (isSelected) {
                newOptions = cardState.selectedOptions.filter(o => o !== optionValue);
            } else {
                newOptions = [...cardState.selectedOptions, optionValue];
            }

            // Update text value based on selected options (joined by newline)
            const card = swotCards.find(c => c.id === cardId);
            const textLines = newOptions.map(optVal => {
                const opt = card?.options.find(o => o.value === optVal);
                return opt ? opt.label : optVal;
            });

            return {
                ...prev,
                [cardId]: {
                    selectedOptions: newOptions,
                    textValue: textLines.join("\n")
                }
            };
        });
    };

    const handleSwotTextChange = (cardId: string, text: string) => {
        setSwotSelections(prev => ({
            ...prev,
            [cardId]: {
                ...prev[cardId],
                textValue: text
            }
        }));
    };

    const handleUpdateSwotToReport = async () => {
        if (!report || !user) return;

        const sourceFields: { [key: string]: ReportField } = {};

        swotCards.forEach((card, idx) => {
            const selection = swotSelections[card.id];
            if (selection && card.placeholder) {
                sourceFields[`swot_${idx}`] = {
                    id: `swot_${idx}`,
                    label: card.name,
                    placeholder: card.placeholder,
                    value: selection.textValue,
                    displayType: 'textarea',
                    type: 'string',
                    ifValidation: false
                };
            }
        });

        const updatedReport = syncReportFields(report, sourceFields);

        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, { metadata, baseInfo, content });
            setReport(updatedReport);
            alert("SWOT data updated to report!");
        } catch (e) {
            console.error(e);
            alert("Failed to update report with SWOT data.");
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
                                                            value={formatDateForInput(extractValues[idx] || "")}
                                                            onChange={(e) => {
                                                                const val = formatDateForStorage(e.target.value);
                                                                setExtractValues(prev => ({ ...prev, [idx]: val }))
                                                            }}
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

                    {/* Static Data Editor */}
                    <div className={styles.card} style={{ gridColumn: '2 / -1' }}>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                            <h2 className={styles.cardTitle} style={{ border: 'none', marginBottom: 0 }}>Static Information</h2>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className={styles.secondaryBtn} onClick={handleLoadStatic} disabled={staticLoading}>
                                    {staticLoading ? "Loading..." : "Load From Settings"}
                                </button>
                                <button className={styles.primaryBtn} onClick={handleUpdateStaticToReport} disabled={Object.keys(staticData).length === 0}>
                                    Update to Report
                                </button>
                            </div>
                        </div>

                        {Object.keys(staticData).length === 0 ? (
                            <div className="flex items-center justify-center h-20 text-gray-400">
                                Click "Load From Settings" to fetch your static content.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className={styles.editorTable}>
                                    <thead>
                                        <tr>
                                            <th>Label</th>
                                            <th>Placeholder</th>
                                            <th style={{ minWidth: '400px' }}>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { key: 'nzEconomyOverview', label: 'NZ Economy Overview', placeholder: (staticData as any).nzEconomyOverview_ph },
                                            { key: 'globalEconomyOverview', label: 'Global Economy Overview', placeholder: (staticData as any).globalEconomyOverview_ph },
                                            { key: 'residentialMarket', label: 'Residential Market', placeholder: (staticData as any).residentialMarket_ph },
                                            { key: 'recentMarketDirection', label: 'Recent Market Direction', placeholder: (staticData as any).recentMarketDirection_ph },
                                            { key: 'marketVolatility', label: 'Market Volatility', placeholder: (staticData as any).marketVolatility_ph },
                                            { key: 'localEconomyImpact', label: 'Local Economy Impact', placeholder: (staticData as any).localEconomyImpact_ph }
                                        ].map((field) => (
                                            <tr key={field.key}>
                                                <td style={{ verticalAlign: 'top', paddingTop: '0.75rem' }}>{field.label}</td>
                                                <td className="font-mono text-xs text-blue-600" style={{ verticalAlign: 'top', paddingTop: '0.75rem' }}>
                                                    {field.placeholder || <span className="text-gray-400 italic">No placeholder</span>}
                                                </td>
                                                <td>
                                                    <textarea
                                                        className={styles.textarea}
                                                        rows={4}
                                                        value={(staticData as any)[field.key] || ""}
                                                        onChange={(e) => setStaticData(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* SWOT Data Editor */}
                    <div className={styles.card} style={{ gridColumn: '2 / -1' }}>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                            <h2 className={styles.cardTitle} style={{ border: 'none', marginBottom: 0 }}>SWOT Data (Multi-Choice)</h2>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className={styles.secondaryBtn} onClick={handleLoadSwot} disabled={swotLoading}>
                                    {swotLoading ? "Loading..." : "Load From Settings"}
                                </button>
                                <button className={styles.primaryBtn} onClick={handleUpdateSwotToReport} disabled={swotCards.length === 0}>
                                    Update to Report
                                </button>
                            </div>
                        </div>

                        {swotCards.length === 0 ? (
                            <div className="flex items-center justify-center h-20 text-gray-400">
                                Click "Load From Settings" to fetch your multi-choice content (e.g., SWOT).
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {swotCards.map((card) => {
                                    const selection = swotSelections[card.id] || { selectedOptions: [], textValue: "" };

                                    return (
                                        <div key={card.id} className="border rounded p-4 bg-gray-50">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-semibold text-lg text-gray-800">{card.name}</h3>
                                                <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                    {card.placeholder}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Options Column */}
                                                <div>
                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Available Options</h4>
                                                    <div className="space-y-2">
                                                        {card.options.map(option => (
                                                            <label key={option.id} className="flex items-start gap-2 cursor-pointer p-2 hover:bg-white rounded transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    className="mt-1"
                                                                    checked={selection.selectedOptions.includes(option.value)}
                                                                    onChange={() => handleOptionToggle(card.id, option.value)}
                                                                />
                                                                <span className="text-sm text-gray-700">{option.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Text Area Column */}
                                                <div>
                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Selected Text (Editable)</h4>
                                                    <textarea
                                                        className={styles.textarea}
                                                        rows={6}
                                                        value={selection.textValue}
                                                        onChange={(e) => handleSwotTextChange(card.id, e.target.value)}
                                                        placeholder="Select options from the left or type here..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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
