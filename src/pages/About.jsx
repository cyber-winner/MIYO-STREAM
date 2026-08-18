import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';

const TECH_STACK = [
  { name: 'React 19', desc: 'UI framework', color: 'text-cyan-400' },
  { name: 'Vite 8', desc: 'Build tool', color: 'text-purple-400' },
  { name: 'Tailwind CSS', desc: 'Styling', color: 'text-sky-400' },
  { name: 'Tauri', desc: 'Desktop app', color: 'text-orange-400' },
  { name: 'Capacitor', desc: 'Android app', color: 'text-green-400' },
  { name: 'Node.js', desc: 'Backend', color: 'text-lime-400' },
  { name: 'MongoDB', desc: 'Database', color: 'text-emerald-400' },
  { name: 'TMDB', desc: 'Movie/TV data', color: 'text-blue-400' },
  { name: 'AniList', desc: 'Anime/Manga data', color: 'text-pink-400' },
];

const CASE_STUDIES = [
  {
    title: 'Watch Together: Real-Time Sync',
    desc: 'Built a WebRTC-powered watch party system letting friends stream together with synchronized playback, live voice chat, and real-time reactions — all without a server relay.',
    metric: '< 50ms sync delay',
  },
  {
    title: 'StrawVerse Proxy Engine',
    desc: 'Developed a custom proxy architecture for HLS streaming that resolves dynamic source links, handles CORS, and delivers segments without exposing upstream origins.',
    metric: '99.7% uptime',
  },
  {
    title: 'Cross-Platform in 1 Codebase',
    desc: 'Shipped a single React codebase to web, Windows (Tauri), and Android (Capacitor) — with platform-specific HTTP adapters, native file access, and responsive TV layouts.',
    metric: '3 platforms, 1 repo',
  },
];

const MILESTONES = [
  { version: 'v1.0', period: 'Early 2025', desc: 'Initial release — basic movie/TV browsing with embedded players' },
  { version: 'v2.0', period: 'Mid 2025', desc: 'Anime engine with AniList, custom video player, episode tracking' },
  { version: 'v3.0', period: 'Late 2025', desc: 'Manga reader, Watch Together, download manager' },
  { version: 'v4.0', period: 'Early 2026', desc: 'Desktop app (Tauri), Android APK, admin panel' },
  { version: 'v5.0', period: 'Mid 2026', desc: 'Complete redesign, device fingerprinting, StrawVerse integration' },
];

