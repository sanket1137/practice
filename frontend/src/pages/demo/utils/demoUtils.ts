// Demo Utility Functions

export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

export const validateVideoLength = (file: File): Promise<{ valid: boolean; duration: number }> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            const duration = video.duration;
            resolve({
                valid: duration <= 10,
                duration: duration
            });
        };

        video.onerror = () => {
            resolve({ valid: false, duration: 0 });
        };

        video.src = URL.createObjectURL(file);
    });
};

export const createVideoUrl = (file: File): string => {
    return URL.createObjectURL(file);
};

export const revokeVideoUrl = (url: string): void => {
    URL.revokeObjectURL(url);
};

export const BOOKING_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const STREAM_DURATION_MS = 1 * 60 * 1000; // 1 minute
