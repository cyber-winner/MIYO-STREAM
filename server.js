process.noDeprecation = true;
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import axios from 'axios';
import { createRequire } from 'module';
import { exec, spawn } from 'child_process';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
global.axios = axios.create();
const domainReferers = new Map();
let fallbackReferer = '';
global.setDynamicReferer = (domain, referer) => {
  domainReferers.set(domain, referer);
};
global.setFallbackReferer = (referer) => {
  fallbackReferer = referer;
};
function getRefererForUrl(url) {
  try {
    if (url.includes('anikototv.to') || url.includes('megaplay.buzz')) {
      return 'https://anikototv.to/';
    }
    if (url.includes('animepahe')) {
      return 'https://animepahe.pw/';
    }
    if (url.includes('kwik.cx')) {
      return 'https://animepahe.pw/';
    }
    if (url.includes('owocdn.top') || url.includes('uwucdn.top')) {
      return 'https://kwik.cx/';
    }
    const domain = new URL(url).hostname;
    if (domainReferers.has(domain)) return domainReferers.get(domain);
    const parts = domain.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join('.');
      if (domainReferers.has(parent)) return domainReferers.get(parent);
    }
    if (fallbackReferer) return fallbackReferer;
  } catch (e) {
  }
  return '';
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.SERVER_PORT || process.env.PORT || 3000;
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
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
const require = createRequire(import.meta.url);
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
        const data = await p.searchManga(query, page);
        return res.json(data);
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
    const targetUrl = req.query.url;
    const referer = req.query.referer || '';
    if (!targetUrl) return res.status(400).send('URL is required');
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    };
    if (referer) {
      headers['Referer'] = referer;
      try { headers['Origin'] = new URL(referer).origin; } catch (e) {}
    } else {
      // Auto-detect referer from URL
      const r = getRefererForUrl(targetUrl);
      if (r) {
        headers['Referer'] = r;
        try { headers['Origin'] = new URL(r).origin; } catch (e) {}
      }
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
    console.error('Image Proxy Error:', err.message);
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
    const tunnel = exec(`npx --yes cloudflared tunnel --no-autoupdate run --token ${process.env.CF_TOKEN}`);
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