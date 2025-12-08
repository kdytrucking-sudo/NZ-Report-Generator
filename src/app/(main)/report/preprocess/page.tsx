"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Report, getReport, initializeReportFromStructure, syncReportFields, ReportField, updateReport } from "@/lib/firestore-reports";
import { getPDFExtractPrompt } from "@/lib/firestore-ai";
import { getStaticInfo, StaticInformation } from "@/lib/firestore-static";
import { getMultiChoiceCards, MultiChoiceCard } from "@/lib/firestore-multi-choice";
import { formatDateForInput, formatDateForStorage } from "@/lib/date-utils";
import {
    getConstructSettings,
    getChattelsSettings,
    ConstructSettings,
    ChattelsSettings
} from "@/lib/firestore-construct-chattels";

import styles from "./page.module.css";

export default function PreprocessPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reportId = searchParams.get("id");

    const [user, setUser] = useState<any>(null);
    const [report, setReport] = useState<Report | null>(null);

    // Status State
    const [activeTab, setActiveTab] = useState<'ai-extract' | 'static-info' | 'swot' | 'construct-chattels' | 'market-value' | 'room-option'>('ai-extract');
    const [initDone, setInitDone] = useState(false);

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
            alert("Initialization failed.");
        }
    };

    const handleAIExtract = async () => {
        if (!report || !user) return;
        setIsExtracting(true);
        try {
            const promptSettings = await getPDFExtractPrompt(user.uid);
            if (!promptSettings) {
                alert("Please configure AI Prompt settings first in Settings > AI.");
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
            alert("AI Error: " + error.message);
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
                placeholder: item.placeholder,
                value: extractValues[idx],
                displayType: 'text',
                type: 'string',
                ifValidation: false
            };
        });

        const updatedReport = syncReportFields(report, sourceFields);

        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, { metadata, baseInfo, content });
            setReport(updatedReport);
            alert("Database updated successfully!");
        } catch (e) {
            console.error(e);
            alert("Failed to update database.");
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
                alert("No static information found. Please configure it in Settings.");
            }
        } catch (error) {
            console.error(error);
            alert("Failed to load static info.");
        } finally {
            setStaticLoading(false);
        }
    };

    const handleUpdateStaticToReport = async () => {
        if (!report || !user) return;

        const data = staticData as StaticInformation;
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
                    placeholder: m.placeholder,
                    value: val,
                    displayType: 'textarea',
                    type: 'string',
                    ifValidation: false
                };
            }
        });

        const updatedReport = syncReportFields(report, sourceFields);

        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, { metadata, baseInfo, content });
            setReport(updatedReport);
            alert("Static data updated to report!");
        } catch (e) {
            console.error(e);
            alert("Failed to update report with static data.");
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

    // Helper: Number to Words
    const numberToWords = (num: number): string => {
        const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
        const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

        const numToText = (n: number): string => {
            if ((n = n.toString().length > 9 ? parseFloat(n.toString().slice(0, 9)) : n) === 0) return '';
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[n % 10];
            if (n < 1000) return a[Math.floor(n / 100)] + 'hundred ' + numToText(n % 100);
            if (n < 1000000) return numToText(Math.floor(n / 1000)) + 'thousand ' + numToText(n % 1000);
            if (n < 1000000000) return numToText(Math.floor(n / 1000000)) + 'million ' + numToText(n % 1000000);
            return '';
        }

        if (num === 0) return 'zero';
        let str = numToText(num);
        return str.trim().replace(/\s+/g, ' ').replace(/^./, c => c.toUpperCase());
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
        const text = numberToWords(num) + " Dollars";

        setMvFormatted(fmt);
        setMvNarrative(text);
    };

    const handleBdSum = () => {
        const imp = parseNumber(bdImprovements) || 0;
        const land = parseNumber(bdLand) || 0;
        const chat = parseNumber(bdChattels) || 0;

        const sum = imp + land + chat;
        setBdTotal(formatCurrency(sum));

        const mvNum = parseNumber(mvInput) || 0;
        setBdMatch(Math.abs(sum - mvNum) < 1 ? 'equal' : 'error');
    };

    const handleCopyOpenAddress = () => {
        const address = report?.baseInfo?.fields?.['address']?.value || "7/20 William Souter Street, Forrest Hill, Auckland";
        navigator.clipboard.writeText(address);
        window.open("https://www.aucklandcouncil.govt.nz/en/property-rates-valuations/find-property-rates-valuation.html", "_blank");
    };

    const handleUpdateMarketValueToReport = async () => {
        if (!report || !user) return;

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
            await updateReport(user.uid, report.id, { metadata, baseInfo, content });
            setReport(updatedReport);
            alert("Market Value data updated to report successfully!");
        } catch (e) {
            console.error(e);
            alert("Failed to update report with Market Value data.");
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
            alert("Failed to load Construct/Chattels data.");
        } finally {
            setCcLoading(false);
        }
    };

    const generateConstructText = (cIds: string[], iIds: string[], cSettings: ConstructSettings | null) => {
        if (!cSettings) return "";
        let text = "";
        if (cIds.length > 0) {
            const labels = cSettings.elements.filter(e => cIds.includes(e.id)).map(e => e.label);
            if (labels.length > 0) text += "General construction elements comprise what appears to be " + labels.join(", ") + ".";
        }
        if (iIds.length > 0) {
            const labels = cSettings.interiorElements.filter(e => iIds.includes(e.id)).map(e => e.label);
            if (labels.length > 0) {
                if (text) text += "\n";
                text += "The interior appears to be mostly timber framed with " + labels.join(", ") + ".";
            }
        }
        return text;
    };

    const generateChattelsText = (chIds: string[], chSettings: ChattelsSettings | null) => {
        if (!chSettings) return "";
        if (chIds.length > 0) {
            const labels = chSettings.list.filter(e => chIds.includes(e.id)).map(e => e.label);
            if (labels.length > 0) return "We have included in our valuation an allowance for " + labels.join(", ") + ".";
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
            sourceFields[targetId] = { id: targetId, label: 'Construct Description', placeholder: constructData.replaceholder, value: constructText, displayType: 'textarea', type: 'string', ifValidation: false };
        }
        if (chattelsData.replaceholder) {
            const targetId = findFieldId(chattelsData.replaceholder) || 'chattels_desc';
            sourceFields[targetId] = { id: targetId, label: 'Chattels Description', placeholder: chattelsData.replaceholder, value: chattelsText, displayType: 'textarea', type: 'string', ifValidation: false };
        }

        const updatedReport = syncReportFields(report, sourceFields);
        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, { metadata, baseInfo, content });
            setReport(updatedReport);
            alert("Construct/Chattels data updated to report!");
        } catch (e) {
            console.error(e);
            alert("Failed to update report with CC data.");
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
            alert("Failed to load SWOT data.");
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
                sourceFields[`swot_${idx}`] = { id: `swot_${idx}`, label: card.name, placeholder: card.placeholder, value: selection.textValue, displayType: 'textarea', type: 'string', ifValidation: false };
            }
        });
        const updatedReport = syncReportFields(report, sourceFields);
        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, { metadata, baseInfo, content });
            setReport(updatedReport);
            alert("SWOT data updated to report!");
        } catch (e) {
            console.error(e);
            alert("Failed to update report with SWOT data.");
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
            alert("Failed to load Room Settings.");
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

        const sourceFields: { [key: string]: ReportField } = {};

        addedRooms.forEach(room => {
            if (room.placeholderName) {
                sourceFields[room.placeholderName] = { id: room.placeholderName, label: 'Room Name', placeholder: room.placeholderName, value: room.roomName, displayType: 'text', type: 'string', ifValidation: false };
            }
            if (room.placeholderText) {
                sourceFields[room.placeholderText] = { id: room.placeholderText, label: 'Room Text', placeholder: room.placeholderText, value: room.textValue, displayType: 'text', type: 'string', ifValidation: false };
            }
        });

        const updatedReport = syncReportFields(report, sourceFields);

        try {
            const { metadata, baseInfo, content } = updatedReport;
            await updateReport(user.uid, report.id, { metadata, baseInfo, content });
            setReport(updatedReport);
            alert("Room Options updated to report!");
        } catch (e) {
            console.error(e);
            alert("Failed to update report with Room Options.");
        }
    };

    const handleNext = () => {
        if (!report) return;
        router.push(`/report/meta?id=${report.id}`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Data Pre-processing</h1>
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
                >
                    Static Info
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
                                <div className={styles.fileItem}>
                                    <strong>Title:</strong> {report.files.title?.name || "N/A"}
                                </div>
                                <div className={styles.fileItem}>
                                    <strong>Brief:</strong> {report.files.brief?.name || "N/A"}
                                </div>
                                <div style={{ marginTop: 'auto' }}>
                                    <p className="text-xs text-gray-500 mb-2">
                                        AI will read these PDF/Doc files to extract data based on your "PDF Extract" Settings.
                                    </p>
                                    <button className={styles.extractBtn} onClick={handleAIExtract} disabled={isExtracting}>
                                        {isExtracting ? "Extracting..." : "AI Extract Data"}
                                    </button>
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
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className={styles.editorTable}>
                                            <thead>
                                                <tr>
                                                    <th>Label</th>
                                                    <th>Placeholder</th>
                                                    <th style={{ minWidth: '200px' }}>Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {extractedData.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td style={{ verticalAlign: 'top', paddingTop: '0.75rem' }}>{row.label}</td>
                                                        <td className="font-mono text-xs text-blue-600" style={{ verticalAlign: 'top', paddingTop: '0.75rem' }}>{row.placeholder}</td>
                                                        <td>
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
                                            <input
                                                className={styles.marketValueInput}
                                                placeholder="550,000"
                                                value={statRating}
                                                onChange={(e) => setStatRating(e.target.value)}
                                            />
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
                                                            readOnly
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
                        <button className={styles.primaryBtn} onClick={handleNext}>Next: Meta Info &rarr;</button>
                    </div>
                </div>
            )
            }
        </div >
    );
}
