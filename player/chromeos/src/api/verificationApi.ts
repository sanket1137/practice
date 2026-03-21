/**
 * Verification API client for QR challenge and status polling.
 */
import type { PlayerConfig } from '../config';

export interface QrChallengeResponse {
  code: string;
  expiresAt: string;
  qrContent: string;
}

export interface VerificationStatusResponse {
  status: string;
  canPlay: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
}

export class VerificationApi {
  private readonly baseUrl: string;
  private readonly config: PlayerConfig;

  constructor(config: PlayerConfig) {
    this.config = config;
    this.baseUrl = config.serverUrl.replace(/\/+$/, '');
  }

  async requestQrChallenge(): Promise<QrChallengeResponse | null> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/screens/${this.config.screenId}/verification/qr-challenge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: this.config.apiKey }),
        }
      );
      if (!res.ok) return null;
      const json = (await res.json()) as ApiResponse<QrChallengeResponse>;
      return json.data ?? null;
    } catch (e) {
      console.error('[VerificationAPI] QR challenge error:', e);
      return null;
    }
  }

  async getStatus(): Promise<VerificationStatusResponse | null> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/screens/${this.config.screenId}/verification/status`
      );
      if (!res.ok) return null;
      const json = (await res.json()) as ApiResponse<VerificationStatusResponse>;
      return json.data ?? null;
    } catch (e) {
      console.warn('[VerificationAPI] Status poll error:', e);
      return null;
    }
  }
}
