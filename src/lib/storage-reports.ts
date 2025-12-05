import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const uploadReportFile = async (uid: string, reportId: string, file: File, type: "brief" | "title") => {
    const path = `nzreport/${uid}/reports/${reportId}/${type}_${file.name}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
        name: file.name,
        path: path,
        url: downloadUrl,
        type: type,
        uploadedAt: Date.now()
    };
};
