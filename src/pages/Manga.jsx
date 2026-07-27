import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { slugify } from '../lib/slugify';
// import { Link } from 'react-router-dom';
import { anilistApi } from '../lib/anilistApi';
import { AnimeRow } from '../components/media/AnimeRow';
import { InlineSearchBar } from '../components/ui/InlineSearchBar';
import { SkeletonRow } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/cn';
import { useDevice } from '../context/DeviceContext';
export function Manga() {
  const { isMobile = false, isTv = false } = useDevice() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const handleSearch = useCallback(async (query) => {
    const result = await anilistApi.searchManga(query, 1, 8);
    return result.media || [];
  }, []);
  const renderSearchResult = useCallback((item, clearSearch) => {
    const title = item.title?.english || item.title?.romaji || item.title?.userPreferred;
    const cover = item.coverImage?.medium || item.coverImage?.large;
    const score = item.averageScore;
    const format = anilistApi.formatFormat(item.format);
    return (
      <Link key={item.id} to={`/anime/${item.id}/${slugify(title)}`} onClick={clearSearch}
        className="flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
        {cover ? (
          <img src={cover} alt={title} className="w-12 h-[72px] rounded-lg object-cover flex-shrink-0 shadow-md" />
        ) : (
          <div className="w-12 h-[72px] rounded-lg bg-surface-hover flex-shrink-0" />
        )}
        <div className="flex flex-col justify-center min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="accent" size="sm">{format}</Badge>
            {score && <span className="text-xs text-rating">★ {score}%</span>}
          </div>
        </div>
      </Link>
    );
  }, []);
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const [trending, popular, topRated] = await Promise.all([
          anilistApi.getMangaTrending(1, 20).catch(() => ({ media: [] })),
          anilistApi.getMangaPopular(1, 20).catch(() => ({ media: [] })),
          anilistApi.getMangaTopRated(1, 20).catch(() => ({ media: [] })),
        ]);
        if (cancelled) return;
        setData({ trending, popular, topRated });
      } catch (err) {
        console.error('Failed to load manga data:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);
  if (loading) {
    return (
      <div className="px-5 md:px-10 py-8">
        <div className="h-14 w-full max-w-2xl mx-auto skeleton rounded-2xl mb-10" />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 text-3xl font-bold">!</div>
        <h2 className="text-2xl font-black text-white uppercase">Failed to Load</h2>
        <p className="text-red-400 font-bold max-w-md text-center uppercase tracking-wider leading-relaxed">{error || 'Could not fetch manga data.'}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-accent text-white text-sm font-bold uppercase tracking-widest rounded-xl">
          Retry
        </button>
      </div>
    );
  }
  return (
    <div className={cn('py-8', isMobile && 'pt-24', isTv && 'space-y-4 pb-20')}>
      <div className="px-5 md:px-10 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <MangaHeroIcon className="w-8 h-8 text-accent animate-rgb-shift" />
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
            Manga
          </h1>
        </div>
        <InlineSearchBar
          placeholder="Search manga, light novels, one shots..."
          source="anime"
          onSearch={handleSearch}
          renderResult={renderSearchResult}
        />
      </div>
      <div className="px-5 md:px-10 mb-8">
        <Link
          to="/manga/browse"
          className="group flex items-center justify-between p-5 rounded-2xl border border-border bg-surface/60 hover:border-accent/50 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl cyber-gradient flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary group-hover:text-accent transition-colors">
                Read Manga from Providers
              </h3>
              <p className="text-sm text-text-secondary">
                Browse, search, and read manga chapters from WeebCentral, AllManga, and more
              </p>
            </div>
          </div>
          <svg className="w-5 h-5 text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </div>
      <div className="px-5 md:px-10 mt-8">
        <AnimeRow title="Trending Manga" items={data.trending.media} />
        <AnimeRow title="Popular Manga" items={data.popular.media} />
        <AnimeRow title="Top Rated Manga" items={data.topRated.media} />
      </div>
    </div>
  );
}
function MangaHeroIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M12 6v7l3-2 3 2V6" />
    </svg>
  );
}