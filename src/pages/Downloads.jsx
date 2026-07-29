import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDownloads, removeDownloadMetadata, getDownloadForEpisode } from '../lib/downloadsManager';
import { isNative } from '../platform/index';
import { deleteDownloadFiles } from '../lib/downloader';

export function Downloads() {
  const [downloads, setDownloads] = useState({});
  const [activeDownloads, setActiveDownloads] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    setDownloads(getDownloads());

    const onProgress = (e) => {
      const { id, progress, title, epNum, poster } = e.detail;
      setActiveDownloads((prev) => ({
        ...prev,
        [id]: { id, progress, title, epNum, poster, isDownloading: true }
      }));
    };

    const onComplete = (e) => {
      const { id } = e.detail;
      setActiveDownloads((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setDownloads(getDownloads());
    };

    const onError = (e) => {
      const { id } = e.detail;
      setActiveDownloads((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };

    window.addEventListener('miyo-download-progress', onProgress);
    window.addEventListener('miyo-download-complete', onComplete);
    window.addEventListener('miyo-download-error', onError);

    return () => {
      window.removeEventListener('miyo-download-progress', onProgress);
      window.removeEventListener('miyo-download-complete', onComplete);
      window.removeEventListener('miyo-download-error', onError);
    };
  }, []);

  if (!isNative()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
        <h2 className="text-2xl font-bold text-white mb-4">Downloads Unavailable</h2>
        <p className="text-text-secondary text-center">
          Offline downloads are only available in the native mobile and desktop apps.
        </p>
      </div>
    );
  }

  const downloadList = Object.entries(downloads)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));

  const filtered = downloadList.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this download? The file might remain on your device until manually deleted.')) {
      const metadata = getDownloadForEpisode(id);
      removeDownloadMetadata(id);
      setDownloads(getDownloads());
      if (metadata) {
        await deleteDownloadFiles(metadata.title, metadata.epNum);
      }
    }
  };

  const activeList = Object.values(activeDownloads);
  const activeIds = new Set(activeList.map(a => a.id));
  const filteredDownloads = filtered.filter(d => !activeIds.has(d.id));
  const combinedList = [...activeList, ...filteredDownloads];

  return (
    <div className="pt-24 pb-32 px-4 md:px-8 max-w-[1400px] mx-auto min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Downloads</h1>
          <p className="text-text-secondary mt-1">Watch your offline episodes</p>
        </div>
        {(combinedList.length > 0 || search) && (
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search downloads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-light border border-white/10 rounded-xl sm:rounded-full px-4 py-3 sm:py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        )}
      </div>

      {combinedList.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 mb-6 rounded-full bg-surface flex items-center justify-center">
            <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Downloads Yet</h3>
          <p className="text-text-secondary max-w-md">
            Episodes you download will appear here so you can watch them offline.
          </p>
        </div>
      ) : combinedList.length === 0 ? (
        <div className="text-center py-10 text-text-secondary">
          No downloads match your search.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {combinedList.map((item) => (
            <div key={item.id} className="group relative flex flex-row items-center gap-4 bg-surface/40 hover:bg-surface/80 border border-white/5 rounded-2xl p-3 transition-colors">
              <Link
                to={item.isDownloading ? '#' : `/anime/${item.animeId}?ep=${item.epNum}`}
                className="flex flex-row items-center gap-4 flex-1 min-w-0"
              >
                <div className="relative w-24 sm:w-32 aspect-video rounded-xl overflow-hidden bg-surface-light shadow-md flex-shrink-0">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-text-muted">
                      No Image
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                </div>
                
                <div className="flex flex-col flex-1 min-w-0 pr-4">
                  <h3 className="font-bold text-sm sm:text-base text-white truncate group-hover:text-accent transition-colors">
                    {item.title}
                  </h3>
                  <div className="mt-1">
                    <p className="text-xs sm:text-sm text-text-secondary flex flex-wrap items-center gap-2">
                      <span className="bg-white/10 px-2 py-0.5 rounded text-white font-semibold">EP {item.epNum}</span>
                      {item.isDownloading ? (
                        <span className="text-accent animate-pulse">Downloading {item.progress}%</span>
                      ) : (
                        <span className="truncate">{new Date(item.downloadedAt || Date.now()).toLocaleDateString()}</span>
                      )}
                    </p>
                    {item.isDownloading && (
                      <div className="w-full max-w-[200px] h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </Link>
              
              {!item.isDownloading && (
                <button
                  onClick={(e) => handleDelete(e, item.id)}
                  className="p-3 mr-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors flex-shrink-0"
                  title="Remove Download"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
