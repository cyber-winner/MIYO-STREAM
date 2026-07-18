// Tauri native HTTP adapter — uses the Rust-side HTTP client, which
// bypasses CORS and allows forbidden headers like Referer/Origin.
import { fetch as tFetch } from '@tauri-apps/plugin-http';
import { DEFAULT_UA } from './index.js';

export async function tauriFetch(url, options = {}) {
  const headers = { 'User-Agent': DEFAULT_UA, ...(options.headers || {}) };
  const res = await tFetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body,
    connectTimeout: options.timeout || 30000,
  });
  return {
    ok: res.ok,
    status: res.status,
    header: (name) => res.headers.get(name),
    text: () => res.text(),
    json: () => res.json(),
    arrayBuffer: () => res.arrayBuffer(),
  };
}
