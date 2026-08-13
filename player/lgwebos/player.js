/* PixelSpot LG webOS Player — playback engine */

const Player = (() => {
  let playlist = [];
  let currentIndex = 0;
  let heartbeatTimer = null;
  let deviceToken = null;
  let serverUrl = 'https://ccms.pixelspot.in';

  const videoEl = document.getElementById('player-video');
  const imageEl = document.getElementById('player-image');

  async function init() {
    serverUrl = await SecureStorage.getServerUrl();
    deviceToken = await SecureStorage.getDeviceToken();
    if (!deviceToken) {
      Pairing.show();
      return;
    }
    await syncManifest();
    startHeartbeat();
  }

  async function syncManifest() {
    try {
      const res = await fetch(`${serverUrl}/api/v1/players/manifest`, {
        headers: { 'Authorization': `Bearer ${deviceToken}` },
      });
      if (!res.ok) {
        if (res.status === 401) { Pairing.show(); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      playlist = await res.json();
      currentIndex = 0;
      playNext();
    } catch (e) {
      console.error('Manifest sync failed:', e);
      setTimeout(syncManifest, 30000);
    }
  }

  function playNext() {
    if (!playlist.length) return;
    const item = playlist[currentIndex % playlist.length];
    currentIndex++;

    if (item.type === 'video') {
      imageEl.style.display = 'none';
      videoEl.style.display = 'block';
      videoEl.src = item.r2Url;
      videoEl.play();
      videoEl.onended = () => playNext();
    } else {
      videoEl.style.display = 'none';
      videoEl.pause();
      imageEl.style.display = 'block';
      imageEl.src = item.r2Url;
      setTimeout(() => playNext(), (item.durationSeconds || 10) * 1000);
    }
  }

  function startHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
      try {
        const res = await fetch(`${serverUrl}/api/v1/players/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deviceToken}`,
          },
          body: JSON.stringify({ currentContentId: null, playerVersion: 'lgwebos-1.0' }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.manifestChanged) await syncManifest();
        if (data.command) handleCommand(data.command);
      } catch (e) { /* transient error */ }
    }, 30000);
  }

  function handleCommand(cmd) {
    switch (cmd.commandType?.toLowerCase()) {
      case 'unpair':
        clearInterval(heartbeatTimer);
        SecureStorage.clearDeviceToken();
        Pairing.show();
        break;
      case 'refreshmanifest':
        syncManifest();
        break;
    }
  }

  return { init, onPaired: (token) => { deviceToken = token; init(); } };
})();

document.addEventListener('DOMContentLoaded', () => Player.init());
