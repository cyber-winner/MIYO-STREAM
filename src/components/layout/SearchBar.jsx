import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { slugify } from '../../lib/slugify';
import { api } from '../../lib/api';
import { anilistApi } from '../../lib/anilistApi';
import { SEARCH_DEBOUNCE_MS } from '../../lib/constants';
import { Badge } from '../ui/Badge';
export function SearchBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isAnimeContext = location.pathname.startsWith('/anime');
  const handleSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    try {
      if (isAnimeContext) {
        const data = await anilistApi.searchAnime(query, 1, 8);
        setSearchResults((data.media || []).map(m => ({ ...m, _type: 'anime' })));
      } else {
        const data = await api.searchMulti(query);
        const results = data.results
          .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
          .slice(0, 8);
        setSearchResults(results);
      }
      setShowSearch(true);
    } catch (e) {
      console.error(e);
    }
  }, [isAnimeContext]);
  const onSearchInput = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => handleSearch(value.trim()), SEARCH_DEBOUNCE_MS);
  };
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
  return (
    <div className="w-full h-[70px] glass border-b border-border sticky top-0 z-40 px-6 flex items-center">
      <div className="max-w-4xl w-full mx-auto relative" ref={searchRef}>
        <div className="flex items-center gap-4">
          <div className={cn(
            'flex-1 flex items-center gap-3 bg-background/50 border border-border rounded-xl px-4 py-2.5 transition-all',
            showSearch && 'border-accent animate-rgb-shift shadow-lg shadow-accent/10'
          )}>
            <SearchIcon className={cn("w-5 h-5 flex-shrink-0 transition-colors", isAnimeContext ? "text-accent animate-rgb-shift" : "text-accent")} />
            <input
              type="text"
              placeholder={isAnimeContext ? "Search anime & manga..." : "Search movies, tv shows..."}
              value={searchQuery}
              onChange={onSearchInput}
              onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  setShowSearch(false);
                  const source = isAnimeContext ? 'anime' : 'media';
                  navigate(`/search?q=${encodeURIComponent(searchQuery)}&source=${source}`);
                }
              }}
              className="bg-transparent border-none text-base text-text-primary outline-none w-full placeholder:text-text-muted"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="text-text-muted hover:text-text-primary">
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface/95 backdrop-blur-xl border border-border rounded-xl overflow-hidden shadow-2xl z-50 animate-scale-in max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/50">
              {searchResults.map((item) => {
                if (item._type === 'anime') {
                  const title = item.title?.english || item.title?.romaji || item.title?.userPreferred;
                  const cover = api.buildProxiedImageUrl(item.coverImage?.medium || item.coverImage?.large);
                  const score = item.averageScore;
                  const format = anilistApi.formatFormat(item.format);
                  return (
                    <Link
                      key={item.id}
                      to={`/anime/${item.id}/${slugify(title)}`}
                      onClick={clearSearch}
                      className="flex gap-3 px-4 py-3 bg-surface hover:bg-white/5 transition-colors"
                    >
                      {cover ? (
                        <img src={cover} alt={title} className="w-12 h-[72px] rounded-lg object-cover flex-shrink-0 shadow-md" />
                      ) : (
                        <div className="w-12 h-[72px] rounded-lg bg-surface-hover flex-shrink-0" />
                      )}
                      <div className="flex flex-col justify-center min-w-0">
                        <p className="text-base font-semibold text-text-primary truncate">{title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="accent" size="sm">{format}</Badge>
                          {score && <span className="text-sm text-rating">★ {score}%</span>}
                        </div>
                      </div>
                    </Link>
                  );
                }
                const isTv = item.media_type === 'tv';
                const title = isTv ? item.name : item.title;
                const yearRaw = isTv ? item.first_air_date : item.release_date;
                const year = yearRaw ? new Date(yearRaw).getFullYear() : '';
                const poster = api.getImageUrl(item.poster_path, 'w92');
                const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
                return (
                  <Link
                    key={item.id}
                    to={`/${isTv ? 'tv' : 'movie'}/${item.id}/${slugify(title)}`}
                    onClick={clearSearch}
                    className="flex gap-3 px-4 py-3 bg-surface hover:bg-white/5 transition-colors"
                  >
                    {poster ? (
                      <img src={poster} alt={title} className="w-12 h-[72px] rounded-lg object-cover flex-shrink-0 shadow-md" />
                    ) : (
                      <div className="w-12 h-[72px] rounded-lg bg-surface-hover flex-shrink-0" />
                    )}
                    <div className="flex flex-col justify-center min-w-0">
                      <p className="text-base font-semibold text-text-primary truncate">{title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="accent" size="sm">{isTv ? 'TV' : 'Movie'}</Badge>
                        <span className="text-sm text-text-muted">{year}</span>
                        <span className="text-sm text-rating">★ {rating}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {showSearch && searchResults.length === 0 && searchQuery.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl p-6 shadow-2xl z-50 animate-scale-in">
            <p className="text-base text-text-muted text-center">No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
function SearchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function XIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}