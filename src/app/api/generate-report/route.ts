
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

// Helper to ensure date format 7 December 2025
const formatDateValue = (val: string): string => {
    if (!val) return "";
    // If it looks like a date YYYY-MM-DD
    const date = new Date(val);
    if (!isNaN(date.getTime()) && val.includes('-')) {
        return date.toLocaleDateString('en-NZ', {
            day: 'numeric',
            month: 'long',
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

                    // Debug logging for line breaks
                    if (val && typeof val === 'string' && val.length > 0) {
                        console.log(`\n[Debug] Field: ${field.label || field.placeholder}`);
                        console.log(`[Debug] Placeholder: ${field.placeholder}`);
                        console.log(`[Debug] Value length: ${val.length}`);
                        console.log(`[Debug] Has \\r\\n: ${val.includes('\r\n')}`);
                        console.log(`[Debug] Has \\n: ${val.includes('\n')}`);
                        console.log(`[Debug] Has \\r: ${val.includes('\r')}`);
                        console.log(`[Debug] First 100 chars:`, JSON.stringify(val.substring(0, 100)));
                    }

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

        // Debug: List all files in the ZIP
        console.log('\n📦 Files in Word document:');
        zip.forEach((relativePath, file) => {
            if (relativePath.startsWith('word/')) {
                console.log(`  - ${relativePath}`);
            }
        });
        console.log('');

        // Debug: Search for FooterAddress in ALL files
        console.log('🔍 Searching for Replace_FooterAddress in all files...');
        const searchPromises: Promise<void>[] = [];
        zip.forEach((relativePath, file) => {
            if (relativePath.endsWith('.xml')) {
                searchPromises.push(
                    file.async("string").then(content => {
                        if (content.includes('Replace_FooterAddress')) {
                            console.log(`✨ FOUND in ${relativePath}!`);
                            const index = content.indexOf('Replace_FooterAddress');
                            const start = Math.max(0, index - 150);
                            const end = Math.min(content.length, index + 200);
                            console.log('Context:');
                            console.log(content.substring(start, end));
                            console.log('---');
                        }
                    })
                );
            }
        });
        await Promise.all(searchPromises);
        console.log('🔍 Search complete.\n');

        // Helper function to perform replacements on XML content
        const performReplacements = (xmlContent: string, fileName: string): string => {
            let modifiedXml = xmlContent;

            Object.keys(replacements).forEach(key => {
                const value = replacements[key];

                // 1. Escape XML in value
                let safeValue = escapeXml(value);

                // 2. Handle Newlines: Use simple line break
                safeValue = safeValue.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

                // Replace newlines with Word line break tag
                if (safeValue.includes("\n")) {
                    safeValue = safeValue.replace(/\n/g, "<w:br/>");
                }

                // 3. Try multiple replacement strategies

                // Strategy 1: Direct replacement (for placeholders that aren't split)
                const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                let regex = new RegExp(escapedKey, "g");
                let matches = modifiedXml.match(regex);
                let replaced = false;

                if (matches && matches.length > 0) {
                    modifiedXml = modifiedXml.replace(regex, safeValue);
                    replaced = true;
                    console.log(`✅ [${fileName}] Direct replacement: "${key}" ${matches.length} time(s)`);
                } else {
                    // Strategy 2: Handle split placeholders
                    // Create a regex that allows XML tags between characters
                    // For example: [Replace_Address] might be split as:
                    // <w:t>[Replace_</w:t><w:t>Address]</w:t>

                    // Build a flexible regex that allows tags between each character
                    const flexiblePattern = key
                        .split('')
                        .map(char => {
                            // Escape special regex characters
                            const escaped = char.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                            // Allow any XML tags between characters
                            return escaped;
                        })
                        .join('(?:<[^>]+>)*'); // Allow zero or more XML tags between each character

                    const flexibleRegex = new RegExp(flexiblePattern, 'g');
                    const flexibleMatches = modifiedXml.match(flexibleRegex);

                    if (flexibleMatches && flexibleMatches.length > 0) {
                        // Replace each match
                        flexibleMatches.forEach(match => {
                            // Extract just the text content from the match (removing XML tags)
                            const textOnly = match.replace(/<[^>]+>/g, '');

                            // Verify this is actually our placeholder
                            if (textOnly === key) {
                                // Replace the entire match (including XML tags) with our value wrapped in proper tags
                                modifiedXml = modifiedXml.replace(match, `<w:t xml:space="preserve">${safeValue}</w:t>`);
                                replaced = true;
                            }
                        });

                        if (replaced) {
                            console.log(`✅ [${fileName}] Flexible replacement: "${key}" ${flexibleMatches.length} time(s)`);
                        }
                    }
                }

                if (!replaced) {
                    // Only warn if not found in document.xml (main file)
                    // Footer/Header files may not contain all placeholders
                    if (fileName === 'document.xml') {
                        console.warn(`⚠️  Placeholder "${key}" not found in ${fileName}`);
                    }
                }
            });

            return modifiedXml;
        };

        // Dynamically discover all footer and header files in the template
        const filesToProcess: string[] = ["word/document.xml"];

        zip.forEach((relativePath, file) => {
            // Add all footer and header XML files
            if (relativePath.match(/^word\/(footer|header)\d+\.xml$/)) {
                filesToProcess.push(relativePath);
            }
        });

        console.log('📝 Files to process for placeholder replacement:');
        filesToProcess.forEach(f => console.log(`  - ${f}`));
        console.log('');

        // Process each file if it exists in the template
        for (const filePath of filesToProcess) {
            const file = zip.file(filePath);
            if (file) {
                const fileName = filePath.split('/').pop() || filePath;
                console.log(`📄 Processing ${fileName}...`);

                let xmlContent = await file.async("string");

                // Special debugging for FooterAddress placeholder
                if (xmlContent.includes('Replace_FooterAddress')) {
                    console.log(`🔍 [${fileName}] Contains FooterAddress placeholder!`);
                    console.log(`🔍 [${fileName}] File size: ${xmlContent.length} characters`);

                    // Find the context around the placeholder
                    const index = xmlContent.indexOf('Replace_FooterAddress');
                    if (index !== -1) {
                        const start = Math.max(0, index - 100);
                        const end = Math.min(xmlContent.length, index + 150);
                        console.log(`🔍 [${fileName}] Context around placeholder:`);
                        console.log(xmlContent.substring(start, end));
                    }
                }

                xmlContent = performReplacements(xmlContent, fileName);
                zip.file(filePath, xmlContent);

                console.log(`✓ Completed processing ${fileName}`);
            }
        }

        // 6. Generate New buffer
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
