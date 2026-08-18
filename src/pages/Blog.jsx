import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { cn } from '../lib/cn';

const POSTS = [
  {
    id: 'welcome',
    title: 'Welcome to MIYO-STREAM',
    date: 'June 15, 2026',
    excerpt: 'Introducing MIYO-STREAM — a free, open-source streaming platform for movies, TV, anime, and manga. No signups, no paywalls.',
    content: `MIYO-STREAM is officially live. After months of development, we're excited to open the doors to a platform built on a simple principle: entertainment should be accessible to everyone.

What makes us different? No account creation. No payment walls. No intrusive advertising. Just a search bar, a catalog powered by TMDB and AniList, and a clean, fast interface that gets out of your way.

We support Movies, TV Shows, Anime, and Manga — all from one interface. Browse trending content, search across all media types, and start watching in seconds. The platform is fully open source and available on GitHub.

This is just the beginning. We have a roadmap full of features: desktop apps, mobile apps, watch parties, and more. Stay tuned.`,
    tags: ['launch', 'announcement'],
  },
  {
    id: 'anime-engine',
    title: 'How We Built the Anime Engine',
    date: 'July 2, 2026',
    excerpt: 'A technical deep-dive into our anime streaming architecture — from AniList GraphQL queries to HLS proxy resolution and episode tracking.',
    content: `Building an anime streaming engine is fundamentally different from embedding a third-party movie player. Here's how we approached it.

The metadata layer uses AniList's GraphQL API. We query for trending, popular, and seasonal anime with a custom hook that handles pagination, caching (via SWR), and error states. Each anime detail page makes a dedicated query for episodes, characters, relations, and recommendations.

For playback, we built a custom HLS video player that resolves source links through our StrawVerse-inspired proxy engine. The proxy handles CORS headers, segment fetching, and origin obfuscation — all without storing any media files on our servers.

Episode tracking is entirely client-side. We store watch progress in localStorage, allowing users to pick up exactly where they left off. No accounts needed.

The result is a seamless anime experience that rivals dedicated anime platforms — built into a general-purpose streaming interface.`,
    tags: ['technical', 'anime'],
  },
  {
    id: 'watch-together',
    title: 'Watch Together: Stream with Friends',
    date: 'July 20, 2026',
    excerpt: 'Introducing Watch Together — create a room, share a link, and watch movies or anime in perfect sync with friends. Voice chat included.',
    content: `One of our most requested features is here: Watch Together.

Create a room, share the link, and anyone with it can join your session. Playback is synchronized in real-time — when you play, pause, seek, or switch episodes, everyone in the room follows along.

The sync engine uses WebRTC for peer-to-peer communication, which means there's no server relay adding latency. We achieve sub-50ms synchronization in most network conditions.

We also built in live voice chat powered by WebRTC audio channels. No third-party voice apps needed — just click the microphone button and talk.

The Watch Together feature works across all content types: movies, TV shows, and anime. Manga reading parties are on the roadmap.

Try it out: pick any title, click "Watch Together", and send the room link to a friend.`,
    tags: ['feature', 'social'],
  },
  {
    id: 'desktop-app',
    title: 'MIYO-STREAM Goes Desktop',
    date: 'August 1, 2026',
    excerpt: 'Announcing the MIYO-STREAM desktop app built with Tauri — native performance, tiny bundle size, and full platform integration.',
    content: `We've shipped MIYO-STREAM as a native desktop application using Tauri.

Why Tauri over Electron? Bundle size. Our Windows installer is under 8MB — compared to the 150MB+ typical of Electron apps. Tauri uses the system's native webview instead of bundling Chromium, which means lower memory usage and faster startup.

The desktop app gets the same features as the web version: full catalog browsing, video playback, anime streaming, manga reading, Watch Together, and more. But it also adds native capabilities: system notifications, local file downloads, and hardware-accelerated video.

We also ship .msi, .AppImage, .deb, and .rpm packages. The Android APK is available too, built with Capacitor from the same React codebase.

One codebase. Three platforms. Zero compromises.

Head to the Download page to grab the latest release.`,
    tags: ['release', 'desktop'],
  },
  {
    id: 'privacy-first',
    title: 'Privacy First: Our Data Philosophy',
    date: 'August 18, 2026',
    excerpt: 'An honest look at what data MIYO-STREAM collects, why we collect it, and how we protect it. No fake promises.',
    content: `We want to be transparent about data.

MIYO-STREAM collects anonymous device fingerprints for anti-abuse purposes. We hash your browser and hardware characteristics to create a non-reversible identifier that helps us detect bots, enforce rate limits, and prevent scraping attacks. This fingerprint does not identify you personally.

We also log API requests (endpoint, status, response time, IP) for 30 days to monitor platform health and detect abuse. These logs are automatically purged via TTL indexes.

What we don't do: we don't require accounts, we don't collect emails, we don't track you across the web, we don't sell data, and we don't use third-party analytics trackers. Your viewing history and preferences are stored entirely in your browser's localStorage.

Our storage buckets are private. Our codebase is public. Our privacy policy is honest.

Read the full Privacy Policy for details, or check the source code on GitHub.`,
    tags: ['privacy', 'transparency'],
  },
];

export function Blog() {
  useSEO({
    title: 'Blog',
    description: 'News, updates, and technical deep-dives from the MIYO-STREAM team.',
  });

  const [expanded, setExpanded] = useState(null);

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen animate-in fade-in duration-700">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase mb-4">
            <span className="text-accent animate-rgb-shift">Blog</span>
          </h1>
          <p className="text-text-secondary text-sm">News, updates, and behind-the-scenes from MIYO-STREAM.</p>
        </header>

        <div className="space-y-8">
          {POSTS.map((post, i) => {
            const isOpen = expanded === post.id;
            return (
              <article
                key={post.id}
                className="bg-surface/30 backdrop-blur-xl border border-white/5 rounded-[2rem] overflow-hidden hover:border-accent/20 transition-colors group"
              >
                <div className="p-8">
                  <div className="flex items-center gap-2 mb-3">
                    <time className="text-xs text-text-muted font-semibold">{post.date}</time>
                    {post.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold uppercase tracking-wider">{tag}</span>
                    ))}
                  </div>
                  <h2 className="text-xl font-black text-white mb-3 group-hover:text-accent transition-colors">{post.title}</h2>
                  <p className="text-text-secondary text-sm leading-relaxed">{post.excerpt}</p>

                  <button
                    onClick={() => setExpanded(isOpen ? null : post.id)}
                    className="mt-4 text-accent text-sm font-semibold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {isOpen ? 'Read less' : 'Read more'}
                    <svg className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  <div className={cn('overflow-hidden transition-all duration-500', isOpen ? 'max-h-[2000px] opacity-100 mt-6' : 'max-h-0 opacity-0')}>
                    <div className="prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed whitespace-pre-line border-t border-white/5 pt-6">
                      {post.content}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Internal links */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          <Link to="/about" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">About Us</Link>
          <Link to="/changelog" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">Changelog</Link>
          <Link to="/download" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">Download</Link>
        </div>
      </div>
    </div>
  );
}
