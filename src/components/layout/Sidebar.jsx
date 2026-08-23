import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { useDevice } from '../../context/DeviceContext';
import { Badge } from '../ui/Badge';
import { isNative } from '../../platform/index.js';
const MAIN_NAV = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/movies', label: 'Movies', icon: FilmIcon },
  { path: '/tv', label: 'TV Shows', icon: TvIcon },
];
const ANIME_NAV = [
  { path: '/anime', label: 'Anime Home', icon: AnimeIcon },
  { path: '/anime/browse?format=TV', label: 'TV', icon: TvIcon },
  { path: '/anime/browse?format=TV_SHORT', label: 'TV Short', icon: TvIcon },
  { path: '/anime/browse?format=MOVIE', label: 'Movie', icon: FilmIcon },
  { path: '/anime/browse?format=SPECIAL', label: 'Special', icon: AnimeIcon },
  { path: '/anime/browse?format=OVA', label: 'OVA', icon: FilmIcon },
  { path: '/anime/browse?format=ONA', label: 'ONA', icon: FilmIcon },
  { path: '/anime/browse?format=MUSIC', label: 'Music', icon: MusicIcon },
];
const MANGA_NAV = [
  { path: '/manga', label: 'Manga Home', icon: MangaIcon },
  { path: '/anime/browse?type=MANGA&format=MANGA', label: 'Manga', icon: MangaIcon },
  { path: '/anime/browse?type=MANGA&format=NOVEL', label: 'Light Novel', icon: MangaIcon },
  { path: '/anime/browse?type=MANGA&format=ONE_SHOT', label: 'One Shot', icon: MangaIcon },
  { path: '/anime/browse?type=MANGA&status=RELEASING', label: 'Publishing', icon: LiveIcon },
  { path: '/anime/browse?type=MANGA&status=FINISHED', label: 'Finished', icon: CheckIcon },
  { path: '/anime/browse?type=MANGA&status=NOT_YET_RELEASED', label: 'Upcoming', icon: ClockIcon },
  { path: '/anime/browse?type=MANGA&status=HIATUS', label: 'Hiatus', icon: ClockIcon },
];
const SECONDARY_NAV = [
  { path: '/about', label: 'About', icon: HomeIcon },
  { path: '/blog', label: 'Blog', icon: HistoryIcon },
  { path: '/changelog', label: 'Timeline', icon: HistoryIcon },
  { path: '/download', label: 'Get the App', icon: DownloadIcon },
  ...(isNative() ? [{ path: '/downloads', label: 'Downloads', icon: DownloadIcon }] : []),
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];
export function Sidebar({ isDesktop = true, isOpen = true, onClose }) {
  const location = useLocation();
  const [devMode, setDevMode] = useState(() => {
    try { return isNative() && !!localStorage.getItem('miyo_dev_mode'); } catch { return false; }
  });

  useEffect(() => {
    const handler = (e) => setDevMode(!!e.detail?.enabled);
    window.addEventListener('miyo-devmode', handler);
    return () => window.removeEventListener('miyo-devmode', handler);
  }, []);
  const renderLinks = (items) => (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive = item.path.includes('?') 
          ? (location.pathname + location.search) === item.path
          : location.pathname === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => onClose && onClose()}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
              isActive
                ? 'text-accent border border-accent animate-rgb-shift'
                : 'border border-transparent text-text-secondary hover:text-text-primary hover:bg-white/5'
            )}
          >
            <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-accent animate-rgb-shift')} />
            <span className="text-sm font-medium">{item.label}</span>
            {isActive && (
              <div className="ml-auto w-2.5 h-2.5 rounded-full border border-accent animate-rgb-shift" />
            )}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-50 flex flex-col bg-surface/95 backdrop-blur-xl border-r border-border transition-transform duration-300 w-[240px] overflow-y-auto",
        !isDesktop && !isOpen ? "-translate-x-full" : "translate-x-0"
      )}
    >
      <div className="flex items-center gap-3 px-4 h-[70px] flex-shrink-0">
        <Link to="/" onClick={() => onClose && onClose()} className="flex items-center gap-2.5 min-w-0 flex-1">
          <img src="/logo.png" alt="TETO-STREAM" className="w-8 h-8 rounded-lg flex-shrink-0" />
          <span className="text-lg font-bold text-text-primary whitespace-nowrap">
            TETO -<span className="text-accent animate-rgb-shift">STREAM</span>
          </span>
        </Link>
        {!isDesktop && (
          <button
            onClick={() => onClose && onClose()}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/10 transition-all active:scale-90 flex-shrink-0"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex-1 px-2 mt-4 space-y-6 pb-8">
        {renderLinks(MAIN_NAV)}
        <div className="pt-2">
          <div className="px-3 mb-2 flex items-center justify-between">
             <span className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] opacity-50">Anime</span>
             <Badge variant="accent" size="sm" className="scale-75 origin-right">ANILIST</Badge>
          </div>
          {renderLinks(ANIME_NAV)}
        </div>
        <div className="pt-2">
          <div className="px-3 mb-2 flex items-center justify-between">
             <span className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] opacity-50">Manga</span>
          </div>
          {renderLinks(MANGA_NAV)}
        </div>
        <div className="pt-2 border-t border-border/40">
          {renderLinks(SECONDARY_NAV)}
        </div>
        {devMode && (
          <div className="pt-2 border-t border-border/40">
            <div className="px-3 mb-2">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-[0.2em] opacity-70">Developer</span>
            </div>
            {renderLinks([{ path: '/dev-console', label: 'DevConsole', icon: CodeIcon }])}
          </div>
        )}
      </div>
    </aside>
  );
}
function HomeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function FilmIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" /><line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  );
}
function TvIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" />
    </svg>
  );
}
function HistoryIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function AnimeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function MangaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M12 6v7l3-2 3 2V6" />
    </svg>
  );
}
function MusicIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  );
}
function LiveIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
  );
}
function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function ClockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function DownloadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function SettingsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function CodeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
