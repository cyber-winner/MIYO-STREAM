import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { slugify } from '../lib/slugify';
import { api } from '../lib/api';
import { anilistApi } from '../lib/anilistApi';
import { HeroSection } from '../components/media/HeroSection';
import { MediaRow } from '../components/media/MediaRow';
import { TVRow } from '../components/media/TVRow';
import { AnimeRow } from '../components/media/AnimeRow';
import { InlineSearchBar } from '../components/ui/InlineSearchBar';
import { SkeletonRow, SkeletonHero } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { useDevice } from '../context/DeviceContext';
import { cn } from '../lib/cn';
import { isNative, getTmdbApiKey } from '../platform/index.js';
export function Home() {
  const { isTv = false, isMobile = false } = useDevice() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  
  // Native apps require a TMDB key to work
  useEffect(() => {
    if (isNative()) {
      const hasKey = getTmdbApiKey();
      setShowKeyWarning(!hasKey);
    }
  }, []);
  const handleSearch = useCallback(async (query) => {
    const data = await api.searchMulti(query);
    return data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 8);
  }, []);
  const renderSearchResult = useCallback((item, clearSearch) => {
    const isTvShow = item.media_type === 'tv';
    const title = isTvShow ? item.name : item.title;
    const year = (isTvShow ? item.first_air_date : item.release_date)?.slice(0, 4) || '';
    const poster = api.getImageUrl(item.poster_path, 'w92');
    const rating = item.vote_average?.toFixed(1) || 'NR';
    return (
      <Link key={item.id} to={`/${isTvShow ? 'tv' : 'movie'}/${item.id}/${slugify(title)}`} onClick={clearSearch}
        className="flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
        {poster ? (
          <img src={poster} alt={title} className="w-12 h-[72px] rounded-lg object-cover flex-shrink-0 shadow-md" />
        ) : (
          <div className="w-12 h-[72px] rounded-lg bg-surface-hover flex-shrink-0" />
        )}
        <div className="flex flex-col justify-center min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="accent" size="sm">{isTvShow ? 'TV' : 'Movie'}</Badge>
            <span className="text-xs text-text-muted">{year}</span>
            <span className="text-xs text-rating">★ {rating}</span>
          </div>
        </div>
      </Link>
    );
  }, []);
  useEffect(() => {
    if (isNative()) return; // No server to warm up in the native apps
    const BUILD_ID = '__miyo_v2__';
    try {
      if (localStorage.getItem('miyo_cache_warmed') !== BUILD_ID) {
        localStorage.setItem('miyo_cache_warmed', BUILD_ID);
        // Fire and forget cache warming
        fetch('/api/home').catch(() => {});
      }
    } catch (e) {}
  }, []);
  useEffect(() => {
    const loadData = async () => {
      try {
        const [trending, popMovies, popTv, nowPlaying, topRated, animeTrending] = await Promise.all([
          api.getTrending().catch(() => ({ results: [] })),
          api.getPopularMovies().catch(() => ({ results: [] })),
          api.getPopularTV().catch(() => ({ results: [] })),
          api.getNowPlayingMovies().catch(() => ({ results: [] })),
          api.getTopRatedMovies().catch(() => ({ results: [] })),
          anilistApi.getTrending(1, 15).catch(() => ({ media: [] })),
        ]);
        setData({ trending, popMovies, popTv, nowPlaying, topRated, animeTrending });
      } catch (err) {
        console.error('Failed to load home data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);
  if (loading) {
    return (
      <div>
        <SkeletonHero />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Failed to load content. Please try again later.</p>
      </div>
    );
  }
  const heroItems = data.trending.results.slice(0, 5);
  const Row = isTv ? TVRow : MediaRow;
  return (
    <div className={cn(isTv && 'space-y-4 pb-20')}>
      {showKeyWarning && (
        <div className="mx-4 md:mx-10 mt-4 p-4 rounded-xl border-l-4 border-accent bg-accent/10 backdrop-blur-sm">
          <p className="text-sm text-text-primary font-bold mb-2">🔑 Setup Required</p>
          <p className="text-sm text-text-secondary mb-3">
            To stream movies and TV shows, you need to add your free TMDB API key. AniList anime works without a key.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link 
              to="/settings" 
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-bold hover:opacity-90 transition-all text-center"
            >
              Add API Key in Settings
            </Link>
            <button
              onClick={() => setShowKeyWarning(false)}
              className="px-4 py-2 bg-background border border-border text-text-primary rounded-lg text-sm font-semibold hover:border-accent/50 transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <HeroSection items={heroItems} />
      <div className="px-5 md:px-10 -mt-8 relative z-30 mb-6">
        <InlineSearchBar
          placeholder="Search movies & TV shows..."
          source="media"
          onSearch={handleSearch}
          renderResult={renderSearchResult}
        />
      </div>
      <div className={cn(isTv && 'px-4 -mt-20 relative z-20')}>
        <Row title="Trending This Week" items={data.trending.results} />
        <Row title="Popular Movies" items={data.popMovies.results} mediaType="movie" />
        <Row title="Popular TV Shows" items={data.popTv.results} mediaType="tv" />
        <Row title="Now Playing" items={data.nowPlaying.results} mediaType="movie" />
        <Row title="Top Rated" items={data.topRated.results} mediaType="movie" />
        {data.animeTrending.media?.length > 0 && (
          <AnimeRow title="Anime Spotlight" items={data.animeTrending.media} />
        )}
      </div>
    </div>
  );
}
