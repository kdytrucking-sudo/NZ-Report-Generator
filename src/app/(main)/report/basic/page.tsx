"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getReport, updateReport, Report, ReportField } from "@/lib/firestore-reports";
import styles from "../meta/page.module.css"; // Reuse meta styles
import Link from "next/link";

export default function ReportBasicPage() {
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

    const handleSaveNext = async () => {
        if (!user || !report || !reportId) return;

        setSaving(true);
        try {
            await updateReport(user.uid, reportId, {
                baseInfo: report.baseInfo
            });
            // Proceed to next step (Content) - assuming query param structure
            router.push(`/report/content?id=${reportId}`);
        } catch (error) {
            console.error("Error saving basic info:", error);
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
                return (
                    <div className={styles.checkboxWrapper}>
                        <input
                            type="checkbox"
                            id={key}
                            className={styles.checkbox}
                            checked={!!field.value}
                            onChange={(e) => handleInputChange(key, e.target.checked)}
                        />
                        <label htmlFor={key} className={styles.label}>{field.label}</label>
                    </div>
                );
            case "select":
                // Parse options from placeholder (comma separated)
                const options = field.placeholder ? field.placeholder.split(',').map(s => s.trim()) : [];
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

    const fieldKeys = Object.keys(report.baseInfo.fields);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Basic Information</h1>
                <p className={styles.subtitle}>Enter the core details of the property and report.</p>
            </div>

            <div className={styles.formCard}>
                <div className={styles.fieldGroup}>
                    {fieldKeys.map(key => {
                        const field = report.baseInfo.fields[key];
                        if (field.displayType === "checkbox") {
                            return (
                                <div key={key}>
                                    {renderInput(key, field)}
                                </div>
                            );
                        }
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

                <div className={styles.footer}>
                    {/* Navigate back to Meta */}
                    <Link href={`/report/meta?id=${reportId}`} className={styles.backBtn}>
                        Previous
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
