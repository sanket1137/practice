/**
 * App orchestrator — manages the full player lifecycle:
 *   config → setup → handshake → verification? → playback → loops (heartbeat, sync, operating hours)
 *
 * This is the central coordinator that wires all components together.
 */
import { getConfig, type PlayerConfig } from './config';
import {
  PlayerApi,
  type HandshakeResponse,
  type PlaylistItem,
  type CmsPlaylistDto,
} from './api/playerApi';
import { SetupScreen } from './ui/setupScreen';
import { QrVerificationScreen } from './verification/qrDisplay';
import { VideoPlayer } from './player/videoPlayer';
import { ImpressionTracker } from './player/impressionTracker';
import { SignalRClient } from './realtime/signalRClient';
import { CmsControlClient } from './realtime/cmsControlClient';
import { RemoteCommandHandler } from './player/remoteCommandHandler';
import { generateFingerprint } from './security/fingerprint';

/** Parsed operating hours for a single day */
interface DaySchedule {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

type AppState = 'init' | 'setup' | 'handshake' | 'verification' | 'playing' | 'outside-hours' | 'error';

export class App {
  private readonly root: HTMLElement;

  // Components
  private api: PlayerApi | null = null;
  private player: VideoPlayer | null = null;
  private impressionTracker: ImpressionTracker | null = null;
  private signalRClient: SignalRClient | null = null;
  private cmsClient: CmsControlClient | null = null;
  private commandHandler: RemoteCommandHandler | null = null;

  // State
  private config: PlayerConfig | null = null;
  private handshakeData: HandshakeResponse | null = null;
  private deviceFingerprint = '';
  private state: AppState = 'init';
  private syncIntervalMinutes = 5;

  // Timers
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private operatingHoursTimer: ReturnType<typeof setInterval> | null = null;

  // Operating hours
  private operatingHours: Record<string, DaySchedule> | null = null;

  // Error recovery
  private consecutiveHandshakeFailures = 0;
  private readonly MAX_HANDSHAKE_RETRIES = 10;

  // Status overlay
  private statusOverlay: HTMLDivElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async start(): Promise<void> {
    console.log('[App] Starting CCMS ChromeOS Player');

    // Generate device fingerprint early
    this.deviceFingerprint = await generateFingerprint();
    console.log(`[App] Device fingerprint: ${this.deviceFingerprint.substring(0, 12)}...`);

    // Initialize impression tracker
    this.impressionTracker = new ImpressionTracker();
    await this.impressionTracker.init();

    // Check for saved config
    this.config = getConfig();
    if (!this.config) {
      await this.showSetup();
    }

    // Config is now guaranteed to exist
    if (!this.config) return; // Safety check

    // Create API client
    this.api = new PlayerApi(this.config);

    // Attempt handshake
    await this.performHandshake();
  }

  // ─── Setup ───

  private async showSetup(): Promise<void> {
    this.state = 'setup';
    const setupScreen = new SetupScreen(this.root);
    this.config = await setupScreen.show();
    console.log('[App] Config saved from setup screen');
  }

  // ─── Handshake ───

  private async performHandshake(): Promise<void> {
    this.state = 'handshake';
    this.showStatus('Connecting to server...');

    const data = await this.api!.handshake(this.deviceFingerprint);

    if (!data) {
      this.consecutiveHandshakeFailures++;
      console.error(`[App] Handshake failed (attempt ${this.consecutiveHandshakeFailures})`);

      if (this.consecutiveHandshakeFailures >= this.MAX_HANDSHAKE_RETRIES) {
        this.showError('Unable to connect to server. Check configuration and network.');
        return;
      }

      // Exponential backoff retry: 5s, 10s, 20s, 40s, capped at 60s
      const delay = Math.min(5000 * Math.pow(2, this.consecutiveHandshakeFailures - 1), 60_000);
      this.showStatus(`Connection failed. Retrying in ${Math.round(delay / 1000)}s...`);
      setTimeout(() => this.performHandshake(), delay);
      return;
    }

    this.consecutiveHandshakeFailures = 0;
    this.handshakeData = data;
    this.syncIntervalMinutes = data.syncIntervalMinutes || 5;

    // Parse operating hours
    if (data.operatingHours) {
      this.parseOperatingHours(data.operatingHours);
    }

    console.log(`[App] Handshake success. Sync interval: ${this.syncIntervalMinutes}m`);

    // Check if verification is required
    if (data.verificationMode && data.verificationStatus !== 'Verified') {
      await this.showVerification();
    }

    // Start playback
    this.startPlayback();
  }

