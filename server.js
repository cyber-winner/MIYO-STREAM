process.noDeprecation = true;
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import axios from 'axios';
import { createRequire } from 'module';
import child_process, { exec, execSync, spawn } from 'child_process';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

// ── Database Layer ──
const dbReady = import('./utils/db.js').then(m => m.default || m).catch(() => null);
let db = null;
(async () => {
  const dbModule = await dbReady;
  if (dbModule) {
    db = dbModule;
    await db.connectDB();
    // Initial cache load
    await db.refreshBanCache();
    await db.refreshIpFpCache();
    // Refresh caches periodically
    setInterval(() => { db.refreshBanCache(); }, 30000);
    setInterval(() => { db.refreshIpFpCache(); }, 120000);
  }
})();

// ── IP Geolocation Helper ──
async function lookupIPGeo(ip) {
  if (!db || !db.isDBConnected() || !ip || ip === '::1' || ip === '127.0.0.1') return null;
  // Check cache first
  try {
    const cached = await db.GeoCache.findOne({ ip }).lean();
    if (cached) return cached;
  } catch (e) {}
  // Lookup via ip-api.com (free, no key, 45 req/min)
  try {
    const resp = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting`, { timeout: 5000 });
    if (resp.data?.status === 'success') {
      const geo = { ip, ...resp.data };
      delete geo.status; delete geo.query;
      await db.GeoCache.findOneAndUpdate({ ip }, geo, { upsert: true }).catch(() => {});
      return geo;
    }
  } catch (e) {}
  return null;
}

// Protect against unhandled ENOENT error events on spawned child processes (e.g. ps, xvfb)
const rawSpawn = child_process.spawn;
child_process.spawn = function (...args) {
  const cp = rawSpawn.apply(this, args);
  if (cp && typeof cp.on === 'function') {
    cp.on('error', (err) => {
      if (err && err.code === 'ENOENT') {
        console.warn(`[MIYO] Handled non-fatal child process spawn error (${args[0]}):`, err.message);
      }
    });
  }
  return cp;
};
const require = createRequire(import.meta.url);
global.axios = axios.create({ timeout: 20000 });

try {
  const { cloudflareBypass, getPrefetchedResponse } = require('./utils/cloudflare.cjs');
  global.cloudflarebypass = cloudflareBypass;
  global.getPrefetchedResponse = getPrefetchedResponse;
} catch (e) {
  console.warn('Cloudflare bypass module not loaded:', e.message);
}

const { getHeaders } = require('./utils/proxyHeaders.cjs');

// Helper: remove a header case-insensitively and return its value (Strawverse pattern)
function takeHeaderCaseInsensitive(headers, name) {
  const wanted = name.toLowerCase();
  const key = Object.keys(headers || {}).find((k) => k.toLowerCase() === wanted);
  if (!key) return null;
  const value = headers[key];
  delete headers[key];
  return value;
}

// Helper: merge cf_clearance cookie into headers (Strawverse pattern)
function mergeCookie(headers, cookie) {
  if (!cookie) return;
  const existingCookie = takeHeaderCaseInsensitive(headers, 'cookie') || '';
  if (!existingCookie) {
    headers.Cookie = cookie;
    return;
  }
  if (!existingCookie.includes('cf_clearance=')) {
    headers.Cookie = existingCookie + '; ' + cookie;
    return;
  }
  headers.Cookie = existingCookie.replace(
    /cf_clearance=[^;]+/g,
    cookie.trim().replace(/;$/, ''),
  );
}

// Strawverse request interceptor — exact port from scrapper.js
global.axios.interceptors.request.use(
  (config) => {
    const headers = getHeaders(config.url, config.method);
    if (config.headers) {
      if (headers['User-Agent']) takeHeaderCaseInsensitive(config.headers, 'user-agent');
      if (headers['Referer']) takeHeaderCaseInsensitive(config.headers, 'referer');
      if (headers['Cookie']) {
        const existingCookie = takeHeaderCaseInsensitive(config.headers, 'cookie');
        if (existingCookie) mergeCookie(headers, existingCookie);
      }
    }
    if (config.headers && typeof config.headers.set === 'function') {
      Object.entries(headers).forEach(([k, v]) => {
        config.headers.set(k, v);
      });
    } else {
      config.headers = {
        ...config.headers,
        ...headers,
      };
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Strawverse response interceptor for Cloudflare challenge bypass
global.axios.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (
      data &&
      data.errors &&
      data.errors.some((e) => e.message === 'NEED_CAPTCHA') &&
      !response.config._retry &&
      global.cloudflarebypass
    ) {
      response.config._retry = true;
      const referer =
        response.config.headers?.Referer ||
        response.config.headers?.referer ||
        '';
      return global.cloudflarebypass(response.config.url, true, referer).then(() => {
        const newHeaders = getHeaders(response.config.url, response.config.method);
        response.config.headers = {
          ...response.config.headers,
          ...newHeaders,
        };
        return global.axios(response.config);
      });
    }
    return response;
  },
  async (error) => {
    const { config, response } = error;
    if (
      response &&
      (response.status === 403 || response.status === 503) &&
      config &&
      !config._retry &&
      global?.cloudflarebypass
    ) {
      config._retry = true;
      console.log(
        `Cloudflare challenge detected (status: ${response.status}) for ${config.url}. Retrying with bypass...`
      );
      try {
        const referer =
          config.headers?.Referer ||
          config.headers?.referer ||
          '';
        const creds = await global.cloudflarebypass(config.url, true, referer);
        if (!creds) {
          return Promise.reject(error);
        }
        const newHeaders = getHeaders(config.url, config.method);
        if (config.headers && typeof config.headers.set === 'function') {
          Object.entries(newHeaders).forEach(([k, v]) => {
            config.headers.set(k, v);
          });
        } else {
          config.headers = {
            ...config.headers,
            ...newHeaders,
          };
        }
        // Check if browser already fetched the response (skips doomed axios retry)
        if (global.getPrefetchedResponse) {
          const prefetched = global.getPrefetchedResponse(config.url);
          if (prefetched) {
            console.log(`[CF Bypass] Using browser-prefetched response (${prefetched.data.length} bytes)`);
            return {
              data: prefetched.data,
              status: prefetched.status || 200,
              statusText: 'OK (browser-prefetched)',
              headers: {},
              config: config,
            };
          }
        }
        return global.axios(config);
      } catch (bypassErr) {
        console.warn(`[CF Bypass] Bypass error:`, bypassErr.message);
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-run system setup (Chromium & shared libraries) if setup.cjs exists
const setupScript = path.join(__dirname, 'setup.cjs');
if (fs.existsSync(setupScript)) {
  try {
    execSync('node setup.cjs', { stdio: 'inherit' });
  } catch (e) {
    console.warn('[MIYO] Auto setup warning:', e.message);
  }
}

const app = express();
const port = process.env.SERVER_PORT || process.env.PORT || 3000;
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ═══════════════════════════════════════════════════════════════
// ── Ban Enforcement Middleware (runs on ALL routes) ──
// ═══════════════════════════════════════════════════════════════
app.use((req, res, next) => {
  if (!db || !db.isDBConnected()) return next();
  const clientIP = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  
  // 1. Direct IP ban check
  if (db.isIPBanned(clientIP)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  
  // 2. Check fingerprint ban via header OR cookie
  const fpId = req.headers['x-fingerprint-id'] || '';
  if (fpId && db.isFingerprintBanned(fpId)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  
  // 3. Cross-check: if this IP is associated with a banned fingerprint
  const linkedFps = db.getFingerprintsForIP(clientIP);
  for (const linkedFp of linkedFps) {
    if (db.isFingerprintBanned(linkedFp)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
  }
  
  // 4. Cross-check: if this fingerprint's other IPs are banned
  if (fpId) {
    const linkedIPs = db.getIPsForFingerprint(fpId);
    for (const linkedIP of linkedIPs) {
      if (db.isIPBanned(linkedIP)) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }
  }
  
  next();
});

// ═══════════════════════════════════════════════════════════════
// ── Analytics Tracking Middleware (tracks all /api/* requests) ──
// ═══════════════════════════════════════════════════════════════
app.use('/api', (req, res, next) => {
  if (!db || !db.isDBConnected()) return next();
  const startTime = Date.now();
  const clientIP = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  const fpId = req.headers['x-fingerprint-id'] || '';

  const originalEnd = res.end;
  res.end = function (...args) {
    const responseTime = Date.now() - startTime;
    // Fire-and-forget analytics write
    db.Analytics.create({
      ip: clientIP,
      fingerprintId: fpId,
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.headers['user-agent'] || '',
      rateLimited: res.statusCode === 429,
    }).catch(() => {});

    // Content access tracking (fire-and-forget)
    try {
      const queryPath = req.query?.path || '';
      const isTmdbRoute = req.path.endsWith('/tmdb') || req.path.endsWith('/api/tmdb');
      const tmdbMovie = queryPath.match(/^\/movie\/(\d+)/);
      const tmdbTv = queryPath.match(/^\/tv\/(\d+)/);
      if (isTmdbRoute && tmdbMovie) {
        db.ContentAccess.create({ contentType: 'movie', contentId: tmdbMovie[1], ip: clientIP, fingerprintId: fpId, timestamp: new Date() }).catch(() => {});
      } else if (isTmdbRoute && tmdbTv) {
        db.ContentAccess.create({ contentType: 'tv', contentId: tmdbTv[1], ip: clientIP, fingerprintId: fpId, timestamp: new Date() }).catch(() => {});
      }
      // Anime info pages
      if (req.path.includes('/anime/') && req.path.includes('/info') && req.query?.id) {
        db.ContentAccess.create({ contentType: 'anime', contentId: req.query.id, ip: clientIP, fingerprintId: fpId, timestamp: new Date() }).catch(() => {});
      }
      // Watch endpoint (anime streaming)
      if (req.path.endsWith('/watch') && req.method === 'POST') {
        db.ContentAccess.create({ contentType: 'anime', contentId: req.body?.ep || 'unknown', ip: clientIP, fingerprintId: fpId, timestamp: new Date() }).catch(() => {});
      }
    } catch (e) {}

    originalEnd.apply(this, args);
  };
  next();
});

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 150,
  message: { error: 'Too many API requests from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const proxyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 400,
  message: 'Too many video proxy requests. Rate limit exceeded.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/tmdb', apiLimiter);
app.use('/api/anilist', apiLimiter);
app.use('/api/anime', apiLimiter);
app.use('/api/watch', apiLimiter);
app.use('/api/proxy', proxyLimiter);
app.get('/api/tmdb', async (req, res) => {
  try {
    const targetPath = req.query.path || '/';
    const params = { ...req.query };
    delete params.path;
    params.api_key = process.env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY_HERE';
    const response = await axios({
      method: 'GET',
      url: `https://api.themoviedb.org/3${targetPath}`,
      params: params,
      headers: {
        'Accept': 'application/json',
      }
    });
        res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.message, data: err.response?.data });
  }
});
const extensionsDir = path.join(__dirname, 'extensions', 'Anime');
const providers = {};

