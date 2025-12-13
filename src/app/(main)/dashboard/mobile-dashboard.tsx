"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import styles from "./mobile-dashboard.module.css";
import { UserData } from "@/lib/firestore-user";
import { getUserReports, Report, createReportShell } from "@/lib/firestore-reports";
import { useCustomAlert } from "@/components/CustomAlert";

interface MobileDashboardProps {
    user: any;
    userData: UserData | null;
}

export default function MobileDashboard({ user, userData }: MobileDashboardProps) {
    const router = useRouter();
    const { showAlert, AlertComponent } = useCustomAlert();
    const [address, setAddress] = useState("");
    const [reports, setReports] = useState<Report[]>([]);
    const [selectedReportId, setSelectedReportId] = useState("");
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        inProgress: 0,
        completed: 0
    });

    useEffect(() => {
        if (user) {
            loadReports();
        }
    }, [user]);

    const loadReports = async () => {
        if (!user) return;
        const fetchedReports = await getUserReports(user.uid);

        // Filter only draft reports (not Report_completed)
        const draftReports = fetchedReports.filter(r => r.status !== 'Report_Completed');
        setReports(draftReports);

        // Calculate stats from all reports
        const total = fetchedReports.length;
        const inProgress = fetchedReports.filter(r => r.status !== 'Report_Completed').length;
        const completed = fetchedReports.filter(r => r.status === 'Report_Completed').length;

        setStats({ total, inProgress, completed });

        if (draftReports.length > 0) {
            setSelectedReportId(draftReports[0].id);
        }
    };

    const handleGenerateReport = async () => {
        if (!address.trim()) {
            showAlert("Please enter a property address");
            return;
        }

        setLoading(true);
        try {
            const newReport = await createReportShell(user.uid, address, {});
            router.push(`/report/${newReport.id}/preprocess`);
        } catch (error) {
            console.error("Error creating report:", error);
            showAlert("Failed to create report");
        } finally {
            setLoading(false);
        }
    };

    const handleLoadDraft = () => {
        if (!selectedReportId) {
            showAlert("Please select a draft to load");
            return;
        }
        router.push(`/report/${selectedReportId}/preprocess`);
    };

    return (
        <>
            {AlertComponent}
            <div className={styles.container}>
                <main className={styles.main}>
                    {/* Start New Report Card */}
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Start a New Report</h2>
                        <div className={styles.inputRow}>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="e.g., 123 Queen Street, Auckland"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                            <button
                                className={styles.addBtn}
                                onClick={handleGenerateReport}
                                disabled={loading}
                            >
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Continue Draft Card */}
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Continue a Draft</h2>
                        <div className={styles.inputRow}>
                            <div className={styles.selectWrapper}>
                                <select
                                    className={styles.input}
                                    value={selectedReportId}
                                    onChange={(e) => setSelectedReportId(e.target.value)}
                                >
                                    {reports.length === 0 ? (
                                        <option value="">No drafts available</option>
                                    ) : (
                                        reports.map(report => {
                                            const displayAddress = report.metadata?.fields?.['address']?.value || report.id || 'Untitled Report';
                                            return (
                                                <option key={report.id} value={report.id}>
                                                    {displayAddress}
                                                </option>
                                            );
                                        })
                                    )}
                                </select>
                                <div className={styles.selectIcon}>
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <button
                                className={styles.loadBtn}
                                onClick={handleLoadDraft}
                                disabled={!selectedReportId || reports.length === 0}
                            >
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className={styles.card} style={{ padding: '0.5rem' }}>
                        <div className={styles.statsRow}>
                            <div className={styles.statItem}>
                                <div className={styles.statLabel}>Total</div>
                                <div className={styles.statValue}>{stats.total}</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statLabel}>In-Progress</div>
                                <div className={styles.statValue}>{stats.inProgress}</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statLabel}>Completed</div>
                                <div className={styles.statValue}>{stats.completed}</div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className={styles.footer}>
                    <p>© 2023 NZ Valuers. All rights reserved.</p>
                    <div className={styles.footerLinks}>
                        <a href="#" className={styles.footerLink}>Help</a>
                        <a href="#" className={styles.footerLink}>Terms of Service</a>
                        <a href="#" className={styles.footerLink}>Privacy Policy</a>
                    </div>
                </footer>
            </div>
        </>
    );
}
