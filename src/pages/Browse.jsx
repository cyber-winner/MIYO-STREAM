import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { anilistApi } from '../lib/anilistApi';
import { AnimeGrid } from '../components/media/AnimeGrid';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';
import { useSEO } from '../hooks/useSEO';

export function Browse({ mediaType = 'movie' }) {
  const [searchParams] = useSearchParams();
  const isTv = mediaType === 'tv';
  const format = isTv ? 'TV' : 'MOVIE';
  const pageTitle = isTv ? 'Anime TV Shows' : 'Anime Movies';
  const pageDescription = isTv
    ? 'Explore trending Anime TV series, filter by genre, status, and season. Stream in HD on MIYO-STREAM.'
    : 'Discover top-rated and blockbuster anime movies. Stream in HD on MIYO-STREAM.';

  useSEO({
    title: `Browse ${pageTitle}`,
    description: pageDescription,
  });

  const [genres] = useState(anilistApi.getGenres());
  const [activeGenre, setActiveGenre] = useState(searchParams.get('genre') || null);
  const [activeStatus, setActiveStatus] = useState(searchParams.get('status') || null);
  const [sortBy, setSortBy] = useState('POPULARITY_DESC');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);

  const sortOptions = [
    { value: 'POPULARITY_DESC', label: 'Popular' },
    { value: 'SCORE_DESC', label: 'Top Rated' },
    { value: 'TRENDING_DESC', label: 'Trending' },
    { value: 'START_DATE_DESC', label: 'Newest' },
    { value: 'FAVOURITES_DESC', label: 'Most Favorited' },
  ];

  const statusOptions = [
    { value: null, label: 'All Status' },
    { value: 'RELEASING', label: 'Airing' },
    { value: 'FINISHED', label: 'Completed' },
    { value: 'NOT_YET_RELEASED', label: 'Upcoming' },
  ];

  const loadContent = useCallback(async (pageNum, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      const result = await anilistApi.browse({
        type: 'ANIME',
        format,
        genre: activeGenre,
        status: activeStatus,
        sort: [sortBy],
        page: pageNum,
        perPage: 30,
      });

      if (append) {
        setItems((prev) => [...prev, ...(result.media || [])]);
      } else {
        setItems(result.media || []);
      }
      setHasNextPage(result.pageInfo?.hasNextPage || false);
    } catch (err) {
      console.error('Failed to load anime content:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [format, activeGenre, activeStatus, sortBy]);

  // Reset filters when switching between /movies and /tv
  useEffect(() => {
    setActiveGenre(searchParams.get('genre') || null);
    setActiveStatus(searchParams.get('status') || null);
    setPage(1);
    setItems([]);
  }, [mediaType, searchParams]);

  useEffect(() => {
    setPage(1);
    loadContent(1, false);
  }, [loadContent]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadContent(nextPage, true);
  };

  const handleGenreClick = (genreName) => {
    setActiveGenre(genreName === activeGenre ? null : genreName);
  };

  return (
    <div className="px-5 md:px-10 py-8 md:py-12">
      {/* Intro Header */}
      <section className="mb-10 p-6 md:p-8 rounded-[2rem] bg-surface/30 backdrop-blur-xl border border-white/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-accent font-bold text-xs uppercase tracking-widest">
                {isTv ? 'Series Catalog' : 'Movies Catalog'}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight mb-2">
              Browse {pageTitle}
            </h1>
            <p className="text-text-secondary text-sm leading-relaxed max-w-xl">
              {pageDescription}
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link
              to="/search"
              className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-accent/20 transition-all"
            >
              Search
            </Link>
            <Link
              to="/download"
              className="px-5 py-2.5 rounded-xl cyber-gradient text-sm font-bold text-white hover:opacity-90 active:scale-95 transition-all"
            >
              Get the App
            </Link>
          </div>
        </div>
      </section>

      {/* Controls Bar: Sort & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* Sort Pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all border uppercase tracking-wider whitespace-nowrap cursor-pointer',
                sortBy === opt.value
                  ? 'bg-accent/15 border-accent text-accent animate-rgb-shift shadow-md'
                  : 'bg-surface/50 border-white/5 text-text-muted hover:text-white hover:bg-white/5'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status Dropdown/Pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
          {statusOptions.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setActiveStatus(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-all border whitespace-nowrap cursor-pointer',
                activeStatus === opt.value
                  ? 'bg-white/10 border-white/30 text-white font-bold'
                  : 'bg-transparent border-white/5 text-text-muted hover:text-white hover:bg-white/5'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Genres Scroll Row */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-8">
        <button
          onClick={() => handleGenreClick(null)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer',
            activeGenre === null
              ? 'bg-transparent border-accent text-accent animate-rgb-shift'
              : 'bg-transparent border-border text-text-secondary hover:bg-white/5 hover:text-text-primary'
          )}
        >
          All Genres
        </button>
        {genres.map((genre) => (
          <button
            key={genre}
            onClick={() => handleGenreClick(genre)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer',
              activeGenre === genre
                ? 'bg-transparent border-accent text-accent animate-rgb-shift'
                : 'bg-transparent border-border text-text-secondary hover:bg-white/5 hover:text-text-primary'
            )}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Grid Content */}
      {loading ? (
        <SkeletonGrid count={20} />
      ) : (
        <>
          <AnimeGrid items={items} />

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
                  'Load More Anime'
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Internal cross-links */}
      <div className="flex flex-wrap gap-3 mt-10 pt-8 border-t border-white/5">
        <Link
          to={isTv ? '/movies' : '/tv'}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors"
        >
          {isTv ? '→ Browse Anime Movies' : '→ Browse Anime TV Shows'}
        </Link>
        <Link
          to="/anime/browse?status=RELEASING"
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors"
        >
          → Currently Airing
        </Link>
        <Link
          to="/anime/browse"
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors"
        >
          → All Formats &amp; Filters
        </Link>
        <Link
          to="/manga"
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors"
        >
          → Manga
        </Link>
        <Link
          to="/search"
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors"
        >
          → Search Catalog
        </Link>
      </div>
    </div>
  );
}

function LoadingSpinner({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
