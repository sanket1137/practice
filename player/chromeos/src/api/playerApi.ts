/**
 * REST API client for CCMS player endpoints.
 */
import type { PlayerConfig } from '../config';

// ── Response types ──

export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T | null;
  errors: string[];
}

export interface PlaylistItem {
  slotNumber: number;
  bookingId: string | null;
  campaignId: string | null;
  creativeId: string | null;
  ownerContentId: string | null;
  creativeUrl: string;
  creativeMimeType: string | null;
  isFillerContent: boolean;
  startTime: string;
  endTime: string;
}

export interface PlaylistResponse {
  playlist: PlaylistItem[];
  slotsPerFrame: number;
}

export interface CmsMediaAssetDto {
  id: string;
  originalName: string;
  mimeType: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  isReady: boolean;
}

export interface CmsPlaylistItemDto {
  id: string;
  mediaAssetId: string;
  itemType: string;
  order: number;
  durationSeconds: number | null;
  mediaAsset: CmsMediaAssetDto | null;
}

export interface CmsPlaylistDto {
  id: string;
  screenId: string;
  name: string;
  playlistType: string;
  version: number;
  isDefault: boolean;
  lastPublishedAt: string | null;
  items: CmsPlaylistItemDto[];
}

export interface HandshakeResponse {
  success: boolean;
  message: string | null;
  serverTime: string;
  playlist: PlaylistResponse | null;
  syncIntervalMinutes: number;
  screenTimezone: string | null;
  operatingHours: Record<string, string> | null;
  sessionToken: string | null;
  serverSalt: string | null;
  sessionExpiresAt: string | null;
  verificationSalt: string | null;
  deviceBindingStatus: string | null;
  verificationMode: boolean;
  verificationStatus: string | null;
  qrChallengeUrl: string | null;
  // CMS-mode fields (populated only for CmsOwner screens)
  cmsPlaylist: CmsPlaylistDto | null;
  screenMode: string | null;
}

export interface ClaimPairingCodeResponse {
  screenId: string;
  apiKey: string;
  screenName: string | null;
}

interface SyncImpression {
  slotPlayKey: string;
  bookingId: string | null;
  campaignId: string | null;
  creativeId: string | null;
  ownerContentId: string | null;
  slotNumber: number;
  playedAt: string;
  durationSeconds: number;
  isFillerContent: boolean;
}

// ── API Client ──

export class PlayerApi {
  private readonly baseUrl: string;
  private readonly config: PlayerConfig;

  constructor(config: PlayerConfig) {
    this.config = config;
    this.baseUrl = config.serverUrl.replace(/\/+$/, '');
  }

  async handshake(deviceFingerprint: string): Promise<HandshakeResponse | null> {
    try {
      const nonce = crypto.randomUUID();
      const timestamp = Math.floor(Date.now() / 1000);

      const res = await fetch(`${this.baseUrl}/api/v1/player/handshake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenId: this.config.screenId,
          apiKey: this.config.apiKey,
          deviceFingerprint,
          nonce,
          timestamp,
          playerVersion: '1.0.0-chromeos',
        }),
      });

      if (!res.ok) return null;
      const json = (await res.json()) as ApiResponse<HandshakeResponse>;
      return json.data ?? null;
    } catch (e) {
      console.error('[API] Handshake error:', e);
      return null;
    }
  }

  async sendHeartbeat(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/v1/player/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenId: this.config.screenId,
          apiKey: this.config.apiKey,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn('[API] Heartbeat error:', e);
    }
  }

  async syncImpressions(impressions: SyncImpression[]): Promise<boolean> {
    if (impressions.length === 0) return true;
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/player/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenId: this.config.screenId,
          apiKey: this.config.apiKey,
          syncData: {
            playerVersion: '1.0.0-chromeos',
            impressions,
          },
        }),
      });
      return res.ok;
    } catch (e) {
      console.error('[API] Sync error:', e);
      return false;
    }
  }
}

/**
 * Claim a 6-character CMS pairing code. Anonymous endpoint — no existing
 * credentials required. On success the caller should persist the returned
 * { screenId, apiKey } into PlayerConfig and restart the handshake flow.
 */
export async function claimPairingCode(
  serverUrl: string,
  code: string,
  deviceFingerprint: string
): Promise<ClaimPairingCodeResponse> {
  const baseUrl = serverUrl.replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/api/v1/cms/pairing/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      deviceFingerprint,
      deviceModel: 'chromeos',
      osVersion: navigator.userAgent,
      appVersion: '1.0.0-chromeos',
    }),
  });
  const envelope = (await res.json()) as ApiResponse<ClaimPairingCodeResponse>;
  if (!res.ok || !envelope.success || !envelope.data) {
    throw new Error(envelope.message || `HTTP ${res.status}`);
  }
  return envelope.data;
}
