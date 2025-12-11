"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getReport, updateReport, Report } from "@/lib/firestore-reports";
import { getImageConfigs, ImageConfigCard } from "@/lib/firestore-image-config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import styles from "./page.module.css";
import Link from "next/link";
import { useCustomAlert } from "@/components/CustomAlert";
import { useCustomConfirm } from "@/components/CustomConfirm";

export default function ReportDownloadPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reportId = searchParams.get("id");
    const { showAlert, AlertComponent } = useCustomAlert();
    const { showConfirm, ConfirmComponent } = useCustomConfirm();

    const [user, setUser] = useState<any>(null);
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);

    // Image Handling
    const [imageConfigs, setImageConfigs] = useState<ImageConfigCard[]>([]);
    const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});
    const [replacing, setReplacing] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                if (reportId) {
                    const [reportData, configData] = await Promise.all([
                        getReport(currentUser.uid, reportId),
                        getImageConfigs(currentUser.uid)
                    ]);
                    setReport(reportData);
                    setImageConfigs(configData);
                }
                setLoading(false);
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [reportId, router]);

    const handleImageUpload = async (config: ImageConfigCard, file: File) => {
        if (!user || !reportId) return;

        const configId = config.id || config.name; // Fallback
        setUploadingState(prev => ({ ...prev, [configId]: true }));

        try {
            // Path: nzreport/{uid}/reports/{reportId}/images/{imageName}
            // Use config.name for the filename to make it predictable or keep original extension
            const ext = file.name.split('.').pop();
            const storagePath = `users/${user.uid}/reports/${reportId}/images/${config.name}.${ext}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            // Create the new image entry
            const newImageEntry = {
                path: storagePath,
                url: url,
                name: config.name
            };

            // Update local state first using functional update to avoid race conditions
            setReport(prevReport => {
                if (!prevReport) return prevReport;

                const updatedImages = {
                    ...(prevReport.images || {}),
                    [config.name]: newImageEntry
                };

                return { ...prevReport, images: updatedImages };
            });

            // Then update Firestore - use functional approach to get latest state
            setReport(currentReport => {
                if (currentReport) {
                    updateReport(user.uid, reportId, { images: currentReport.images });
                }
                return currentReport;
            });

        } catch (error) {
            console.error("Upload failed", error);
            showAlert("Failed to upload image.");
        } finally {
            setUploadingState(prev => ({ ...prev, [configId]: false }));
        }
    };

    const handleRemoveImage = async (placeholderName: string) => {
        const confirmed = await showConfirm("Remove this image?");
        if (!confirmed) return;

        if (!user || !reportId || !report) return;

        try {
            const updatedImages = { ...report.images };
            delete updatedImages[placeholderName];

            await updateReport(user.uid, reportId, { images: updatedImages });
            setReport({ ...report, images: updatedImages });
        } catch (error) {
            console.error("Failed to remove image", error);
            showAlert("Failed to remove image.");
        }
    };

    const handleReplaceImages = async () => {
        if (!user || !reportId) return;
        setReplacing(true);

        try {
            const response = await fetch("/api/replace-images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uid: user.uid,
                    reportId: reportId
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || err.message || "Replacement failed");
            }

            // Update status to Report_Completed
            await updateReport(user.uid, reportId, { status: 'Report_Completed' });

            // Redirect to the new download page
            router.push(`/report/final-download?id=${reportId}`);

        } catch (error: any) {
            console.error("Replacement error:", error);
            showAlert(`Error: ${error.message}`);
        } finally {
            setReplacing(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-lg">Loading...</div>;
    if (!report) return <div className="p-12 text-center text-lg">Report not found.</div>;

    const generatedReport = report.generatedReport;
    const uploadedCount = Object.keys(report.images || {}).length;
    const canReplace = uploadedCount > 0;

    return (
        <>
            {AlertComponent}
            {ConfirmComponent}
            <div className={styles.container}>
                {/* Top Header: File Download */}
                <div className={styles.headerBar}>
                    <div className={styles.fileInfo}>
                        <div className={styles.fileIcon}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <span className={styles.fileName} title={generatedReport?.name}>
                            {generatedReport?.name || "Draft_Report.docx"}
                        </span>
                    </div>
                    {generatedReport?.url ? (
                        <a
                            href={generatedReport.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.downloadBtn}
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '0.5rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download
                        </a>
                    ) : (
                        <div className="text-red-500 text-sm">Link unavailable</div>
                    )}
                </div>

                {/* Image Replacement Section */}
                <div className={styles.mainCard}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Image Replacement</h2>
                        <p className={styles.cardSubtitle}>Upload images to replace placeholders in the final report.</p>
                    </div>

                    <div className={styles.imageGrid}>
                        {imageConfigs.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center col-span-3">No image configurations found in Settings.</p>
                        ) : (
                            imageConfigs.map((config) => {
                                const isUploaded = report.images?.[config.name];
                                const isUploading = uploadingState[config.id || config.name];

                                return (
                                    <div key={config.id} className={`${styles.imageCard} ${isUploaded ? styles.uploaded : ''}`}>
                                        <div className={styles.imageCardHeader}>
                                            <div className={styles.imageName}>
                                                <span
                                                    className={styles.placeholderIcon}
                                                    title={config.placeholder}
                                                >
                                                    P
                                                </span>
                                                <span>{config.name}</span>
                                            </div>
                                            {isUploaded && (
                                                <button onClick={() => handleRemoveImage(config.name)} className={styles.removeBtn}>
                                                    ×
                                                </button>
                                            )}
                                        </div>

                                        <div className={styles.uploadArea}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className={styles.uploadInput}
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        handleImageUpload(config, e.target.files[0]);
                                                    }
                                                }}
                                                disabled={!!isUploading}
                                            />
                                            {isUploading ? (
                                                <span className={styles.uploadStatus}>Uploading...</span>
                                            ) : isUploaded ? (
                                                <span className={styles.uploadStatus + ' ' + styles.success}>
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ display: 'inline', marginRight: 4 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    Uploaded
                                                </span>
                                            ) : (
                                                <span className={styles.uploadStatus}>Choose File</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className={styles.finalizeSection}>
                        <button
                            className={styles.finalizeBtn}
                            onClick={handleReplaceImages}
                            disabled={!canReplace || replacing}
                        >
                            {replacing ? "Processing..." : "Replace Images & Finalize"}
                            {!replacing && <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: '0.5rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                        </button>
                        {!canReplace && imageConfigs.length > 0 && (
                            <p className={styles.hint}>Upload at least one image to proceed.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
