"use client";

import { auth } from "@/lib/firebase";
import styles from "./dashboard.module.css";
import { useEffect, useState, useRef } from "react";
import { getUserData, UserData } from "@/lib/firestore-user";
import { getUserReports, createSampleReport, createReportFromStructure, createReportShell, updateReport, deleteReport, Report } from "@/lib/firestore-reports";
import { uploadReportFile } from "@/lib/storage-reports";
import { onAuthStateChanged } from "firebase/auth";
import MobileDashboard from "./mobile-dashboard";
import { useRouter } from "next/navigation"; // Correct import for App Router
import { useCustomAlert } from "@/components/CustomAlert";
import { useCustomConfirm } from "@/components/CustomConfirm";

export default function Dashboard() {
    const router = useRouter();
    const { showAlert, AlertComponent } = useCustomAlert();
    const { showConfirm, ConfirmComponent } = useCustomConfirm();
    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [reports, setReports] = useState<Report[]>([]);
    const [isMobile, setIsMobile] = useState(false);
    const [loadingReports, setLoadingReports] = useState(true);
    const draftReports = reports.filter(r => r.metadata?.status !== 'created' && r.metadata?.status !== 'completed');

    // New Report State
    const [newAddress, setNewAddress] = useState("");
    const [briefFile, setBriefFile] = useState<File | null>(null);
    const [titleFile, setTitleFile] = useState<File | null>(null);
    const [creating, setCreating] = useState(false);

    const [selectedReportId, setSelectedReportId] = useState("");
    const [viewingReport, setViewingReport] = useState<Report | null>(null);

    const briefInputRef = useRef<HTMLInputElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

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

                // Fetch Reports
                getUserReports(currentUser.uid).then(fetchedReports => {
                    setReports(fetchedReports);
                    setLoadingReports(false);
                    const firstDraft = fetchedReports.find(r => r.metadata?.status !== 'created' && r.metadata?.status !== 'completed');
                    if (firstDraft) {
                        setSelectedReportId(firstDraft.id);
                    }
                });
            }
        });
        return () => unsubscribe();
    }, []);

    const handleCreateSample = async () => {
        if (!user) return;
        try {
            await createSampleReport(user.uid);
            // Refresh list
            const updatedReports = await getUserReports(user.uid);
            setReports(updatedReports);
            showAlert("Sample report created!");
        } catch (error) {
            console.error(error);
            showAlert("Failed to create sample report.");
        }
    };

    const handleStartNewReport = async () => {
        if (!user) return;
        if (!newAddress.trim()) {
            showAlert("Please enter a Property Address.");
            return;
        }
        if (!briefFile || !titleFile) {
            showAlert("Please upload both Brief Doc and Property Title.");
            return;
        }

        setCreating(true);
        try {
            // 1. Create initial report shell
            const newReport = await createReportShell(user.uid, newAddress, {});

            // 2. Upload files
            const uploadedBrief = await uploadReportFile(user.uid, newReport.id, briefFile, "brief");
            const uploadedTitle = await uploadReportFile(user.uid, newReport.id, titleFile, "title");

            // 3. Update report with files
            await updateReport(user.uid, newReport.id, {
                files: {
                    brief: uploadedBrief,
                    title: uploadedTitle
                }
            });

            // 4. Redirect to Pre-processing
            router.push(`/report/preprocess?id=${newReport.id}`);
        } catch (error) {
            console.error(error);
            showAlert("Failed to start new report. See console.");
            setCreating(false);
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "brief" | "title") => {
        if (e.target.files && e.target.files[0]) {
            if (type === "brief") setBriefFile(e.target.files[0]);
            else setTitleFile(e.target.files[0]);
        }
    };

    const handleLoadDraft = () => {
        if (!selectedReportId) return;
        router.push(`/report/meta?id=${selectedReportId}`);
    };

    const handleDeleteDraft = async () => {
        if (!user || !selectedReportId) return;

        const confirmed = await showConfirm("Are you sure you want to delete this report? This cannot be undone.");
        if (!confirmed) return;

        try {
            await deleteReport(user.uid, selectedReportId);

            // Refresh list
            const updatedReports = reports.filter(r => r.id !== selectedReportId);
            setReports(updatedReports);

            if (updatedReports.length > 0) {
                setSelectedReportId(updatedReports[0].id);
            } else {
                setSelectedReportId("");
            }
            showAlert("Report deleted.");
        } catch (error) {
            console.error("Error deleting report:", error);
            showAlert("Failed to delete report.");
        }
    };

    const handleViewReport = (report: Report) => {
        setViewingReport(report);
    };

    const handleEditReport = (report: Report) => {
        router.push(`/report/meta?id=${report.id}`);
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "N/A";
        // Handle Firestore timestamp or JS Date or raw seconds object
        let date;
        if (timestamp && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp && timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) return "N/A";

        return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return "";
        let date;
        if (timestamp && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp && timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) return "";

        return date.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
    };

    if (isMobile) {
        return <MobileDashboard user={user} userData={userData} />;
    }

    return (
        <>
            {AlertComponent}
            {ConfirmComponent}
            <div className={styles.dashboardContainer}>
                {/* Welcome Section */}
                <div className={styles.welcomeSection}>
                    <h1>
                        Welcome, {userData?.name?.split(" ")[0] || user?.displayName?.split(" ")[0] || "Valuer"}
                        <span className={styles.jobNumberText}>(Valuer Registration ID: {userData?.valuerJobNumber || "..."})</span>
                    </h1>
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
                        <p className={styles.statValue}>{reports.length}</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>In-Progress</p>
                        <p className={styles.statValue}>{reports.filter(r => r.metadata?.status === 'in_progress').length}</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>Completed</p>
                        <p className={styles.statValue}>{reports.filter(r => r.metadata?.status === 'completed').length}</p>
                    </div>
                </div>

                <div className={styles.actionGrid}>
                    {/* 1. Upload Files */}
                    <div className={styles.actionCard}>
                        <h2 className={styles.cardTitle}>Upload Files</h2>
                        <div className={styles.inputGroup}>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Brief Doc</label>
                                <div className={styles.fileInputWrapper}>
                                    <input
                                        type="text"
                                        className={`input ${styles.fileInput}`}
                                        value={briefFile ? briefFile.name : ""}
                                        placeholder="Upload (.pdf, .doc)"
                                        readOnly
                                        onClick={() => briefInputRef.current?.click()}
                                    />
                                    <button className={styles.fileBtn} onClick={() => briefInputRef.current?.click()}>Choose</button>
                                    <input
                                        type="file"
                                        ref={briefInputRef}
                                        hidden
                                        onChange={(e) => onFileChange(e, "brief")}
                                        accept=".pdf,.doc,.docx"
                                    />
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Property Title</label>
                                <div className={styles.fileInputWrapper}>
                                    <input
                                        type="text"
                                        className={`input ${styles.fileInput}`}
                                        value={titleFile ? titleFile.name : ""}
                                        placeholder="Upload (.pdf, .doc)"
                                        readOnly
                                        onClick={() => titleInputRef.current?.click()}
                                    />
                                    <button className={styles.fileBtn} onClick={() => titleInputRef.current?.click()}>Choose</button>
                                    <input
                                        type="file"
                                        ref={titleInputRef}
                                        hidden
                                        onChange={(e) => onFileChange(e, "title")}
                                        accept=".pdf,.doc,.docx"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Start New Report */}
                    <div className={styles.actionCard}>
                        <h2 className={styles.cardTitle}>Start New Report</h2>
                        <div className={styles.inputGroup}>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Property Address</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., 123 Queen Street, Auckland"
                                    style={{ maxWidth: '100%' }}
                                    value={newAddress}
                                    onChange={(e) => setNewAddress(e.target.value)}
                                />
                            </div>

                            <div style={{ flexGrow: 1 }}></div>

                            <button
                                className={`btn btn-primary ${styles.generateBtn}`}
                                onClick={handleStartNewReport}
                                disabled={creating}
                            >
                                {creating ? "Creating..." : (
                                    <>
                                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                        New Report
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* 3. Continue Draft */}
                    <div className={styles.actionCard}>
                        <h2 className={styles.cardTitle}>Continue Draft</h2>
                        <div className={styles.inputGroup}>
                            <div className={styles.selectWrapper}>
                                <select
                                    className="input"
                                    style={{ appearance: 'none', width: '100%' }}
                                    value={selectedReportId}
                                    onChange={(e) => setSelectedReportId(e.target.value)}
                                >
                                    {draftReports.length > 0 ? (
                                        draftReports.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {(r.metadata?.fields?.['address']?.value || "Untitled").substring(0, 40)}...
                                            </option>
                                        ))
                                    ) : (
                                        <option value="">No drafts available</option>
                                    )}
                                </select>
                                <div className={styles.selectIcon}>
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>

                            <div style={{ flexGrow: 1 }}></div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className={`btn ${styles.actionBtn}`}
                                    onClick={handleLoadDraft}
                                    disabled={!selectedReportId}
                                    style={{ flex: 1 }}
                                >
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    Load
                                </button>
                                <button
                                    className="btn"
                                    onClick={handleDeleteDraft}
                                    disabled={!selectedReportId}
                                    style={{
                                        backgroundColor: '#fee2e2',
                                        color: '#b91c1c',
                                        border: '1px solid #fecaca',
                                        padding: '0.5rem 1rem'
                                    }}
                                    title="Delete Report"
                                >
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Completed Reports Table */}
                <div className={styles.tableCard}>
                    <div className={styles.tableHeader}>
                        <h2 className={styles.cardTitle}>Recent Reports</h2>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Property Address</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingReports ? (
                                    <tr><td colSpan={4} className="p-4 text-center">Loading reports...</td></tr>
                                ) : reports.length === 0 ? (
                                    <tr><td colSpan={4} className="p-4 text-center">No reports found</td></tr>
                                ) : (
                                    reports.map((report) => (
                                        <tr key={report.id}>
                                            <td className={styles.primaryText}>{report.metadata?.fields?.['address']?.value || "N/A"}</td>
                                            <td>
                                                <span style={{
                                                    textTransform: 'capitalize',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75rem',
                                                    backgroundColor: report.metadata?.status === 'completed' ? '#d1fae5' : '#fef3c7',
                                                    color: report.metadata?.status === 'completed' ? '#065f46' : '#92400e'
                                                }}>
                                                    {(report.metadata?.status || 'draft').replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td>{formatDate(report.metadata?.createdAt)}</td>
                                            <td>
                                                <div className={styles.actionsCell}>
                                                    <button className={styles.iconBtn} title="View Details" onClick={() => handleViewReport(report)}>
                                                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                    </button>
                                                    <button className={styles.iconBtn} title="Edit" onClick={() => handleEditReport(report)}>
                                                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {viewingReport && (
                    <div className={styles.modalOverlay} onClick={() => setViewingReport(null)}>
                        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h2 className={styles.modalTitle}>Report Abstract</h2>
                                <button className={styles.closeBtn} onClick={() => setViewingReport(null)}>&times;</button>
                            </div>
                            <div className={styles.modalBody}>
                                <div className={styles.infoGrid}>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>Property Address</span>
                                        <span className={styles.infoValue}>{viewingReport.metadata?.fields?.['address']?.value || "N/A"}</span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>Valuation Date</span>
                                        <span className={styles.infoValue}>{viewingReport.metadata?.fields?.['dateOfValuation']?.value || "N/A"}</span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>Prepared For</span>
                                        <span className={styles.infoValue}>{viewingReport.metadata?.fields?.['preparedFor']?.value || "N/A"}</span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>Client</span>
                                        <span className={styles.infoValue}>{viewingReport.metadata?.fields?.['client']?.value || "N/A"}</span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>Status</span>
                                        <span className={styles.infoValue} style={{ textTransform: 'capitalize', display: 'inline-block', padding: '2px 8px', borderRadius: '12px', background: viewingReport.metadata?.status === 'completed' ? '#d1fae5' : '#fef3c7', color: viewingReport.metadata?.status === 'completed' ? '#065f46' : '#92400e' }}>
                                            {(viewingReport.metadata?.status || "draft").replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
