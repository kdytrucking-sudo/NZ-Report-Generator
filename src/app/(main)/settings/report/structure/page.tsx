"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
    getStructure,
    saveMetaStructure,
    saveBasicStructure,
    saveContentStructure,
    StructureField,
    ContentSection
} from "@/lib/firestore-report-structure";

type Tab = "meta" | "basic" | "content";

const EMPTY_FIELD: StructureField = {
    id: "",
    label: "",
    placeholder: "",
    displayType: "text",
    ifValidation: false,
    type: "string"
};

export default function ReportStructureSettings() {
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<Tab>("meta");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // State for each section
    const [metaFields, setMetaFields] = useState<StructureField[]>([]);
    const [basicFields, setBasicFields] = useState<StructureField[]>([]);
    const [contentSections, setContentSections] = useState<ContentSection[]>([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const data = await getStructure(currentUser.uid);
                if (data) {
                    setMetaFields(data.meta);
                    setBasicFields(data.basicInfo);
                    setContentSections(data.content);
                }
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            if (activeTab === "meta") {
                await saveMetaStructure(user.uid, metaFields);
            } else if (activeTab === "basic") {
                await saveBasicStructure(user.uid, basicFields);
            } else if (activeTab === "content") {
                await saveContentStructure(user.uid, contentSections);
            }
            alert("Structure saved successfully!");
        } catch (error) {
            console.error(error);
            alert("Failed to save structure.");
        } finally {
            setSaving(false);
        }
    };

    // --- Field Editors ---

    const updateField = (
        list: StructureField[],
        setList: (l: StructureField[]) => void,
        index: number,
        key: keyof StructureField,
        value: any
    ) => {
        const newList = [...list];
        newList[index] = { ...newList[index], [key]: value };
        setList(newList);
    };

    const addField = (list: StructureField[], setList: (l: StructureField[]) => void) => {
        const newId = `field_${Date.now()}`;
        setList([...list, { ...EMPTY_FIELD, id: newId }]);
    };

    const removeField = (list: StructureField[], setList: (l: StructureField[]) => void, index: number) => {
        if (!confirm("Delete this field?")) return;
        const newList = list.filter((_, i) => i !== index);
        setList(newList);
    };

    // --- Content Section Editors ---

    const addSection = () => {
        const newId = `section_${Date.now()}`;
        setContentSections([...contentSections, { id: newId, title: "New Section", fields: [] }]);
    };

    const removeSection = (index: number) => {
        if (!confirm("Delete this entire section?")) return;
        const newList = contentSections.filter((_, i) => i !== index);
        setContentSections(newList);
    };

    const updateSectionTitle = (index: number, title: string) => {
        const newList = [...contentSections];
        newList[index].title = title;
        setContentSections(newList);
    };

    const updateSectionField = (sectionIndex: number, fieldIndex: number, key: keyof StructureField, value: any) => {
        const newSections = [...contentSections];
        const section = newSections[sectionIndex];
        const newFields = [...section.fields];
        newFields[fieldIndex] = { ...newFields[fieldIndex], [key]: value };
        section.fields = newFields;
        setContentSections(newSections);
    };

    const addSectionField = (sectionIndex: number) => {
        const newSections = [...contentSections];
        const newId = `field_${Date.now()}`;
        newSections[sectionIndex].fields.push({ ...EMPTY_FIELD, id: newId });
        setContentSections(newSections);
    };

    const removeSectionField = (sectionIndex: number, fieldIndex: number) => {
        if (!confirm("Delete this field?")) return;
        const newSections = [...contentSections];
        newSections[sectionIndex].fields = newSections[sectionIndex].fields.filter((_, i) => i !== fieldIndex);
        setContentSections(newSections);
    };

    // --- Render Helpers ---

    const renderFieldRow = (
        field: StructureField,
        index: number,
        onChange: (k: keyof StructureField, v: any) => void,
        onDelete: () => void
    ) => (
        <div key={field.id || index} className={styles.fieldRow}>
            <input
                className={styles.input}
                value={field.label}
                placeholder="Label"
                onChange={(e) => onChange("label", e.target.value)}
            />
            <input
                className={styles.input}
                value={field.placeholder}
                placeholder="Placeholder"
                onChange={(e) => onChange("placeholder", e.target.value)}
            />
            <input
                className={styles.input}
                value={field.defaultValue || ""}
                placeholder="Default"
                onChange={(e) => onChange("defaultValue", e.target.value)}
            />
            <select
                className={styles.select}
                value={field.displayType}
                onChange={(e) => onChange("displayType", e.target.value as any)}
            >
                <option value="text">Text</option>
                <option value="textarea">Textarea</option>
                <option value="date">Date</option>
                <option value="number">Number</option>
                <option value="select">Select</option>
                <option value="checkbox">Checkbox</option>
            </select>
            <select
                className={styles.select}
                value={field.type}
                onChange={(e) => onChange("type", e.target.value as any)}
            >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
            </select>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={field.ifValidation}
                    onChange={(e) => onChange("ifValidation", e.target.checked)}
                />
            </div>
            <div className={styles.actions}>
                <button className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={onDelete}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>
    );

    const renderHeaderRow = () => (
        <div className={styles.fieldRowHeader}>
            <div>Label</div>
            <div>Placeholder</div>
            <div>Default Value</div>
            <div>Display</div>
            <div>Type</div>
            <div style={{ textAlign: 'center' }}>Required</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
        </div>
    );

    if (loading) return <div className="p-8">Loading structure...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Report Structure Settings</h1>
                <p className={styles.subtitle}>Define the fields and sections for your reports.</p>
            </div>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tabBtn} ${activeTab === "meta" ? styles.activeTab : ""}`}
                    onClick={() => setActiveTab("meta")}
                >
                    Meta Information
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === "basic" ? styles.activeTab : ""}`}
                    onClick={() => setActiveTab("basic")}
                >
                    Basic Information
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === "content" ? styles.activeTab : ""}`}
                    onClick={() => setActiveTab("content")}
                >
                    Report Content
                </button>
            </div>

            <div className={styles.fieldsContainer}>
                {activeTab === "meta" && (
                    <div className={styles.sectionCard}>
                        {renderHeaderRow()}
                        {metaFields.map((field, index) =>
                            renderFieldRow(
                                field,
                                index,
                                (k, v) => updateField(metaFields, setMetaFields, index, k, v),
                                () => removeField(metaFields, setMetaFields, index)
                            )
                        )}
                        <div className="p-4">
                            <button className={styles.addBtn} onClick={() => addField(metaFields, setMetaFields)}>
                                + Add Meta Field
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "basic" && (
                    <div className={styles.sectionCard}>
                        {renderHeaderRow()}
                        {basicFields.map((field, index) =>
                            renderFieldRow(
                                field,
                                index,
                                (k, v) => updateField(basicFields, setBasicFields, index, k, v),
                                () => removeField(basicFields, setBasicFields, index)
                            )
                        )}
                        <div className="p-4">
                            <button className={styles.addBtn} onClick={() => addField(basicFields, setBasicFields)}>
                                + Add Basic Field
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "content" && (
                    <div className="flex flex-col gap-6">
                        <div className={styles.toolbar}>
                            <button className={styles.addBtn} onClick={addSection}>
                                + Add New Section
                            </button>
                        </div>

                        {contentSections.map((section, sIndex) => (
                            <div key={section.id} className={styles.sectionCard}>
                                <div className={styles.sectionHeader}>
                                    <div className="flex items-center gap-2 flex-grow">
                                        <input
                                            className={`${styles.input} font-bold`}
                                            style={{ width: '300px' }}
                                            value={section.title}
                                            onChange={(e) => updateSectionTitle(sIndex, e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.sectionToolbar}>
                                        <button className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={() => removeSection(sIndex)}>
                                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                                {renderHeaderRow()}
                                {section.fields.map((field, fIndex) =>
                                    renderFieldRow(
                                        field,
                                        fIndex,
                                        (k, v) => updateSectionField(sIndex, fIndex, k, v),
                                        () => removeSectionField(sIndex, fIndex)
                                    )
                                )}
                                <div className="p-4">
                                    <button className={styles.addBtn} onClick={() => addSectionField(sIndex)}>
                                        + Add Field to {section.title}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
            </button>
        </div>
    );
}
