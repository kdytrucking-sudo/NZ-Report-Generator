"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "./mobile-dashboard.module.css";
import { UserData } from "@/lib/firestore-user";

interface MobileDashboardProps {
    user: any;
    userData: UserData | null;
}

export default function MobileDashboard({ user, userData }: MobileDashboardProps) {
    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.brand}>
                    <div className={styles.brandIcon}></div>
                    <span>NZ Valuers</span>
                </div>
                <div className={styles.headerRight}>
                    <button onClick={() => signOut(auth)} className={styles.logoutBtn}>
                        Log Out
                    </button>
                    <div className={styles.avatar}>
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Avatar" />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#6B7280' }}>
                                {user?.displayName?.[0] || "U"}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                {/* Welcome Section */}
                <div className={styles.welcomeSection}>
                    <h1>Welcome, {userData?.name?.split(" ")[0] || user?.displayName?.split(" ")[0] || "Valuer"}</h1>
                    <p className={styles.valuerId}>Valuer ID: {userData?.valuerId || "Loading..."}</p>
                </div>

                {/* Start New Report Card */}
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Start a New Report</h2>
                    <label className={styles.label}>From Inspection</label>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="e.g., 123 Queen Street, Auckland"
                    />
                    <button className={styles.primaryBtn}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Generate Report
                    </button>
                </div>

                {/* Continue Draft Card */}
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Continue a Draft</h2>
                    <div className={styles.selectWrapper}>
                        <select className={styles.input} style={{ marginBottom: 0, appearance: 'none' }}>
                            <option>REP-2023-08-012: 55 Main St...</option>
                            <option>REP-2023-08-011: 12 Beach Rd...</option>
                        </select>
                        <div className={styles.selectIcon}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    <button className={styles.secondaryBtn} style={{ marginTop: '1rem' }}>
                        Load
                    </button>
                </div>

                {/* Stats Row */}
                <div className={styles.card} style={{ padding: '0.5rem' }}>
                    <div className={styles.statsRow}>
                        <div className={styles.statItem}>
                            <div className={styles.statLabel}>Total</div>
                            <div className={styles.statValue}>{userData?.totalReports ?? 0}</div>
                        </div>
                        <div className={styles.statItem}>
                            <div className={styles.statLabel}>In-Progress</div>
                            <div className={styles.statValue}>{userData?.inProgressReports ?? 0}</div>
                        </div>
                        <div className={styles.statItem}>
                            <div className={styles.statLabel}>Completed</div>
                            <div className={styles.statValue}>{userData?.completedReports ?? 0}</div>
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
    );
}
