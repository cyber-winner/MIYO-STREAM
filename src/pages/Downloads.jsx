import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDownloads, removeDownloadMetadata } from '../lib/downloadsManager';
import { isNative } from '../platform/index';

export function Downloads() {
  const [downloads, setDownloads] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    setDownloads(getDownloads());
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
      removeDownloadMetadata(id);
      setDownloads(getDownloads());
    }
  };

  return (
    <div className="pt-24 pb-32 px-4 md:px-8 max-w-[1400px] mx-auto min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">Downloads</h1>
          <p className="text-text-secondary mt-1">Watch your offline episodes</p>
        </div>
        {downloadList.length > 0 && (
          <div className="relative w-64 hidden sm:block">
            <input
              type="text"
              placeholder="Search downloads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-light border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        )}
      </div>

      {downloadList.length > 0 && (
        <div className="relative w-full mb-8 sm:hidden">
          <input
            type="text"
            placeholder="Search downloads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      )}

      {downloadList.length === 0 ? (
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-text-secondary">
          No downloads match your search.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {filtered.map((item) => (
            <Link
              key={item.id}
              to={`/watch/anime/${item.animeId}?ep=${item.epNum}`}
              className="group flex flex-col gap-3 relative"
            >
              <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-surface-light shadow-lg">
                {item.poster ? (
                  <img
                    src={item.poster}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted">
                    No Image
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                
                <div className="absolute top-2 right-2 flex gap-2">
                  <div className="bg-accent/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow backdrop-blur-md">
                    EP {item.epNum}
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="bg-black/60 text-white p-1 rounded-full hover:bg-red-500/80 transition-colors backdrop-blur-md"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/40 flex items-center justify-center transition-all duration-300">
                  <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shadow-[0_0_20px_rgba(var(--color-accent),0.4)] transform scale-75 group-hover:scale-100 transition-all duration-300">
                    <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-sm text-white line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                  {item.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
