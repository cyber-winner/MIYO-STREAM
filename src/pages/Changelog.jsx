import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { useDevice } from '../context/DeviceContext';
import { Badge } from '../components/ui/Badge';

/* ─── v6.0 Manga Panel Changelog Data ─── */
const V6_PANELS = [
  {
    label: '📖 Manga Scraping',
    text: 'Full manga reading experience with WeebCentral & AllManga providers. Browse, search, and read chapters in a vertical scroll reader with lazy-loading and progress tracking.',
    image: `${import.meta.env.BASE_URL}mangapanelwebp.webp`,
    accent: '#ff6b9d',
  },
  {
    label: '🎬 Multi-Provider Anime',
    text: 'Added AniNeko and AnimePahe as new anime sources alongside Anikoto. Switch providers anytime from Settings.',
    image: `${import.meta.env.BASE_URL}anime-frieren.gif`,
    accent: '#00f2ff',
  },
  {
    label: '⚙️ Provider Selector',
    text: 'New Settings UI lets you pick your default anime and manga providers. Your choice persists across sessions.',
    image: `${import.meta.env.BASE_URL}asuka-anime.gif`,
    accent: '#a78bfa',
  },
  {
    label: '🖼️ Image Proxy',
    text: 'Smart image proxy handles cross-domain manga images with automatic Referer injection for each provider.',
    image: `${import.meta.env.BASE_URL}evil-evil-lums.gif`,
    accent: '#fbbf24',
  },
  {
    label: '🔐 AES Decryption',
    text: 'AllManga chapter pages use AES-256-GCM encrypted URLs. Built-in decryption engine handles this transparently.',
    image: `${import.meta.env.BASE_URL}oshi-no-ko-onk.gif`,
    accent: '#34d399',
  },
  {
    label: '📱 Full-Screen Reader',
    text: 'Immersive manga reader renders outside the AppShell. Keyboard shortcuts, chapter navigation, and a floating progress bar.',
    image: `${import.meta.env.BASE_URL}marin-marin-kitagawa.gif`,
    accent: '#f472b6',
  },
];

/* ─── Floating decorations config ─── */
const FLOATERS = [
  { src: `${import.meta.env.BASE_URL}anime-dance.gif`, top: '5%', left: '2%', size: 80, delay: 0, rotate: -12 },
  { src: `${import.meta.env.BASE_URL}cute-pokemon.webp`, top: '15%', right: '3%', size: 70, delay: 0.5, rotate: 8 },
  { src: `${import.meta.env.BASE_URL}anime-snow.gif`, top: '35%', left: '1%', size: 90, delay: 1, rotate: -5 },
  { src: `${import.meta.env.BASE_URL}rem-transparent.gif`, top: '50%', right: '2%', size: 85, delay: 1.5, rotate: 15 },
  { src: `${import.meta.env.BASE_URL}shigure-ui-dance.gif`, top: '70%', left: '3%', size: 75, delay: 2, rotate: -8 },
  { src: `${import.meta.env.BASE_URL}dance-cute.gif`, top: '85%', right: '4%', size: 65, delay: 0.8, rotate: 10 },
  { src: `${import.meta.env.BASE_URL}transparent-hunni-hime.gif`, top: '25%', right: '1%', size: 80, delay: 1.2, rotate: -15 },
  { src: `${import.meta.env.BASE_URL}anime-transparent.gif`, top: '60%', left: '2%', size: 70, delay: 0.3, rotate: 6 },
];

