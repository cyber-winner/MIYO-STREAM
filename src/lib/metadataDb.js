/**
 * Metadata Database abstraction layer.
 * 
 * On the web:  calls /api/metadata/* server endpoints (which query better-sqlite3)
 * On native:   calls /api/metadata/* via the local backend (future: direct SQLite)
 * 
 * Provides instant title search, MAL-to-provider mapping, and cached metadata
 * lookups — eliminating the need for slow fuzzy searches against provider APIs.
 */

import { isNative, isElectron } from '../platform/index.js';
import { getCached, setCached } from './cache.js';
import { API_BASE } from './api.js';

const CACHE_NS = 'metadata';

// ═══════════════════════════════════════════════════════════════════
//  ANIME
// ═══════════════════════════════════════════════════════════════════

/**
 * Search anime titles against the offline database (616k+ titles).
 * Returns results with MAL IDs, type, episodes, status, season, year, image.
 */
export async function searchAnimeMetadata(query, limit = 20) {
  if (!query) return [];
  const cacheKey = `anime_search_${query}_${limit}`;
  const cached = getCached(CACHE_NS, cacheKey);
  if (cached) return cached;

  try {
    if (isNative() && !isElectron()) {
      const { localBackend } = await import('../platform/localBackend.js');
      return await localBackend.metadata('anime', 'search', { query, limit });
    }
    const res = await fetch(`${API_BASE}/api/metadata/anime/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];
    setCached(CACHE_NS, cacheKey, results);
    return results;
  } catch (e) {
    console.warn('[metadataDb] Anime search failed:', e.message);
    return [];
  }
}

/**
 * Get anime metadata by MAL ID (type, episodes, status, season, year, image_url, titles).
 */
export async function getAnimeMetadata(malid) {
  if (!malid) return null;
  const cacheKey = `anime_${malid}`;
  const cached = getCached(CACHE_NS, cacheKey);
  if (cached) return cached;

  try {
    if (isNative() && !isElectron()) {
      const { localBackend } = await import('../platform/localBackend.js');
      const data = await localBackend.metadata('anime', 'get', { id: malid });
      if (data) setCached(CACHE_NS, cacheKey, data);
      return data;
    }
    const res = await fetch(`${API_BASE}/api/metadata/anime/${malid}`);
    if (!res.ok) return null;
    const data = await res.json();
    setCached(CACHE_NS, cacheKey, data);
    return data;
  } catch (e) {
    console.warn('[metadataDb] Anime metadata failed:', e.message);
    return null;
  }
}

/**
 * Resolve MAL ID → provider IDs.
 * Returns { anineko: id|null, anikoto: id|null, pahe: { uuid, id }|null }
 * 
 * This is the KEY function — it lets us skip the fuzzy title search
 * and go straight to the provider's episode list with the exact ID.
 */
export async function mapAnimeToProviders(malid) {
  if (!malid) return { anineko: null, anikoto: null, pahe: null };
  const cacheKey = `anime_map_${malid}`;
  const cached = getCached(CACHE_NS, cacheKey);
  if (cached) return cached;

  try {
    if (isNative() && !isElectron()) {
      const { localBackend } = await import('../platform/localBackend.js');
      const data = await localBackend.metadata('anime', 'map', { id: malid });
      if (data) setCached(CACHE_NS, cacheKey, data);
      return data;
    }
    const res = await fetch(`${API_BASE}/api/metadata/anime/${malid}/map`);
    if (!res.ok) return { anineko: null, anikoto: null, pahe: null };
    const data = await res.json();
    const providers = data.providers || {};
    setCached(CACHE_NS, cacheKey, providers);
    return providers;
  } catch (e) {
    console.warn('[metadataDb] Anime mapping failed:', e.message);
    return { anineko: null, anikoto: null, pahe: null };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MANGA
// ═══════════════════════════════════════════════════════════════════

/**
 * Search manga by title.
 */
export async function searchMangaMetadata(query, limit = 20) {
  if (!query) return [];
  const cacheKey = `manga_search_${query}_${limit}`;
  const cached = getCached(CACHE_NS, cacheKey);
  if (cached) return cached;

  try {
    if (isNative() && !isElectron()) {
      const { localBackend } = await import('../platform/localBackend.js');
      return await localBackend.metadata('manga', 'search', { query, limit });
    }
    const res = await fetch(`${API_BASE}/api/metadata/manga/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];
    setCached(CACHE_NS, cacheKey, results);
    return results;
  } catch (e) {
    console.warn('[metadataDb] Manga search failed:', e.message);
    return [];
  }
}

/**
 * Get manga metadata by MAL ID.
 */
export async function getMangaMetadata(malid) {
  if (!malid) return null;
  const cacheKey = `manga_${malid}`;
  const cached = getCached(CACHE_NS, cacheKey);
  if (cached) return cached;

  try {
    if (isNative() && !isElectron()) {
      const { localBackend } = await import('../platform/localBackend.js');
      const data = await localBackend.metadata('manga', 'get', { id: malid });
      if (data) setCached(CACHE_NS, cacheKey, data);
      return data;
    }
    const res = await fetch(`${API_BASE}/api/metadata/manga/${malid}`);
    if (!res.ok) return null;
    const data = await res.json();
    setCached(CACHE_NS, cacheKey, data);
    return data;
  } catch (e) {
    console.warn('[metadataDb] Manga metadata failed:', e.message);
    return null;
  }
}

/**
 * Resolve MAL ID → manga provider IDs.
 * Returns { weebcentral: id|null, asurascans: id|null, comix: id|null, mangafire: id|null }
 */
export async function mapMangaToProviders(malid) {
  if (!malid) return { weebcentral: null, asurascans: null, comix: null, mangafire: null };
  const cacheKey = `manga_map_${malid}`;
  const cached = getCached(CACHE_NS, cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/metadata/manga/${malid}/map`);
    if (!res.ok) return { weebcentral: null, asurascans: null, comix: null, mangafire: null };
    const data = await res.json();
    const providers = data.providers || {};
    setCached(CACHE_NS, cacheKey, providers);
    return providers;
  } catch (e) {
    console.warn('[metadataDb] Manga mapping failed:', e.message);
    return { weebcentral: null, asurascans: null, comix: null, mangafire: null };
  }
}
