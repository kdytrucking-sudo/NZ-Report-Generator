import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface StaticInformation {
    id: string;
    uid: string;
    // Values
    nzEconomyOverview: string;
    globalEconomyOverview: string;
    residentialMarket: string;
    recentMarketDirection: string;
    marketVolatility: string;
    localEconomyImpact: string;
    // Placeholders
    nzEconomyOverview_ph?: string;
    globalEconomyOverview_ph?: string;
    residentialMarket_ph?: string;
    recentMarketDirection_ph?: string;
    marketVolatility_ph?: string;
    localEconomyImpact_ph?: string;

    updatedAt?: any;
    createdAt?: any;
}

export const getStaticInfo = async (uid: string): Promise<StaticInformation | null> => {
    if (!uid) return null;
    const ref = doc(db, "users", uid, "static_information", "default");
    const snap = await getDoc(ref);

    if (snap.exists()) {
        return snap.data() as StaticInformation;
    }
    return null;
};

export const updateStaticInfo = async (uid: string, data: Partial<StaticInformation>) => {
    if (!uid) return;
    const ref = doc(db, "users", uid, "static_information", "default");
    const snap = await getDoc(ref);

    if (snap.exists()) {
        await setDoc(ref, { ...data, uid, updatedAt: new Date() }, { merge: true });
    } else {
        await setDoc(ref, {
            id: "default",
            uid,
            nzEconomyOverview: "",
            globalEconomyOverview: "",
            residentialMarket: "",
            recentMarketDirection: "",
            marketVolatility: "",
            localEconomyImpact: "",

            nzEconomyOverview_ph: "[Replace_NZEconomic]",
            globalEconomyOverview_ph: "[Replace_GlobalEconomic]",
            residentialMarket_ph: "[Replace_ResidentialMarket]",
            recentMarketDirection_ph: "[Replace_RecentMarketDirection]",
            marketVolatility_ph: "[Replace_MarketVolatility]",
            localEconomyImpact_ph: "[Replace_LocalEconomyImpact]",

            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
};
