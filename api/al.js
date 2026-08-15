import { put, list } from '@vercel/blob';
import crypto from 'crypto';
const ANILIST_URL = 'https://graphql.anilist.co';
function buildCacheKey(query, variables) {
  const raw = JSON.stringify({ q: query.replace(/\s+/g, ' ').trim(), v: variables });
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return `cache/anilist/${hash}.json`;
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
    console.error('AniList blob store failed:', e.message);
  }
}
async function fetchFromAniList(query, variables) {
  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 429) {
    throw new Error('RATE_LIMITED');
  }
  if (!response.ok) throw new Error(`AniList ${response.status}`);
  const data = await response.json();
  if (data.errors?.some(e => e.status === 429 || e.message?.includes('Too Many'))) {
    throw new Error('RATE_LIMITED');
  }
  return data;
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { query, variables } = req.body || {};
  if (!query || typeof query !== 'string' || query.length > 5000) {
    return res.status(400).json({ errors: [{ message: 'Invalid or missing query' }] });
  }
  const cacheKey = buildCacheKey(query, variables);
  const cached = await getFromCache(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400');
    res.status(200).json(cached);
    try {
      const fresh = await fetchFromAniList(query, variables);
      if (!fresh.errors && JSON.stringify(fresh) !== JSON.stringify(cached)) {
        await storeInCache(cacheKey, fresh);
      }
    } catch (e) {}
    return;
  }
  try {
    const data = await fetchFromAniList(query, variables);
    if (!data.errors) {
      await storeInCache(cacheKey, data);
    }
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (error) {
    if (error.message === 'RATE_LIMITED') {
      return res.status(429).json({
        errors: [{ message: 'Rate limited', status: 429 }],
      });
    }
    console.error('AniList proxy error:', error.message);
    return res.status(500).json({ errors: [{ message: 'AniList proxy failed', status: 500 }] });
  }
}