import React, { useRef } from 'react';
import { cn } from '../../lib/cn';
import { MediaCard } from './MediaCard';
export function TVRow({ title, items, mediaType = 'movie', className }) {
  const scrollRef = useRef(null);
  if (!items || items.length === 0) return null;
  return (
    <section className={cn('py-10', className)}>
      <div className="flex items-center gap-4 mb-8 px-12 lg:px-16">
        <div className="w-2 h-8 bg-accent animate-rgb-shift rounded-full shadow-[0_0_15px_rgba(0,242,255,0.8)]" />
        <h2 className="text-3xl font-bold text-text-primary tracking-tight">{title}</h2>
      </div>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-8 overflow-x-auto px-12 lg:px-16 scrollbar-hide py-4"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0 w-[240px] transition-transform duration-300"
            >
              <MediaCard 
                item={item} 
                mediaType={mediaType} 
                className="hover:scale-110 focus:scale-110"
              />
            </div>
          ))}
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#050505] to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#050505] to-transparent pointer-events-none z-10" />
      </div>
    </section>
  );
}