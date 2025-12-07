"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getReport, Report } from "@/lib/firestore-reports";
import styles from "../download/page.module.css";
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

    if (loading) return <div className="p-12 text-center text-lg">Loading...</div>;
    if (!report) return <div className="p-12 text-center text-lg">Report not found.</div>;

    const finalReport = report.finalReport;

    return (
        <div className={styles.container}>
            <div className={styles.card} style={{ maxWidth: '480px' }}> {/* Override max-width back to card size */}

                <div className={styles.successIcon}>
                    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>

                <h1 className={styles.title}>All Systems Go!</h1>
                <p className={styles.subtitle}>Your report has been finalized with images.</p>

                <div className={styles.fileCard}>
                    <div className={styles.fileIcon}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className={styles.fileDetails}>
                        <div className={styles.fileName} title={finalReport?.name}>
                            {finalReport?.name || "Final_Report.docx"}
                        </div>
                        <div className={styles.fileMeta}>
                            {finalReport?.createdAt ? new Date(finalReport.createdAt).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}
                        </div>
                    </div>
                </div>

                <div className={styles.actions}>
                    {finalReport?.url ? (
                        <a
                            href={finalReport.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.downloadBtn}
                        >
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '0.5rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download Final Report
                        </a>
                    ) : (
                        <div className="text-red-500 text-sm p-3 bg-red-50 rounded mb-2">
                            Generating final file, please refresh briefly...
                        </div>
                    )}

                    <Link href="/dashboard" className={styles.dashboardBtn}>
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
