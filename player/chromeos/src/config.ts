/**
 * Player configuration stored in localStorage.
 * Set via the setup screen on first run.
 */
export interface PlayerConfig {
  screenId: string;
  apiKey: string;
  serverUrl: string;
}

const STORAGE_KEY = 'ccms_player_config';

export function getConfig(): PlayerConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlayerConfig;
    if (parsed.screenId && parsed.apiKey && parsed.serverUrl) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveConfig(config: PlayerConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
