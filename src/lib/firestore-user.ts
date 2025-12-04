import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { User } from "firebase/auth";

export interface UserData {
    uid: string;
    email: string | null;
    name: string | null;
    photoURL: string | null;
    valuerId: string;
    totalReports: number;
    inProgressReports: number;
    completedReports: number;
    lastLogin: any;
    createdAt?: any;
}

export const syncUserToFirestore = async (user: User) => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        // User exists, update last login
        await updateDoc(userRef, {
            lastLogin: serverTimestamp(),
            // Update basic info in case it changed in Auth
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL
        });
        console.log("User data updated in 'nzreport' database for:", user.uid);
        return userSnap.data() as UserData;
    } else {
        // New user, create document
        // Generate a random Valuer ID (e.g., VNZ-XXXXX)
        const valuerId = `VNZ-${Math.floor(10000 + Math.random() * 90000)}`;

        const newUserData: UserData = {
            uid: user.uid,
            email: user.email,
            name: user.displayName || "Valuer",
            photoURL: user.photoURL,
            valuerId: valuerId,
            totalReports: 0,
            inProgressReports: 0,
            completedReports: 0,
            lastLogin: serverTimestamp(),
            createdAt: serverTimestamp(),
        };

        await setDoc(userRef, newUserData);
        console.log("User data created in 'nzreport' database:", newUserData);
        return newUserData;
    }
};

export const getUserData = async (uid: string): Promise<UserData | null> => {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        return userSnap.data() as UserData;
    }
    return null;
};