  // ─── Verification ───

  private async showVerification(): Promise<void> {
    this.state = 'verification';
    this.hideStatus();
    const verificationScreen = new QrVerificationScreen(this.root, this.config!);
    await verificationScreen.start();
    console.log('[App] Verification complete');

    // Re-handshake after verification to get fresh playlist
    this.handshakeData = await this.api!.handshake(this.deviceFingerprint);
    if (!this.handshakeData) {
      this.showError('Post-verification handshake failed.');
      return;
    }
  }

  // ─── Playback ───

  private startPlayback(): void {
    this.state = 'playing';
    this.hideStatus();
    this.root.innerHTML = '';

    // Check operating hours before starting
    if (this.operatingHours && !this.isWithinOperatingHours()) {
      console.log('[App] Outside operating hours — deferring playback');
      this.enterOutsideHours();
      this.startOperatingHoursCheck();
      this.startHeartbeatLoop();
      return;
    }

    // Create player
    this.player = new VideoPlayer(this.root);

    // Wire impression recording
    this.player.setOnImpression((item: PlaylistItem, durationSeconds: number) => {
      this.recordImpression(item, durationSeconds);
    });

    // Load playlist from handshake — prefer CMS playlist when screen is in CmsOwner mode
    const playlist = this.resolvePlaylist(this.handshakeData);
    if (playlist.length > 0) {
      this.player.loadPlaylist(playlist);
      console.log(`[App] Playing ${playlist.length} items`);
    } else {
      this.showStatus('No content scheduled. Waiting for playlist...');
    }

    // Create status overlay for connection status
    this.createConnectionOverlay();

    // Start all loops
    this.startHeartbeatLoop();
    this.startSyncLoop();
    this.startOperatingHoursCheck();

    // Connect SignalR (playback hub + CMS control hub)
    this.connectSignalR();
    this.connectCmsControl();
  }

  /**
   * Map cmsPlaylist to PlaylistItem[] when the screen is CmsOwner-mode,
   * otherwise return the traditional ad playlist.
   */
  private resolvePlaylist(data: HandshakeResponse | null): PlaylistItem[] {
    if (!data) return [];
    const cms = data.cmsPlaylist;
    if (cms && cms.items && cms.items.length > 0) {
      return this.mapCmsToPlaylistItems(cms);
    }
    return data.playlist?.playlist ?? [];
  }

  private mapCmsToPlaylistItems(cms: CmsPlaylistDto): PlaylistItem[] {
    return cms.items
      .filter((i) => i.mediaAsset && i.mediaAsset.isReady)
      .sort((a, b) => a.order - b.order)
      .map((item, idx) => ({
        slotNumber: idx + 1,
        bookingId: null,
        campaignId: null,
        creativeId: null,
        ownerContentId: item.mediaAssetId,
        creativeUrl: item.mediaAsset!.fileUrl,
        creativeMimeType: item.mediaAsset!.mimeType,
        isFillerContent: false,
        startTime: '',
        endTime: '',
      }));
  }

  // ─── Impression Recording ───

  private async recordImpression(item: PlaylistItem, durationSeconds: number): Promise<void> {
    if (!this.impressionTracker || !this.config) return;

    // Don't record impressions for filler content
    if (item.isFillerContent) return;

    const slotPlayKey = ImpressionTracker.generateSlotPlayKey(
      this.config.screenId,
      item.slotNumber,
      new Date()
    );

    await this.impressionTracker.record({
      slotPlayKey,
      bookingId: item.bookingId,
      campaignId: item.campaignId,
      creativeId: item.creativeId,
      ownerContentId: item.ownerContentId,
      slotNumber: item.slotNumber,
      playedAt: new Date().toISOString(),
      durationSeconds,
      isFillerContent: item.isFillerContent,
    });

    console.log(`[App] Impression recorded: slot=${item.slotNumber}, key=${slotPlayKey}`);
  }

