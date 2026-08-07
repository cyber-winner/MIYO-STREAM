const FRACTION_MAP = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
  '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};
const SIDE_STORY_REGEX = /\b(mini\s*anime|ova|special|movie|recap|picture\s*drama|specials|ona\b.*short|petit|chibi|spin[\s-]?off)\b/i;
function normalize(str) {
  if (!str) return '';
  let s = str;
  for (const [frac, ascii] of Object.entries(FRACTION_MAP)) {
    s = s.replaceAll(frac, ascii);
  }
  return s
    .toLowerCase()
    .replace(/[''`]/g, '')           
    .replace(/[:\-–—]/g, ' ')        
    .replace(/[^\w\s/]/g, '')        
    .replace(/\s+/g, ' ')           
    .trim();
}
function isSideStory(title, format) {
  const formatStr = (format || '').toUpperCase();
  if (['MOVIE', 'OVA', 'SPECIAL', 'ONA'].includes(formatStr)) {
    return true;
  }
  return SIDE_STORY_REGEX.test(title || '');
}
function extractSeasonInfo(str) {
  if (!str) return { season: null, base: '' };
  const normalized = normalize(str);
  let m = normalized.match(/\b(\d+)(?:st|nd|rd|th)\s*season\b/i);
  if (m) return { season: parseInt(m[1]), base: normalized.replace(m[0], '').replace(/\s+/g, ' ').trim() };
  m = normalized.match(/\bseason\s*(\d+)\b/i);
  if (m) return { season: parseInt(m[1]), base: normalized.replace(m[0], '').replace(/\s+/g, ' ').trim() };
  m = normalized.match(/\bpart\s*(\d+)\b/i);
  if (m) return { season: parseInt(m[1]), base: normalized.replace(m[0], '').replace(/\s+/g, ' ').trim() };
  m = normalized.match(/\bcour\s*(\d+)\b/i);
  if (m) return { season: parseInt(m[1]), base: normalized.replace(m[0], '').replace(/\s+/g, ' ').trim() };
  const rawStr = str.toLowerCase();
  m = rawStr.match(/第(\d+)期/);
  if (m) return { season: parseInt(m[1]), base: normalized.replace(/\s+/g, ' ').trim() };
  m = normalized.match(/\bs(\d+)\b(?!\w)/i);
  if (m && m[1] !== '0') return { season: parseInt(m[1]), base: normalized.replace(m[0], '').replace(/\s+/g, ' ').trim() };
  return { season: null, base: normalized };
}
function extractYear(str) {
  if (!str) return null;
  const m = str.match(/[(\[](20\d{2}|19\d{2})[)\]]/);
  return m ? parseInt(m[1]) : null;
}
function similarity(a, b) {
  if (!a || !b) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.8 + (ratio * 0.15);
  }
  const wordsA = new Set(na.split(' ').filter(Boolean));
  const wordsB = new Set(nb.split(' ').filter(Boolean));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  const jaccard = union > 0 ? intersection / union : 0;
  const lcsLen = lcs(na, nb);
  const lcsRatio = lcsLen / Math.max(na.length, nb.length);
  return (jaccard * 0.6) + (lcsRatio * 0.4);
}
function lcs(a, b) {
  const m = a.length;
  const n = b.length;
  if (m > 200 || n > 200) return 0;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}
function scoreMatch(anikotoTitle, anilistTitles, anilistData) {
  const candidateTitle = anikotoTitle || '';
  const candidateSeason = extractSeasonInfo(candidateTitle);
  const candidateYear = extractYear(candidateTitle);
  const candidateIsSide = isSideStory(candidateTitle);
  let bestScore = 0;
  const targetIsSide = isSideStory(
    anilistData.title.english || anilistData.title.romaji || anilistData.title.userPreferred,
    anilistData.format
  );
  for (const anilistTitle of anilistTitles) {
    if (!anilistTitle) continue;
    const anilistSeason = extractSeasonInfo(anilistTitle);
    const anilistYear = extractYear(anilistTitle);
    let score = similarity(candidateTitle, anilistTitle);
    if (candidateIsSide !== targetIsSide) {
      score *= 0.15;
    } else if (targetIsSide && candidateIsSide) {
      score = Math.min(1.0, score + 0.1);
    }
    if (anilistSeason.season !== null) {
      if (candidateSeason.season !== null) {
        if (candidateSeason.season === anilistSeason.season) {
          score = Math.min(1.0, score + 0.15);
        } else {
          score *= 0.2; 
        }
      } else {
        if (anilistSeason.season > 1) {
          score *= 0.3; 
        }
      }
    } else {
      if (candidateSeason.season !== null && candidateSeason.season > 1) {
        score *= 0.5; 
      }
    }
    if (anilistYear !== null && candidateYear !== null) {
      if (anilistYear === candidateYear) {
        score = Math.min(1.0, score + 0.05);
      } else {
        score *= 0.4;
      }
    } else if (anilistYear !== null && candidateYear === null) {
      score *= 0.85;
    }
    bestScore = Math.max(bestScore, score);
  }
  return bestScore;
}
export function findBestMatch(anikotoResults, anilistData, threshold = 0.4) {
  if (!anikotoResults?.length || !anilistData?.title) {
    return { match: null, score: 0, allScores: [] };
  }
  const anilistTitles = [
    anilistData.title.english,
    anilistData.title.romaji,
    anilistData.title.native,
    anilistData.title.userPreferred,
  ].filter(Boolean);
  const scored = anikotoResults.map(result => ({
    result,
    score: scoreMatch(result.title, anilistTitles, anilistData),
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return {
    match: best.score >= threshold ? best.result : null,
    score: best.score,
    allScores: scored.map(s => ({ id: s.result.id, title: s.result.title, score: s.score })),
  };
}
export function buildSearchQueries(anilistData) {
  if (!anilistData?.title) return [];
  const candidates = [
    anilistData.title.english,
    anilistData.title.romaji,
    anilistData.title.userPreferred,
  ].filter(Boolean);
  const seen = new Set();
  const queries = [];
  for (const title of candidates) {
    const norm = normalize(title);
    if (!seen.has(norm)) {
      seen.add(norm);
      queries.push(title);
    }
  }
  return queries;
}

/**
 * Fast-path: Try to resolve a direct MAL ID → provider ID mapping
 * from the metadata database before falling back to fuzzy search.
 *
 * @param {number|string} malId - MyAnimeList ID (from AniList's `idMal` field)
 * @param {string} providerName - Provider name ('anineko', 'anikoto', 'pahe')
 * @returns {{ providerId: string|null, providerData: object|null }}
 */
export async function findProviderIdByMal(malId, providerName) {
  if (!malId) return { providerId: null, providerData: null };
  try {
    const { mapAnimeToProviders } = await import('./metadataDb.js');
    const mapping = await mapAnimeToProviders(malId);
    if (!mapping) return { providerId: null, providerData: null };

    const providerId = mapping[providerName] || null;
    if (providerId) {
      console.log(`[matchAnime] DB hit: MAL ${malId} → ${providerName} ID: ${providerId}`);
      return { providerId, providerData: mapping };
    }
    return { providerId: null, providerData: mapping };
  } catch (e) {
    console.warn('[matchAnime] DB lookup failed:', e.message);
    return { providerId: null, providerData: null };
  }
}