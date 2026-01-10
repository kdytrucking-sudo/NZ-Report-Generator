"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Report, getReport, initializeReportFromStructure, syncReportFields, ReportField, updateReport } from "@/lib/firestore-reports";
import { uploadReportFile } from "@/lib/storage-reports";
import { getPDFExtractPrompt } from "@/lib/firestore-ai";
import { getStaticInfo, StaticInformation } from "@/lib/firestore-static";
import { getMultiChoiceCards, MultiChoiceCard } from "@/lib/firestore-multi-choice";
import { getTextTemplateCards, TextTemplateCard } from "@/lib/firestore-text-templates";
import { formatDateForInput, formatDateForStorage } from "@/lib/date-utils";
import {
    getConstructSettings,
    getChattelsSettings,
    ConstructSettings,
    ChattelsSettings
} from "@/lib/firestore-construct-chattels";

import styles from "./page.module.css";
import { useCustomAlert } from "@/components/CustomAlert";

export default function PreprocessPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reportId = searchParams.get("id");
    const { showAlert, AlertComponent } = useCustomAlert();

    const [user, setUser] = useState<any>(null);
    const [report, setReport] = useState<Report | null>(null);

    // Status State
    const [activeTab, setActiveTab] = useState<'ai-extract' | 'static-info' | 'mpi' | 'swot' | 'construct-chattels' | 'market-value' | 'room-option'>('ai-extract');
    const [initDone, setInitDone] = useState(false);

    // File Upload State
    const [briefFile, setBriefFile] = useState<File | null>(null);
    const [titleFile, setTitleFile] = useState<File | null>(null);
    const [uploadingBrief, setUploadingBrief] = useState(false);
    const [uploadingTitle, setUploadingTitle] = useState(false);
    const briefInputRef = useRef<HTMLInputElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    // AI State
    const [extractedData, setExtractedData] = useState<any[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractValues, setExtractValues] = useState<{ [key: number]: string }>({}); // Editable values key by index

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                if (reportId) {
                    await initProcess(currentUser.uid, reportId);
                } else {
                    router.push("/dashboard");
                }
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [reportId, router]);


    const initProcess = async (uid: string, rId: string) => {
        try {
            let rep = await getReport(uid, rId);

            if (rep) {
                if (rep.metadata?.status === 'initializing') {
                    rep = await initializeReportFromStructure(uid, rId);
                }
                setReport(rep);
                setInitDone(true);
            }
        } catch (error) {
            console.error(error);
            showAlert("Initialization failed.");
        }
    };

    const handleFileUpload = async (file: File, type: 'brief' | 'title') => {
        if (!user || !reportId || !report) return;

        const setUploading = type === 'brief' ? setUploadingBrief : setUploadingTitle;
        setUploading(true);

        try {
            // Upload file to storage
            const uploadedFile = await uploadReportFile(user.uid, reportId, file, type);

            // Update local state first using functional update to avoid race conditions
            setReport(prevReport => {
                if (!prevReport) return prevReport;

                const updatedFiles = {
                    ...(prevReport.files || {}),
                    [type]: uploadedFile
                };

                return { ...prevReport, files: updatedFiles };
            });

            // Then update Firestore - use functional approach to get latest state
            setReport(currentReport => {
                if (currentReport) {
                    updateReport(user.uid, reportId, { files: currentReport.files });
                }
                return currentReport;
            });

            if (type === 'brief') {
                setBriefFile(null);
            } else {
                setTitleFile(null);
            }

            showAlert(`${type === 'brief' ? 'Brief' : 'Title'} file uploaded successfully!`);
        } catch (error) {
            console.error(`Error uploading ${type}:`, error);
            showAlert(`Failed to upload ${type} file.`);
        } finally {
            setUploading(false);
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'brief' | 'title') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (type === 'brief') {
                setBriefFile(file);
            } else {
                setTitleFile(file);
            }
            // Auto-upload when file is selected
            handleFileUpload(file, type);
        }
    };

    const handleAIExtract = async () => {
        if (!report || !user) return;
        setIsExtracting(true);
        try {
            const promptSettings = await getPDFExtractPrompt(user.uid);
            if (!promptSettings) {
                showAlert("Please configure AI Prompt settings first in Settings > AI.");
                setIsExtracting(false);
                return;
            }

            const formData = new FormData();
            if (report.files.title?.url) formData.append("titleUrl", report.files.title.url);
            if (report.files.brief?.url) formData.append("briefUrl", report.files.brief.url);

            formData.append("systemPrompt", promptSettings.systemPrompt);
            formData.append("userPrompt", promptSettings.userPrompt);
            formData.append("extractionHints", promptSettings.extractionHints);
            formData.append("outputJSONStructure", promptSettings.outputJSONStructure);
            formData.append("modelName", promptSettings.modelName);
            formData.append("temperature", promptSettings.temperature.toString());
            formData.append("topP", promptSettings.topP.toString());
            formData.append("topK", promptSettings.topK.toString());
            formData.append("maxOutputTokens", promptSettings.maxOutputTokens.toString());

            const res = await fetch("/api/pdf-extract-test", { method: "POST", body: formData });
            const result = await res.json();

            if (result.error) throw new Error(result.error);

            const rawData = result.data;

            // Flatten JSON to find all objects with 'placeholder' and 'value'
            const flatData: any[] = [];
            const traverse = (obj: any) => {
                if (!obj || typeof obj !== 'object') return;

                // If it looks like a Field Item
                if (obj.placeholder && obj.value !== undefined) {
                    flatData.push(obj);
                    return;
                }

                // Otherwise recurse
                for (const key in obj) {
                    traverse(obj[key]);
                }
            };
            traverse(rawData);

            setExtractedData(flatData);

            const initValues: any = {};
            flatData.forEach((item, idx) => {
                initValues[idx] = item.value;
            });
            setExtractValues(initValues);

        } catch (error: any) {
            console.error(error);
            showAlert("AI Error: " + error.message);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleUpdateDatabase = async () => {
        if (!report || !user || !initDone) return;

        const sourceFields: { [key: string]: ReportField } = {};

        extractedData.forEach((item, idx) => {
            sourceFields[`extracted_${idx}`] = {
                id: `extracted_${idx}`,
                label: item.label || "Unknown",
                placeholder: item.placeholder?.trim() || "",
                value: extractValues[idx],
                displayType: 'text',
                type: 'string',
                ifValidation: false
            };
        });

        const updatedReport = syncReportFields(report, sourceFields);

        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, {
                metadata,
                baseInfo,
                content,
                status: 'Preprocess:AI' // Update status
            });
            setReport({ ...updatedReport, status: 'Preprocess:AI' });
            showAlert("Database updated successfully!");
        } catch (e) {
            console.error(e);
            showAlert("Failed to update database.");
        }
    };

    // Static Data State
    const [staticData, setStaticData] = useState<Partial<StaticInformation>>({});
    const [staticLoading, setStaticLoading] = useState(false);

    const handleLoadStatic = async () => {
        if (!user) return;
        setStaticLoading(true);
        try {
            const data = await getStaticInfo(user.uid);
            if (data) {
                setStaticData(data);
            } else {
                showAlert("No static information found. Please configure it in Settings.");
            }
        } catch (error) {
            console.error(error);
            showAlert("Failed to load static info.");
        } finally {
            setStaticLoading(false);
        }
    };

    const handleUpdateStaticToReport = async () => {
        if (!report || !user) return;

        const data = staticData as StaticInformation;

        // Debug: Log the static data
        console.log('[Static Debug] Static Data:', data);
        console.log('[Static Debug] Placeholders:', {
            nzEconomyOverview_ph: data.nzEconomyOverview_ph,
            globalEconomyOverview_ph: data.globalEconomyOverview_ph,
            residentialMarket_ph: data.residentialMarket_ph,
            recentMarketDirection_ph: data.recentMarketDirection_ph,
            marketVolatility_ph: data.marketVolatility_ph,
            localEconomyImpact_ph: data.localEconomyImpact_ph
        });

        const mapping = [
            { key: 'nzEconomyOverview', placeholder: data.nzEconomyOverview_ph || '{%NZ_Economy_Overview}' },
            { key: 'globalEconomyOverview', placeholder: data.globalEconomyOverview_ph || '{%Global_Economy_Overview}' },
            { key: 'residentialMarket', placeholder: data.residentialMarket_ph || '{%Residential_Market}' },
            { key: 'recentMarketDirection', placeholder: data.recentMarketDirection_ph || '{%Recent_Market_Direction}' },
            { key: 'marketVolatility', placeholder: data.marketVolatility_ph || '{%Market_Volatility}' },
            { key: 'localEconomyImpact', placeholder: data.localEconomyImpact_ph || '{%Local_Economy_Impact}' }
        ];

        const sourceFields: { [key: string]: ReportField } = {};

        mapping.forEach((m, idx) => {
            const val = (data as any)[m.key as any];
            if (val) {
                sourceFields[`static_${idx}`] = {
                    id: `static_${idx}`,
                    label: m.key,
                    placeholder: m.placeholder?.trim() || "",
                    value: val,
                    displayType: 'textarea',
                    type: 'string',
                    ifValidation: false
                };
                console.log(`[Static Debug] Added field: ${m.key}, placeholder: ${m.placeholder}, value length: ${val.length}`);
            }
        });

        console.log('[Static Debug] Source Fields:', sourceFields);

        const updatedReport = syncReportFields(report, sourceFields);

        console.log('[Static Debug] Updated Report:', updatedReport);

        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, {
                metadata,
                baseInfo,
                content,
                status: 'Preprocess:StaticInfo' // Update status
            });
            setReport({ ...updatedReport, status: 'Preprocess:StaticInfo' });
            showAlert("Static data updated to report!");
        } catch (e) {
            console.error(e);
            showAlert("Failed to update report with static data.");
        }
    };

    // SWOT (Multi-Choice) Data State
    const [swotCards, setSwotCards] = useState<MultiChoiceCard[]>([]);
    const [swotSelections, setSwotSelections] = useState<{ [cardId: string]: { selectedOptions: string[], textValue: string } }>({});
    const [swotLoading, setSwotLoading] = useState(false);

    // Construct/Chattels State
    const [constructData, setConstructData] = useState<ConstructSettings | null>(null);
    const [chattelsData, setChattelsData] = useState<ChattelsSettings | null>(null);
    const [ccLoading, setCcLoading] = useState(false);

    // Selections (just IDs for now)
    const [selectedConstruct, setSelectedConstruct] = useState<string[]>([]);
    const [selectedInterior, setSelectedInterior] = useState<string[]>([]);
    const [selectedChattels, setSelectedChattels] = useState<string[]>([]);

    // Text Values
    const [constructText, setConstructText] = useState("");
    const [chattelsText, setChattelsText] = useState("");

    // Market Value State
    const [mvInput, setMvInput] = useState("");
    const [mvFormatted, setMvFormatted] = useState("");
    const [mvNarrative, setMvNarrative] = useState("");

    const [bdImprovements, setBdImprovements] = useState("");
    const [bdLand, setBdLand] = useState("");
    const [bdChattels, setBdChattels] = useState("");
    const [bdTotal, setBdTotal] = useState("");
    const [bdMatch, setBdMatch] = useState<'equal' | 'error' | null>(null);

    const [statLand, setStatLand] = useState("");
    const [statImprovements, setStatImprovements] = useState("");
    const [statRating, setStatRating] = useState("");
    const [statMatch, setStatMatch] = useState<'equal' | 'error' | null>(null);

    // State for placeholders (default values)
    const [phMarketValue, setPhMarketValue] = useState('[Replace_MarketValue]');
    const [phMarketValuation, setPhMarketValuation] = useState('[Replace_MarketValuation]');
    const [phImprovement, setPhImprovement] = useState('[Replace_ImprovementValueByValuer]');
    const [phLand, setPhLand] = useState('[Replace_LandValueByValuer]');
    const [phChattels, setPhChattels] = useState('[Replace_ChattelsByValuer]');
    const [phTotalMarket, setPhTotalMarket] = useState('[Replace_MarketValueByValuer]');
    const [phStatLand, setPhStatLand] = useState('[Replace_LandValueFromWeb]');
    const [phStatImprovements, setPhStatImprovements] = useState('[Replace_ValueofImprovementsFromWeb]');
    const [phStatRating, setPhStatRating] = useState('[Replace_RatingValuationFromWeb]');

    // Room Option State
    const [roomTemplates, setRoomTemplates] = useState<MultiChoiceCard[]>([]);
    const [addedRooms, setAddedRooms] = useState<{
        id: number;
        templateId: string;
        roomName: string;
        placeholderName: string;
        placeholderText: string;
        selectedOptions: string[];
        textValue: string
    }[]>([]);
    const [selectedRoomTemplate, setSelectedRoomTemplate] = useState<string>("");
    const [roomLoading, setRoomLoading] = useState(false);
    const [nextRoomId, setNextRoomId] = useState(1);

    // MPI (Text Templates) State
    const [mpiCards, setMpiCards] = useState<TextTemplateCard[]>([]);
    const [mpiSelections, setMpiSelections] = useState<{ [cardId: string]: { selectedOptions: string[], textValue: string } }>({});
    const [mpiLoading, setMpiLoading] = useState(false);

    // Helper: Number to Words
    const numberToWords = (num: number): string => {
        // Ensure we're working with an integer
        num = Math.round(num);

        const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
        const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

        const numToText = (n: number): string => {
            n = Math.floor(n); // Ensure integer at each step
            if (n === 0) return '';
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[n % 10];
            if (n < 1000) return a[Math.floor(n / 100)] + 'hundred ' + numToText(n % 100);
            if (n < 1000000) return numToText(Math.floor(n / 1000)) + 'thousand ' + numToText(n % 1000);
            if (n < 1000000000) return numToText(Math.floor(n / 1000000)) + 'million ' + numToText(n % 1000000);
            return '';
        }

        if (num === 0) return 'Zero';
        let str = numToText(num);
        // Capitalize the first letter of each word
        return str.trim().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const formatCurrency = (val: string | number) => {
        if (!val) return "";
        const num = typeof val === 'string' ? parseFloat(val.replace(/[$,]/g, '')) : val;
        if (isNaN(num)) return val.toString();
        return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
    };

    const parseNumber = (val: string) => {
        return parseFloat(val.replace(/[$,]/g, ''));
    };

    const handleMvUpdate = () => {
        const num = parseNumber(mvInput);
        if (isNaN(num)) return;

        const fmt = formatCurrency(num);
        // Round to integer before converting to words since currency is displayed without decimals
        const text = numberToWords(Math.round(num)) + " Dollars";

        setMvFormatted(fmt);
        setMvNarrative(text);
    };

    // Format all Market Value inputs to currency format
    const formatAllMarketValueInputs = () => {
        // Format Market Value inputs
        if (mvInput) {
            const num = parseNumber(mvInput);
            if (!isNaN(num)) setMvInput(formatCurrency(num));
        }

        // Format Breakdown inputs
        if (bdImprovements) {
            const num = parseNumber(bdImprovements);
            if (!isNaN(num)) setBdImprovements(formatCurrency(num));
        }
        if (bdLand) {
            const num = parseNumber(bdLand);
            if (!isNaN(num)) setBdLand(formatCurrency(num));
        }
        if (bdChattels) {
            const num = parseNumber(bdChattels);
            if (!isNaN(num)) setBdChattels(formatCurrency(num));
        }

        // Format Statutory inputs
        if (statLand) {
            const num = parseNumber(statLand);
            if (!isNaN(num)) setStatLand(formatCurrency(num));
        }
        if (statImprovements) {
            const num = parseNumber(statImprovements);
            if (!isNaN(num)) setStatImprovements(formatCurrency(num));
        }
        if (statRating) {
            const num = parseNumber(statRating);
            if (!isNaN(num)) setStatRating(formatCurrency(num));
        }
    };

    const handleBdSum = () => {
        // First format all inputs
        formatAllMarketValueInputs();

        const imp = parseNumber(bdImprovements) || 0;
        const land = parseNumber(bdLand) || 0;
        const chat = parseNumber(bdChattels) || 0;

        const sum = imp + land + chat;
        setBdTotal(formatCurrency(sum));

        const mvNum = parseNumber(mvInput) || 0;
        setBdMatch(Math.abs(sum - mvNum) < 1 ? 'equal' : 'error');
    };

    // New handler for Statutory Valuation Check button
    const handleStatCheck = () => {
        // First format all inputs
        formatAllMarketValueInputs();

        const land = parseNumber(statLand) || 0;
        const improvements = parseNumber(statImprovements) || 0;
        const rating = parseNumber(statRating) || 0;

        const sum = land + improvements;

        // If rating is empty, fill it with the sum
        if (!statRating || statRating.trim() === '') {
            setStatRating(formatCurrency(sum));
            setStatMatch(null); // No match status when auto-filling
        } else {
            // Check if sum equals rating
            setStatMatch(Math.abs(sum - rating) < 1 ? 'equal' : 'error');
        }
    };

    const handleCopyOpenAddress = () => {
        const address = report?.baseInfo?.fields?.['address']?.value || "7/20 William Souter Street, Forrest Hill, Auckland";
        navigator.clipboard.writeText(address);
        window.open("https://www.aucklandcouncil.govt.nz/en/property-rates-valuations/find-property-rates-valuation.html", "_blank");
    };

    const handleUpdateMarketValueToReport = async () => {
        if (!report || !user) return;

        // Format all inputs before saving
        formatAllMarketValueInputs();

        const sourceFields: { [key: string]: ReportField } = {};

        const addField = (ph: string, val: string, label: string) => {
            const cleanPh = ph.trim();
            if (!cleanPh) return;
            let finalValue = val;
            if (val && !val.toString().includes('$') && !isNaN(parseFloat(val.toString().replace(/,/g, '')))) {
                finalValue = formatCurrency(val);
            }

            sourceFields[cleanPh] = {
                id: cleanPh,
                label,
                placeholder: cleanPh,
                value: finalValue,
                displayType: 'text',
                type: 'string',
                ifValidation: false
            };
        };

        addField(phMarketValue, mvFormatted, 'Formatted Market Value');
        addField(phMarketValuation, `${mvFormatted}\n${mvNarrative}`, 'Market Valuation Narrative');
        addField(phImprovement, formatCurrency(bdImprovements), 'Improvements (Valuer)');
        addField(phLand, formatCurrency(bdLand), 'Land Value (Valuer)');
        addField(phChattels, formatCurrency(bdChattels), 'Chattels (Valuer)');
        addField(phTotalMarket, bdTotal, 'Total Market Value (Sum)');
        addField(phStatLand, formatCurrency(statLand), 'Statutory Land Value');
        addField(phStatImprovements, formatCurrency(statImprovements), 'Statutory Improvements');
        addField(phStatRating, formatCurrency(statRating), 'Statutory Rating Valuation');

        const updatedReport = syncReportFields(report, sourceFields);

        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, {
                metadata,
                baseInfo,
                content,
                status: 'Preprocess:Valuation' // Update status
            });
            setReport({ ...updatedReport, status: 'Preprocess:Valuation' });
            showAlert("Market Value data updated to report successfully!");
        } catch (e) {
            console.error(e);
            showAlert("Failed to update report with Market Value data.");
        }
    };

    const handleLoadConstructChattels = async () => {
        if (!user) return;
        setCcLoading(true);
        try {
            const cData = await getConstructSettings(user.uid);
            const chData = await getChattelsSettings(user.uid);
            setConstructData(cData);
            setChattelsData(chData);
        } catch (error) {
            console.error(error);
            showAlert("Failed to load Construct/Chattels data.");
        } finally {
            setCcLoading(false);
        }
    };

    // Helper function to format list with proper comma and "and" logic
    const formatListWithAnd = (items: string[]): string => {
        if (items.length === 0) return "";
        if (items.length === 1) return items[0];
        if (items.length === 2) return items.join(" and ");
        // For 3 or more items: "item1, item2, and item3"
        const allButLast = items.slice(0, -1);
        const last = items[items.length - 1];
        return allButLast.join(", ") + ", and " + last;
    };

    const generateConstructText = (cIds: string[], iIds: string[], cSettings: ConstructSettings | null) => {
        if (!cSettings) return "";
        let text = "";
        if (cIds.length > 0) {
            const labels = cSettings.elements.filter(e => cIds.includes(e.id)).map(e => e.label);
            if (labels.length > 0) text += "General construction elements comprise what appears to be " + formatListWithAnd(labels) + ".";
        }
        if (iIds.length > 0) {
            const labels = cSettings.interiorElements.filter(e => iIds.includes(e.id)).map(e => e.label);
            if (labels.length > 0) {
                if (text) text += "\n";
                text += "The interior appears to be mostly timber framed with " + formatListWithAnd(labels) + ".";
            }
        }
        return text;
    };

    const generateChattelsText = (chIds: string[], chSettings: ChattelsSettings | null) => {
        if (!chSettings) return "";
        if (chIds.length > 0) {
            const labels = chSettings.list.filter(e => chIds.includes(e.id)).map(e => e.label);
            if (labels.length > 0) return "We have included in our valuation an allowance for " + formatListWithAnd(labels) + ".";
        }
        return "";
    };

    const toggleSelection = (listType: 'construct' | 'interior' | 'chattels', id: string) => {
        if (listType === 'construct') {
            const newList = selectedConstruct.includes(id) ? selectedConstruct.filter(x => x !== id) : [...selectedConstruct, id];
            setSelectedConstruct(newList);
            setConstructText(generateConstructText(newList, selectedInterior, constructData));
        } else if (listType === 'interior') {
            const newList = selectedInterior.includes(id) ? selectedInterior.filter(x => x !== id) : [...selectedInterior, id];
            setSelectedInterior(newList);
            setConstructText(generateConstructText(selectedConstruct, newList, constructData));
        } else if (listType === 'chattels') {
            const newList = selectedChattels.includes(id) ? selectedChattels.filter(x => x !== id) : [...selectedChattels, id];
            setSelectedChattels(newList);
            setChattelsText(generateChattelsText(newList, chattelsData));
        }
    };

    const handleUpdateCCToReport = async () => {
        if (!report || !user || !constructData || !chattelsData) return;
        const sourceFields: { [key: string]: ReportField } = {};
        const findFieldId = (ph: string) => {
            if (!report.content) return null;
            let foundId: string | null = null;
            const traverse = (obj: any) => {
                if (foundId) return;
                if (!obj || typeof obj !== 'object') return;
                if (obj.placeholder === ph && obj.id) { foundId = obj.id; return; }
                for (const key in obj) { traverse(obj[key]); }
            };
            traverse(report.content);
            return foundId;
        };

        if (constructData.replaceholder) {
            const targetId = findFieldId(constructData.replaceholder) || 'construct_desc';
            sourceFields[targetId] = { id: targetId, label: 'Construct Description', placeholder: constructData.replaceholder.trim(), value: constructText, displayType: 'textarea', type: 'string', ifValidation: false };
        }
        if (chattelsData.replaceholder) {
            const targetId = findFieldId(chattelsData.replaceholder) || 'chattels_desc';
            sourceFields[targetId] = { id: targetId, label: 'Chattels Description', placeholder: chattelsData.replaceholder.trim(), value: chattelsText, displayType: 'textarea', type: 'string', ifValidation: false };
        }

        const updatedReport = syncReportFields(report, sourceFields);
        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, {
                metadata,
                baseInfo,
                content,
                status: 'Preprocess:Chattels' // Update status
            });
            setReport({ ...updatedReport, status: 'Preprocess:Chattels' });
            showAlert("Construct/Chattels data updated to report!");
        } catch (e) {
            console.error(e);
            showAlert("Failed to update report with CC data.");
        }
    };

    const handleLoadSwot = async () => {
        if (!user) return;
        setSwotLoading(true);
        try {
            const allCards = await getMultiChoiceCards(user.uid);
            const allowedPlaceholders = ['[Replace_Weaknesses]', '[Replace_Strengths]'];
            const filteredCards = allCards.filter(card => allowedPlaceholders.includes(card.placeholder));
            setSwotCards(filteredCards);
            const initialSelections: any = {};
            filteredCards.forEach(card => {
                initialSelections[card.id] = { selectedOptions: [], textValue: "" };
            });
            setSwotSelections(initialSelections);
        } catch (error) {
            console.error(error);
            showAlert("Failed to load SWOT data.");
        } finally {
            setSwotLoading(false);
        }
    };

    const handleOptionToggle = (cardId: string, optionValue: string) => {
        setSwotSelections(prev => {
            const cardState = prev[cardId] || { selectedOptions: [], textValue: "" };
            const isSelected = cardState.selectedOptions.includes(optionValue);
            let newOptions;
            if (isSelected) {
                newOptions = cardState.selectedOptions.filter(o => o !== optionValue);
            } else {
                newOptions = [...cardState.selectedOptions, optionValue];
            }
            const card = swotCards.find(c => c.id === cardId);
            const textLines = newOptions.map(optVal => {
                const opt = card?.options.find(o => o.value === optVal);
                return opt ? opt.label : optVal;
            });
            return { ...prev, [cardId]: { selectedOptions: newOptions, textValue: textLines.join("\n") } };
        });
    };

    const handleSwotTextChange = (cardId: string, text: string) => {
        setSwotSelections(prev => ({ ...prev, [cardId]: { ...prev[cardId], textValue: text } }));
    };

    const handleUpdateSwotToReport = async () => {
        if (!report || !user) return;
        const sourceFields: { [key: string]: ReportField } = {};
        swotCards.forEach((card, idx) => {
            const selection = swotSelections[card.id];
            if (selection && card.placeholder) {
                // IMPORTANT: Normalize line breaks to match Address Multi-line format
                // Convert all line breaks to \n (LF) for consistency
                let normalizedValue = selection.textValue || "";

                // Log original value for debugging
                console.log(`[SWOT Debug] Card: ${card.name}`);
                console.log(`[SWOT Debug] Original value:`, JSON.stringify(normalizedValue));
                console.log(`[SWOT Debug] Has \\r\\n:`, normalizedValue.includes('\r\n'));
                console.log(`[SWOT Debug] Has \\n:`, normalizedValue.includes('\n'));
                console.log(`[SWOT Debug] Has \\r:`, normalizedValue.includes('\r'));

                // Normalize: Convert all line breaks to \n
                normalizedValue = normalizedValue.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

                // Log normalized value
                console.log(`[SWOT Debug] Normalized value:`, JSON.stringify(normalizedValue));

                // Update the original placeholder
                sourceFields[`swot_${idx}`] = {
                    id: `swot_${idx}`,
                    label: card.name,
                    placeholder: card.placeholder.trim(),
                    value: normalizedValue,  // Use normalized value
                    displayType: 'textarea',
                    type: 'string',
                    ifValidation: false
                };

                // Also update the corresponding "1" placeholder with the same value
                // [Replace_Strengths] -> [Replace_Strengths1]
                // [Replace_Weaknesses] -> [Replace_Weaknesses1]
                const trimmedPlaceholder = card.placeholder.trim();
                if (trimmedPlaceholder === '[Replace_Strengths]') {
                    sourceFields[`swot_${idx}_1`] = {
                        id: `swot_${idx}_1`,
                        label: card.name + '1',
                        placeholder: '[Replace_Strengths1]',
                        value: normalizedValue,
                        displayType: 'textarea',
                        type: 'string',
                        ifValidation: false
                    };
                } else if (trimmedPlaceholder === '[Replace_Weaknesses]') {
                    sourceFields[`swot_${idx}_1`] = {
                        id: `swot_${idx}_1`,
                        label: card.name + '1',
                        placeholder: '[Replace_Weaknesses1]',
                        value: normalizedValue,
                        displayType: 'textarea',
                        type: 'string',
                        ifValidation: false
                    };
                }
            }
        });
        const updatedReport = syncReportFields(report, sourceFields);
        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, {
                metadata,
                baseInfo,
                content,
                status: 'Preprocess:SWOT' // Update status
            });
            setReport({ ...updatedReport, status: 'Preprocess:SWOT' });
            showAlert("SWOT data updated to report!");
        } catch (e) {
            console.error(e);
            showAlert("Failed to update report with SWOT data.");
        }
    };

    // ==========================
    // MPI (Text Templates) Handlers
    // ==========================
    const handleLoadMPI = async () => {
        if (!user) return;
        setMpiLoading(true);
        try {
            const allCards = await getTextTemplateCards(user.uid);
            setMpiCards(allCards);
            const initialSelections: any = {};
            allCards.forEach(card => {
                initialSelections[card.id] = { selectedOptions: [], textValue: "" };
            });
            setMpiSelections(initialSelections);
        } catch (error) {
            console.error(error);
            showAlert("Failed to load Text Templates data.");
        } finally {
            setMpiLoading(false);
        }
    };

    const handleMpiOptionToggle = (cardId: string, optionId: string) => {
        setMpiSelections(prev => {
            const cardState = prev[cardId] || { selectedOptions: [], textValue: "" };
            const isSelected = cardState.selectedOptions.includes(optionId);
            let newOptions;
            if (isSelected) {
                newOptions = cardState.selectedOptions.filter(o => o !== optionId);
            } else {
                newOptions = [...cardState.selectedOptions, optionId];
            }
            const card = mpiCards.find(c => c.id === cardId);
            const textLines = newOptions.map(optId => {
                const opt = card?.options.find(o => o.id === optId);
                return opt ? opt.value : ""; // Use value for multi-line content
            }).filter(v => v); // Remove empty values
            return { ...prev, [cardId]: { selectedOptions: newOptions, textValue: textLines.join("\n") } };
        });
    };

    const handleMpiTextChange = (cardId: string, text: string) => {
        setMpiSelections(prev => ({ ...prev, [cardId]: { ...prev[cardId], textValue: text } }));
    };

    const handleUpdateMpiToReport = async () => {
        if (!report || !user) {
            console.log("[MPI] ⚠️ Early return - no report or user");
            return;
        }

        const sourceFields: { [key: string]: ReportField } = {};
        mpiCards.forEach((card, idx) => {
            const selection = mpiSelections[card.id];

            if (selection && card.placeholder) {
                // Trim whitespace from placeholder to ensure matching
                const trimmedPlaceholder = card.placeholder.trim();

                // Normalize line breaks to \n for consistency
                let normalizedValue = selection.textValue || "";

                // Normalize: Convert all line breaks to \n
                normalizedValue = normalizedValue.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

                sourceFields[`mpi_${idx}`] = {
                    id: `mpi_${idx}`,
                    label: card.name,
                    placeholder: trimmedPlaceholder,  // Use trimmed version
                    value: normalizedValue,
                    displayType: 'textarea',
                    type: 'string',
                    ifValidation: false
                };
            } else {
                console.log(`[MPI Card ${idx}] ⚠️ SKIPPED - Missing selection or placeholder`);
            }
        });

        const updatedReport = syncReportFields(report, sourceFields);

        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, {
                metadata,
                baseInfo,
                content,
                status: 'Preprocess:MPI' // Update status
            });
            setReport({ ...updatedReport, status: 'Preprocess:MPI' });
            showAlert("Text Templates data updated to report!");
        } catch (e) {
            console.error(e);
            showAlert("Failed to update report with Text Templates data.");
        }
    };

    // ==========================
    // Room Option Handlers
    // ==========================
    const handleLoadRoomSettings = async () => {
        if (!user) return;
        setRoomLoading(true);
        try {
            const allCards = await getMultiChoiceCards(user.uid);
            // Filter cards starting with Replace_RoomName
            const rooms = allCards.filter(c => c.placeholder && c.placeholder.includes("Replace_RoomName"));
            setRoomTemplates(rooms);
            if (rooms.length > 0) setSelectedRoomTemplate(rooms[0].id);
        } catch (error) {
            console.error(error);
            showAlert("Failed to load Room Settings.");
        } finally {
            setRoomLoading(false);
        }
    };

    const handleAddRoom = () => {
        if (!selectedRoomTemplate) return;
        const template = roomTemplates.find(t => t.id === selectedRoomTemplate);
        if (!template) return;

        const newRoom = {
            id: nextRoomId,
            templateId: template.id,
            roomName: template.name,
            placeholderName: `[Replace_RoomOptionName${nextRoomId}]`,
            placeholderText: `[Replace_RoomOptionText${nextRoomId}]`,
            selectedOptions: [],
            textValue: ""
        };

        setAddedRooms([newRoom, ...addedRooms]);
        setNextRoomId(prev => prev + 1);
    };

    const handleDeleteRoom = (index: number) => {
        const newRooms = [...addedRooms];
        newRooms.splice(index, 1);
        setAddedRooms(newRooms);
    };

    const handleRoomOptionInfoToggle = (roomIndex: number, optionValue: string, optionLabel: string) => {
        const newRooms = [...addedRooms];
        const room = newRooms[roomIndex];

        let newSelected = [...room.selectedOptions];
        // User said: "Database has Label and Text, select Label" - interpreted as toggling by Label for storage/display?
        // "Room Option text in left ... separated by comma"
        // Let's store Labels in selectedOptions for simplicity as requested "select Label"
        if (newSelected.includes(optionLabel)) {
            newSelected = newSelected.filter(l => l !== optionLabel);
        } else {
            newSelected.push(optionLabel);
        }

        room.selectedOptions = newSelected;
        room.textValue = newSelected.join(", ");

        setAddedRooms(newRooms);
    };

    const handleUpdateRoomToReport = async () => {
        if (!report || !user) return;

        try {
            // Deep copy the report to avoid mutation
            const updatedReport = JSON.parse(JSON.stringify(report));

            // Find the section and field containing [Replace_LayoutAmenities]
            let targetSection: any = null;
            let targetFieldKey: string | null = null;
            let targetFieldOrder: string[] = [];
            let insertPosition = 0;

            // Search through all content sections
            if (updatedReport.content) {
                for (const sectionKey of Object.keys(updatedReport.content)) {
                    const section = updatedReport.content[sectionKey];
                    if (section.fields) {
                        for (const fieldKey of Object.keys(section.fields)) {
                            const field = section.fields[fieldKey];
                            if (field.placeholder === '[Replace_LayoutAmenities]') {
                                targetSection = section;
                                targetFieldKey = fieldKey;
                                targetFieldOrder = section.fieldOrder || [];
                                break;
                            }
                        }
                    }
                    if (targetSection) break;
                }
            }

            // If [Replace_LayoutAmenities] not found, use the first content section and insert at the end
            if (!targetSection) {
                const firstSectionKey = updatedReport.content ? Object.keys(updatedReport.content)[0] : null;
                if (firstSectionKey) {
                    targetSection = updatedReport.content[firstSectionKey];
                    targetFieldOrder = targetSection.fieldOrder || [];
                    insertPosition = targetFieldOrder.length; // Insert at the end
                    console.log('[Room Option] [Replace_LayoutAmenities] not found, inserting at end of first section:', firstSectionKey);
                } else {
                    showAlert("No content sections found in report structure.");
                    return;
                }
            } else {
                // Found [Replace_LayoutAmenities], insert after it
                const insertAfterIndex = targetFieldOrder.indexOf(targetFieldKey!);
                if (insertAfterIndex !== -1) {
                    insertPosition = insertAfterIndex + 1;
                } else {
                    insertPosition = targetFieldOrder.length; // Fallback to end
                }
                console.log('[Room Option] Found target section:', targetSection.id);
                console.log('[Room Option] Target field key:', targetFieldKey);
            }

            console.log('[Room Option] Current field order:', targetFieldOrder);
            console.log('[Room Option] Will insert at position:', insertPosition);

            // Remove any existing room option fields (cleanup old data)
            const fieldsToRemove: string[] = [];
            Object.keys(targetSection.fields).forEach(key => {
                const field = targetSection.fields[key];
                if (field.placeholder && (
                    field.placeholder.includes('Replace_RoomOptionName') ||
                    field.placeholder.includes('Replace_RoomOptionText')
                )) {
                    fieldsToRemove.push(key);
                }
            });

            fieldsToRemove.forEach(key => {
                delete targetSection.fields[key];
                const idx = targetFieldOrder.indexOf(key);
                if (idx !== -1) {
                    targetFieldOrder.splice(idx, 1);
                    // Adjust insert position if we removed fields before it
                    if (idx < insertPosition) {
                        insertPosition--;
                    }
                }
            });

            console.log('[Room Option] Removed old room fields:', fieldsToRemove);

            // Insert new room data
            const newFieldKeys: string[] = [];

            addedRooms.forEach((room, idx) => {
                // Create unique field IDs
                const nameFieldId = `roomOptionName_${room.id}`;
                const textFieldId = `roomOptionText_${room.id}`;

                // Add room name field
                targetSection.fields[nameFieldId] = {
                    id: nameFieldId,
                    label: `Room ${room.id} Name`,
                    placeholder: room.placeholderName?.trim() || "",
                    value: room.roomName,
                    displayType: 'text',
                    type: 'string',
                    ifValidation: false
                };

                // Add room option text field
                targetSection.fields[textFieldId] = {
                    id: textFieldId,
                    label: `Room ${room.id} Options`,
                    placeholder: room.placeholderText?.trim() || "",
                    value: room.textValue,
                    displayType: 'textarea',
                    type: 'string',
                    ifValidation: false
                };

                newFieldKeys.push(nameFieldId, textFieldId);
            });

            // Insert the new field keys into fieldOrder at the correct position
            targetFieldOrder.splice(insertPosition, 0, ...newFieldKeys);
            targetSection.fieldOrder = targetFieldOrder;

            console.log('[Room Option] Added new fields:', newFieldKeys);
            console.log('[Room Option] Updated field order:', targetFieldOrder);

            // Update the report in Firestore
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, {
                metadata,
                baseInfo,
                content,
                status: 'Preprocess:RoomOption' // Update status
            });
            setReport({ ...updatedReport, status: 'Preprocess:RoomOption' });
            showAlert(`Successfully inserted ${addedRooms.length} room(s) into report!`);
        } catch (e) {
            console.error(e);
            showAlert("Failed to update report with Room Options.");
        }
    };

    const handleNext = async () => {
        if (!report || !user) return;

        try {
            // Update status to Filling:Basic before navigating
            await updateReport(user.uid, report.id, { status: 'Filling:Basic' });
            router.push(`/report/basic?id=${report.id}`);
        } catch (e) {
            console.error(e);
            showAlert("Failed to update status.");
        }
    };

    const handleUpdateJobInfo = () => {
        if (!report) return;
        router.push(`/report/meta?id=${report.id}`);
    };

    return (
        <>
            {AlertComponent}
            <div className={styles.container}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Data Pre-processing</h1>
                    </div>
                    <button className={styles.updateJobBtn} onClick={handleUpdateJobInfo}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Update Job Info
                    </button>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'ai-extract' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('ai-extract')}
                    >
                        AI PDF Extract
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'static-info' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('static-info')}
                        style={{ display: 'none' }} // Hidden but kept for future use
                    >
                        Static Info
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'mpi' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('mpi')}
                    >
                        MPI
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'swot' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('swot')}
                    >
                        SWOT Data
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'market-value' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('market-value')}
                    >
                        Market Value
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'construct-chattels' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('construct-chattels')}
                    >
                        Construct/Chattels
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'room-option' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('room-option')}
                    >
                        Room Option
                    </button>
                </div>

                {initDone && report && (
                    <div className={styles.tabContent}>
                        {activeTab === 'ai-extract' && (
                            <div className={styles.mainGrid}>
                                {/* Files Column */}
                                <div className={styles.card}>
                                    <h2 className={styles.cardTitle}>Source Files</h2>

                                    {/* Brief Doc Upload */}
                                    <div className={styles.field} style={{ marginBottom: '1rem' }}>
                                        <label className={styles.fieldLabel}>Brief Doc</label>
                                        <div className={styles.fileInputWrapper}>
                                            <input
                                                type="text"
                                                className={`input ${styles.fileInput}`}
                                                value={
                                                    uploadingBrief
                                                        ? "Uploading..."
                                                        : report.files.brief?.name || ""
                                                }
                                                placeholder="Upload (.pdf, .doc)"
                                                readOnly
                                                onClick={() => !uploadingBrief && briefInputRef.current?.click()}
                                                style={{ cursor: uploadingBrief ? 'not-allowed' : 'pointer' }}
                                            />
                                            <button
                                                className={styles.fileBtn}
                                                onClick={() => briefInputRef.current?.click()}
                                                disabled={uploadingBrief}
                                            >
                                                {uploadingBrief ? "..." : report.files.brief?.name ? "Replace" : "Choose"}
                                            </button>
                                            <input
                                                type="file"
                                                ref={briefInputRef}
                                                hidden
                                                onChange={(e) => onFileChange(e, "brief")}
                                                accept=".pdf,.doc,.docx"
                                                disabled={uploadingBrief}
                                            />
                                        </div>
                                    </div>

                                    {/* Title Doc Upload */}
                                    <div className={styles.field} style={{ marginBottom: '1rem' }}>
                                        <label className={styles.fieldLabel}>Property Title</label>
                                        <div className={styles.fileInputWrapper}>
                                            <input
                                                type="text"
                                                className={`input ${styles.fileInput}`}
                                                value={
                                                    uploadingTitle
                                                        ? "Uploading..."
                                                        : report.files.title?.name || ""
                                                }
                                                placeholder="Upload (.pdf, .doc)"
                                                readOnly
                                                onClick={() => !uploadingTitle && titleInputRef.current?.click()}
                                                style={{ cursor: uploadingTitle ? 'not-allowed' : 'pointer' }}
                                            />
                                            <button
                                                className={styles.fileBtn}
                                                onClick={() => titleInputRef.current?.click()}
                                                disabled={uploadingTitle}
                                            >
                                                {uploadingTitle ? "..." : report.files.title?.name ? "Replace" : "Choose"}
                                            </button>
                                            <input
                                                type="file"
                                                ref={titleInputRef}
                                                hidden
                                                onChange={(e) => onFileChange(e, "title")}
                                                accept=".pdf,.doc,.docx"
                                                disabled={uploadingTitle}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 'auto' }}>
                                        <p className="text-xs text-gray-500 mb-2">
                                            AI will read these PDF/Doc files to extract data based on your "PDF Extract" Settings.
                                        </p>
                                        <button
                                            className={styles.extractBtn}
                                            onClick={handleAIExtract}
                                            disabled={
                                                isExtracting ||
                                                uploadingBrief ||
                                                uploadingTitle ||
                                                !report.files.brief?.url ||
                                                !report.files.title?.url
                                            }
                                        >
                                            {isExtracting ? "Extracting..." : "AI Extract Data"}
                                        </button>
                                        {(!report.files.brief?.url || !report.files.title?.url) && (
                                            <p className="text-xs text-amber-600 mt-2">
                                                ⚠ Please upload both files before extracting
                                            </p>
                                        )}
                                        {(uploadingBrief || uploadingTitle) && (
                                            <p className="text-xs text-blue-600 mt-2">
                                                🔄 Uploading files...
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Extracted Data Editor */}
                                <div className={styles.card}>
                                    <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                                        <h2 className={styles.cardTitle} style={{ border: 'none', marginBottom: 0 }}>Extracted Data</h2>
                                        <button className={styles.primaryBtn} onClick={handleUpdateDatabase} disabled={extractedData.length === 0}>
                                            Update Report Database
                                        </button>
                                    </div>

                                    {extractedData.length === 0 ? (
                                        <div className="flex items-center justify-center h-40 text-gray-400">
                                            No data extracted yet. Click "AI Extract Data".
                                        </div>
                                    ) : (
                                        <div style={{ overflow: 'visible' }}>
                                            <table className={styles.editorTable}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '200px' }}>Label</th>
                                                        <th>Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {extractedData.map((row, idx) => (
                                                        <tr key={idx}>
                                                            <td style={{ width: '200px', verticalAlign: 'top', paddingTop: '0.75rem' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                    <span
                                                                        className={styles.placeholderIcon}
                                                                        title={row.placeholder}
                                                                    >
                                                                        P
                                                                    </span>
                                                                    <span>{row.label}</span>
                                                                </div>
                                                            </td>
                                                            <td style={{ paddingRight: '0.5rem' }}>
                                                                {row.displayType === 'textarea' ? (
                                                                    <textarea
                                                                        className={styles.textarea}
                                                                        rows={3}
                                                                        value={extractValues[idx] || ""}
                                                                        onChange={(e) => setExtractValues(prev => ({ ...prev, [idx]: e.target.value }))}
                                                                    />
                                                                ) : row.displayType === 'date' ? (
                                                                    <input
                                                                        type="date"
                                                                        className={styles.input}
                                                                        value={formatDateForInput(extractValues[idx] || "")}
                                                                        onChange={(e) => {
                                                                            const val = formatDateForStorage(e.target.value);
                                                                            setExtractValues(prev => ({ ...prev, [idx]: val }))
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        className={styles.input}
                                                                        value={extractValues[idx] || ""}
                                                                        onChange={(e) => setExtractValues(prev => ({ ...prev, [idx]: e.target.value }))}
                                                                    />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}


                        {activeTab === 'static-info' && (
                            <div className={styles.card}>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
                                    <h2 className={styles.cardTitle} style={{ border: 'none', marginBottom: 0 }}>Static Information</h2>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button className={styles.secondaryBtn} onClick={handleLoadStatic} disabled={staticLoading}>
                                            {staticLoading ? "Loading..." : "Load From Settings"}
                                        </button>
                                        <button className={styles.primaryBtn} onClick={handleUpdateStaticToReport} disabled={Object.keys(staticData).length === 0}>
                                            Update to Report
                                        </button>
                                    </div>
                                </div>

                                {Object.keys(staticData).length === 0 ? (
                                    <div className="flex items-center justify-center h-20 text-gray-400">
                                        Click "Load From Settings" to fetch your static content.
                                    </div>
                                ) : (
                                    <div className={styles.staticInfoGrid}>
                                        {[
                                            { key: 'nzEconomyOverview', label: 'NZ Economy Overview', placeholder: (staticData as any).nzEconomyOverview_ph },
                                            { key: 'globalEconomyOverview', label: 'Global Economy Overview', placeholder: (staticData as any).globalEconomyOverview_ph },
                                            { key: 'residentialMarket', label: 'Residential Market', placeholder: (staticData as any).residentialMarket_ph },
                                            { key: 'recentMarketDirection', label: 'Market Direction', placeholder: (staticData as any).recentMarketDirection_ph },
                                            { key: 'marketVolatility', label: 'Market Volatility', placeholder: (staticData as any).marketVolatility_ph },
                                            { key: 'localEconomyImpact', label: 'Local Economy Impact', placeholder: (staticData as any).localEconomyImpact_ph }
                                        ].map((field) => (
                                            <div key={field.key} className={styles.staticInfoCard}>
                                                <div className={styles.staticInfoLeft}>
                                                    <div className={styles.staticInfoLabel}>{field.label}</div>
                                                    <div className={styles.staticInfoPlaceholder}>
                                                        {field.placeholder || <span className="text-gray-400 italic">No placeholder</span>}
                                                    </div>
                                                </div>
                                                <div className={styles.staticInfoRight}>
                                                    <textarea
                                                        className={styles.staticInfoTextarea}
                                                        rows={5}
                                                        value={(staticData as any)[field.key] || ""}
                                                        onChange={(e) => setStaticData(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'swot' && (
                            <div className={styles.card}>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                                    <h2 className={styles.cardTitle} style={{ border: 'none', marginBottom: 0 }}>SWOT Data (Multi-Choice)</h2>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button className={styles.secondaryBtn} onClick={handleLoadSwot} disabled={swotLoading}>
                                            {swotLoading ? "Loading..." : "Load From Settings"}
                                        </button>
                                        <button className={styles.primaryBtn} onClick={handleUpdateSwotToReport} disabled={swotCards.length === 0}>
                                            Update to Report
                                        </button>
                                    </div>
                                </div>

                                {swotCards.length === 0 ? (
                                    <div className="flex items-center justify-center h-20 text-gray-400">
                                        Click "Load From Settings" to fetch your multi-choice content (e.g., SWOT).
                                    </div>
                                ) : (
                                    <div>
                                        {swotCards.map((card) => {
                                            const selection = swotSelections[card.id] || { selectedOptions: [], textValue: "" };

                                            return (
                                                <div key={card.id} className={styles.swotCard}>
                                                    <div className={styles.swotHeader}>
                                                        <span className={styles.swotTitle}>{card.name}</span>
                                                        <span className={styles.swotPlaceholder}>{card.placeholder}</span>
                                                    </div>

                                                    <div className={styles.swotBody}>
                                                        {/* Options Column */}
                                                        <div className={styles.swotLeft}>
                                                            <div className="space-y-1 flex-1 overflow-y-auto">
                                                                {card.options.map(option => (
                                                                    <label key={option.id} className="flex items-start gap-2 cursor-pointer p-2 hover:bg-white rounded transition-colors text-sm">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="mt-1"
                                                                            checked={selection.selectedOptions.includes(option.value)}
                                                                            onChange={() => handleOptionToggle(card.id, option.value)}
                                                                        />
                                                                        <span className="text-gray-700">{option.label}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Text Area Column */}
                                                        <div className={styles.swotRight}>
                                                            <textarea
                                                                className={styles.textarea}
                                                                style={{ flex: 1, minHeight: '150px', resize: 'vertical' }}
                                                                value={selection.textValue}
                                                                onChange={(e) => handleSwotTextChange(card.id, e.target.value)}
                                                                placeholder="Select options from the left or type here..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'mpi' && (
                            <div className={styles.card}>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                                    <h2 className={styles.cardTitle} style={{ border: 'none', marginBottom: 0 }}>MPI (Text Templates)</h2>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button className={styles.secondaryBtn} onClick={handleLoadMPI} disabled={mpiLoading}>
                                            {mpiLoading ? "Loading..." : "Load From Settings"}
                                        </button>
                                        <button className={styles.primaryBtn} onClick={handleUpdateMpiToReport} disabled={mpiCards.length === 0}>
                                            Update to Report
                                        </button>
                                    </div>
                                </div>

                                {mpiCards.length === 0 ? (
                                    <div className="flex items-center justify-center h-20 text-gray-400">
                                        Click "Load From Settings" to fetch your text templates.
                                    </div>
                                ) : (
                                    <div>
                                        {mpiCards.map((card) => {
                                            const selection = mpiSelections[card.id] || { selectedOptions: [], textValue: "" };

                                            return (
                                                <div key={card.id} className={styles.swotCard}>
                                                    <div className={styles.swotHeader}>
                                                        <span className={styles.swotTitle}>{card.name}</span>
                                                        <span className={styles.swotPlaceholder}>{card.placeholder}</span>
                                                    </div>

                                                    <div className={styles.swotBody}>
                                                        {/* Options Column */}
                                                        <div className={styles.swotLeft}>
                                                            <div className="space-y-1 flex-1 overflow-y-auto">
                                                                {card.options.map(option => (
                                                                    <label key={option.id} className="flex items-start gap-2 cursor-pointer p-2 hover:bg-white rounded transition-colors text-sm">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="mt-1"
                                                                            checked={selection.selectedOptions.includes(option.id)}
                                                                            onChange={() => handleMpiOptionToggle(card.id, option.id)}
                                                                        />
                                                                        <span className="text-gray-700">{option.label}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Text Area Column */}
                                                        <div className={styles.swotRight}>
                                                            <textarea
                                                                className={styles.textarea}
                                                                style={{ flex: 1, minHeight: '200px', resize: 'vertical' }}
                                                                value={selection.textValue}
                                                                onChange={(e) => handleMpiTextChange(card.id, e.target.value)}
                                                                placeholder={`Select options from the left or type multi-line text here...\nPlaceholder: ${card.placeholder}`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'market-value' && (
                            <div className={styles.card}>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
                                    <h2 className={styles.cardTitle} style={{ border: 'none', marginBottom: 0 }}>Market Value</h2>
                                    <button className={styles.primaryBtn} onClick={handleUpdateMarketValueToReport}>
                                        Update To Report
                                    </button>
                                </div>

                                <div className={styles.marketValueContainer}>
                                    {/* Market Value Input Card */}
                                    <div className={styles.marketValueCard}>
                                        <h3 className={styles.marketValueCardHeader}>Market Value</h3>

                                        <div className={styles.marketValueGrid}>
                                            <div className={styles.marketValueInputGroup}>
                                                <label className={styles.marketValueLabel}>Market Value ($)</label>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    <input
                                                        className={styles.marketValueInput}
                                                        placeholder="560000"
                                                        value={mvInput}
                                                        onChange={(e) => setMvInput(e.target.value)}
                                                    />
                                                    <button className={styles.marketValueButton} onClick={handleMvUpdate}>
                                                        Update
                                                    </button>
                                                </div>
                                            </div>

                                            <div className={styles.marketValueInputGroup}>
                                                <label className={styles.marketValueLabel}>
                                                    Formatted Value
                                                    <span
                                                        className={styles.marketValuePlaceholder}
                                                        title={phMarketValue}
                                                    >
                                                        P
                                                    </span>
                                                </label>
                                                <input
                                                    className={styles.marketValueInput}
                                                    value={mvFormatted}
                                                    readOnly
                                                />
                                            </div>

                                            <div className={styles.marketValueInputGroup}>
                                                <label className={styles.marketValueLabel}>
                                                    Narrative
                                                    <span
                                                        className={styles.marketValuePlaceholder}
                                                        title={phMarketValuation}
                                                    >
                                                        P
                                                    </span>
                                                </label>
                                                <div className={styles.marketValueNarrative}>
                                                    {mvFormatted && <span className={styles.marketValueNarrativeAmount}>{mvFormatted}</span>}
                                                    {mvNarrative && <span className={styles.marketValueNarrativeText}>{mvNarrative}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Valuation Breakdown Card */}
                                    <div className={styles.marketValueCard}>
                                        <h3 className={styles.marketValueCardHeader}>Valuation Breakdown</h3>

                                        <div className={styles.marketValueGrid}>
                                            <div className={styles.marketValueInputGroup}>
                                                <label className={styles.marketValueLabel}>
                                                    Improvements
                                                    <span
                                                        className={styles.marketValuePlaceholder}
                                                        title={phImprovement}
                                                    >
                                                        P
                                                    </span>
                                                </label>
                                                <input
                                                    className={styles.marketValueInput}
                                                    placeholder="130,000"
                                                    value={bdImprovements}
                                                    onChange={(e) => setBdImprovements(e.target.value)}
                                                />
                                            </div>

                                            <div className={styles.marketValueInputGroup}>
                                                <label className={styles.marketValueLabel}>
                                                    Land
                                                    <span
                                                        className={styles.marketValuePlaceholder}
                                                        title={phLand}
                                                    >
                                                        P
                                                    </span>
                                                </label>
                                                <input
                                                    className={styles.marketValueInput}
                                                    placeholder="340,000"
                                                    value={bdLand}
                                                    onChange={(e) => setBdLand(e.target.value)}
                                                />
                                            </div>

                                            <div className={styles.marketValueInputGroup}>
                                                <label className={styles.marketValueLabel}>
                                                    Chattels
                                                    <span
                                                        className={styles.marketValuePlaceholder}
                                                        title={phChattels}
                                                    >
                                                        P
                                                    </span>
                                                </label>
                                                <input
                                                    className={styles.marketValueInput}
                                                    placeholder="80,000"
                                                    value={bdChattels}
                                                    onChange={(e) => setBdChattels(e.target.value)}
                                                />
                                            </div>

                                            <div className={styles.marketValueInputGroup}>
                                                <label className={styles.marketValueLabel}>
                                                    Total
                                                    <span
                                                        className={styles.marketValuePlaceholder}
                                                        title={phTotalMarket}
                                                    >
                                                        P
                                                    </span>
                                                </label>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    <input
                                                        className={styles.marketValueInput}
                                                        value={bdTotal}
                                                        readOnly
                                                    />
                                                    {bdMatch === 'equal' && (
                                                        <span className={`${styles.marketValueStatus} ${styles.marketValueStatusSuccess}`}>
                                                            ✓ Equal
                                                        </span>
                                                    )}
                                                    {bdMatch === 'error' && (
                                                        <span className={`${styles.marketValueStatus} ${styles.marketValueStatusError}`}>
                                                            ✗ Error
                                                        </span>
                                                    )}
                                                    <button className={styles.marketValueButtonSecondary} onClick={handleBdSum}>
                                                        Sum & Check
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Statutory Valuation Card */}
                                    <div className={`${styles.marketValueCard} ${styles.marketValueStatutory}`}>
                                        <div className={styles.marketValueStatutoryHeader}>
                                            <h3 className={styles.marketValueStatutoryTitle}>Statutory Valuation</h3>
                                            <span className={styles.marketValueStatutoryAddress}>
                                                {report?.baseInfo?.fields?.['address']?.value || "7/20 William Souter Street, Forrest Hill, Auckland"}
                                            </span>
                                            <button className={styles.marketValueStatutoryButton} onClick={handleCopyOpenAddress}>
                                                Copy & Open
                                            </button>
                                        </div>

                                        <div className={styles.marketValueGrid}>
                                            <div className={styles.marketValueInputGroup}>
                                                <label className={styles.marketValueLabel}>
                                                    Land
                                                    <span
                                                        className={styles.marketValuePlaceholder}
                                                        title={phStatLand}
                                                    >
                                                        P
                                                    </span>
                                                </label>
                                                <input
                                                    className={styles.marketValueInput}
                                                    placeholder="340,000"
                                                    value={statLand}
                                                    onChange={(e) => setStatLand(e.target.value)}
                                                />
                                            </div>

                                            <div className={styles.marketValueInputGroup}>
                                                <label className={styles.marketValueLabel}>
                                                    Improvement
                                                    <span
                                                        className={styles.marketValuePlaceholder}
                                                        title={phStatImprovements}
                                                    >
                                                        P
                                                    </span>
                                                </label>
                                                <input
                                                    className={styles.marketValueInput}
                                                    placeholder="130,000"
                                                    value={statImprovements}
                                                    onChange={(e) => setStatImprovements(e.target.value)}
                                                />
                                            </div>

                                            <div className={styles.marketValueInputGroup}>
                                                <label className={styles.marketValueLabel}>
                                                    Rating
                                                    <span
                                                        className={styles.marketValuePlaceholder}
                                                        title={phStatRating}
                                                    >
                                                        P
                                                    </span>
                                                </label>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    <input
                                                        className={styles.marketValueInput}
                                                        placeholder="550,000"
                                                        value={statRating}
                                                        onChange={(e) => setStatRating(e.target.value)}
                                                    />
                                                    {statMatch === 'equal' && (
                                                        <span className={`${styles.marketValueStatus} ${styles.marketValueStatusSuccess}`}>
                                                            ✓ Equal
                                                        </span>
                                                    )}
                                                    {statMatch === 'error' && (
                                                        <span className={`${styles.marketValueStatus} ${styles.marketValueStatusError}`}>
                                                            ✗ Error
                                                        </span>
                                                    )}
                                                    <button className={styles.marketValueButtonSecondary} onClick={handleStatCheck}>
                                                        Check
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'construct-chattels' && (
                            <div className={styles.card}>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                                    <h2 className={styles.cardTitle} style={{ border: 'none', marginBottom: 0 }}>Construct / Chattels Data</h2>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button className={styles.secondaryBtn} onClick={handleLoadConstructChattels} disabled={ccLoading}>
                                            {ccLoading ? "Loading..." : "Load From Settings"}
                                        </button>
                                        <button className={styles.primaryBtn} onClick={handleUpdateCCToReport} disabled={!constructData && !chattelsData}>
                                            Update to Report
                                        </button>
                                    </div>
                                </div>

                                {!constructData && !chattelsData ? (
                                    <div className="flex items-center justify-center h-20 text-gray-400">
                                        Click "Load From Settings" to fetch Construct & Chattels data.
                                    </div>
                                ) : (
                                    <div>
                                        {/* Construct Card */}
                                        <div className={styles.ccCard}>
                                            <div className={styles.ccHeaderRow}>
                                                <h3 className={styles.ccTitle}>Construct Card</h3>
                                            </div>

                                            <div className={styles.ccGrid}>
                                                {/* Left Column: Construct Element List */}
                                                <div className={styles.ccColumnLeft}>
                                                    <div className={styles.ccSubHeader}>
                                                        <span className={styles.ccLabel}>Construct Element</span>
                                                    </div>
                                                    <div className={styles.optionList}>
                                                        {constructData?.elements?.map(opt => (
                                                            <label key={opt.id} className="flex items-start gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded transition-colors text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    className="mt-1"
                                                                    checked={selectedConstruct.includes(opt.id)}
                                                                    onChange={() => toggleSelection('construct', opt.id)}
                                                                />
                                                                <span className="text-gray-700">{opt.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Right Column: Interior + Description */}
                                                <div className={styles.ccColumnRight}>
                                                    <div className={styles.ccSubHeader}>
                                                        <span className={styles.ccLabel}>Interior Element</span>
                                                    </div>
                                                    <div className={styles.optionList} style={{ marginBottom: '1rem', maxHeight: '120px' }}>
                                                        {constructData?.interiorElements?.map(opt => (
                                                            <label key={opt.id} className="flex items-start gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded transition-colors text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    className="mt-1"
                                                                    checked={selectedInterior.includes(opt.id)}
                                                                    onChange={() => toggleSelection('interior', opt.id)}
                                                                />
                                                                <span className="text-gray-700">{opt.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>

                                                    <div className={styles.ccDescriptionHeader}>
                                                        <span className={styles.ccDescriptionTitle}>Construct Description</span>
                                                        <span
                                                            className={styles.ccPlaceholder}
                                                            title={constructData?.replaceholder}
                                                        >
                                                            P
                                                        </span>
                                                    </div>
                                                    <textarea
                                                        className={styles.ccTextarea}
                                                        value={constructText}
                                                        onChange={(e) => setConstructText(e.target.value)}
                                                        placeholder="Text will be generated here..."
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Chattels Card */}
                                        <div className={styles.ccCard}>
                                            <div className={styles.ccHeaderRow}>
                                                <h3 className={styles.ccTitle}>Chattels Card</h3>
                                            </div>

                                            <div className={styles.ccGrid}>
                                                {/* Left Column: Chattels List */}
                                                <div className={styles.ccColumnLeft}>
                                                    <div className={styles.ccSubHeader}>
                                                        <span className={styles.ccLabel}>Chattels List</span>
                                                    </div>
                                                    <div className={styles.optionList}>
                                                        {chattelsData?.list?.map(opt => (
                                                            <label key={opt.id} className="flex items-start gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded transition-colors text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    className="mt-1"
                                                                    checked={selectedChattels.includes(opt.id)}
                                                                    onChange={() => toggleSelection('chattels', opt.id)}
                                                                />
                                                                <span className="text-gray-700">{opt.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Right Column: Description Only */}
                                                <div className={styles.ccColumnRight}>
                                                    <div className={styles.ccDescriptionHeader}>
                                                        <span className={styles.ccDescriptionTitle}>Chattels Description</span>
                                                        <span
                                                            className={styles.ccPlaceholder}
                                                            title={chattelsData?.replaceholder}
                                                        >
                                                            P
                                                        </span>
                                                    </div>
                                                    <textarea
                                                        className={styles.ccTextarea}
                                                        value={chattelsText}
                                                        onChange={(e) => setChattelsText(e.target.value)}
                                                        placeholder="Text will be generated here..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'room-option' && (
                            <div className={styles.card}>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-6">
                                    <h2 className={styles.cardTitle} style={{ border: 'none', marginBottom: 0 }}>Room Option</h2>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button className={styles.secondaryBtn} onClick={handleLoadRoomSettings} disabled={roomLoading}>
                                            {roomLoading ? "Loading..." : "Load From Settings"}
                                        </button>
                                        <button className={styles.primaryBtn} onClick={handleUpdateRoomToReport}>
                                            Update to Report
                                        </button>
                                    </div>
                                </div>

                                {/* Add Room Card */}
                                {roomTemplates.length > 0 && (
                                    <div className={styles.addRoomCard}>
                                        <h3 className={styles.addRoomTitle}>Add Room</h3>

                                        <div className={styles.addRoomControls}>
                                            <div className={styles.selectWrapper}>
                                                <select
                                                    className={styles.roomSelect}
                                                    value={selectedRoomTemplate}
                                                    onChange={(e) => setSelectedRoomTemplate(e.target.value)}
                                                >
                                                    {roomTemplates.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                                <div className={styles.selectIcon}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                </div>
                                            </div>
                                            <button
                                                className={styles.addRoomBtn}
                                                onClick={handleAddRoom}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Added Rooms List */}
                                <div className={styles.roomsList}>
                                    {addedRooms.map((room, idx) => {
                                        const template = roomTemplates.find(t => t.id === room.templateId);
                                        return (
                                            <div key={room.id} className={styles.roomCard}>
                                                {/* Card Header */}
                                                <div className={styles.roomCardHeader}>
                                                    <h3 className={styles.roomCardTitle}>Room Option {room.id}</h3>
                                                    <button
                                                        onClick={() => handleDeleteRoom(idx)}
                                                        className={styles.deleteRoomBtn}
                                                        title="Remove Room"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                    </button>
                                                </div>

                                                <div className={styles.roomCardBody}>
                                                    {/* Left Column: Inputs */}
                                                    <div className={styles.roomCardLeft}>
                                                        <div className={styles.roomInputGroup}>
                                                            <div className={styles.roomInputHeader}>
                                                                <label className={styles.roomInputLabel}>Room Name</label>
                                                                <span className={styles.roomPlaceholder}>
                                                                    {room.placeholderName}
                                                                </span>
                                                            </div>
                                                            <input
                                                                className={styles.roomInput}
                                                                value={room.roomName}
                                                                onChange={(e) => {
                                                                    const newRooms = [...addedRooms];
                                                                    newRooms[idx].roomName = e.target.value;
                                                                    setAddedRooms(newRooms);
                                                                }}
                                                            />
                                                        </div>

                                                        <div className={styles.roomInputGroup}>
                                                            <div className={styles.roomInputHeader}>
                                                                <label className={styles.roomInputLabel}>Room Option Text</label>
                                                                <span className={styles.roomPlaceholder}>
                                                                    {room.placeholderText}
                                                                </span>
                                                            </div>
                                                            <textarea
                                                                className={styles.roomTextarea}
                                                                value={room.textValue}
                                                                onChange={(e) => {
                                                                    const newRooms = [...addedRooms];
                                                                    newRooms[idx].textValue = e.target.value;
                                                                    setAddedRooms(newRooms);
                                                                }}
                                                                placeholder="Select options or type custom text..."
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Right Column: Options */}
                                                    <div className={styles.roomCardRight}>
                                                        <div className={styles.roomOptionsBox}>
                                                            <div className={styles.roomOptionsList}>
                                                                {template?.options.map(opt => (
                                                                    <label key={opt.id} className={styles.roomOptionItem}>
                                                                        <input
                                                                            type="checkbox"
                                                                            className={styles.roomCheckbox}
                                                                            checked={room.selectedOptions.includes(opt.label)}
                                                                            onChange={() => handleRoomOptionInfoToggle(idx, opt.value, opt.label)}
                                                                        />
                                                                        <span className={styles.roomOptionText}>{opt.label}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Footer Actions */}
                        <div className={styles.footer}>
                            <button className={styles.secondaryBtn} onClick={() => router.push('/dashboard')}>Cancel</button>
                            <button className={styles.primaryBtn} onClick={handleNext}>Next: Basic Info &rarr;</button>
                        </div>
                    </div>
                )
                }
            </div>
        </>
    );
}
