import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const titleFile = formData.get("titleFile") as File;
        const briefFile = formData.get("briefFile") as File;
        const titleUrl = formData.get("titleUrl") as string;
        const briefUrl = formData.get("briefUrl") as string;

        const systemPrompt = formData.get("systemPrompt") as string;
        const userPrompt = formData.get("userPrompt") as string;
        const extractionHints = formData.get("extractionHints") as string;
        const outputJSONStructure = formData.get("outputJSONStructure") as string;
        const modelName = formData.get("modelName") as string || "gemini-1.5-flash";
        const temperature = parseFloat(formData.get("temperature") as string || "0.2");
        const topP = parseFloat(formData.get("topP") as string || "0.95");
        const topK = parseInt(formData.get("topK") as string || "64");
        const maxOutputTokens = parseInt(formData.get("maxOutputTokens") as string || "8192");

        if ((!titleFile && !titleUrl) || (!briefFile && !briefUrl)) {
            return NextResponse.json({ error: "Missing files or URLs" }, { status: 400 });
        }

        // Initialize Gemini
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Server Configuration Error: GEMINI_API_KEY is missing." }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: temperature,
                topP: topP,
                topK: topK,
                maxOutputTokens: maxOutputTokens,
                responseMimeType: "application/json",
            }
        });

        // Helper to fetch/process file
        const getFileBase64 = async (file: File | null, url: string | null): Promise<{ base64: string, mime: string }> => {
            if (file) {
                const ab = await file.arrayBuffer();
                return {
                    base64: Buffer.from(ab).toString("base64"),
                    mime: file.type || "application/pdf"
                };
            } else if (url) {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Failed to fetch URL: ${url}`);
                const ab = await res.arrayBuffer();
                return {
                    base64: Buffer.from(ab).toString("base64"),
                    mime: res.headers.get("content-type") || "application/pdf"
                };
            }
            throw new Error("No file or URL provided");
        };

        const { base64: titleBase64, mime: titleMime } = await getFileBase64(titleFile, titleUrl);
        const { base64: briefBase64, mime: briefMime } = await getFileBase64(briefFile, briefUrl);

        // Construct parts
        const promptParts = [
            {
                text: `
You are a data extraction engine. Strict Adherence to the JSON structure is required.

SYSTEM INSTRUCTIONS:
${systemPrompt}

EXTRACTION HINTS:
${extractionHints}

YOUR TASK:
${userPrompt}

REQUIRED JSON OUTPUT STRUCTURE:
You must output a single valid JSON object exactly matching this structure. Do not add markdown formatting, do not wrap in code blocks, just return the raw JSON string.
${outputJSONStructure}
` },
            {
                inlineData: {
                    data: titleBase64,
                    mimeType: titleMime
                }
            },
            {
                inlineData: {
                    data: briefBase64,
                    mimeType: briefMime
                }
            }
        ];

        // Generate Content
        // We use generateContent for now.
        const result = await model.generateContent(promptParts);
        const response = await result.response;
        const text = response.text();

        // Try to parse JSON from the text
        // Clean up markdown code blocks if present
        let cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        let jsonData;

        try {
            jsonData = JSON.parse(cleanedText);
        } catch (e) {
            // If valid JSON wasn't returned explicitly, perform a best-effort text return
            // or wrap it in a structure.
            jsonData = { raw_output: text, parse_error: "Could not parse JSON" };
        }

        return NextResponse.json({ data: jsonData });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

