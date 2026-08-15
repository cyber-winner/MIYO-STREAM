import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/cn';

/**
 * ApiStatusBanner — a dismissible top-of-page warning that appears when ANY
 * upstream API is down. Polls /api/health on mount and every 5 minutes.
 * Shows individual status for each service with color-coded indicators.
 */

const SERVICE_LABELS = {
  tmdb: { name: 'TMDB', desc: 'Movies & TV data may be unavailable' },
  anilist: { name: 'AniList', desc: 'Anime metadata may be outdated or missing' },
  anikoto: { name: 'Anikoto', desc: 'Anime streaming via Anikoto is affected' },
  animepahe: { name: 'AnimePahe', desc: 'Anime streaming via AnimePahe is affected' },
  anineko: { name: 'AniNeko', desc: 'Anime streaming via AniNeko is affected' },
  weebcentral: { name: 'WeebCentral', desc: 'Manga reading may be unavailable' },
};

export function ApiStatusBanner() {
  const [downServices, setDownServices] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    let interval;

    async function checkStatus() {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (!mounted) return;
        const down = Object.entries(data.services || {})
          .filter(([, svc]) => !svc.ok)
          .map(([id, svc]) => ({
            id,
            name: svc.name || SERVICE_LABELS[id]?.name || id,
            message: svc.message || '',
            desc: SERVICE_LABELS[id]?.desc || `${svc.name} is unavailable`,
          }));
        setDownServices(down);
      } catch {
        // Network error — don't show banner for local fetch issues
      }
    }

    checkStatus();
    interval = setInterval(checkStatus, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Also listen for runtime failures from api clients
  useEffect(() => {
    function handleApiDown(e) {
      const { service, message } = e.detail || {};
      if (!service) return;
      setDownServices((prev) => {
        if (prev.some((s) => s.id === service)) return prev;
        return [...prev, {
          id: service,
          name: SERVICE_LABELS[service]?.name || service,
          message: message || '',
          desc: SERVICE_LABELS[service]?.desc || `${service} is unavailable`,
        }];
      });
      setDismissed(false);
    }
    window.addEventListener('miyo-api-down', handleApiDown);
    return () => window.removeEventListener('miyo-api-down', handleApiDown);
  }, []);

  // Animate in
  useEffect(() => {
    if (downServices.length > 0 && !dismissed) {
      const t = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [downServices, dismissed]);

  if (downServices.length === 0 || dismissed) return null;

  const allDown = downServices.length >= Object.keys(SERVICE_LABELS).length;

  return (
    <div
      className={cn(
        'relative z-50 overflow-hidden transition-all duration-500 ease-out',
        visible ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      )}
    >
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-b border-amber-500/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Main row */}
          <div className="flex items-center gap-3">
            {/* Warning icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>

            {/* Summary */}
            <div className="flex-grow min-w-0">
              <p className="text-sm font-medium text-amber-200">
                {allDown
                  ? 'Multiple Services Down'
                  : `${downServices.length} ${downServices.length === 1 ? 'Service' : 'Services'} Experiencing Issues`}
              </p>
              <p className="text-xs text-amber-200/70 mt-0.5">
                {downServices.length === 1
                  ? `${downServices[0].name} — ${downServices[0].desc}. This is not a MIYO issue.`
                  : `${downServices.map((s) => s.name).join(', ')} are currently down. This is not a MIYO issue.`}
              </p>
            </div>

            {/* Expand / status dots */}
            <div className="flex-shrink-0 flex items-center gap-2">
              {downServices.length > 1 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-xs text-amber-200/60 hover:text-amber-200 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  {expanded ? 'Less' : 'Details'}
                </button>
              )}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-amber-200/60 hover:text-amber-200"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Expanded details */}
          <div
            className={cn(
              'transition-all duration-300 overflow-hidden',
              expanded ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
            )}
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {downServices.map((svc) => (
                <div
                  key={svc.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-amber-500/10"
                >
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-amber-100 truncate">
                      {svc.name}
                    </p>
                    <p className="text-[10px] text-amber-200/50 truncate" title={svc.message}>
                      {svc.message || svc.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
