
import { NextRequest, NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase"; // Using client SDK in API route for simplicity if permitted, else Admin SDK is better but requires service account. 
// Assuming client SDK works for now as we don't have Admin SDK setup in context. 
// Actually client SDK in Node environment (API route) works if we don't rely on Auth state being autopopulated. 
// We will pass UID from client.
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, getDownloadURL, uploadBytes } from "firebase/storage";
import JSZip from "jszip";

// Helper to escape XML characters
const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

// Helper to ensure date format 7 Dec 2025
const formatDateValue = (val: string): string => {
    if (!val) return "";
    // If it looks like a date YYYY-MM-DD
    const date = new Date(val);
    if (!isNaN(date.getTime()) && val.includes('-')) {
        return date.toLocaleDateString('en-NZ', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
    // Else return as is (assuming it's already formatted or just text)
    return val;
};

export async function POST(req: NextRequest) {
    try {
        const { reportId, templateId, uid } = await req.json();

        if (!reportId || !templateId || !uid) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Fetch Report Data
        const reportRef = doc(db, "users", uid, "reports", reportId);
        const reportSnap = await getDoc(reportRef);
        if (!reportSnap.exists()) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }
        const reportData = reportSnap.data();

        // 2. Fetch Template Data
        const templateRef = doc(db, "users", uid, "templates", templateId);
        const templateSnap = await getDoc(templateRef);
        if (!templateSnap.exists()) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }
        const templateData = templateSnap.data();

        // 3. Download Template File
        // We handle this by fetching the public download URL. 
        // Note: In Node, 'fetch' is available in Next.js 13+
        const templateRes = await fetch(templateData.downloadUrl);
        if (!templateRes.ok) throw new Error("Failed to download template file");
        const arrayBuffer = await templateRes.arrayBuffer();

        // 4. Prepare Replacement Map
        // Flatten all fields from metadata, baseInfo, and content
        const replacements: Record<string, string> = {};

        // Helper to add fields to map
        const addFields = (fields: any) => {
            if (!fields) return;
            Object.values(fields).forEach((field: any) => {
                if (field.placeholder) {
                    let val = field.value || "";
                    // Handle Dates (if displayType is date or value looks like date)
                    if (field.displayType === 'date' || (val && typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/))) {
                        val = formatDateValue(val);
                    }
                    replacements[field.placeholder] = String(val);
                }
            });
        };

        addFields(reportData.metadata?.fields);
        addFields(reportData.baseInfo?.fields);

        if (reportData.content) {
            Object.values(reportData.content).forEach((section: any) => {
                addFields(section.fields);
            });
        }

        // 5. Process DOCX with JSZip
        const zip = new JSZip();
        await zip.loadAsync(arrayBuffer);

        // Read document.xml
        const docXmlPath = "word/document.xml";
        if (zip.file(docXmlPath)) {
            let docXml = await zip.file(docXmlPath)!.async("string");

            // Perform Replacements
            // We iterate over keys to replace
            Object.keys(replacements).forEach(key => {
                const value = replacements[key];

                // 1. Escape XML in value
                let safeValue = escapeXml(value);

                // 2. Handle Newlines: Replace \n with Hard Return (Paragraph Break)
                // We close the current Text/Run/Paragraph, start a new Paragraph/Run/Text.
                // This prevents "soft return" justification issues.
                safeValue = safeValue.replace(/\r\n/g, "\n").replace(/\n/g, "</w:t></w:r></w:p><w:p><w:r><w:t>");

                // 3. Regex Replace
                // Escape key for regex (e.g. [ becomes \[)
                const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(escapedKey, "g");

                docXml = docXml.replace(regex, safeValue);
            });

            // Write back to zip
            zip.file(docXmlPath, docXml);
        }

        // 6. Generate New buffer
        const generatedBuffer = await zip.generateAsync({ type: "blob" }); // client SDK expects Blob/File for uploadBytes
        // Wait, 'uploadBytes' in Node env might expect Uint8Array or ArrayBuffer if 'Blob' is not fully polyfilled? 
        // Next.js runtime has Blob. Let's try.
        // Actually generateAsync({type: 'arraybuffer'}) is safer for 'uploadBytes' or just pass Buffer.
        // Let's use arraybuffer.
        const generatedArrayBuffer = await zip.generateAsync({ type: "arraybuffer" });

        // 7. Upload Generated Report
        // Determine Filename
        const address = reportData.metadata?.fields?.['address']?.value || "Untitled";
        const cleanAddress = address.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        const filename = `Report_${cleanAddress}.docx`;
        // Old: const storagePath = `nzreport/${uid}/${reportId}/generated/${filename}`;
        // New: match uploadReportFile structure
        const storagePath = `nzreport/${uid}/reports/${reportId}/${filename}`;

        const storageRef = ref(storage, storagePath);
        const uploadResult = await uploadBytes(storageRef, generatedArrayBuffer as any, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        const downloadUrl = await getDownloadURL(uploadResult.ref);

        // 8. Update Report Status
        await updateDoc(reportRef, {
            "metadata.status": "created", // or "completed" or "Report Created" as requested
            "generatedReport": {
                name: filename,
                url: downloadUrl,
                createdAt: new Date().toISOString(),
                storagePath: storagePath
            }
        });

        return NextResponse.json({
            success: true,
            downloadUrl,
            status: "Report Created"
        });

    } catch (error: any) {
        console.error("Generate API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
