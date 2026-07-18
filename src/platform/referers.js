// Referer resolution for streaming CDNs — ported from server.js getRefererForUrl().
// The provider extensions register dynamic referers per CDN domain at runtime.

const domainReferers = new Map();
let fallbackReferer = '';

export function setDynamicReferer(domain, referer) {
  domainReferers.set(domain, referer);
}

export function setFallbackReferer(referer) {
  fallbackReferer = referer;
}

export function getRefererForUrl(url) {
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
  } catch (e) { /* ignore */ }
  return '';
}

export function buildStreamHeaders(url, explicitReferer = '') {
  const referer = explicitReferer || getRefererForUrl(url);
  const headers = {};
  if (referer) {
    headers['Referer'] = referer;
    try { headers['Origin'] = new URL(referer).origin; } catch (e) { /* ignore */ }
  }
  return headers;
}
