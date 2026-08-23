import React, { useRef, useState, useEffect } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { useTVNavigation } from '../../hooks/useTVNavigation';
import { Sidebar } from './Sidebar';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { MenuIcon } from './NavIcons';
import { ApiStatusBanner } from '../ui/ApiStatusBanner';
import { ScrollToTop } from '../ui/ScrollToTop';
import { FloatingContact } from '../ui/FloatingContact';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { StickyMobileCTA } from '../ui/StickyMobileCTA';

export function AppShell({ children }) {
  const { isDesktop } = useDevice();
  const containerRef = useRef(null);
  useTVNavigation(containerRef);
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  }, [location, isDesktop]);

  // Hide breadcrumbs on home page
  const showBreadcrumbs = location.pathname !== '/';

  return (
    <div ref={containerRef} className="min-h-screen bg-transparent text-text-primary">
      {/* Skip to content — visible only on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-accent focus:text-background focus:text-sm focus:font-bold focus:outline-none"
      >
        Skip to content
      </a>

      <ApiStatusBanner />

      {/* Mobile header */}
      {!isDesktop && (
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14 bg-surface/80 backdrop-blur-xl border-b border-white/5">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-90 transition-all"
          >
            <MenuIcon className="w-5 h-5 stroke-[2.5]" />
          </button>
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="TETO-STREAM logo" className="w-7 h-7 rounded-lg flex-shrink-0" loading="lazy" />
            <span className="text-base font-bold text-text-primary whitespace-nowrap">
              TETO -<span className="text-accent animate-rgb-shift">STREAM</span>
            </span>
          </Link>
        </div>
      )}

      {/* Mobile sidebar backdrop */}
      {!isDesktop && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        isDesktop={isDesktop}
        isOpen={isDesktop || isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div
        className={cn(
          'min-h-screen transition-all duration-500 flex flex-col',
          isDesktop ? 'ml-[240px]' : 'ml-0 pt-14'
        )}
      >
        {/* Breadcrumbs */}
        {showBreadcrumbs && (
          <div className="px-5 md:px-10 pt-4">
            <Breadcrumbs />
          </div>
        )}

        <main id="main-content" className="flex-grow">
          {children}
        </main>

        <footer
          className={cn(
            'border-t border-border py-12 px-6 flex flex-col items-center text-center bg-transparent'
          )}
          style={{ paddingBottom: !isDesktop ? 'calc(5rem + env(safe-area-inset-bottom, 0px))' : 'calc(3rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="mb-8">
          </div>

          {/* Visible contact email */}
          <a href="mailto:contact@tetocreations.bond" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-medium hover:bg-accent/20 transition-colors mb-6">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            contact@tetocreations.bond
          </a>

          {/* Social links */}
          <div className="flex items-center gap-4 mb-6">
            <a href="mailto:contact@tetocreations.bond" aria-label="Email" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-muted hover:text-white hover:border-accent/30 transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
            </a>
          </div>

          {/* 24/7 badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Available 24/7
          </div>

          <p className="text-text-muted text-sm">&copy; {new Date().getFullYear()} TETO-STREAM. All Rights Reserved.</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
            <Link to="/about" className="text-text-muted/60 text-xs hover:text-accent transition-colors">About</Link>
            <Link to="/blog" className="text-text-muted/60 text-xs hover:text-accent transition-colors">Blog</Link>
            <Link to="/terms" className="text-text-muted/60 text-xs hover:text-accent transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="text-text-muted/60 text-xs hover:text-accent transition-colors">Privacy Policy</Link>
            <Link to="/dmca" className="text-text-muted/60 text-xs hover:text-accent transition-colors">DMCA</Link>
            <Link to="/changelog" className="text-text-muted/60 text-xs hover:text-accent transition-colors">Timeline</Link>
            <Link to="/download" className="text-text-muted/60 text-xs hover:text-accent transition-colors">Download App</Link>
            <a href="https://github.com/cyber-winner/TETO-STREAM" target="_blank" rel="noopener noreferrer" className="text-text-muted/60 text-xs hover:text-accent transition-colors">GitHub</a>
          </div>
          <p className="text-text-muted/60 text-xs mt-2">Data provided by TMDB &amp; AniList.</p>
          <p className="text-text-muted/50 text-xs mt-4 max-w-xl mx-auto leading-relaxed">
            Disclaimer: TETO-STREAM collects anonymous device data for anti-abuse and platform security.
            We use third-party APIs (TMDB, AniList) for content metadata. No signup required.
            For inquiries, contact{' '}
            <a href="mailto:contact@tetocreations.bond" className="text-accent underline hover:text-accent">
              contact@tetocreations.bond
            </a>.
          </p>
          {typeof __TETO_BUILD_DATE__ !== 'undefined' && (
            <p className="text-text-muted/40 text-[10px] mt-3">
              Last updated: {__TETO_BUILD_DATE__}
            </p>
          )}
        </footer>
      </div>

      {/* Floating UI */}
      <FloatingContact />
      <ScrollToTop />
      <StickyMobileCTA />
    </div>
  );
}
