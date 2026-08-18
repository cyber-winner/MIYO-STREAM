import { useEffect } from 'react';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const STORAGE_KEY = 'miyo_utm';

/**
 * Captures UTM parameters from the URL on first load
 * and stores them in sessionStorage for analytics.
 */
export function useUTM() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const utm = {};
      let hasAny = false;

      for (const key of UTM_KEYS) {
        const val = params.get(key);
        if (val) {
          utm[key] = val;
          hasAny = true;
        }
      }

      if (hasAny) {
        // Store in sessionStorage so it persists across page navigations
        // but not across browser sessions
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
      }
    } catch {
      // sessionStorage may be unavailable in some environments
    }
  }, []);
}

/**
 * Retrieve stored UTM parameters (for use in analytics/event tracking).
 * @returns {Object|null} UTM parameters or null
 */
export function getUTMParams() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
