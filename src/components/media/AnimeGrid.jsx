import React from 'react';
import { cn } from '../../lib/cn';
import { AnimeCard } from './AnimeCard';
export function AnimeGrid({ items, error, className }) {
  if (error) {
    return (
      <div className="text-center py-12 animate-in fade-in zoom-in duration-300">
        <div className="inline-flex w-16 h-16 bg-red-500/10 rounded-full items-center justify-center text-red-500 text-2xl font-bold mx-auto mb-4 border border-red-500/20">!</div>
        <p className="text-red-400/90 font-bold uppercase tracking-wider text-sm max-w-sm mx-auto leading-relaxed">{error}</p>
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">No items found.</p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5',
        className
      )}
    >
      {items.map((item) => (
        <AnimeCard key={item.id} item={item} />
      ))}
    </div>
  );
}