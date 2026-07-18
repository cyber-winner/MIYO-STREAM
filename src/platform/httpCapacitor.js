// Capacitor native HTTP adapter — uses CapacitorHttp (native OkHttp on Android),
// which bypasses CORS and allows forbidden headers like Referer/Origin.
// Binary responses come back base64-encoded and are converted to ArrayBuffer.
import { CapacitorHttp } from '@capacitor/core';
import { DEFAULT_UA } from './index.js';

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function capacitorFetch(url, options = {}) {
  const headers = { 'User-Agent': DEFAULT_UA, ...(options.headers || {}) };
  const method = (options.method || 'GET').toUpperCase();

  const req = {
    url,
    method,
    headers,
    readTimeout: options.timeout || 30000,
    connectTimeout: options.timeout || 30000,
  };

  if (options.binary) {
    req.responseType = 'arraybuffer'; // CapacitorHttp returns base64 string for this
  }

  if (options.body != null) {
    if (typeof options.body === 'string') {
      req.data = options.body;
      // CapacitorHttp serializes objects itself; for pre-stringified JSON keep as string
      if (headers['Content-Type']?.includes('application/json')) {
        try { req.data = JSON.parse(options.body); } catch { /* keep string */ }
      }
    } else {
      req.data = options.body;
    }
  }

  const res = await CapacitorHttp.request(req);
  const lowerHeaders = {};
  for (const [k, v] of Object.entries(res.headers || {})) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    header: (name) => lowerHeaders[name.toLowerCase()] ?? null,
    text: async () => {
      if (typeof res.data === 'string') return res.data;
      return JSON.stringify(res.data);
    },
    json: async () => {
      if (typeof res.data === 'string') return JSON.parse(res.data);
      return res.data;
    },
    arrayBuffer: async () => {
      if (typeof res.data === 'string') return base64ToArrayBuffer(res.data);
      throw new Error('Expected base64 binary response');
    },
  };
}
