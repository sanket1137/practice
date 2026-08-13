/**
 * SignalR client for the CMS control hub at /hubs/cms.
 *
 * Connects with the screen API key as access_token; calls SubscribePlayer
 * after OnConnected (which BCrypt-verifies the key server-side). Forwards
 * `command` and `playlist_updated` events to the caller, and exposes
 * `ackCommand` for completion reporting.
 */
import * as signalR from '@microsoft/signalr';
import type { PlayerConfig } from '../config';

export interface RemoteCommandPayload {
  id: string;
  screenId: string;
  commandType: string;
  payloadJson: string | null;
  status: string;
  issuedAt: string | null;
}

export interface PlaylistUpdatedPayload {
  screenId?: string;
  playlistId?: string;
  version?: number;
  defaultChanged?: boolean;
}

export interface CmsControlCallbacks {
  onCommand: (cmd: RemoteCommandPayload) => void;
  onPlaylistUpdated: (evt: PlaylistUpdatedPayload) => void;
}

export class CmsControlClient {
  private connection: signalR.HubConnection | null = null;
  private readonly config: PlayerConfig;
  private readonly callbacks: CmsControlCallbacks;
  private stopped = false;

  constructor(config: PlayerConfig, callbacks: CmsControlCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    this.stopped = false;
    const baseUrl = this.config.serverUrl.replace(/\/+$/, '');

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/cms`, {
        accessTokenFactory: () => this.config.apiKey,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) =>
          Math.min(1000 * Math.pow(2, ctx.previousRetryCount), 30_000),
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on('command', (cmd: RemoteCommandPayload) => {
      console.log(`[CmsHub] command: ${cmd.commandType}`);
      this.callbacks.onCommand(cmd);
    });

    this.connection.on('playlist_updated', (evt: PlaylistUpdatedPayload) => {
      console.log('[CmsHub] playlist_updated');
      this.callbacks.onPlaylistUpdated(evt);
    });

    this.connection.on('player_online', () => console.debug('[CmsHub] player_online'));
    this.connection.on('player_offline', () => console.debug('[CmsHub] player_offline'));
    this.connection.on('command_ack', () => console.debug('[CmsHub] command_ack'));

    this.connection.onreconnected(() => {
      console.log('[CmsHub] Reconnected — re-subscribing');
      this.subscribe().catch(console.error);
    });

    this.connection.onclose(() => {
      if (!this.stopped) {
        console.warn('[CmsHub] Closed — scheduling reconnect');
        setTimeout(() => this.start().catch(console.error), 5000);
      }
    });

    try {
      await this.connection.start();
      console.log('[CmsHub] Connected');
      await this.subscribe();
    } catch (err) {
      console.error('[CmsHub] Connect failed:', err);
      if (!this.stopped) {
        setTimeout(() => this.start().catch(console.error), 5000);
      }
    }
  }

  private async subscribe(): Promise<void> {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    try {
      await this.connection.invoke('SubscribePlayer', this.config.screenId, this.config.apiKey);
      console.log('[CmsHub] SubscribePlayer OK');
    } catch (err) {
      console.error('[CmsHub] SubscribePlayer failed:', err);
    }
  }

  async ackCommand(commandId: string, success: boolean, errorMessage?: string): Promise<void> {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    try {
      await this.connection.invoke('AckCommand', {
        CommandId: commandId,
        Success: success,
        ErrorMessage: errorMessage ?? null,
      });
    } catch (err) {
      console.warn('[CmsHub] AckCommand failed:', err);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch {
        // ignore
      }
      this.connection = null;
    }
  }
}
