import React from 'react';
import { cn } from '../../lib/cn';
const variants = {
  accent: 'bg-transparent border border-accent text-accent animate-rgb-shift',
  genre: 'bg-white/10 text-text-primary',
  rating: 'bg-rating/20 text-rating',
  outline: 'bg-transparent border border-border text-text-secondary',
  success: 'bg-emerald-500/20 text-emerald-400',
};
const sizes = {
  sm: 'px-2 py-0.5 text-[0.65rem]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};
export function Badge({
  children,
  variant = 'accent',
  size = 'md',
  className,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono font-bold rounded-md uppercase tracking-wide whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}