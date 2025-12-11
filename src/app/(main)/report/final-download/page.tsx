"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getReport, Report } from "@/lib/firestore-reports";
import styles from "./page.module.css";
import Link from "next/link";

export default function FinalDownloadPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reportId = searchParams.get("id");

    const [user, setUser] = useState<any>(null);
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p className={styles.loadingText}>Loading...</p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className={styles.errorContainer}>
                <div className={styles.errorIcon}>⚠️</div>
                <h2 className={styles.errorTitle}>Report Not Found</h2>
                <p className={styles.errorText}>The report you're looking for doesn't exist.</p>
                <Link href="/dashboard" className={styles.backBtn}>
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    const finalReport = report.finalReport;

    return (
        <div className={styles.container}>
            <div className={styles.successCard}>
                {/* Animated Success Icon */}
                <div className={styles.iconWrapper}>
                    <div className={styles.successCircle}>
                        <svg className={styles.checkmark} viewBox="0 0 52 52">
                            <circle className={styles.checkmarkCircle} cx="26" cy="26" r="25" fill="none" />
                            <path className={styles.checkmarkCheck} fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                        </svg>
                    </div>
                </div>

                {/* Title Section */}
                <div className={styles.titleSection}>
                    <h1 className={styles.mainTitle}>All Systems Go! 🎉</h1>
                    <p className={styles.subtitle}>Your report has been finalized with images and is ready to download.</p>
                </div>

                {/* File Info Card */}
                <div className={styles.fileInfoCard}>
                    <div className={styles.fileIconContainer}>
                        <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div className={styles.fileDetails}>
                        <div className={styles.fileName} title={finalReport?.name}>
                            {finalReport?.name || "Final_Report.docx"}
                        </div>
                        <div className={styles.fileTime}>
                            {finalReport?.createdAt
                                ? new Date(finalReport.createdAt).toLocaleString('en-NZ', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short'
                                })
                                : 'Just now'}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.actionSection}>
                    {finalReport?.url ? (
                        <a
                            href={finalReport.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.downloadButton}
                        >
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Download Final Report</span>
                        </a>
                    ) : (
                        <div className={styles.processingCard}>
                            <div className={styles.processingSpinner}></div>
                            <span>Generating final file, please refresh briefly...</span>
                        </div>
                    )}

                    <Link href="/dashboard" className={styles.dashboardButton}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span>Return to Dashboard</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
