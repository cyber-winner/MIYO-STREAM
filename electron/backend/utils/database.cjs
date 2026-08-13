/**
 * Database utility — decompresses database.db.gz on first use and exposes
 * query helpers for anime/manga metadata lookups and provider ID mappings.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Database = require('better-sqlite3');

const __dirname_local = __dirname;
const GZ_PATH = path.join(__dirname_local, '..', 'database.db.gz');
const DB_PATH = path.join(__dirname_local, '..', '.cache', 'database.db');

let db = null;

/**
 * Ensure the database is decompressed and open.
 * Called lazily on first query.
 */
function getDb() {
  if (db) return db;

  // Decompress if needed
  if (!fs.existsSync(DB_PATH)) {
    if (!fs.existsSync(GZ_PATH)) {
      throw new Error('database.db.gz not found — cannot initialise metadata database');
    }
    console.log('[DB] Decompressing database.db.gz → .cache/database.db ...');
    const cacheDir = path.dirname(DB_PATH);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const gzData = fs.readFileSync(GZ_PATH);
    const decompressed = zlib.gunzipSync(gzData);
    fs.writeFileSync(DB_PATH, decompressed);
    console.log(`[DB] Decompressed successfully (${(decompressed.length / 1024 / 1024).toFixed(1)} MB)`);
  }

  db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  // Enable WAL for faster reads (even in readonly mode it helps)
  db.pragma('journal_mode = WAL');
  console.log('[DB] SQLite database opened');
  return db;
}

// ═══════════════════════════════════════════════════════════════════
//  ANIME QUERIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Search anime titles by normalized query.
 * Returns up to `limit` results sorted by relevance.
 */
function searchAnime(query, limit = 20) {
  const d = getDb();
  const normalized = normalizeTitle(query);

  // Exact normalized match first, then LIKE prefix, then LIKE contains
  const stmt = d.prepare(`
    SELECT DISTINCT am.malid, am.type, am.episodes, am.status, am.season, am.year, am.image_url,
           at2.title AS matched_title
    FROM anime_titles at2
    JOIN anime_metadata am ON am.malid = at2.malid
    WHERE at2.normalized_title LIKE ?
    ORDER BY
      CASE
        WHEN at2.normalized_title = ? THEN 0
        WHEN at2.normalized_title LIKE ? THEN 1
        ELSE 2
      END,
      am.malid
    LIMIT ?
  `);

  return stmt.all(`%${normalized}%`, normalized, `${normalized}%`, limit);
}

/**
 * Get anime metadata by MAL ID.
 */
function getAnimeByMalId(malid) {
  const d = getDb();
  const stmt = d.prepare(`
    SELECT malid, type, episodes, status, season, year, image_url
    FROM anime_metadata WHERE malid = ?
  `);
  return stmt.get(malid) || null;
}

/**
 * Get all known titles for a given MAL ID.
 */
function getAnimeTitles(malid) {
  const d = getDb();
  const stmt = d.prepare(`SELECT title FROM anime_titles WHERE malid = ?`);
  return stmt.all(malid).map(r => r.title);
}

/**
 * Resolve MAL ID → provider-specific IDs.
 * Checks anineko, anikoto, and pahe mapping tables.
 * Returns { anineko: id|null, anikoto: id|null, pahe: { uuid, id }|null }
 */
