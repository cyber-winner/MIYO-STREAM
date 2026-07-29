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
