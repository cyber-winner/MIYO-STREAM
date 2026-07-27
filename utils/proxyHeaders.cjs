/**
 * Exact port of StrawVerse src/backend/utils/proxyHeaders.js
 * Reference: https://github.com/TheYogMehta/StrawVerse/blob/main/src/backend/utils/proxyHeaders.js
 */

const fs = require("fs");
const path = require("path");

const cookieCache = {};
const refererCache = {};

const STORE_PATH = path.join(__dirname, "..", ".cf-store.json");

function loadCookieStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
      if (data && data.domain && data.cf_clearance && data.expiry > Date.now()) {
        const domain = normalizeDomain(data.domain);
        if (domain) {
          cookieCache[domain] = {
            value: data.cf_clearance,
            expiry: data.expiry,
          };
        }
      }
    }
  } catch (e) {}
}

function normalizeDomain(domain) {
  if (!domain) return null;
  try {
    if (domain.startsWith("http://") || domain.startsWith("https://")) {
      return new URL(domain).hostname.replace(/^www\./, "");
    }
  } catch (e) {}
  return String(domain)
    .replace(/^www\./, "")
    .toLowerCase();
}

function normalizeReferer(referer) {
  if (!referer) return null;
  try {
    const refUrl = new URL(referer);
    if (refUrl.protocol !== "http:" && refUrl.protocol !== "https:") {
      return null;
    }
    return refUrl.origin + "/";
  } catch (e) {
    return null;
  }
}

function saveStreamReferer(domain, referer) {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedReferer = normalizeReferer(referer);
  if (!normalizedDomain || !normalizedReferer) return;
  if (refererCache[normalizedDomain] === normalizedReferer) return;
  refererCache[normalizedDomain] = normalizedReferer;
}

function getStoredStreamReferer(domain) {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return null;

  const parts = normalizedDomain.split(".");
  const candidates = [];
  for (let i = 0; i < parts.length - 1; i++) {
    candidates.push(parts.slice(i).join("."));
  }

  for (const candidate of candidates) {
    if (refererCache[candidate]) return refererCache[candidate];
  }

  return null;
}

global.setDynamicReferer = (domain, referer) => {
  saveStreamReferer(domain, referer);
};

global.setFallbackReferer = (referer) => {
  delete refererCache["__fallback__"];
  saveStreamReferer("__fallback__", referer);
};

function getHeaders(url, method = "GET") {
  const chromeVer = process.versions?.chrome || "148.0.7778.218";
  let userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;
  if (process.platform === "linux") {
    userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;
  } else if (process.platform === "darwin") {
    userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;
  }

  const headers = {
    "User-Agent": userAgent,
  };

  // kwik - animepahe
  if (url.includes("owocdn.top") || url.includes("uwucdn.top")) {
    headers.Referer = "https://kwik.cx/";
  } else if (url.includes("kwik.cx")) {
    headers.Referer = "https://animepahe.pw/";
  }
  // animepahe
  else if (url.includes("animepahe")) {
    headers.Referer = "https://animepahe.pw/";
  }
  // weebcentral
  else if (
    url.includes("temp.compsci88.com") ||
    url.startsWith("https://temp.compsci88.com/")
  ) {
    headers.Referer = "https://weebcentral.com/";
  }
  // megaplay - anikoto
  else if (url.includes("anikototv.to") || url.includes("megaplay.buzz")) {
    headers.Referer = "https://anikototv.to/";
  }
  // all manga
  else if (
    url.includes("allmanga.to") ||
    url.includes("allanime.day") ||
    url.includes("youtube-anime.com")
  ) {
    headers.Referer = "https://allmanga.to/";
  }

  if (!headers.Referer) {
    try {
      const domain = new URL(url).hostname.replace("www.", "");
      const ref = getStoredStreamReferer(domain);
      if (ref) headers.Referer = ref;
    } catch (e) {}
  }

  if (!headers.Referer) {
    if (refererCache["__fallback__"]) {
      headers.Referer = refererCache["__fallback__"];
    }
  }

  let cookieDomain = "";
  try {
    cookieDomain = new URL(url).hostname;
  } catch (e) {}

  if (cookieDomain) {
    const normDomain = normalizeDomain(cookieDomain);
    const cached = cookieCache[normDomain] || cookieCache[cookieDomain];
    if (cached && cached.expiry > Date.now()) {
      if (cached.value) {
        headers.Cookie = `cf_clearance=${cached.value};`;
      }
    }
  }

  const reqMethod = String(method).toUpperCase();
  if (headers.Referer && reqMethod !== "GET" && reqMethod !== "HEAD") {
    try {
      const refUrl = new URL(headers.Referer);
      if (refUrl.protocol === "http:" || refUrl.protocol === "https:") {
        headers.Origin = refUrl.origin;
      }
    } catch (e) {}
  }

  return headers;
}

global.clearCookieCache = (domain) => {
  if (!domain) return;
  const normalized = domain.replace(/^www\./, "").toLowerCase();
  for (const key of Object.keys(cookieCache)) {
    const normKey = key.replace(/^www\./, "").toLowerCase();
    if (
      normKey === normalized ||
      normKey.endsWith("." + normalized) ||
      normalized.endsWith("." + normKey)
    ) {
      delete cookieCache[key];
    }
  }
};

loadCookieStore();

module.exports = {
  getHeaders,
};
