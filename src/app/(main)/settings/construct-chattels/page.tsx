"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
    getConstructSettings,
    saveConstructSettings,
    getChattelsSettings,
    saveChattelsSettings,
    ConstructSettings,
    ChattelsSettings,
    ConstructOption
} from "@/lib/firestore-construct-chattels";
import styles from "./page.module.css";
import { useCustomAlert } from "@/components/CustomAlert";

const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.5 5H17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.66663 5.00001V3.33334C6.66663 2.89131 6.84222 2.46741 7.1548 2.15483C7.46738 1.84225 7.89128 1.66667 8.33329 1.66667H11.6666C12.1086 1.66667 12.5325 1.84225 12.8451 2.15483C13.1577 2.46741 13.3333 2.89131 13.3333 3.33334V5.00001M15.8333 5.00001V16.6667C15.8333 17.1087 15.6577 17.5326 15.3451 17.8452C15.0325 18.1578 14.6086 18.3333 14.1666 18.3333H5.83329C5.39126 18.3333 4.96736 18.1578 4.65478 17.8452C4.3422 17.5326 4.16663 17.1087 4.16663 16.6667V5.00001H15.8333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 3.33334V12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.33337 8H12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function ConstructChattelsPage() {
    const { showAlert, AlertComponent } = useCustomAlert();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // State
    const [constructSettings, setConstructSettings] = useState<ConstructSettings>({ elements: [], interiorElements: [], placeholder: "", replaceholder: "" });
    const [chattelsSettings, setChattelsSettings] = useState<ChattelsSettings>({ list: [], placeholder: "", replaceholder: "" });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                await loadSettings(currentUser.uid);
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [router]);

    const loadSettings = async (uid: string) => {
        setLoading(true);
        const cSettings = await getConstructSettings(uid);
        const chSettings = await getChattelsSettings(uid);

        // Ensure arrays exist
        if (!cSettings.elements) cSettings.elements = [];
        if (!cSettings.interiorElements) cSettings.interiorElements = [];
        if (!chSettings.list) chSettings.list = [];

        setConstructSettings(cSettings);
        setChattelsSettings(chSettings);
        setLoading(false);
    };

    // Generic Handlers for Construct
    const handleConstructAdd = (type: 'elements' | 'interiorElements') => {
        const newItem: ConstructOption = { id: Date.now().toString(), label: "" };
        setConstructSettings(prev => ({
            ...prev,
            [type]: [...prev[type], newItem]
        }));
    };

    const handleConstructChange = (type: 'elements' | 'interiorElements', index: number, val: string) => {
        const newList = [...constructSettings[type]];
        newList[index] = { ...newList[index], label: val };
        setConstructSettings(prev => ({ ...prev, [type]: newList }));
    };

    const handleConstructRemove = (type: 'elements' | 'interiorElements', index: number) => {
        const newList = [...constructSettings[type]];
        newList.splice(index, 1);
        setConstructSettings(prev => ({ ...prev, [type]: newList }));
    };

    const handleSaveConstruct = async () => {
        if (!user) return;
        try {
            await saveConstructSettings(user.uid, constructSettings);
            showAlert("Construct settings saved!");
        } catch (e) {
            console.error(e);
            showAlert("Error saving construct settings");
        }
    };

    // Generic Handlers for Chattels
    const handleChattelsAdd = () => {
        const newItem: ConstructOption = { id: Date.now().toString(), label: "" };
        setChattelsSettings(prev => ({
            ...prev,
            list: [...prev.list, newItem]
        }));
    };

    const handleChattelsChange = (index: number, val: string) => {
        const newList = [...chattelsSettings.list];
        newList[index] = { ...newList[index], label: val };
        setChattelsSettings(prev => ({ ...prev, list: newList }));
    };

    const handleChattelsRemove = (index: number) => {
        const newList = [...chattelsSettings.list];
        newList.splice(index, 1);
        setChattelsSettings(prev => ({ ...prev, list: newList }));
    };

    const handleSaveChattels = async () => {
        if (!user) return;
        try {
            await saveChattelsSettings(user.uid, chattelsSettings);
            showAlert("Chattels settings saved!");
        } catch (e) {
            console.error(e);
            showAlert("Error saving chattels settings");
        }
    };

    if (loading && !user) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    return (
        <>
            {AlertComponent}
            <div className={styles.container}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Construct/Chattels</h1>
                        <p className={styles.description}>Select options to build the construction and chattels description for the valuation report.</p>
                    </div>
                </div>

                <div className={styles.cardList}>
                    <div className={styles.card}>
                        <div className={styles.cardHeaderRow}>
                            <div className={styles.cardTitle}>Construct Card</div>
                            <div className={styles.headerInputGroup}>
                                <label className={styles.headerLabel}>Placeholder:</label>
                                <input
                                    className={styles.coloredInput}
                                    value={constructSettings.replaceholder || ""}
                                    onChange={(e) => setConstructSettings({ ...constructSettings, replaceholder: e.target.value })}
                                    placeholder="Alternative placeholder..."
                                />
                            </div>
                        </div>

                        <div className={styles.cardContent}>
                            {/* Construct Element */}
                            <div className={styles.column}>
                                <div className={styles.columnHeader}>Construct Element</div>
                                <div className={styles.inputList}>
                                    {constructSettings.elements.map((item, idx) => (
                                        <div key={item.id} className={styles.inputRow}>
                                            <input
                                                className={styles.input}
                                                value={item.label}
                                                onChange={(e) => handleConstructChange('elements', idx, e.target.value)}
                                                placeholder="Item name..."
                                            />
                                            <button className={styles.deleteBtn} onClick={() => handleConstructRemove('elements', idx)}>
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    ))}
                                    <button className={styles.addBtn} onClick={() => handleConstructAdd('elements')}>
                                        <PlusIcon /> Add Item
                                    </button>
                                </div>
                            </div>

                            {/* Interior Element */}
                            <div className={styles.column}>
                                <div className={styles.columnHeader}>Interior Element</div>
                                <div className={styles.inputList}>
                                    {constructSettings.interiorElements.map((item, idx) => (
                                        <div key={item.id} className={styles.inputRow}>
                                            <input
                                                className={styles.input}
                                                value={item.label}
                                                onChange={(e) => handleConstructChange('interiorElements', idx, e.target.value)}
                                                placeholder="Item name..."
                                            />
                                            <button className={styles.deleteBtn} onClick={() => handleConstructRemove('interiorElements', idx)}>
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    ))}
                                    <button className={styles.addBtn} onClick={() => handleConstructAdd('interiorElements')}>
                                        <PlusIcon /> Add Item
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={styles.preTextRow}>
                            <label className={styles.preTextLabel}>Pre-text</label>
                            <input
                                className={styles.input}
                                value={constructSettings.placeholder}
                                onChange={(e) => setConstructSettings({ ...constructSettings, placeholder: e.target.value })}
                                placeholder="Construct pre-text..."
                            />
                        </div>

                        <div className={styles.cardFooter}>
                            <button className={styles.saveBtn} onClick={handleSaveConstruct}>Save Card</button>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeaderRow}>
                            <div className={styles.cardTitle}>Chattels Card</div>
                            <div className={styles.headerInputGroup}>
                                <label className={styles.headerLabel}>Placeholder:</label>
                                <input
                                    className={styles.coloredInput}
                                    value={chattelsSettings.replaceholder || ""}
                                    onChange={(e) => setChattelsSettings({ ...chattelsSettings, replaceholder: e.target.value })}
                                    placeholder="Alternative placeholder..."
                                />
                            </div>
                        </div>

                        <div className={styles.cardContent}>
                            {/* Chattels List */}
                            <div className={styles.column} style={{ flex: '0 0 40%' }}>
                                <div className={styles.columnHeader}>Chattels List</div>
                                <div className={styles.inputList}>
                                    {chattelsSettings.list.map((item, idx) => (
                                        <div key={item.id} className={styles.inputRow}>
                                            <input
                                                className={styles.input}
                                                value={item.label}
                                                onChange={(e) => handleChattelsChange(idx, e.target.value)}
                                                placeholder="Chattel name..."
                                            />
                                            <button className={styles.deleteBtn} onClick={() => handleChattelsRemove(idx)}>
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    ))}
                                    <button className={styles.addBtn} onClick={handleChattelsAdd}>
                                        <PlusIcon /> Add Item
                                    </button>
                                </div>
                            </div>

                            {/* Chattels Description */}
                            <div className={styles.column}>
                                <div className={styles.preTextRow}>
                                    <label className={styles.preTextLabel}>Pre-text</label>
                                    <input
                                        className={styles.input}
                                        value={chattelsSettings.placeholder}
                                        onChange={(e) => setChattelsSettings({ ...chattelsSettings, placeholder: e.target.value })}
                                        placeholder="Chattels pre-text..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles.cardFooter}>
                            <button className={styles.saveBtn} onClick={handleSaveChattels}>Save Card</button>
                        </div>
                    </div>
                </div>
            </div>

        </>
    );
}
