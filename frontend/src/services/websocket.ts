import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '../store/authStore';

// Use same fallback pattern as API service
// When VITE_API_URL is not set, use '/api/v1' which Vite will proxy to backend
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const BASE_URL = API_URL.replace(/\/api(\/v\d+)?/, '');  // Remove /api or /api/v1 suffix for hub URLs

/** Generic hub event callback. Payloads are typed by the caller via generics. */
export type WebSocketEventCallback = (...args: unknown[]) => void;

type SubscriptionKind = 'screen' | 'campaign' | 'bookings';

/**
 * App-lifetime SignalR connection to the PlaybackHub.
 *
 * Design rules (learned from real production failures — keep them):
 *
 * 1. ONE connection for the whole app. Components NEVER stop it — a component
 *    unmounting used to call disconnect() on this shared singleton, killing
 *    real-time updates for every other page and racing concurrent connect()
 *    calls into "Failed to start the HttpConnection before stop() was called".
 *    Only shutdown() (logout) stops the connection.
 *
 * 2. Listener registrations survive reconnects AND new connection objects.
 *    signalR keeps .on() registrations across automatic reconnects of the same
 *    connection object, but a fresh connect() builds a NEW object — every event
 *    name in the registry is re-bound to it.
 *
 * 3. Group memberships are re-established after every reconnect. SignalR
 *    groups are per-connection-id server-side, so an automatic reconnect
 *    silently drops them — without re-subscribing, pages looked "connected"
 *    but never received another event.
 */
class WebSocketService {
    private connection: signalR.HubConnection | null = null;
    private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
    private listeners: Map<string, Set<WebSocketEventCallback>> = new Map();
    /** Event names already bound to the CURRENT connection object. */
    private boundEvents: Set<string> = new Set();
    /** Server-side group subscriptions to restore after reconnects. */
    private subscriptions: Map<string, { kind: SubscriptionKind; id: string }> = new Map();
    private connectionPromise: Promise<void> | null = null;
    private shuttingDown = false;

