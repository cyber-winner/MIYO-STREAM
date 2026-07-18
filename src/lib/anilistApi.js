import { isNative, platformFetch } from '../platform/index.js';
const ANILIST_PROXY = '/api/anilist';
const ANILIST_DIRECT = 'https://graphql.anilist.co';
const cache = new Map();
const CACHE_TTL = 60_000;
function getCacheKey(query, variables) {
  return JSON.stringify({ q: query.replace(/\s+/g, ' ').trim(), v: variables });
}
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 700;
async function queryAniList(query, variables = {}) {
  const key = getCacheKey(query, variables);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - timeSinceLast));
  }
  lastRequestTime = Date.now();
  const body = JSON.stringify({ query, variables });
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let response;
      if (isNative()) {
        // Native apps talk to AniList directly (no server proxy). The
        // in-memory cache + rate-limit pacing above already protect us.
        const nativeRes = await platformFetch(ANILIST_DIRECT, {
          method: 'POST',
          headers,
          body,
        });
        response = {
          ok: nativeRes.ok,
          status: nativeRes.status,
          headers: { get: (name) => nativeRes.header(name) },
          json: () => nativeRes.json(),
        };
      } else {
        response = await fetch(ANILIST_PROXY, {
          method: 'POST',
          headers,
          body,
        });
      }
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '0') || (attempt + 1) * 2;
        console.warn(`[AniList] Rate limited, retrying in ${retryAfter}s...`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('miyo-toast', {
            detail: { message: `System data flow is constrained. Retrying in ${retryAfter}s...`, type: 'warning' }
          }));
        }
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
      const json = await response.json();
      if (json.errors?.some(e => e.status === 429 || e.message?.includes('Too Many'))) {
        const retryAfter = (attempt + 1) * 2;
        console.warn(`[AniList] Rate limited via error body, retrying in ${retryAfter}s...`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('miyo-toast', {
            detail: { message: `System data flow is constrained. Retrying in ${retryAfter}s...`, type: 'warning' }
          }));
        }
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (json.errors) {
        console.error('[AniList] API Error:', json.errors);
        throw new Error(json.errors[0]?.message || 'AniList API error');
      }
      cache.set(key, { data: json.data, time: Date.now() });
      return json.data;
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
      }
    }
  }
  const errMsg = (lastError?.message || '').toLowerCase();
  if (errMsg.includes('429') || errMsg.includes('too many') || lastError?.status === 429) {
    throw new Error('You are going too fast! We hit rate limit. Try again after 1 minute.');
  }
  throw lastError || new Error('AniList request failed after retries');
}
const MEDIA_CARD_FRAGMENT = `
  id
  title {
    romaji
    english
    native
    userPreferred
  }
  type
  format
  status
  season
  seasonYear
  episodes
  chapters
  volumes
  duration
  averageScore
  meanScore
  popularity
  favourites
  genres
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  isAdult
  siteUrl
  nextAiringEpisode {
    airingAt
    timeUntilAiring
    episode
  }
`;
const MEDIA_DETAIL_FRAGMENT = `
  id
  title {
    romaji
    english
    native
    userPreferred
  }
  type
  format
  status
  description(asHtml: false)
  season
  seasonYear
  episodes
  chapters
  volumes
  duration
  averageScore
  meanScore
  popularity
  favourites
  genres
  tags {
    id
    name
    category
    rank
    isAdult
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  startDate { year month day }
  endDate { year month day }
  isAdult
  siteUrl
  trailer {
    id
    site
    thumbnail
  }
  nextAiringEpisode {
    airingAt
    timeUntilAiring
    episode
  }
  streamingEpisodes {
    title
    thumbnail
    url
    site
  }
  studios(isMain: true) {
    nodes { id name siteUrl }
  }
  rankings {
    rank
    type
    format
    season
    year
    allTime
  }
  externalLinks {
    id
    url
    site
    type
  }
  relations {
    edges {
      relationType
      node {
        id
        title { romaji english userPreferred }
        type
        format
        status
        coverImage { large medium }
        averageScore
        episodes
        chapters
      }
    }
  }
  characters(sort: [ROLE, RELEVANCE], page: 1, perPage: 20) {
    edges {
      role
      voiceActors(language: JAPANESE) {
        id
        name { full native }
        image { large medium }
        languageV2
      }
      node {
        id
        name { full native }
        image { large medium }
      }
    }
  }
  staff(sort: [RELEVANCE], page: 1, perPage: 10) {
    edges {
      role
      node {
        id
        name { full native }
        image { large medium }
      }
    }
  }
  recommendations(sort: [RATING_DESC], page: 1, perPage: 12) {
    nodes {
      mediaRecommendation {
        id
        title { romaji english userPreferred }
        type
        format
        coverImage { large medium }
        averageScore
        episodes
        chapters
        status
      }
    }
  }
`;
export const anilistApi = {
  getTrending: async (page = 1, perPage = 20) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: ANIME, sort: [TRENDING_DESC], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage });
    return data.Page;
  },
  getPopular: async (page = 1, perPage = 20) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: ANIME, sort: [POPULARITY_DESC], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage });
    return data.Page;
  },
  getTopRated: async (page = 1, perPage = 20) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: ANIME, sort: [SCORE_DESC], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage });
    return data.Page;
  },
  getAiring: async (page = 1, perPage = 20) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: ANIME, status: RELEASING, sort: [POPULARITY_DESC], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage });
    return data.Page;
  },
  getSeason: async (season, year, page = 1, perPage = 20, sort = ['POPULARITY_DESC']) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int, $season: MediaSeason, $year: Int, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: ANIME, season: $season, seasonYear: $year, sort: $sort, isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage, season, year, sort });
    return data.Page;
  },
  getByGenre: async (genre, page = 1, perPage = 20, type = 'ANIME') => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int, $genre: String, $type: MediaType) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: $type, genre: $genre, sort: [POPULARITY_DESC], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage, genre, type });
    return data.Page;
  },
  searchAnime: async (query, page = 1, perPage = 20) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int, $search: String) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(search: $search, type: ANIME, sort: [SEARCH_MATCH], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage, search: query });
    return data.Page;
  },
  searchManga: async (query, page = 1, perPage = 20) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int, $search: String) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(search: $search, type: MANGA, sort: [SEARCH_MATCH], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage, search: query });
    return data.Page;
  },
  getDetail: async (id) => {
    const data = await queryAniList(`
      query ($id: Int) {
        Media(id: $id) {
          ${MEDIA_DETAIL_FRAGMENT}
        }
      }
    `, { id: parseInt(id) });
    return data.Media;
  },
  getMangaTrending: async (page = 1, perPage = 20) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: MANGA, sort: [TRENDING_DESC], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage });
    return data.Page;
  },
  getMangaPopular: async (page = 1, perPage = 20) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: MANGA, sort: [POPULARITY_DESC], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage });
    return data.Page;
  },
  getMangaTopRated: async (page = 1, perPage = 20) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: MANGA, sort: [SCORE_DESC], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage });
    return data.Page;
  },
  getMangaByGenre: async (genre, page = 1, perPage = 20) => {
    const data = await queryAniList(`
      query ($page: Int, $perPage: Int, $genre: String) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: MANGA, genre: $genre, sort: [POPULARITY_DESC], isAdult: false) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage, genre });
    return data.Page;
  },
  browse: async ({ type = 'ANIME', sort = ['POPULARITY_DESC'], genre, season, seasonYear, format, status, page = 1, perPage = 20 } = {}) => {
    const data = await queryAniList(`
      query (
        $page: Int, $perPage: Int, $type: MediaType, $sort: [MediaSort],
        $genre: String, $season: MediaSeason, $seasonYear: Int,
        $format: MediaFormat, $status: MediaStatus
      ) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(
            type: $type, sort: $sort, genre: $genre,
            season: $season, seasonYear: $seasonYear,
            format: $format, status: $status, isAdult: false
          ) {
            ${MEDIA_CARD_FRAGMENT}
          }
        }
      }
    `, { page, perPage, type, sort, genre: genre || undefined, season: season || undefined, seasonYear: seasonYear || undefined, format: format || undefined, status: status || undefined });
    return data.Page;
  },
  getGenres: () => [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy',
    'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological',
    'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
  ],
  getFormats: () => ({
    ANIME: [
      { value: 'TV', label: 'TV' },
      { value: 'TV_SHORT', label: 'TV Short' },
      { value: 'MOVIE', label: 'Movie' },
      { value: 'SPECIAL', label: 'Special' },
      { value: 'OVA', label: 'OVA' },
      { value: 'ONA', label: 'ONA' },
      { value: 'MUSIC', label: 'Music' },
    ],
    MANGA: [
      { value: 'MANGA', label: 'Manga' },
      { value: 'NOVEL', label: 'Light Novel' },
      { value: 'ONE_SHOT', label: 'One Shot' },
    ],
  }),
  getSeasons: () => ['WINTER', 'SPRING', 'SUMMER', 'FALL'],
  getStatusOptions: () => ({
    ANIME: [
      { value: 'RELEASING', label: 'Airing' },
      { value: 'FINISHED', label: 'Finished' },
      { value: 'NOT_YET_RELEASED', label: 'Upcoming' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ],
    MANGA: [
      { value: 'RELEASING', label: 'Publishing' },
      { value: 'FINISHED', label: 'Finished' },
      { value: 'NOT_YET_RELEASED', label: 'Upcoming' },
      { value: 'HIATUS', label: 'Hiatus' },
    ],
  }),
  formatScore: (score) => score ? `${score}%` : 'N/A',
  formatStatus: (status) => {
    const map = {
      FINISHED: 'Finished',
      RELEASING: 'Airing',
      NOT_YET_RELEASED: 'Upcoming',
      CANCELLED: 'Cancelled',
      HIATUS: 'Hiatus',
    };
    return map[status] || status;
  },
  formatFormat: (format) => {
    const map = {
      TV: 'TV',
      TV_SHORT: 'TV Short',
      MOVIE: 'Movie',
      SPECIAL: 'Special',
      OVA: 'OVA',
      ONA: 'ONA',
      MUSIC: 'Music',
      MANGA: 'Manga',
      NOVEL: 'Light Novel',
      ONE_SHOT: 'One Shot',
    };
    return map[format] || format;
  },
  formatSeason: (season) => {
    const map = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' };
    return map[season] || season;
  },
  getCurrentSeason: () => {
    const month = new Date().getMonth() + 1;
    if (month >= 1 && month <= 3) return { season: 'WINTER', year: new Date().getFullYear() };
    if (month >= 4 && month <= 6) return { season: 'SPRING', year: new Date().getFullYear() };
    if (month >= 7 && month <= 9) return { season: 'SUMMER', year: new Date().getFullYear() };
    return { season: 'FALL', year: new Date().getFullYear() };
  },
  getNextSeason: () => {
    const current = anilistApi.getCurrentSeason();
    const order = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
    const idx = order.indexOf(current.season);
    if (idx === 3) return { season: 'WINTER', year: current.year + 1 };
    return { season: order[idx + 1], year: current.year };
  },
};