if (fs.existsSync(extensionsDir)) {
  const files = fs.readdirSync(extensionsDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'));
  for (const file of files) {
    try {
      const extPath = path.join(extensionsDir, file);
      const provider = require(extPath);
      if (provider.name) {
        providers[provider.name] = provider;
        console.log(`Loaded provider: ${provider.name} (v${provider.version})`);
      }
    } catch (err) {
      console.error(`Failed to load extension ${file}:`, err);
    }
  }
}

// ── Manga Provider Extensions ──
const mangaExtensionsDir = path.join(__dirname, 'extensions', 'Manga');
const mangaProviders = {};
if (fs.existsSync(mangaExtensionsDir)) {
  const files = fs.readdirSync(mangaExtensionsDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'));
  for (const file of files) {
    try {
      const extPath = path.join(mangaExtensionsDir, file);
      const provider = require(extPath);
      if (provider.name) {
        mangaProviders[provider.name] = provider;
        console.log(`Loaded manga provider: ${provider.name} (v${provider.version})`);
      }
    } catch (err) {
      console.error(`Failed to load manga extension ${file}:`, err);
    }
  }
}
app.get('/api/providers', (req, res) => {
  res.json({
    providers: Object.entries(providers).map(([name, p]) => ({
      name,
      version: p.version || '1.0.0',
    }))
  });
});
app.get('/api/anime/:provider/:action', async (req, res) => {
  const { provider, action } = req.params;
  const p = providers[provider];
  if (!p) {
    return res.status(404).json({ error: `Provider ${provider} not found` });
  }
  try {
    switch (action) {
      case 'recent': {
        const page = parseInt(req.query.page) || 1;
        if (!p.fetchRecentEpisodes) return res.status(400).json({ error: 'Not supported' });
        const data = await p.fetchRecentEpisodes({ page });
        return res.json(data);
      }
      case 'search': {
        const query = req.query.query;
        const page = parseInt(req.query.page) || 1;
        if (!p.SearchAnime) return res.status(400).json({ error: 'Not supported' });
        const data = await p.SearchAnime(query, { page });
        return res.json(data);
      }
      case 'info': {
        const id = req.query.id;
        if (!p.AnimeInfo) return res.status(400).json({ error: 'Not supported' });
        const data = await p.AnimeInfo(id);
        return res.json(data);
      }
      case 'episodes': {
        const id = req.query.id;
        const page = parseInt(req.query.page) || 1;
        if (!p.fetchEpisode) return res.status(400).json({ error: 'Not supported' });
        const data = await p.fetchEpisode(id, page);
        return res.json(data);
      }
      case 'sources': {
        const id = req.query.id;
        if (!p.fetchEpisodeSources) return res.status(400).json({ error: 'Not supported' });
        const data = await p.fetchEpisodeSources(id);
        return res.json(data);
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error(`Error in ${provider}/${action}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ── Manga API Routes ──
// ═══════════════════════════════════════════════════════════════════════
app.use('/api/manga', apiLimiter);

app.get('/api/manga/providers', (req, res) => {
  res.json({
    providers: Object.entries(mangaProviders).map(([name, p]) => ({
      name,
      version: p.version || '1.0.0',
    }))
  });
});

app.get('/api/manga/:provider/:action', async (req, res) => {
  const { provider, action } = req.params;
  const p = mangaProviders[provider];
  if (!p) {
    return res.status(404).json({ error: `Manga provider ${provider} not found` });
  }
  try {
    switch (action) {
      case 'latest': {
        const page = parseInt(req.query.page) || 1;
        if (!p.latestManga) return res.status(400).json({ error: 'Not supported' });
        const data = await p.latestManga(page);
        return res.json(data);
      }
      case 'search': {
        const query = req.query.query;
        const page = parseInt(req.query.page) || 1;
        if (!p.searchManga) return res.status(400).json({ error: 'Not supported' });
        try {
          const data = await p.searchManga(query, page);
          return res.json(data || { current_page: page, hasNextPage: false, results: [] });
        } catch (searchErr) {
          console.error(`[Manga API] Search failed for ${provider}:`, searchErr.message);
          return res.json({ current_page: page, hasNextPage: false, results: [] });
        }
      }
      case 'info': {
        const id = req.query.id;
        if (!p.fetchMangaInfo) return res.status(400).json({ error: 'Not supported' });
        const data = await p.fetchMangaInfo(id);
        return res.json(data);
      }
      case 'chapters': {
        const id = req.query.id;
        if (!p.fetchChapters) return res.status(400).json({ error: 'Not supported' });
        const data = await p.fetchChapters(id);
        return res.json(data);
      }
      case 'pages': {
        const id = req.query.id;
        if (!p.fetchChapterPages) return res.status(400).json({ error: 'Not supported' });
        const data = await p.fetchChapterPages(id);
        return res.json(data);
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error(`Error in manga ${provider}/${action}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ── Image Proxy (for manga images that need specific Referer headers) ──
app.get('/api/image', proxyLimiter, async (req, res) => {
  try {
    let targetUrl = req.query.url;
    if (!targetUrl || targetUrl === 'undefined' || targetUrl === 'null') {
      return res.status(400).send('URL is required');
    }
    try {
      targetUrl = decodeURIComponent(targetUrl);
    } catch (_) {}

    while (targetUrl.includes('/api/image?url=')) {
      const idx = targetUrl.indexOf('/api/image?url=');
      targetUrl = targetUrl.substring(idx + '/api/image?url='.length);
      try { targetUrl = decodeURIComponent(targetUrl); } catch (_) {}
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return res.status(400).send('Invalid URL protocol');
    }

    const reqReferer = req.query.referer || '';
    const headers = getHeaders(targetUrl, 'GET');
    if (reqReferer) {
      headers['Referer'] = reqReferer;
      try { headers['Origin'] = new URL(reqReferer).origin; } catch (e) {}
    }
    const response = await axios({
      method: 'GET',
      url: targetUrl,
      responseType: 'stream',
      headers: headers,
      timeout: 30000,
    });
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);
  } catch (err) {
    res.status(err.response?.status || 500).send(err.message);
  }
});
app.post('/api/watch', async (req, res) => {
  const { ep, provider = 'anikoto', subdub } = req.body;
  try {
    if (!ep) throw new Error('Episode ID Not Found');
        const p = providers[provider];
    if (!p || !p.fetchEpisodeSources) {
      throw new Error(`Provider '${provider}' not found or doesn't support sources`);
    }
    let resolvedEp = ep;
    if (subdub && !ep.endsWith('-sub') && !ep.endsWith('-dub') && !ep.endsWith('-both')) {
      resolvedEp = `${ep}-${subdub}`;
    }
    const sourcesData = await p.fetchEpisodeSources(resolvedEp);
    if (sourcesData) {
      const allSources = [
        ...(Array.isArray(sourcesData.sources) ? sourcesData.sources : []),
        ...(sourcesData.sub?.sources || []),
        ...(sourcesData.dub?.sources || []),
      ];
      for (const src of allSources) {
        if (src.url) {
          try {
            const cdnDomain = new URL(src.url).hostname;
            const ref = src.headers?.Referer || fallbackReferer || '';
            if (ref) {
              global.setDynamicReferer(cdnDomain, ref);
              global.setFallbackReferer(ref);
            }
          } catch (e) {  }
        }
      }
    }
    res.status(200).json(sourcesData);
  } catch (err) {
    console.error('Watch error:', err.message);
    res.status(200).json({ sources: [] });
  }
});
app.get('/api/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    const explicitReferer = req.query.referer || '';
    if (!targetUrl) return res.status(400).send('URL is required');
    const referer = explicitReferer || getRefererForUrl(targetUrl);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    };
    if (referer) {
      headers['Referer'] = referer;
      try { headers['Origin'] = new URL(referer).origin; } catch (e) {  }
    }
    const response = await axios({
      method: 'GET',
      url: targetUrl,
      responseType: 'stream',
      headers: headers,
      timeout: 30000,
    });
    const contentType = response.headers['content-type'] || '';
    const isM3U8 = targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegURL');
    if (isM3U8) {
      const chunks = [];
      for await (const chunk of response.data) {
        chunks.push(chunk);
      }
      let playlist = Buffer.concat(chunks).toString('utf-8');
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      playlist = playlist.replace(/^(?!#)(\S+\.ts\S*)/gm, (match) => {
        const absoluteUrl = match.startsWith('http') ? match : baseUrl + match;
        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}`;
      });
      playlist = playlist.replace(/^(?!#)(\S+\.m3u8\S*)/gm, (match) => {
        const absoluteUrl = match.startsWith('http') ? match : baseUrl + match;
        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}`;
      });
      playlist = playlist.replace(/URI="([^"]+)"/g, (fullMatch, uri) => {
        if (uri.startsWith('/api/proxy')) return fullMatch;
        const absoluteUrl = uri.startsWith('http') ? uri : baseUrl + uri;
        return `URI="/api/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}"`;
      });
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(playlist);
    }
    const headersToForward = ['content-length', 'accept-ranges'];
    headersToForward.forEach(h => {
      if (response.headers[h]) {
        res.setHeader(h, response.headers[h]);
      }
    });
    if (targetUrl.includes('.vtt')) {
      res.setHeader('Content-Type', 'text/vtt');
    } else if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    response.data.pipe(res);
  } catch (err) {
    console.error('Proxy Error:', err.message);
    res.status(err.response?.status || 500).send(err.message);
  }
});
const CACHE_DIR = path.join(__dirname, '.cache', 'anilist');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
const CACHE_DURATION_MS = 1000 * 60 * 60; 
app.post('/api/anilist', async (req, res) => {
  try {
    const hash = crypto.createHash('md5').update(JSON.stringify(req.body)).digest('hex');
    const cacheFile = path.join(CACHE_DIR, `${hash}.json`);
    if (fs.existsSync(cacheFile)) {
      try {
        const cachedContent = fs.readFileSync(cacheFile, 'utf8');
        const cachedData = JSON.parse(cachedContent);
        if (Date.now() - cachedData.timestamp < CACHE_DURATION_MS) {
          return res.json(cachedData.data);
        }
      } catch (err) {
      }
    }
    const response = await axios({
      method: 'POST',
      url: 'https://graphql.anilist.co',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      data: req.body,
    });
    try {
      fs.writeFileSync(cacheFile, JSON.stringify({
        timestamp: Date.now(),
        data: response.data
      }));
    } catch (err) {
      console.error('Failed to write cache to disk:', err.message);
    }
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    console.error('AniList proxy error:', status, err.message);
    if (err.response?.data) {
      res.status(status).json(err.response.data);
    } else {
      res.status(status).json({ error: err.message });
    }
  }
});
// ═══════════════════════════════════════════════════════════════════════
// ── Watch Together: Pure Node.js WebSocket Server (no Go binary) ──
// Implements the StrawVerse binary protocol directly in JS.
// Runs on the SAME HTTP server as Express — no separate port needed.
// ═══════════════════════════════════════════════════════════════════════
import { WebSocketServer } from 'ws';

