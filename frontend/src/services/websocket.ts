import * as signalR from '@microsoft/signalr';

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

class WebSocketService {
    private connection: signalR.HubConnection | null = null;
    private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
    private listeners: Map<string, Set<Function>> = new Map();

    async connect() {
        if (this.connection) {
            console.log('[WebSocket] Already connected or connecting, state:', this.connectionState);
            return;
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
            .configureLogging(signalR.LogLevel.Debug)
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
            console.log('[WebSocket] Connection closed');
            if (error) {
                console.error('[WebSocket] Close error:', error);
            }
        });

        try {
            console.log('[WebSocket] Attempting to start connection...');
            await this.connection.start();
            this.connectionState = 'connected';
            console.log('✓ [WebSocket] Connected successfully to PlaybackHub');
        } catch (error) {
            this.connectionState = 'disconnected';
            console.error('✗ [WebSocket] Connection failed:', error);
            throw error;
        }
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
        if (!this.isConnected()) {
            await this.connect();
        }

        try {
            return await this.connection!.invoke(methodName, ...args);
        } catch (error) {
            console.error(`Error invoking ${methodName}:`, error);
            throw error;
        }
    }
}

// Export singleton instance
export const websocketService = new WebSocketService();
