
export const formatDateForInput = (dateString: string): string => {
    if (!dateString) return "";

    // Check if valid date
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    // Return YYYY-MM-DD
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export const formatDateForStorage = (isoDateString: string): string => {
    if (!isoDateString) return "";

    // Expecting YYYY-MM-DD from input, or already formatted string?
    // If input is from type="date", it is YYYY-MM-DD
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return isoDateString; // Fallback

    return date.toLocaleDateString('en-NZ', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};
