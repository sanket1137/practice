/* PixelSpot LG webOS Player — pairing logic */

const Pairing = (() => {
  let pollTimer = null;
  let currentCode = null;
  let serverUrl = 'https://ccms.pixelspot.in';

  async function show() {
    serverUrl = await SecureStorage.getServerUrl();
    document.getElementById('player-container').style.display = 'none';
    document.getElementById('pairing-container').style.display = 'flex';
    await requestCode();
  }

  async function requestCode() {
    const fingerprintEl = document.getElementById('fingerprint');
    const fingerprint = fingerprintEl?.textContent || 'lgwebos-' + Math.random().toString(36).substr(2, 8);
    try {
      const res = await fetch(`${serverUrl}/api/v1/players/pairing/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceFingerprint: fingerprint }),
      });
      const data = await res.json();
      currentCode = data.code;
      document.getElementById('pairing-code').textContent = currentCode;
      renderQR(currentCode);
      startPolling(currentCode);
    } catch (e) {
      document.getElementById('pairing-status').textContent = 'Connection failed. Retrying...';
      setTimeout(requestCode, 10000);
    }
  }

  function startPolling(code) {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`${serverUrl}/api/v1/players/pairing/status?code=${code}`);
        const data = await res.json();
        if (data.isPaired && data.deviceToken) {
          clearInterval(pollTimer);
          await SecureStorage.setDeviceToken(data.deviceToken);
          document.getElementById('pairing-container').style.display = 'none';
          document.getElementById('player-container').style.display = 'block';
          Player.onPaired(data.deviceToken);
        }
      } catch (e) { /* ignore */ }
    }, 5000);
  }

  function renderQR(text) {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas || !window.QRCode) return;
    QRCode.toCanvas(canvas, text, { width: 200, margin: 1 }, (err) => {
      if (err) console.error('QR render error:', err);
    });
  }

  async function submitManualCode() {
    const input = document.getElementById('manual-code-input');
    const code = input?.value?.trim().toUpperCase();
    if (!code || code.length < 6) return;
    const fingerprint = 'lgwebos-manual';
    try {
      const res = await fetch(`${serverUrl}/api/v1/players/pairing/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, deviceFingerprint: fingerprint }),
      });
      const data = await res.json();
      if (data.success && data.deviceToken) {
        clearInterval(pollTimer);
        await SecureStorage.setDeviceToken(data.deviceToken);
        document.getElementById('pairing-container').style.display = 'none';
        document.getElementById('player-container').style.display = 'block';
        Player.onPaired(data.deviceToken);
      } else {
        document.getElementById('pairing-status').textContent = 'Invalid code. Try again.';
      }
    } catch (e) {
      document.getElementById('pairing-status').textContent = 'Error. Check connection.';
    }
  }

  return { show, submitManualCode };
})();
