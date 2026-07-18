// Minimal axios-compatible wrapper over platformFetch so the anikoto
// extension (extensions/Anime/anikoto.cjs) runs unmodified inside the
// native apps. Only implements what the extension actually uses:
//   axios.get(url, { headers }) -> { data, headers, status }
import { platformFetch } from './index.js';

async function request(url, config = {}, method = 'GET', body = null) {
  const res = await platformFetch(url, {
    method,
    headers: config.headers || {},
    body,
    timeout: config.timeout || 30000,
  });

  if (!res.ok) {
    const err = new Error(`Request failed with status code ${res.status}`);
    err.response = { status: res.status };
    throw err;
  }

  const contentType = res.header('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
    // Some ajax endpoints return JSON without a proper content type
    if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
      try { data = JSON.parse(data); } catch { /* keep text */ }
    }
  }

  return {
    data,
    status: res.status,
    headers: { 'content-type': contentType },
  };
}

export const axiosShim = {
  get: (url, config) => request(url, config, 'GET'),
  post: (url, body, config = {}) =>
    request(url, config, 'POST', typeof body === 'string' ? body : JSON.stringify(body)),
};
