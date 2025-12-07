"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import MobileDashboard from "../dashboard/mobile-dashboard";
import { UserData, getUserData } from "@/lib/firestore-user";

export default function MobileInspectionPage() {
    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const data = await getUserData(currentUser.uid);
                setUserData(data);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return <div className="p-8 text-center">Loading inspection tool...</div>;
    }

    // Render the mobile dashboard in a centered container to simulate mobile view on desktop
    // Or render full width as requested. User said "same page but use on computer".
    // I will render it within a max-width container to preserve the mobile feel/layout it was designed for, 
    // effectively creating a "mobile simulator" or "focused mode".

    return (
        <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#f3f4f6', minHeight: 'calc(100vh - 64px)' }}>
            <div style={{ width: '100%', maxWidth: '480px', backgroundColor: 'white', borderRight: '1px solid #e5e7eb', borderLeft: '1px solid #e5e7eb', minHeight: '100%' }}>
                <MobileDashboard user={user} userData={userData} />
            </div>
        </div>
    );
}
