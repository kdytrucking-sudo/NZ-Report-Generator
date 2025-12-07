import { db } from "./firebase";
import { collection, doc, setDoc, getDocs, getDoc, deleteDoc, Timestamp, query, orderBy, UpdateData } from "firebase/firestore";
import { getStructure, StructureField, ContentSection } from "./firestore-report-structure";

// --- Types ---

// Re-using StructureField but assuming 'value' is populated in Report instances
export interface ReportField extends StructureField {
    value: any;
}

export interface ReportContentSection {
    id: string;
    title: string;
    fields: { [key: string]: ReportField }; // Keyed by field ID
    fieldOrder?: string[];
}

export interface ReportFile {
    name: string;
    path: string;
    url: string;
    type: "brief" | "title";
    uploadedAt: number;
}

export interface Report {
    id: string;
    // We use a flexible dictionary for meta/basic because the keys are dynamic based on structure
    metadata: {
        [key: string]: any; // System fields (uid, status, etc)
        fields: { [key: string]: ReportField }; // Dynamic fields
        fieldOrder?: string[];
    };
    baseInfo: {
        fields: { [key: string]: ReportField };
        fieldOrder?: string[];
    };
    content: {
        [sectionId: string]: ReportContentSection
    };
    contentOrder?: string[];
    files: {
        brief?: ReportFile;
        title?: ReportFile;
    };
}

// --- Helpers ---

const mapStructureToReportFields = (structureFields: StructureField[]): { [key: string]: ReportField } => {
    const fields: { [key: string]: ReportField } = {};
    structureFields.forEach(sf => {
        fields[sf.id] = {
            ...sf,
            value: sf.defaultValue !== undefined ? sf.defaultValue : ""
        };
    });
    return fields;
};

const mapContentSectionsToReport = (sections: ContentSection[]): { [sectionId: string]: ReportContentSection } => {
    const reportSections: { [sectionId: string]: ReportContentSection } = {};
    sections.forEach(sec => {
        reportSections[sec.id] = {
            id: sec.id,
            title: sec.title,
            fields: mapStructureToReportFields(sec.fields),
            fieldOrder: sec.fields.map(f => f.id)
        };
    });
    return reportSections;
};

const generateReportId = (address: string) => {
    const sanitizedAddress = (address || "untitled").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const timestamp = Date.now();
    return `${sanitizedAddress}-${timestamp}`;
};

// --- Firestore Functions ---

const COLLECTION_NAME = "reports";

export const createReportShell = async (
    uid: string,
    address: string,
    files: { brief?: ReportFile, title?: ReportFile }
): Promise<Report> => {
    const reportId = generateReportId(address);
    const createdAt = Timestamp.now();

    const shellReport: any = {
        id: reportId,
        metadata: {
            uid,
            createdAt,
            status: "initializing",
            fields: { // Inject address if possible into a temp field or just rely on ID
                address: { id: 'address', value: address, label: 'Address', displayType: 'text', type: 'string', placeholder: '[Replace_Address]' }
            },
            fieldOrder: ['address']
        },
        baseInfo: { fields: {}, fieldOrder: [] },
        content: {},
        contentOrder: [],
        files: files
    };

    const docRef = doc(db, "users", uid, COLLECTION_NAME, reportId);
    await setDoc(docRef, shellReport);
    return shellReport as Report;
};

export const initializeReportFromStructure = async (uid: string, reportId: string): Promise<Report> => {
    const structure = await getStructure(uid);
    if (!structure) throw new Error("Structure not found");

    const existingReport = await getReport(uid, reportId);
    if (!existingReport) throw new Error("Report not found");

    const metadataFields = mapStructureToReportFields(structure.meta);
    const basicInfoFields = mapStructureToReportFields(structure.basicInfo);
    const contentSections = mapContentSectionsToReport(structure.content);

    const metadataOrder = structure.meta.map(f => f.id);
    const basicInfoOrder = structure.basicInfo.map(f => f.id);
    const contentOrder = structure.content.map(s => s.id);

    // Preserve the address if we stored it in the shell (we did above)
    const shellAddress = existingReport.metadata?.fields?.['address']?.value;
    if (shellAddress && metadataFields['address']) {
        metadataFields['address'].value = shellAddress;
    }
    if (shellAddress && basicInfoFields['singleLineAddress']) {
        basicInfoFields['singleLineAddress'].value = shellAddress;
    }

    const updatedData = {
        metadata: {
            ...existingReport.metadata,
            status: "draft",
            fields: metadataFields,
            fieldOrder: metadataOrder
        },
        baseInfo: {
            fields: basicInfoFields,
            fieldOrder: basicInfoOrder
        },
        content: contentSections,
        contentOrder: contentOrder
    };

    await updateReport(uid, reportId, updatedData);

    // Return full merged object
    return { ...existingReport, ...updatedData } as Report;
};

