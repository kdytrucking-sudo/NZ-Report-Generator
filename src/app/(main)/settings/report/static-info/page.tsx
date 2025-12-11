"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getStaticInfo, updateStaticInfo, StaticInformation } from "@/lib/firestore-static";
import styles from "./page.module.css";
import { useCustomAlert } from "@/components/CustomAlert";

export default function StaticInformationPage() {
    const { showAlert, AlertComponent } = useCustomAlert();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState<Partial<StaticInformation>>({
        nzEconomyOverview: "",
        globalEconomyOverview: "",
        residentialMarket: "",
        recentMarketDirection: "",
        marketVolatility: "",
        localEconomyImpact: ""
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const data = await getStaticInfo(currentUser.uid);
                    if (data) {
                        setFormData({
                            nzEconomyOverview: data.nzEconomyOverview || "",
                            globalEconomyOverview: data.globalEconomyOverview || "",
                            residentialMarket: data.residentialMarket || "",
                            recentMarketDirection: data.recentMarketDirection || "",
                            marketVolatility: data.marketVolatility || "",
                            localEconomyImpact: data.localEconomyImpact || ""
                        });
                    }
                } catch (error) {
                    console.error("Error loading static info:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleChange = (field: keyof StaticInformation, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await updateStaticInfo(user.uid, formData);
            showAlert("Static information saved successfully!");
        } catch (error) {
            console.error("Error saving static info:", error);
            showAlert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    return (
        <>
        {AlertComponent}
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Static Information Settings</h1>
                    <p className={styles.description}>
                        Manage standard text blocks used across your valuation reports.
                    </p>
                </div>
                <div className={styles.headerRight}>
                    <button
                        className="btn btn-outline"
                        onClick={() => router.back()}
                    >
                        Cancel
                    </button>
                    <button
                        className={`btn ${styles.saveBtn}`}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>

            <div className={styles.formGrid}>

                <div className={styles.card}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            New Zealand Economy Overview
                        </label>
                        <div className="flex gap-2 mb-1">
                            <span className="text-xs text-gray-500 self-center">Placeholder:</span>
                            <input
                                type="text"
                                className="border rounded px-2 py-1 text-sm font-mono text-blue-600 w-64"
                                value={formData.nzEconomyOverview_ph || ""}
                                onChange={(e) => handleChange("nzEconomyOverview_ph", e.target.value)}
                            />
                        </div>
                        <textarea
                            className={styles.textarea}
                            value={formData.nzEconomyOverview}
                            onChange={(e) => handleChange("nzEconomyOverview", e.target.value)}
                            placeholder="Enter the general overview of the NZ economy..."
                        />
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Global Economic Overview
                        </label>
                        <div className="flex gap-2 mb-1">
                            <span className="text-xs text-gray-500 self-center">Placeholder:</span>
                            <input
                                type="text"
                                className="border rounded px-2 py-1 text-sm font-mono text-blue-600 w-64"
                                value={formData.globalEconomyOverview_ph || ""}
                                onChange={(e) => handleChange("globalEconomyOverview_ph", e.target.value)}
                            />
                        </div>
                        <textarea
                            className={styles.textarea}
                            value={formData.globalEconomyOverview}
                            onChange={(e) => handleChange("globalEconomyOverview", e.target.value)}
                            placeholder="Enter the global economic context..."
                        />
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Residential Market
                        </label>
                        <div className="flex gap-2 mb-1">
                            <span className="text-xs text-gray-500 self-center">Placeholder:</span>
                            <input
                                type="text"
                                className="border rounded px-2 py-1 text-sm font-mono text-blue-600 w-64"
                                value={formData.residentialMarket_ph || ""}
                                onChange={(e) => handleChange("residentialMarket_ph", e.target.value)}
                            />
                        </div>
                        <textarea
                            className={styles.textarea}
                            value={formData.residentialMarket}
                            onChange={(e) => handleChange("residentialMarket", e.target.value)}
                            placeholder="Describe current residential market conditions..."
                        />
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Recent Market Direction
                        </label>
                        <div className="flex gap-2 mb-1">
                            <span className="text-xs text-gray-500 self-center">Placeholder:</span>
                            <input
                                type="text"
                                className="border rounded px-2 py-1 text-sm font-mono text-blue-600 w-64"
                                value={formData.recentMarketDirection_ph || ""}
                                onChange={(e) => handleChange("recentMarketDirection_ph", e.target.value)}
                            />
                        </div>
                        <textarea
                            className={styles.textarea}
                            value={formData.recentMarketDirection}
                            onChange={(e) => handleChange("recentMarketDirection", e.target.value)}
                            placeholder="Trends observed in the last few months..."
                        />
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Market Volatility
                        </label>
                        <div className="flex gap-2 mb-1">
                            <span className="text-xs text-gray-500 self-center">Placeholder:</span>
                            <input
                                type="text"
                                className="border rounded px-2 py-1 text-sm font-mono text-blue-600 w-64"
                                value={formData.marketVolatility_ph || ""}
                                onChange={(e) => handleChange("marketVolatility_ph", e.target.value)}
                            />
                        </div>
                        <textarea
                            className={styles.textarea}
                            value={formData.marketVolatility}
                            onChange={(e) => handleChange("marketVolatility", e.target.value)}
                            placeholder="Comments on market stability and volatility..."
                        />
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Local Economy Impact
                        </label>
                        <div className="flex gap-2 mb-1">
                            <span className="text-xs text-gray-500 self-center">Placeholder:</span>
                            <input
                                type="text"
                                className="border rounded px-2 py-1 text-sm font-mono text-blue-600 w-64"
                                value={formData.localEconomyImpact_ph || ""}
                                onChange={(e) => handleChange("localEconomyImpact_ph", e.target.value)}
                            />
                        </div>
                        <textarea
                            className={styles.textarea}
                            value={formData.localEconomyImpact}
                            onChange={(e) => handleChange("localEconomyImpact", e.target.value)}
                            placeholder="Specific impacts on the local region..."
                        />
                    </div>
                </div>

            </div>
        </div>
    
        </>
    );
}
