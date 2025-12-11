"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getTemplates, uploadTemplate, deleteTemplate, ReportTemplate } from "@/lib/firestore-templates";
import styles from "./page.module.css";
import { Timestamp } from "firebase/firestore";
import { useCustomAlert } from "@/components/CustomAlert";
import { useCustomConfirm } from "@/components/CustomConfirm";

// Icons
const UploadIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
);

const FileIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);

const DownloadIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const TrashIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
);

export default function TemplatesPage() {
    const { showAlert, AlertComponent } = useCustomAlert();
    const { showConfirm, ConfirmComponent } = useCustomConfirm();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState<ReportTemplate[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                loadTemplates(currentUser.uid);
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [router]);

    const loadTemplates = async (uid: string) => {
        setLoading(true);
        const data = await getTemplates(uid);
        setTemplates(data);
        setLoading(false);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !user) return;

        const file = files[0];
        // Validate file type
        const validExtensions = ['.doc', '.docx', '.dot', '.dotx'];
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(extension)) {
            showAlert("Invalid file type. Please upload a Word document (.doc, .docx, .dot, .dotx).");
            e.target.value = ""; // Reset
            return;
        }

        // Check for duplicate filename
        const duplicate = templates.find(t => t.name === file.name);
        if (duplicate) {
            showAlert(`A template named "${file.name}" already exists.\nPlease rename your file locally before uploading to prevent overwriting the existing template.`);
            e.target.value = ""; // Reset
            return;
        }

        setUploading(true);
        try {
            await uploadTemplate(user.uid, file);
            await loadTemplates(user.uid); // Refresh
        } catch (error) {
            console.error("Upload failed", error);
            showAlert("Failed to upload template.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDelete = async (template: ReportTemplate) => {
        const confirmed = await showConfirm(`Are you sure you want to delete "${template.name}"?`);
        if (!confirmed) return;

        try {
            await deleteTemplate(user.uid, template.id, template.storagePath);
            // Optimistic update or reload
            await loadTemplates(user.uid);
        } catch (error) {
            console.error("Delete failed", error);
            showAlert("Failed to delete template.");
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "-";
        // Handle Firestore Timestamp or Date object
        const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString();
    };

    if (loading && !user) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    return (
        <>
            {AlertComponent}
            {ConfirmComponent}
            <div className={styles.container}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Manage Templates</h1>
                        <p className={styles.description}>Upload and manage your .docx report templates. These are saved on the server for global use.</p>
                    </div>
                    <button
                        className={styles.uploadBtn}
                        onClick={handleUploadClick}
                        disabled={uploading}
                    >
                        <UploadIcon />
                        {uploading ? "Uploading..." : "Upload .docx Template"}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".doc,.docx,.dot,.dotx"
                        style={{ display: 'none' }}
                    />
                </div>

                <div className={styles.listContainer}>
                    <div className={styles.listHeader}>
                        <div>
                            <h2 className={styles.listTitle}>Your Templates</h2>
                            <p className={styles.listSubtitle}>These templates will be available when generating a new report.</p>
                        </div>
                    </div>

                    <div className={styles.tableHeader}>
                        <span>Template Name</span>
                        <span>Upload Date</span>
                        <span style={{ textAlign: 'right' }}>Actions</span>
                    </div>

                    <div className={styles.list}>
                        {templates.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                No templates found. Upload one to get started.
                            </div>
                        ) : (
                            templates.map((template) => (
                                <div key={template.id} className={styles.listItem}>
                                    <div className={styles.itemInfo}>
                                        <div className={styles.fileIcon}><FileIcon /></div>
                                        <span className={styles.itemName} title={template.name}>{template.name}</span>
                                    </div>
                                    <span className={styles.itemDate}>{formatDate(template.createdAt)}</span>
                                    <div className={styles.actions}>
                                        <a
                                            href={template.downloadUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`${styles.iconBtn} ${styles.downloadBtn}`}
                                            title="Download"
                                            download // Hint to browser
                                        >
                                            <DownloadIcon />
                                        </a>
                                        <button
                                            className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                            onClick={() => handleDelete(template)}
                                            title="Delete"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

        </>
    );
}
