"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import { syncUserToFirestore } from "@/lib/firestore-user";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/dashboard");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Sync user to Firestore
      await syncUserToFirestore(result.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for email/password auth if you enable it in Firebase console
    console.log("Email login attempt:", email);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          {/* Logo Icon */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="8" width="6" height="16" rx="3" fill="currentColor" />
            <rect x="14" y="4" width="6" height="24" rx="3" fill="currentColor" />
            <rect x="22" y="10" width="6" height="12" rx="3" fill="currentColor" />
          </svg>
          <span className={styles.logoText}>ValuerApp</span>
        </div>
        <nav className={styles.nav}>
          <Link href="#" className={styles.navLink}>Home</Link>
          <Link href="#" className={styles.navLink}>About</Link>
          <Link href="#" className={styles.navLink}>Contact</Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Left Side - Image & Branding */}
        <div className={styles.hero}>
          <div className={styles.heroBackground}></div>
          <div className={styles.heroOverlay}></div>

          <div className={styles.heroContent}>
            <div className={styles.heroLogo}>
              <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="8" width="6" height="16" rx="3" fill="currentColor" />
                <rect x="14" y="4" width="6" height="24" rx="3" fill="currentColor" />
                <rect x="22" y="10" width="6" height="12" rx="3" fill="currentColor" />
              </svg>
              <span className="text-3xl font-bold">ValuerApp</span>
            </div>
            <p className={styles.heroTitle}>
              Smarter Valuations, Faster Reports.
            </p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className={styles.formSection}>
          <div className={styles.formContainer}>
            <div className={styles.welcomeText}>
              <h1>Welcome Back</h1>
              <p>Sign in to generate your valuation reports.</p>
            </div>

            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}

            <div className={styles.form}>
              <button
                onClick={handleGoogleLogin}
                className={styles.googleBtn}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </button>

              <div className={styles.divider}>
                <div className={styles.dividerLine}>
                  <span></span>
                </div>
                <div className={styles.dividerText}>or</div>
              </div>

              <form onSubmit={handleEmailLogin} className={styles.form}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="Enter your email"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Password</label>
                  <div className={styles.passwordInputWrapper}>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input"
                      placeholder="Enter your password"
                    />
                    <button type="button" className={styles.passwordToggle}>
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <Link href="#" className={styles.forgotPassword}>
                  Forgot password?
                </Link>

                <button type="submit" className={styles.submitBtn}>
                  Sign In
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p>© 2024 ValuerApp. All rights reserved.</p>
          <div className={styles.footerLinks}>
            <Link href="#" className={styles.navLink}>Terms of Service</Link>
            <Link href="#" className={styles.navLink}>Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
