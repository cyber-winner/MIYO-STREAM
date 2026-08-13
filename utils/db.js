/**
 * MIYO-STREAM Database Layer v2
 * MongoDB connection + Mongoose models for fingerprints, analytics, bans, sessions,
 * content access tracking, and IP geolocation cache.
 */
import mongoose from 'mongoose';

// ── Connection ──
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[MIYO-DB] MONGODB_URI not set — admin features disabled');
    return;
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('[MIYO-DB] Connected to MongoDB');
  } catch (err) {
    console.error('[MIYO-DB] MongoDB connection failed:', err.message);
  }
}

function isDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

// ═══════════════════════════════════════════════════════════════
// Schemas & Models
// ═══════════════════════════════════════════════════════════════

// ── Fingerprint (Device) ──
const fingerprintSchema = new mongoose.Schema({
  fingerprintId: { type: String, required: true, index: true, unique: true },
  components: { type: mongoose.Schema.Types.Mixed, default: {} },
  ips: [{ type: String }],
  userAgents: [{ type: String }],
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 1 },
  // Derived summary fields for quick admin display
  summary: {
    browser: String,
    os: String,
    gpu: String,
    screen: String,
    cpuCores: Number,
    deviceMemory: Number,
    timezone: String,
    language: String,
    fontCount: Number,
    voiceCount: Number,
  },
  // IP Geolocation (enriched from first/primary IP)
  geo: {
    country: String,
    countryCode: String,
    region: String,
    city: String,
    isp: String,
    org: String,
    as: String,
    lat: Number,
    lon: Number,
  },
}, { timestamps: true });

// ── Analytics (Request Log) ──
const analyticsSchema = new mongoose.Schema({
  ip: { type: String, index: true },
  fingerprintId: { type: String, index: true },
  endpoint: { type: String, index: true },
  method: { type: String },
  statusCode: { type: Number },
  responseTime: { type: Number }, // ms
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
  rateLimited: { type: Boolean, default: false },
}, { timestamps: false });
// Auto-delete analytics older than 30 days
analyticsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// ── Bans ──
const banSchema = new mongoose.Schema({
  type: { type: String, enum: ['ip', 'fingerprint'], required: true },
  value: { type: String, required: true, index: true },
  reason: { type: String, default: '' },
  bannedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null }, // null = permanent
  active: { type: Boolean, default: true, index: true },
  bannedBy: { type: String, default: 'admin' },
}, { timestamps: true });