/* ─── Old changelog data (pre-6.0) ─── */
const CHANGELOGS = [
  {
    date: 'JULY 21, 2026',
    featured: true,
    variant: 'core',
    decoration: `${import.meta.env.BASE_URL}logo.png`,
    title: 'v5.0.0: New Logo & Mobile App',
    description: 'Fresh new logo for MIYO — the M-play icon with the play button built in. Updated it everywhere including the favicon, app icons, and social previews. Also officially releasing the Android app, you can now sideload the APK and stream on your phone.',
    highlights: [
      'New M-Play Logo',
      'Android App Released',
      'Desktop App Updated',
      'All Icons Refreshed'
    ],
    tags: ['Major', 'CORE', 'Branding', 'Mobile']
  },
  {
    date: 'JUNE 23, 2026',
    title: 'UI Parity & Cinematic Backgrounds',
    decoration: `${import.meta.env.BASE_URL}oshi-no-ko-onk.gif`,
    description: "Turned off the smart TV detection because it was causing massive lag when navigating. TVs now get the exact same smooth UI as desktop users. Also fixed the background images on detail pages so the anime/movie backdrop covers the whole screen while you scroll.",
    tags: ['UI', 'Performance', 'Aesthetics']
  },
  {
    date: 'JUNE 20, 2026',
    title: 'v2.0.0: StrawVerse Integration & Cloudflare Tunnels',
    decoration: `${import.meta.env.BASE_URL}one-piece-hat-luffy-hat.gif`,
    description: 'Massive infrastructure rewrite. Migrated Anime scraping to a robust Express backend powered by StrawVerse architecture. Added Cloudflare Tunnel deployment support and disk-based caching for AniList GraphQL queries.',
    tags: ['Architecture', 'Cloudflare', 'StrawVerse']
  },
  {
    date: 'MAY 14, 2026',
    title: 'Manual Season Selector',
    decoration: `${import.meta.env.BASE_URL}anime-frieren.gif`,
    description: 'Added a manual season and episode selector. Users can now choose the correct TMDB source to fix mapping issues for some series.',
    tags: ['UI', 'Player', 'UX']
  },
  {
    date: 'MAY 14, 2026',
    title: 'Sync Engine Updates',
    decoration: `${import.meta.env.BASE_URL}cute-angry.gif`,
    description: 'Updated the matching system that links AniList episode names with TMDB metadata to calculate offsets for split-cours and sequels.',
    tags: ['Sync', 'Engine', 'Backend']
  },
  {
    date: 'MAY 14, 2026',
    title: 'Hide Unaired Episodes',
    decoration: `${import.meta.env.BASE_URL}akane-shinjo-anime.gif`,
    description: 'Added a check for real-time airing schedules so that unaired episodes are hidden from the UI.',
    tags: ['UI', 'Airing', 'Logic']
  },
  {
    date: 'MAY 14, 2026',
    title: 'Asset Path Fixes',
    decoration: `${import.meta.env.BASE_URL}anime-transparent.gif`,
    description: 'Fixed root-path issues for public assets like logo.png so they load correctly across the site.',
    tags: ['Fix', 'Asset', 'Branding']
  },
  {
    date: 'MAY 04, 2026',
    featured: true,
    variant: 'core',
    decoration: `${import.meta.env.BASE_URL}transparent-hunni-hime.gif`,
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
    decoration: `${import.meta.env.BASE_URL}one-piece.gif`,
    description: 'Removed YouTube integration, curated lists, user profiles, and TMDB watchlists to reduce complexity and focus on the main catalog features.',
    tags: ['Optimization', 'System', 'Cleanup']
  },
  {
    date: 'APR 27, 2026',
    featured: true,
    variant: 'core',
    decoration: `${import.meta.env.BASE_URL}frieren-popsicle.gif`,
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
    decoration: `${import.meta.env.BASE_URL}sad-eyes-sad.gif`,
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
    decoration: `${import.meta.env.BASE_URL}dance-cute.gif`,
    description: 'Added a search page to the main navigation for users on TV devices.',
    tags: ['TV', 'Discovery', 'UX']
  },
  {
    date: 'APR 24, 2026',
    title: 'System Cleanup',
    decoration: `${import.meta.env.BASE_URL}mol7ot-mol7.gif`,
    description: 'Removed old maintenance scripts and cleaned up internal code to improve performance.',
    tags: ['Optimization', 'System', 'Performance']
  },
  {
    date: 'APR 21, 2026',
    title: 'YouTube Updates',
    decoration: `${import.meta.env.BASE_URL}anime-couple.webp`,
    description: 'Updated the YouTube integration to sync data with the local database and match the layout of the main site.',
    tags: ['YouTube', 'Persistence', 'UI/UX', 'System']
  },
  {
    date: 'APR 21, 2026',
    decoration: `${import.meta.env.BASE_URL}marin-marin-kitagawa.gif`,
    title: 'Privacy Policy and Sync Updates',
    description: 'Added a Privacy Policy page and updated the user identity sync features.',
    tags: ['Security', 'Identity', 'Privacy', 'System']
  },
  {
    date: 'APR 21, 2026',
    title: 'YouTube Quota Limits',
    decoration: `${import.meta.env.BASE_URL}shigure-ui-dance.gif`,
    description: 'Added error messages to tell users when the shared YouTube API quota has been reached.',
    tags: ['Bug Fix', 'System', 'YouTube']
  },
  {
    date: 'APR 21, 2026',
    featured: true,
    variant: 'core',
    decoration: `${import.meta.env.BASE_URL}shinepost-anime.gif`,
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
    decoration: `${import.meta.env.BASE_URL}rem-transparent.gif`,
    description: 'Redesigned the changelog page with a new layout and typography.',
    tags: ['UI/UX', 'System', 'Editorial']
  },
  {
    date: 'APR 20, 2026',
    featured: true,
    variant: 'youtube',
    decoration: `${import.meta.env.BASE_URL}anime-snow.gif`,
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
    decoration: `${import.meta.env.BASE_URL}anime-dance.gif`,
    description: 'Updated the backend database structure for syncing user lists.',
    tags: ['Migration', 'Systems', 'Backend']
  },
  {
    date: 'APR 20, 2026',
    title: 'Automated Sync',
    decoration: `${import.meta.env.BASE_URL}ramen-cute-ramen.webp`,
    description: 'Added a script to run every 6 hours to sync services in the background.',
    tags: ['Systems', 'Relay', 'Persistence']
  },
  {
    date: 'APR 20, 2026',
    title: 'UI Adjustments',
    decoration: `${import.meta.env.BASE_URL}anime-dancing.gif`,
    description: 'Fixed API endpoints for production and updated the mobile header design.',
    tags: ['UI', 'Branding', 'Systems']
  },
  {
    date: 'APR 19, 2026',
    title: 'Terms of Service',
    decoration: `${import.meta.env.BASE_URL}among-us-imposter.gif`,
    description: 'Added a Terms of Service page and links to the footer.',
    tags: ['Legal', 'System', 'Compliance']
  },
  {
    date: 'APR 19, 2026',
    title: 'Login Redirects',
    decoration: `${import.meta.env.BASE_URL}owo-what.webp`,
    description: 'Users are now redirected to the login page if they try to save favorites while logged out.',
    tags: ['UX', 'System', 'Improvement']
  },
  {
    date: 'APR 19, 2026',
    featured: true,
    variant: 'auth',
    decoration: `${import.meta.env.BASE_URL}kawaii-anime.webp`,
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
    decoration: `${import.meta.env.BASE_URL}oshi-no-ko-ruby.gif`,
    description: 'Added features to watch trailers and save items to a TMDB watchlist.',
    tags: ['Features', 'TMDB', 'UI']
  },
  {
    date: 'APR 19, 2026',
    featured: true,
    variant: 'tmdb',
    decoration: `${import.meta.env.BASE_URL}asuka-anime.gif`,
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
    decoration: `${import.meta.env.BASE_URL}jump-happy.webp`,
    description: 'Created this changelog to track site updates.',
    tags: ['Launch', 'System']
  }
];

