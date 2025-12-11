"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPrompt, updatePrompt, AIPrompt, initializePDFExtractPrompt } from "@/lib/firestore-ai";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "./page.module.css";
import { useCustomAlert } from "@/components/CustomAlert";

export default function PDFExtractTestPage() {
    const { showAlert, AlertComponent } = useCustomAlert();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [promptData, setPromptData] = useState<AIPrompt | null>(null);
    const [loadingPrompt, setLoadingPrompt] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // Test Files
    const [titleFile, setTitleFile] = useState<File | null>(null);
    const [briefFile, setBriefFile] = useState<File | null>(null);
    const [testResult, setTestResult] = useState("Run a test to see results...");

    // Load Data
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    // Ensure prompt exists
                    await initializePDFExtractPrompt(currentUser.uid);
                    const data = await getPrompt(currentUser.uid, "pdf_extract");
                    setPromptData(data);
                } catch (error) {
                    console.error("Error loading prompt:", error);
                } finally {
                    setLoadingPrompt(false);
                }
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handlePromptChange = (field: keyof AIPrompt, value: any) => {
        if (!promptData) return;
        setPromptData({ ...promptData, [field]: value });
    };

    const handleSaveSettings = async () => {
        if (!user || !promptData) return;
        setSaving(true);
        try {
            await updatePrompt(user.uid, "pdf_extract", promptData);
            showAlert("AI Settings saved successfully!");
        } catch (error) {
            console.error("Error saving settings:", error);
            showAlert("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const handleRunTest = async () => {
        if (!titleFile || !briefFile || !promptData) {
            showAlert("Please upload both files and ensure prompt settings are loaded.");
            return;
        }

        setTesting(true);
        setTestResult("Processing files with AI... This may take a minute.");

        try {
            const formData = new FormData();
            formData.append("titleFile", titleFile);
            formData.append("briefFile", briefFile);
            formData.append("systemPrompt", promptData.systemPrompt);
            formData.append("userPrompt", promptData.userPrompt);
            formData.append("extractionHints", promptData.extractionHints);
            formData.append("outputJSONStructure", promptData.outputJSONStructure);
            formData.append("modelName", promptData.modelName);
            formData.append("temperature", promptData.temperature.toString());
            formData.append("topP", promptData.topP.toString());
            formData.append("topK", promptData.topK.toString());
            formData.append("maxOutputTokens", promptData.maxOutputTokens.toString());

            const response = await fetch("/api/pdf-extract-test", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.error) {
                setTestResult(`Error: ${result.error}`);
            } else {
                setTestResult(JSON.stringify(result.data, null, 2));
            }

        } catch (error: any) {
            console.error("Test failed:", error);
            setTestResult(`Test Failed: ${error.message}`);
        } finally {
            setTesting(false);
        }
    };

    if (loadingPrompt) {
        return <div className="p-8 text-center">Loading AI Config...</div>;
    }

    return (
        <>
        {AlertComponent}
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.titleWrapper}>
                    <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <h1 className={styles.title}>PDF Extract Test</h1>
                </div>
                {/* Global actions can go here if needed */}
            </div>

            <div className={styles.mainGrid}>
                {/* Left Panel: AI Prompts (Editable) */}
                <div className={styles.leftPanel}>
                    <div>
                        <h2 className={styles.panelTitle}>AI Prompts & Structure</h2>
                        <p className={styles.panelDescription}>Define the instructions and JSON output format for the AI extractor.</p>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>System Prompt (AI's Role)</label>
                        <textarea
                            className={styles.textarea}
                            value={promptData?.systemPrompt || ""}
                            onChange={(e) => handlePromptChange("systemPrompt", e.target.value)}
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>User Prompt (Main Task)</label>
                        <textarea
                            className={styles.textarea}
                            value={promptData?.userPrompt || ""}
                            onChange={(e) => handlePromptChange("userPrompt", e.target.value)}
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Extraction Hints</label>
                        <textarea
                            className={styles.textarea}
                            value={promptData?.extractionHints || ""}
                            onChange={(e) => handlePromptChange("extractionHints", e.target.value)}
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>JSON Output Structure</label>
                        <textarea
                            className={`${styles.textarea} ${styles.codeEditor}`}
                            value={promptData?.outputJSONStructure || ""}
                            onChange={(e) => handlePromptChange("outputJSONStructure", e.target.value)}
                        />
                    </div>

                    <button
                        className={`btn ${styles.saveBtn}`}
                        onClick={handleSaveSettings}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save AI Settings"}
                    </button>
                </div>

                {/* Right Panel: Test Center & Results */}
                <div className={styles.rightPanel}>
                    <div className={styles.testCenterCard}>
                        <h2 className={styles.panelTitle}>Test Center</h2>

                        <div className={styles.uploadGroup}>
                            <div className={styles.fileInputWrapper}>
                                <span className={styles.fileLabel}>Upload Title:</span>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => setTitleFile(e.target.files?.[0] || null)}
                                />
                            </div>
                            <div className={styles.fileInputWrapper}>
                                <span className={styles.fileLabel}>Upload Brief:</span>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => setBriefFile(e.target.files?.[0] || null)}
                                />
                            </div>

                            <button
                                className={`btn ${styles.runBtn}`}
                                onClick={handleRunTest}
                                disabled={testing || !titleFile || !briefFile}
                            >
                                {testing ? "Running..." : "Run Test"}
                            </button>
                        </div>
                    </div>

                    <div className={styles.resultCard}>
                        <div>
                            <h2 className={styles.panelTitle}>Test Result</h2>
                            <p className={styles.panelDescription}>The extracted JSON data from the test run will appear here.</p>
                        </div>
                        <div className={styles.resultOutput}>
                            {testResult}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-primary" style={{ flex: 1 }}>Save Extraction Config</button>
                            {/* Placeholder button from image */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    
        </>
    );
}
