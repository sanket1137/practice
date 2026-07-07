/* PixelSpot Samsung Tizen Player — pairing */

const Pairing = (() => {
  let pollTimer = null;
  let serverUrl = 'https://ccms.pixelspot.in';

  async function show() {
    serverUrl = await SecureStorage.getServerUrl();
    document.getElementById('player-container').style.display = 'none';
    document.getElementById('pairing-container').style.display = 'flex';
    await requestCode();
  }

  async function requestCode() {
    const fingerprint = await Player.getTizenDeviceId();
    try {
      const res = await fetch(`${serverUrl}/api/v1/players/pairing/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceFingerprint: fingerprint }),
      });
      const data = await res.json();
      document.getElementById('pairing-code').textContent = data.code;
      renderQR(data.code);
      startPolling(data.code);
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
    QRCode.toCanvas(canvas, text, { width: 200, margin: 1 }, () => {});
  }

  async function submitManualCode() {
    const input = document.getElementById('manual-code-input');
    const code = input?.value?.trim().toUpperCase();
    if (!code || code.length < 6) return;
    const fingerprint = await Player.getTizenDeviceId();
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
