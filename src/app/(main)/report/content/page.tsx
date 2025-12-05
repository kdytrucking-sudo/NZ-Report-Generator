"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getReport, updateReport, Report, ReportField, ReportContentSection } from "@/lib/firestore-reports";
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
                        // Extract sections and sort them (optional: sort by ID or other criteria)
                        const rawSections = Object.values(data.content);
                        // Simple sort by ID or generic order
                        rawSections.sort((a, b) => a.id.localeCompare(b.id));
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
            await updateReport(user.uid, reportId, {
                content: report.content,
                metadata: {
                    ...report.metadata,
                    status: "in_progress" // Or "completed" if this is the final step? Let's say in_progress for now until explicit finish.
                }
            });
            alert("Report content saved successfully!");
            router.push("/dashboard");
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
                return <input {...commonProps} type="date" />;
            case "checkbox":
                return (
                    <div className={styles.checkboxWrapper}>
                        <input
                            type="checkbox"
                            id={`${sectionId}-${key}`}
                            className={styles.checkbox}
                            checked={!!field.value}
                            onChange={(e) => handleInputChange(sectionId, key, e.target.checked)}
                        />
                        <label htmlFor={`${sectionId}-${key}`} className={styles.label}>{field.label}</label>
                    </div>
                );
            case "select":
                const options = field.placeholder ? field.placeholder.split(',').map(s => s.trim()) : [];
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
                    <div className={styles.fieldGroup}>
                        <h2 className="text-xl font-bold mb-4">{activeSection.title}</h2>
                        {Object.keys(activeSection.fields).map(key => {
                            const field = activeSection.fields[key];
                            if (field.displayType === "checkbox") {
                                return (
                                    <div key={key}>
                                        {renderInput(activeSectionId, key, field)}
                                    </div>
                                );
                            }
                            return (
                                <div key={key} className={styles.field}>
                                    <label htmlFor={`${activeSectionId}-${key}`} className={styles.label}>
                                        {field.label} {field.ifValidation && <span className="text-red-500">*</span>}
                                    </label>
                                    {renderInput(activeSectionId, key, field)}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div>Select a section</div>
                )}

                <div className={styles.footer}>
                    <Link href={`/report/basic?id=${reportId}`} className={styles.backBtn}>
                        Previous
                    </Link>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save & Finish"}
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
