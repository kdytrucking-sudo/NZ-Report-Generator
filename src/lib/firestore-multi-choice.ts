import { db } from "./firebase";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";

export interface MultiChoiceOption {
    id: string; // Unique ID for the option
    label: string;
    value: string;
}

export interface MultiChoiceCard {
    id: string; // Document ID (sanitized name)
    uid: string;
    name: string; // Display name
    placeholder: string;
    options: MultiChoiceOption[];
    createdAt?: any;
    updatedAt?: any;
}

const COLLECTION_NAME = "multi_choice_content";

// Helper to sanitize card name for Doc ID (e.g., "Strengths/Opportunities" -> "strengths_opportunities")
const sanitizeId = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
};

// Fetch all cards for a user
export const getMultiChoiceCards = async (uid: string): Promise<MultiChoiceCard[]> => {
    if (!uid) return [];
    try {
        const colRef = collection(db, "users", uid, COLLECTION_NAME);
        const snapshot = await getDocs(colRef);
        return snapshot.docs.map(doc => doc.data() as MultiChoiceCard);
    } catch (error) {
        console.error("Error fetching multi choice cards:", error);
        return [];
    }
};

// Create or Update a card
export const saveMultiChoiceCard = async (uid: string, card: Partial<MultiChoiceCard> & { name: string }) => {
    if (!uid) return;

    let docId = card.id;
    if (!docId) {
        docId = sanitizeId(card.name);
    }

    const ref = doc(db, "users", uid, COLLECTION_NAME, docId);

    const dataToSave = {
        id: docId,
        uid,
        name: card.name,
        placeholder: card.placeholder || "",
        options: card.options || [],
        createdAt: card.createdAt || new Date(),
        updatedAt: new Date()
    };

    await setDoc(ref, dataToSave, { merge: true });
    return docId;
};

// Delete a card
export const deleteMultiChoiceCard = async (uid: string, cardId: string) => {
    if (!uid || !cardId) return;
    const ref = doc(db, "users", uid, COLLECTION_NAME, cardId);
    await deleteDoc(ref);
};
