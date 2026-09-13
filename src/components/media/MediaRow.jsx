import React, { useRef, useState, useEffect, useId } from 'react';
import { cn } from '../../lib/cn';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { MediaCard } from './MediaCard';

export function MediaRow({ title, items, mediaType = 'movie', className }) {
  const scrollRef = useRef(null);
  const headingId = useId();
  const trackId = useId();
  const reducedMotion = useReducedMotion();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const itemCount = items?.length || 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
    };
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    update();
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [itemCount]);

  const scroll = direction => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  if (!itemCount) return null;
  return (
    <section className={cn('cinema-row', className)} aria-labelledby={headingId}>
      <div className="cinema-row__heading">
        <div><p className="cinema-eyebrow">Discover more</p><h2 id={headingId}>{title}</h2></div>
        <div className="cinema-row__controls">
          <button type="button" className="cinema-icon-button" disabled={!canScrollLeft} onClick={() => scroll(-1)} aria-controls={trackId} aria-label={`Scroll ${title} left`}>←</button>
          <button type="button" className="cinema-icon-button" disabled={!canScrollRight} onClick={() => scroll(1)} aria-controls={trackId} aria-label={`Scroll ${title} right`}>→</button>
        </div>
      </div>
      <div ref={scrollRef} id={trackId} className="cinema-row__track scrollbar-hide">
        {items.map(item => (
          <div key={`${item.media_type || mediaType}-${item.id}`} className="cinema-row__item">
            <MediaCard item={item} mediaType={mediaType} />
          </div>
        ))}
      </div>
    </section>
  );
}
