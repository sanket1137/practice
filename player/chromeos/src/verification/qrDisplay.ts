/**
 * QR code display for screen verification.
 * Renders a QR code on a fullscreen canvas with instructions.
 */
import { VerificationApi } from '../api/verificationApi';
import type { PlayerConfig } from '../config';

// Use a simple QR generation via the qrcode-generator library
// Or fallback to a Canvas-based minimal implementation
type QrInstance = {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- qrcode-generator typings mismatch
type QrFactory = (typeNumber: any, errorCorrectionLevel: any) => QrInstance;

let qrGenerator: QrFactory | null = null;
let qrLoadAttempted = false;

async function loadQrGenerator(): Promise<QrFactory | null> {
  if (qrLoadAttempted) return qrGenerator;
  qrLoadAttempted = true;
  try {
    const mod = await import('qrcode-generator');
    qrGenerator = mod.default ?? mod;
  } catch {
    console.warn('[QR] qrcode-generator not available, using API fallback');
  }
  return qrGenerator;
}

export class QrVerificationScreen {
  private readonly container: HTMLElement;
  private readonly api: VerificationApi;
  private canvas: HTMLCanvasElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private running = false;
  private qrRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private statusPollTimer: ReturnType<typeof setInterval> | null = null;
  private onVerified: (() => void) | null = null;

  constructor(container: HTMLElement, config: PlayerConfig) {
    this.container = container;
    this.api = new VerificationApi(config);
  }

  /** Start the verification display. Resolves when verified. */
  start(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.onVerified = resolve;
      this.running = true;
      this.render();
      this.refreshQr();

      // Refresh QR every 4 minutes
      this.qrRefreshTimer = setInterval(() => this.refreshQr(), 240_000);

      // Poll status every 10 seconds
      this.statusPollTimer = setInterval(() => this.pollStatus(), 10_000);
    });
  }

  stop(): void {
    this.running = false;
    if (this.qrRefreshTimer) clearInterval(this.qrRefreshTimer);
    if (this.statusPollTimer) clearInterval(this.statusPollTimer);
    this.container.innerHTML = '';
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'width:100%;height:100%;background:#0f172a;font-family:system-ui,sans-serif;';

    const title = document.createElement('h1');
    title.textContent = 'Screen Verification Required';
    title.style.cssText = 'color:#f8fafc;font-size:2rem;margin-bottom:1rem;';
    this.container.appendChild(title);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 500;
    this.canvas.height = 500;
    this.canvas.style.cssText = 'margin:1rem 0;';
    this.container.appendChild(this.canvas);

    const instructions = document.createElement('p');
    instructions.textContent =
      'Scan this QR code with your phone to verify this screen.';
    instructions.style.cssText = 'color:#94a3b8;font-size:1.2rem;text-align:center;max-width:600px;';
    this.container.appendChild(instructions);

    const instructions2 = document.createElement('p');
    instructions2.textContent =
      'You will need to record a short video showing the QR on screen and a 360° pan of the surroundings.';
    instructions2.style.cssText = 'color:#94a3b8;font-size:1rem;text-align:center;max-width:600px;margin-top:0.5rem;';
    this.container.appendChild(instructions2);

    this.statusEl = document.createElement('div');
    this.statusEl.textContent = 'Waiting for verification...';
    this.statusEl.style.cssText = 'color:#6366f1;font-size:1rem;margin-top:2rem;';
    this.container.appendChild(this.statusEl);
  }

  private async refreshQr(): Promise<void> {
    if (!this.running) return;

    // Ensure QR generator is loaded
    await loadQrGenerator();

    const challenge = await this.api.requestQrChallenge();
    if (!challenge || !challenge.qrContent) {
      console.error('[QR] Failed to get challenge');
      return;
    }

    this.drawQr(challenge.qrContent);
    console.log(`[QR] Challenge refreshed, expires: ${challenge.expiresAt}`);
  }

  private drawQr(content: string): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const size = this.canvas.width;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    if (qrGenerator) {
      // Use qrcode-generator
      const qr = qrGenerator(0, 'H');
      qr.addData(content);
      qr.make();

      const moduleCount = qr.getModuleCount();
      const cellSize = Math.floor((size - 40) / moduleCount);
      const offset = Math.floor((size - cellSize * moduleCount) / 2);

      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          ctx.fillStyle = qr.isDark(row, col) ? '#ffffff' : '#0f172a';
          ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
        }
      }
    } else {
      // Fallback: display URL as text
      ctx.fillStyle = '#f8fafc';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('QR library not loaded', size / 2, size / 2 - 10);
      ctx.fillText(content.substring(0, 60), size / 2, size / 2 + 20);
    }
  }

  private async pollStatus(): Promise<void> {
    if (!this.running) return;

    const status = await this.api.getStatus();
    if (!status || !this.statusEl) return;

    switch (status.status) {
      case 'Verified':
        this.statusEl.textContent = 'Verified! Starting playback...';
        this.statusEl.style.color = '#22c55e';
        this.stop();
        this.onVerified?.();
        break;
      case 'PendingReview':
        this.statusEl.textContent = 'Verification submitted — awaiting admin review...';
        this.statusEl.style.color = '#f59e0b';
        break;
      case 'Rejected':
        this.statusEl.textContent = 'Verification rejected. Please scan the new QR.';
        this.statusEl.style.color = '#ef4444';
        this.refreshQr();
        break;
      default:
        this.statusEl.textContent = 'Waiting for verification...';
        this.statusEl.style.color = '#6366f1';
    }
  }
}