// ── Binary Protocol Opcodes ──
const OP = {
  JOIN_ROOM:      0x01,
  ROOM_JOINED:    0x02,
  USER_EVENT:     0x03,
  PLAY_PAUSE:     0x04,
  TIME_SYNC:      0x05,
  LOAD_MEDIA:     0x06,
  CLIENT_READY:   0x07,
  START_PLAYBACK: 0x08,
  ADD_QUEUE:      0x09,
  CHAT_MSG:       0x0A,
  PING:           0x0B,
  PONG:           0x0C,
  ERROR:          0x0D,
  REMOVE_QUEUE:   0x0E,
  CAPTION_SYNC:  0x0F,
  VOICE_SIGNAL:  0x10,
  VOICE_STATE:   0x11,
};

const USER_JOINED = 0x00;
const USER_LEFT   = 0x01;

// ── Protocol encode/decode helpers ──
function padCode(s, len) {
  return (s + '      ').slice(0, len);
}

function encodeRoomJoined(isHost, userID, roomCode, provider) {
  const pBuf = Buffer.from(provider || '');
  const buf = Buffer.alloc(1 + 1 + 1 + 6 + 1 + pBuf.length);
  buf[0] = OP.ROOM_JOINED;
  buf[1] = isHost ? 1 : 0;
  buf[2] = userID;
  buf.write(padCode(roomCode, 6), 3, 6, 'utf8');
  buf[9] = pBuf.length;
  pBuf.copy(buf, 10);
  return buf;
}

