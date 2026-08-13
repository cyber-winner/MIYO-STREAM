/**
 * MIYO-STREAM Database Layer
 * MongoDB connection + Mongoose models for fingerprints, analytics, bans, and admin sessions.
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
// Auto-delete expired sessions
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ── Request Aggregate (hourly rollup for dashboard stats) ──
const requestAggregateSchema = new mongoose.Schema({
  hour: { type: Date, required: true, index: true }, // truncated to hour
  endpoint: { type: String },
  totalRequests: { type: Number, default: 0 },
  uniqueIps: { type: Number, default: 0 },
  rateLimitHits: { type: Number, default: 0 },
  avgResponseTime: { type: Number, default: 0 },
}, { timestamps: false });
requestAggregateSchema.index({ hour: 1, endpoint: 1 }, { unique: true });
requestAggregateSchema.index({ hour: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days

// ── Create models ──
const Fingerprint = mongoose.model('Fingerprint', fingerprintSchema);
const Analytics = mongoose.model('Analytics', analyticsSchema);
const Ban = mongoose.model('Ban', banSchema);
const AdminSession = mongoose.model('AdminSession', adminSessionSchema);
const RequestAggregate = mongoose.model('RequestAggregate', requestAggregateSchema);

// ═══════════════════════════════════════════════════════════════
// Ban Cache (in-memory for fast middleware checks)
// ═══════════════════════════════════════════════════════════════

let banCache = { ips: new Set(), fingerprints: new Set(), lastRefresh: 0 };
const BAN_CACHE_TTL = 60 * 1000; // 1 minute

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

export {
  connectDB,
  isDBConnected,
  Fingerprint,
  Analytics,
  Ban,
  AdminSession,
  RequestAggregate,
  refreshBanCache,
  isIPBanned,
  isFingerprintBanned,
  invalidateBanCache,
};
