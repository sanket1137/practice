/**
 * First-run setup screen for entering Screen ID, API key, and server URL.
 */
import { saveConfig, type PlayerConfig } from '../config';
import { getPlayerPairingStatus, requestPlayerPairingToken } from '../api/playerApi';
import { generateFingerprint } from '../security/fingerprint';
import qrcode from 'qrcode-generator';

export class SetupScreen {
  static readonly SERVER_URL = 'https://ccms.pixelspot.in';
  private readonly container: HTMLElement;
  private onComplete: ((config: PlayerConfig) => void) | null = null;
  private pairingPollTimer: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  show(): Promise<PlayerConfig> {
    return new Promise((resolve) => {
      this.onComplete = resolve;
      this.render();
    });
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.style.cssText =
      'display:flex;align-items:center;justify-content:center;width:100%;height:100%;' +
      'background:#0f172a;font-family:system-ui,sans-serif;';

    const form = document.createElement('form');
    form.style.cssText =
      'background:#1e293b;padding:2rem;border-radius:0.75rem;width:400px;';

    const title = document.createElement('h2');
    title.textContent = 'PixelSpot CCMS Player Setup';
    title.style.cssText = 'color:#f8fafc;margin-bottom:1.5rem;text-align:center;';
    form.appendChild(title);

    const screenInput = this.createInput('Screen ID', 'Enter screen ID...');
    const apiKeyInput = this.createInput('API Key', 'Enter API key...');

    const helpText = document.createElement('p');
    helpText.textContent =
      'Find your Screen ID and API Key in the CCMS dashboard under Screen Details \u2192 Generate API Key.';
    helpText.style.cssText =
      'color:#64748b;font-size:0.75rem;margin-bottom:1rem;line-height:1.4;text-align:center;';
    form.appendChild(helpText);

    form.appendChild(screenInput.wrapper);
    form.appendChild(apiKeyInput.wrapper);

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = 'Connect';
    btn.style.cssText =
      'width:100%;padding:0.75rem;background:#6366f1;color:#fff;border:none;' +
      'border-radius:0.5rem;font-size:1rem;cursor:pointer;margin-top:1rem;';

    form.appendChild(btn);

    // Pairing-code flow (CMS owner screens)
    const divider = document.createElement('p');
    divider.textContent = 'or';
    divider.style.cssText = 'color:#64748b;font-size:0.75rem;margin:1rem 0 0.5rem;text-align:center;';
    form.appendChild(divider);

    const pairBtn = document.createElement('button');
    pairBtn.type = 'button';
    pairBtn.textContent = 'Show registration QR';
    pairBtn.style.cssText =
      'width:100%;padding:0.65rem;background:transparent;color:#6366f1;' +
      'border:1px solid #6366f1;border-radius:0.5rem;font-size:0.9rem;cursor:pointer;';
    pairBtn.onclick = () => this.handlePairingFlow();
    form.appendChild(pairBtn);

    const errorBox = document.createElement('p');
    errorBox.id = 'setup-error';
    errorBox.style.cssText =
      'color:#ef4444;font-size:0.8rem;margin-top:0.75rem;text-align:center;display:none;';
    form.appendChild(errorBox);

    form.onsubmit = (e) => {
      e.preventDefault();
      const config: PlayerConfig = {
        serverUrl: SetupScreen.SERVER_URL,
        screenId: screenInput.input.value.trim(),
        apiKey: apiKeyInput.input.value.trim(),
      };
      if (config.screenId && config.apiKey) {
        saveConfig(config);
        this.onComplete?.(config);
      }
    };

    this.container.appendChild(form);
  }

