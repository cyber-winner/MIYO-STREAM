import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { SEARCH_DEBOUNCE_MS } from '../../lib/constants';
/**
 * Big inline search bar for home pages.
 * @param {object} props
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.source - Source type for /search route (media|youtube|anime)
 * @param {function} props.onSearch - async (query) => results[]
 * @param {function} props.renderResult - (item, clearSearch) => JSX
 * @param {string} props.accentColor - CSS class for accent (default: text-accent)
 */
export function InlineSearchBar({ placeholder, source, onSearch, renderResult, accentColor = 'text-accent' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const data = await onSearch(q);
      setResults(data || []);
      setShowResults(true);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  }, [onSearch]);
  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val.trim()), SEARCH_DEBOUNCE_MS);
  };
  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
  return (
    <div className="relative w-full max-w-2xl mx-auto" ref={containerRef}>
      <div className={cn(
        'flex items-center gap-3 bg-background/60 backdrop-blur-md border rounded-2xl px-5 py-3.5 transition-all duration-300',
        showResults ? 'border-accent shadow-lg shadow-accent/10 animate-rgb-shift' : 'border-border/60 hover:border-border'
      )}>
        <SearchIcon className={cn('w-5 h-5 flex-shrink-0 transition-colors', showResults ? accentColor + ' animate-rgb-shift' : 'text-text-muted')} />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInput}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              setShowResults(false);
              navigate(`/search?q=${encodeURIComponent(query)}&source=${source}`);
            }
          }}
          className="bg-transparent border-none text-base text-text-primary outline-none w-full placeholder:text-text-muted/60"
        />
        {searching && (
          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin flex-shrink-0" />
        )}
        {query && !searching && (
          <button onClick={clearSearch} className="text-text-muted hover:text-text-primary transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface/95 backdrop-blur-xl border border-border rounded-xl overflow-hidden shadow-2xl z-50 max-h-[60vh] overflow-y-auto animate-scale-in">
          <div className="divide-y divide-border/30">
            {results.map((item, i) => renderResult(item, clearSearch, i))}
          </div>
        </div>
      )}
      {showResults && results.length === 0 && query.length >= 2 && !searching && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface/95 backdrop-blur-xl border border-border rounded-xl p-5 shadow-2xl z-50 animate-scale-in">
          <p className="text-text-muted text-center text-sm">No results for "{query}"</p>
        </div>
      )}
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