function encodeUserEvent(eventType, userID, username) {
  const nBuf = Buffer.from(username || '');
  const buf = Buffer.alloc(1 + 1 + 1 + 1 + nBuf.length);
  buf[0] = OP.USER_EVENT;
  buf[1] = eventType;
  buf[2] = userID;
  buf[3] = nBuf.length;
  nBuf.copy(buf, 4);
  return buf;
}

function encodeChatMsg(sender, message) {
  const sBuf = Buffer.from(sender);
  const mBuf = Buffer.from(message);
  const buf = Buffer.alloc(1 + 1 + sBuf.length + 2 + mBuf.length);
  buf[0] = OP.CHAT_MSG;
  buf[1] = sBuf.length;
  sBuf.copy(buf, 2);
  buf.writeUInt16BE(mBuf.length, 2 + sBuf.length);
  mBuf.copy(buf, 4 + sBuf.length);
  return buf;
}

function encodeClientReady(userID) {
  return Buffer.from([OP.CLIENT_READY, userID]);
}

function encodeStartPlayback() {
  return Buffer.from([OP.START_PLAYBACK]);
}

function encodeError(code, msg) {
  const mBuf = Buffer.from(msg);
  const buf = Buffer.alloc(1 + 1 + 2 + mBuf.length);
  buf[0] = OP.ERROR;
  buf[1] = code;
  buf.writeUInt16BE(mBuf.length, 2);
  mBuf.copy(buf, 4);
  return buf;
}

function decodeJoinRoom(data) {
  if (data.length < 8) return null;
  const code = data.slice(1, 7).toString('utf8').trim();
  const nameLen = data[7];
  if (data.length < 8 + nameLen) return null;
  const username = data.slice(8, 8 + nameLen).toString('utf8');
  let provider = '';
  if (data.length > 8 + nameLen) {
    const pLen = data[8 + nameLen];
    if (data.length >= 9 + nameLen + pLen) {
      provider = data.slice(9 + nameLen, 9 + nameLen + pLen).toString('utf8');
    }
  }
  return { code, username, provider };
}

function decodeChatMsg(data) {
  if (data.length < 4) return null;
  const sLen = data[1];
  if (data.length < 4 + sLen) return null;
  const sender = data.slice(2, 2 + sLen).toString('utf8');
  const mLen = data.readUInt16BE(2 + sLen);
  if (data.length < 4 + sLen + mLen) return null;
  const message = data.slice(4 + sLen, 4 + sLen + mLen).toString('utf8');
  return { sender, message };
}

function decodeUserEvent(data) {
  if (data.length < 4) return null;
  const eventType = data[1];
  const userID = data[2];
  const nameLen = data[3];
  const val = data.length >= 4 + nameLen ? data.slice(4, 4 + nameLen).toString('utf8') : '';
  return { eventType, userID, val };
}

// ── Room Code Generator ──
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(len = 6) {
  let code = '';
  for (let i = 0; i < len; i++) {
    code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  }
  return code;
}

// ── Room Manager ──
const rooms = new Map();

class Room {
  constructor(code) {
    this.code = code;
    this.clients = new Map(); // ws -> { id, username, provider, isHost, isCoHost }
    this.nextID = 1;
    this.host = null;
    this.isLoading = false;
    this.readyClients = new Set();
  }

