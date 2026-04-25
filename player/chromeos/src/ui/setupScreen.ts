/**
 * First-run setup screen for entering Screen ID, API key, and server URL.
 */
import { saveConfig, type PlayerConfig } from '../config';
import { claimPairingCode } from '../api/playerApi';
import { generateFingerprint } from '../security/fingerprint';

export class SetupScreen {
  static readonly SERVER_URL = 'https://ccms.pixelspot.in';
  private readonly container: HTMLElement;
  private onComplete: ((config: PlayerConfig) => void) | null = null;

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
    pairBtn.textContent = 'Have a pairing code?';
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
    const raw = window.prompt('Enter the 6-character pairing code shown in the dashboard:');
    if (!raw) return;
    const code = raw.trim().toUpperCase();
    if (code.length !== 6) {
      this.showError('Pairing code must be exactly 6 characters.');
      return;
    }
    try {
      const fingerprint = await generateFingerprint();
      const res = await claimPairingCode(SetupScreen.SERVER_URL, code, fingerprint);
      const config: PlayerConfig = {
        serverUrl: SetupScreen.SERVER_URL,
        screenId: res.screenId,
        apiKey: res.apiKey,
      };
      saveConfig(config);
      this.onComplete?.(config);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.showError(`Pairing failed: ${msg}`);
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
