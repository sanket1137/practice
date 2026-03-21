/**
 * Device fingerprint generator using Web APIs.
 * Produces a stable SHA-256 hash from canvas, screen, and UA properties.
 */
export async function generateFingerprint(): Promise<string> {
  const components: string[] = [];

  // Screen properties
  components.push(`${screen.width}x${screen.height}`);
  components.push(`${screen.colorDepth}`);
  components.push(`${devicePixelRatio}`);

  // User agent
  components.push(navigator.userAgent);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('PixelSpot CCMS Fingerprint', 2, 15);
      components.push(canvas.toDataURL());
    }
  } catch {
    // Canvas fingerprinting blocked
  }

  // Hardware concurrency
  components.push(`cores:${navigator.hardwareConcurrency ?? 0}`);

  // Language
  components.push(navigator.language);

  const raw = components.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