  // ─── Heartbeat Loop (30s) ───

  private startHeartbeatLoop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    const sendHeartbeat = () => {
      this.api?.sendHeartbeat().catch(() => {
        console.warn('[App] Heartbeat failed');
      });
    };

    // Send immediately, then every 30s
    sendHeartbeat();
    this.heartbeatTimer = setInterval(sendHeartbeat, 30_000);
    console.log('[App] Heartbeat loop started (30s)');
  }

  // ─── Sync Loop (adaptive 1-10 min) ───

  private syncFailures = 0;

  private startSyncLoop(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);

    const syncImpressions = async () => {
      if (!this.impressionTracker || !this.api) return;

      const pending = await this.impressionTracker.getPending();
      if (pending.length === 0) {
        this.syncFailures = 0;
        return;
      }

      console.log(`[App] Syncing ${pending.length} impressions...`);

      const success = await this.api.syncImpressions(
        pending.map((imp) => ({
          slotPlayKey: imp.slotPlayKey,
          bookingId: imp.bookingId,
          campaignId: imp.campaignId,
          creativeId: imp.creativeId,
          ownerContentId: imp.ownerContentId,
          slotNumber: imp.slotNumber,
          playedAt: imp.playedAt,
          durationSeconds: imp.durationSeconds,
          isFillerContent: imp.isFillerContent,
        }))
      );

      if (success) {
        this.syncFailures = 0;
        await this.impressionTracker.markSynced(pending.map((imp) => imp.slotPlayKey));
        console.log(`[App] Synced ${pending.length} impressions successfully`);
      } else {
        this.syncFailures++;
        console.warn(`[App] Sync failed (${this.syncFailures}), will retry next interval`);
      }
    };

    // Guard against NaN or invalid interval
    const safeMinutes = Number.isFinite(this.syncIntervalMinutes) ? this.syncIntervalMinutes : 5;
    const intervalMs = safeMinutes * 60 * 1000;
    this.syncTimer = setInterval(syncImpressions, intervalMs);
    console.log(`[App] Sync loop started (${safeMinutes}m)`);

