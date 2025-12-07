
import { NextRequest, NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, getDocs, collection } from "firebase/firestore";
import { ref, getDownloadURL, uploadBytes } from "firebase/storage";
import JSZip from "jszip";

// Helper to calculate EMUs from pixels
// 1 pixel = 9525 EMUs (approx, at 96 DPI)
const pxToEmu = (px: number) => Math.round(px * 9525);

// Helper to Create Fuzzy Regex for Split Placeholders
// turns "{%Image}" into /\{(:?<[^>]+>)*%(:?<[^>]+>)*I.../g
// Helper to Create Fuzzy Regex for Split Placeholders
// turns "{%Image}" into /\{(:?<[^>]+>)*%(:?<[^>]+>)*I.../g
const createFuzzyRegex = (text: string) => {
    // 1. Split text into characters
    const chars = text.split('');

    // 2. Escape any special regex characters in the parts
    const escapedChars = chars.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    // 3. Join with the XML tag pattern
    // This allows for <w:t> or <w:br/> or any other XML tag to appear between characters
    const pattern = escapedChars.join('(?:<[^>]+>)*');

    return new RegExp(pattern, 'g');
};

// Helper to generate Drawing XML
// This is a simplified version of what Word expects.
const generateDrawingXml = (rId: string, widthEmu: number, heightEmu: number, name: string) => {
    // Note: The closing </w:t></w:r> assumes we are replacing a text run inside a paragraph.
    // We replace it with the closing tags, then the drawing, then reopen the tags <w:r><w:t>
    // to keep the XML structure balanced for subsequent text.
    return `</w:t></w:r><w:r>
        <w:drawing>
            <wp:inline distT="0" distB="0" distL="0" distR="0">
                <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
                <wp:effectExtent l="0" t="0" r="0" b="0"/>
                <wp:docPr id="${Math.floor(Math.random() * 100000) + 1}" name="${name}"/>
                <wp:cNvGraphicFramePr>
                    <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
                </wp:cNvGraphicFramePr>
                <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                        <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                            <pic:nvPicPr>
                                <pic:cNvPr id="${Math.floor(Math.random() * 100000) + 1}" name="${name}"/>
                                <pic:cNvPicPr/>
                            </pic:nvPicPr>
                            <pic:blipFill>
                                <a:blip r:embed="${rId}"/>
                                <a:stretch>
                                    <a:fillRect/>
                                </a:stretch>
                            </pic:blipFill>
                            <pic:spPr>
                                <a:xfrm>
                                    <a:off x="0" y="0"/>
                                    <a:ext cx="${widthEmu}" cy="${heightEmu}"/>
                                </a:xfrm>
                                <a:prstGeom prst="rect">
                                    <a:avLst/>
                                </a:prstGeom>
                            </pic:spPr>
                        </pic:pic>
                    </a:graphicData>
                </a:graphic>
            </wp:inline>
        </w:drawing>
    </w:r><w:r><w:t>`;
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { reportId, uid } = body;

        if (!reportId || !uid) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Fetch Report Data
        const reportRef = doc(db, "users", uid, "reports", reportId);
        const reportSnap = await getDoc(reportRef);
        if (!reportSnap.exists()) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }
        const reportData = reportSnap.data();

        // 2. Load Generated Document (The Draft)
        // Ensure generatedReport exists
        if (!reportData.generatedReport?.url) {
            return NextResponse.json({ error: "Draft report not found" }, { status: 400 });
        }

        // Fetch the draft DOCX
        const docRes = await fetch(reportData.generatedReport.url);
        if (!docRes.ok) throw new Error("Failed to download draft report");
        const docBuffer = await docRes.arrayBuffer();

        // 3. Load Images to insert
        const reportImages = reportData.images || {};
        if (Object.keys(reportImages).length === 0) {
            return NextResponse.json({ error: "No images uploaded" }, { status: 400 });
        }

        // Fetch Image Configs (for dimensions)
        // We fetch all configs to have dimensions available.
        const configSnapshot = await getDocs(collection(db, "users", uid, "image_configs"));
        const configMap: Record<string, any> = {};
        configSnapshot.forEach(doc => {
            configMap[doc.data().name] = doc.data();
        });

        // 4. Initialize Zip
        const zip = new JSZip();
        await zip.loadAsync(docBuffer);

        const docXmlPath = "word/document.xml";
        const relsXmlPath = "word/_rels/document.xml.rels";

        let docXml = await zip.file(docXmlPath)?.async("string") || "";
        let relsXml = await zip.file(relsXmlPath)?.async("string") || "";

        // Determine next RId (Relationship ID)
        let maxRId = 0;
        const rIdRegex = /Id="rId(\d+)"/g;
        let match;
        while ((match = rIdRegex.exec(relsXml)) !== null) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxRId) maxRId = num;
        }
        let currentRId = maxRId + 1;

        // 5. Process Images
        const imageKeys = Object.keys(reportImages);
        let replacedCount = 0;

        for (const key of imageKeys) {
            const imgData = reportImages[key]; // { url, path, name }
            const config = configMap[key] || { placeholder: `{%Image_${key}}`, width: 200, height: 150 };
            const placeholder = config.placeholder || `{%Image_${key}}`;

            // Use Fuzzy Regex to find placeholder even if split by XML tags
            const fuzzyRegex = createFuzzyRegex(placeholder);

            if (fuzzyRegex.test(docXml)) {
                // Download Image File
                const imgRes = await fetch(imgData.url);
                if (!imgRes.ok) {
                    console.warn(`Failed to fetch image: ${imgData.url}`);
                    continue;
                }
                const imgBuffer = await imgRes.arrayBuffer();

                // Add Image to Zip
                // Using a safe filename
                const safeKey = key.replace(/[^a-zA-Z0-9]/g, '');
                const imgFileName = `image_${Date.now()}_${safeKey}.png`;
                zip.file(`word/media/${imgFileName}`, imgBuffer);

                // Add Relation to _rels/document.xml.rels
                const rId = `rId${currentRId++}`;
                // Insert relationship for image
                // Ensure we place it before the closing </Relationships>
                const newRel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imgFileName}"/>`;
                if (relsXml.includes("</Relationships>")) {
                    relsXml = relsXml.replace("</Relationships>", `${newRel}</Relationships>`);
                } else {
                    // Fallback if structure is unexpected (shouldn't happen in valid docx)
                    console.warn("Could not find </Relationships> tag in rels xml");
                }

                // Generate Drawing XML
                const width = pxToEmu(Number(config.width) || 300);
                const height = pxToEmu(Number(config.height) || 200);
                const drawingXml = generateDrawingXml(rId, width, height, key);

                // Replace Placeholder (Fuzzy) in docXml
                // Reset regex to ensure we match again correctly or use 'replace' which works on the string
                // Note: String.replace(regex, string) only replaces the FIRST match unless regex has 'g' flag.
                // Our createFuzzyRegex has 'g' flag.
                docXml = docXml.replace(fuzzyRegex, drawingXml);
                replacedCount++;
            } else {
                console.warn(`Placeholder not found in doc for key: ${key}, expected: ${placeholder}`);
            }
        }

        if (replacedCount === 0) {
            console.warn("No placeholders were matched and replaced.");
        }

        // 6. Update XML files in Zip
        zip.file(docXmlPath, docXml);
        zip.file(relsXmlPath, relsXml);

        // Update [Content_Types].xml to ensure png/jpeg is there
        let contentTypesXml = await zip.file("[Content_Types].xml")?.async("string") || "";
        if (!contentTypesXml.includes('Extension="png"')) {
            // Add Default PNG extension if missing
            contentTypesXml = contentTypesXml.replace("</Types>", '<Default Extension="png" ContentType="image/png"/></Types>');
            zip.file("[Content_Types].xml", contentTypesXml);
        }

        // 7. Generate Final File
        const finalBuffer = await zip.generateAsync({ type: "arraybuffer" });

        // 8. Upload Final File
        const address = reportData.metadata?.fields?.['address']?.value || "Untitled";
        const cleanAddress = address.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        const finalFilename = `Report_${cleanAddress}_Final.docx`;
        const finalStoragePath = `nzreport/${uid}/reports/${reportId}/${finalFilename}`;

        const finalStorageRef = ref(storage, finalStoragePath);
        const uploadResult = await uploadBytes(finalStorageRef, new Uint8Array(finalBuffer), {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        });
        const downloadUrl = await getDownloadURL(uploadResult.ref);

        // 9. Update Report in Firestore
        await updateDoc(reportRef, {
            "finalReport": {
                name: finalFilename,
                url: downloadUrl,
                createdAt: new Date().toISOString(),
                storagePath: finalStoragePath
            },
            "status": "completed"
        });

        return NextResponse.json({
            success: true,
            downloadUrl,
            replacedCount
        });

    } catch (error: any) {
        console.error("Replace Images Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
