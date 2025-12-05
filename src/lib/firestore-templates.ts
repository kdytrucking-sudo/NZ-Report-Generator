import { db, storage } from "./firebase";
import { collection, addDoc, deleteDoc, doc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

export interface ReportTemplate {
    id: string; // Firestore Doc ID
    uid: string;
    name: string; // Display Name (usually filename)
    storagePath: string; // Full path in storage
    downloadUrl: string;
    description?: string;
    size: number;
    mimeType: string;
    createdAt: any; // Timestamp
}

const COLLECTION_NAME = "templates";

/**
 * Uploads a template file to Firebase Storage and records it in Firestore.
 */
export const uploadTemplate = async (uid: string, file: File, description: string = ""): Promise<ReportTemplate | null> => {
    if (!uid || !file) return null;

    try {
        // 1. Upload to Storage
        // Path: nzreport/{uid}/template/{filename}
        const storagePath = `nzreport/${uid}/template/${file.name}`;
        const storageRef = ref(storage, storagePath);

        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        // 2. Save to Firestore
        const templateData = {
            uid,
            name: file.name,
            storagePath,
            downloadUrl,
            description,
            size: file.size,
            mimeType: file.type,
            createdAt: Timestamp.now()
        };

        const colRef = collection(db, "users", uid, COLLECTION_NAME);
        const docRef = await addDoc(colRef, templateData);

        return {
            id: docRef.id,
            ...templateData
        };

    } catch (error) {
        console.error("Error uploading template:", error);
        throw error;
    }
};

/**
 * Fetches all templates for a user, ordered by upload time descending.
 */
export const getTemplates = async (uid: string): Promise<ReportTemplate[]> => {
    if (!uid) return [];
    try {
        const colRef = collection(db, "users", uid, COLLECTION_NAME);
        const q = query(colRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ReportTemplate));
    } catch (error) {
        console.error("Error fetching templates:", error);
        return [];
    }
};

/**
 * Deletes a template from Firestore and Storage.
 */
export const deleteTemplate = async (uid: string, templateId: string, storagePath: string) => {
    if (!uid || !templateId) return;

    try {
        // 1. Delete from Storage
        if (storagePath) {
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef).catch(err => {
                console.warn("File might strictly not exist or already deleted:", err);
            });
        }

        // 2. Delete from Firestore
        const docRef = doc(db, "users", uid, COLLECTION_NAME, templateId);
        await deleteDoc(docRef);

    } catch (error) {
        console.error("Error deleting template:", error);
        throw error;
    }
};