export const createReportFromStructure = async (
    uid: string,
    address: string,
    files: { brief?: ReportFile, title?: ReportFile }
): Promise<Report> => {
    // 1. Get User's Structure (or defaults)
    const structure = await getStructure(uid);
    if (!structure) throw new Error("Could not load report structure");

    // 2. Generate ID
    const reportId = generateReportId(address);
    const createdAt = Timestamp.now();

    // 3. Map Structure to Instance
    const metadataFields = mapStructureToReportFields(structure.meta);
    const basicInfoFields = mapStructureToReportFields(structure.basicInfo);
    const contentSections = mapContentSectionsToReport(structure.content);

    const metadataOrder = structure.meta.map(f => f.id);
    const basicInfoOrder = structure.basicInfo.map(f => f.id);
    const contentOrder = structure.content.map(s => s.id);

    // 4. Inject Initial Values (Address if it exists in fields)
    if (metadataFields['address']) {
        metadataFields['address'].value = address;
    }
    if (basicInfoFields['singleLineAddress']) {
        basicInfoFields['singleLineAddress'].value = address;
    }

    // 5. Construct Report Object
    const newReport: Report = {
        id: reportId,
        metadata: {
            uid,
            createdAt,
            status: "draft",
            fields: metadataFields,
            fieldOrder: metadataOrder
        },
        baseInfo: {
            fields: basicInfoFields,
            fieldOrder: basicInfoOrder
        },
        content: contentSections,
        contentOrder: contentOrder,
        files: files
    };

    // 6. Save to Firestore
    const docRef = doc(db, "users", uid, COLLECTION_NAME, reportId);
    await setDoc(docRef, newReport);

    return newReport;
};

export const getReport = async (uid: string, reportId: string): Promise<Report | null> => {
    const docRef = doc(db, "users", uid, COLLECTION_NAME, reportId);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as Report) : null;
};

export const updateReport = async (uid: string, reportId: string, data: Partial<Report> | any) => {
    const docRef = doc(db, "users", uid, COLLECTION_NAME, reportId);
    await setDoc(docRef, data, { merge: true });
};

export const getUserReports = async (uid: string) => {
    const colRef = collection(db, "users", uid, COLLECTION_NAME);
    const q = query(colRef, orderBy("metadata.createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as Report);
};

// Sample creation using the new logic
export const createSampleReport = async (uid: string) => {
    return createReportFromStructure(uid, "123 Queen Street, Sample", {});
};

export const deleteReport = async (uid: string, reportId: string) => {
    const docRef = doc(db, "users", uid, COLLECTION_NAME, reportId);
    await deleteDoc(docRef);
};

// --- Synchronization Helper ---

export const syncReportFields = (report: Report, sourceFields: { [key: string]: ReportField }): Report => {
    const newReport = JSON.parse(JSON.stringify(report)); // Deep copy simple way
    const sourcePlaceholders: { [placeholder: string]: any } = {};

    // 1. Collect values from source fields keyed by placeholder
    Object.values(sourceFields).forEach(field => {
        if (field.placeholder && field.placeholder.trim() !== "") {
            sourcePlaceholders[field.placeholder] = field.value;
        }
    });

    if (Object.keys(sourcePlaceholders).length === 0) return newReport;

    // Helper to update a field map
    const updateFieldMap = (fields: { [key: string]: ReportField }) => {
        Object.keys(fields).forEach(key => {
            const field = fields[key];
            if (field.placeholder && sourcePlaceholders.hasOwnProperty(field.placeholder)) {
                // Update value if different
                // Compare loose equality or strict? Values can be arrays (checkbox). JSON stringify is safer for comparison.
                if (JSON.stringify(field.value) !== JSON.stringify(sourcePlaceholders[field.placeholder])) {
                    field.value = sourcePlaceholders[field.placeholder];
                }
            }
        });
    };

    // 2. Update Metadata
    if (newReport.metadata && newReport.metadata.fields) {
        updateFieldMap(newReport.metadata.fields);
    }

    // 3. Update Basic Info
    if (newReport.baseInfo && newReport.baseInfo.fields) {
        updateFieldMap(newReport.baseInfo.fields);
    }

    // 4. Update All Content Sections
    if (newReport.content) {
        Object.values(newReport.content).forEach((section: any) => {
            if (section.fields) {
                updateFieldMap(section.fields);
            }
        });
    }

    return newReport;
};
