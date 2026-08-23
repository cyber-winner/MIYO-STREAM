import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/cn';

const STORAGE_KEY = 'miyo_cookie_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Small delay so it doesn't flash on first paint
        const t = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[9997] px-4 pb-4 pt-0 pointer-events-none',
        'animate-slide-up'
      )}
    >
      <div className="max-w-xl mx-auto pointer-events-auto bg-surface border border-border rounded-2xl px-5 py-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-sm text-text-secondary leading-relaxed flex-1">
          TETO-STREAM uses local storage for preferences and collects anonymous device data for platform security.{' '}
          <a href="/privacy" className="text-accent underline underline-offset-2 hover:opacity-80">Privacy Policy</a>
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 px-5 py-2 rounded-xl text-sm font-bold cyber-gradient text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