/* ═══════════════════════════════════════════
   STYLES (injected as a <style> tag)
   ═══════════════════════════════════════════ */
const mangaStyles = `
  @keyframes manga-float {
    0%, 100% { transform: translateY(0px) rotate(var(--rot, 0deg)); }
    50% { transform: translateY(-18px) rotate(calc(var(--rot, 0deg) + 3deg)); }
  }
  @keyframes manga-drift {
    0%, 100% { transform: translateX(0px) translateY(0px); }
    25% { transform: translateX(8px) translateY(-6px); }
    50% { transform: translateX(-4px) translateY(-12px); }
    75% { transform: translateX(6px) translateY(-4px); }
  }
  @keyframes speed-lines {
    0% { opacity: 0; transform: scaleX(0); }
    50% { opacity: 1; transform: scaleX(1); }
    100% { opacity: 0; transform: scaleX(0); }
  }
  @keyframes panel-reveal {
    0% { opacity: 0; transform: scale(0.85) rotate(-2deg); clip-path: inset(10% 10% 10% 10%); }
    100% { opacity: 1; transform: scale(1) rotate(0deg); clip-path: inset(0% 0% 0% 0%); }
  }
  @keyframes halftone-scroll {
    0% { background-position: 0 0; }
    100% { background-position: 50px 50px; }
  }
  @keyframes marquee-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes ink-splash {
    0% { transform: scale(0); opacity: 0.8; }
    60% { transform: scale(1.2); opacity: 0.3; }
    100% { transform: scale(1); opacity: 0; }
  }
  @keyframes glow-pulse {
    0%, 100% { filter: drop-shadow(0 0 8px var(--glow, #00f2ff)); }
    50% { filter: drop-shadow(0 0 20px var(--glow, #00f2ff)); }
  }
  .manga-hero {
    position: relative;
    overflow: hidden;
    background: #0a0a0f;
  }
  .manga-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 20% 50%, rgba(255,107,157,0.08) 0%, transparent 50%),
      radial-gradient(circle at 80% 30%, rgba(0,242,255,0.06) 0%, transparent 50%),
      radial-gradient(circle at 50% 80%, rgba(167,139,250,0.05) 0%, transparent 50%);
    z-index: 1;
  }
  .manga-hero::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 20px 20px;
    animation: halftone-scroll 8s linear infinite;
    z-index: 1;
  }
  .manga-panel-card {
    position: relative;
    border: 3px solid rgba(255,255,255,0.15);
    background: rgba(10,10,20,0.85);
    backdrop-filter: blur(12px);
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .manga-panel-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--panel-accent, #00f2ff);
    z-index: 2;
  }
  .manga-panel-card:hover {
    border-color: var(--panel-accent, #00f2ff);
    transform: translateY(-4px) scale(1.02);
    box-shadow:
      0 20px 40px rgba(0,0,0,0.5),
      0 0 30px color-mix(in srgb, var(--panel-accent, #00f2ff) 20%, transparent),
      inset 0 0 30px rgba(0,0,0,0.3);
  }
  .manga-panel-card:hover .panel-image {
    transform: scale(1.1) rotate(2deg);
    filter: brightness(1.1) saturate(1.2);
  }
  .panel-image {
    transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .manga-floater {
    position: absolute;
    pointer-events: none;
    z-index: 2;
    animation: manga-float 4s ease-in-out infinite;
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
    opacity: 0.5;
    transition: opacity 0.3s;
  }
  .manga-hero:hover .manga-floater {
    opacity: 0.75;
  }
  .speed-line {
    position: absolute;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
    animation: speed-lines 3s ease-in-out infinite;
    pointer-events: none;
  }
  .manga-marquee-track {
    display: flex;
    width: max-content;
    animation: marquee-scroll 25s linear infinite;
  }
  .manga-marquee-track:hover {
    animation-play-state: paused;
  }
  .section-divider-manga {
    position: relative;
    height: 120px;
    overflow: hidden;
    background: linear-gradient(180deg, #0a0a0f 0%, transparent 40%, transparent 60%, #0a0a0f00 100%);
  }
  .section-divider-manga::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 4px;
    background: repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 20px, transparent 20px, transparent 40px);
    transform: translateY(-50%);
  }
`;

