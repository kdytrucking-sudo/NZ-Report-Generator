import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface AIPrompt {
    id: string;
    uid: string; // Added uid field
    name: string;
    modelName: string;
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
    systemPrompt: string;
    userPrompt: string;
    extractionHints: string;
    outputJSONStructure: string;
    createdAt?: any;
    updatedAt?: any;
}

export const initializePDFExtractPrompt = async (uid: string) => {
    if (!uid) return;
    const promptId = "pdf_extract"; // Fixed ID for easy access
    // Path: users/{uid}/ai_prompts/{promptId}
    const promptRef = doc(db, "users", uid, "ai_prompts", promptId);
    const promptSnap = await getDoc(promptRef);

    if (!promptSnap.exists()) {
        const newPrompt: AIPrompt = {
            id: promptId,
            uid: uid,
            name: "PDF Extract",
            modelName: "gemini-1.5-flash",
            temperature: 0.2, // Low temp for extraction accuracy
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 8192,
            systemPrompt: "You are an expert data extraction assistant. Your job is to extract structured data from the provided PDF content.",
            userPrompt: "Extract the following fields from the text: ...",
            extractionHints: "Look for tables and bolded headers.",
            outputJSONStructure: "{\n  \"field1\": \"string\",\n  \"field2\": \"number\"\n}",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await setDoc(promptRef, newPrompt);
        console.log(`Created initial PDF Extract prompt record for user ${uid}.`);
    } else {
        console.log(`PDF Extract prompt record already exists for user ${uid}.`);
    }
};

export const getPrompt = async (uid: string, promptId: string): Promise<AIPrompt | null> => {
    if (!uid) return null;
    const promptRef = doc(db, "users", uid, "ai_prompts", promptId);
    const promptSnap = await getDoc(promptRef);

    if (promptSnap.exists()) {
        return promptSnap.data() as AIPrompt;
    }
    return null;
};

export const getPDFExtractPrompt = async (uid: string): Promise<AIPrompt | null> => {
    return getPrompt(uid, "pdf_extract");
};

export const updatePrompt = async (uid: string, promptId: string, data: Partial<AIPrompt>) => {
    if (!uid) return;
    const promptRef = doc(db, "users", uid, "ai_prompts", promptId);
    const promptSnap = await getDoc(promptRef);

    if (promptSnap.exists()) {
        // Update existing document
        await setDoc(promptRef, { ...data, uid: uid, updatedAt: new Date() }, { merge: true });
        console.log(`Updated prompt ${promptId} for user ${uid}`);
    } else {
        // Create new document
        await setDoc(promptRef, {
            ...data,
            id: promptId,
            uid: uid,
            createdAt: new Date(),
            updatedAt: new Date()
        } as AIPrompt);  // Cast to ensure type safety if strictly typed, or rely on partial
        console.log(`Created new prompt ${promptId} for user ${uid}`);
    }
};
