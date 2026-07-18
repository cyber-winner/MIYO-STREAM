import React from 'react';
import { cn } from '../../lib/cn';
export function SeasonSelector({ seasons, activeSeason, onSelect, className }) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto scrollbar-hide py-3', className)}>
      {seasons.map((season) => (
        <button
          key={season.season_number}
          onClick={() => onSelect(season.season_number)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer',
            activeSeason === season.season_number
              ? 'bg-transparent border-accent text-accent animate-rgb-shift'
              : 'bg-surface border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          )}
        >
          Season {season.season_number}
        </button>
      ))}
    </div>
  );
}