  private async handlePairingFlow(): Promise<void> {
    this.clearPairingTimer();

    this.container.innerHTML = '';
    this.container.style.cssText =
      'display:flex;align-items:center;justify-content:center;width:100%;height:100%;' +
      'background:#0f172a;font-family:system-ui,sans-serif;';

    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'background:#1e293b;padding:2rem;border-radius:0.75rem;width:440px;text-align:center;';

    const title = document.createElement('h2');
    title.textContent = 'Scan to register this player';
    title.style.cssText = 'color:#f8fafc;margin-bottom:0.5rem;';
    wrapper.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Open PixelSpot app/dashboard, scan this QR, and complete registration.';
    subtitle.style.cssText = 'color:#94a3b8;font-size:0.9rem;margin:0 0 1rem;';
    wrapper.appendChild(subtitle);

    const qrHost = document.createElement('div');
    qrHost.style.cssText = 'display:flex;justify-content:center;margin:0 auto 1rem;';
    wrapper.appendChild(qrHost);

    const status = document.createElement('p');
    status.style.cssText = 'color:#94a3b8;font-size:0.85rem;margin:0.75rem 0;';
    status.textContent = 'Generating QR...';
    wrapper.appendChild(status);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = 'Back';
    backBtn.style.cssText =
      'width:100%;padding:0.65rem;background:transparent;color:#6366f1;border:1px solid #6366f1;' +
      'border-radius:0.5rem;font-size:0.9rem;cursor:pointer;margin-top:0.5rem;';
    backBtn.onclick = () => {
      this.clearPairingTimer();
      this.render();
    };
    wrapper.appendChild(backBtn);

    this.container.appendChild(wrapper);

    try {
      const fingerprint = await generateFingerprint();
      const tokenRes = await requestPlayerPairingToken(SetupScreen.SERVER_URL, fingerprint);

      const qr = qrcode(0, 'L');
      qr.addData(tokenRes.qrContent);
      qr.make();

      const svgMarkup = qr.createSvgTag({
        scalable: true,
        margin: 2,
        cellSize: 6,
      });

      qrHost.innerHTML = svgMarkup;
      status.textContent = 'Waiting for dashboard claim...';

      this.pairingPollTimer = window.setInterval(async () => {
        try {
          const pairingStatus = await getPlayerPairingStatus(SetupScreen.SERVER_URL, tokenRes.token);

          if (pairingStatus.isExpired) {
            this.clearPairingTimer();
            status.textContent = 'QR expired. Please go back and generate a new QR.';
            return;
          }

          if (pairingStatus.isClaimed && pairingStatus.screenId && pairingStatus.apiKey) {
            this.clearPairingTimer();
            status.textContent = 'Paired successfully. Starting player...';

            const config: PlayerConfig = {
              serverUrl: SetupScreen.SERVER_URL,
              screenId: pairingStatus.screenId,
              apiKey: pairingStatus.apiKey,
            };
            saveConfig(config);
            this.onComplete?.(config);
          }
        } catch (pollErr) {
          const msg = pollErr instanceof Error ? pollErr.message : String(pollErr);
          status.textContent = `Waiting for claim... (${msg})`;
        }
      }, 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.render();
      this.showError(`Pairing failed: ${msg}`);
    }
  }

  private clearPairingTimer(): void {
    if (this.pairingPollTimer !== null) {
      clearInterval(this.pairingPollTimer);
      this.pairingPollTimer = null;
    }
  }

  private showError(message: string): void {
    const box = document.getElementById('setup-error');
    if (box) {
      box.textContent = message;
      box.style.display = 'block';
    }
  }

  private createInput(
    label: string,
    placeholder: string
  ): { wrapper: HTMLDivElement; input: HTMLInputElement } {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom:1rem;';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.cssText = 'display:block;color:#94a3b8;font-size:0.875rem;margin-bottom:0.25rem;';
    wrapper.appendChild(lbl);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.required = true;
    input.style.cssText =
      'width:100%;padding:0.5rem 0.75rem;background:#0f172a;color:#f8fafc;' +
      'border:1px solid rgba(255,255,255,0.1);border-radius:0.375rem;font-size:1rem;' +
      'box-sizing:border-box;';
    wrapper.appendChild(input);

    return { wrapper, input };
  }
}
