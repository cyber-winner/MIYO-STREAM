import React, { useState, useEffect } from 'react';
import { getPlatform, isNative, getTmdbApiKey, setTmdbApiKey, isUsingDefaultTmdbKey } from '../platform/index.js';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { useSEO } from '../hooks/useSEO';

const PLATFORM_LABELS = {
  web: 'Website',
  tauri: 'Desktop App',
  capacitor: 'Android App',
};

export function Settings() {
  useSEO({ title: 'Settings', description: 'Configure your MIYO-STREAM experience. Set API keys, choose providers, and manage preferences.' });
  const platform = getPlatform();
  const native = isNative();
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(null); // null | 'testing' | 'valid' | 'invalid' | 'saved'
  const [devMode, setDevMode] = useState(() => {
    try { return !!localStorage.getItem('miyo_dev_mode'); } catch { return false; }
  });

  useEffect(() => {
    const existing = getTmdbApiKey();
    const usingBuiltin = isUsingDefaultTmdbKey();
    // Never show the built-in key in the input field
    setApiKey(usingBuiltin ? '' : existing);
    setSavedKey(usingBuiltin ? '' : existing);
  }, []);

  // Provider selectors
  const [animeProviders, setAnimeProviders] = useState([]);
  const [mangaProviders, setMangaProviders] = useState([]);
  const [animeProvider, setAnimeProvider] = useState(() => {
    try { return localStorage.getItem('miyo-anime-provider') || 'anikoto'; } catch { return 'anikoto'; }
  });
  const [mangaProvider, setMangaProvider] = useState(() => {
    try { return localStorage.getItem('miyo-manga-provider') || 'weebcentral'; } catch { return 'weebcentral'; }
  });

  useEffect(() => {
    api.getProviders?.().then(data => setAnimeProviders(data?.providers || [])).catch(() => {});
    api.getMangaProviders?.().then(data => setMangaProviders(data?.providers || [])).catch(() => {});
  }, []);

  const handleAnimeProviderChange = (name) => {
    setAnimeProvider(name);
    try { localStorage.setItem('miyo-anime-provider', name); } catch {}
  };
  const handleMangaProviderChange = (name) => {
    setMangaProvider(name);
    try { localStorage.setItem('miyo-manga-provider', name); } catch {}
  };

  const handleSave = async () => {
    const key = apiKey.trim();
    if (!key) {
      setTmdbApiKey('');
      setSavedKey('');
      setStatus(null);
      return;
    }
    setStatus('testing');
    try {
      // Validate the key against TMDB before saving
      const { platformFetch } = await import('../platform/index.js');
      const res = await platformFetch(
        `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        setTmdbApiKey(key);
        setSavedKey(key);
        setStatus('valid');
      } else {
        setStatus('invalid');
      }
    } catch {
      // Network error — save anyway, the key may still be fine offline
      setTmdbApiKey(key);
      setSavedKey(key);
      setStatus('saved');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-10 md:py-16">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight text-balance">
          Set<span className="text-accent animate-rgb-shift">tings</span>
        </h1>
        <p className="text-text-secondary mt-2 leading-relaxed">
          Configure your MIYO-STREAM experience.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border">
          <span className="w-2 h-2 rounded-full rgb-pattern-bg" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Running as: <span className="text-accent animate-rgb-shift">{PLATFORM_LABELS[platform] || platform}</span>
          </span>
        </div>
      </header>

      {!native && (
        <section className="rounded-2xl border border-border bg-surface/60 p-6 mb-8">
          <h2 className="text-lg font-bold text-text-primary mb-2">You&apos;re on the website</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            No configuration is needed here — the website handles TMDB, AniList, and streaming
            through its own server. The settings below only apply to the{' '}
            <span className="text-accent font-semibold">desktop and Android apps</span>, which run
            fully locally on your device.
          </p>
        </section>
      )}

      {/* ── Provider Selectors ── */}
      <section className="rounded-2xl border border-border bg-surface/60 p-6 mb-8">
        <h2 className="text-lg font-bold text-text-primary mb-1">
          <span className="text-accent animate-rgb-shift">Anime</span> Provider
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          Choose which source to use for streaming anime episodes. Default is <span className="text-accent font-semibold">anikoto</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          {animeProviders.length > 0 ? animeProviders.map(p => (
            <button
              key={p.name}
              onClick={() => handleAnimeProviderChange(p.name)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-bold transition-all border cursor-pointer',
                animeProvider === p.name
                  ? 'bg-accent/10 border-accent text-accent animate-rgb-shift'
                  : 'bg-transparent border-border text-text-secondary hover:bg-white/5 hover:text-text-primary'
              )}
            >
              {p.name}
              <span className="ml-1.5 text-[10px] text-text-muted">v{p.version}</span>
            </button>
          )) : (
            <span className="text-sm text-text-muted">Loading providers...</span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-6 mb-8">
        <h2 className="text-lg font-bold text-text-primary mb-1">
          <span className="text-accent animate-rgb-shift">Manga</span> Provider
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          Choose which source to use for reading manga chapters. Default is <span className="text-accent font-semibold">weebcentral</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          {mangaProviders.length > 0 ? mangaProviders.map(p => (
            <button
              key={p.name}
              onClick={() => handleMangaProviderChange(p.name)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-bold transition-all border cursor-pointer',
                mangaProvider === p.name
                  ? 'bg-accent/10 border-accent text-accent animate-rgb-shift'
                  : 'bg-transparent border-border text-text-secondary hover:bg-white/5 hover:text-text-primary'
              )}
            >
              {p.name}
              <span className="ml-1.5 text-[10px] text-text-muted">v{p.version}</span>
            </button>
          )) : (
            <span className="text-sm text-text-muted">Loading providers...</span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-6 mb-8">
        <h2 className="text-lg font-bold text-text-primary mb-1">
          TMDB <span className="text-accent animate-rgb-shift">API Key</span>
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          The native apps talk to TMDB directly from your device, so they need an API key.
          A shared key is included by default — add your own free key for a better experience.
        </p>

        {isUsingDefaultTmdbKey() && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rating/10 border border-rating/30">
            <p className="text-sm text-rating font-semibold">⚠ Using shared default key</p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              MIYO includes a shared TMDB key so the app works out of the box. This key is
              shared across all users and <span className="text-text-primary font-semibold">will hit rate limits</span> during
              peak usage (slow/missing movie metadata). Get your own free key below for the best experience.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setStatus(null); }}
              placeholder="Paste your TMDB API key (v3)"
              autoComplete="off"
              spellCheck={false}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-background border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={status === 'testing'}
            className={cn(
              'px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95',
              'cyber-gradient text-white hover:opacity-90 disabled:opacity-50'
            )}
          >
            {status === 'testing' ? 'Verifying...' : 'Save Key'}
          </button>
        </div>

        {status === 'valid' && (
          <p className="mt-3 text-sm text-green-400 font-medium">
            Key verified and saved. You&apos;re all set!
          </p>
        )}
        {status === 'saved' && (
          <p className="mt-3 text-sm text-rating font-medium">
            Key saved, but it could not be verified right now (network issue). It will be used on the next request.
          </p>
        )}
        {status === 'invalid' && (
          <p className="mt-3 text-sm text-red-400 font-medium">
            TMDB rejected this key. Double-check you copied the &quot;API Key&quot; (v3 auth), not the Read Access Token.
          </p>
        )}
        {savedKey && status === null && (
          <p className="mt-3 text-sm text-text-muted">A key is currently saved on this device.</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">
          How to get a <span className="text-accent animate-rgb-shift">free TMDB API key</span>
        </h2>
        <ol className="space-y-4">
          {[
            {
              title: 'Create a TMDB account',
              body: (
                <>
                  Go to{' '}
                  <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:opacity-80">
                    themoviedb.org/signup
                  </a>{' '}
                  and sign up. It&apos;s completely free.
                </>
              ),
            },
            {
              title: 'Verify your email',
              body: 'Click the verification link TMDB sends you, then log in.',
            },
            {
              title: 'Open the API settings page',
              body: (
                <>
                  Go to{' '}
                  <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:opacity-80">
                    themoviedb.org/settings/api
                  </a>{' '}
                  (Profile → Settings → API).
                </>
              ),
            },
            {
              title: 'Request an API key',
              body: (
                <>
                  Click <span className="text-text-primary font-semibold">&quot;Create&quot;</span> and choose{' '}
                  <span className="text-text-primary font-semibold">&quot;Developer&quot;</span>. Accept the terms.
                  For the form: use &quot;Personal&quot; as the type of use, and you can enter &quot;Personal media app&quot;
                  as the application name and description. Any personal URL (or N/A) works.
                </>
              ),
            },
            {
              title: 'Copy the API Key (v3 auth)',
              body: (
                <>
                  On the API page, copy the value labeled{' '}
                  <span className="text-text-primary font-semibold">&quot;API Key&quot;</span> — a 32-character string of
                  letters and numbers. Do <span className="text-text-primary font-semibold">not</span> use the longer
                  &quot;API Read Access Token&quot;.
                </>
              ),
            },
            {
              title: 'Paste it above and hit Save',
              body: 'The app verifies the key with TMDB and stores it locally on your device.',
            },
          ].map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/15 border border-accent/40 text-accent animate-rgb-shift text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary">{step.title}</p>
                <p className="text-sm text-text-secondary leading-relaxed mt-0.5">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            <span className="text-accent font-bold">Note:</span> AniList and anime streaming work
            without any key — only movie &amp; TV show data (posters, details, search) requires the
            TMDB key.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-6 mt-8">
        <h2 className="text-lg font-bold text-text-primary mb-4">
          <span className="text-accent animate-rgb-shift">About</span>
        </h2>
        <dl className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <dt className="text-sm font-semibold text-text-muted sm:w-24 flex-shrink-0">Author</dt>
            <dd className="text-sm text-accent animate-rgb-shift font-semibold">CYBER</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <dt className="text-sm font-semibold text-text-muted sm:w-24 flex-shrink-0">Contact</dt>
            <dd className="text-sm">
              <a
                href="mailto:contact@cyber-winner.site"
                className="text-accent underline underline-offset-2 hover:opacity-80"
              >
                contact@cyber-winner.site
              </a>
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <dt className="text-sm font-semibold text-text-muted sm:w-24 flex-shrink-0">Website</dt>
            <dd className="text-sm">
              <a
                href="https://cyber-winner.site"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2 hover:opacity-80"
              >
                cyber-winner.site
              </a>
            </dd>
          </div>
        </dl>
      </section>

      {/* Developer Mode — native apps only */}
      {native && (
        <section className="rounded-2xl border border-border bg-surface/60 p-6 mt-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                Developer <span className="text-accent animate-rgb-shift">Mode</span>
              </h2>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                Show a <span className="text-text-primary font-semibold">DevConsole</span> tab in the menu to view live errors, warnings, and logs from the app.
              </p>
            </div>
            <button
              onClick={() => {
                const next = !devMode;
                setDevMode(next);
                try { localStorage.setItem('miyo_dev_mode', next ? '1' : ''); } catch {}
                window.dispatchEvent(new CustomEvent('miyo-devmode', { detail: { enabled: next } }));
              }}
              className={cn(
                'relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 cursor-pointer',
                devMode ? 'bg-accent' : 'bg-border'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200',
                devMode && 'translate-x-5'
              )} />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function EyeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
