import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { slugify } from '../lib/slugify';
import { Button } from '../components/ui/Button';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { cn } from '../lib/cn';
import { useDevice } from '../context/DeviceContext';

const DEFAULT_PROVIDER = 'allmanga';

function getMangaProvider() {
  try {
    return localStorage.getItem('miyo-manga-provider') || DEFAULT_PROVIDER;
  } catch { return DEFAULT_PROVIDER; }
}

export function MangaBrowse() {
  const { isMobile = false } = useDevice() || {};
  const [provider, setProvider] = useState(getMangaProvider());
  const [providers, setProviders] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [mode, setMode] = useState('latest'); // 'latest' | 'search'

  // Load providers
  useEffect(() => {
    api.getMangaProviders().then(data => {
      setProviders(data.providers || []);
    }).catch(() => {});
  }, []);

  const loadContent = useCallback(async (pageNum, append = false) => {
    if (!append) { setLoading(true); setError(null); }
    else { setLoadingMore(true); }
    try {
      let data;
      if (mode === 'search' && searchQuery) {
        data = await api.getMangaSearch(provider, searchQuery, pageNum);
      } else {
        data = await api.getMangaLatest(provider, pageNum);
      }
      const results = data?.results || [];
      if (append) {
        setItems(prev => [...prev, ...results]);
      } else {
        setItems(results);
      }
      setHasNextPage(data?.hasNextPage ?? results.length > 0);
    } catch (err) {
      console.error('Failed to load manga:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [provider, mode, searchQuery]);

  useEffect(() => {
    setPage(1);
    loadContent(1, false);
  }, [loadContent]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (q) {
      setSearchQuery(q);
      setMode('search');
    } else {
      setSearchQuery('');
      setMode('latest');
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setMode('latest');
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadContent(nextPage, true);
  };

  const handleProviderChange = (name) => {
    setProvider(name);
    try { localStorage.setItem('miyo-manga-provider', name); } catch {}
    setItems([]);
    setPage(1);
    setSearchQuery('');
    setSearchInput('');
    setMode('latest');
  };

  return (
    <div className={cn('px-5 md:px-10 py-8 md:py-12', isMobile && 'pt-24')}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <MangaIcon className="w-7 h-7 text-accent animate-rgb-shift" />
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
          Browse <span className="text-accent animate-rgb-shift">Manga</span>
        </h1>
      </div>

      {/* Provider Selector */}
      {providers.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-4">
          {providers.map((p) => (
            <button
              key={p.name}
              onClick={() => handleProviderChange(p.name)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border uppercase tracking-wider',
                provider === p.name
                  ? 'bg-transparent border-accent text-accent animate-rgb-shift'
                  : 'bg-transparent border-border text-text-secondary hover:bg-white/5 hover:text-text-primary'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-8 max-w-2xl">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Search on ${provider}...`}
            className="w-full px-4 py-3 pl-10 rounded-xl bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          {searchInput && (
            <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors text-sm">
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          className="px-6 py-3 rounded-xl font-bold text-sm cyber-gradient text-white hover:opacity-90 transition-all active:scale-95"
        >
          Search
        </button>
      </form>

      {/* Active search indicator */}
      {mode === 'search' && searchQuery && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-text-secondary">Results for:</span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-accent text-accent animate-rgb-shift">
            "{searchQuery}"
            <button onClick={clearSearch} className="ml-1 hover:text-white">✕</button>
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonGrid count={24} />
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 text-2xl font-bold">!</div>
          <p className="text-red-400 font-bold text-sm">{error}</p>
          <Button variant="secondary" onClick={() => loadContent(1, false)}>Retry</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <p className="text-text-secondary text-lg font-bold">No manga found</p>
          {mode === 'search' && (
            <Button variant="secondary" onClick={clearSearch}>Clear Search</Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
            {items.map((item, i) => (
              <MangaCard key={`${item.id}-${i}`} item={item} provider={provider} />
            ))}
          </div>
          {hasNextPage && (
            <div className="text-center mt-10">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <LoadingSpinner className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MangaCard({ item, provider }) {
  const imgSrc = item.image
    ? api.buildMangaImageUrl(item.image, '')
    : null;

  return (
    <Link
      to={`/manga/read/${provider}/${encodeURIComponent(item.id)}/${slugify(item.title)}`}
      className="group flex flex-col gap-2 transition-transform hover:scale-[1.02]"
    >
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-surface border border-border group-hover:border-accent/50 transition-colors shadow-lg">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-hover">
            <MangaIcon className="w-8 h-8 text-text-muted" />
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-text-primary line-clamp-2 leading-tight group-hover:text-accent transition-colors">
        {item.title}
      </p>
    </Link>
  );
}

function MangaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M12 6v7l3-2 3 2V6" />
    </svg>
  );
}

function SearchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LoadingSpinner({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
