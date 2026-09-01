// PixelSpot CCMS service worker — deliberately minimal.
// Its job is installability (home-screen app), NOT offline caching: the
// console is a live dashboard where a stale cached shell is worse than a
// network error, so every request goes straight to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
    // Intentionally empty: default network handling. The handler's presence
    // is what makes the app installable.
});
