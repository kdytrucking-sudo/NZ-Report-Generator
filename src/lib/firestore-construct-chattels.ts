import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface ConstructOption {
    id: string;
    label: string;
}

export interface ConstructSettings {
    elements: ConstructOption[];
    interiorElements: ConstructOption[];
    placeholder: string;
    replaceholder: string;
}

export interface ChattelsSettings {
    list: ConstructOption[];
    placeholder: string;
    replaceholder: string;
}

const COLLECTION_NAME = "construct_chattels";

export const getConstructSettings = async (uid: string): Promise<ConstructSettings> => {
    if (!uid) return { elements: [], interiorElements: [], placeholder: "", replaceholder: "" };
    const ref = doc(db, "users", uid, COLLECTION_NAME, "construct");
    const snap = await getDoc(ref);
    if (snap.exists()) {
        return snap.data() as ConstructSettings;
    }
    // Return default empty structure
    return {
        elements: [],
        interiorElements: [],
        placeholder: "The dwelling is constructed with...",
        replaceholder: ""
    };
};

export const saveConstructSettings = async (uid: string, data: ConstructSettings) => {
    if (!uid) return;
    const ref = doc(db, "users", uid, COLLECTION_NAME, "construct");
    await setDoc(ref, data, { merge: true });
};

export const getChattelsSettings = async (uid: string): Promise<ChattelsSettings> => {
    if (!uid) return { list: [], placeholder: "", replaceholder: "" };
    const ref = doc(db, "users", uid, COLLECTION_NAME, "chattels");
    const snap = await getDoc(ref);
    if (snap.exists()) {
        return snap.data() as ChattelsSettings;
    }
    return {
        list: [],
        placeholder: "Chattels included in the valuation are...",
        replaceholder: ""
    };
};

export const saveChattelsSettings = async (uid: string, data: ChattelsSettings) => {
    if (!uid) return;
    const ref = doc(db, "users", uid, COLLECTION_NAME, "chattels");
    await setDoc(ref, data, { merge: true });
};
