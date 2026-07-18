import React from 'react';
import { cn } from '../../lib/cn';
import { api } from '../../lib/api';
import { TruncatedText } from '../pretext/TruncatedText';
export function EpisodeCard({ episode, seasonNumber, isActive, onClick, className }) {
  const thumb = api.getImageUrl(episode.still_path) || null;
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border',
        isActive
          ? 'border-accent animate-rgb-shift shadow-[0_0_15px_rgba(124,58,237,0.3)]'
          : 'border-transparent hover:-translate-y-1 hover:border-border',
        className
      )}
    >
      {thumb ? (
        <img
          src={thumb}
          alt={`Episode ${episode.episode_number}`}
          loading="lazy"
          className="w-full aspect-video object-cover bg-background"
        />
      ) : (
        <div className="w-full aspect-video bg-background flex items-center justify-center">
          <span className="text-text-muted text-xs">No Preview</span>
        </div>
      )}
      <div className="p-4">
        <p className="text-xs font-semibold text-accent animate-rgb-shift mb-1">
          S{seasonNumber} E{episode.episode_number}
        </p>
        <h4 className="font-semibold text-sm text-text-primary mb-2">{episode.name}</h4>
        <TruncatedText lines={3} className="text-xs text-text-secondary leading-relaxed">
          {episode.overview || 'No description.'}
        </TruncatedText>
      </div>
    </div>
  );
}