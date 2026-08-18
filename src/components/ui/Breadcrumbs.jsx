import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/cn';

const ROUTE_LABELS = {
  '': 'Home',
  'movies': 'Movies',
  'tv': 'TV Shows',
  'movie': 'Movie',
  'anime': 'Anime',
  'manga': 'Manga',
  'search': 'Search',
  'settings': 'Settings',
  'download': 'Download',
  'changelog': 'Timeline',
  'terms': 'Terms',
  'privacy': 'Privacy',
  'about': 'About',
  'blog': 'Blog',
  'person': 'Person',
  'collection': 'Collection',
  'downloads': 'Downloads',
  'browse': 'Browse',
  'read': 'Read',
  'thank-you': 'Thank You',
};

export function Breadcrumbs({ className }) {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = [{ label: 'Home', path: '/' }];
  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    const label = ROUTE_LABELS[segments[i]] || decodeURIComponent(segments[i]).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ label, path: currentPath });
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-xs text-text-muted overflow-x-auto scrollbar-hide', className)}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.path} className="flex items-center gap-1.5 whitespace-nowrap">
            {i > 0 && <span className="text-text-muted/40">/</span>}
            {isLast ? (
              <span className="text-text-secondary font-medium">{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="hover:text-accent transition-colors">{crumb.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
