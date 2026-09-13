import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { slugify } from '../../lib/slugify';
import { api } from '../../lib/api';
import { useDevice } from '../../context/DeviceContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export function HeroSection({ items = [] }) {
  const { isTv } = useDevice();
  const reducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const slides = items || [];
  const index = slides.length ? currentIndex % slides.length : 0;
  const rotating = !paused && !hovered && !focused && !reducedMotion;

  useEffect(() => {
    if (slides.length < 2 || !rotating) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setCurrentIndex(previous => (previous + 1) % slides.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [slides.length, rotating]);

  if (!slides.length) return null;
  const item = slides[index];
  const isTvShow = item.media_type === 'tv' || (!item.title && !!item.name);
  const title = (isTvShow ? item.name : item.title) || 'Untitled';
  const year = (isTvShow ? item.first_air_date : item.release_date)?.slice(0, 4);
  const backdrop = api.getBackdropUrl(item.backdrop_path);
  const linkPath = `/${isTvShow ? 'tv' : 'movie'}/${item.id}/${slugify(title)}`;
  const selectSlide = next => {
    setCurrentIndex((next + slides.length) % slides.length);
    setPaused(true);
  };

  return (
    <section
      className={cn('cinema-hero', isTv && 'cinema-hero--tv')}
      aria-label="Featured titles"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="cinema-hero__art" aria-hidden="true">
        {backdrop && <img key={backdrop} src={backdrop} alt="" fetchPriority="high" />}
      </div>
      <div className="cinema-hero__shade" aria-hidden="true" />
      <div className="cinema-hero__topline">
        <span className="cinema-eyebrow">MIYO SELECT</span>
        <span className="cinema-hero__edition">Your next great watch</span>
      </div>
      <div className="cinema-hero__content" aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">
        <div role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}: ${title}`}>
          <p className="cinema-eyebrow cinema-hero__kicker"><span aria-hidden="true" /> In the spotlight</p>
          <h1>{title}</h1>
          <div className="cinema-hero__metadata">
            <span className="cinema-tag">{isTvShow ? 'TV series' : 'Movie'}</span>
            {year && <span>{year}</span>}
            {item.vote_average > 0 && <span className="cinema-rating"><span aria-hidden="true">★</span> {item.vote_average.toFixed(1)} <span className="cinema-rating__scale">/ 10</span></span>}
          </div>
          {item.overview && <p className="cinema-hero__description">{item.overview}</p>}
        </div>
        <div className="cinema-hero__actions">
          <Link to={linkPath} className="cinema-action cinema-action--primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l14-8z" /></svg>
            Explore title
          </Link>
          <Link to={isTvShow ? '/tv' : '/movies'} className="cinema-action cinema-action--secondary">Browse {isTvShow ? 'series' : 'movies'} <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      {slides.length > 1 && (
        <div className="cinema-hero__controls">
          <span className="cinema-hero__counter"><strong>{String(index + 1).padStart(2, '0')}</strong> / {String(slides.length).padStart(2, '0')}</span>
          <div className="cinema-hero__dots" aria-label="Choose a featured title">
            {slides.map((slide, slideIndex) => (
              <button key={`${slide.media_type || 'media'}-${slide.id}`} type="button" aria-label={`Show ${slide.title || slide.name || `title ${slideIndex + 1}`}`} aria-current={slideIndex === index ? 'true' : undefined} onClick={() => selectSlide(slideIndex)}><span /></button>
            ))}
          </div>
          <div className="cinema-hero__arrows">
            <button type="button" className="cinema-icon-button" onClick={() => selectSlide(index - 1)} aria-label="Previous featured title">←</button>
            {!reducedMotion && <button type="button" className="cinema-icon-button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Resume automatic slides' : 'Pause automatic slides'}>{paused ? '▶' : 'Ⅱ'}</button>}
            <button type="button" className="cinema-icon-button" onClick={() => selectSlide(index + 1)} aria-label="Next featured title">→</button>
          </div>
        </div>
      )}
    </section>
  );
}
