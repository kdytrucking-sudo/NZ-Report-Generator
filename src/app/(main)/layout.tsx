"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import styles from "./layout.module.css";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                router.push("/");
            } else {
                setUser(user);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className={styles.layoutContainer}>
            {/* Main Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.brandSection}>
                        <Link href="/dashboard" className={styles.logo}>
                            <div className={styles.logoIcon}></div>
                            <span className={styles.logoText}>NZ Valuers</span>
                        </Link>
                        <nav className={styles.nav}>
                            <Link href="/dashboard" className={`${styles.navLink} ${pathname === '/dashboard' ? styles.navLinkActive : ''}`}>Dashboard</Link>
                            <Link href="/job-statistics" className={`${styles.navLink} ${pathname === '/job-statistics' ? styles.navLinkActive : ''}`}>Job Statistics</Link>
                            <Link href="/mobile-inspection" className={`${styles.navLink} ${pathname === '/mobile-inspection' ? styles.navLinkActive : ''}`}>Mobile Inspection</Link>
                            <Link href="/settings" className={`${styles.navLink} ${pathname?.startsWith('/settings') ? styles.navLinkActive : ''}`}>Settings</Link>
                        </nav>
                    </div>
                    <div className={styles.userSection}>
                        <button
                            onClick={() => signOut(auth)}
                            className={`btn btn-primary ${styles.logoutBtn}`}
                        >
                            Log Out
                        </button>
                        <div className={styles.avatar}>
                            {user.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName} className={styles.avatarImg} />
                            ) : (
                                <div className={styles.avatarPlaceholder}>
                                    {user.displayName ? user.displayName[0] : "U"}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}
