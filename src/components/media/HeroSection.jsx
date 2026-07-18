import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { slugify } from '../../lib/slugify';
import { api } from '../../lib/api';
import { useDevice } from '../../context/DeviceContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TruncatedText } from '../pretext/TruncatedText';
export function HeroSection({ items = [] }) {
  const { isMobile, isTv } = useDevice();
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [items.length]);
  if (!items || items.length === 0) return null;
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden flex items-end',
        isMobile ? 'h-[75vh]' : isTv ? 'h-[95vh]' : 'h-[80vh]'
      )}
    >
      {items.map((item, index) => {
        const isTvShow = item.media_type === 'tv';
        const title = isTvShow ? item.name : item.title;
        const desc = item.overview;
        const backdrop = api.getBackdropUrl(item.backdrop_path);
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
        const linkPath = `/${isTvShow ? 'tv' : 'movie'}/${item.id}/${slugify(title)}`;
        const isActive = index === currentIndex;
        return (
          <div
            key={item.id}
            className={cn(
              'absolute inset-0 bg-cover bg-center bg-no-repeat flex items-end transition-opacity duration-1000',
              isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
            )}
            style={{ 
              backgroundImage: (isActive || Math.abs(index - currentIndex) === 1) && backdrop 
                ? `url('${backdrop}')` 
                : undefined 
            }}
          >
            <div className="absolute inset-0 gradient-overlay" />
            <div className={cn(
              'relative z-10 max-w-3xl transform transition-all duration-1000 delay-300',
              isActive ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
              isMobile ? 'p-5 pb-12' : 'p-10 pb-16 lg:p-16 lg:pb-20'
            )}>
              <h1
                className={cn(
                  'font-black leading-[1.05] tracking-tight text-text-primary text-shadow-hero mb-6',
                  isMobile ? 'text-4xl' : isTv ? 'text-8xl' : 'text-5xl lg:text-7xl'
                )}
              >
                {title}
              </h1>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Badge variant="accent">{isTvShow ? 'TV Series' : 'Movie'}</Badge>
                <span className="text-sm md:text-base text-text-secondary flex items-center gap-1">
                  <span className="text-rating">★</span> {rating}/10
                </span>
              </div>
              <TruncatedText
                lines={isMobile ? 2 : 3}
                className={cn(
                  'text-text-secondary mb-6 transition-all duration-500 delay-500',
                  isActive ? 'opacity-100' : 'opacity-0',
                  isMobile ? 'text-sm' : 'text-base lg:text-lg'
                )}
              >
                {desc}
              </TruncatedText>
              <div className="flex items-center gap-3">
                <Link to={linkPath}>
                  <Button variant="primary" size={isTv ? 'tv' : isMobile ? 'md' : 'lg'}>
                    <PlayIcon className="w-5 h-5" />
                    Watch Now
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        );
      })}
      {items.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                idx === currentIndex ? 'bg-transparent border border-accent w-6 animate-rgb-shift' : 'bg-white/30 hover:bg-white/50'
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
function PlayIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}