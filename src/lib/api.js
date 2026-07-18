import { TMDB_IMAGE_BASE, VIDEASY_BASE, ACCENT_COLOR } from './constants';
import { isNative, platformFetch, getTmdbApiKey, MissingTmdbKeyError } from '../platform/index.js';
import { getCached, setCached } from './cache.js';
const TMDB_PROXY = '/api/tmdb';
const fetchTMDB = async (endpoint, params = {}) => {
  // Cache key includes ALL params (including page). Only the first page of
  // list endpoints is cached to limit cache bloat — but the key must still
  // contain the page number, otherwise page 2+ requests would return the
  // cached page 1 over and over (infinite "same content" loop).
  const isFirstPage = !params.page || Number(params.page) === 1;
  const cacheKey = endpoint + JSON.stringify(params);
  
  // Try to get from cache first (only first pages / detail requests are cached)
  if (isFirstPage) {
    const cached = getCached('tmdb', cacheKey);
    if (cached) return cached;
  }
  
  let data;
  if (isNative()) {
    // Native apps call TMDB directly with the user's key from Settings.
    const apiKey = getTmdbApiKey();
    if (!apiKey) throw new MissingTmdbKeyError();
    const queryParams = new URLSearchParams({ ...params, api_key: apiKey });
    const url = `https://api.themoviedb.org/3${endpoint}?${queryParams.toString()}`;
    const response = await platformFetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Invalid API Key');
      throw new Error('Failed to fetch data');
    }
    data = await response.json();
  } else {
    const queryParams = new URLSearchParams({ path: endpoint, ...params });
    const url = `${TMDB_PROXY}?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401) throw new Error('Invalid API Key');
      throw new Error('Failed to fetch data');
    }
    data = await response.json();
  }
  
  // Cache the result (skip caching for paginated searches, only cache the first page and detail pages)
  if (isFirstPage) {
    setCached('tmdb', cacheKey, data);
  }
  return data;
};
// Lazily import the in-app backend only on native builds
const nativeBackend = async () => (await import('../platform/localBackend.js')).localBackend;
const isAnime = (item) => {
  const isAnimation = item.genre_ids?.includes(16) || item.genres?.some(g => g.id === 16);
  const isJapanese = item.original_language === 'ja' || item.origin_country?.includes('JP');
  return isAnimation && isJapanese;
};
export const filterAnime = (results) => results.filter(item => !isAnime(item));
export const api = {
  getTrending: async (page = 1) => {
    const data = await fetchTMDB('/trending/all/week', { page });
    data.results = filterAnime(data.results);
    return data;
  },
  searchMulti: async (query) => {
    const data = await fetchTMDB('/search/multi', { query, page: 1, include_adult: false });
    data.results = filterAnime(data.results);
    return data;
  },
  searchTMDBRaw: async (query, year, type = 'multi') => {
    const params = { query, page: 1, include_adult: false };
    if (year) {
      if (type === 'tv') params.first_air_date_year = year;
      else if (type === 'movie') params.primary_release_year = year;
      else params.year = year;
    }
    return fetchTMDB(`/search/${type}`, params);
  },
  getPopularMovies: (page = 1) => fetchTMDB('/movie/popular', { page }),
  getNowPlayingMovies: (page = 1) => fetchTMDB('/movie/now_playing', { page }),
  getTopRatedMovies: (page = 1) => fetchTMDB('/movie/top_rated', { page }),
  getMovieGenres: () => fetchTMDB('/genre/movie/list'),
  getMoviesByGenre: (genreId, page = 1) => fetchTMDB('/discover/movie', { with_genres: genreId, page, without_genres: '16' }),
  getMovieDetails: (id) =>
    fetchTMDB(`/movie/${id}`, {
      append_to_response:
        'credits,external_ids,images,videos,keywords,alternative_titles,release_dates,releases,reviews,lists,recommendations,similar,translations,watch/providers',
    }),
  getPopularTV: (page = 1) => fetchTMDB('/tv/popular', { page }),
  getTopRatedTV: (page = 1) => fetchTMDB('/tv/top_rated', { page }),
  getTvGenres: () => fetchTMDB('/genre/tv/list'),
  getTvByGenre: (genreId, page = 1) => fetchTMDB('/discover/tv', { with_genres: genreId, page, without_genres: '16' }),
  getTvDetails: (id) =>
    fetchTMDB(`/tv/${id}`, {
      append_to_response:
        'credits,aggregate_credits,external_ids,images,videos,keywords,alternative_titles,content_ratings,episode_groups,reviews,recommendations,similar,screened_theatrically,translations,watch/providers',
    }),
  getTvSeason: (id, seasonNumber) => fetchTMDB(`/tv/${id}/season/${seasonNumber}`),
  getPersonDetails: (id) =>
    fetchTMDB(`/person/${id}`, {
      append_to_response: 'movie_credits,tv_credits,combined_credits,external_ids,images,tagged_images,translations',
    }),
  getCollectionDetails: (id) =>
    fetchTMDB(`/collection/${id}`, {
      append_to_response: 'images,translations',
    }),
  getImageUrl: (path, size = 'w500') => path ? `${TMDB_IMAGE_BASE}${size}${path}` : null,
  getBackdropUrl: (path, size = 'original') => path ? `${TMDB_IMAGE_BASE}${size}${path}` : null,
  getMoviePlayerUrl: (tmdbId, progress = 0) => {
    let url = `${VIDEASY_BASE}/movie/${tmdbId}?color=${ACCENT_COLOR}`;
    if (progress > 0) url += `&progress=${progress}`;
    return url;
  },
  getTvPlayerUrl: (tmdbId, season, episode, progress = 0) => {
    let url = `${VIDEASY_BASE}/tv/${tmdbId}/${season}/${episode}?color=${ACCENT_COLOR}&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true&overlay=true`;
    if (progress > 0) url += `&progress=${progress}`;
    return url;
  },
  getAnimePlayerUrl: (anilistId, episode = null, progress = 0) => {
    let url = episode
      ? `${VIDEASY_BASE}/anime/${anilistId}/${episode}?color=${ACCENT_COLOR}`
      : `${VIDEASY_BASE}/anime/${anilistId}?color=${ACCENT_COLOR}`;
    if (progress > 0) url += `&progress=${progress}`;
    return url;
  },
  getProviders: async () => {
    if (isNative()) return (await nativeBackend()).getProviders();
    const res = await fetch('/api/providers');
    return await res.json();
  },
  getProviderRecent: async (provider = 'anikoto', page = 1) => {
    if (isNative()) return (await nativeBackend()).providerAction(provider, 'recent', { page });
    const res = await fetch(`/api/anime/${provider}/recent?page=${page}`);
    return await res.json();
  },
  getProviderSearch: async (provider = 'anikoto', query, page = 1) => {
    if (isNative()) return (await nativeBackend()).providerAction(provider, 'search', { query, page });
    const res = await fetch(`/api/anime/${provider}/search?query=${encodeURIComponent(query)}&page=${page}`);
    return await res.json();
  },
  getProviderInfo: async (provider = 'anikoto', id) => {
    if (isNative()) return (await nativeBackend()).providerAction(provider, 'info', { id });
    const res = await fetch(`/api/anime/${provider}/info?id=${encodeURIComponent(id)}`);
    return await res.json();
  },
  getProviderEpisodes: async (provider = 'anikoto', dataId, page = 1) => {
    if (isNative()) return (await nativeBackend()).providerAction(provider, 'episodes', { id: dataId, page });
    const res = await fetch(`/api/anime/${provider}/episodes?id=${encodeURIComponent(dataId)}&page=${page}`);
    return await res.json();
  },
  getProviderSources: async (provider = 'anikoto', episodeId, subdub = null) => {
    if (isNative()) return (await nativeBackend()).watch({ ep: episodeId, provider, subdub });
    const res = await fetch('/api/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ep: episodeId, provider, subdub }),
    });
    return await res.json();
  },
  buildProxiedHlsUrl: (m3u8Url, referer = '') => {
    if (!m3u8Url) return '';
    // Native: keep the raw URL — the video player fetches through the
    // native HLS loader with the correct Referer (no proxy server needed).
    if (isNative()) return m3u8Url;
    return `/api/proxy?url=${encodeURIComponent(m3u8Url)}&referer=${encodeURIComponent(referer)}`;
  },
};
