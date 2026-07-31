import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { anilistApi } from '../lib/anilistApi';
import { useDevice } from '../context/DeviceContext';
import { Badge } from '../components/ui/Badge';
import { SEARCH_DEBOUNCE_MS } from '../lib/constants';
import { cn } from '../lib/cn';
import { slugify } from '../lib/slugify';
export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialSource = searchParams.get('source') || 'media';
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState(initialSource === 'youtube' ? 'media' : initialSource);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const timerRef = useRef(null);
  const { isMobile } = useDevice();
  const performSearch = useCallback(async (searchQuery, currentSource) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setError(null);
    try {
      if (currentSource === 'anime') {
        const [animeData, mangaData] = await Promise.all([
          anilistApi.searchAnime(searchQuery, 1, 15),
          anilistApi.searchManga(searchQuery, 1, 9),
        ]);
        const combined = [
          ...(animeData.media || []).map(m => ({ ...m, _searchType: 'anime' })),
          ...(mangaData.media || []).map(m => ({ ...m, _searchType: 'manga' })),
        ];
        setResults(combined);
      } else {
        const data = await api.searchMulti(searchQuery);
        const filtered = data.results
          .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
          .slice(0, 24);
        setResults(filtered);
      }
      setSearchParams({ q: searchQuery, source: currentSource });
    } catch (err) {
      console.error('Search failed:', err);
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [setSearchParams]);
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, source);
    }
  }, [initialQuery, source, performSearch]);
  const handleInput = (e) => {
    const value = e.target.value;
    setQuery(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => performSearch(value.trim(), source), SEARCH_DEBOUNCE_MS);
  };
  const toggleSource = (newSource) => {
    setSource(newSource);
    if (query) performSearch(query, newSource);
  };
  return (
    <div className="px-5 md:px-10 py-8 md:py-12 max-w-[1600px] mx-auto">
      <div className="max-w-3xl mx-auto mb-10 space-y-6">
        <div className={cn(
          'flex items-center gap-3 glass rounded-2xl px-5 transition-all duration-300 relative z-10',
          isMobile ? 'py-3' : 'py-5',
          query && 'border-accent/40 shadow-[0_0_30px_rgba(0,242,255,0.1)] ring-1 ring-accent/20'
        )}>
          <SearchIcon className="w-6 h-6 flex-shrink-0 transition-colors text-accent" />
          <input
            type="text"
            placeholder="Search movies, TV shows, anime..."
            value={query}
            onChange={handleInput}
            autoFocus
            className="bg-transparent border-none text-xl text-text-primary outline-none w-full placeholder:text-text-muted font-mono tracking-tight"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); setHasSearched(false); setSearchParams({ source }); }}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <button 
            onClick={() => toggleSource('media')}
            className={cn(
              "px-6 py-2 rounded-xl text-xs font-bold transition-all border uppercase tracking-widest",
              source === 'media' ? "bg-accent/10 border-accent text-accent animate-rgb-shift" : "bg-surface border-border text-text-muted hover:text-text-primary"
            )}
          >
            Movies & TV
          </button>
          <button 
            onClick={() => toggleSource('anime')}
            className={cn(
              "px-6 py-2 rounded-xl text-xs font-bold transition-all border uppercase tracking-widest",
              source === 'anime' ? "bg-accent/10 border-accent text-accent animate-rgb-shift" : "bg-surface border-border text-text-muted hover:text-text-primary"
            )}
          >
            Anime & Manga
          </button>
        </div>
      </div>
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-12 h-12 border-4 rounded-full animate-spin border-t-transparent border-accent" />
          <p className="text-text-muted text-sm animate-pulse tracking-widest uppercase">Fetching Results...</p>
        </div>
      )}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {source === 'anime'
            ? results.map((item) => <AnimeResultCard key={item.id} item={item} />)
            : results.map((item) => <MediaResultCard key={item.id} item={item} />)
          }
        </div>
      )}
      {!loading && hasSearched && results.length === 0 && (
        <div className="text-center py-24 bg-surface/20 rounded-[40px] border border-dashed border-border/40">
          <p className="text-text-muted text-xl font-bold">No results found for &ldquo;{query}&rdquo;</p>
          <p className="text-text-muted/60 text-sm mt-2">Try using different keywords</p>
        </div>
      )}
      {!hasSearched && !loading && (
        <div className="text-center py-32 opacity-20">
          <SearchIcon className="w-24 h-24 mx-auto mb-6" />
          <p className="text-2xl font-black uppercase tracking-[0.3em]">Miyo Search Engine</p>
        </div>
      )}
    </div>
  );
}
function MediaResultCard({ item }) {
  const { isTv } = useDevice();
  const isTvShow = item.media_type === 'tv';
  const title = isTvShow ? item.name : item.title;
  const yearRaw = isTvShow ? item.first_air_date : item.release_date;
  const year = yearRaw ? new Date(yearRaw).getFullYear() : '';
  const poster = api.getImageUrl(item.poster_path, 'w342');
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
  return (
    <Link
      to={`/${isTvShow ? 'tv' : 'movie'}/${item.id}/${slugify(title)}`}
      className={cn(
        "group relative bg-surface rounded-2xl overflow-hidden border border-transparent transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        isTv ? "tv-focus-ring" : "hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
      )}
      tabIndex={isTv ? 0 : undefined}
    >
      <div className="aspect-[2/3] overflow-hidden">
        {poster ? (
          <img src={poster} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-surface-hover flex items-center justify-center text-text-muted">No Poster</div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-5 transition-opacity">
        <h3 className="font-bold text-white text-base line-clamp-2 mb-1 uppercase tracking-tight">{title}</h3>
        <div className="flex items-center gap-3">
          <Badge variant="accent" size="sm">{isTvShow ? 'TV' : 'Movie'}</Badge>
          <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{year}</span>
          <span className="text-rating text-[10px] font-bold">★ {rating}</span>
        </div>
      </div>
    </Link>
  );
}
function AnimeResultCard({ item }) {
  const { isTv } = useDevice();
  const title = item.title?.english || item.title?.romaji || item.title?.userPreferred || 'Unknown';
  const cover = api.buildProxiedImageUrl(item.coverImage?.large || item.coverImage?.medium);
  const score = item.averageScore;
  const format = anilistApi.formatFormat(item.format);
  const isAnime = item.type === 'ANIME';
  return (
    <Link
      to={`/anime/${item.id}/${slugify(title)}`}
      className={cn(
        "group relative bg-surface rounded-2xl overflow-hidden border border-transparent transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        isTv ? "tv-focus-ring" : "hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
      )}
      tabIndex={isTv ? 0 : undefined}
    >
      <div className="aspect-[2/3] overflow-hidden">
        {cover ? (
          <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-surface-hover flex items-center justify-center text-text-muted">No Cover</div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-5 transition-opacity">
        <h3 className="font-bold text-white text-base line-clamp-2 mb-1 uppercase tracking-tight">{title}</h3>
        <div className="flex items-center gap-3">
          <Badge variant="accent" size="sm">{isAnime ? format : 'Manga'}</Badge>
          {score && <span className="text-rating text-[10px] font-bold">★ {score}%</span>}
        </div>
      </div>
    </Link>
  );
}
function SearchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function XIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}