import { useEffect, useState } from 'react';
import styles from './CustomAlert.module.css';

interface CustomAlertProps {
    message: string;
    onClose: () => void;
}

export function CustomAlert({ message, onClose }: CustomAlertProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.content}>
                    <p className={styles.message}>{message}</p>
                    <button className={styles.button} onClick={onClose}>
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}

// Hook to use custom alert
export function useCustomAlert() {
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    const showAlert = (message: string) => {
        setAlertMessage(message);
    };

    const closeAlert = () => {
        setAlertMessage(null);
    };

    const AlertComponent = alertMessage ? (
        <CustomAlert message={alertMessage} onClose={closeAlert} />
    ) : null;

    return { showAlert, AlertComponent };
}
