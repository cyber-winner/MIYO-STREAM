import React from 'react';
import { cn } from '../lib/cn';
import { useDevice } from '../context/DeviceContext';
import { Badge } from '../components/ui/Badge';
const CHANGELOGS = [
  {
    date: 'JUNE 23, 2026',
    title: 'UI Parity & Cinematic Backgrounds',
    decoration: '/oshi-no-ko-onk.gif',
    description: "Turned off the smart TV detection because it was causing massive lag when navigating. TVs now get the exact same smooth UI as desktop users. Also fixed the background images on detail pages so the anime/movie backdrop covers the whole screen while you scroll.",
    tags: ['UI', 'Performance', 'Aesthetics']
  },
  {
    date: 'JUNE 20, 2026',
    title: 'v2.0.0: StrawVerse Integration & Cloudflare Tunnels',
    decoration: '/one-piece-hat-luffy-hat.gif',
    description: 'Massive infrastructure rewrite. Migrated Anime scraping to a robust Express backend powered by StrawVerse architecture. Added Cloudflare Tunnel deployment support and disk-based caching for AniList GraphQL queries.',
    tags: ['Architecture', 'Cloudflare', 'StrawVerse']
  },
  {
    date: 'MAY 14, 2026',
    title: 'Manual Season Selector',
    decoration: '/anime-frieren.gif',
    description: 'Added a manual season and episode selector. Users can now choose the correct TMDB source to fix mapping issues for some series.',
    tags: ['UI', 'Player', 'UX']
  },
  {
    date: 'MAY 14, 2026',
    title: 'Sync Engine Updates',
    decoration: '/cute-angry.gif',
    description: 'Updated the matching system that links AniList episode names with TMDB metadata to calculate offsets for split-cours and sequels.',
    tags: ['Sync', 'Engine', 'Backend']
  },
  {
    date: 'MAY 14, 2026',
    title: 'Hide Unaired Episodes',
    decoration: '/akane-shinjo-anime.gif',
    description: 'Added a check for real-time airing schedules so that unaired episodes are hidden from the UI.',
    tags: ['UI', 'Airing', 'Logic']
  },
  {
    date: 'MAY 14, 2026',
    title: 'Asset Path Fixes',
    decoration: '/anime-transparent.gif',
    description: 'Fixed root-path issues for public assets like logo.png so they load correctly across the site.',
    tags: ['Fix', 'Asset', 'Branding']
  },
  {
    date: 'MAY 04, 2026',
    featured: true,
    variant: 'core',
    decoration: '/transparent-hunni-hime.gif',
    title: 'Vercel Blob Caching',
    description: 'Removed MongoDB, YouTube integration, and user authentication. Switched to a Vercel Blob caching layer that proxies TMDB and AniList API calls to improve load speeds and prevent rate limits.',
    highlights: [
      'Vercel Blob Proxy Cache',
      'Background Data Sync',
      'API Keys Hidden from Frontend',
      'Removed Unused Dependencies',
      'Daily Full Catalog Sync'
    ],
    tags: ['Major', 'CORE', 'Performance', 'Infrastructure']
  },
  {
    date: 'MAY 04, 2026',
    title: 'Removed Features',
    decoration: '/one-piece.gif',
    description: 'Removed YouTube integration, curated lists, user profiles, and TMDB watchlists to reduce complexity and focus on the main catalog features.',
    tags: ['Optimization', 'System', 'Cleanup']
  },
  {
    date: 'APR 27, 2026',
    featured: true,
    variant: 'core',
    decoration: '/frieren-popsicle.gif',
    title: 'Navigation and API Routing',
    description: 'Made navigation consistent across desktop, mobile, and TV. Improved how AniList queries are routed to TMDB, and added UI messages for API rate limits.',
    highlights: [
      'TMDB Anime Player Routing',
      'Consistent Cross-Platform Navigation',
      'Rate-Limit UI Messages',
      'Manga and Anime Flow Updates'
    ],
    tags: ['Major', 'CORE', 'Player', 'UX']
  },
  {
    date: 'APR 24, 2026',
    featured: true,
    variant: 'core',
    decoration: '/sad-eyes-sad.gif',
    title: 'Ad-Supported Player',
    description: 'Updated video player sources. Due to provider restrictions, the current video player includes pop-up ads when clicked.',
    highlights: [
      'Multi-Source Media Updates',
      'Network Routing Changes',
      'Ad Notices Added'
    ],
    tags: ['Major', 'CORE', 'Infrastructure', 'Global']
  },
  {
    date: 'APR 24, 2026',
    title: 'TV Search Portal',
    decoration: '/dance-cute.gif',
    description: 'Added a search page to the main navigation for users on TV devices.',
    tags: ['TV', 'Discovery', 'UX']
  },
  {
    date: 'APR 24, 2026',
    title: 'System Cleanup',
    decoration: '/mol7ot-mol7.gif',
    description: 'Removed old maintenance scripts and cleaned up internal code to improve performance.',
    tags: ['Optimization', 'System', 'Performance']
  },
  {
    date: 'APR 21, 2026',
    title: 'YouTube Updates',
    decoration: '/anime-couple.webp',
    description: 'Updated the YouTube integration to sync data with the local database and match the layout of the main site.',
    tags: ['YouTube', 'Persistence', 'UI/UX', 'System']
  },
  {
    date: 'APR 21, 2026',
    decoration: '/marin-marin-kitagawa.gif',
    title: 'Privacy Policy and Sync Updates',
    description: 'Added a Privacy Policy page and updated the user identity sync features.',
    tags: ['Security', 'Identity', 'Privacy', 'System']
  },
  {
    date: 'APR 21, 2026',
    title: 'YouTube Quota Limits',
    decoration: '/shigure-ui-dance.gif',
    description: 'Added error messages to tell users when the shared YouTube API quota has been reached.',
    tags: ['Bug Fix', 'System', 'YouTube']
  },
  {
    date: 'APR 21, 2026',
    featured: true,
    variant: 'core',
    decoration: '/shinepost-anime.gif',
    title: 'UI Updates',
    description: 'Updated the interface layout for mobile, desktop, and smart TVs to make navigation easier.',
    highlights: [
      'Updated Navigation Architecture',
      'Smart TV Sidebar',
      'Mobile Drawer Menu',
      'YouTube Quota Fixes'
    ],
    tags: ['Major', 'CORE', 'TV', 'UX']
  },
  {
    date: 'APR 20, 2026',
    title: 'Changelog Design',
    decoration: '/rem-transparent.gif',
    description: 'Redesigned the changelog page with a new layout and typography.',
    tags: ['UI/UX', 'System', 'Editorial']
  },
  {
    date: 'APR 20, 2026',
    featured: true,
    variant: 'youtube',
    decoration: '/anime-snow.gif',
    title: 'YouTube Features',
    description: 'Updated the YouTube player and added Google OAuth for profile syncing. Also added recommended videos and infinite scrolling.',
    highlights: [
      'Google OAuth Added',
      'Player Updates',
      'Recommended Videos',
      'Infinite Scroll'
    ],
    tags: ['Major', 'Video', 'Sync']
  },
  {
    date: 'APR 20, 2026',
    title: 'Backend Changes',
    decoration: '/anime-dance.gif',
    description: 'Updated the backend database structure for syncing user lists.',
    tags: ['Migration', 'Systems', 'Backend']
  },
  {
    date: 'APR 20, 2026',
    title: 'Automated Sync',
    decoration: '/ramen-cute-ramen.webp',
    description: 'Added a script to run every 6 hours to sync services in the background.',
    tags: ['Systems', 'Relay', 'Persistence']
  },
  {
    date: 'APR 20, 2026',
    title: 'UI Adjustments',
    decoration: '/anime-dancing.gif',
    description: 'Fixed API endpoints for production and updated the mobile header design.',
    tags: ['UI', 'Branding', 'Systems']
  },
  {
    date: 'APR 19, 2026',
    title: 'Terms of Service',
    decoration: '/among-us-imposter.gif',
    description: 'Added a Terms of Service page and links to the footer.',
    tags: ['Legal', 'System', 'Compliance']
  },
  {
    date: 'APR 19, 2026',
    title: 'Login Redirects',
    decoration: '/owo-what.webp',
    description: 'Users are now redirected to the login page if they try to save favorites while logged out.',
    tags: ['UX', 'System', 'Improvement']
  },
  {
    date: 'APR 19, 2026',
    featured: true,
    variant: 'auth',
    decoration: '/kawaii-anime.webp',
    title: 'TMDB Authentication',
    description: 'Switched to TMDB OAuth for user login and favorite syncing.',
    highlights: [
      'TMDB OAuth v4',
      'Session Management',
      'Profile Sync'
    ],
    tags: ['Auth', 'Major', 'Sync']
  },
  {
    date: 'APR 19, 2026',
    title: 'Trailers and Watchlists',
    decoration: '/oshi-no-ko-ruby.gif',
    description: 'Added features to watch trailers and save items to a TMDB watchlist.',
    tags: ['Features', 'TMDB', 'UI']
  },
  {
    date: 'APR 19, 2026',
    featured: true,
    variant: 'tmdb',
    decoration: '/asuka-anime.gif',
    title: 'Detail Page Layout',
    description: 'Updated the design of the detail pages and added horizontal scrolling lists for media.',
    highlights: [
      'Horizontal Media Lists',
      'Search Updates',
      'Image Loading Fixes'
    ],
    tags: ['Major', 'UI/UX']
  },
  {
    date: 'APR 19, 2026',
    title: 'Changelog Added',
    decoration: '/jump-happy.webp',
    description: 'Created this changelog to track site updates.',
    tags: ['Launch', 'System']
  }
];
export function Changelog() {
  return (
    <div className="max-w-[1100px] mx-auto px-6 py-20 font-serif selection:bg-accent/30 selection:text-white animate-in fade-in duration-1000 relative">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent -translate-x-1/2" />
      <header className="mb-32 border-b border-white/10 pb-10 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 uppercase tracking-[0.2em] text-[10px] font-sans font-black text-accent mb-12">
          <span className="text-accent animate-rgb-shift">Maintenance Records</span>
          <span className="opacity-40">Updated: June 20, 2026</span>
          <span className="opacity-40">Ref: MIYO-CORE-4.0</span>
        </div>
      </header>
      <div className="space-y-40 relative z-10">
        {(() => {
          let minorCounter = CHANGELOGS.filter(item => !item.featured).length;
          return CHANGELOGS.map((item, index) => {
            const isFeatured = item.featured;
            const isAlt = isFeatured
              ? true
              : (--minorCounter % 2 === 0);
            return (
              <EditorialEntry
                key={index}
                item={item}
                isAlt={isAlt}
              />
            );
          });
        })()}
      </div>
      <footer className="mt-60 pt-20 border-t border-white/5 text-center font-sans tracking-widest text-[9px] uppercase opacity-30 relative z-10">
        End of recorded history. Future chapters are being optimized.
      </footer>
    </div>
  );
}
function EditorialEntry({ item, isAlt }) {
  const { isMobile } = useDevice();
  const isFeatured = item.featured;
  return (
    <section className={cn(
      "relative group",
      isFeatured ? "z-10" : "z-0"
    )}>
      <div className={cn(
        "absolute left-1/2 -translate-x-1/2 top-8 z-20 select-none transition-all duration-700",
        isFeatured
          ? "w-4 h-4 rounded-full bg-[#111] border-2 border-accent shadow-[0_0_15px_rgba(0,242,255,0.4)]"
          : "w-2 h-2 rounded-full bg-white/40 border-none shadow-none"
      )}>
        {isFeatured && <div className="absolute inset-[3px] rounded-full bg-accent animate-rgb-shift" />}
      </div>
      <div className={cn(
        "flex flex-row gap-4 md:gap-12 items-start",
        isAlt ? "" : "flex-row-reverse"
      )}>
        <div className={cn(
          "flex-1 space-y-6",
          isFeatured ? "w-[65%] md:max-w-3xl" : "w-[65%] md:max-w-2xl",
          isAlt ? "text-left" : "text-right"
        )}>
          <div className={cn(
            "flex items-center gap-4 mb-2 font-sans font-black tracking-[0.3em] uppercase",
            isAlt ? "justify-start" : "justify-end"
          )}>
            <span className="text-[10px] text-text-secondary opacity-60">{item.date}</span>
            <div className="h-px w-6 bg-white/10" />
            <span className={cn(
              "text-[9px] tracking-[0.2em] font-black italic",
              isFeatured
                ? "text-accent animate-rgb-shift"
                : "text-text-secondary opacity-40"
            )}>
              {isFeatured ? "MAJOR" : "MINOR"}
            </span>
          </div>
          <h2 className={cn(
            "font-serif text-white tracking-tight leading-none group-hover:text-accent transition-colors duration-500",
            isFeatured ? "text-2xl md:text-6xl italic animate-rgb-shift" : "text-xl md:text-3xl opacity-80"
          )}>
            {item.title}
          </h2>
          <div className="relative">
            {isFeatured && (
              <span className="float-left text-4xl md:text-8xl font-black font-sans leading-none mr-4 mt-2 text-accent/20 animate-rgb-shift select-none">
                {item.description.charAt(0)}
              </span>
            )}
            <p className={cn(
              "text-text-muted font-serif leading-relaxed opacity-90",
              isFeatured ? "text-base md:text-xl" : "text-sm md:text-base",
              isFeatured && "whitespace-pre-line",
              isAlt ? "text-left" : "text-right"
            )}>
              {isFeatured ? item.description.slice(1) : item.description}
            </p>
          </div>
          {isFeatured && item.highlights && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 pt-10 border-t border-white/5">
              {item.highlights.map((h, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <span className="font-sans text-[9px] font-black uppercase text-accent/50 animate-rgb-shift tracking-tighter">Metric {i + 1}</span>
                  <span className="text-sm font-sans font-bold text-text-primary leading-tight uppercase tracking-tight">{h}</span>
                </div>
              ))}
            </div>
          )}
          <div className={cn(
            "flex flex-wrap gap-x-6 pt-4 font-sans text-[10px] font-black uppercase text-text-secondary tracking-widest uppercase",
            isFeatured ? "opacity-100" : "opacity-30",
            isAlt ? "justify-start" : "justify-end"
          )}>
            {item.tags.map(tag => (
              <span key={tag} className="hover:text-accent animate-rgb-shift cursor-pointer transition-all">#{tag}</span>
            ))}
          </div>
        </div>
        {item.decoration && (
          <div className={cn(
            "relative flex-shrink-0 w-[25%]",
            isFeatured ? "md:w-80 h-auto" : "h-16 md:w-40 md:h-40 transition-all"
          )}>
            <div className={cn(
              "transition-all duration-700 aspect-square flex items-center justify-center",
              isFeatured ? "rotate-2 group-hover:rotate-0" : "rotate-12 group-hover:rotate-0"
            )}>
              <img
                src={item.decoration}
                className={cn(
                  "w-full h-full object-contain select-none transition-transform duration-700 group-hover:scale-110",
                  !isFeatured && "opacity-90 group-hover:opacity-100"
                )}
                alt=""
              />
            </div>
          </div>
        )}
      </div>
      <div className="h-px w-full bg-white/10 mt-20 group-hover:bg-accent/20 transition-colors" />
    </section>
  );
}