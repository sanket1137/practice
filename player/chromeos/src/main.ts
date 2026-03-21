/**
 * Entry point for CCMS ChromeOS Player.
 * Initializes the App orchestrator and handles PWA service worker registration.
 */
import { App } from './app';

async function bootstrap(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) {
    console.error('[main] #app element not found');
    return;
  }

  // Register service worker for PWA / offline caching
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[SW] Registered:', registration.scope);
    } catch (err) {
      console.warn('[SW] Registration failed:', err);
    }
  }

  // Prevent screen from sleeping (Wake Lock API)
  if ('wakeLock' in navigator) {
    try {
      await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<unknown> } })
        .wakeLock.request('screen');
      console.log('[main] Wake lock acquired');
    } catch {
      console.warn('[main] Wake lock not available');
    }
  }

  // Start the app
  const app = new App(root);
  await app.start();

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    app.destroy().catch(console.error);
  });
}

bootstrap().catch((err) => {
  console.error('[main] Fatal error:', err);
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;' +
      'background:#0f172a;font-family:system-ui,sans-serif;">' +
      '<p style="color:#ef4444;font-size:1.2rem;">Fatal error. Check console for details.</p></div>';
  }
});
