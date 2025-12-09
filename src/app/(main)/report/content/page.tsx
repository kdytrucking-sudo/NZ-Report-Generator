"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getReport, updateReport, syncReportFields, Report, ReportContentSection, ReportField } from "@/lib/firestore-reports";
import { formatDateForInput, formatDateForStorage } from "@/lib/date-utils";
import styles from "./page.module.css";
import Link from "next/link";

export default function ReportContentPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reportId = searchParams.get("id");

    const [user, setUser] = useState<any>(null);
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Tabs state
    const [activeSectionId, setActiveSectionId] = useState<string>("");
    const [sections, setSections] = useState<ReportContentSection[]>([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                if (reportId) {
                    const data = await getReport(currentUser.uid, reportId);
                    setReport(data);

                    if (data && data.content) {
                        const rawSections = Object.values(data.content);

                        // Sort by contentOrder if available
                        if (data.contentOrder && data.contentOrder.length > 0) {
                            const orderMap = new Map(data.contentOrder.map((id, index) => [id, index]));
                            rawSections.sort((a, b) => {
                                const indexA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
                                const indexB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
                                return indexA - indexB;
                            });
                        } else {
                            // Fallback sort
                            rawSections.sort((a, b) => a.id.localeCompare(b.id));
                        }

                        setSections(rawSections);

                        if (rawSections.length > 0) {
                            setActiveSectionId(rawSections[0].id);
                        }
                    }
                }
                setLoading(false);
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [reportId, router]);

    const handleInputChange = (sectionId: string, fieldKey: string, value: any) => {
        if (!report) return;

        setReport(prev => {
            if (!prev) return null;
            return {
                ...prev,
                content: {
                    ...prev.content,
                    [sectionId]: {
                        ...prev.content[sectionId],
                        fields: {
                            ...prev.content[sectionId].fields,
                            [fieldKey]: {
                                ...prev.content[sectionId].fields[fieldKey],
                                value: value
                            }
                        }
                    }
                }
            };
        });
    };

    const handleSave = async () => {
        if (!user || !report || !reportId) return;

        setSaving(true);
        try {
            // Collect all fields from all sections as source
            let allContentFields: { [key: string]: ReportField } = {};
            if (report.content) {
                Object.values(report.content).forEach(section => {
                    if (section.fields) {
                        allContentFields = { ...allContentFields, ...section.fields };
                    }
                });
            }

            // Synchronize fields
            const updatedReport = syncReportFields(report, allContentFields);

            await updateReport(user.uid, reportId, {
                metadata: {
                    ...updatedReport.metadata,
                    status: "in_progress"
                },
                baseInfo: updatedReport.baseInfo,
                content: updatedReport.content
            });
            router.push(`/report/generate?id=${reportId}`);
        } catch (error) {
            console.error("Error saving content:", error);
            alert("Failed to save content.");
        } finally {
            setSaving(false);
        }
    };

    const renderInput = (sectionId: string, key: string, field: ReportField) => {
        const commonProps = {
            id: `${sectionId}-${key}`,
            className: styles.input,
            value: field.value || "",
            placeholder: field.placeholder,
            onChange: (e: any) => handleInputChange(sectionId, key, e.target.value),
            required: field.ifValidation
        };

        switch (field.displayType) {
            case "textarea":
                return <textarea {...commonProps} className={styles.textarea} rows={6} />;
            case "number":
                return <input {...commonProps} type="number" />;
            case "date":
                return (
                    <input
                        {...commonProps}
                        type="date"
                        value={formatDateForInput(field.value)}
                        onChange={(e) => handleInputChange(sectionId, key, formatDateForStorage(e.target.value))}
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
                                        id={`${sectionId}-${key}-${opt}`}
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
                                            handleInputChange(sectionId, key, newValues);
                                        }}
                                    />
                                    <label htmlFor={`${sectionId}-${key}-${opt}`} className={styles.label} style={{ fontWeight: 'normal' }}>{opt}</label>
                                </div>
                            ))}
                        </div>
                    );
                }
                return (
                    <div className={styles.checkboxWrapper} style={{ border: 'none', padding: 0 }}>
                        <input
                            type="checkbox"
                            id={`${sectionId}-${key}`}
                            className={styles.checkbox}
                            checked={!!field.value}
                            onChange={(e) => handleInputChange(sectionId, key, e.target.checked)}
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
            default:
                return <input {...commonProps} type="text" />;
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!report || sections.length === 0) return <div className="p-8 text-center">Report content not found.</div>;

    const activeSection = report.content[activeSectionId];

    const fieldKeys = activeSection ? (activeSection.fieldOrder || Object.keys(activeSection.fields)) : [];
    const midIndex = Math.ceil(fieldKeys.length / 2);
    const leftKeys = fieldKeys.slice(0, midIndex);
    const rightKeys = fieldKeys.slice(midIndex);

    const renderColumnFields = (sectionId: string, keys: string[], className?: string) => (
        <div className={`${styles.fieldGroup} ${className || ''}`}>
            {keys.map(key => {
                const field = activeSection.fields[key];
                if (!field) return null;

                return (
                    <div key={key} className={styles.field}>
                        <label htmlFor={`${sectionId}-${key}`} className={styles.label}>
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
                        {renderInput(sectionId, key, field)}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Report Content</h1>
                <p className={styles.subtitle}>Fill in the detailed sections of your report.</p>
            </div>

            {/* Tabs */}
            <div className={styles.tabsContainer}>
                {sections.map(section => (
                    <button
                        key={section.id}
                        className={`${styles.tabBtn} ${activeSectionId === section.id ? styles.activeTab : ""}`}
                        onClick={() => setActiveSectionId(section.id)}
                    >
                        {section.title}
                    </button>
                ))}
            </div>

            {/* Form Area */}
            <div className={styles.formCard}>
                {activeSection ? (
                    <div>
                        <h2 className="text-xl font-bold mb-4">{activeSection.title}</h2>
                        <div className={styles.columnsContainer}>
                            {renderColumnFields(activeSectionId, leftKeys, styles.leftColumn)}
                            {renderColumnFields(activeSectionId, rightKeys, styles.rightColumn)}
                        </div>
                    </div>
                ) : (
                    <div>Select a section</div>
                )}

                <div className={styles.footer}>
                    <Link href={`/report/basic?id=${reportId}`} className={styles.backBtn}>
                        Previous
                    </Link>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save to Review"}
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
