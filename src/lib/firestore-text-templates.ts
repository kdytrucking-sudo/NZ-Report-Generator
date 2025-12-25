import { db } from "./firebase";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";

export interface TextTemplateOption {
    id: string; // Unique ID for the option
    label: string;
    value: string; // Multi-line text content
}

export interface TextTemplateCard {
    id: string; // Document ID (sanitized name)
    uid: string;
    name: string; // Display name
    placeholder: string;
    options: TextTemplateOption[];
    createdAt?: any;
    updatedAt?: any;
}

const COLLECTION_NAME = "text_templates";

// Helper to sanitize card name for Doc ID
const sanitizeId = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
};

// Fetch all cards for a user
export const getTextTemplateCards = async (uid: string): Promise<TextTemplateCard[]> => {
    if (!uid) return [];
    try {
        const colRef = collection(db, "users", uid, COLLECTION_NAME);
        const snapshot = await getDocs(colRef);
        const cards = snapshot.docs.map(doc => doc.data() as TextTemplateCard);

        // Sort by createdAt to maintain creation order
        return cards.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
            return timeA - timeB;
        });
    } catch (error) {
        console.error("Error fetching text template cards:", error);
        return [];
    }
};

// Create or Update a card
export const saveTextTemplateCard = async (uid: string, card: Partial<TextTemplateCard> & { name: string }) => {
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
export const deleteTextTemplateCard = async (uid: string, cardId: string) => {
    if (!uid || !cardId) return;
    const ref = doc(db, "users", uid, COLLECTION_NAME, cardId);
    await deleteDoc(ref);
};
