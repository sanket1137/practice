import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
    isOnline: boolean;
    wasOffline: boolean;  // Indicates if connection was recently restored
    effectiveType?: string;  // 4g, 3g, 2g, slow-2g
    downlink?: number;  // Mbps
    rtt?: number;  // Round-trip time in ms
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
    const [status, setStatus] = useState<NetworkStatus>(() => ({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        wasOffline: false,
    }));

    const updateNetworkInfo = useCallback(() => {
        const connection = (navigator as any).connection || 
                          (navigator as any).mozConnection || 
                          (navigator as any).webkitConnection;
        
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
        const connection = (navigator as any).connection || 
                          (navigator as any).mozConnection || 
                          (navigator as any).webkitConnection;
        
        if (connection) {
            connection.addEventListener('change', updateNetworkInfo);
            updateNetworkInfo();
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
