"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getImageConfigs, saveImageConfig, deleteImageConfig, ImageConfigCard } from "@/lib/firestore-image-config";
import { useCustomConfirm } from "@/components/CustomConfirm";
import styles from "./page.module.css";
import { useCustomAlert } from "@/components/CustomAlert";

// Helper Icons
const TrashIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
);

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const SaveIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
);


export default function ImageConfigPage() {
    const { showConfirm, ConfirmComponent } = useCustomConfirm();
    const { showAlert, AlertComponent } = useCustomAlert();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [configs, setConfigs] = useState<ImageConfigCard[]>([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                loadConfigs(currentUser.uid);
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [router]);

    const loadConfigs = async (uid: string) => {
        setLoading(true);
        const data = await getImageConfigs(uid);
        setConfigs(data);
        setLoading(false);
    };

    const handleAdd = () => {
        const newConfig: ImageConfigCard = {
            id: "", // generated on save
            uid: user.uid,
            name: "New Image",
            placeholder: "{%Image_New}",
            width: 230,
            height: 160
        };
        setConfigs([...configs, newConfig]);
    };

    const handleDelete = async (index: number) => {
        const config = configs[index];
        const confirmed = await showConfirm("Are you sure you want to delete this configuration?");
        if (confirmed) {
            if (config.id) {
                await deleteImageConfig(user.uid, config.id);
            }
            const newConfigs = [...configs];
            newConfigs.splice(index, 1);
            setConfigs(newConfigs);
        }
    };

    const handleChange = (index: number, field: keyof ImageConfigCard, value: any) => {
        const newConfigs = [...configs];
        newConfigs[index] = { ...newConfigs[index], [field]: value };
        setConfigs(newConfigs);
    };

    const handleSave = async (index: number) => {
        const config = configs[index];
        if (!config.name.trim()) {
            showAlert("Name is required.");
            return;
        }
        try {
            const newId = await saveImageConfig(user.uid, config);
            if (newId) {
                const newConfigs = [...configs];
                newConfigs[index].id = newId;
                setConfigs(newConfigs);
                showAlert("Saved!");
            }
        } catch (e) {
            console.error(e);
            showAlert("Failed to save.");
        }
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
                        <h1 className={styles.title}>Manage Image Configurations</h1>
                        <p className={styles.description}>Define reusable image placeholders with their default dimensions.</p>
                    </div>
                    <button className={styles.addBtn} onClick={handleAdd}>
                        <PlusIcon />
                        Add Config
                    </button>
                </div>

                <div className={styles.grid}>
                    {configs.map((config, index) => (
                        <div key={config.id || `temp-${index}`} className={styles.card}>

                            {/* Row 1: Name (Label + Input + Icons) */}
                            <div className={styles.rowOne}>
                                <span className={styles.nameLabel}>Name</span>
                                <div style={{ flex: 1 }}> {/* Wrapper to ensure input doesn't collapse */}
                                    <input
                                        className={`${styles.input}`}
                                        style={{ width: '100%' }}
                                        value={config.name}
                                        onChange={(e) => handleChange(index, "name", e.target.value)}
                                        placeholder="Image Name"
                                    />
                                </div>
                                <button
                                    className={`${styles.iconBtn} ${styles.saveIconBtn}`}
                                    onClick={() => handleSave(index)}
                                    title="Save"
                                >
                                    <SaveIcon />
                                </button>
                                <button
                                    className={`${styles.iconBtn} ${styles.deleteIconBtn}`}
                                    onClick={() => handleDelete(index)}
                                    title="Delete"
                                >
                                    <TrashIcon />
                                </button>
                            </div>

                            {/* Row 2: Holder */}
                            <div className={styles.rowTwo}>
                                <span className={styles.holderLabel}>Holder</span>
                                <input
                                    className={`${styles.input}`}
                                    value={config.placeholder}
                                    onChange={(e) => handleChange(index, "placeholder", e.target.value)}
                                    placeholder="{%Image_Tag}"
                                />
                            </div>

                            {/* Row 3: Dimensions */}
                            <div className={styles.rowThree}>
                                <span className={styles.nameLabel} style={{ width: '45px' }}>Width</span>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={config.width}
                                    onChange={(e) => handleChange(index, "width", e.target.value)}
                                />

                                <span className={styles.nameLabel} style={{ width: 'auto', marginLeft: '1rem' }}>Height</span>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={config.height}
                                    onChange={(e) => handleChange(index, "height", e.target.value)}
                                />
                            </div>

                        </div>
                    ))}
                </div>

                {configs.length === 0 && !loading && (
                    <div className="text-center p-8 text-gray-500">
                        No image configurations found. Click "Add Config" to start.
                    </div>
                )}
            </div>

        </>
    );
}
