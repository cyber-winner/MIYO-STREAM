// Persistent metadata cache for TMDB and other APIs
// Stores responses in localStorage with TTL to reduce API key usage

const CACHE_PREFIX = 'miyo_cache_';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for metadata

function getCacheKey(namespace, id) {
  return `${CACHE_PREFIX}${namespace}_${id}`;
}

export function getCached(namespace, id) {
  try {
    const key = getCacheKey(namespace, id);
    const item = localStorage.getItem(key);
    if (!item) return null;
    const { data, expires } = JSON.parse(item);
    if (expires && Date.now() > expires) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('[Cache] Error reading cache:', e.message);
    return null;
  }
}

export function setCached(namespace, id, data, ttl = DEFAULT_TTL) {
  try {
    const key = getCacheKey(namespace, id);
    const expires = Date.now() + ttl;
    localStorage.setItem(key, JSON.stringify({ data, expires }));
  } catch (e) {
    console.warn('[Cache] Error writing cache:', e.message);
  }
}

export function clearCache(namespace = null) {
  try {
    if (namespace) {
      const prefix = `${CACHE_PREFIX}${namespace}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      }
    } else {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    console.warn('[Cache] Error clearing cache:', e.message);
  }
}

// Get cache stats for debugging
export function getCacheStats() {
  try {
    let totalSize = 0;
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        count++;
        const item = localStorage.getItem(key);
        totalSize += item?.length || 0;
      }
    }
    return { count, totalSize, totalSizeKB: (totalSize / 1024).toFixed(2) };
  } catch (e) {
    return { count: 0, totalSize: 0 };
  }
}
