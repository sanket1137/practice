import { useState, useEffect, useCallback } from 'react';
import { websocketService } from '../services/websocket';

export function useWebSocket() {
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        // Auto-connect on mount. Deliberately NO disconnect on unmount: the
        // connection is an app-lifetime singleton shared by every page.
        // Stopping it here used to kill real-time updates for all other
        // components and race concurrent connects into "Failed to start the
        // HttpConnection before stop() was called". It is only stopped by
        // websocketService.shutdown() during logout.
        const connect = async () => {
            try {
                setConnectionState('connecting');
                await websocketService.connect();
                setConnectionState('connected');
                setError(null);
            } catch (err) {
                setConnectionState('disconnected');
                setError(err as Error);
            }
        };

        connect();
    }, []);

    // Poll connection state every second
    useEffect(() => {
        const interval = setInterval(() => {
            const state = websocketService.getConnectionState();
            setConnectionState(state);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const subscribeToScreen = useCallback(async <TData = unknown>(screenId: string, callback: (data: TData) => void) => {
        try {
            await websocketService.subscribeToScreen(screenId, callback);
        } catch (err) {
            setError(err as Error);
            throw err;
        }
    }, []);

    const unsubscribeFromScreen = useCallback(async (screenId: string) => {
        await websocketService.unsubscribeFromScreen(screenId);
    }, []);

    const subscribeToCampaign = useCallback(async <TData = unknown>(campaignId: string, callback: (data: TData) => void) => {
        try {
            await websocketService.subscribeToCampaign(campaignId, callback);
        } catch (err) {
            setError(err as Error);
            throw err;
        }
    }, []);

    const unsubscribeFromCampaign = useCallback(async (campaignId: string) => {
        await websocketService.unsubscribeFromCampaign(campaignId);
    }, []);

    return {
        connectionState,
        isConnected: connectionState === 'connected',
        error,
        subscribeToScreen,
        unsubscribeFromScreen,
        subscribeToCampaign,
        unsubscribeFromCampaign
    };
}
