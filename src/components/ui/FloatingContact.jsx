import React, { useState } from 'react';
import { cn } from '../../lib/cn';

export function FloatingContact() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      <div
        className={cn(
          'bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-300',
          expanded ? 'opacity-100 translate-y-0 max-h-48 p-4' : 'opacity-0 translate-y-2 max-h-0 p-0 pointer-events-none'
        )}
      >
        <p className="text-xs font-bold text-text-primary mb-2">Get in touch</p>
        <a
          href="mailto:contact@tetocreations.bond"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          contact@tetocreations.bond
        </a>
        <a
          href="https://github.com/cyber-winner/TETO-STREAM"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 mt-2 rounded-xl bg-white/5 border border-border text-text-secondary text-sm font-medium hover:text-text-primary hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
          GitHub
        </a>
      </div>

      {/* FAB */}
      <button
        onClick={() => setExpanded(v => !v)}
        aria-label={expanded ? 'Close contact menu' : 'Contact us'}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 cursor-pointer active:scale-90',
          expanded
            ? 'bg-surface border border-accent text-accent rotate-45'
            : 'cyber-gradient text-white hover:opacity-90'
        )}
      >
        {expanded ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        )}
      </button>
    </div>
  );
}
