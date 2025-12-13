"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getMultiChoiceCards, saveMultiChoiceCard, deleteMultiChoiceCard, MultiChoiceCard, MultiChoiceOption } from "@/lib/firestore-multi-choice";
import { useCustomConfirm } from "@/components/CustomConfirm";
import styles from "./page.module.css";
import { useCustomAlert } from "@/components/CustomAlert";

// Helper component for SVG icons
const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.5 5H17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.66663 5.00001V3.33334C6.66663 2.89131 6.84222 2.46741 7.1548 2.15483C7.46738 1.84225 7.89128 1.66667 8.33329 1.66667H11.6666C12.1086 1.66667 12.5325 1.84225 12.8451 2.15483C13.1577 2.46741 13.3333 2.89131 13.3333 3.33334V5.00001M15.8333 5.00001V16.6667C15.8333 17.1087 15.6577 17.5326 15.3451 17.8452C15.0325 18.1578 14.6086 18.3333 14.1666 18.3333H5.83329C5.39126 18.3333 4.96736 18.1578 4.65478 17.8452C4.3422 17.5326 4.16663 17.1087 4.16663 16.6667V5.00001H15.8333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 3.33334V12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.33337 8H12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function MultiChoiceSettingsPage() {
    const { showConfirm, ConfirmComponent } = useCustomConfirm();
    const { showAlert, AlertComponent } = useCustomAlert();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<MultiChoiceCard[]>([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                loadCards(currentUser.uid);
            } else {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [router]);

    const loadCards = async (uid: string) => {
        setLoading(true);
        const data = await getMultiChoiceCards(uid);
        setCards(data);
        setLoading(false);
    };

    const handleAddCard = () => {
        const newCard: MultiChoiceCard = {
            id: "", // Will be generated on save
            uid: user.uid,
            name: "New Category",
            placeholder: "[Replace_Placeholder]",
            options: [
                { id: '1', label: '', value: '' },
                { id: '2', label: '', value: '' },
                { id: '3', label: '', value: '' }
            ]
        };
        setCards([...cards, newCard]);
    };

    const handleDeleteCard = async (index: number) => {
        const card = cards[index];
        const confirmed = await showConfirm("Are you sure you want to delete this entire card?");
        if (confirmed) {
            if (card.id) {
                await deleteMultiChoiceCard(user.uid, card.id);
            }
            const newCards = [...cards];
            newCards.splice(index, 1);
            setCards(newCards);
        }
    };

    const handleCardChange = (index: number, field: keyof MultiChoiceCard, value: any) => {
        const newCards = [...cards];
        newCards[index] = { ...newCards[index], [field]: value };
        setCards(newCards);
    };

    const handleSaveCard = async (index: number) => {
        const card = cards[index];
        if (!card.name.trim()) {
            showAlert("Card Name is required.");
            return;
        }
        try {
            const newId = await saveMultiChoiceCard(user.uid, card);
            if (newId) {
                const newCards = [...cards];
                newCards[index].id = newId;
                setCards(newCards);
                showAlert("Card saved successfully!");
            }
        } catch (e) {
            console.error(e);
            showAlert("Failed to save card.");
        }
    };

    // Option Handlers
    const handleAddOption = (cardIndex: number) => {
        const newCards = [...cards];
        const newOption: MultiChoiceOption = {
            id: Date.now().toString(),
            label: "",
            value: ""
        };
        newCards[cardIndex].options.push(newOption);
        setCards(newCards);
    };

    const handleDeleteOption = (cardIndex: number, optionIndex: number) => {
        const newCards = [...cards];
        newCards[cardIndex].options.splice(optionIndex, 1);
        setCards(newCards);
    };

    const handleOptionChange = (cardIndex: number, optionIndex: number, field: keyof MultiChoiceOption, value: string) => {
        const newCards = [...cards];
        newCards[cardIndex].options[optionIndex] = { ...newCards[cardIndex].options[optionIndex], [field]: value };
        setCards(newCards);
    };

    if (loading && !user) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    return (
        <>
            {AlertComponent}
            {ConfirmComponent}
            <div className={styles.container}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Manage Multi-Select Options</h1>
                        <p className={styles.description}>Create and manage preset multi-select options for report generation.</p>
                    </div>
                    <button className={styles.addCardBtn} onClick={handleAddCard}>
                        <PlusIcon />
                        Add New Card
                    </button>
                </div>

                <div className={styles.cardList}>
                    {cards.map((card, cardIndex) => (
                        <div key={card.id || `temp-${cardIndex}`} className={styles.card}>

                            {/* Header Section */}
                            <div className={styles.cardHeader}>
                                <div className={styles.field}>
                                    <label className={styles.label}>Card Name</label>
                                    <input
                                        className={styles.input}
                                        value={card.name}
                                        onChange={(e) => handleCardChange(cardIndex, "name", e.target.value)}
                                        placeholder="e.g. Strengths/Opportunities"
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label className={styles.label}>Placeholder</label>
                                    <input
                                        className={styles.input}
                                        value={card.placeholder}
                                        onChange={(e) => handleCardChange(cardIndex, "placeholder", e.target.value)}
                                        placeholder="[Replace_Placeholder]"
                                    />
                                </div>

                                <button
                                    className={styles.deleteCardBtn}
                                    onClick={() => handleDeleteCard(cardIndex)}
                                    title="Delete Card"
                                >
                                    <TrashIcon />
                                </button>
                            </div>

                            {/* Body Section: 2 Columns */}
                            <div className={styles.cardBody}>
                                <div className={styles.columnsContainer}>
                                    {/* Left Column: Labels */}
                                    <div className={styles.column}>
                                        <div className={styles.columnHeader}>Label</div>
                                        <div className={styles.inputStack}>
                                            {card.options.map((option, optionIndex) => (
                                                <input
                                                    key={`lbl-${option.id}-${optionIndex}`}
                                                    className={styles.input}
                                                    style={{ paddingRight: '0.875rem' }} // Labels don't have delete icon
                                                    value={option.label}
                                                    onChange={(e) => handleOptionChange(cardIndex, optionIndex, "label", e.target.value)}
                                                    placeholder="Label"
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right Column: Option Texts */}
                                    <div className={`${styles.column} ${styles.columnRight}`}>
                                        <div className={styles.columnHeader}>Option Text</div>
                                        <div className={styles.inputStack}>
                                            {card.options.map((option, optionIndex) => (
                                                <div key={`val-${option.id}-${optionIndex}`} className={styles.optionRightRow}>
                                                    <input
                                                        className={styles.input}
                                                        value={option.value}
                                                        onChange={(e) => handleOptionChange(cardIndex, optionIndex, "value", e.target.value)}
                                                        placeholder="Option text..."
                                                    />
                                                    <button
                                                        className={styles.deleteRowBtn}
                                                        onClick={() => handleDeleteOption(cardIndex, optionIndex)}
                                                        title="Delete Option"
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Section */}
                            <div className={styles.cardFooter}>
                                <button className={styles.addOptionBtn} onClick={() => handleAddOption(cardIndex)}>
                                    <PlusIcon />
                                    Add Option
                                </button>

                                <button
                                    className={styles.saveCardBtn}
                                    onClick={() => handleSaveCard(cardIndex)}
                                >
                                    Save Card
                                </button>
                            </div>
                        </div>
                    ))}

                    {cards.length === 0 && !loading && (
                        <div className="text-center p-8 text-gray-500 border dashed border-gray-300 rounded-lg">
                            No cards found. Click "Add New Card" to get started.
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}
