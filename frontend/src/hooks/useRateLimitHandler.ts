import { useEffect, useCallback } from 'react';
import { useSnackbar } from 'notistack';

interface RateLimitEvent extends CustomEvent {
    detail: {
        message: string;
        retryAfter?: number;
    };
}

/**
 * Hook to handle rate limit events and show notifications.
 * Should be used at the app level to catch all rate limit errors.
 * 
 * Usage:
 * ```tsx
 * function App() {
 *   useRateLimitHandler();
 *   return <YourApp />;
 * }
 * ```
 */
export function useRateLimitHandler() {
    const { enqueueSnackbar } = useSnackbar();

    const handleRateLimit = useCallback((event: Event) => {
        const rateLimitEvent = event as RateLimitEvent;
        const { message, retryAfter } = rateLimitEvent.detail;
        
        enqueueSnackbar(message, {
            variant: 'warning',
            autoHideDuration: retryAfter ? retryAfter * 1000 : 5000,
            preventDuplicate: true,
            anchorOrigin: {
                vertical: 'top',
                horizontal: 'center',
            },
        });
    }, [enqueueSnackbar]);

    useEffect(() => {
        window.addEventListener('api-rate-limited', handleRateLimit);
        
        return () => {
            window.removeEventListener('api-rate-limited', handleRateLimit);
        };
    }, [handleRateLimit]);
}

/**
 * Helper function to check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
    return error instanceof Error && (error as any).isRateLimit === true;
}

/**
 * Get retry-after value from a rate limit error
 */
export function getRetryAfter(error: unknown): number | undefined {
    if (isRateLimitError(error)) {
        return (error as any).retryAfter;
    }
    return undefined;
}

export default useRateLimitHandler;
