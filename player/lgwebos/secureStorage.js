/* LG webOS SecureStorage
 * Uses webOS luna service for encrypted persistent storage.
 * Falls back to localStorage in browser/dev mode.
 */

const DEVICE_TOKEN_KEY = 'pixelspot_device_token';
const SERVER_URL_KEY = 'pixelspot_server_url';
const DEFAULT_SERVER = 'https://ccms.pixelspot.in';

const isWebOS = typeof webOS !== 'undefined';

const SecureStorage = {
  getDeviceToken() {
    if (isWebOS) {
      return new Promise((resolve) => {
        webOS.service.request('luna://com.webos.service.db', {
          method: 'find',
          parameters: { query: { from: 'in.pixelspot.player.settings:1', where: [{ prop: 'key', op: '=', val: DEVICE_TOKEN_KEY }] } },
          onSuccess: (res) => resolve(res.results?.[0]?.value ?? null),
          onFailure: () => resolve(null),
        });
      });
    }
    return Promise.resolve(localStorage.getItem(DEVICE_TOKEN_KEY));
  },

  setDeviceToken(token) {
    if (isWebOS) {
      webOS.service.request('luna://com.webos.service.db', {
        method: 'put',
        parameters: { objects: [{ _kind: 'in.pixelspot.player.settings:1', key: DEVICE_TOKEN_KEY, value: token }] },
        onSuccess: () => {},
        onFailure: () => {},
      });
    } else {
      localStorage.setItem(DEVICE_TOKEN_KEY, token);
    }
  },

  clearDeviceToken() {
    if (isWebOS) {
      webOS.service.request('luna://com.webos.service.db', {
        method: 'delKind',
        parameters: { id: 'in.pixelspot.player.settings:1' },
        onSuccess: () => {},
        onFailure: () => {},
      });
    } else {
      localStorage.removeItem(DEVICE_TOKEN_KEY);
    }
  },

  getServerUrl() {
    if (isWebOS) {
      return new Promise((resolve) => {
        webOS.service.request('luna://com.webos.service.db', {
          method: 'find',
          parameters: { query: { from: 'in.pixelspot.player.settings:1', where: [{ prop: 'key', op: '=', val: SERVER_URL_KEY }] } },
          onSuccess: (res) => resolve(res.results?.[0]?.value ?? DEFAULT_SERVER),
          onFailure: () => resolve(DEFAULT_SERVER),
        });
      });
    }
    return Promise.resolve(localStorage.getItem(SERVER_URL_KEY) ?? DEFAULT_SERVER);
  },
};

window.SecureStorage = SecureStorage;
