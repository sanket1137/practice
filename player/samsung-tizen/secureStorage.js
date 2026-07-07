/* Samsung Tizen SecureStorage
 * Uses tizen.keymanager for encrypted key-value storage.
 * Falls back to localStorage in browser dev mode.
 */

const DEVICE_TOKEN_KEY = 'pixelspot_device_token';
const SERVER_URL_KEY = 'pixelspot_server_url';
const DEFAULT_SERVER = 'https://ccms.pixelspot.in';
const KEY_ALIAS = 'PixelSpotPlayer';

const isTizen = typeof tizen !== 'undefined';

const SecureStorage = {
  _read(key) {
    try {
      if (isTizen && tizen.keymanager) {
        // tizen.keymanager stores DataItem; use getDataAlias to list, getData to retrieve
        const data = tizen.keymanager.getDataAlias ? 
          tizen.keymanager.getData({ name: `${KEY_ALIAS}_${key}`, password: '' }) : null;
        if (data) {
          const arr = new Uint8Array(data);
          return new TextDecoder().decode(arr);
        }
      }
    } catch (e) { /* fallthrough */ }
    return localStorage.getItem(key);
  },

  _write(key, value) {
    try {
      if (isTizen && tizen.keymanager) {
        const encoded = new TextEncoder().encode(value);
        tizen.keymanager.saveData(
          `${KEY_ALIAS}_${key}`, encoded.buffer, null,
          () => {}, (e) => console.error('Keymanager write error:', e)
        );
        return;
      }
    } catch (e) { /* fallthrough */ }
    localStorage.setItem(key, value);
  },

  _delete(key) {
    try {
      if (isTizen && tizen.keymanager) {
        tizen.keymanager.removeAlias({ name: `${KEY_ALIAS}_${key}`, packageId: '', isProtected: false });
        return;
      }
    } catch (e) { /* fallthrough */ }
    localStorage.removeItem(key);
  },

  getDeviceToken() { return Promise.resolve(this._read(DEVICE_TOKEN_KEY)); },
  setDeviceToken(token) { this._write(DEVICE_TOKEN_KEY, token); return Promise.resolve(); },
  clearDeviceToken() { this._delete(DEVICE_TOKEN_KEY); return Promise.resolve(); },
  getServerUrl() { return Promise.resolve(this._read(SERVER_URL_KEY) ?? DEFAULT_SERVER); },
  setServerUrl(url) { this._write(SERVER_URL_KEY, url); return Promise.resolve(); },
};

window.SecureStorage = SecureStorage;
