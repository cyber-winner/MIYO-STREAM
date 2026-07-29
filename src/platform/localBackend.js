// In-app replacement for the Express server's /api/anime, /api/watch and
// /api/providers endpoints. Runs the same provider extensions directly in
// the webview using the native HTTP shim (no server, no Cloudflare).
import { axiosShim } from './axiosShim.js';
import { setDynamicReferer, setFallbackReferer } from './referers.js';

// The provider extensions reference global.axios / global.setDynamicReferer /
// global.setFallbackReferer — wire those up before loading them.
// (Vite's `define: { global: 'globalThis' }` maps `global` to `globalThis`.)
globalThis.axios = axiosShim;
globalThis.setDynamicReferer = setDynamicReferer;
globalThis.setFallbackReferer = setFallbackReferer;

let providersPromise = null;
let mangaProvidersPromise = null;

async function loadProviders() {
  if (!providersPromise) {
    providersPromise = (async () => {
      const providers = {};
      const anikoto = (await import('./providers/anikotoBrowser.js')).default;
      if (anikoto?.name) providers[anikoto.name] = anikoto;
      return providers;
    })();
  }
  return providersPromise;
}

async function loadMangaProviders() {
  if (!mangaProvidersPromise) {
    mangaProvidersPromise = (async () => {
      const providers = {};
      const weebcentral = (await import('./providers/weebcentralBrowser.js')).default;
      if (weebcentral?.name) providers[weebcentral.name] = weebcentral;
      return providers;
    })();
  }
  return mangaProvidersPromise;
}

export const localBackend = {
  async getProviders() {
    const providers = await loadProviders();
    return {
      providers: Object.entries(providers).map(([name, p]) => ({
        name,
        version: p.version || '1.0.0',
      })),
    };
  },

  async providerAction(providerName, action, params = {}) {
    const providers = await loadProviders();
    const p = providers[providerName];
    if (!p) return { error: `Provider ${providerName} not found` };
    try {
      switch (action) {
        case 'recent':
          return await p.fetchRecentEpisodes({ page: parseInt(params.page) || 1 });
        case 'search':
          return await p.SearchAnime(params.query, { page: parseInt(params.page) || 1 });
        case 'info':
          return await p.AnimeInfo(params.id);
        case 'episodes':
          return await p.fetchEpisode(params.id, parseInt(params.page) || 1);
        case 'sources':
          return await p.fetchEpisodeSources(params.id);
        default:
          return { error: 'Invalid action' };
      }
    } catch (err) {
      console.error(`[localBackend] Error in ${providerName}/${action}:`, err);
      return { error: err.message };
    }
  },

  // ── Manga ──
  async getMangaProviders() {
    const providers = await loadMangaProviders();
    return {
      providers: Object.entries(providers).map(([name, p]) => ({
        name,
        version: p.version || '1.0.0',
      })),
    };
  },

  async mangaAction(providerName, action, params = {}) {
    const providers = await loadMangaProviders();
    const p = providers[providerName];
    if (!p) return { error: `Manga provider ${providerName} not found` };
    try {
      switch (action) {
        case 'latest':
          return { results: await p.latestManga(parseInt(params.page) || 1) };
        case 'search':
          return { results: await p.searchManga(params.query, parseInt(params.page) || 1) };
        case 'info':
          return await p.fetchMangaInfo(params.id);
        case 'chapters':
          return { chapters: await p.fetchChapters(params.id) };
        case 'pages':
          return await p.fetchChapterPages(params.id);
        default:
          return { error: 'Invalid manga action' };
      }
    } catch (err) {
      console.error(`[localBackend] Manga error in ${providerName}/${action}:`, err);
      return { error: err.message };
    }
  },

  // Mirrors POST /api/watch (including dynamic referer registration)
  async watch({ ep, provider = 'anikoto', subdub = null }) {
    try {
      if (!ep) throw new Error('Episode ID Not Found');
      const providers = await loadProviders();
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
              const ref = src.headers?.Referer || '';
              if (ref) {
                setDynamicReferer(cdnDomain, ref);
                setFallbackReferer(ref);
              }
            } catch (e) { /* ignore */ }
          }
        }
      }
      return sourcesData;
    } catch (err) {
      console.error('[localBackend] Watch error:', err.message);
      return { sources: [] };
    }
  },
};
