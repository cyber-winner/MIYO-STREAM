/**
 * TETO-STREAM Fetch Interceptor
 * Monkey-patches window.fetch to attach the device fingerprint ID
 * as an `x-fingerprint-id` header on every API request.
 * This ensures ALL routes, components, and API calls carry the fingerprint.
 */

const STORAGE_KEY = 'miyo_fp_id';

/**
 * Get the current fingerprint ID from sessionStorage or localStorage.
 */
export function getFingerprintId() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Store the fingerprint ID for use across requests.
 */
export function setFingerprintId(id) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}

/**
 * Install the global fetch interceptor.
 * After calling this, every fetch() request to our own API (/api/*)
 * will automatically include the x-fingerprint-id header.
 */
export function installFetchInterceptor() {
  if (typeof window === 'undefined') return;
  if (window.__miyoFetchIntercepted) return; // Prevent double-install
  
  const originalFetch = window.fetch;

  window.fetch = function (input, init = {}) {
    const fpId = getFingerprintId();
    if (!fpId) return originalFetch.call(this, input, init);

    // Determine the URL to check if it's our API
    let url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
    } else if (input instanceof URL) {
      url = input.toString();
    }

    // Only inject header for our own API routes (relative /api/* or same-origin)
    const isOurAPI = url.startsWith('/api') || 
                     url.startsWith('./api') ||
                     (typeof window !== 'undefined' && url.startsWith(window.location.origin + '/api'));

    if (isOurAPI) {
      // Merge headers
      const existingHeaders = init.headers || {};
      let headers;

      if (existingHeaders instanceof Headers) {
        headers = new Headers(existingHeaders);
        headers.set('x-fingerprint-id', fpId);
      } else if (typeof existingHeaders === 'object') {
        headers = { ...existingHeaders, 'x-fingerprint-id': fpId };
      } else {
        headers = { 'x-fingerprint-id': fpId };
      }

      init = { ...init, headers };

      // If input was a Request object, recreate it
      if (input instanceof Request) {
        input = new Request(input, init);
        init = undefined;
      }
    }

    return init !== undefined 
      ? originalFetch.call(this, input, init) 
      : originalFetch.call(this, input);
  };

  window.__miyoFetchIntercepted = true;
}
