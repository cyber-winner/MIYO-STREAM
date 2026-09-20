/**
 * AniList Full Metadata Crawler
 * 
 * Background process that systematically fetches and permanently caches
 * ALL anime and manga metadata from AniList's GraphQL API.
 * 
 * Priority phases:
 *   1. Front page (trending, popular, airing, seasonal) — ~5 min
 *   2. All anime details (~22K entries) — ~9 hours
 *   3. All manga details (~140K entries) — ~58 hours
 *   4. Continuous re-crawl (new entries + refresh oldest)
 * 
 * Respects AniList rate limits (40 req/min, well within 90/min cap).
 * Saves progress to disk so it resumes after server restart.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── Directories ──
const CACHE_ROOT = path.join(PROJECT_ROOT, '.cache', 'anilist');
const MEDIA_DIR = path.join(CACHE_ROOT, 'media');
const QUERIES_DIR = path.join(CACHE_ROOT, 'queries');
const STATE_FILE = path.join(CACHE_ROOT, 'crawler-state.json');

// ── Rate Limiting ──
const REQUEST_INTERVAL_MS = 1500; // 1.5s between requests (40/min)
const BATCH_PAUSE_MS = 5000;      // 5s pause between batches
const ERROR_BACKOFF_MS = 30000;    // 30s pause on error
const RATE_LIMIT_BACKOFF_MS = 60000; // 60s pause on 429

// ── AniList GraphQL ──
const ANILIST_URL = 'https://graphql.anilist.co';

// Full detail fragment matching the frontend's MEDIA_DETAIL_FRAGMENT
const MEDIA_DETAIL_FRAGMENT = `
  id
  title { romaji english native userPreferred }
  type format status
  description(asHtml: false)
  season seasonYear
  episodes chapters volumes duration
  averageScore meanScore popularity favourites
  genres
  tags { id name category rank isAdult }
  coverImage { extraLarge large medium color }
  bannerImage
  startDate { year month day }
  endDate { year month day }
  isAdult siteUrl
  trailer { id site thumbnail }
  nextAiringEpisode { airingAt timeUntilAiring episode }
  streamingEpisodes { title thumbnail url site }
  studios(isMain: true) { nodes { id name siteUrl } }
  rankings { rank type format season year allTime }
  externalLinks { id url site type }
  relations {
    edges {
      relationType
      node {
        id
        title { romaji english userPreferred }
        type format status
        coverImage { large medium }
        averageScore episodes chapters
      }
    }
  }
  characters(sort: [ROLE, RELEVANCE], page: 1, perPage: 20) {
    edges {
      role
      voiceActors(language: JAPANESE) {
        id name { full native } image { large medium } languageV2
      }
      node { id name { full native } image { large medium } }
    }
  }
  staff(sort: [RELEVANCE], page: 1, perPage: 10) {
    edges {
      role
      node { id name { full native } image { large medium } }
    }
  }
  recommendations(sort: [RATING_DESC], page: 1, perPage: 12) {
    nodes {
      mediaRecommendation {
        id
        title { romaji english userPreferred }
        type format
        coverImage { large medium }
        averageScore episodes chapters status
      }
    }
  }
`;

// Card fragment for listing queries
const MEDIA_CARD_FRAGMENT = `
  id
  title { romaji english native userPreferred }
  type format status season seasonYear
  episodes chapters volumes duration
  averageScore meanScore popularity favourites genres
  coverImage { extraLarge large medium color }
  bannerImage isAdult siteUrl
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;

// ── Utility Functions ──

function ensureDirs() {
  for (const dir of [CACHE_ROOT, MEDIA_DIR, QUERIES_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (_) {}
  return {
    phase: 'frontpage',       // frontpage | anime_ids | anime_details | manga_ids | manga_details | continuous
    animeIds: [],             // discovered anime IDs to fetch
    mangaIds: [],             // discovered manga IDs to fetch
    animeIdProgress: 0,       // index into animeIds
    mangaIdProgress: 0,       // index into mangaIds
    animeYearsDone: [],       // years already scanned for anime IDs
    mangaYearsDone: [],       // years already scanned for manga IDs
    totalAnimeCached: 0,
    totalMangaCached: 0,
    lastFrontpageRun: 0,
    lastContinuousRun: 0,
    startedAt: Date.now(),
    errors: 0,
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[Crawler] Failed to save state:', e.message);
  }
}

function mediaExists(id) {
  return fs.existsSync(path.join(MEDIA_DIR, `${id}.json`));
}

function saveMedia(id, data) {
  try {
    fs.writeFileSync(path.join(MEDIA_DIR, `${id}.json`), JSON.stringify({
      id,
      timestamp: Date.now(),
      data,
    }));
  } catch (e) {
    console.error(`[Crawler] Failed to save media ${id}:`, e.message);
  }
}

function readMedia(id) {
  try {
    const file = path.join(MEDIA_DIR, `${id}.json`);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (_) {}
  return null;
}

function saveQueryCache(hash, data) {
  try {
    fs.writeFileSync(path.join(QUERIES_DIR, `${hash}.json`), JSON.stringify({
      timestamp: Date.now(),
      data,
    }));
  } catch (e) {
    console.error(`[Crawler] Failed to save query cache:`, e.message);
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let _stopRequested = false;

async function anilistRequest(query, variables = {}, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios({
        method: 'POST',
        url: ANILIST_URL,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        data: { query, variables },
        timeout: 15000,
      });
      if (response.data?.errors?.length) {
        const errMsg = response.data.errors[0]?.message || '';
        if (errMsg.includes('Too Many') || response.data.errors[0]?.status === 429) {
          console.warn('[Crawler] Rate limited via error body, backing off...');
          await sleep(RATE_LIMIT_BACKOFF_MS);
          continue;
        }
        throw new Error(`AniList API error: ${errMsg}`);
      }
      return response.data?.data;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status === 429) {
        const wait = RATE_LIMIT_BACKOFF_MS * (attempt + 1);
        console.warn(`[Crawler] Rate limited (429), waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err; // Don't retry client errors
      }
      if (attempt < retries) {
        const wait = (attempt + 1) * 3000;
        console.warn(`[Crawler] Request failed (${status || err.code || err.message}), retry ${attempt + 1} in ${wait / 1000}s...`);
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

// ── Extract media entries from any AniList response ──
// Recursively walks the response looking for objects with { id, title, type }
function extractMediaEntries(obj, results = []) {
  if (!obj || typeof obj !== 'object') return results;
  // Check if this looks like a Media object
  if (obj.id && obj.title && (obj.type === 'ANIME' || obj.type === 'MANGA')) {
    results.push(obj);
  }
  // Recurse into arrays and objects
  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractMediaEntries(item, results);
    }
  } else {
    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object') {
        extractMediaEntries(val, results);
      }
    }
  }
  return results;
}

// ── Phase 1: Front Page ──
async function crawlFrontPage(state) {
  console.log('[Crawler] Phase 1: Crawling front page queries...');
  
  const queries = [
    { name: 'Trending Anime', sort: 'TRENDING_DESC', type: 'ANIME', pages: 2 },
    { name: 'Popular Anime', sort: 'POPULARITY_DESC', type: 'ANIME', pages: 2 },
    { name: 'Top Rated Anime', sort: 'SCORE_DESC', type: 'ANIME', pages: 1 },
    { name: 'Airing Anime', sort: 'POPULARITY_DESC', type: 'ANIME', pages: 1, status: 'RELEASING' },
    { name: 'Trending Manga', sort: 'TRENDING_DESC', type: 'MANGA', pages: 1 },
    { name: 'Popular Manga', sort: 'POPULARITY_DESC', type: 'MANGA', pages: 1 },
    { name: 'Top Rated Manga', sort: 'SCORE_DESC', type: 'MANGA', pages: 1 },
  ];

  // Also add current and next season
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const seasonIdx = month <= 3 ? 0 : month <= 6 ? 1 : month <= 9 ? 2 : 3;
  const currentSeason = seasons[seasonIdx];
  const nextSeasonIdx = (seasonIdx + 1) % 4;
  const nextYear = nextSeasonIdx === 0 ? year + 1 : year;
  
  queries.push(
    { name: `${currentSeason} ${year}`, sort: 'POPULARITY_DESC', type: 'ANIME', pages: 1, season: currentSeason, seasonYear: year },
    { name: `${seasons[nextSeasonIdx]} ${nextYear}`, sort: 'POPULARITY_DESC', type: 'ANIME', pages: 1, season: seasons[nextSeasonIdx], seasonYear: nextYear },
  );

  let cached = 0;
  for (const q of queries) {
    if (_stopRequested) return;
    for (let page = 1; page <= q.pages; page++) {
      try {
        const vars = {
          page,
          perPage: 20,
          type: q.type,
          sort: [q.sort],
        };
        if (q.status) vars.status = q.status;
        if (q.season) vars.season = q.season;
        if (q.seasonYear) vars.seasonYear = q.seasonYear;

        const data = await anilistRequest(`
          query ($page: Int, $perPage: Int, $type: MediaType, $sort: [MediaSort],
                 $status: MediaStatus, $season: MediaSeason, $seasonYear: Int) {
            Page(page: $page, perPage: $perPage) {
              pageInfo { total currentPage lastPage hasNextPage perPage }
              media(type: $type, sort: $sort, status: $status,
                    season: $season, seasonYear: $seasonYear, isAdult: false) {
                ${MEDIA_CARD_FRAGMENT}
              }
            }
          }
        `, vars);

        if (data?.Page?.media) {
          for (const media of data.Page.media) {
            if (media.id && !mediaExists(media.id)) {
              saveMedia(media.id, media);
              cached++;
            }
          }
        }
        console.log(`[Crawler] ✓ ${q.name} (page ${page}) — ${data?.Page?.media?.length || 0} entries`);
        await sleep(REQUEST_INTERVAL_MS);
      } catch (e) {
        console.error(`[Crawler] ✗ ${q.name} (page ${page}):`, e.message);
        await sleep(ERROR_BACKOFF_MS);
      }
    }
  }

  console.log(`[Crawler] Phase 1 complete — ${cached} new entries cached from front page`);
  state.lastFrontpageRun = Date.now();
  saveState(state);
}

// ── Phase 2/3: Discover IDs by Year ──
async function discoverIds(mediaType, state) {
  const label = mediaType === 'ANIME' ? 'anime' : 'manga';
  const yearsDoneKey = mediaType === 'ANIME' ? 'animeYearsDone' : 'mangaYearsDone';
  const idsKey = mediaType === 'ANIME' ? 'animeIds' : 'mangaIds';
  
  // Scan years from current year down to 1940
  const currentYear = new Date().getFullYear() + 1; // +1 for upcoming
  const startYear = 1940;
  const allYears = [];
  for (let y = currentYear; y >= startYear; y--) {
    if (!state[yearsDoneKey].includes(y)) {
      allYears.push(y);
    }
  }
  // Also add null year (entries with no year set)
  if (!state[yearsDoneKey].includes(0)) {
    allYears.push(0);
  }

  if (allYears.length === 0) {
    console.log(`[Crawler] All ${label} years already scanned`);
    return;
  }

  console.log(`[Crawler] Discovering ${label} IDs — ${allYears.length} years to scan...`);
  let totalNew = 0;

  for (const year of allYears) {
    if (_stopRequested) return;

    let page = 1;
    let hasMore = true;
    const yearLabel = year === 0 ? 'no-year' : year;

    while (hasMore && !_stopRequested) {
      try {
        const vars = { page, perPage: 50, type: mediaType };
        let yearFilter = '';
        if (year !== 0) {
          vars.seasonYear = year;
          yearFilter = ', seasonYear: $seasonYear';
        }

        const data = await anilistRequest(`
          query ($page: Int, $perPage: Int, $type: MediaType${year !== 0 ? ', $seasonYear: Int' : ''}) {
            Page(page: $page, perPage: $perPage) {
              pageInfo { hasNextPage currentPage lastPage }
              media(type: $type, sort: ID, isAdult: false${yearFilter}) {
                id
              }
            }
          }
        `, vars);

        const ids = (data?.Page?.media || []).map(m => m.id);
        const newIds = ids.filter(id => !state[idsKey].includes(id) && !mediaExists(id));
        
        if (newIds.length > 0) {
          state[idsKey].push(...newIds);
          totalNew += newIds.length;
        }

        hasMore = data?.Page?.pageInfo?.hasNextPage && ids.length > 0;
        page++;
        await sleep(REQUEST_INTERVAL_MS);
      } catch (e) {
        console.error(`[Crawler] Error scanning ${label} year ${yearLabel} page ${page}:`, e.message);
        await sleep(ERROR_BACKOFF_MS);
        // Skip to next year on persistent errors
        break;
      }
    }

    state[yearsDoneKey].push(year);
    saveState(state);
    console.log(`[Crawler] ✓ ${label} year ${yearLabel} scanned — total new IDs: ${totalNew}`);
  }

  console.log(`[Crawler] ${label} ID discovery complete — ${state[idsKey].length} IDs to fetch details for`);
}

// ── Phase 2/3: Fetch Full Details ──
async function fetchDetails(mediaType, state) {
  const label = mediaType === 'ANIME' ? 'anime' : 'manga';
  const idsKey = mediaType === 'ANIME' ? 'animeIds' : 'mangaIds';
  const progressKey = mediaType === 'ANIME' ? 'animeIdProgress' : 'mangaIdProgress';
  const countKey = mediaType === 'ANIME' ? 'totalAnimeCached' : 'totalMangaCached';

  const ids = state[idsKey];
  const startIdx = state[progressKey];

  if (startIdx >= ids.length) {
    console.log(`[Crawler] All ${label} details already fetched`);
    return;
  }

  console.log(`[Crawler] Fetching ${label} details — ${ids.length - startIdx} remaining (starting from index ${startIdx})...`);

  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = startIdx; i < ids.length; i++) {
    if (_stopRequested) return;

    const id = ids[i];

    // Skip if already cached
    if (mediaExists(id)) {
      skipped++;
      state[progressKey] = i + 1;
      // Save state every 100 entries
      if ((i - startIdx) % 100 === 0) saveState(state);
      continue;
    }

    try {
      const data = await anilistRequest(`
        query ($id: Int) {
          Media(id: $id) {
            ${MEDIA_DETAIL_FRAGMENT}
          }
        }
      `, { id });

      if (data?.Media) {
        saveMedia(id, data.Media);
        state[countKey]++;
        fetched++;

        // Also cache any related media entries (from relations, recommendations)
        const related = extractMediaEntries(data.Media.relations || {});
        const recs = extractMediaEntries(data.Media.recommendations || {});
        for (const rel of [...related, ...recs]) {
          if (rel.id && !mediaExists(rel.id)) {
            saveMedia(rel.id, rel);
          }
        }
      }
    } catch (e) {
      errors++;
      state.errors++;
      console.error(`[Crawler] ✗ ${label} ID ${id}:`, e.message);
      if (e.response?.status === 404) {
        // Entry doesn't exist, skip permanently
        state[progressKey] = i + 1;
        continue;
      }
      await sleep(ERROR_BACKOFF_MS);
    }

    state[progressKey] = i + 1;

    // Log progress and save state every 50 entries
    if (fetched % 50 === 0 && fetched > 0) {
      const progress = ((i - startIdx + 1) / (ids.length - startIdx) * 100).toFixed(1);
      console.log(`[Crawler] ${label} progress: ${progress}% — ${fetched} fetched, ${skipped} skipped, ${errors} errors`);
      saveState(state);
    }

    await sleep(REQUEST_INTERVAL_MS);
  }

  saveState(state);
  console.log(`[Crawler] ${label} details complete — ${fetched} fetched, ${skipped} already cached, ${errors} errors`);
}

// ── Phase 4: Continuous Re-crawl ──
async function continuousCrawl(state) {
  console.log('[Crawler] Phase 4: Continuous mode — refreshing front page and scanning for new entries...');

  // Re-crawl front page
  await crawlFrontPage(state);

  if (_stopRequested) return;

  // Scan current year and next year for new entries
  const currentYear = new Date().getFullYear();
  const yearsToCheck = [currentYear + 1, currentYear, currentYear - 1];
  
  for (const year of yearsToCheck) {
    if (_stopRequested) return;
    
    for (const type of ['ANIME', 'MANGA']) {
      let page = 1;
      let hasMore = true;
      let newCount = 0;

      while (hasMore && !_stopRequested) {
        try {
          const data = await anilistRequest(`
            query ($page: Int, $perPage: Int, $type: MediaType, $year: Int) {
              Page(page: $page, perPage: $perPage) {
                pageInfo { hasNextPage }
                media(type: $type, seasonYear: $year, sort: ID_DESC, isAdult: false) {
                  ${MEDIA_DETAIL_FRAGMENT}
                }
              }
            }
          `, { page, perPage: 50, type, year });

          const media = data?.Page?.media || [];
          for (const m of media) {
            if (m.id && !mediaExists(m.id)) {
              saveMedia(m.id, m);
              newCount++;
            }
          }
          hasMore = data?.Page?.pageInfo?.hasNextPage && media.length > 0;
          page++;
          await sleep(REQUEST_INTERVAL_MS);
        } catch (e) {
          console.error(`[Crawler] Continuous scan error (${type} ${year}):`, e.message);
          await sleep(ERROR_BACKOFF_MS);
          break;
        }
      }

      if (newCount > 0) {
        console.log(`[Crawler] Found ${newCount} new ${type.toLowerCase()} entries for year ${year}`);
      }
    }
  }

  state.lastContinuousRun = Date.now();
  saveState(state);
}

// ── Main Crawler Loop ──
async function crawlerMain() {
  ensureDirs();
  const state = loadState();

  console.log('[Crawler] ═══════════════════════════════════════════════════');
  console.log('[Crawler] AniList Full Metadata Crawler starting...');
  console.log(`[Crawler] Media cache: ${MEDIA_DIR}`);
  console.log(`[Crawler] Current phase: ${state.phase}`);
  console.log(`[Crawler] Cached: ${state.totalAnimeCached} anime, ${state.totalMangaCached} manga`);

  // Count existing cached files
  try {
    const files = fs.readdirSync(MEDIA_DIR).filter(f => f.endsWith('.json'));
    console.log(`[Crawler] ${files.length} media files on disk`);
  } catch (_) {}
  console.log('[Crawler] ═══════════════════════════════════════════════════');

  while (!_stopRequested) {
    try {
      switch (state.phase) {
        case 'frontpage': {
          await crawlFrontPage(state);
          state.phase = 'anime_ids';
          saveState(state);
          break;
        }

        case 'anime_ids': {
          await discoverIds('ANIME', state);
          state.phase = 'anime_details';
          saveState(state);
          break;
        }

        case 'anime_details': {
          await fetchDetails('ANIME', state);
          state.phase = 'manga_ids';
          saveState(state);
          break;
        }

        case 'manga_ids': {
          await discoverIds('MANGA', state);
          state.phase = 'manga_details';
          saveState(state);
          break;
        }

        case 'manga_details': {
          await fetchDetails('MANGA', state);
          state.phase = 'continuous';
          saveState(state);
          console.log('[Crawler] ═══════════════════════════════════════════════════');
          console.log('[Crawler] ✓ INITIAL CRAWL COMPLETE!');
          console.log(`[Crawler] Total cached: ${state.totalAnimeCached} anime, ${state.totalMangaCached} manga`);
          console.log('[Crawler] Entering continuous mode...');
          console.log('[Crawler] ═══════════════════════════════════════════════════');
          break;
        }

        case 'continuous': {
          // Re-crawl every 6 hours
          const sixHours = 6 * 60 * 60 * 1000;
          const timeSinceLastRun = Date.now() - (state.lastContinuousRun || 0);
          if (timeSinceLastRun < sixHours) {
            const waitTime = sixHours - timeSinceLastRun;
            console.log(`[Crawler] Next continuous crawl in ${Math.round(waitTime / 60000)} minutes`);
            await sleep(Math.min(waitTime, 60000)); // Check every minute
            break;
          }
          await continuousCrawl(state);
          break;
        }

        default: {
          state.phase = 'frontpage';
          saveState(state);
        }
      }
    } catch (e) {
      console.error('[Crawler] Unhandled error in main loop:', e.message);
      state.errors++;
      saveState(state);
      await sleep(ERROR_BACKOFF_MS);
    }
  }

  console.log('[Crawler] Stopped.');
}

// ── Exported API ──

export function startCrawler() {
  _stopRequested = false;
  crawlerMain().catch(e => {
    console.error('[Crawler] Fatal error:', e);
  });
}

export function stopCrawler() {
  _stopRequested = true;
}

/**
 * Get a cached media entry by AniList ID.
 * Returns { id, timestamp, data } or null.
 */