  register(ws, username, provider) {
    const userID = this.nextID++;
    const isHost = this.clients.size === 0;
    const info = { id: userID, username, provider, isHost, isCoHost: false };
    this.clients.set(ws, info);
    if (isHost) this.host = ws;

    // Tell the new client they joined
    const hostProvider = this.host ? this.clients.get(this.host)?.provider || '' : '';
    ws.send(encodeRoomJoined(isHost, userID, this.code, hostProvider));

    // Tell the new client about existing users
    for (const [otherWs, otherInfo] of this.clients) {
      if (otherWs !== ws) {
        ws.send(encodeUserEvent(USER_JOINED, otherInfo.id, otherInfo.username));
        if (otherInfo.voiceState) {
          ws.send(otherInfo.voiceState);
        }
      }
    }

    // Tell everyone else about the new client
    this.broadcast(encodeUserEvent(USER_JOINED, userID, username), ws);

    // If the room has an active media state, send it to the new user immediately
    if (this.currentMedia) {
      ws.send(this.currentMedia);
    }

    console.log(`[MIYO-WT] Room ${this.code}: ${username} (ID ${userID}) joined. Total: ${this.clients.size}`);
    return info;
  }

  unregister(ws) {
    const info = this.clients.get(ws);
    if (!info) return;
    this.clients.delete(ws);
    this.readyClients.delete(info.id);

    // Promote new host if the host left
    if (this.host === ws) {
      this.host = null;
      for (const [otherWs, otherInfo] of this.clients) {
        this.host = otherWs;
        otherInfo.isHost = true;
        this.broadcast(encodeUserEvent(0x02, otherInfo.id, ''), null);
        break;
      }
    }

    if (this.clients.size === 0) {
      rooms.delete(this.code);
      console.log(`[MIYO-WT] Room ${this.code}: destroyed (empty)`);
    } else {
      this.broadcast(encodeUserEvent(USER_LEFT, info.id, info.username), ws);
    }
  }

  broadcast(data, sender) {
    for (const [ws] of this.clients) {
      if (ws !== sender && ws.readyState === 1) {
        ws.send(data);
      }
    }
  }

  /** Send to a specific user by ID (for WebRTC signaling) */
  sendToUser(targetID, data) {
    for (const [ws, info] of this.clients) {
      if (info.id === targetID && ws.readyState === 1) {
        ws.send(data);
        return true;
      }
    }
    return false;
  }

  handleLoadMedia(data) {
    this.isLoading = true;
    this.readyClients.clear();
    // Broadcast to ALL clients (including sender, so they get the command too)
    for (const [ws] of this.clients) {
      if (ws.readyState === 1) ws.send(data);
    }
  }

  handleClientReady(ws) {
    const info = this.clients.get(ws);
    if (!info) return;
    this.readyClients.add(info.id);
    this.broadcast(encodeClientReady(info.id), null);
    if (this.readyClients.size >= this.clients.size && this.isLoading) {
      this.isLoading = false;
      for (const [c] of this.clients) {
        if (c.readyState === 1) c.send(encodeStartPlayback());
      }
      console.log(`[MIYO-WT] Room ${this.code}: All ${this.clients.size} clients ready. START_PLAYBACK.`);
    }
  }

  handleChat(data, senderWs) {
    const decoded = decodeChatMsg(data);
    if (!decoded) return;
    const senderInfo = this.clients.get(senderWs);
    const senderName = senderInfo?.username || 'Guest';
    const relayed = encodeChatMsg(senderName, decoded.message);
    // Send to all including sender so they see their own message
    for (const [ws] of this.clients) {
      if (ws.readyState === 1) ws.send(relayed);
    }
  }
}

function joinOrCreateRoom(code, ws, username, provider) {
  if (!code || code.trim() === '' || code === 'CREATE' || code.trim() === '') {
    let newCode;
    do { newCode = generateCode(); } while (rooms.has(newCode));
    const room = new Room(newCode);
    rooms.set(newCode, room);
    room.register(ws, username, provider);
    return room;
  }
  code = code.trim();
  let room = rooms.get(code);
  if (!room) {
    room = new Room(code);
    rooms.set(code, room);
  }
  room.register(ws, username, provider);
  return room;
}

// ── API endpoints (no proxy needed, data is in-process) ──
app.get('/api/wt/health', (req, res) => {
  let totalClients = 0;
  for (const room of rooms.values()) totalClients += room.clients.size;
  res.json({ status: 'ok', server: 'MIYO Watch Together (Node.js)', active_rooms: rooms.size, active_clients: totalClients });
});

app.get('/api/wt/rooms', (req, res) => {
  const list = [];
  for (const room of rooms.values()) {
    const users = [];
    let hostIdx = 0;
    for (const [, info] of room.clients) {
      users.push(info.username);
      if (info.isHost) hostIdx = users.length - 1;
    }
    list.push({ code: room.code, users, host_idx: hostIdx });
  }
  res.json({ rooms: list });
});

app.get('/api/wt/config', (req, res) => {
  // WS runs on the same server, so use the same origin
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
  const host = req.headers.host;
  res.json({ wsUrl: `${protocol}://${host}/ws`, port: port });
});

