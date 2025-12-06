import { db } from "./firebase";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";

// --- Types ---

export interface StructureField {
    id: string; // Key used in data objects (e.g., 'address', 'price')
    label: string;
    placeholder: string;
    displayType: "text" | "textarea" | "date" | "number" | "select" | "checkbox";
    ifValidation: boolean;
    type: "string" | "number" | "boolean";
    defaultValue?: any;
    options?: string[];
}

export interface ContentSection {
    id: string;
    title: string;
    fields: StructureField[];
}

const BASE_COLLECTION = "report_structures"; // Collection under users/{uid}

// --- Defaults ---

export const DEFAULT_META_FIELDS: StructureField[] = [
    { id: "address", label: "Address", placeholder: "Full Property Address", displayType: "text", ifValidation: true, type: "string", defaultValue: "" },
    { id: "contactName", label: "Contact Name", placeholder: "Name", displayType: "text", ifValidation: false, type: "string", defaultValue: "" },
    { id: "contactPhone", label: "Contact Phone", placeholder: "Phone", displayType: "text", ifValidation: false, type: "string", defaultValue: "" },
    { id: "contactEmail", label: "Contact Email", placeholder: "Email", displayType: "text", ifValidation: false, type: "string", defaultValue: "" },
    { id: "price", label: "Price", placeholder: "0.00", displayType: "number", ifValidation: false, type: "number", defaultValue: 0 },
    { id: "isPaid", label: "Is Paid", placeholder: "", displayType: "checkbox", ifValidation: false, type: "boolean", defaultValue: false },
    { id: "jobNumber", label: "Job Number", placeholder: "Job #", displayType: "text", ifValidation: false, type: "string", defaultValue: "" },
    { id: "splitRatio", label: "Split Ratio", placeholder: "100", displayType: "number", ifValidation: false, type: "number", defaultValue: 0 },
    { id: "primaryValuer", label: "Primary Valuer", placeholder: "Valuer Name", displayType: "text", ifValidation: false, type: "string", defaultValue: "" },
];

export const DEFAULT_BASIC_FIELDS: StructureField[] = [
    { id: "singleLineAddress", label: "Address", placeholder: "Full Property Address", displayType: "text", ifValidation: false, type: "string", defaultValue: "" },
    { id: "multiLineAddress", label: "Address (Multi-line)", placeholder: "Line 1...", displayType: "textarea", ifValidation: false, type: "string", defaultValue: "" },
    { id: "instructedBy", label: "Instructed By", placeholder: "Instructor Name", displayType: "text", ifValidation: false, type: "string", defaultValue: "" },
    { id: "jobNo", label: "Job No", placeholder: "Job Number", displayType: "text", ifValidation: false, type: "string", defaultValue: "" },
    { id: "preparedFor", label: "Prepared For", placeholder: "Client Name", displayType: "text", ifValidation: false, type: "string", defaultValue: "" },
    { id: "clientBorrower", label: "Client/Borrower", placeholder: "Borrower Name", displayType: "text", ifValidation: false, type: "string", defaultValue: "" },
    { id: "valuationDate", label: "Date of Valuation", placeholder: "Select date", displayType: "date", ifValidation: false, type: "string", defaultValue: "" },
];

export const DEFAULT_CONTENT_SECTIONS: ContentSection[] = [
    {
        id: "section1",
        title: "Special Assumptions",
        fields: [
            { id: "specialAssumptions", label: "Special Assumptions", placeholder: "Enter special assumptions...", displayType: "textarea", ifValidation: false, type: "string" }
        ]
    },
    {
        id: "section2",
        title: "Property Description",
        fields: [
            { id: "titleOwner", label: "Title Owner", placeholder: "Owner Name", displayType: "text", ifValidation: false, type: "string" },
            { id: "propertyDescription", label: "Property Description", placeholder: "Describe property...", displayType: "textarea", ifValidation: false, type: "string" }
        ]
    },
    {
        id: "section3",
        title: "General Description",
        fields: [
            { id: "generalDescription", label: "General Description", placeholder: "General description...", displayType: "textarea", ifValidation: false, type: "string" }
        ]
    }
];

// --- Functions ---

export const getStructure = async (uid: string) => {
    if (!uid) return null;

    // Fetch Meta
    const metaRef = doc(db, "users", uid, BASE_COLLECTION, "meta");
    const metaSnap = await getDoc(metaRef);
    const metaData = metaSnap.exists() ? (metaSnap.data() as { fields: StructureField[] }) : null;

    // Fetch Basic Info
    const basicRef = doc(db, "users", uid, BASE_COLLECTION, "basic_info");
    const basicSnap = await getDoc(basicRef);
    const basicData = basicSnap.exists() ? (basicSnap.data() as { fields: StructureField[] }) : null;

    // Fetch Content
    const contentRef = doc(db, "users", uid, BASE_COLLECTION, "content");
    const contentSnap = await getDoc(contentRef);
    const contentData = contentSnap.exists() ? (contentSnap.data() as { sections: ContentSection[] }) : null;

    // Return merged structure or defaults if missing
    return {
        meta: metaData ? metaData.fields : DEFAULT_META_FIELDS,
        basicInfo: basicData ? basicData.fields : DEFAULT_BASIC_FIELDS,
        content: contentData ? contentData.sections : DEFAULT_CONTENT_SECTIONS
    };
};

export const saveMetaStructure = async (uid: string, fields: StructureField[]) => {
    const ref = doc(db, "users", uid, BASE_COLLECTION, "meta");
    await setDoc(ref, { fields });
};

export const saveBasicStructure = async (uid: string, fields: StructureField[]) => {
    const ref = doc(db, "users", uid, BASE_COLLECTION, "basic_info");
    await setDoc(ref, { fields });
};

export const saveContentStructure = async (uid: string, sections: ContentSection[]) => {
    const ref = doc(db, "users", uid, BASE_COLLECTION, "content");
    await setDoc(ref, { sections });
};
