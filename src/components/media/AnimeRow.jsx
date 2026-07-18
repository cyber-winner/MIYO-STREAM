import React, { useRef } from 'react';
import { cn } from '../../lib/cn';
import { AnimeCard } from './AnimeCard';
export function AnimeRow({ title, items = [], className }) {
  const scrollRef = useRef(null);
  if (!items || items.length === 0) return null;
  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  return (
    <section className={cn('py-6', className)}>
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">{title}</h2>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-text-secondary hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-text-secondary hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth"
      >
        {items.map((item) => (
          <div key={item.id} className="w-[160px] md:w-[185px] flex-shrink-0">
            <AnimeCard item={item} />
          </div>
        ))}
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
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}