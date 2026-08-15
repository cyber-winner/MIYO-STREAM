import React, { useRef, useState, useEffect } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { useTVNavigation } from '../../hooks/useTVNavigation';
import { Sidebar } from './Sidebar';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { MenuIcon } from './NavIcons';
import { ApiStatusBanner } from '../ui/ApiStatusBanner';
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
  return (
    <div ref={containerRef} className="min-h-screen bg-transparent text-text-primary">
      <ApiStatusBanner />
      {!isDesktop && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 w-11 h-11 rounded-2xl bg-surface/80 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white shadow-lg active:scale-90 transition-all"
        >
          <MenuIcon className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}
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
          isDesktop ? 'ml-[240px]' : 'ml-0'
        )}
      >
        <main className="flex-grow">
          {children}
        </main>
        <footer
          className={cn(
            'border-t border-border py-12 px-6 flex flex-col items-center text-center bg-transparent'
          )}
        >
          <div className="mb-8">
            <a href="https://buymeachai.ezee.li/cyber_winner" target="_blank" rel="noopener noreferrer" className="inline-block transform transition-transform hover:scale-105 active:scale-95">
              <img src="https://buymeachai.ezee.li/assets/images/buymeachai-button.png" alt="Buy Me A Chai" width="200" className="rounded-lg shadow-lg" />
            </a>
          </div>
          <p className="text-text-muted text-sm">&copy; 2026 MIYO-STREAM. All Rights Reserved.</p>
          <div className="flex gap-4 mt-2">
            <Link to="/terms" className="text-text-muted/60 text-xs hover:text-accent transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="text-text-muted/60 text-xs hover:text-accent transition-colors">Privacy Policy</Link>
            <Link to="/changelog" className="text-text-muted/60 text-xs hover:text-accent transition-colors">Timeline</Link>
          </div>
          <p className="text-text-muted/60 text-xs mt-2">Data provided by TMDB & AniList.</p>
          <p className="text-text-muted/50 text-xs mt-4 max-w-xl mx-auto leading-relaxed">
            Disclaimer: MIYO-STREAM utilizes proprietary content discovery technology to index global media. 
            The platform does not host, store, or manage any raw media files directly. 
            For technical inquiries or concerns, contact{' '}
            <a href="mailto:contact@cyber-winner.site" className="text-accent underline hover:text-accent">
              contact@cyber-winner.site
            </a>.
          </p>
        </footer>
      </div>
    </div>
  );
}
