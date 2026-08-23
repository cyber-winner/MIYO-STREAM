// Platform detection + unified native HTTP entry point.
// Modes:
//  - 'web'       : the website. Everything goes through the Express server (/api/*). Unchanged behavior.
//  - 'tauri'     : Windows/Linux desktop app. Direct native HTTP (Rust reqwest).
//  - 'capacitor' : Android app. Direct native HTTP (OkHttp).

let cachedPlatform = null;

export function getPlatform() {
  if (cachedPlatform) return cachedPlatform;
  if (typeof window !== 'undefined') {
    if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
      cachedPlatform = 'tauri';
    } else if (window.Capacitor?.isNativePlatform?.()) {
      cachedPlatform = 'capacitor';
    } else {
      cachedPlatform = 'web';
    }
  } else {
    cachedPlatform = 'web';
  }
  return cachedPlatform;
}

export function isNative() {
  return getPlatform() !== 'web';
}

export function isAndroid() {
  return getPlatform() === 'capacitor';
}

// ---- TMDB API key management (native only; the website uses the server key) ----
const TMDB_KEY_STORAGE = 'miyo_tmdb_api_key';

// Default key — XOR-obfuscated so it doesn't appear as plaintext in the bundle.
// This is NOT security — it's just to prevent casual scraping from source.
const _xk = [0x4d, 0x49, 0x59, 0x4f]; // 'TETO'
const _ed = [0x28,0x28,0x6c,0x7f,0x78,0x7f,0x6f,0x77,0x79,0x2c,0x3c,0x2a,0x7c,0x7b,0x60,0x7d,0x28,0x2d,0x3a,0x29,0x7d,0x28,0x6b,0x2c,0x7c,0x7d,0x6a,0x7e,0x7d,0x7e,0x61,0x29];
function _dk() {
  return _ed.map((b, i) => String.fromCharCode(b ^ _xk[i % _xk.length])).join('');
}

export function getTmdbApiKey() {
  try {
    const userKey = localStorage.getItem(TMDB_KEY_STORAGE);
    if (userKey) return userKey;
  } catch { /* ignore */ }
  // On native platforms, fall back to the built-in shared key
  if (isNative()) return _dk();
  return '';
}

export function isUsingDefaultTmdbKey() {
  try {
    const userKey = localStorage.getItem(TMDB_KEY_STORAGE);
    return isNative() && !userKey;
  } catch {
    return isNative();
  }
}

export function setTmdbApiKey(key) {
  try {
    localStorage.setItem(TMDB_KEY_STORAGE, (key || '').trim());
  } catch { /* ignore */ }
}

export class MissingTmdbKeyError extends Error {
  constructor() {
    super('TMDB API key is not set. Open Settings to add your free TMDB API key.');
    this.name = 'MissingTmdbKeyError';
    this.code = 'MISSING_TMDB_KEY';
  }
}

// ---- Unified native fetch ----
// options: { method, headers, body, binary (bool -> returns ArrayBuffer), timeout }
// Returns: { ok, status, headers: (name)=>value, text(), json(), arrayBuffer() }
export async function platformFetch(url, options = {}) {
  const platform = getPlatform();
  if (platform === 'tauri') {
    const { tauriFetch } = await import('./httpTauri.js');
    return tauriFetch(url, options);
  }
  if (platform === 'capacitor') {
    const { capacitorFetch } = await import('./httpCapacitor.js');
    return capacitorFetch(url, options);
  }
  // Web fallback: plain fetch (headers like Referer will be ignored by the browser,
  // but on web everything goes through the server proxy anyway).
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  });
  return wrapWebResponse(res);
}

function wrapWebResponse(res) {
  return {
    ok: res.ok,
    status: res.status,
    header: (name) => res.headers.get(name),
    text: () => res.text(),
    json: () => res.json(),
    arrayBuffer: () => res.arrayBuffer(),
  };
}

export const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

// ---- YouTube embeds ----
// All platforms now run on a real HTTP origin:
//  - web:       the site's own https origin
//  - capacitor: https://localhost (Capacitor's built-in server)
//  - tauri:     http://localhost:<port> (tauri-plugin-localhost)
// A real origin means the webview sends a valid Referer, so direct
// youtube.com embeds work everywhere — same behavior as the Android app.
export function youTubeEmbedUrl(videoId, params = {}) {
  const qs = new URLSearchParams(params);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return `https://www.youtube.com/embed/${videoId}${suffix}`;
}