// ── Admin Sessions ──
const adminSessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true },
  name: { type: String },
  picture: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
}, { timestamps: false });
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ── Content Access (tracks what users watch) ──
const contentAccessSchema = new mongoose.Schema({
  contentType: { type: String, enum: ['movie', 'tv', 'anime'], required: true, index: true },
  contentId: { type: String, required: true, index: true }, // TMDB or AniList ID
  title: { type: String, default: '' },
  posterPath: { type: String, default: '' },
  ip: { type: String, index: true },
  fingerprintId: { type: String, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
}, { timestamps: false });
contentAccessSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days
contentAccessSchema.index({ contentType: 1, contentId: 1 }); // for aggregation

// ── IP Geolocation Cache ──
const geoCacheSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true, index: true },
  country: String,
  countryCode: String,
  region: String,
  regionName: String,
  city: String,
  zip: String,
  lat: Number,
  lon: Number,
  timezone: String,
  isp: String,
  org: String,
  as: String,
  mobile: Boolean,
  proxy: Boolean,
  hosting: Boolean,
  cachedAt: { type: Date, default: Date.now },
}, { timestamps: false });
// Re-lookup after 7 days
geoCacheSchema.index({ cachedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// ── Request Aggregate (hourly rollup for dashboard stats) ──
const requestAggregateSchema = new mongoose.Schema({
  hour: { type: Date, required: true, index: true },
  endpoint: { type: String },
  totalRequests: { type: Number, default: 0 },
  uniqueIps: { type: Number, default: 0 },
  rateLimitHits: { type: Number, default: 0 },
  avgResponseTime: { type: Number, default: 0 },
}, { timestamps: false });
requestAggregateSchema.index({ hour: 1, endpoint: 1 }, { unique: true });
requestAggregateSchema.index({ hour: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ── Create models ──
const Fingerprint = mongoose.model('Fingerprint', fingerprintSchema);
const Analytics = mongoose.model('Analytics', analyticsSchema);
const Ban = mongoose.model('Ban', banSchema);
const AdminSession = mongoose.model('AdminSession', adminSessionSchema);
const ContentAccess = mongoose.model('ContentAccess', contentAccessSchema);
const GeoCache = mongoose.model('GeoCache', geoCacheSchema);
const RequestAggregate = mongoose.model('RequestAggregate', requestAggregateSchema);

// ═══════════════════════════════════════════════════════════════
// Ban Cache (in-memory for fast middleware checks)
// ═══════════════════════════════════════════════════════════════

let banCache = { ips: new Set(), fingerprints: new Set(), lastRefresh: 0 };
const BAN_CACHE_TTL = 30 * 1000; // 30 seconds (was 60s — faster refresh)

async function refreshBanCache() {
  if (!isDBConnected()) return;
  if (Date.now() - banCache.lastRefresh < BAN_CACHE_TTL) return;

  try {
    const activeBans = await Ban.find({
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).lean();

    const ips = new Set();
    const fps = new Set();
    for (const ban of activeBans) {
      if (ban.type === 'ip') ips.add(ban.value);
      else if (ban.type === 'fingerprint') fps.add(ban.value);
    }
    banCache = { ips, fingerprints: fps, lastRefresh: Date.now() };
  } catch (e) {
    console.error('[MIYO-DB] Ban cache refresh failed:', e.message);
  }
}

function isIPBanned(ip) {
  return banCache.ips.has(ip);
}

function isFingerprintBanned(fpId) {
  return banCache.fingerprints.has(fpId);
}

function invalidateBanCache() {
  banCache.lastRefresh = 0;
}

// ═══════════════════════════════════════════════════════════════
// IP-to-Fingerprint reverse lookup cache (for cross-banning)
// ═══════════════════════════════════════════════════════════════
let ipToFpCache = new Map(); // ip -> Set<fingerprintId>
let fpToIpCache = new Map(); // fingerprintId -> Set<ip>
let ipFpCacheTime = 0;
const IP_FP_CACHE_TTL = 120 * 1000; // 2 minutes

async function refreshIpFpCache() {
  if (!isDBConnected()) return;
  if (Date.now() - ipFpCacheTime < IP_FP_CACHE_TTL) return;
  try {
    const devices = await Fingerprint.find({}, { fingerprintId: 1, ips: 1 }).lean();
    const newIpToFp = new Map();
    const newFpToIp = new Map();
    for (const d of devices) {
      const fpSet = new Set(d.ips || []);
      newFpToIp.set(d.fingerprintId, fpSet);
      for (const ip of d.ips || []) {
        if (!newIpToFp.has(ip)) newIpToFp.set(ip, new Set());
        newIpToFp.get(ip).add(d.fingerprintId);
      }
    }
    ipToFpCache = newIpToFp;
    fpToIpCache = newFpToIp;
    ipFpCacheTime = Date.now();
  } catch (e) {}
}

function getFingerprintsForIP(ip) {
  return ipToFpCache.get(ip) || new Set();
}

function getIPsForFingerprint(fpId) {
  return fpToIpCache.get(fpId) || new Set();
}

export {
  connectDB,
  isDBConnected,
  Fingerprint,
  Analytics,
  Ban,
  AdminSession,
  ContentAccess,
  GeoCache,
  RequestAggregate,
  refreshBanCache,
  isIPBanned,
  isFingerprintBanned,
  invalidateBanCache,
  refreshIpFpCache,
  getFingerprintsForIP,
  getIPsForFingerprint,
};
