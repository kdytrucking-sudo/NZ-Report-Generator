"use client";
// Force rebuild


import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getUserData, UserData, updateUserProfile } from "@/lib/firestore-user";
import { initializePDFExtractPrompt } from "@/lib/firestore-ai";
import { onAuthStateChanged } from "firebase/auth";
import styles from "./settings.module.css";
import Link from "next/link";
import { useCustomAlert } from "@/components/CustomAlert";

export default function SettingsPage() {
    const { showAlert, AlertComponent } = useCustomAlert();
    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // AI Settings State
    const [isAIPromptOpen, setIsAIPromptOpen] = useState(false);
    const [isAITestOpen, setIsAITestOpen] = useState(false);

    // Form states
    const [legalName, setLegalName] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [valuerJobNumber, setValuerJobNumber] = useState("");
    const [businessName, setBusinessName] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const data = await getUserData(currentUser.uid);
                setUserData(data);

                // Initialize form fields
                if (data) {
                    setLegalName(data.name || "");
                    setContactEmail(data.contactEmail || "");
                    setValuerJobNumber(data.valuerJobNumber || "");
                    setBusinessName(data.businessName || "");
                }

                // Initialize AI DB if needed (run once)
                initializePDFExtractPrompt(currentUser.uid).catch(console.error);

            } else {
                // Should be handled by layout redirect, but just in case
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        if (!user || !userData) return;
        setSaving(true);
        try {
            await updateUserProfile(user.uid, {
                name: legalName,
                contactEmail: contactEmail,
                valuerJobNumber: valuerJobNumber,
                businessName: businessName
            });
            // Update local state is not strictly needed if we don't refetch,
            // but good for consistency or showing success message.
            showAlert("Settings saved successfully!");
        } catch (error) {
            console.error("Error saving settings:", error);
            showAlert("Failed to save settings.");
        } finally {
            setSaving(false);
        };
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                Loading...
            </div>
        );
    }

    return (
        <>
            {AlertComponent}
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Settings</h1>
                    <p className={styles.subtitle}>
                        Manage your profile, AI preferences, and report generation defaults.
                    </p>
                </div>

                {/* User Profile Settings */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>User Profile Settings</h2>
                        <p className={styles.sectionDescription}>
                            Manage your personal and business details.
                        </p>
                    </div>
                    <div className={styles.content}>
                        <div className={styles.formGrid}>
                            <div className={styles.field}>
                                <label className={styles.label}>Legal Name</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={legalName}
                                    onChange={(e) => setLegalName(e.target.value)}
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Contact Email</label>
                                <input
                                    type="email"
                                    className={styles.input}
                                    value={contactEmail}
                                    onChange={(e) => setContactEmail(e.target.value)}
                                    placeholder="contact@example.com"
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Valuer Registration ID</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={valuerJobNumber}
                                    onChange={(e) => setValuerJobNumber(e.target.value)}
                                    placeholder="VNZ-12345"
                                />
                            </div>
                            <div className={`${styles.field} ${styles.fullWidth || ''}`} style={{ gridColumn: '1 / -1' }}>
                                <label className={styles.label}>Valuer Business Name</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="Acme Valuations Ltd."
                                />
                            </div>
                        </div>
                    </div>
                    <div className={styles.footer}>
                        <button
                            className={styles.saveBtn}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </section>

                {/* AI Settings */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>AI Settings</h2>
                        <p className={styles.sectionDescription}>
                            Configure AI prompts and test AI model outputs.
                        </p>
                    </div>
                    <div className={styles.settingsList}>
                        {/* AI Prompt Settings Toggle */}
                        <div
                            className={styles.settingsItem}
                            onClick={() => setIsAIPromptOpen(!isAIPromptOpen)}
                        >
                            <span className={styles.itemLabel}>AI Prompt Settings</span>
                            <ArrowIcon className={`${styles.arrowIcon} ${isAIPromptOpen ? styles.arrowIconRotated : ''}`} />
                        </div>
                        {isAIPromptOpen && (
                            <div className={styles.subSettingsList}>
                                <Link href="/settings/ai/pdf-extract-prompt" className={styles.subSettingsItem}>
                                    PDF Extract AI Prompt
                                </Link>
                            </div>
                        )}

                        {/* AI Test Toggle */}
                        <div
                            className={styles.settingsItem}
                            onClick={() => setIsAITestOpen(!isAITestOpen)}
                        >
                            <span className={styles.itemLabel}>AI Test</span>
                            <ArrowIcon className={`${styles.arrowIcon} ${isAITestOpen ? styles.arrowIconRotated : ''}`} />
                        </div>
                        {isAITestOpen && (
                            <div className={styles.subSettingsList}>
                                <Link href="/settings/ai/pdf-extract-test" className={styles.subSettingsItem}>
                                    PDF Extract Test
                                </Link>
                            </div>
                        )}
                    </div>
                </section>

                {/* Report Generation Settings */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Report Generation Settings</h2>
                        <p className={styles.sectionDescription}>
                            Customise report templates and default content presets.
                        </p>
                    </div>
                    <div className={styles.settingsList}>
                        <Link href="/settings/report/static-info" className={styles.settingsItem}>
                            <span className={styles.itemLabel}>Static Information Settings</span>
                            <ArrowIcon className={styles.arrowIcon} />
                        </Link>
                        <Link href="/settings/report/single-choice" className={styles.settingsItem}>
                            <span className={styles.itemLabel}>Preset Single-Choice Content Settings</span>
                            <ArrowIcon className={styles.arrowIcon} />
                        </Link>
                        <Link href="/settings/report/multi-choice" className={styles.settingsItem}>
                            <span className={styles.itemLabel}>Preset Multi-Choice Content Settings</span>
                            <ArrowIcon className={styles.arrowIcon} />
                        </Link>
                        <Link href="/settings/construct-chattels" className={styles.settingsItem}>
                            <span className={styles.itemLabel}>Construct / Chattels Settings</span>
                            <ArrowIcon className={styles.arrowIcon} />
                        </Link>
                        <Link href="/settings/report/structure" className={styles.settingsItem}>
                            <span className={styles.itemLabel}>Report Structure Settings</span>
                            <ArrowIcon className={styles.arrowIcon} />
                        </Link>
                        <Link href="/settings/report/image-config" className={styles.settingsItem}>
                            <span className={styles.itemLabel}>Image Placeholder Settings</span>
                            <ArrowIcon className={styles.arrowIcon} />
                        </Link>
                        <Link href="/settings/report/templates" className={styles.settingsItem}>
                            <span className={styles.itemLabel}>Template Settings</span>
                            <ArrowIcon className={styles.arrowIcon} />
                        </Link>
                    </div>
                </section>
            </div>
        </>
    );
}

function ArrowIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
            />
        </svg>
    );
}
