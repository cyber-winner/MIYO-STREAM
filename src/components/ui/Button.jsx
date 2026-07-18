import React from 'react';
import { cn } from '../../lib/cn';
const variants = {
  primary: 'cyber-gradient text-white shadow-lg shadow-accent-glow hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent-glow active:translate-y-0 animate-cyber-hue-shift',
  secondary: 'bg-surface border border-border text-text-primary hover:bg-surface-hover active:bg-surface',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5',
  danger: 'bg-red-600/10 border border-red-600/30 text-red-400 hover:bg-red-600/20',
};
const sizes = {
  sm: 'px-3 py-1.5 text-sm gap-1.5 rounded-lg',
  md: 'px-5 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-7 py-3 text-base gap-2.5 rounded-xl',
  tv: 'px-8 py-4 text-lg gap-3 rounded-2xl',
};
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold cursor-pointer transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}