"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getReport, updateReport, syncReportFields, Report, ReportField } from "@/lib/firestore-reports";
import { formatDateForInput, formatDateForStorage } from "@/lib/date-utils";
import styles from "../meta/page.module.css"; // Reuse meta styles
import Link from "next/link";
import { useCustomAlert } from "@/components/CustomAlert";

export default function ReportBasicPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reportId = searchParams.get("id");
    const { showAlert, AlertComponent } = useCustomAlert();

    const [user, setUser] = useState<any>(null);
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                if (reportId) {
                    const data = await getReport(currentUser.uid, reportId);
                    setReport(data);
                }
                setLoading(false);
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [reportId, router]);

    const handleInputChange = (fieldKey: string, value: any) => {
        if (!report) return;

        setReport(prev => {
            if (!prev) return null;
            return {
                ...prev,
                baseInfo: {
                    ...prev.baseInfo,
                    fields: {
                        ...prev.baseInfo.fields,
                        [fieldKey]: {
                            ...prev.baseInfo.fields[fieldKey],
                            value: value
                        }
                    }
                }
            };
        });
    };

    const handleUpdateJobInfo = () => {
        if (!report) return;
        router.push(`/report/meta?id=${report.id}`);
    };

    const handleSaveBack = async () => {
        if (!user || !report || !reportId) return;

        setSaving(true);
        try {
            // Synchronize fields across the report based on placeholders
            const updatedReport = syncReportFields(report, report.baseInfo.fields);

            await updateReport(user.uid, reportId, {
                metadata: updatedReport.metadata,
                baseInfo: updatedReport.baseInfo,
                content: updatedReport.content
            });
            // Go back to preprocess
            router.push(`/report/preprocess?id=${reportId}`);
        } catch (error) {
            console.error("Error saving basic info:", error);
            showAlert("Failed to save changes.");
            setSaving(false);
        }
    };

    const handleSaveNext = async () => {
        if (!user || !report || !reportId) return;

        setSaving(true);
        try {
            // Synchronize fields across the report based on placeholders
            const updatedReport = syncReportFields(report, report.baseInfo.fields);

            await updateReport(user.uid, reportId, {
                metadata: updatedReport.metadata,
                baseInfo: updatedReport.baseInfo,
                content: updatedReport.content,
                status: 'Filling:Content' // Update status
            });
            // Proceed to next step
            router.push(`/report/content?id=${reportId}`);
        } catch (error) {
            console.error("Error saving basic info:", error);
            showAlert("Failed to save changes.");
            setSaving(false);
        }
    };

    const renderInput = (key: string, field: ReportField) => {
        const commonProps = {
            id: key,
            className: styles.input,
            value: field.value || "",
            placeholder: field.placeholder,
            onChange: (e: any) => handleInputChange(key, e.target.value),
            required: field.ifValidation
        };

        switch (field.displayType) {
            case "textarea":
                return <textarea {...commonProps} className={styles.textarea} rows={3} />;
            case "number":
                return <input {...commonProps} type="number" />;
            case "date":
                return (
                    <input
                        {...commonProps}
                        type="date"
                        value={formatDateForInput(field.value)}
                        onChange={(e) => handleInputChange(key, formatDateForStorage(e.target.value))}
                    />
                );
            case "checkbox":
                if (field.options && field.options.length > 0) {
                    const currentValues: string[] = Array.isArray(field.value) ? field.value : [];
                    return (
                        <div className={styles.checkboxGroup}>
                            {field.options.map(opt => (
                                <div key={opt} className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        id={`${key}-${opt}`}
                                        className={styles.checkbox}
                                        checked={currentValues.includes(opt)}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            let newValues = [...currentValues];
                                            if (checked) {
                                                newValues.push(opt);
                                            } else {
                                                newValues = newValues.filter(v => v !== opt);
                                            }
                                            handleInputChange(key, newValues);
                                        }}
                                    />
                                    <label htmlFor={`${key}-${opt}`} className={styles.label} style={{ fontWeight: 'normal' }}>{opt}</label>
                                </div>
                            ))}
                        </div>
                    );
                }
                return (
                    <div className={styles.checkboxWrapper} style={{ border: 'none', padding: 0 }}>
                        <input
                            type="checkbox"
                            id={key}
                            className={styles.checkbox}
                            checked={!!field.value}
                            onChange={(e) => handleInputChange(key, e.target.checked)}
                        />
                    </div>
                );
            case "select":
                // Parse options from field.options or fallback to placeholder
                const options = field.options || (field.placeholder ? field.placeholder.split(',').map(s => s.trim()) : []);
                return (
                    <select {...commonProps} className={styles.select}>
                        <option value="" disabled>Select an option</option>
                        {options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                );
            default: // text
                return <input {...commonProps} type="text" />;
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!report) return <div className="p-8 text-center">Report not found.</div>;

    const fieldKeys = report.baseInfo.fieldOrder || Object.keys(report.baseInfo.fields);

    // Split into Left/Right columns
    const midIndex = Math.ceil(fieldKeys.length / 2);
    const leftKeys = fieldKeys.slice(0, midIndex);
    const rightKeys = fieldKeys.slice(midIndex);

    const renderColumnFields = (keys: string[], className?: string) => (
        <div className={`${styles.fieldGroup} ${className || ''}`}>
            {keys.map(key => {
                const field = report.baseInfo.fields[key];
                if (!field) return null;

                return (
                    <div key={key} className={styles.field}>
                        <label htmlFor={key} className={styles.label}>
                            <span>
                                {field.label} {field.ifValidation && <span className="text-red-500">*</span>}
                            </span>
                            {field.placeholder && (
                                <span
                                    className={styles.placeholderIcon}
                                    title={field.placeholder}
                                >
                                    P
                                </span>
                            )}
                        </label>
                        {renderInput(key, field)}
                    </div>
                );
            })}
        </div>
    );

    return (
        <>
            {AlertComponent}
            <div className={styles.container}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Basic Information</h1>
                        <p className={styles.subtitle}>Enter the core details of the property.</p>
                    </div>
                    <button className={styles.updateJobBtn} onClick={handleUpdateJobInfo}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Update Job Info
                    </button>
                </div>

                <div className={styles.formCard}>
                    <div className={styles.columnsContainer}>
                        {renderColumnFields(leftKeys, styles.leftColumn)}
                        {renderColumnFields(rightKeys, styles.rightColumn)}
                    </div>

                    <div className={styles.footer}>
                        <button className={styles.backBtn} onClick={handleSaveBack} disabled={saving}>
                            {saving ? "Saving..." : "Save & Back"}
                        </button>
                        <button className={styles.nextBtn} onClick={handleSaveNext} disabled={saving}>
                            {saving ? "Saving..." : "Save & Next"}
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