/* ═══════════════════════════════════════════
   v6.0 MANGA PANEL HERO SECTION
   ═══════════════════════════════════════════ */
function MangaHeroSection() {
  const { isMobile } = useDevice();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="manga-hero" style={{ minHeight: '100vh' }}>
      <style>{mangaStyles}</style>

      {/* Floating anime decorations */}
      {!isMobile && FLOATERS.map((f, i) => (
        <img
          key={i}
          src={f.src}
          alt=""
          className="manga-floater"
          style={{
            top: f.top,
            left: f.left,
            right: f.right,
            width: f.size,
            height: f.size,
            '--rot': `${f.rotate}deg`,
            animationDelay: `${f.delay}s`,
            objectFit: 'contain',
          }}
        />
      ))}

      {/* Speed lines */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="speed-line"
          style={{
            top: `${15 + i * 14}%`,
            left: `${5 + (i % 3) * 10}%`,
            width: `${20 + (i % 4) * 15}%`,
            animationDelay: `${i * 0.7}s`,
          }}
        />
      ))}

      {/* Main content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-16">

        {/* ── Title Block ── */}
        <div className={cn(
          "text-center mb-8 md:mb-16 transition-all duration-1000",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}>
          {/* Top badge */}
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-[#ff6b9d] animate-pulse" />
            <span className="text-[11px] font-black tracking-[0.3em] uppercase text-white/60 font-sans">
              July 27, 2026
            </span>
            <span className="text-[11px] font-black tracking-[0.3em] uppercase text-[#ff6b9d] font-sans">
              MAJOR RELEASE
            </span>
          </div>

          {/* Giant version number */}
          <div className="relative inline-block">
            <h1 className="text-[80px] md:text-[160px] lg:text-[200px] font-black leading-none tracking-tighter font-sans"
                style={{
                  background: 'linear-gradient(135deg, #ff6b9d, #00f2ff, #a78bfa, #ff6b9d)',
                  backgroundSize: '300% 300%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'rgb-shift 4s ease infinite',
                }}>
              6.0
            </h1>
            {/* Subtitle inside */}
            <div className="absolute bottom-2 md:bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-xs md:text-lg tracking-[0.5em] uppercase font-black font-sans text-white/30">
                Manga &amp; Multi-Provider
              </span>
            </div>
          </div>
        </div>

        {/* ── Manga Panel Image + Chapter Title ── */}
        <div className={cn(
          "relative flex flex-col lg:flex-row gap-6 md:gap-10 items-center mb-12 md:mb-20 transition-all duration-1000 delay-200",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        )}>
          {/* Manga panel image */}
          <div className="relative w-full lg:w-[45%] max-w-lg">
            <div className="manga-panel-card rounded-2xl p-1" style={{ '--panel-accent': '#ff6b9d' }}>
              <img
                src={`${import.meta.env.BASE_URL}mangapanelwebp.webp`}
                alt="Manga Panel"
                className="panel-image w-full rounded-xl"
                style={{ aspectRatio: '4/5', objectFit: 'cover' }}
              />
              {/* Overlay speech bubble */}
              <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 bg-white text-black px-4 py-2 md:px-5 md:py-3 rounded-2xl rounded-br-sm shadow-xl max-w-[200px] md:max-w-[260px]">
                <p className="text-[11px] md:text-sm font-bold leading-tight font-sans">
                  "MIYO can read manga now?! This changes everything..."
                </p>
                <div className="absolute -bottom-2 right-4 w-4 h-4 bg-white rotate-45" />
              </div>
            </div>
            {/* Corner gifs */}
            <img
              src={`${import.meta.env.BASE_URL}frieren-popsicle.gif`}
              alt=""
              className="absolute -top-6 -left-6 w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-lg"
              style={{ animation: 'manga-drift 5s ease-in-out infinite' }}
            />
            <img
              src={`${import.meta.env.BASE_URL}one-piece-hat-luffy-hat.gif`}
              alt=""
              className="absolute -bottom-4 -right-4 w-14 h-14 md:w-16 md:h-16 object-contain drop-shadow-lg"
              style={{ animation: 'manga-drift 4s ease-in-out infinite', animationDelay: '1s' }}
            />
          </div>

          {/* Chapter description */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-[#ff6b9d] to-transparent" />
              <span className="text-[10px] tracking-[0.4em] uppercase font-black text-[#ff6b9d] font-sans">Chapter 6.0</span>
              <div className="h-px flex-1 bg-gradient-to-l from-[#ff6b9d] to-transparent" />
            </div>
            <h2 className="text-2xl md:text-5xl font-serif italic text-white leading-tight">
              The Manga Arc Begins
            </h2>
            <p className="text-sm md:text-lg text-white/50 leading-relaxed font-sans">
              This is the biggest update to MIYO-STREAM yet. We've added a complete manga reading
              experience with multiple providers, a full-screen vertical scroll reader, and a brand
              new multi-provider system for both anime and manga. Choose your source, pick your chapter,
              and start reading — all without leaving the app.
            </p>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
              {[
                { n: '3', label: 'Anime Sources' },
                { n: '2', label: 'Manga Sources' },
                { n: '6', label: 'New Features' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl md:text-4xl font-black font-sans animate-rgb-shift">{s.n}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/30 font-sans mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Panel Grid (manga-style comic panels) ── */}
        <div className={cn(
          "transition-all duration-1000 delay-500",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        )}>
          {/* Section header */}
          <div className="flex items-center gap-4 mb-8 md:mb-12">
            <div className="h-8 w-1 bg-gradient-to-b from-[#00f2ff] to-[#a78bfa] rounded-full" />
            <h3 className="text-lg md:text-2xl font-black tracking-tight font-sans text-white uppercase">
              What's New
            </h3>
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-black text-white/20 tracking-[0.2em] font-sans uppercase">6 Panels</span>
          </div>

          {/* Panel grid — asymmetric manga layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {V6_PANELS.map((panel, i) => (
              <div
                key={i}
                className={cn(
                  "manga-panel-card rounded-xl overflow-hidden",
                  i === 0 && "md:col-span-2 lg:col-span-2 md:row-span-2"
                )}
                style={{
                  '--panel-accent': panel.accent,
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                {/* Panel image */}
                <div className={cn(
                  "relative overflow-hidden",
                  i === 0 ? "h-48 md:h-64" : "h-32 md:h-40"
                )}>
                  <img
                    src={panel.image}
                    alt=""
                    className="panel-image w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a14] via-transparent to-transparent" />
                  {/* Panel number */}
                  <div
                    className="absolute top-3 left-3 w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black font-sans border-2"
                    style={{ borderColor: panel.accent, color: panel.accent, background: 'rgba(0,0,0,0.6)' }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>
                </div>
                {/* Panel text */}
                <div className="p-4 md:p-5 space-y-2">
                  <h4
                    className="text-sm md:text-base font-black font-sans tracking-tight"
                    style={{ color: panel.accent }}
                  >
                    {panel.label}
                  </h4>
                  <p className={cn(
                    "text-white/50 leading-relaxed font-sans",
                    i === 0 ? "text-sm" : "text-xs"
                  )}>
                    {panel.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Marquee banner ── */}
        <div className="mt-12 md:mt-20 overflow-hidden border-y border-white/10 py-4">
          <div className="manga-marquee-track">
            {Array.from({ length: 4 }).map((_, rep) => (
              <div key={rep} className="flex items-center gap-8 px-8 shrink-0">
                <img src={`${import.meta.env.BASE_URL}cute-pokemon.webp`} alt="" className="w-8 h-8 object-contain" />
                <span className="text-white/10 text-sm font-black tracking-[0.3em] uppercase font-sans whitespace-nowrap">
                  MANGA READER
                </span>
                <img src={`${import.meta.env.BASE_URL}oshi-no-ko-ruby.gif`} alt="" className="w-8 h-8 object-contain" />
                <span className="text-white/10 text-sm font-black tracking-[0.3em] uppercase font-sans whitespace-nowrap">
                  MULTI-PROVIDER
                </span>
                <img src={`${import.meta.env.BASE_URL}kawaii-anime.webp`} alt="" className="w-8 h-8 object-contain" />
                <span className="text-white/10 text-sm font-black tracking-[0.3em] uppercase font-sans whitespace-nowrap">
                  WEEBCENTRAL
                </span>
                <img src={`${import.meta.env.BASE_URL}jump-happy.webp`} alt="" className="w-8 h-8 object-contain" />
                <span className="text-white/10 text-sm font-black tracking-[0.3em] uppercase font-sans whitespace-nowrap">
                  ALLMANGA
                </span>
                <img src={`${import.meta.env.BASE_URL}ramen-cute-ramen.webp`} alt="" className="w-8 h-8 object-contain" />
                <span className="text-white/10 text-sm font-black tracking-[0.3em] uppercase font-sans whitespace-nowrap">
                  ANINEKO
                </span>
                <img src={`${import.meta.env.BASE_URL}cute-angry.gif`} alt="" className="w-8 h-8 object-contain" />
                <span className="text-white/10 text-sm font-black tracking-[0.3em] uppercase font-sans whitespace-nowrap">
                  ANIMEPAHE
                </span>
                <img src={`${import.meta.env.BASE_URL}owo-what.webp`} alt="" className="w-8 h-8 object-contain" />
                <span className="text-white/10 text-sm font-black tracking-[0.3em] uppercase font-sans whitespace-nowrap">
                  ANIKOTO
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Feature showcase strip ── */}
        <div className={cn(
          "mt-12 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 transition-all duration-1000 delay-700",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        )}>
          {[
            { img: `${import.meta.env.BASE_URL}shinepost-anime.gif`, label: 'Browse', sub: 'Discover manga' },
            { img: `${import.meta.env.BASE_URL}anime-dancing.gif`, label: 'Search', sub: 'Find anything' },
            { img: `${import.meta.env.BASE_URL}akane-shinjo-anime.gif`, label: 'Read', sub: 'Full-screen reader' },
            { img: `${import.meta.env.BASE_URL}sad-eyes-sad.gif`, label: 'Switch', sub: 'Change providers' },
          ].map((feat, i) => (
            <div key={i} className="manga-panel-card rounded-xl overflow-hidden group" style={{ '--panel-accent': ['#ff6b9d','#00f2ff','#a78bfa','#fbbf24'][i] }}>
              <div className="relative h-28 md:h-36 overflow-hidden">
                <img src={feat.img} alt="" className="panel-image w-full h-full object-cover opacity-60 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              </div>
              <div className="p-3 md:p-4 text-center -mt-8 relative z-10">
                <div className="text-base md:text-xl font-black font-sans text-white">{feat.label}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/30 font-sans">{feat.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Transition to old timeline ── */}
      <div className="relative h-32 md:h-48">
        <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-b from-transparent to-[var(--bg-primary,#0a0a0f)]" />
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-white/20" />
          <span className="text-[10px] font-black tracking-[0.4em] uppercase text-white/20 font-sans">
            Previous Versions
          </span>
          <svg className="w-4 h-4 text-white/20 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   OLD TIMELINE ENTRIES (unchanged)
   ═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════ */
export function Changelog() {
  return (
    <div className="animate-in fade-in duration-1000">
      {/* v6.0 Manga Panel Hero */}
      <MangaHeroSection />

      {/* Old timeline entries (v5.0 and below) */}
      <div className="max-w-[1100px] mx-auto px-6 py-20 font-serif selection:bg-accent/30 selection:text-white relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent -translate-x-1/2" />
        <header className="mb-32 border-b border-white/10 pb-10 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 uppercase tracking-[0.2em] text-[10px] font-sans font-black text-accent mb-12">
            <span className="text-accent animate-rgb-shift">Maintenance Records</span>
            <span className="opacity-40">Updated: July 21, 2026</span>
            <span className="opacity-40">Ref: MIYO-CORE-5.0</span>
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
    </div>
  );
}