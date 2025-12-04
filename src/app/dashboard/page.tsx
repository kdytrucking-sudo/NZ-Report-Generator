"use client";

import { auth } from "@/lib/firebase";
import styles from "./dashboard.module.css";
import { useEffect, useState } from "react";
import { getUserData, UserData } from "@/lib/firestore-user";
import { onAuthStateChanged } from "firebase/auth";
import MobileDashboard from "./mobile-dashboard";

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        // Initial check
        checkMobile();

        // Listener
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const data = await getUserData(currentUser.uid);
                setUserData(data);
            }
        });
        return () => unsubscribe();
    }, []);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "N/A";
        // Handle Firestore timestamp or JS Date
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
    };

    if (isMobile) {
        return <MobileDashboard user={user} userData={userData} />;
    }

    return (
        <div className={styles.dashboardContainer}>
            {/* Welcome Section */}
            <div className={styles.welcomeSection}>
                <h1>Welcome, {userData?.name?.split(" ")[0] || user?.displayName?.split(" ")[0] || "Valuer"}</h1>
                <p>Valuer ID: {userData?.valuerId || "Loading..."}</p>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Last Login</p>
                    <p className={styles.statValue}>
                        {formatDate(userData?.lastLogin)}
                        <span className={styles.statSubValue}>
                            {formatTime(userData?.lastLogin)}
                        </span>
                    </p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Total Reports</p>
                    <p className={styles.statValue}>{userData?.totalReports ?? 0}</p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>In-Progress</p>
                    <p className={styles.statValue}>{userData?.inProgressReports ?? 0}</p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Completed</p>
                    <p className={styles.statValue}>{userData?.completedReports ?? 0}</p>
                </div>
            </div>

            <div className={styles.actionGrid}>
                {/* Start New Report */}
                <div className={styles.actionCard}>
                    <h2 className={styles.cardTitle}>Start a New Report</h2>

                    <div className={styles.toggleGroup}>
                        <button className={`${styles.toggleBtn} ${styles.toggleBtnActive}`}>From PC</button>
                        <button className={styles.toggleBtn}>From Inspection</button>
                    </div>

                    <div className={styles.inputGroup}>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>Property Address</label>
                            <input type="text" className="input" placeholder="e.g., 123 Queen Street, Auckland" style={{ maxWidth: '100%' }} />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>Brief Doc</label>
                            <div className={styles.fileInputWrapper}>
                                <input type="text" className={`input ${styles.fileInput}`} placeholder="Upload a file (.pdf, .doc)" readOnly />
                                <button className={styles.fileBtn}>
                                    Choose File
                                </button>
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>Property Title</label>
                            <div className={styles.fileInputWrapper}>
                                <input type="text" className={`input ${styles.fileInput}`} placeholder="Upload a file (.pdf, .doc)" readOnly />
                                <button className={styles.fileBtn}>
                                    Choose File
                                </button>
                            </div>
                        </div>

                        <button className={`btn btn-primary ${styles.generateBtn}`}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            Generate Report
                        </button>
                    </div>
                </div>

                {/* Continue Draft */}
                <div className={styles.actionCard}>
                    <h2 className={styles.cardTitle}>Continue a Draft</h2>

                    <div className={styles.selectWrapper}>
                        <select className="input" style={{ appearance: 'none' }}>
                            <option>REP-2023-08-012: 55 Main St...</option>
                            <option>REP-2023-08-011: 12 Beach Rd...</option>
                        </select>
                        <div className={styles.selectIcon}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <button className={`btn ${styles.actionBtn}`}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            Load into PC
                        </button>
                        <button className={`btn ${styles.actionBtn}`}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            Load into Inspection
                        </button>
                    </div>
                </div>
            </div>

            {/* Completed Reports Table */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <h2 className={styles.cardTitle}>Completed Reports</h2>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Property Address</th>
                                <th>Completion Date</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { address: "246 Lambton Quay, Wellington Central", date: "10 Aug 2023" },
                                { address: "188 Quay Street, Auckland CBD", date: "05 Aug 2023" },
                                { address: "7 Rolleston Avenue, Christchurch Central City", date: "28 Jul 2023" },
                            ].map((report, i) => (
                                <tr key={i}>
                                    <td className={styles.primaryText}>{report.address}</td>
                                    <td>{report.date}</td>
                                    <td>
                                        <div className={styles.actionsCell}>
                                            <button className={styles.iconBtn}>
                                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            </button>
                                            <button className={styles.iconBtn}>
                                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
