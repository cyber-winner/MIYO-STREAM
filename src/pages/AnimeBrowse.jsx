import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { anilistApi } from '../lib/anilistApi';
import { AnimeGrid } from '../components/media/AnimeGrid';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';
export function AnimeBrowse() {
  const [searchParams] = useSearchParams();
  const urlFormat = searchParams.get('format');
  const urlStatus = searchParams.get('status');
  const urlGenre = searchParams.get('genre');
  const urlType = searchParams.get('type');
  const [mediaType, setMediaType] = useState(urlType === 'MANGA' ? 'MANGA' : 'ANIME');
  const [genres] = useState(anilistApi.getGenres());
  const [activeGenre, setActiveGenre] = useState(urlGenre || null);
  const [activeFormat, setActiveFormat] = useState(urlFormat || null);
  const [activeStatus, setActiveStatus] = useState(urlStatus || null);
  const [activeSeason, setActiveSeason] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [sortBy, setSortBy] = useState('POPULARITY_DESC');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const formatOptions = anilistApi.getFormats()[mediaType] || [];
  const statusOptions = anilistApi.getStatusOptions()[mediaType] || [];
  const seasons = anilistApi.getSeasons();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear + 1 - i);
  const sortOptions = [
    { value: 'POPULARITY_DESC', label: 'Popular' },
    { value: 'SCORE_DESC', label: 'Top Rated' },
    { value: 'TRENDING_DESC', label: 'Trending' },
    { value: 'START_DATE_DESC', label: 'Newest' },
    { value: 'FAVOURITES_DESC', label: 'Most Favorited' },
  ];
  const loadContent = useCallback(async (pageNum, append = false) => {
    if (!append) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const result = await anilistApi.browse({
        type: mediaType,
        sort: [sortBy],
        genre: activeGenre,
        format: activeFormat,
        status: activeStatus,
        season: activeSeason,
        seasonYear: activeYear,
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
      console.error('Failed to load anime browse:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [mediaType, sortBy, activeGenre, activeFormat, activeStatus, activeSeason, activeYear]);
  useEffect(() => {
    setMediaType(urlType === 'MANGA' ? 'MANGA' : 'ANIME');
    setActiveFormat(urlFormat || null);
    setActiveStatus(urlStatus || null);
    setActiveGenre(urlGenre || null);
  }, [urlFormat, urlStatus, urlGenre, urlType]);
  useEffect(() => {
    setPage(1);
    loadContent(1, false);
  }, [loadContent]);
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadContent(nextPage, true);
  };
  return (
    <div className="px-5 md:px-10 py-8 md:py-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1.5 h-8 bg-transparent border border-accent animate-rgb-shift rounded-full" />
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
          Browse {mediaType === 'ANIME' ? 'Anime' : 'Manga'}
        </h1>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-4">
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border uppercase tracking-wider',
              sortBy === opt.value
                ? 'bg-transparent border-accent text-accent animate-rgb-shift'
                : 'bg-transparent border-border text-text-secondary hover:bg-white/5 hover:text-text-primary'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-4">
        <button
          onClick={() => setActiveGenre(null)}
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
            onClick={() => setActiveGenre(genre === activeGenre ? null : genre)}
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
      {(activeFormat || activeStatus) && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {activeFormat && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-accent text-accent animate-rgb-shift">
              {anilistApi.formatFormat(activeFormat)}
              <button onClick={() => setActiveFormat(null)} className="ml-1 hover:text-white">✕</button>
            </span>
          )}
          {activeStatus && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-accent text-accent animate-rgb-shift">
              {anilistApi.formatStatus(activeStatus)}
              <button onClick={() => setActiveStatus(null)} className="ml-1 hover:text-white">✕</button>
            </span>
          )}
        </div>
      )}
      {loading ? (
        <SkeletonGrid count={30} />
      ) : (
        <>
          <AnimeGrid items={items} error={error} />
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
function LoadingSpinner({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}