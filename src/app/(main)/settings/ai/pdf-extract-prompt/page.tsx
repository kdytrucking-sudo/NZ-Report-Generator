"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPrompt, updatePrompt, AIPrompt } from "@/lib/firestore-ai";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "./page.module.css";
import Link from "next/link";

export default function PDFExtractPromptPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [promptData, setPromptData] = useState<AIPrompt | null>(null);
    const [user, setUser] = useState<any>(null);

    // Load User and Data
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const data = await getPrompt(currentUser.uid, "pdf_extract");
                    if (data) {
                        setPromptData(data);
                    } else {
                        // Handle case where prompt doesn't exist (maybe init was missed or failed)
                        console.error("Prompt 'pdf_extract' not found.");
                    }
                } catch (error) {
                    console.error("Error loading prompt:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                router.push("/"); // Redirect if not logged in
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleChange = (field: keyof AIPrompt, value: any) => {
        if (!promptData) return;
        setPromptData({ ...promptData, [field]: value });
    };

    const handleSave = async () => {
        if (!promptData || !user) return;
        setSaving(true);
        try {
            await updatePrompt(user.uid, "pdf_extract", promptData);
            alert("Configuration saved successfully!");
        } catch (error) {
            console.error("Error saving prompt:", error);
            alert("Failed to save configuration.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                Loading...
            </div>
        );
    }

    if (!promptData) {
        return <div>Error loading data.</div>;
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>PDF Extract Prompt</h1>
                    <p className={styles.description}>
                        Configure AI model parameters and prompt settings for PDF data extraction.
                    </p>
                </div>
                <div className={styles.headerRight}>
                    <button
                        className={`btn btn-outline`}
                        onClick={() => router.back()}
                    >
                        Cancel
                    </button>
                    <button
                        className={`btn ${styles.saveBtn}`}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save Configuration"}
                    </button>
                </div>
            </header>

            <div className={styles.mainGrid}>
                {/* Left Column: AI Model Parameters */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>AI Model Parameters</h2>
                        <p className={styles.description}>Adjust the core parameters of the AI model.</p>
                    </div>
                    <div className={styles.cardContent}>
                        <div className={styles.field}>
                            <label className={styles.label}>Model Name</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={promptData.modelName}
                                onChange={(e) => handleChange("modelName", e.target.value)}
                            />
                        </div>

                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label className={styles.label}>Temperature</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className={styles.input}
                                    value={promptData.temperature}
                                    onChange={(e) => handleChange("temperature", parseFloat(e.target.value))}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Top P</label>
                                <input
                                    type="number"
                                    step="0.05"
                                    className={styles.input}
                                    value={promptData.topP}
                                    onChange={(e) => handleChange("topP", parseFloat(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label className={styles.label}>Top K</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={promptData.topK}
                                    onChange={(e) => handleChange("topK", parseInt(e.target.value))}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Max Tokens</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={promptData.maxOutputTokens}
                                    onChange={(e) => handleChange("maxOutputTokens", parseInt(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Prompt & Structure Settings */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Prompt & Structure Settings</h2>
                        <p className={styles.description}>Define the instructions and JSON output format for the AI extractor.</p>
                    </div>
                    <div className={styles.cardContent}>

                        <div className={styles.gridContent}>
                            <div className={styles.field}>
                                <label className={styles.label}>System Prompt (AI's Role)</label>
                                <textarea
                                    className={`${styles.input} ${styles.textarea}`}
                                    value={promptData.systemPrompt}
                                    onChange={(e) => handleChange("systemPrompt", e.target.value)}
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>User Prompt (Main Task)</label>
                                <textarea
                                    className={`${styles.input} ${styles.textarea}`}
                                    value={promptData.userPrompt}
                                    onChange={(e) => handleChange("userPrompt", e.target.value)}
                                />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Extraction Hints (Detailed Instructions)</label>
                            <textarea
                                className={`${styles.input} ${styles.textarea}`}
                                value={promptData.extractionHints}
                                onChange={(e) => handleChange("extractionHints", e.target.value)}
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>JSON Output Structure</label>
                            <textarea
                                className={`${styles.input} ${styles.jsonEditor}`}
                                value={promptData.outputJSONStructure}
                                onChange={(e) => handleChange("outputJSONStructure", e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