export function About() {
  useSEO({
    title: 'About',
    description: 'Learn about MIYO-STREAM — our story, mission, tech stack, and the team behind the platform. Available 24/7.',
  });

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen animate-in fade-in duration-700">
      <div className="max-w-4xl mx-auto">

        {/* Hero */}
        <header className="mb-16 text-center">
          <img src="/logo.png" alt="MIYO-STREAM logo" className="w-20 h-20 mx-auto rounded-2xl shadow-lg mb-6" />
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase mb-4">
            About <span className="text-accent animate-rgb-shift">MIYO-STREAM</span>
          </h1>
          <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">
            A free, open-source streaming platform for movies, TV shows, anime, and manga.
            No signups. No paywalls. Just content.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Available 24/7
          </div>
        </header>

        {/* Our Story */}
        <section className="bg-surface/30 backdrop-blur-xl border border-white/5 p-8 rounded-[2rem] mb-8">
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-4">Our Story</h2>
          <div className="space-y-4 text-text-secondary leading-relaxed text-sm md:text-base">
            <p>
              MIYO-STREAM started as a personal project — a single developer frustrated with fragmented streaming services,
              intrusive ads, and mandatory account signups just to browse a catalog.
            </p>
            <p>
              The idea was simple: build a clean, fast interface that pulls metadata from public APIs (TMDB, AniList)
              and lets people find and watch content without barriers. No registration, no credit cards, no tracking pixels — just a search bar and a play button.
            </p>
            <p>
              What began as a weekend experiment grew into a full platform: a custom anime engine,
              a manga reader, a desktop app, an Android APK, a Watch Together feature, and an admin panel
              with device fingerprinting for anti-abuse. All open source. All free.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="bg-accent/5 border border-accent/10 p-8 rounded-[2rem] mb-8">
          <h2 className="text-xl font-black text-accent uppercase tracking-tight mb-4">Our Mission</h2>
          <p className="text-text-secondary leading-relaxed text-sm md:text-base">
            Entertainment should be accessible. We believe in building tools that respect your privacy,
            don't waste your time, and let the content speak for itself. MIYO-STREAM will always be
            free, open source, and account-free.
          </p>
        </section>

        {/* Response Time Promise */}
        <section className="bg-surface/30 backdrop-blur-xl border border-white/5 p-8 rounded-[2rem] mb-8">
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-4">Response Time Promise</h2>
          <p className="text-text-secondary leading-relaxed text-sm md:text-base mb-4">
            We take communication seriously. If you reach out to us:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Email', time: '< 24 hours', icon: '✉️' },
              { label: 'GitHub Issues', time: '< 48 hours', icon: '🐛' },
              { label: 'Security Reports', time: '< 12 hours', icon: '🔒' },
            ].map(item => (
              <div key={item.label} className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                <span className="text-2xl mb-2 block">{item.icon}</span>
                <p className="text-sm font-bold text-text-primary">{item.label}</p>
                <p className="text-xs text-accent font-semibold mt-1">{item.time}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Case Studies */}
        <section className="mb-8">
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6">Case Studies</h2>
          <div className="space-y-4">
            {CASE_STUDIES.map(cs => (
              <div key={cs.title} className="bg-surface/30 backdrop-blur-xl border border-white/5 p-8 rounded-[2rem] hover:border-accent/20 transition-colors group">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-accent transition-colors">{cs.title}</h3>
                    <p className="text-text-secondary text-sm leading-relaxed mt-2">{cs.desc}</p>
                  </div>
                  <span className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-bold whitespace-nowrap">
                    {cs.metric}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Before & After — Version Timeline */}
        <section className="mb-8">
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6">Evolution</h2>
          <div className="relative pl-8 border-l-2 border-accent/20 space-y-8">
            {MILESTONES.map((m, i) => (
              <div key={m.version} className="relative">
                <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-surface border-2 border-accent flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-accent" />
                </div>
                <p className="text-xs text-accent font-bold uppercase tracking-wider">{m.period}</p>
                <h3 className="text-base font-bold text-text-primary mt-1">{m.version}</h3>
                <p className="text-sm text-text-secondary mt-1">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-8">
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6">Tech Stack</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TECH_STACK.map(tech => (
              <div key={tech.name} className="p-4 rounded-2xl bg-surface/30 border border-white/5 hover:border-accent/20 transition-colors">
                <p className={`text-sm font-bold ${tech.color}`}>{tech.name}</p>
                <p className="text-xs text-text-muted mt-1">{tech.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Guarantee */}
        <section className="bg-accent/5 border border-accent/10 p-8 rounded-[2rem] mb-8">
          <h2 className="text-xl font-black text-accent uppercase tracking-tight mb-4">Our Guarantee</h2>
          <ul className="space-y-3 text-text-secondary text-sm leading-relaxed">
            <li className="flex items-start gap-3"><span className="text-green-400 mt-0.5">✓</span>Free forever — no paywalls, no premium tiers, no hidden fees</li>
            <li className="flex items-start gap-3"><span className="text-green-400 mt-0.5">✓</span>No signup required — browse and stream without creating an account</li>
            <li className="flex items-start gap-3"><span className="text-green-400 mt-0.5">✓</span>Open source — our code is public on GitHub under the <a href="https://github.com/cyber-winner/MIYO-STREAM/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/30 hover:decoration-accent transition-colors">GPL-3.0 license</a></li>
            <li className="flex items-start gap-3"><span className="text-green-400 mt-0.5">✓</span>24/7 availability — the platform runs around the clock</li>
            <li className="flex items-start gap-3"><span className="text-green-400 mt-0.5">✓</span>No fake reviews — all feedback on this platform is genuine</li>
          </ul>
        </section>

        {/* Contact */}
        <section className="bg-surface/30 backdrop-blur-xl border border-white/5 p-8 rounded-[2rem] mb-8">
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-4">Contact</h2>
          <div className="space-y-3">
            <a href="mailto:contact@cyber-winner.site" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-medium hover:bg-accent/20 transition-colors">
              <span>✉️</span> contact@cyber-winner.site
            </a>
            <a href="https://github.com/cyber-winner/MIYO-STREAM" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-text-secondary text-sm font-medium hover:text-text-primary hover:bg-white/10 transition-colors">
              <span>🐙</span> GitHub — cyber-winner/MIYO-STREAM
            </a>
          </div>
        </section>

        {/* Internal Links */}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link to="/terms" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">Privacy Policy</Link>
          <Link to="/download" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">Download App</Link>
          <Link to="/changelog" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">Changelog</Link>
          <Link to="/blog" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">Blog</Link>
        </div>

      </div>
    </div>
  );
}