// ═══════════════════════════════════════════════════════════════════════
// ── Device Fingerprint Collection Endpoint ──
// ═══════════════════════════════════════════════════════════════════════
app.post('/api/fingerprint', async (req, res) => {
  if (!db || !db.isDBConnected()) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const { id, components, collectedAt } = req.body;
    if (!id || !components) return res.status(400).json({ error: 'Invalid fingerprint data' });

    const clientIP = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    const ua = req.headers['user-agent'] || '';

    // Parse browser/OS summary from UA (enhanced detection)
    const uaParts = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|OPR|Brave|Vivaldi|SamsungBrowser)\/(\d+)/) || [];
    const osParts = ua.match(/(Windows NT [\d.]+|Mac OS X [\d_]+|Linux|Android [\d.]+|iPhone OS [\d_]+|CrOS|Ubuntu|Fedora)/) || [];
    let browserName = uaParts[1] || 'Unknown';
    if (browserName === 'OPR') browserName = 'Opera';
    const osName = osParts[1]?.replace(/_/g, '.') || 'Unknown';
    
    // Detect device type from UA
    let deviceType = 'Desktop';
    if (/Mobile|Android.*Mobile|iPhone|iPod/.test(ua)) deviceType = 'Mobile';
    else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) deviceType = 'Tablet';
    else if (/Smart-?TV|TV|CrKey|BRAVIA|AppleTV/.test(ua)) deviceType = 'TV';

    const summary = {
      browser: `${browserName} ${uaParts[2] || ''}`.trim(),
      os: osName,
      gpu: components.webgl?.renderer || 'Unknown',
      screen: components.hardware?.screen ? `${components.hardware.screen.width}x${components.hardware.screen.height}` : 'Unknown',
      cpuCores: components.hardware?.cpuCores || null,
      deviceMemory: components.hardware?.deviceMemory || null,
      timezone: components.locale?.timezone || null,
      language: components.locale?.language || null,
      fontCount: components.fonts?.length || 0,
      voiceCount: components.voices?.length || 0,
      deviceType,
    };

    // IP Geolocation enrichment (async, non-blocking)
    const geoUpdate = {};
    lookupIPGeo(clientIP).then(geo => {
      if (geo) {
        db.Fingerprint.findOneAndUpdate(
          { fingerprintId: id },
          { $set: { geo: { country: geo.country, countryCode: geo.countryCode, region: geo.regionName, city: geo.city, isp: geo.isp, org: geo.org, as: geo.as, lat: geo.lat, lon: geo.lon } } }
        ).catch(() => {});
      }
    }).catch(() => {});

    // Upsert fingerprint
    await db.Fingerprint.findOneAndUpdate(
      { fingerprintId: id },
      {
        $set: { components, summary, lastSeen: new Date() },
        $addToSet: { ips: clientIP, userAgents: ua },
        $inc: { visitCount: 1 },
        $setOnInsert: { firstSeen: new Date() },
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, id });
  } catch (err) {
    console.error('[MIYO-FP] Fingerprint save error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ── Admin Authentication & API ──
// ═══════════════════════════════════════════════════════════════════════

// Google ID Token verification (without googleapis library — uses tokeninfo endpoint)
async function verifyGoogleToken(idToken) {
  try {
    const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const payload = response.data;
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) return null;
    return {
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture || '',
    };
  } catch (e) {
    return null;
  }
}

// Generate admin session token
function generateSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

// Admin auth middleware
async function requireAdmin(req, res, next) {
  if (!db || !db.isDBConnected()) return res.status(503).json({ error: 'Database unavailable' });
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const session = await db.AdminSession.findOne({ token, expiresAt: { $gt: new Date() } });
    if (!session) return res.status(401).json({ error: 'Session expired or invalid' });
    if (session.email !== process.env.ADMIN_EMAIL) return res.status(403).json({ error: 'Unauthorized' });
    req.adminUser = { email: session.email, name: session.name, picture: session.picture };
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
  }
}

