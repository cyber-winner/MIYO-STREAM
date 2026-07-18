import { put, list } from '@vercel/blob';
import crypto from 'crypto';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
function buildCacheKey(tmdbPath, queryParams) {
  const sorted = Object.entries(queryParams)
    .filter(([k]) => k !== 'path' && k !== 'api_key')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const raw = tmdbPath + (sorted ? '?' + sorted : '');
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
  const readable = tmdbPath.replace(/\//g, '_').replace(/^_/, '');
  return `cache/tmdb/${readable}_${hash}.json`;
}
async function getFromCache(cacheKey) {
  try {
    const { blobs } = await list({ prefix: cacheKey, limit: 1 });
    if (blobs.length > 0 && blobs[0].pathname === cacheKey) {
      const res = await fetch(blobs[0].url);
      return await res.json();
    }
  } catch (e) {}
  return null;
}
async function storeInCache(cacheKey, data) {
  try {
    await put(cacheKey, JSON.stringify(data), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.error('Blob store failed:', e.message);
  }
}
async function fetchFromTMDB(tmdbPath, queryParams) {
  const tmdbParams = new URLSearchParams({ api_key: TMDB_API_KEY, ...queryParams });
  const response = await fetch(`${TMDB_BASE}${tmdbPath}?${tmdbParams.toString()}`);
  if (!response.ok) throw new Error(`TMDB ${response.status}`);
  return response.json();
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!TMDB_API_KEY) {
    return res.status(500).json({ error: 'TMDB_API_KEY environment variable is not configured on Vercel.' });
  }
  const tmdbPath = req.query.path || '/';
  const allowedPrefixes = [
    '/trending', '/search', '/movie', '/tv', '/genre', 
    '/discover', '/person', '/collection'
  ];
  if (!allowedPrefixes.some(prefix => tmdbPath.startsWith(prefix))) {
    return res.status(403).json({ error: 'Forbidden: API endpoint not allowed.' });
  }
  const queryParams = { ...req.query };
  delete queryParams.path;
  const cacheKey = buildCacheKey(tmdbPath, queryParams);
  const cached = await getFromCache(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400');
    res.status(200).json(cached);
    try {
      const fresh = await fetchFromTMDB(tmdbPath, queryParams);
      if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
        await storeInCache(cacheKey, fresh);
      }
    } catch (e) {}
    return;
  }
  try {
    const data = await fetchFromTMDB(tmdbPath, queryParams);
    await storeInCache(cacheKey, data);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (error) {
    console.error('TMDB proxy error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch from TMDB' });
  }
}