"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getReport, updateReport, Report, ReportField } from "@/lib/firestore-reports";
import styles from "./page.module.css";
import Link from "next/link";

export default function ReportMetaPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reportId = searchParams.get("id");

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
                metadata: {
                    ...prev.metadata,
                    fields: {
                        ...prev.metadata.fields,
                        [fieldKey]: {
                            ...prev.metadata.fields[fieldKey],
                            value: value
                        }
                    }
                }
            };
        });
    };

    const handleSaveNext = async () => {
        if (!user || !report || !reportId) return;

        setSaving(true);
        try {
            await updateReport(user.uid, reportId, {
                metadata: report.metadata
            });
            // Proceed to next step
            router.push(`/report/basic?id=${reportId}`);
        } catch (error) {
            console.error("Error saving meta:", error);
            alert("Failed to save changes.");
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
                return <input {...commonProps} type="date" />;
            case "checkbox":
                // If options provided -> Multi-select Checkbox Group
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
                // Default -> Single Boolean Checkbox
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

    // Use fieldOrder if available, otherwise fallback to object keys (random/insertion order)
    const fieldKeys = report.metadata.fieldOrder || Object.keys(report.metadata.fields);

    // Split into two columns for display (Left half, Right half)
    const midIndex = Math.ceil(fieldKeys.length / 2);
    const leftKeys = fieldKeys.slice(0, midIndex);
    const rightKeys = fieldKeys.slice(midIndex);

    const renderColumnFields = (keys: string[], className?: string) => (
        <div className={`${styles.fieldGroup} ${className || ''}`}>
            {keys.map(key => {
                const field = report.metadata.fields[key];
                if (!field) return null;

                return (
                    <div key={key} className={styles.field}>
                        <label htmlFor={key} className={styles.label}>
                            {field.label} {field.ifValidation && <span className="text-red-500">*</span>}
                        </label>
                        {renderInput(key, field)}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Report Metadata</h1>
                <p className={styles.subtitle}>Enter high-level details for this job.</p>
            </div>

            <div className={styles.formCard}>
                <div className={styles.columnsContainer}>
                    {renderColumnFields(leftKeys, styles.leftColumn)}
                    {renderColumnFields(rightKeys, styles.rightColumn)}
                </div>

                <div className={styles.footer}>
                    <Link href="/dashboard" className={styles.backBtn}>
                        Cancel
                    </Link>
                    <button className={styles.nextBtn} onClick={handleSaveNext} disabled={saving}>
                        {saving ? "Saving..." : "Save & Next"}
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
