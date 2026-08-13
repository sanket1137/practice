/**
 * SignalR client for real-time playback events from the CCMS backend.
 * Connects to /hubs/playback and handles PlaylistUpdated, SlotStatusChanged, SetSyncMode.
 */
import * as signalR from '@microsoft/signalr';
import type { PlayerConfig } from '../config';

export interface SignalRCallbacks {
  onPlaylistUpdated: () => void;
  onSlotStatusChanged: (slotNumber: number, status: string) => void;
  onSyncModeChanged: (mode: string) => void;
  onRemoteCommand: (commandType: string, payload: unknown) => void;
  onConnectionStateChanged: (connected: boolean) => void;
}

export class SignalRClient {
  private connection: signalR.HubConnection | null = null;
  private readonly config: PlayerConfig;
  private readonly callbacks: SignalRCallbacks;
  private reconnectAttempts = 0;
  private stopped = false;

  constructor(config: PlayerConfig, callbacks: SignalRCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    this.stopped = false;
    const baseUrl = this.config.serverUrl.replace(/\/+$/, '');

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/playback`, {
        accessTokenFactory: () => this.config.apiKey,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) => {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
          const delay = Math.min(1000 * Math.pow(2, ctx.previousRetryCount), 30_000);
          return delay;
        },
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.onreconnecting(() => {
      console.log('[SignalR] Reconnecting...');
      this.callbacks.onConnectionStateChanged(false);
    });

    this.connection.onreconnected(() => {
      console.log('[SignalR] Reconnected');
      this.reconnectAttempts = 0;
      this.callbacks.onConnectionStateChanged(true);
      // Re-join the screen group after reconnection
      this.joinScreenGroup().catch(console.error);
    });

    this.connection.onclose(() => {
      console.log('[SignalR] Connection closed');
      this.callbacks.onConnectionStateChanged(false);
      if (!this.stopped) {
        this.scheduleManualReconnect();
      }
    });

    // Register event handlers
    this.connection.on('PlaylistUpdated', (_screenId: string) => {
      console.log('[SignalR] PlaylistUpdated event received');
      this.callbacks.onPlaylistUpdated();
    });

    this.connection.on('SlotStatusChanged', (slotNumber: number, status: string) => {
      console.log(`[SignalR] SlotStatusChanged: slot=${slotNumber}, status=${status}`);
      this.callbacks.onSlotStatusChanged(slotNumber, status);
    });

    this.connection.on('SetSyncMode', (mode: string) => {
      console.log(`[SignalR] SetSyncMode: ${mode}`);
      this.callbacks.onSyncModeChanged(mode);
    });

    this.connection.on('RemoteCommand', (commandType: string, payloadJson: string | null) => {
      let payload: unknown = null;
      if (payloadJson) {
        try {
          payload = JSON.parse(payloadJson);
        } catch {
          payload = payloadJson;
        }
      }
      this.callbacks.onRemoteCommand(commandType, payload);
    });

    try {
      await this.connection.start();
      console.log('[SignalR] Connected to /hubs/playback');
      this.reconnectAttempts = 0;
      this.callbacks.onConnectionStateChanged(true);
      await this.joinScreenGroup();
    } catch (err) {
      console.error('[SignalR] Failed to connect:', err);
      this.callbacks.onConnectionStateChanged(false);
      if (!this.stopped) {
        this.scheduleManualReconnect();
      }
    }
  }

  private async joinScreenGroup(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('SubscribeToScreen', this.config.screenId);
        console.log('[SignalR] Joined screen group');
      } catch (err) {
        console.warn('[SignalR] Failed to join screen group:', err);
      }
    }
  }

  private scheduleManualReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts - 1), 60_000);
    console.log(`[SignalR] Manual reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      if (!this.stopped) {
        this.start().catch(console.error);
      }
    }, delay);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch {
        // Ignore stop errors
      }
      this.connection = null;
    }
  }
}
