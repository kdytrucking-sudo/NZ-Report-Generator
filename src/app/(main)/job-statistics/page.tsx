"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import styles from "../dashboard/dashboard.module.css"; // Reuse dashboard styles for consistency
import { getUserReports, Report } from "@/lib/firestore-reports";

export default function JobStatisticsPage() {
    const [user, setUser] = useState<any>(null);
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('month');

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

    // Dummy Stats Generation
    const totalReports = reports.length;
    const completedReports = reports.filter(r => r.metadata?.status === 'completed').length;
    const inProgressReports = reports.filter(r => r.metadata?.status === 'in_progress' || r.metadata?.status === 'draft').length;

    // Mock collaboration data (since we don't have it in schema yet)
    const collaborativeCount = Math.floor(totalReports * 0.3);
    const independentCount = totalReports - collaborativeCount;

    // Mock Finances
    const totalContractAmount = totalReports * 1500; // Mock avg 1500
    const incomeSplit = totalContractAmount * 0.7; // 70% split
    const outgoingSplit = totalContractAmount * 0.3; // 30% split

    // Recent 10
    const recentReports = reports.slice(0, 10);

    if (loading) return <div className="p-8 text-center">Loading statistics...</div>;

    return (
        <div className={styles.dashboardContainer}> {/* Reusing dashboard container style */}
            <div className={styles.welcomeSection}>
                <h1>Job Statistics</h1>
                <div className="flex gap-2 mt-4">
                    <button
                        className={`px-4 py-2 rounded-full ${timeframe === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        onClick={() => setTimeframe('week')}
                    >Week</button>
                    <button
                        className={`px-4 py-2 rounded-full ${timeframe === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        onClick={() => setTimeframe('month')}
                    >Month</button>
                    <button
                        className={`px-4 py-2 rounded-full ${timeframe === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        onClick={() => setTimeframe('year')}
                    >Year</button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Total Reports</p>
                    <p className={styles.statValue}>{totalReports}</p>
                    <div className="text-sm text-gray-500 mt-1">
                        <span className="text-green-600">{completedReports} Completed</span> • <span className="text-yellow-600">{inProgressReports} In Progress</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Collaboration</p>
                    <div className="flex justify-between items-center mt-2">
                        <div>
                            <span className="block text-2xl font-bold">{independentCount}</span>
                            <span className="text-xs text-gray-500">Independent</span>
                        </div>
                        <div className="h-8 w-px bg-gray-300 mx-2"></div>
                        <div>
                            <span className="block text-2xl font-bold">{collaborativeCount}</span>
                            <span className="text-xs text-gray-500">Joint</span>
                        </div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Contract Value</p>
                    <p className={styles.statValue}>${totalContractAmount.toLocaleString()}</p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Your Earnings</p>
                    <p className={styles.statValue} style={{ color: '#16a34a' }}>${incomeSplit.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Outgoing: ${outgoingSplit.toLocaleString()}</p>
                </div>
            </div>

            {/* Recent Table */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <h2 className={styles.cardTitle}>Recent Reports (Last 10)</h2>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Report Name</th>
                                <th>Contract Amount</th>
                                <th>Type</th>
                                <th>Sundries/Exp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentReports.map(r => (
                                <tr key={r.id}>
                                    <td className={styles.primaryText}>
                                        {r.metadata?.fields?.['address']?.value || "Untitled Report"}
                                    </td>
                                    <td>$1,500.00</td> {/* Mock data */}
                                    <td>
                                        <span className={`px-2 py-1 rounded-full text-xs ${Math.random() > 0.5 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {Math.random() > 0.5 ? 'Collaborative' : 'Independent'}
                                        </span>
                                    </td>
                                    <td>${(Math.random() * 100).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
