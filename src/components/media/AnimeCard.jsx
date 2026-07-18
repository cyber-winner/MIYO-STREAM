import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { slugify } from '../../lib/slugify';
import { useDevice } from '../../context/DeviceContext';
import { Badge } from '../ui/Badge';
import { anilistApi } from '../../lib/anilistApi';
export function AnimeCard({ item, className }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { isMobile, isTv } = useDevice();
  if (!item) return null;
  const title = item.title?.english || item.title?.romaji || item.title?.userPreferred || 'Unknown';
  const coverUrl = item.coverImage?.extraLarge || item.coverImage?.large;
  const score = item.averageScore;
  const format = anilistApi.formatFormat(item.format);
  const isAiring = item.status === 'RELEASING';
  const episodes = item.episodes;
  const chapters = item.chapters;
  const isAnime = item.type === 'ANIME';
  const nextEp = item.nextAiringEpisode;
  return (
    <Link
      to={`/anime/${item.id}/${slugify(title)}`}
      className={cn(
        'group relative rounded-2xl overflow-hidden bg-surface aspect-[2/3] block transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
        !isMobile && 'hover:-translate-y-4 hover:shadow-[0_20px_50px_rgba(0,0,0,0.8)]',
        isTv && 'tv-focus-ring',
        className
      )}
      tabIndex={isTv ? 0 : undefined}
    >
      {!imgError && coverUrl ? (
        <img
          src={coverUrl}
          alt={title}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={cn(
            'w-full h-full object-cover transition-all duration-500',
            !isMobile && 'group-hover:scale-105',
            imgLoaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface-hover">
          <span className="text-text-muted text-xs text-center px-2">{title}</span>
        </div>
      )}
      {!imgLoaded && !imgError && coverUrl && (
        <div className="absolute inset-0 skeleton" />
      )}
      {isAiring && (
        <div className="absolute top-3 left-3 z-20">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-black/70 backdrop-blur-md rounded-full border border-accent/30">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-green-400">Airing</span>
          </div>
        </div>
      )}
      {score && (
        <div className="absolute top-3 right-3 z-20">
          <div className={cn(
            "px-2 py-1 rounded-full text-[10px] font-black backdrop-blur-md border",
            score >= 75 ? "bg-green-500/20 border-green-500/40 text-green-400" :
            score >= 60 ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400" :
            "bg-red-500/20 border-red-500/40 text-red-400"
          )}>
            {score}%
          </div>
        </div>
      )}
      {!isMobile && (
        <div className={cn(
          'absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4 transition-opacity duration-200',
          isTv ? 'opacity-0 group-focus-visible:opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          <h3 className="font-semibold text-sm text-text-primary line-clamp-2">{title}</h3>
          <div className="flex items-center justify-between mt-1.5">
            <Badge variant="accent" size="sm">{format}</Badge>
            <span className="text-xs text-text-secondary">
              {isAnime ? (episodes ? `${episodes} EP` : 'Ongoing') : (chapters ? `${chapters} CH` : 'Ongoing')}
            </span>
          </div>
          {nextEp && (
            <div className="mt-2 text-[10px] text-text-muted">
              EP {nextEp.episode} in {formatTimeUntil(nextEp.timeUntilAiring)}
            </div>
          )}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-accent animate-rgb-shift bg-transparent backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity scale-90 group-hover:scale-100 group-focus-visible:scale-100">
            <PlayIcon className="w-5 h-5 text-accent animate-rgb-shift ml-0.5" />
          </div>
        </div>
      )}
      {isMobile && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-12">
          <Badge variant="accent" size="sm" className="mb-2 uppercase tracking-widest text-[9px]">
            {format}
          </Badge>
          <h3 className="font-black text-white text-base tracking-tighter uppercase mb-1 line-clamp-1">
            {title}
          </h3>
          <div className="flex items-center justify-between">
            {score && (
              <div className="flex items-center gap-1.5 text-xs font-black">
                <StarIcon className="w-3 h-3 fill-rating stroke-none" />
                <span className="text-rating">{score}%</span>
              </div>
            )}
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-[0.2em]">
              {isAnime ? (episodes ? `${episodes} EP` : '') : (chapters ? `${chapters} CH` : '')}
            </span>
          </div>
        </div>
      )}
    </Link>
  );
}
function formatTimeUntil(seconds) {
  if (!seconds) return '';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function PlayIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
function StarIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}