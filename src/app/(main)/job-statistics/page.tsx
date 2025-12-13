"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import styles from "./page.module.css";
import { getUserReports, Report } from "@/lib/firestore-reports";

export default function JobStatisticsPage() {
    const [user, setUser] = useState<any>(null);
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const data = await getUserReports(currentUser.uid);
                setReports(data);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Helper function to extract numeric value from field
    const extractNumericValue = (report: Report, placeholder: string): number => {
        const metaFields = report.metadata?.fields || {};
        for (const key in metaFields) {
            const field = metaFields[key];
            if (field.placeholder === placeholder) {
                const value = field.value;
                if (!value || value === '') return 0;

                // Remove $ and , from string
                const cleanValue = typeof value === 'string' ? value.replace(/[\$,]/g, '') : value;
                const numValue = typeof cleanValue === 'number' ? cleanValue : parseFloat(cleanValue);
                return isNaN(numValue) ? 0 : numValue;
            }
        }
        return 0;
    };

    // Helper function to filter reports by timeframe
    const filterReportsByTimeframe = (reports: Report[], timeframe: 'weekly' | 'monthly' | 'yearly', offset: number = 0) => {
        const now = new Date();
        let startDate: Date, endDate: Date;

        if (timeframe === 'weekly') {
            const currentWeekStart = new Date(now);
            currentWeekStart.setDate(now.getDate() - now.getDay() - (offset * 7));
            currentWeekStart.setHours(0, 0, 0, 0);

            const currentWeekEnd = new Date(currentWeekStart);
            currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
            currentWeekEnd.setHours(23, 59, 59, 999);

            startDate = currentWeekStart;
            endDate = currentWeekEnd;
        } else if (timeframe === 'monthly') {
            startDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
        } else { // yearly
            startDate = new Date(now.getFullYear() - offset, 0, 1);
            endDate = new Date(now.getFullYear() - offset, 11, 31, 23, 59, 59, 999);
        }

        return reports.filter(report => {
            const createdAt = report.metadata?.createdAt;
            if (!createdAt) return false;

            let reportDate: Date;
            if (createdAt && typeof createdAt.toDate === 'function') {
                reportDate = createdAt.toDate();
            } else if (createdAt && createdAt.seconds) {
                reportDate = new Date(createdAt.seconds * 1000);
            } else {
                reportDate = new Date(createdAt);
            }

            return reportDate >= startDate && reportDate <= endDate;
        });
    };

    // Calculate financial summary
    const calculateFinancialSummary = () => {
        const currentReports = filterReportsByTimeframe(reports, timeframe, 0);
        const previousReports = filterReportsByTimeframe(reports, timeframe, 1);

        const calculateTotals = (reportsList: Report[]) => {
            let totalPrice = 0;
            let totalShare = 0;
            let totalMileage = 0;

            reportsList.forEach(report => {
                totalPrice += extractNumericValue(report, '[Replace_MetaContractPrice]');
                totalShare += extractNumericValue(report, '[Replace_MetaOffsetCost]');
                totalMileage += extractNumericValue(report, '[Replace_MetaMileage]');
            });

            const totalIncome = totalPrice - totalShare + totalMileage;

            return { totalPrice, totalShare, totalMileage, totalIncome };
        };

        const current = calculateTotals(currentReports);
        const previous = calculateTotals(previousReports);

        const calculateChange = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? '+100%' : '—';
            const change = ((current - previous) / previous) * 100;
            return change >= 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`;
        };

        return {
            totalPrice: current.totalPrice,
            totalShare: current.totalShare,
            totalMileage: current.totalMileage,
            totalIncome: current.totalIncome,

            totalPricePct: calculateChange(current.totalPrice, previous.totalPrice),
            totalSharePct: calculateChange(current.totalShare, previous.totalShare),
            totalMileagePct: calculateChange(current.totalMileage, previous.totalMileage),
            totalIncomePct: calculateChange(current.totalIncome, previous.totalIncome),
        };
    };

    const financialSummary = calculateFinancialSummary();

    // Helper function to get Job Status from metadata
    const getJobStatus = (report: Report) => {
        const metaFields = report.metadata?.fields || {};
        for (const key in metaFields) {
            const field = metaFields[key];
            if (field.placeholder === '[Replace_MetaStatus]') {
                return field.value || 'Initial';
            }
        }
        return 'Initial';
    };

    // Helper function to format Contract Price
    const formatContractPrice = (report: Report) => {
        const value = extractNumericValue(report, '[Replace_MetaContractPrice]');
        return `$${value.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Helper function to format Share Cost
    const formatShareCost = (report: Report) => {
        const value = extractNumericValue(report, '[Replace_MetaOffsetCost]');
        return `$${value.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Helper function to format Mileage
    const formatMileage = (report: Report) => {
        const value = extractNumericValue(report, '[Replace_MetaMileage]');
        return `$${value.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Calculate Report Overview statistics
    const calculateReportOverview = () => {
        const currentReports = filterReportsByTimeframe(reports, timeframe, 0);
        const previousReports = filterReportsByTimeframe(reports, timeframe, 1);

        const calculateStats = (reportsList: Report[]) => {
            const total = reportsList.length;
            const inProgress = reportsList.filter(r => r.status !== 'Report_Completed').length;
            const completed = reportsList.filter(r => r.status === 'Report_Completed').length;

            // Job Statistics - count by meta status
            const jobStats = {
                initial: 0,
                termsSent: 0,
                termsAccepted: 0,
                halfPaid: 0,
                paidCompleted: 0,
            };

            reportsList.forEach(report => {
                const jobStatus = getJobStatus(report);
                switch (jobStatus) {
                    case 'Initial':
                        jobStats.initial++;
                        break;
                    case 'Terms Sent':
                        jobStats.termsSent++;
                        break;
                    case 'Terms Accepted':
                        jobStats.termsAccepted++;
                        break;
                    case 'Half Paid':
                        jobStats.halfPaid++;
                        break;
                    case 'Paid Completed':
                        jobStats.paidCompleted++;
                        break;
                }
            });

            return { total, inProgress, completed, jobStats };
        };

        const current = calculateStats(currentReports);
        const previous = calculateStats(previousReports);

        const calculateChange = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? '+100%' : '—';
            const change = ((current - previous) / previous) * 100;
            return change >= 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`;
        };

        return {
            total: current.total,
            totalPct: calculateChange(current.total, previous.total),

            inProgress: current.inProgress,
            inProgressPct: calculateChange(current.inProgress, previous.inProgress),

            completed: current.completed,
            completedPct: calculateChange(current.completed, previous.completed),

            jobStats: {
                initial: current.jobStats.initial,
                initialPct: calculateChange(current.jobStats.initial, previous.jobStats.initial),

                termsSent: current.jobStats.termsSent,
                termsSentPct: calculateChange(current.jobStats.termsSent, previous.jobStats.termsSent),

                termsAccepted: current.jobStats.termsAccepted,
                termsAcceptedPct: calculateChange(current.jobStats.termsAccepted, previous.jobStats.termsAccepted),

                halfPaid: current.jobStats.halfPaid,
                halfPaidPct: calculateChange(current.jobStats.halfPaid, previous.jobStats.halfPaid),

                paidCompleted: current.jobStats.paidCompleted,
                paidCompletedPct: calculateChange(current.jobStats.paidCompleted, previous.jobStats.paidCompleted),
            }
        };
    };

    const reportOverview = calculateReportOverview();

    const renderChange = (text: string) => {
        if (text === '—') {
            return <span className={styles.cardChange} style={{ color: '#94a3b8' }}>—</span>;
        }
        const isUp = text.startsWith('+');
        const isDown = text.startsWith('-');
        return (
            <span className={`${styles.cardChange} ${isUp ? styles.changeUp : isDown ? styles.changeDown : styles.changeNeutral}`}>
                {isUp ? '↑' : isDown ? '↓' : ''} {text}
            </span>
        );
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>Job Statistics</h1>
                <div className={styles.toggleContainer}>
                    <button
                        className={`${styles.toggleBtn} ${timeframe === 'weekly' ? styles.toggleBtnActive : ''}`}
                        onClick={() => setTimeframe('weekly')}
                    >
                        Weekly
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${timeframe === 'monthly' ? styles.toggleBtnActive : ''}`}
                        onClick={() => setTimeframe('monthly')}
                    >
                        Monthly
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${timeframe === 'yearly' ? styles.toggleBtnActive : ''}`}
                        onClick={() => setTimeframe('yearly')}
                    >
                        Yearly
                    </button>
                </div>
            </div>

            {/* Report Overview */}
            <div>
                <h2 className={styles.sectionTitle}>Report Overview</h2>
                <div className={styles.overviewGrid}>
                    {/* Total Report */}
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Total Reports</div>
                        <div className={styles.cardValue}>{reportOverview.total}</div>
                        {renderChange(reportOverview.totalPct)}
                    </div>

                    {/* Report Statistics */}
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>In-Progress</div>
                        <div className={styles.cardValue}>{reportOverview.inProgress}</div>
                        {renderChange(reportOverview.inProgressPct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Completed</div>
                        <div className={styles.cardValue}>{reportOverview.completed}</div>
                        {renderChange(reportOverview.completedPct)}
                    </div>

                    {/* Job Statistics */}
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Initial</div>
                        <div className={styles.cardValue}>{reportOverview.jobStats.initial}</div>
                        {renderChange(reportOverview.jobStats.initialPct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Terms Sent</div>
                        <div className={styles.cardValue}>{reportOverview.jobStats.termsSent}</div>
                        {renderChange(reportOverview.jobStats.termsSentPct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Terms Accepted</div>
                        <div className={styles.cardValue}>{reportOverview.jobStats.termsAccepted}</div>
                        {renderChange(reportOverview.jobStats.termsAcceptedPct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Half Paid</div>
                        <div className={styles.cardValue}>{reportOverview.jobStats.halfPaid}</div>
                        {renderChange(reportOverview.jobStats.halfPaidPct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Paid Completed</div>
                        <div className={styles.cardValue}>{reportOverview.jobStats.paidCompleted}</div>
                        {renderChange(reportOverview.jobStats.paidCompletedPct)}
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            <div>
                <h2 className={styles.sectionTitle}>Financial Summary</h2>
                <div className={styles.financialGrid}>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Total Price</div>
                        <div className={styles.cardValue}>${financialSummary.totalPrice.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        {renderChange(financialSummary.totalPricePct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Total Share</div>
                        <div className={styles.cardValue}>${financialSummary.totalShare.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        {renderChange(financialSummary.totalSharePct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Total Mileage</div>
                        <div className={styles.cardValue}>${financialSummary.totalMileage.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        {renderChange(financialSummary.totalMileagePct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Total Income</div>
                        <div className={styles.cardValue}>${financialSummary.totalIncome.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        {renderChange(financialSummary.totalIncomePct)}
                    </div>
                </div>
            </div>

            {/* Recent Reports */}
            <div>
                <h2 className={styles.sectionTitle}>Recent Reports</h2>
                <div className={styles.tableCard}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Report Status</th>
                                <th>Job Status</th>
                                <th>Price</th>
                                <th>Share Cost</th>
                                <th>Mileage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Loading reports...</td></tr>
                            ) : reports.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No reports found</td></tr>
                            ) : (
                                reports.map((report) => (
                                    <tr key={report.id}>
                                        <td className={styles.reportName}>
                                            {report.metadata?.fields?.['address']?.value || 'Untitled Report'}
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                backgroundColor: report.status?.includes('Completed') ? '#d1fae5' : '#fef3c7',
                                                color: report.status?.includes('Completed') ? '#065f46' : '#92400e'
                                            }}>
                                                {report.status || 'Initial'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                backgroundColor: '#e0e7ff',
                                                color: '#3730a3'
                                            }}>
                                                {getJobStatus(report)}
                                            </span>
                                        </td>
                                        <td>{formatContractPrice(report)}</td>
                                        <td>{formatShareCost(report)}</td>
                                        <td>{formatMileage(report)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
