import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { slugify } from '../lib/slugify';
import { anilistApi } from '../lib/anilistApi';
import { api } from '../lib/api';
import { AnimeHero } from '../components/media/AnimeHero';
import { AnimeRow } from '../components/media/AnimeRow';
import { InlineSearchBar } from '../components/ui/InlineSearchBar';
import { SkeletonRow, SkeletonHero } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { useDevice } from '../context/DeviceContext';
import { cn } from '../lib/cn';
export function Anime() {
  const { isTv = false } = useDevice() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const handleSearch = useCallback(async (query) => {
    const result = await anilistApi.searchAnime(query, 1, 8);
    return result.media || [];
  }, []);
  const renderSearchResult = useCallback((item, clearSearch) => {
    const title = item.title?.english || item.title?.romaji || item.title?.userPreferred;
    const cover = api.buildProxiedImageUrl(item.coverImage?.medium || item.coverImage?.large);
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
        const currentSeason = anilistApi.getCurrentSeason();
        const [trending, popular, topRated, airing, seasonal] = await Promise.all([
          anilistApi.getTrending(1, 10).catch(() => ({ media: [] })),
          anilistApi.getPopular(1, 20).catch(() => ({ media: [] })),
          anilistApi.getTopRated(1, 20).catch(() => ({ media: [] })),
          anilistApi.getAiring(1, 20).catch(() => ({ media: [] })),
          anilistApi.getSeason(currentSeason.season, currentSeason.year, 1, 20).catch(() => ({ media: [] })),
        ]);
        if (cancelled) return;
        setData({ trending, popular, topRated, airing, seasonal, currentSeason });
      } catch (err) {
        console.error('Failed to load anime data:', err);
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
      <div>
        <SkeletonHero />
        <div className="px-5 md:px-10">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 text-3xl font-bold">!</div>
        <h2 className="text-2xl font-black text-white uppercase">Failed to Load</h2>
        <p className="text-text-muted max-w-md text-center">{error || 'Could not fetch anime data from AniList. Please try again later.'}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-accent text-white text-sm font-bold uppercase tracking-widest rounded-xl">
          Retry
        </button>
      </div>
    );
  }
  const heroItems = data.trending.media?.slice(0, 5) || [];
  const seasonTitle = `${anilistApi.formatSeason(data.currentSeason.season)} ${data.currentSeason.year}`;
  return (
    <div className={cn(isTv && 'space-y-4 pb-20')}>
      <AnimeHero items={heroItems} />
      <div className="px-5 md:px-10 -mt-8 relative z-30 mb-6">
        <InlineSearchBar
          placeholder="Search anime..."
          source="anime"
          onSearch={handleSearch}
          renderResult={renderSearchResult}
        />
      </div>
      <div className="px-5 md:px-10 mb-8 relative z-20">
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-sm">
          <div>
            <h3 className="text-white font-black uppercase tracking-tight text-sm flex items-center gap-2">
              <span className="text-accent animate-pulse">⚡</span> Powered by StrawVerse
            </h3>
            <p className="text-text-secondary text-xs mt-1">
              Anime streaming is made possible by the incredible <span className="text-white font-bold">StrawVerse</span> proxy engine.
            </p>
          </div>
          <a
            href="https://github.com/TheYogMehta/StrawVerse"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-accent/20 text-accent font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-accent hover:text-black transition-colors border border-accent/30 whitespace-nowrap"
          >
            Star the Repo ★
          </a>
        </div>
      </div>
      <div className={cn('px-5 md:px-10', isTv && '-mt-20 relative z-20')}>
        <AnimeRow title="Trending Anime" items={data.trending.media} />
        <AnimeRow title={`${seasonTitle} Anime`} items={data.seasonal.media} />
        <AnimeRow title="Currently Airing" items={data.airing.media} />
        <AnimeRow title="Popular All Time" items={data.popular.media} />
        <AnimeRow title="Top Rated" items={data.topRated.media} />
      </div>
    </div>
  );
}