import { db } from "./firebase";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";

export interface SingleChoiceOption {
    id: string; // Unique ID for the option
    label: string;
    value: string;
}

export interface SingleChoiceCard {
    id: string; // Document ID (sanitized name)
    uid: string;
    name: string; // Display name
    placeholder: string;
    options: SingleChoiceOption[];
    createdAt?: any;
    updatedAt?: any;
}

const COLLECTION_NAME = "single_choice_content";

// Helper to sanitize card name for Doc ID (e.g., "Purpose of Valuation" -> "purpose_of_valuation")
const sanitizeId = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
};

// Fetch all cards for a user
export const getSingleChoiceCards = async (uid: string): Promise<SingleChoiceCard[]> => {
    if (!uid) return [];
    try {
        const colRef = collection(db, "users", uid, COLLECTION_NAME);
        const snapshot = await getDocs(colRef);
        return snapshot.docs.map(doc => doc.data() as SingleChoiceCard);
    } catch (error) {
        console.error("Error fetching single choice cards:", error);
        return [];
    }
};

// Create or Update a card
export const saveSingleChoiceCard = async (uid: string, card: Partial<SingleChoiceCard> & { name: string }) => {
    if (!uid) return;

    // If we have an existing ID (editing), use it. Otherwise, create new from name.
    // However, if the user changes the NAME, we might want to keep the old ID or migrate? 
    // Requirement says "use card name as database document ID". 
    // This implies if name changes, doc ID effectively changes (new doc).
    // For simplicity here: We will use a generated ID if not provided, or a sanitized version of name if new.

    let docId = card.id;
    if (!docId) {
        docId = sanitizeId(card.name);
    }

    // Ensure we don't overwrite if the sanitized ID collision occurs for different real names, 
    // but here we strictly follow: Name -> ID.

    const ref = doc(db, "users", uid, COLLECTION_NAME, docId);

    // We construct the full object
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
export const deleteSingleChoiceCard = async (uid: string, cardId: string) => {
    if (!uid || !cardId) return;
    const ref = doc(db, "users", uid, COLLECTION_NAME, cardId);
    await deleteDoc(ref);
};
