import { useEffect, useState } from 'react';
import styles from './CustomConfirm.module.css';

interface CustomConfirmProps {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function CustomConfirm({ message, onConfirm, onCancel }: CustomConfirmProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onCancel]);

    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.content}>
                    <p className={styles.message}>{message}</p>
                    <div className={styles.buttons}>
                        <button className={styles.cancelButton} onClick={onCancel}>
                            Cancel
                        </button>
                        <button className={styles.confirmButton} onClick={onConfirm}>
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Hook to use custom confirm
export function useCustomConfirm() {
    const [confirmState, setConfirmState] = useState<{
        message: string;
        resolver: ((value: boolean) => void) | null;
    } | null>(null);

    const showConfirm = (message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmState({ message, resolver: resolve });
        });
    };

    const handleConfirm = () => {
        if (confirmState?.resolver) {
            confirmState.resolver(true);
            setConfirmState(null);
        }
    };

    const handleCancel = () => {
        if (confirmState?.resolver) {
            confirmState.resolver(false);
            setConfirmState(null);
        }
    };

    const ConfirmComponent = confirmState ? (
        <CustomConfirm
            message={confirmState.message}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    ) : null;

    return { showConfirm, ConfirmComponent };
}
