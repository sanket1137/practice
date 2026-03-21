import * as signalR from '@microsoft/signalr';

// Use same fallback pattern as API service
// When VITE_API_URL is not set, use '/api/v1' which Vite will proxy to backend
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const BASE_URL = API_URL.replace(/\/api(\/v\d+)?/, '');  // Remove /api or /api/v1 suffix for hub URLs

class WebSocketService {
    private connection: signalR.HubConnection | null = null;
    private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
    private listeners: Map<string, Set<Function>> = new Map();
    private connectionPromise: Promise<void> | null = null;

    async connect(): Promise<void> {
        // If already connected, return immediately
        if (this.connectionState === 'connected' && this.connection?.state === signalR.HubConnectionState.Connected) {
            console.log('[WebSocket] Already connected');
            return;
        }

        // If connection is in progress, wait for it
        if (this.connectionPromise) {
            console.log('[WebSocket] Connection already in progress, waiting...');
            return this.connectionPromise;
        }

        console.log('[WebSocket] Starting WebSocket connection...');
        this.connectionState = 'connecting';

        // Connect to PlaybackHub for real-time ad events
        const url = `${BASE_URL}/hubs/playback`;
        console.log('[WebSocket] Connecting to:', url);

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(url, {
                transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
                skipNegotiation: false
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: (retryContext) => {
                    // Exponential backoff: 0, 2, 10, 30 seconds
                    if (retryContext.elapsedMilliseconds < 60000) {
                        return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
                    }
                    return null; // Stop reconnecting after 1 minute
                }
            })
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        // Setup connection event handlers
        this.connection.onreconnecting(() => {
            this.connectionState = 'reconnecting';
            console.log('[WebSocket] Reconnecting...');
        });

        this.connection.onreconnected(() => {
            this.connectionState = 'connected';
            console.log('[WebSocket] Reconnected successfully');
        });

        this.connection.onclose((error) => {
            this.connectionState = 'disconnected';
            this.connectionPromise = null;
            console.log('[WebSocket] Connection closed');
            if (error) {
                console.error('[WebSocket] Close error:', error);
            }
        });

        // Create connection promise
        this.connectionPromise = (async () => {
            try {
                console.log('[WebSocket] Attempting to start connection...');
                await this.connection!.start();
                this.connectionState = 'connected';
                console.log('✓ [WebSocket] Connected successfully to PlaybackHub');
            } catch (error) {
                this.connectionState = 'disconnected';
                this.connectionPromise = null;
                this.connection = null;
                console.error('✗ [WebSocket] Connection failed:', error);
                throw error;
            }
        })();

        return this.connectionPromise;
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.stop();
            this.connection = null;
            this.connectionState = 'disconnected';
            console.log('WebSocket disconnected');
        }
    }

    getConnectionState() {
        return this.connectionState;
    }

    isConnected() {
        return this.connection?.state === signalR.HubConnectionState.Connected;
    }

    // Subscribe to screen events (for screen owners)
    async subscribeToScreen(screenId: string, callback: (data: any) => void) {
        if (!this.isConnected()) {
            throw new Error('WebSocket not connected');
        }

        try {
            // Register callback for content playing events
            this.on('OnContentPlaying', callback);

            // Send subscription request to server
            await this.connection!.invoke('SubscribeToScreen', screenId);
            console.log(`Subscribed to screen: ${screenId}`);
        } catch (error) {
            console.error('Error subscribing to screen:', error);
            throw error;
        }
    }

    async unsubscribeFromScreen(screenId: string) {
        if (!this.isConnected()) return;

        try {
            await this.connection!.invoke('UnsubscribeFromScreen', screenId);
            console.log(`Unsubscribed from screen: ${screenId}`);
        } catch (error) {
            console.error('Error unsubscribing from screen:', error);
        }
    }

    // Subscribe to campaign events (for advertisers)
    async subscribeToCampaign(campaignId: string, callback: (data: any) => void) {
        if (!this.isConnected()) {
            throw new Error('WebSocket not connected');
        }

        try {
            // Register callback for content playing events
            this.on('OnContentPlaying', callback);

            // Send subscription request to server
            await this.connection!.invoke('SubscribeToCampaign', campaignId);
            console.log(`Subscribed to campaign: ${campaignId}`);
        } catch (error) {
            console.error('Error subscribing to campaign:', error);
            throw error;
        }
    }

    async unsubscribeFromCampaign(campaignId: string) {
        if (!this.isConnected()) return;

        try {
            await this.connection!.invoke('UnsubscribeFromCampaign', campaignId);
            console.log(`Unsubscribed from campaign: ${campaignId}`);
        } catch (error) {
            console.error('Error unsubscribing from campaign:', error);
        }
    }

    // Request fast sync mode (1 minute interval) - call when user views Live Activity
    async requestFastSync(screenId: string) {
        if (!this.isConnected()) return;

        try {
            await this.connection!.invoke('RequestFastSync', screenId);
            console.log(`⚡ Requested fast sync for screen: ${screenId}`);
        } catch (error) {
            console.error('Error requesting fast sync:', error);
        }
    }

    // Request normal sync mode (10 minute interval) - call when user leaves page
    async requestNormalSync(screenId: string) {
        if (!this.isConnected()) return;

        try {
            await this.connection!.invoke('RequestNormalSync', screenId);
            console.log(`🐢 Requested normal sync for screen: ${screenId}`);
        } catch (error) {
            console.error('Error requesting normal sync:', error);
        }
    }

    // Generic event listener
    on(eventName: string, callback: Function) {
        if (!this.connection) return;

        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());

            // Register with SignalR hub
            this.connection.on(eventName, (...args: any[]) => {
                const callbacks = this.listeners.get(eventName);
                if (callbacks) {
                    callbacks.forEach(cb => cb(...args));
                }
            });
        }

        this.listeners.get(eventName)!.add(callback);
    }

    off(eventName: string, callback: Function) {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    // Generic invoke method for signaling calls
    async invoke(methodName: string, ...args: any[]): Promise<any> {
        // If not connected, try to connect first
        if (!this.isConnected()) {
            try {
                await this.connect();
            } catch (error) {
                console.warn(`[WebSocket] Failed to connect before invoking ${methodName}:`, error);
                throw new Error(`Cannot invoke ${methodName}: WebSocket connection failed`);
            }
        }

        // Double check we're connected after await
        if (!this.isConnected()) {
            throw new Error(`Cannot invoke ${methodName}: WebSocket not connected`);
        }

        try {
            return await this.connection!.invoke(methodName, ...args);
        } catch (error) {
            console.error(`[WebSocket] Error invoking ${methodName}:`, error);
            throw error;
        }
    }

    // Safe invoke that doesn't throw if not connected - useful for cleanup
    async invokeIfConnected(methodName: string, ...args: any[]): Promise<any> {
        if (!this.isConnected()) {
            console.log(`[WebSocket] Skipping ${methodName} - not connected`);
            return;
        }

        try {
            return await this.connection!.invoke(methodName, ...args);
        } catch (error) {
            console.warn(`[WebSocket] Error invoking ${methodName}:`, error);
            // Don't throw - this is a "best effort" call
        }
    }
}

// Export singleton instance
export const websocketService = new WebSocketService();
