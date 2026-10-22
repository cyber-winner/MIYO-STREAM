import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { slugify } from '../../lib/slugify';
import { anilistApi } from '../../lib/anilistApi';
import { SEARCH_DEBOUNCE_MS } from '../../lib/constants';
import { Badge } from '../ui/Badge';

export function SearchBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);
  const navigate = useNavigate();

  const handleSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    try {
      const data = await anilistApi.searchAnime(query, 1, 8);
      setSearchResults(data.media || []);
      setShowSearch(true);
    } catch (e) {
      console.error(e);
    }
  }, []);

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
            <SearchIcon className="w-5 h-5 flex-shrink-0 text-accent animate-rgb-shift transition-colors" />
            <input
              type="text"
              placeholder="Search anime series, movies, manga..."
              value={searchQuery}
              onChange={onSearchInput}
              onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  setShowSearch(false);
                  navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
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
                const title = item.title?.english || item.title?.romaji || item.title?.userPreferred || 'Unknown';
                const cover = item.coverImage?.medium || item.coverImage?.large;
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
                        {item.episodes && <span className="text-xs text-text-muted">{item.episodes} EP</span>}
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
            <p className="text-base text-text-muted text-center">No results found for &ldquo;{searchQuery}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
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
