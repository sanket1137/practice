import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'

import './i18n'
import './index.css'
import './tailwind.css'
import App from './App.tsx'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN ?? '',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
  environment: import.meta.env.MODE,
  beforeSend(event) {
    // Strip PII from breadcrumbs
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
})

// Stale-chunk self-healing: after a deploy, a still-open session references
// old hashed chunk files that no longer exist, so the next lazy navigation
// throws "Failed to fetch dynamically imported module". Vite surfaces that as
// vite:preloadError — reload once to pick up the fresh app shell instead of
// stranding the user on an error page. One-shot guard prevents reload loops
// when the network itself is down.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'ps-chunk-reload-at';
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return; // already tried recently — let the error surface
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage unavailable — still better to reload once */ }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA installability: register the minimal service worker (network-passthrough,
// no caching — see public/sw.js). Registered from the bundle rather than an
// inline script because index.html's inline scripts are CSP-hash-pinned.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: the app works identically without it.
    });
  });
}