    async connect(): Promise<void> {
        this.shuttingDown = false;

        if (this.connectionState === 'connected' && this.connection?.state === signalR.HubConnectionState.Connected) {
            return;
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionState = 'connecting';

        const url = `${BASE_URL}/hubs/playback`;

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(url, {
                transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
                skipNegotiation: false,
                // Server-side SubscribeToScreen/SubscribeToCampaign check
                // screen/campaign ownership against the caller's JWT identity,
                // so the dashboard connection needs to present it.
                accessTokenFactory: () => useAuthStore.getState().accessToken || '',
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: (retryContext) => {
                    // Exponential backoff capped at 30s, retrying indefinitely —
                    // a dashboard left open overnight must recover on its own.
                    return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
                }
            })
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        connection.onreconnecting(() => {
            this.connectionState = 'reconnecting';
            console.log('[WebSocket] Reconnecting...');
        });

        connection.onreconnected(async () => {
            this.connectionState = 'connected';
            console.log('[WebSocket] Reconnected — restoring group subscriptions');
            await this.restoreSubscriptions();
        });

        connection.onclose((error) => {
            this.connectionState = 'disconnected';
            this.connectionPromise = null;
            if (error) {
                console.error('[WebSocket] Connection closed with error:', error);
            }
        });

        this.connection = connection;
        this.boundEvents.clear();
        // Bind every already-registered event name to the new connection object.
        for (const eventName of this.listeners.keys()) {
            this.bindEvent(eventName);
        }

        this.connectionPromise = (async () => {
            try {
                await connection.start();
                this.connectionState = 'connected';
                console.log('✓ [WebSocket] Connected to PlaybackHub');
                await this.restoreSubscriptions();
            } catch (error) {
                this.connectionState = 'disconnected';
                this.connectionPromise = null;
                this.connection = null;
                if (!this.shuttingDown) {
                    console.error('✗ [WebSocket] Connection failed:', error);
                }
                throw error;
            }
        })();

        return this.connectionPromise;
    }

    /**
     * Fully stop the connection and forget all subscriptions. ONLY for logout —
     * components must never call this (see class doc).
     */
    async shutdown() {
        this.shuttingDown = true;
        this.subscriptions.clear();
        const connection = this.connection;
        this.connection = null;
        this.connectionPromise = null;
        this.boundEvents.clear();
        this.connectionState = 'disconnected';
        if (connection) {
            try {
                await connection.stop();
            } catch {
                // Best-effort — the token may already be gone.
            }
            console.log('[WebSocket] Shut down');
        }
    }

    /** @deprecated Components must not stop the shared connection; use shutdown() from logout only. */
    async disconnect() {
        await this.shutdown();
    }

    getConnectionState() {
        return this.connectionState;
    }

    isConnected() {
        return this.connection?.state === signalR.HubConnectionState.Connected;
    }

    // ── Group subscriptions (tracked + auto-restored) ─────────────────────────

    async subscribeToScreen<TData = unknown>(screenId: string, callback?: (data: TData) => void) {
        if (callback) {
            this.on('OnContentPlaying', callback);
        }
        this.subscriptions.set(`screen:${screenId}`, { kind: 'screen', id: screenId });
        await this.invoke('SubscribeToScreen', screenId);
        console.log(`[WebSocket] Subscribed to screen ${screenId}`);
    }

    async unsubscribeFromScreen(screenId: string) {
        this.subscriptions.delete(`screen:${screenId}`);
        await this.invokeIfConnected('UnsubscribeFromScreen', screenId);
    }

    async subscribeToCampaign<TData = unknown>(campaignId: string, callback?: (data: TData) => void) {
        if (callback) {
            this.on('OnContentPlaying', callback);
        }
        this.subscriptions.set(`campaign:${campaignId}`, { kind: 'campaign', id: campaignId });
        await this.invoke('SubscribeToCampaign', campaignId);
        console.log(`[WebSocket] Subscribed to campaign ${campaignId}`);
    }

    async unsubscribeFromCampaign(campaignId: string) {
        this.subscriptions.delete(`campaign:${campaignId}`);
        await this.invokeIfConnected('UnsubscribeFromCampaign', campaignId);
    }

    /** Join the per-user booking events group (BookingCreated/Approved/...). */
    async subscribeToBookings(userId: string) {
        this.subscriptions.set(`bookings:${userId}`, { kind: 'bookings', id: userId });
        await this.invoke('SubscribeToBookings', userId);
        console.log(`[WebSocket] Subscribed to booking events for user ${userId}`);
    }

    async unsubscribeFromBookings(userId: string) {
        this.subscriptions.delete(`bookings:${userId}`);
        await this.invokeIfConnected('UnsubscribeFromBookings', userId);
    }

    private async restoreSubscriptions() {
        for (const sub of this.subscriptions.values()) {
            try {
                if (sub.kind === 'screen') {
                    await this.connection!.invoke('SubscribeToScreen', sub.id);
                } else if (sub.kind === 'campaign') {
                    await this.connection!.invoke('SubscribeToCampaign', sub.id);
                } else {
                    await this.connection!.invoke('SubscribeToBookings', sub.id);
                }
            } catch (error) {
                console.warn(`[WebSocket] Failed to restore ${sub.kind} subscription ${sub.id}:`, error);
            }
        }
    }

    // ── Sync-mode requests ────────────────────────────────────────────────────

    // Request fast sync mode (1 minute interval) - call when user views Live Activity
    async requestFastSync(screenId: string) {
        await this.invokeIfConnected('RequestFastSync', screenId);
    }

    // Request normal sync mode (10 minute interval) - call when user leaves page
    async requestNormalSync(screenId: string) {
        await this.invokeIfConnected('RequestNormalSync', screenId);
    }

    // ── Event listeners ───────────────────────────────────────────────────────

    private bindEvent(eventName: string) {
        if (!this.connection || this.boundEvents.has(eventName)) return;
        this.boundEvents.add(eventName);
        this.connection.on(eventName, (...args: unknown[]) => {
            const callbacks = this.listeners.get(eventName);
            if (callbacks) {
                callbacks.forEach(cb => cb(...args));
            }
        });
    }

    on<TArgs extends unknown[] = unknown[]>(eventName: string, callback: (...args: TArgs) => void) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName)!.add(callback as WebSocketEventCallback);
        // Bind lazily: safe to call before connect() — connect() re-binds every
        // registered event onto each new connection object.
        this.bindEvent(eventName);
    }

    off<TArgs extends unknown[] = unknown[]>(eventName: string, callback: (...args: TArgs) => void) {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
            callbacks.delete(callback as WebSocketEventCallback);
        }
    }

    // ── Raw invocations ───────────────────────────────────────────────────────

    async invoke<TResult = unknown>(methodName: string, ...args: unknown[]): Promise<TResult> {
        if (!this.isConnected()) {
            try {
                await this.connect();
            } catch (error) {
                console.warn(`[WebSocket] Failed to connect before invoking ${methodName}:`, error);
                throw new Error(`Cannot invoke ${methodName}: WebSocket connection failed`);
            }
        }

        if (!this.isConnected()) {
            throw new Error(`Cannot invoke ${methodName}: WebSocket not connected`);
        }

        try {
            return await this.connection!.invoke<TResult>(methodName, ...args);
        } catch (error) {
            console.error(`[WebSocket] Error invoking ${methodName}:`, error);
            throw error;
        }
    }

    // Safe invoke that doesn't throw if not connected - useful for cleanup
    async invokeIfConnected<TResult = unknown>(methodName: string, ...args: unknown[]): Promise<TResult | undefined> {
        if (!this.isConnected()) {
            return;
        }

        try {
            return await this.connection!.invoke<TResult>(methodName, ...args);
        } catch (error) {
            console.warn(`[WebSocket] Error invoking ${methodName}:`, error);
            // Don't throw - this is a "best effort" call
        }
    }
}

// Export singleton instance
export const websocketService = new WebSocketService();