// ── Auth endpoints ──
app.post('/api/admin/auth/google', async (req, res) => {
  if (!db || !db.isDBConnected()) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    const user = await verifyGoogleToken(credential);
    if (!user) return res.status(401).json({ error: 'Invalid Google token' });

    // Check if email matches admin
    if (user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'You are not authorized to access the admin panel.' });
    }

    // Create session
    const token = generateSessionToken();
    await db.AdminSession.create({
      token,
      email: user.email,
      name: user.name,
      picture: user.picture,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    res.json({ token, user });
  } catch (err) {
    console.error('[MIYO-ADMIN] Auth error:', err.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.get('/api/admin/auth/verify', async (req, res) => {
  if (!db || !db.isDBConnected()) return res.status(503).json({ error: 'Database unavailable' });
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const session = await db.AdminSession.findOne({ token, expiresAt: { $gt: new Date() } });
    if (!session || session.email !== process.env.ADMIN_EMAIL) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    res.json({ user: { email: session.email, name: session.name, picture: session.picture } });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/admin/auth/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && db?.isDBConnected()) {
    await db.AdminSession.deleteOne({ token }).catch(() => {});
  }
  res.json({ ok: true });
});

// ── Admin: Dashboard Stats ──
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hourAgo = new Date(now - 60 * 60 * 1000);

    const [totalDevices, totalBans, requestsToday, requestsHour, rateLimitHitsToday, uniqueIpsToday] = await Promise.all([
      db.Fingerprint.countDocuments(),
      db.Ban.countDocuments({ active: true }),
      db.Analytics.countDocuments({ timestamp: { $gte: todayStart } }),
      db.Analytics.countDocuments({ timestamp: { $gte: hourAgo } }),
      db.Analytics.countDocuments({ timestamp: { $gte: todayStart }, rateLimited: true }),
      db.Analytics.distinct('ip', { timestamp: { $gte: todayStart } }).then(ips => ips.length),
    ]);

    res.json({
      totalDevices,
      activeBans: totalBans,
      requestsToday,
      requestsPerHour: requestsHour,
      rateLimitsHit: rateLimitHitsToday,
      uniqueIPsToday: uniqueIpsToday,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Devices (Fingerprints) ──
app.get('/api/admin/devices', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', sort = '-lastSeen' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = search ? {
      $or: [
        { fingerprintId: { $regex: search, $options: 'i' } },
        { ips: { $regex: search, $options: 'i' } },
        { 'summary.browser': { $regex: search, $options: 'i' } },
        { 'summary.os': { $regex: search, $options: 'i' } },
        { 'summary.gpu': { $regex: search, $options: 'i' } },
        { 'summary.timezone': { $regex: search, $options: 'i' } },
      ]
    } : {};

    const [devices, total] = await Promise.all([
      db.Fingerprint.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      db.Fingerprint.countDocuments(query),
    ]);

    res.json({ devices, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/devices/:id', requireAdmin, async (req, res) => {
  try {
    const device = await db.Fingerprint.findOne({ fingerprintId: req.params.id }).lean();
    if (!device) return res.status(404).json({ error: 'Device not found' });

    // Also get recent request analytics for this device
    const recentRequests = await db.Analytics.find({ fingerprintId: req.params.id })
      .sort('-timestamp')
      .limit(100)
      .lean();

    // Check if banned
    const ban = await db.Ban.findOne({ type: 'fingerprint', value: req.params.id, active: true });

    res.json({ device, recentRequests, banned: !!ban, banDetails: ban });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Analytics ──
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    // Top endpoints
    const topEndpoints = await db.Analytics.aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $group: { _id: '$endpoint', count: { $sum: 1 }, avgResponseTime: { $avg: '$responseTime' } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // Top IPs
    const topIPs = await db.Analytics.aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $group: { _id: '$ip', count: { $sum: 1 }, rateLimitHits: { $sum: { $cond: ['$rateLimited', 1, 0] } } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // Requests per hour (for chart)
    const requestsPerHour = await db.Analytics.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%dT%H:00:00', date: '$timestamp' },
          },
          count: { $sum: 1 },
          rateLimited: { $sum: { $cond: ['$rateLimited', 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ topEndpoints, topIPs, requestsPerHour });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Abuse Detection ──
app.get('/api/admin/analytics/abuse', requireAdmin, async (req, res) => {
  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // IPs with most rate limit hits in last hour
    const rateLimitAbusers = await db.Analytics.aggregate([
      { $match: { timestamp: { $gte: hourAgo }, rateLimited: true } },
      { $group: { _id: '$ip', hits: { $sum: 1 } } },
      { $sort: { hits: -1 } },
      { $limit: 20 },
    ]);

    // Burst detection: IPs with >100 requests in last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const burstAbusers = await db.Analytics.aggregate([
      { $match: { timestamp: { $gte: fiveMinAgo } } },
      { $group: { _id: '$ip', count: { $sum: 1 }, endpoints: { $addToSet: '$endpoint' } } },
      { $match: { count: { $gt: 100 } } },
      { $sort: { count: -1 } },
    ]);

    // Scraping indicators: IPs hitting many unique endpoints
    const scrapers = await db.Analytics.aggregate([
      { $match: { timestamp: { $gte: hourAgo } } },
      { $group: { _id: '$ip', uniqueEndpoints: { $addToSet: '$endpoint' }, totalRequests: { $sum: 1 } } },
      { $project: { _id: 1, endpointCount: { $size: '$uniqueEndpoints' }, totalRequests: 1 } },
      { $match: { endpointCount: { $gt: 30 } } },
      { $sort: { endpointCount: -1 } },
      { $limit: 20 },
    ]);

    res.json({ rateLimitAbusers, burstAbusers, scrapers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Bans ──
app.get('/api/admin/bans', requireAdmin, async (req, res) => {
  try {
    const bans = await db.Ban.find().sort('-bannedAt').lean();
    res.json({ bans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/ban', requireAdmin, async (req, res) => {
  try {
    const { type, value, reason, expiresAt, crossBan } = req.body;
    if (!type || !value) return res.status(400).json({ error: 'Type and value are required' });
    if (!['ip', 'fingerprint'].includes(type)) return res.status(400).json({ error: 'Type must be ip or fingerprint' });

    const existing = await db.Ban.findOne({ type, value, active: true });
    if (existing) return res.status(409).json({ error: 'Already banned' });

    const ban = await db.Ban.create({
      type,
      value,
      reason: reason || '',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      bannedBy: req.adminUser?.email || 'admin',
    });

    // Auto cross-ban: if banning an IP, also ban all associated fingerprints
    const crossBans = [];
    if (crossBan !== false) {
      if (type === 'ip') {
        const linkedFps = db.getFingerprintsForIP(value);
        for (const fp of linkedFps) {
          const exists = await db.Ban.findOne({ type: 'fingerprint', value: fp, active: true });
          if (!exists) {
            const cb = await db.Ban.create({ type: 'fingerprint', value: fp, reason: `Auto: linked to banned IP ${value}`, bannedBy: 'auto-crossban' });
            crossBans.push(cb);
          }
        }
      } else if (type === 'fingerprint') {
        const linkedIPs = db.getIPsForFingerprint(value);
        for (const ip of linkedIPs) {
          const exists = await db.Ban.findOne({ type: 'ip', value: ip, active: true });
          if (!exists) {
            const cb = await db.Ban.create({ type: 'ip', value: ip, reason: `Auto: linked to banned device ${value.slice(0, 12)}...`, bannedBy: 'auto-crossban' });
            crossBans.push(cb);
          }
        }
      }
    }

    db.invalidateBanCache();
    await db.refreshBanCache();

    res.json({ ok: true, ban, crossBans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/ban/:id', requireAdmin, async (req, res) => {
  try {
    const ban = await db.Ban.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!ban) return res.status(404).json({ error: 'Ban not found' });

    db.invalidateBanCache();
    await db.refreshBanCache();

    res.json({ ok: true, ban });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Live Request Log ──
app.get('/api/admin/requests', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100, ip, endpoint, fingerprintId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (ip) query.ip = ip;
    if (endpoint) query.endpoint = { $regex: endpoint, $options: 'i' };
    if (fingerprintId) query.fingerprintId = fingerprintId;

    const [requests, total] = await Promise.all([
      db.Analytics.find(query).sort('-timestamp').skip(skip).limit(parseInt(limit)).lean(),
      db.Analytics.countDocuments(query),
    ]);

    res.json({ requests, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Top Visited Routes ──
app.get('/api/admin/routes/top', requireAdmin, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    const routes = await db.Analytics.aggregate([
      { $match: { timestamp: { $gte: since }, endpoint: { $not: /\/admin/ } } },
      { $group: { _id: '$endpoint', count: { $sum: 1 }, uniqueIPs: { $addToSet: '$ip' }, avgResponseTime: { $avg: '$responseTime' } } },
      { $project: { _id: 1, count: 1, uniqueIPCount: { $size: '$uniqueIPs' }, avgResponseTime: 1 } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]);
    res.json({ routes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Top Content (Most Accessed Movies/TV/Anime) ──
app.get('/api/admin/content/top', requireAdmin, async (req, res) => {
  try {
    const { hours = 168, type } = req.query; // default 7 days
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    const match = { timestamp: { $gte: since } };
    if (type) match.contentType = type;

    const content = await db.ContentAccess.aggregate([
      { $match: match },
      { $group: { _id: { contentType: '$contentType', contentId: '$contentId' }, count: { $sum: 1 }, uniqueViewers: { $addToSet: '$fingerprintId' }, title: { $first: '$title' }, lastAccessed: { $max: '$timestamp' } } },
      { $project: { _id: 1, count: 1, viewerCount: { $size: '$uniqueViewers' }, title: 1, lastAccessed: 1 } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Linked Devices (same person detection) ──
app.get('/api/admin/devices/:id/linked', requireAdmin, async (req, res) => {
  try {
    const device = await db.Fingerprint.findOne({ fingerprintId: req.params.id }).lean();
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const linkedDevices = [];
    const seen = new Set([req.params.id]);

    // 1. Devices sharing any IP address (strong link)
    if (device.ips?.length) {
      const ipLinked = await db.Fingerprint.find({
        fingerprintId: { $ne: req.params.id },
        ips: { $in: device.ips },
      }).lean();
      for (const d of ipLinked) {
        if (!seen.has(d.fingerprintId)) {
          const sharedIPs = d.ips.filter(ip => device.ips.includes(ip));
          linkedDevices.push({ ...d, linkType: 'shared_ip', confidence: 95, sharedIPs, reason: `Shares ${sharedIPs.length} IP(s)` });
          seen.add(d.fingerprintId);
        }
      }
    }

    // 2. Devices with similar hardware profile (medium link)
    if (device.summary) {
      const hardwareMatch = {
        fingerprintId: { $nin: Array.from(seen) },
        'summary.gpu': device.summary.gpu,
        'summary.screen': device.summary.screen,
        'summary.cpuCores': device.summary.cpuCores,
      };
      if (device.summary.gpu && device.summary.gpu !== 'Unknown') {
        const hwLinked = await db.Fingerprint.find(hardwareMatch).limit(10).lean();
        for (const d of hwLinked) {
          let confidence = 40;
          if (d.summary?.timezone === device.summary.timezone) confidence += 20;
          if (d.summary?.language === device.summary.language) confidence += 10;
          if (d.summary?.deviceMemory === device.summary.deviceMemory) confidence += 10;
          if (d.summary?.fontCount === device.summary.fontCount) confidence += 10;
          linkedDevices.push({ ...d, linkType: 'hardware_match', confidence, reason: `Same GPU + screen + CPU (${confidence}%)` });
          seen.add(d.fingerprintId);
        }
      }
    }

    // 3. Devices with same timezone + language + OS (weak link)
    if (device.summary?.timezone && device.summary?.language) {
      const localeMatch = await db.Fingerprint.find({
        fingerprintId: { $nin: Array.from(seen) },
        'summary.timezone': device.summary.timezone,
        'summary.language': device.summary.language,
        'summary.os': device.summary.os,
      }).limit(5).lean();
      for (const d of localeMatch) {
        linkedDevices.push({ ...d, linkType: 'locale_match', confidence: 25, reason: 'Same timezone + language + OS' });
        seen.add(d.fingerprintId);
      }
    }

    // Sort by confidence
    linkedDevices.sort((a, b) => b.confidence - a.confidence);

    res.json({ linkedDevices, sourceDevice: device });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: IP Geolocation ──
app.get('/api/admin/geo/:ip', requireAdmin, async (req, res) => {
  try {
    const geo = await lookupIPGeo(req.params.ip);
    res.json({ geo: geo || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Bulk IP Geo for a device ──
app.get('/api/admin/devices/:id/geo', requireAdmin, async (req, res) => {
  try {
    const device = await db.Fingerprint.findOne({ fingerprintId: req.params.id }).lean();
    if (!device) return res.status(404).json({ error: 'Device not found' });
    const geoResults = {};
    for (const ip of (device.ips || []).slice(0, 10)) {
      geoResults[ip] = await lookupIPGeo(ip);
    }
    res.json({ geoResults });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Enhanced Stats ──
app.get('/api/admin/stats/extended', requireAdmin, async (req, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [countries, topRoutes, topContent, deviceTypes] = await Promise.all([
      db.Fingerprint.distinct('geo.country').then(c => c.filter(Boolean)),
      db.Analytics.aggregate([
        { $match: { timestamp: { $gte: todayStart }, endpoint: { $not: /\/admin/ } } },
        { $group: { _id: '$endpoint', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      db.ContentAccess.aggregate([
        { $match: { timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: { type: '$contentType', id: '$contentId' }, count: { $sum: 1 }, title: { $first: '$title' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      db.Fingerprint.aggregate([
        { $group: { _id: '$summary.deviceType', count: { $sum: 1 } } },
      ]),
    ]);
    res.json({ countries, countryCount: countries.length, topRoutes, topContent, deviceTypes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve static files ──
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  // Automatically fix permissions for the dist directory so express.static can read it
  try {
    exec(`chmod -R 755 "${distPath}"`, (err) => {
      if (err) console.error('[MIYO-WT] Failed to set permissions on dist:', err.message);
      else console.log('[MIYO-WT] Successfully set read/execute permissions on dist/');
    });
  } catch (err) {}

  // ── Serve static files ──
  app.use(express.static(distPath));
  // SPA fallback — only for navigation requests, not missing assets
  app.get('/{*splat}', (req, res) => {
    // If the request looks like a file (has an extension), return 404 instead of index.html
    if (req.path.match(/\.\w+$/)) {
      return res.status(404).end();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.send('Backend is running, but dist folder not found. Run "npm run build" to build the frontend.'));
}

// ── Start HTTP server + attach WebSocket ──
const server = app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  console.log(`[MIYO-WT] Watch Together WebSocket running on same port (path: /ws)`);
  const isDev = process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'dev';
  if (process.env.CF_TOKEN && !isDev) {
    console.log('[CLOUDFLARE] Starting Cloudflare Tunnel...');
    const tunnel = exec(`npx --yes cloudflared tunnel --no-autoupdate --protocol http2 run --token ${process.env.CF_TOKEN}`);
    tunnel.stdout.on('data', data => process.stdout.write(`[CF] ${data}`));
    tunnel.stderr.on('data', data => process.stdout.write(`[CF] ${data}`));
    tunnel.on('close', code => {
      console.log(`[CLOUDFLARE] Tunnel process exited with code ${code}`);
    });
  }
});

// ── Attach WebSocket server to the same HTTP server ──
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  let room = null;
  let msgCount = 0;
  let lastReset = Date.now();

  ws.on('message', (data) => {
    const buf = Buffer.from(data);
    if (buf.length === 0) return;

    // Rate limit: 30 msg/sec
    const now = Date.now();
    if (now - lastReset > 1000) { msgCount = 0; lastReset = now; }
    if (++msgCount > 30) return;

    const opcode = buf[0];

    switch (opcode) {
      case OP.JOIN_ROOM: {
        const parsed = decodeJoinRoom(buf);
        if (!parsed) { ws.send(encodeError(0x01, 'Invalid join packet')); return; }
        room = joinOrCreateRoom(parsed.code, ws, parsed.username || 'Guest', parsed.provider);
        break;
      }

      case OP.PLAY_PAUSE:
      case OP.TIME_SYNC:
      case OP.ADD_QUEUE:
      case OP.REMOVE_QUEUE:
        if (room) room.broadcast(buf, ws);
        break;

      case OP.LOAD_MEDIA:
        if (room) room.handleLoadMedia(buf);
        break;

      case OP.CLIENT_READY:
        if (room) room.handleClientReady(ws);
        break;

      case OP.CHAT_MSG:
        if (room) room.handleChat(buf, ws);
        break;

      case OP.USER_EVENT: {
        if (room) {
          const clientInfo = room.clients.get(ws);
          if (clientInfo?.isHost) {
            room.broadcast(buf, null);
          }
        }
        break;
      }

      case OP.CAPTION_SYNC:
      case OP.VOICE_STATE:
        // Broadcast to everyone else in the room
        if (room) {
          const senderInfo = room.clients.get(ws);
          if (senderInfo) senderInfo.voiceState = Buffer.from(buf);
          room.broadcast(buf, ws);
        }
        break;

      case OP.SYNC_MEDIA:
        if (room) {
          room.currentMedia = Buffer.from(buf);
          room.broadcast(buf, ws);
        }
        break;

      case OP.VOICE_SIGNAL: {
        // Targeted relay: [0x10] [targetUserID] [rest...]
        // Rewrite byte 1 to sender's ID, then send to target
        if (room && buf.length >= 2) {
          const targetID = buf[1];
          const senderInfo = room.clients.get(ws);
          if (senderInfo) {
            const relayed = Buffer.from(buf);
            relayed[1] = senderInfo.id; // replace target with sender ID
            room.sendToUser(targetID, relayed);
          }
        }
        break;
      }

      case OP.PING: {
        const pong = Buffer.from(buf);
        pong[0] = OP.PONG;
        ws.send(pong);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (room) room.unregister(ws);
  });

  ws.on('error', () => {
    if (room) room.unregister(ws);
  });
});

console.log('[MIYO-WT] Watch Together module loaded');