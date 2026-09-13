import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { slugify } from '../../lib/slugify';
import { api } from '../../lib/api';
import { useDevice } from '../../context/DeviceContext';
import { StarIcon, PlayIcon } from '../layout/NavIcons';

export function MediaCard({ item, mediaType = 'movie', className }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { isTv } = useDevice();
  const type = item.media_type || mediaType;
  const isTvShow = type === 'tv';
  const title = (isTvShow ? item.name : item.title) || 'Untitled';
  const date = isTvShow ? item.first_air_date : item.release_date;
  const year = date?.slice(0, 4);
  const rating = item.vote_average > 0 ? item.vote_average.toFixed(1) : null;
  const posterUrl = api.getImageUrl(item.poster_path);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [posterUrl]);

  return (
    <Link to={`/${isTvShow ? 'tv' : 'movie'}/${item.id}/${slugify(title)}`}
      className={cn('cinema-card group', isTv && 'tv-focus-ring', className)}
      aria-label={`${title}${year ? ` (${year})` : ''}, ${isTvShow ? 'TV series' : 'movie'}`}>
      <div className="cinema-card__poster">
        {!imgError && posterUrl ? (
          <img src={posterUrl} alt="" loading="lazy" decoding="async"
            onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)}
            className={cn('cinema-card__image', imgLoaded && 'cinema-card__image--loaded')} />
        ) : (
          <div className="cinema-card__fallback"><span aria-hidden="true">◇</span><span>{title}</span></div>
        )}
        {!imgLoaded && !imgError && posterUrl && <div className="absolute inset-0 skeleton" aria-hidden="true" />}
        <span className="cinema-card__type">{isTvShow ? 'Series' : 'Movie'}</span>
        {rating && <span className="cinema-card__rating"><StarIcon className="w-3 h-3" />{rating}</span>}
        <div className="cinema-card__reveal" aria-hidden="true">
          <span className="cinema-card__play"><PlayIcon className="w-5 h-5" /></span>
          <span>Explore title</span>
        </div>
      </div>
      <div className="cinema-card__caption">
        <h3>{title}</h3>
        <p>{year || 'Date TBA'}<span aria-hidden="true"> · </span>{isTvShow ? 'TV series' : 'Movie'}</p>
      </div>
    </Link>
  );
}
