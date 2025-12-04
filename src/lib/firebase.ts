import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCuJVhq7LrQoA2HSd5dRCaG2_tcjj4pYOQ",
    authDomain: "nz-property-ace.firebaseapp.com",
    projectId: "nz-property-ace",
    storageBucket: "nz-property-ace.firebasestorage.app",
    messagingSenderId: "16777675469",
    appId: "1:16777675469:web:7d2ce36f5c4d85f2e05f84"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app, "nzreport");

const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, storage, googleProvider };
