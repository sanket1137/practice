import { useState } from 'react';

// Hook to manage global loading state
export function useGlobalLoading() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string>();

    const showLoading = (msg?: string) => {
        setMessage(msg);
        setLoading(true);
    };

    const hideLoading = () => {
        setLoading(false);
        setMessage(undefined);
    };

    return {
        loading,
        message,
        showLoading,
        hideLoading,
    };
}
