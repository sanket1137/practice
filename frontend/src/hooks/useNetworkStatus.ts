import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
    isOnline: boolean;
    wasOffline: boolean;  // Indicates if connection was recently restored
    effectiveType?: string;  // 4g, 3g, 2g, slow-2g
    downlink?: number;  // Mbps
    rtt?: number;  // Round-trip time in ms
}

/**
 * Subset of the Network Information API (https://wicg.github.io/netinfo/).
 * Not yet part of the standard TypeScript DOM lib.
 */
interface NetworkInformation extends EventTarget {
    readonly effectiveType?: string;
    readonly downlink?: number;
    readonly rtt?: number;
}

interface NavigatorWithConnection extends Navigator {
    readonly connection?: NetworkInformation;
    readonly mozConnection?: NetworkInformation;
    readonly webkitConnection?: NetworkInformation;
}

function getConnection(): NetworkInformation | undefined {
    if (typeof navigator === 'undefined') return undefined;
    const nav = navigator as NavigatorWithConnection;
    return nav.connection || nav.mozConnection || nav.webkitConnection;
}

/**
 * Hook to monitor network connectivity status.
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, wasOffline } = useNetworkStatus();
 *
 *   if (!isOnline) {
 *     return <OfflineBanner />;
 *   }
 *
 *   return <YourContent />;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
    const [status, setStatus] = useState<NetworkStatus>(() => {
        const connection = getConnection();
        return {
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            wasOffline: false,
            effectiveType: connection?.effectiveType,
            downlink: connection?.downlink,
            rtt: connection?.rtt,
        };
    });

    const updateNetworkInfo = useCallback(() => {
        const connection = getConnection();

        if (connection) {
            setStatus(prev => ({
                ...prev,
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
            }));
        }
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            setStatus(prev => ({
                ...prev,
                isOnline: true,
                wasOffline: true,
            }));
            updateNetworkInfo();

            // Reset wasOffline after 5 seconds
            setTimeout(() => {
                setStatus(prev => ({
                    ...prev,
                    wasOffline: false,
                }));
            }, 5000);
        };

        const handleOffline = () => {
            setStatus(prev => ({
                ...prev,
                isOnline: false,
            }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Listen for connection changes if supported
        const connection = getConnection();

        if (connection) {
            connection.addEventListener('change', updateNetworkInfo);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (connection) {
                connection.removeEventListener('change', updateNetworkInfo);
            }
        };
    }, [updateNetworkInfo]);

    return status;
}

export default useNetworkStatus;
