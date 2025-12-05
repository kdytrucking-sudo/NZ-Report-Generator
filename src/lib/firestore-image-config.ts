import { db } from "./firebase";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";

export interface ImageConfigCard {
    id: string; // Document ID
    uid: string;
    name: string;
    placeholder: string;
    width: number;
    height: number;
    createdAt?: any;
    updatedAt?: any;
}

const COLLECTION_NAME = "image_configs";

// Helper to sanitize card name for Doc ID
const sanitizeId = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
};

// Fetch all
export const getImageConfigs = async (uid: string): Promise<ImageConfigCard[]> => {
    if (!uid) return [];
    try {
        const colRef = collection(db, "users", uid, COLLECTION_NAME);
        const snapshot = await getDocs(colRef);
        return snapshot.docs.map(doc => doc.data() as ImageConfigCard);
    } catch (error) {
        console.error("Error fetching image configs:", error);
        return [];
    }
};

// Save
export const saveImageConfig = async (uid: string, config: Partial<ImageConfigCard> & { name: string }) => {
    if (!uid) return;

    let docId = config.id;
    if (!docId) {
        docId = sanitizeId(config.name);
    }

    const ref = doc(db, "users", uid, COLLECTION_NAME, docId);

    const dataToSave = {
        id: docId,
        uid,
        name: config.name,
        placeholder: config.placeholder || "",
        width: Number(config.width) || 0,
        height: Number(config.height) || 0,
        createdAt: config.createdAt || new Date(),
        updatedAt: new Date()
    };

    await setDoc(ref, dataToSave, { merge: true });
    return docId;
};

// Delete
export const deleteImageConfig = async (uid: string, configId: string) => {
    if (!uid || !configId) return;
    const ref = doc(db, "users", uid, COLLECTION_NAME, configId);
    await deleteDoc(ref);
};
