import React, { useRef, useState, useEffect } from 'react';
import { cn } from '../../lib/cn';
import { useDevice } from '../../context/DeviceContext';
import { MediaCard } from './MediaCard';
export function MediaRow({ title, items, mediaType = 'movie', className }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const { isMobile } = useDevice();
  if (!items || items.length === 0) return null;
  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };
  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => el.removeEventListener('scroll', updateScrollState);
  }, []);
  return (
    <section className={cn('py-6 md:py-8', className)}>
      <div className="flex items-center gap-3 mb-5 px-5 md:px-10">
        <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
        <h2 className="text-lg md:text-xl font-bold text-text-primary tracking-tight">{title}</h2>
      </div>
      <div className="relative group/row">
        {!isMobile && canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-surface/90 backdrop-blur border border-border flex items-center justify-center text-text-primary opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-surface-hover"
            aria-label="Scroll left"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
        )}
        {!isMobile && canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-surface/90 backdrop-blur border border-border flex items-center justify-center text-text-primary opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-surface-hover"
            aria-label="Scroll right"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        )}
        <div
          ref={scrollRef}
          className={cn(
            'flex gap-3 md:gap-5 overflow-x-auto px-5 md:px-10 scrollbar-hide',
            isMobile && 'snap-x snap-mandatory'
          )}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex-shrink-0',
                isMobile ? 'w-[130px] snap-start' : 'w-[180px] lg:w-[200px]'
              )}
            >
              <MediaCard item={item} mediaType={mediaType} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function ChevronLeftIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRightIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}