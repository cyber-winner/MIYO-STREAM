import { put } from '@vercel/blob';
import crypto from 'crypto';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const ANILIST_URL = 'https://graphql.anilist.co';
async function fetchTMDB(endpoint, params = {}) {
  const qp = new URLSearchParams({ api_key: TMDB_API_KEY, ...params });
  const res = await fetch(`${TMDB_BASE}${endpoint}?${qp.toString()}`);
  if (!res.ok) throw new Error(`TMDB ${endpoint} failed: ${res.status}`);
  return res.json();
}
async function fetchAniList(query, variables = {}) {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList query failed: ${res.status}`);
  return res.json();
}
function tmdbCacheKey(path, params = {}) {
  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const raw = path + (sorted ? '?' + sorted : '');
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
  const readable = path.replace(/\//g, '_').replace(/^_/, '');
  return `cache/tmdb/${readable}_${hash}.json`;
}
function anilistCacheKey(query, variables) {
  const raw = JSON.stringify({ q: query.replace(/\s+/g, ' ').trim(), v: variables });
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return `cache/anilist/${hash}.json`;
}
async function storeBlob(key, data) {
  await put(key, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
const ANIME_CARD_FIELDS = `
  id title { romaji english native userPreferred }
  type format status season seasonYear episodes chapters volumes duration
  averageScore meanScore popularity favourites genres
  coverImage { extraLarge large medium color } bannerImage isAdult siteUrl
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;
function anilistPageQuery(type, sort, extra = '') {
  return `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(type: ${type}, sort: [${sort}], isAdult: false${extra ? ', ' + extra : ''}) {
          ${ANIME_CARD_FIELDS}
        }
      }
    }
  `;
}
export default async function handler(req, res) {
  const results = { tmdb: [], anilist: [], errors: [] };
  const tmdbEndpoints = [
    { path: '/trending/all/week', label: 'Trending' },
    { path: '/movie/popular', label: 'Popular Movies' },
    { path: '/tv/popular', label: 'Popular TV' },
    { path: '/movie/now_playing', label: 'Now Playing' },
    { path: '/movie/top_rated', label: 'Top Rated Movies' },
    { path: '/tv/top_rated', label: 'Top Rated TV' },
  ];
  for (const ep of tmdbEndpoints) {
    try {
      const data = await fetchTMDB(ep.path);
      const key = tmdbCacheKey(ep.path, {});
      await storeBlob(key, data);
      results.tmdb.push(`✓ ${ep.label}`);
    } catch (e) {
      results.errors.push(`✗ TMDB ${ep.label}: ${e.message}`);
    }
  }
  const anilistQueries = [
    { query: anilistPageQuery('ANIME', 'TRENDING_DESC'), vars: { page: 1, perPage: 20 }, label: 'Anime Trending' },
    { query: anilistPageQuery('ANIME', 'POPULARITY_DESC'), vars: { page: 1, perPage: 20 }, label: 'Anime Popular' },
    { query: anilistPageQuery('ANIME', 'SCORE_DESC'), vars: { page: 1, perPage: 20 }, label: 'Anime Top Rated' },
    { query: anilistPageQuery('ANIME', 'POPULARITY_DESC', 'status: RELEASING'), vars: { page: 1, perPage: 20 }, label: 'Anime Airing' },
    { query: anilistPageQuery('MANGA', 'TRENDING_DESC'), vars: { page: 1, perPage: 20 }, label: 'Manga Trending' },
    { query: anilistPageQuery('MANGA', 'POPULARITY_DESC'), vars: { page: 1, perPage: 20 }, label: 'Manga Popular' },
    { query: anilistPageQuery('MANGA', 'SCORE_DESC'), vars: { page: 1, perPage: 20 }, label: 'Manga Top Rated' },
  ];
  for (const aq of anilistQueries) {
    try {
      await new Promise(r => setTimeout(r, 800));
      const data = await fetchAniList(aq.query, aq.vars);
      const key = anilistCacheKey(aq.query, aq.vars);
      await storeBlob(key, data);
      results.anilist.push(`✓ ${aq.label}`);
    } catch (e) {
      results.errors.push(`✗ AniList ${aq.label}: ${e.message}`);
    }
  }
  const summary = {
    timestamp: new Date().toISOString(),
    tmdb: results.tmdb.length,
    anilist: results.anilist.length,
    errors: results.errors.length,
    details: results,
  };
  console.log('CRON_SYNC_COMPLETE:', JSON.stringify(summary));
  return res.status(200).json(summary);
}