export function getCachedMedia(id) {
  return readMedia(id);
}

/**
 * Save a media entry to the permanent cache.
 * Called by the /api/al proxy when it gets fresh data from AniList.
 */
export function cacheMediaEntry(id, data) {
  if (!id || !data) return;
  // Only overwrite if the new data has more fields (detail > card)
  const existing = readMedia(id);
  if (existing?.data) {
    const existingKeys = Object.keys(existing.data).length;
    const newKeys = Object.keys(data).length;
    // Keep the richer version
    if (newKeys < existingKeys) return;
  }
  saveMedia(id, data);
}

/**
 * Extract and cache all media entries from an AniList API response.
 * Called by the /api/al proxy to populate the media cache from any response.
 */
export function cacheMediaFromResponse(responseData) {
  if (!responseData) return 0;
  const entries = extractMediaEntries(responseData);
  let cached = 0;
  for (const entry of entries) {
    if (entry.id) {
      cacheMediaEntry(entry.id, entry);
      cached++;
    }
  }
  return cached;
}

/**
 * Get crawler status for admin/debug purposes.
 */
export function getCrawlerStatus() {
  const state = loadState();
  let mediaCount = 0;
  let mediaSizeBytes = 0;
  try {
    const files = fs.readdirSync(MEDIA_DIR).filter(f => f.endsWith('.json'));
    mediaCount = files.length;
    for (const f of files) {
      try {
        mediaSizeBytes += fs.statSync(path.join(MEDIA_DIR, f)).size;
      } catch (_) {}
    }
  } catch (_) {}

  return {
    phase: state.phase,
    totalAnimeCached: state.totalAnimeCached,
    totalMangaCached: state.totalMangaCached,
    animeIdsDiscovered: state.animeIds?.length || 0,
    mangaIdsDiscovered: state.mangaIds?.length || 0,
    animeProgress: state.animeIdProgress || 0,
    mangaProgress: state.mangaIdProgress || 0,
    mediaFilesOnDisk: mediaCount,
    mediaSizeMB: Math.round(mediaSizeBytes / 1024 / 1024 * 10) / 10,
    errors: state.errors,
    startedAt: state.startedAt,
    lastFrontpageRun: state.lastFrontpageRun,
    lastContinuousRun: state.lastContinuousRun,
  };
}

// Ensure dirs exist on import
ensureDirs();