function mapAnimeProviders(malid) {
  const d = getDb();
  const result = { anineko: null, anikoto: null, pahe: null };

  // Get all known titles for this MAL ID to match against provider names
  const titles = getAnimeTitles(malid);
  if (!titles.length) return result;

  const normalizedTitles = titles.map(t => normalizeTitle(t));

  // -- anineko: id is the provider ID, name is the title
  try {
    for (const norm of normalizedTitles) {
      const row = d.prepare(`SELECT id, name FROM anineko WHERE LOWER(REPLACE(name, ' ', '')) LIKE ?`).get(`%${norm.replace(/\s/g, '')}%`);
      if (row) { result.anineko = row.id; break; }
    }
    // Also check the metadata table directly (it has its own id column)
    if (!result.anineko) {
      const meta = d.prepare(`SELECT id FROM anineko_metadata WHERE id = ?`).get(String(malid));
      if (meta) result.anineko = meta.id;
    }
  } catch (e) { /* table might not exist */ }

  // -- anikoto: id is the provider ID
  try {
    for (const norm of normalizedTitles) {
      const row = d.prepare(`SELECT id, name FROM anikoto WHERE LOWER(REPLACE(name, ' ', '')) LIKE ?`).get(`%${norm.replace(/\s/g, '')}%`);
      if (row) { result.anikoto = row.id; break; }
    }
    if (!result.anikoto) {
      const meta = d.prepare(`SELECT id FROM anikoto_metadata WHERE id = ?`).get(String(malid));
      if (meta) result.anikoto = meta.id;
    }
  } catch (e) { /* table might not exist */ }

  // -- pahe: uuid is the provider ID, id might be the MAL ID
  try {
    const mapped = d.prepare(`SELECT uuid, id, name FROM pahe_mapped WHERE id = ?`).get(String(malid));
    if (mapped) {
      result.pahe = { uuid: mapped.uuid, id: mapped.id };
    }
  } catch (e) { /* table might not exist */ }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
//  MANGA QUERIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Get manga metadata by MAL ID.
 */
function getMangaByMalId(malid) {
  const d = getDb();
  const stmt = d.prepare(`
    SELECT malid, type, chapters, volumes, status, image_url, title
    FROM manga_metadata WHERE malid = ?
  `);
  return stmt.get(malid) || null;
}

/**
 * Search manga by title.
 */
function searchManga(query, limit = 20) {
  const d = getDb();
  const normalized = normalizeTitle(query);
  const stmt = d.prepare(`
    SELECT malid, type, chapters, volumes, status, image_url, title
    FROM manga_metadata
    WHERE LOWER(REPLACE(title, ' ', '')) LIKE ?
    ORDER BY
      CASE
        WHEN LOWER(REPLACE(title, ' ', '')) = ? THEN 0
        WHEN LOWER(REPLACE(title, ' ', '')) LIKE ? THEN 1
        ELSE 2
      END,
      malid
    LIMIT ?
  `);
  const normNoSpace = normalized.replace(/\s/g, '');
  return stmt.all(`%${normNoSpace}%`, normNoSpace, `${normNoSpace}%`, limit);
}

/**
 * Resolve MAL ID → manga provider IDs.
 * Checks weebcentral, asurascans, comix, mangafire.
 */
function mapMangaProviders(malid) {
  const d = getDb();
  const result = { weebcentral: null, asurascans: null, comix: null, mangafire: null };
  const manga = getMangaByMalId(malid);
  if (!manga) return result;
  const title = manga.title;
  const normalizedTitle = normalizeTitle(title).replace(/\s/g, '');

  const providers = ['weebcentral', 'asurascans', 'comix', 'mangafire'];
  for (const prov of providers) {
    try {
      // First try direct metadata table (these use their own IDs as primary keys)
      const metaRow = d.prepare(`SELECT id, name FROM ${prov}_metadata WHERE LOWER(REPLACE(name, ' ', '')) LIKE ?`).get(`%${normalizedTitle}%`);
      if (metaRow) {
        result[prov] = metaRow.id;
        continue;
      }
      // Then try the mapping table
      const mapRow = d.prepare(`SELECT id, name FROM ${prov} WHERE LOWER(REPLACE(name, ' ', '')) LIKE ?`).get(`%${normalizedTitle}%`);
      if (mapRow) {
        result[prov] = mapRow.id;
      }
    } catch (e) { /* table might not exist */ }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
//  CLOUDFLARE CREDENTIALS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get Cloudflare credentials for a specific proxy/domain.
 */
function getCloudflareCredentials(proxy) {
  const d = getDb();
  try {
    const stmt = d.prepare(`SELECT proxy, cf_clearance, userAgent, expiry FROM cloudflare_credentials WHERE proxy = ?`);
    return stmt.get(proxy) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Get all Cloudflare credentials.
 */
function getAllCloudflareCredentials() {
  const d = getDb();
  try {
    return d.prepare(`SELECT proxy, cf_clearance, userAgent, expiry FROM cloudflare_credentials`).all();
  } catch (e) {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

function normalizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[:\-–—]/g, ' ')
    .replace(/[^\w\s/]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Gracefully close the database.
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database closed');
  }
}

module.exports = {
  getDb,
  searchAnime,
  getAnimeByMalId,
  getAnimeTitles,
  mapAnimeProviders,
  searchManga,
  getMangaByMalId,
  mapMangaProviders,
  getCloudflareCredentials,
  getAllCloudflareCredentials,
  closeDb,
  normalizeTitle,
};
