"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import styles from "./page.module.css";
import { getUserReports, Report } from "@/lib/firestore-reports";

export default function JobStatisticsPage() {
    const [user, setUser] = useState<any>(null);
    const [reports, setReports] = useState<Report[]>([]); // Keep for future real logic
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                // For design matching, we stick to mock data primarily, but fetch reports to show we can
                const data = await getUserReports(currentUser.uid);
                setReports(data);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // --- Mock Data for Design Fidelity ---
    // User requested: "先不处理逻辑， 只设计页面" (Logic not handled yet, just page design)
    // So we hardcode the values to match the screenshot or similar realistic example.

    // We can switch to real data later by replacing these variables.
    const stats = {
        total: 84,
        completed: 72,
        uncompleted: 12,
        independent: 65,
        collaborated: 7,

        totalPct: "+5%",
        completedPct: "+8%",
        uncompletedPct: "-2%",
        independentPct: "+6%",
        collaboratedPct: "+1%",
    };

    const finance = {
        totalValue: 125300,
        yourShare: 98750,
        paidToOthers: 8200,

        totalPct: "+12%",
        sharePct: "+15%",
    };

    const recentData = [
        { id: '1', name: '123 Queen Street, Auckland', amount: 1500, status: 'Solo', misc: 50 },
        { id: '2', name: '45 Lambton Quay, Wellington', amount: 2200, status: 'Team', misc: 120 },
        { id: '3', name: '78 Cashel Street, Christchurch', amount: 1800, status: 'Solo', misc: 75 },
        { id: '4', name: '200 Victoria St West, Auckland', amount: 3100, status: 'Team', misc: 200 },
        { id: '5', name: '33 George Street, Dunedin', amount: 1350, status: 'Solo', misc: 40 },
    ];

    const renderChange = (text: string) => {
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
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Total Reports</div>
                        <div className={styles.cardValue}>{stats.total}</div>
                        {renderChange(stats.totalPct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Completed</div>
                        <div className={styles.cardValue}>{stats.completed}</div>
                        {renderChange(stats.completedPct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Uncompleted</div>
                        <div className={styles.cardValue}>{stats.uncompleted}</div>
                        {renderChange(stats.uncompletedPct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Independent</div>
                        <div className={styles.cardValue}>{stats.independent}</div>
                        {renderChange(stats.independentPct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Collaborated</div>
                        <div className={styles.cardValue}>{stats.collaborated}</div>
                        {renderChange(stats.collaboratedPct)}
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            <div>
                <h2 className={styles.sectionTitle}>Financial Summary</h2>
                <div className={styles.financialGrid}>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Total Contract Value</div>
                        <div className={styles.cardValue}>${finance.totalValue.toLocaleString()}</div>
                        {renderChange(finance.totalPct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Your Share</div>
                        <div className={styles.cardValue}>${finance.yourShare.toLocaleString()}</div>
                        {renderChange(finance.sharePct)}
                    </div>
                    <div className={styles.card}>
                        <div className={styles.cardLabel}>Paid to Collaborators</div>
                        <div className={styles.cardValue}>${finance.paidToOthers.toLocaleString()}</div>
                        <span className={styles.cardChange} style={{ color: '#94a3b8' }}>— -</span>
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
                                <th>Report Name</th>
                                <th>Contract Amount</th>
                                <th>Status</th>
                                <th>Misc Fees</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentData.map((row) => (
                                <tr key={row.id}>
                                    <td className={styles.reportName}>{row.name}</td>
                                    <td>${row.amount.toLocaleString()}</td>
                                    <td>
                                        <span className={`${styles.badge} ${row.status === 'Solo' ? styles.badgeSolo : styles.badgeTeam}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                    <td>${row.misc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
