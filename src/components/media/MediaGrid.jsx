import React from 'react';
import { cn } from '../../lib/cn';
import { MediaCard } from './MediaCard';
export function MediaGrid({ items, mediaType = 'movie', className }) {
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
        <MediaCard key={item.id} item={item} mediaType={mediaType} />
      ))}
    </div>
  );
}