    // Also do an immediate sync on start
    syncImpressions().catch(console.error);
  }

  private updateSyncInterval(minutes: number): void {
    if (!Number.isFinite(minutes)) return;
    this.syncIntervalMinutes = Math.max(1, Math.min(10, minutes));
    console.log(`[App] Sync interval updated to ${this.syncIntervalMinutes}m`);
    this.startSyncLoop(); // Restart with new interval
  }

  // ─── Operating Hours ───

  private parseOperatingHours(raw: Record<string, string>): void {
    const parsed: Record<string, DaySchedule> = {};
    for (const [day, range] of Object.entries(raw)) {
      if (range.toLowerCase() === 'closed') continue;
      const match = range.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
      if (match) {
        parsed[day.toLowerCase()] = {
          startHour: parseInt(match[1], 10),
          startMinute: parseInt(match[2], 10),
          endHour: parseInt(match[3], 10),
          endMinute: parseInt(match[4], 10),
        };
      }
    }
    // If no operating days were parsed, treat as "always on" (no schedule configured)
    if (Object.keys(parsed).length > 0) {
      this.operatingHours = parsed;
      console.log('[App] Parsed operating hours:', JSON.stringify(parsed));
    } else {
      this.operatingHours = null;
      console.log('[App] No operating hours configured — always on');
    }
  }

  private isWithinOperatingHours(): boolean {
    if (!this.operatingHours) return true; // No hours set = always on

    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[now.getDay()];

    const schedule = this.operatingHours[today];
    if (!schedule) {
      console.log(`[App] Operating hours: ${today} not in schedule (closed)`);
      return false;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = schedule.startHour * 60 + schedule.startMinute;
    const endMinutes = schedule.endHour * 60 + schedule.endMinute;

    console.log(`[App] Operating hours check: ${today} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} (${currentMinutes}min) vs ${schedule.startHour}:${String(schedule.startMinute).padStart(2,'0')}-${schedule.endHour}:${String(schedule.endMinute).padStart(2,'0')} (${startMinutes}-${endMinutes}min)`);

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  private startOperatingHoursCheck(): void {
    if (this.operatingHoursTimer) clearInterval(this.operatingHoursTimer);
    if (!this.operatingHours) return;

    this.operatingHoursTimer = setInterval(() => {
      const withinHours = this.isWithinOperatingHours();

      if (withinHours && this.state === 'outside-hours') {
        console.log('[App] Entering operating hours — resuming playback');
        this.startPlayback();
      } else if (!withinHours && this.state === 'playing') {
        console.log('[App] Outside operating hours — pausing playback');
        this.enterOutsideHours();
      }
    }, 60_000); // Check every minute

    console.log('[App] Operating hours check started (1m)');
  }

  private enterOutsideHours(): void {
    this.state = 'outside-hours';
    this.player?.stop();
    this.player = null;
    this.root.innerHTML = '';

    const msg = document.createElement('div');
    msg.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'width:100%;height:100%;background:#0f172a;font-family:system-ui,sans-serif;';

    const title = document.createElement('h1');
    title.textContent = 'PixelSpot';
    title.style.cssText = 'color:#6366f1;font-size:3rem;margin-bottom:1rem;';
    msg.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Outside operating hours — playback will resume automatically.';
    subtitle.style.cssText = 'color:#94a3b8;font-size:1.2rem;';
    msg.appendChild(subtitle);

    this.root.appendChild(msg);
  }

  // ─── SignalR ───

  private connectSignalR(): void {
    if (!this.config) return;

    this.signalRClient = new SignalRClient(this.config, {
      onPlaylistUpdated: () => this.handlePlaylistUpdate(),
      onSlotStatusChanged: (_slotNumber, _status) => {
        // Re-fetch playlist on slot status changes
        this.handlePlaylistUpdate();
      },
      onSyncModeChanged: (mode) => {
        const minutes = mode === 'fast' ? 1 : 10;
        this.updateSyncInterval(minutes);
      },
      onRemoteCommand: (commandType, payload) => {
        this.handlePlaybackHubRemoteCommand(commandType, payload);
      },
      onConnectionStateChanged: (connected) => {
        this.updateConnectionOverlay(connected);
      },
    });

    this.signalRClient.start().catch(console.error);
  }

  private async handlePlaylistUpdate(): Promise<void> {
    if (!this.api) return;

    console.log('[App] Fetching updated playlist...');
    const data = await this.api.handshake(this.deviceFingerprint);
    if (!data) return;

    this.handshakeData = data;
    const playlist = this.resolvePlaylist(data);
    if (playlist.length === 0) return;

    if (this.player && this.state === 'playing') {
      this.player.loadPlaylist(playlist);
      console.log(`[App] Playlist updated: ${playlist.length} items`);
    }
  }

  private handlePlaybackHubRemoteCommand(commandType: string, payload: unknown): void {
    if (!this.player) return;

    const type = (commandType || '').toLowerCase();
    const body = typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)
      : {};

    switch (type) {
      case 'play':
        this.player.resume();
        break;
      case 'pause':
        this.player.pause();
        break;
      case 'skip':
      case 'next':
        this.player.skipNext();
        break;
      case 'mute':
        this.player.mute();
        break;
      case 'unmute':
        this.player.unmute();
        break;
      case 'setbrightness': {
        const raw = body.brightness ?? body.value;
        if (typeof raw === 'number') {
          const percent = Math.max(0, Math.min(100, raw));
          document.body.style.filter = `brightness(${Math.max(0.05, percent / 100)})`;
        }
        break;
      }
      default:
        break;
    }
  }

  // ─── CMS control hub ───

  private connectCmsControl(): void {
    if (!this.config || !this.player) return;

    this.cmsClient = new CmsControlClient(this.config, {
      onCommand: (cmd) => {
        this.commandHandler?.handle(cmd).catch((err) =>
          console.error('[App] Command handler error:', err)
        );
      },
      onPlaylistUpdated: () => {
        this.handlePlaylistUpdate().catch(console.error);
      },
    });

    this.commandHandler = new RemoteCommandHandler(this.player, this.cmsClient, () => {
      this.handlePlaylistUpdate().catch(console.error);
    });

    this.cmsClient.start().catch((err) => console.error('[App] CmsControlClient start failed:', err));
  }

  // ─── Connection Status Overlay ───

  private createConnectionOverlay(): void {
    this.statusOverlay = document.createElement('div');
    this.statusOverlay.style.cssText =
      'position:fixed;top:8px;right:8px;width:12px;height:12px;border-radius:50%;' +
      'background:#22c55e;opacity:0.6;z-index:9999;transition:background 0.3s;';
    document.body.appendChild(this.statusOverlay);
  }

  private updateConnectionOverlay(connected: boolean): void {
    if (this.statusOverlay) {
      this.statusOverlay.style.background = connected ? '#22c55e' : '#ef4444';
    }
  }

  // ─── Status & Error Screens ───

  private showStatus(message: string): void {
    this.root.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'width:100%;height:100%;background:#0f172a;font-family:system-ui,sans-serif;';

    const spinner = document.createElement('div');
    spinner.style.cssText =
      'width:48px;height:48px;border:4px solid rgba(99,102,241,0.3);' +
      'border-top-color:#6366f1;border-radius:50%;margin-bottom:1.5rem;' +
      'animation:spin 1s linear infinite;';
    wrapper.appendChild(spinner);

    const style = document.createElement('style');
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    wrapper.appendChild(style);

    const text = document.createElement('p');
    text.textContent = message;
    text.style.cssText = 'color:#94a3b8;font-size:1.2rem;text-align:center;max-width:500px;';
    wrapper.appendChild(text);

    this.root.appendChild(wrapper);
  }

  private hideStatus(): void {
    // Status will be cleared when playback starts
  }

  private showError(message: string): void {
    this.state = 'error';
    this.root.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'width:100%;height:100%;background:#0f172a;font-family:system-ui,sans-serif;';

    const icon = document.createElement('div');
    icon.textContent = '⚠';
    icon.style.cssText = 'font-size:3rem;margin-bottom:1rem;';
    wrapper.appendChild(icon);

    const title = document.createElement('h2');
    title.textContent = 'Connection Error';
    title.style.cssText = 'color:#ef4444;font-size:1.5rem;margin-bottom:0.75rem;';
    wrapper.appendChild(title);

    const text = document.createElement('p');
    text.textContent = message;
    text.style.cssText = 'color:#94a3b8;font-size:1rem;text-align:center;max-width:500px;margin-bottom:1.5rem;';
    wrapper.appendChild(text);

    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry';
    retryBtn.style.cssText =
      'padding:0.75rem 2rem;background:#6366f1;color:#fff;border:none;' +
      'border-radius:0.5rem;font-size:1rem;cursor:pointer;';
    retryBtn.onclick = () => {
      this.consecutiveHandshakeFailures = 0;
      this.performHandshake();
    };
    wrapper.appendChild(retryBtn);

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Configuration';
    resetBtn.style.cssText =
      'padding:0.5rem 1.5rem;background:transparent;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);' +
      'border-radius:0.5rem;font-size:0.875rem;cursor:pointer;margin-top:0.75rem;';
    resetBtn.onclick = () => {
      localStorage.clear();
      window.location.reload();
    };
    wrapper.appendChild(resetBtn);

    this.root.appendChild(wrapper);
  }

  // ─── Cleanup ───

  async destroy(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.operatingHoursTimer) clearInterval(this.operatingHoursTimer);

    this.player?.stop();
    await this.signalRClient?.stop();
    await this.cmsClient?.stop();

    // Final sync before shutdown
    if (this.impressionTracker && this.api) {
      const pending = await this.impressionTracker.getPending();
      if (pending.length > 0) {
        await this.api.syncImpressions(
          pending.map((imp) => ({
            slotPlayKey: imp.slotPlayKey,
            bookingId: imp.bookingId,
            campaignId: imp.campaignId,
            creativeId: imp.creativeId,
            ownerContentId: imp.ownerContentId,
            slotNumber: imp.slotNumber,
            playedAt: imp.playedAt,
            durationSeconds: imp.durationSeconds,
            isFillerContent: imp.isFillerContent,
          }))
        );
      }
    }

    if (this.statusOverlay) {
      this.statusOverlay.remove();
    }

    console.log('[App] Player destroyed');
  }
}
