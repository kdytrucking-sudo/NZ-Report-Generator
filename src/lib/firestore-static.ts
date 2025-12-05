import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface StaticInformation {
    id: string; // "default" usually
    uid: string;
    nzEconomyOverview: string;
    globalEconomyOverview: string;
    residentialMarket: string;
    recentMarketDirection: string;
    marketVolatility: string;
    localEconomyImpact: string;
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
        // Create new with defaults if fields are missing in 'data', though usually data has current state
        await setDoc(ref, {
            id: "default",
            uid,
            nzEconomyOverview: "",
            globalEconomyOverview: "",
            residentialMarket: "",
            recentMarketDirection: "",
            marketVolatility: "",
            localEconomyImpact: "",
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
};
