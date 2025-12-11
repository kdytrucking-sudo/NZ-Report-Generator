"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getReport, Report, ReportField, updateReport } from "@/lib/firestore-reports";
import { getTemplates, ReportTemplate } from "@/lib/firestore-templates";
import styles from "./page.module.css";
import Link from "next/link";
import { formatDateForInput } from "@/lib/date-utils";
import { useCustomAlert } from "@/components/CustomAlert";

export default function ReportGeneratePage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reportId = searchParams.get("id");
    const { showAlert, AlertComponent } = useCustomAlert();

    const [user, setUser] = useState<any>(null);
    const [report, setReport] = useState<Report | null>(null);
    const [templates, setTemplates] = useState<ReportTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                if (reportId) {
                    try {
                        const [reportData, templatesData] = await Promise.all([
                            getReport(currentUser.uid, reportId),
                            getTemplates(currentUser.uid)
                        ]);
                        setReport(reportData);
                        setTemplates(templatesData);
                        if (templatesData.length > 0) {
                            setSelectedTemplateId(templatesData[0].id);
                        }
                    } catch (err) {
                        console.error("Error loading data:", err);
                    }
                }
                setLoading(false);
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [reportId, router]);

    const handleBack = async () => {
        if (!user || !reportId) return;

        try {
            // Update status to Filling:Content when going back
            await updateReport(user.uid, reportId, { status: 'Filling:Content' });
            router.push(`/report/content?id=${reportId}`);
        } catch (error) {
            console.error("Error updating status:", error);
            router.push(`/report/content?id=${reportId}`);
        }
    };

    const handleGenerate = async () => {
        if (!selectedTemplateId || !user) {
            showAlert("Please select a template.");
            return;
        }
        setGenerating(true);
        try {
            const response = await fetch('/api/generate-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId,
                    templateId: selectedTemplateId,
                    uid: user.uid
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Generation failed");
            }

            const data = await response.json();

            // Update status to Report:Text_Replaced
            await updateReport(user.uid, reportId!, { status: 'Report:Text_Replaced' });

            // Success - navigate to download page
            router.push(`/report/download?id=${reportId}`);

        } catch (error: any) {
            console.error(error);
            showAlert(`Failed to generate report: ${error.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const renderFieldRow = (key: string, field: ReportField) => {
        // Skip hidden or empty fields if desired, but for preview we show all relevant ones
        return (
            <div key={key} className={styles.fieldRow}>
                <div className={styles.fieldLabel}>{field.label}</div>
                <div className={styles.fieldValue}>{field.value || "-"}</div>
            </div>
        );
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!report) return <div className="p-8 text-center">Report not found.</div>;

    const baseInfoFields = report.baseInfo?.fields || {};
    const contentSections = report.content || {};

    return (
        <>
            {AlertComponent}
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Generate Report</h1>
                    <p className={styles.subtitle}>Select a template and review your data before generation.</p>
                </div>

                <div className={styles.mainGrid}>
                    {/* Left Column: Template Selection */}
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Select Template</h2>
                        {templates.length > 0 ? (
                            <select
                                className={styles.select}
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                            >
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="text-sm text-gray-500">No templates found. Please upload one in Settings.</div>
                        )}

                        <div style={{ marginTop: 'auto', fontSize: '0.875rem', color: '#64748b' }}>
                            <p>Selected Template: {templates.find(t => t.id === selectedTemplateId)?.name}</p>
                        </div>
                    </div>

                    {/* Right Column: Preview */}
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Data Preview</h2>
                        <div className={styles.previewContainer}>

                            {/* Basic Info Section */}
                            <div className={styles.sectionTitle}>Basic Information</div>
                            {(report.baseInfo?.fieldOrder || Object.keys(baseInfoFields)).map(key => {
                                const field = baseInfoFields[key];
                                if (!field) return null;
                                return renderFieldRow(key, field);
                            })}

                            {/* Content Sections */}
                            {(report.contentOrder || Object.keys(contentSections)).map(sectionKey => {
                                const section = contentSections[sectionKey];
                                if (!section) return null;
                                return (
                                    <div key={sectionKey}>
                                        <div className={styles.sectionTitle}>{section.title}</div>
                                        {Object.keys(section.fields).map(fieldKey => renderFieldRow(fieldKey, section.fields[fieldKey]))}
                                    </div>
                                );
                            })}

                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className={styles.footer}>
                    <button
                        className={styles.secondaryBtn}
                        onClick={handleBack}
                    >
                        &larr; Back to Content
                    </button>
                    <button
                        className={styles.primaryBtn}
                        onClick={handleGenerate}
                        disabled={generating || !selectedTemplateId}
                    >
                        {generating ? "Generating..." : "Next to Text Replace"}
                        {!generating && (
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
