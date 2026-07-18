import React from 'react';
import { cn } from '../../lib/cn';
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('skeleton', className)}
      {...props}
    />
  );
}
export function SkeletonCard({ className }) {
  return (
    <div className={cn('aspect-[2/3] rounded-xl skeleton', className)} />
  );
}
export function SkeletonGrid({ count = 10, className }) {
  return (
    <div className={cn(
      'grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6',
      className
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
export function SkeletonHero() {
  return (
    <div className="w-full h-[60vh] md:h-[80vh] skeleton" />
  );
}
export function SkeletonRow() {
  return (
    <div className="px-5 md:px-10 py-8">
      <div className="h-6 w-40 skeleton rounded-lg mb-5" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[140px] md:w-[200px] aspect-[2/3] skeleton rounded-xl" />
        ))}
      </div>
    </div>
  );
}