// ── Anime Downloads ──

export const saveDownloadMetadata = (downloadId, data) => {
  try {
    const existing = getDownloads();
    existing[downloadId] = {
      ...data,
      downloadedAt: Date.now(),
    };
    localStorage.setItem('miyo_downloads', JSON.stringify(existing));
  } catch (e) {
    console.error('[downloadsManager] Failed to save metadata', e);
  }
};

export const getDownloads = () => {
  try {
    return JSON.parse(localStorage.getItem('miyo_downloads')) || {};
  } catch (e) {
    return {};
  }
};

export const removeDownloadMetadata = (downloadId) => {
  try {
    const existing = getDownloads();
    delete existing[downloadId];
    localStorage.setItem('miyo_downloads', JSON.stringify(existing));
  } catch (e) {
    console.error('[downloadsManager] Failed to remove metadata', e);
  }
};

export const getDownloadForEpisode = (downloadId) => {
  const existing = getDownloads();
  return existing[downloadId] || null;
};

// ── Manga Downloads ──
// Key format: "manga_{seriesId}_{chapterId}"

const MANGA_STORAGE_KEY = 'miyo_manga_downloads';

export const saveMangaDownload = (seriesId, chapterId, data) => {
  try {
    const existing = getMangaDownloads();
    const key = `manga_${seriesId}_${chapterId}`;
    existing[key] = {
      seriesId,
      chapterId,
      seriesTitle: data.seriesTitle || '',
      chapterNumber: data.chapterNumber || '',
      chapterTitle: data.chapterTitle || '',
      pages: data.pages || 0,
      coverImage: data.coverImage || '',
      provider: data.provider || '',
      downloadedAt: Date.now(),
      // Path to saved files (platform-specific)
      savePath: data.savePath || null,
    };
    localStorage.setItem(MANGA_STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('[downloadsManager] Failed to save manga metadata', e);
  }
};

export const getMangaDownloads = () => {
  try {
    return JSON.parse(localStorage.getItem(MANGA_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
};

export const getMangaDownloadsBySeries = (seriesId) => {
  const all = getMangaDownloads();
  const prefix = `manga_${seriesId}_`;
  const result = {};
  for (const [key, val] of Object.entries(all)) {
    if (key.startsWith(prefix)) result[key] = val;
  }
  return result;
};

export const removeMangaDownload = (seriesId, chapterId) => {
  try {
    const existing = getMangaDownloads();
    const key = `manga_${seriesId}_${chapterId}`;
    delete existing[key];
    localStorage.setItem(MANGA_STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('[downloadsManager] Failed to remove manga metadata', e);
  }
};

export const getMangaChapter = (seriesId, chapterId) => {
  const existing = getMangaDownloads();
  const key = `manga_${seriesId}_${chapterId}`;
  return existing[key] || null;
};

// ── Combined helpers ──

export const getAllDownloadCount = () => {
  const anime = Object.keys(getDownloads()).length;
  const manga = Object.keys(getMangaDownloads()).length;
  return { anime, manga, total: anime + manga };
};

export const clearAllDownloads = () => {
  try {
    localStorage.removeItem('miyo_downloads');
    localStorage.removeItem(MANGA_STORAGE_KEY);
  } catch (e) {
    console.error('[downloadsManager] Failed to clear downloads', e);
  }
};
