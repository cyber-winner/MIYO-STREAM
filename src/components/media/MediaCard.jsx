import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { slugify } from '../../lib/slugify';
import { api } from '../../lib/api';
import { useDevice } from '../../context/DeviceContext';
import { TruncatedText } from '../pretext/TruncatedText';
import { StarIcon, PlayIcon } from '../layout/NavIcons';
export function MediaCard({ item, mediaType = 'movie', className }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { isMobile, isTv } = useDevice();
  const type = item.media_type || mediaType;
  const isTvShow = type === 'tv';
  const title = isTvShow ? item.name : item.title;
  const date = isTvShow ? item.first_air_date : item.release_date;
  const year = date ? new Date(date).getFullYear() : '';
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
  const posterUrl = api.getImageUrl(item.poster_path);
  return (
    <Link
      to={`/${isTvShow ? 'tv' : 'movie'}/${item.id}/${slugify(title)}`}
      className={cn(
        'group relative rounded-2xl overflow-hidden bg-surface aspect-[2/3] block transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
        !isMobile && 'hover:-translate-y-4 hover:shadow-[0_20px_50px_rgba(0,0,0,0.8)]',
        isTv && 'tv-focus-ring',
        className
      )}
      tabIndex={isTv ? 0 : undefined}
    >
      {!imgError && posterUrl ? (
        <img
          src={posterUrl}
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
          <span className="text-text-muted text-xs text-center px-2">{title || 'No Image'}</span>
        </div>
      )}
      {!imgLoaded && !imgError && posterUrl && (
        <div className="absolute inset-0 skeleton" />
      )}
      {!isMobile && (
        <div className={cn(
          'absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4 transition-opacity duration-200',
          isTv ? 'opacity-0 group-focus-visible:opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          <TruncatedText lines={1} as="h3" className="font-semibold text-sm text-text-primary">
            {title}
          </TruncatedText>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-text-secondary">{year}</span>
            <div className="flex items-center gap-1 text-rating text-xs">
              <StarIcon className="w-3 h-3" />
              {rating}
            </div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-accent animate-rgb-shift bg-transparent backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity scale-90 group-hover:scale-100 group-focus-visible:scale-100">
            <PlayIcon className="w-5 h-5 text-accent animate-rgb-shift ml-0.5" />
          </div>
        </div>
      )}
      {isMobile && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-12">
          <Badge variant="accent" size="sm" className="mb-2 uppercase tracking-widest text-[9px]">
            {isTvShow ? 'TV Series' : 'Movie'}
          </Badge>
          <TruncatedText lines={1} as="h3" className="font-black text-white text-base tracking-tighter uppercase mb-1">
            {title}
          </TruncatedText>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-rating text-xs font-black">
              <StarIcon className="w-3 h-3 fill-rating stroke-none" />
              {rating}
            </div>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-[0.2em]">{year}</span>
          </div>
        </div>
      )}
    </Link>
  );
}
import { Badge } from '../ui/Badge';