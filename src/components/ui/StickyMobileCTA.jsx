import React from 'react';
import { Link } from 'react-router-dom';
import { useDevice } from '../../context/DeviceContext';

export function StickyMobileCTA() {
  const { isDesktop } = useDevice();

  if (isDesktop) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 py-3 bg-surface/90 backdrop-blur-xl border-t border-white/5" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex gap-3">
        <Link
          to="/search"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-text-primary active:scale-95 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search
        </Link>
        <Link
          to="/download"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl cyber-gradient text-sm font-bold text-white active:scale-95 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Get App
        </Link>
      </div>
    </div>
  );
}
