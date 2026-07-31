/**
 * Discord Activity Page
 * 
 * This page loads when MIYO runs inside a Discord Activity (embedded iframe).
 * It initializes the Discord Embedded App SDK, authenticates the user,
 * then renders the full anime player with a streamlined UI.
 * 
 * URL params:
 *   ?animeId=xxx  — Deep link to specific anime
 *   ?episode=N    — Start at specific episode
 *   ?subdub=sub   — Audio preference
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { AnimeDetail } from './AnimeDetail';

const CLIENT_ID = '1297956800427065475';

export function DiscordActivity() {
  const [sdkReady, setSdkReady] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const sdkRef = useRef(null);
  const [deepLink, setDeepLink] = useState({ animeId: null, episode: 1, subdub: 'sub' });

  useEffect(() => {
    sessionStorage.setItem('isDiscordActivity', 'true');
    initDiscordSDK();
  }, []);

  async function initDiscordSDK() {
    try {
      // Create Discord SDK instance
      const discordSdk = new DiscordSDK(CLIENT_ID);
      sdkRef.current = discordSdk;
      window.discordSdk = discordSdk;

      // Wait for SDK to be ready
      await discordSdk.ready();
      console.log('[MIYO-Activity] Discord SDK ready');

      // Authorize — get an OAuth2 code
      const { code } = await discordSdk.commands.authorize({
        client_id: CLIENT_ID,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify', 'guilds'],
      });

      // Exchange code for access token via our server
      const tokenRes = await fetch('/api/discord/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!tokenRes.ok) {
        throw new Error('Failed to exchange token');
      }

      const { access_token } = await tokenRes.json();

      // Authenticate with Discord
      const authResult = await discordSdk.commands.authenticate({ access_token });
      
      if (authResult?.user) {
        setUser(authResult.user);
        console.log(`[MIYO-Activity] Authenticated as ${authResult.user.username}`);
      }

      // Parse deep link params from the Activity URL
      // Discord Activities pass URL params through the iframe
      const params = new URLSearchParams(window.location.search);
      setDeepLink({
        animeId: params.get('animeId') || null,
        episode: parseInt(params.get('episode')) || 1,
        subdub: params.get('subdub') || 'sub',
      });

      setSdkReady(true);
      setLoading(false);

      // Subscribe to participant updates
      try {
        await discordSdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', (event) => {
          console.log('[MIYO-Activity] Participants updated:', event);
        });
      } catch (subErr) {
        // Non-critical — just log
        console.warn('[MIYO-Activity] Could not subscribe to participants:', subErr.message);
      }

    } catch (err) {
      console.error('[MIYO-Activity] SDK init error:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col items-center justify-center z-[9999]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-accent">
              <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
            </svg>
          </div>
        </div>
        <p className="mt-6 text-white/70 text-sm font-medium tracking-wide">Connecting to Discord…</p>
        <p className="mt-1 text-white/30 text-xs">MIYO Stream</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col items-center justify-center z-[9999] p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-400">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-white text-lg font-semibold mb-2">Connection Failed</h2>
          <p className="text-white/60 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Activity ready — render the MIYO player
  // If we have a deep link anime ID, render AnimeDetail directly
  // Otherwise show a search/browse interface
  if (deepLink.animeId) {
    return (
      <div className="discord-activity-wrapper">
        <style>{`
          .discord-activity-wrapper {
            position: fixed;
            inset: 0;
            background: #0a0a0f;
            overflow-y: auto;
            z-index: 9999;
          }
          /* Hide navigation and footer in Activity mode */
          .discord-activity-wrapper nav,
          .discord-activity-wrapper footer,
          .discord-activity-wrapper .bottom-nav,
          .discord-activity-wrapper .app-shell-nav {
            display: none !important;
          }
        `}</style>
        <DiscordActivityHeader user={user} />
        <AnimeDetail />
      </div>
    );
  }

  // No deep link — show a search UI
  return (
    <div className="fixed inset-0 bg-[#0a0a0f] overflow-y-auto z-[9999]">
      <DiscordActivityHeader user={user} />
      <DiscordActivitySearch sdkRef={sdkRef} />
    </div>
  );
}

// ── Header bar showing Discord user ──
function DiscordActivityHeader({ user }) {
  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-pink-500 flex items-center justify-center text-white font-bold text-sm">
          M
        </div>
        <span className="text-white font-semibold text-sm">MIYO</span>
      </div>
      <div className="flex-1" />
      {user && (
        <div className="flex items-center gap-2">
          {user.avatar && (
            <img 
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`} 
              alt="" 
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="text-white/60 text-xs">{user.username}</span>
        </div>
      )}
    </div>
  );
}

// ── Search interface for when no deep link is provided ──
function DiscordActivitySearch({ sdkRef }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState(null);

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(`/api/anime/anikoto/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data?.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
    setSearching(false);
  }, [query]);

  // If an anime is selected, navigate to it
  if (selectedAnime) {
    return (
      <div className="discord-activity-wrapper" style={{ position: 'fixed', inset: 0, background: '#0a0a0f', overflow: 'auto', zIndex: 9999 }}>
        <style>{`
          .discord-activity-wrapper nav,
          .discord-activity-wrapper footer,
          .discord-activity-wrapper .bottom-nav,
          .discord-activity-wrapper .app-shell-nav {
            display: none !important;
          }
        `}</style>
        <button
          onClick={() => setSelectedAnime(null)}
          className="fixed top-4 left-4 z-[10000] px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg backdrop-blur-xl transition-colors flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 0 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Back
        </button>
        <AnimeDetail />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-white text-xl font-bold mb-1">🎬 What do you want to watch?</h1>
      <p className="text-white/40 text-xs mb-6">Search for anime and start watching together</p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anime..."
          className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
          autoFocus
        />
        <button
          type="submit"
          disabled={searching}
          className="px-5 py-3 bg-accent hover:bg-accent/80 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results.map((anime) => (
            <button
              key={anime.id}
              onClick={() => {
                // Navigate to the anime detail page
                // In Activity mode, we'll use the React Router
                window.history.pushState({}, '', `/anime/${anime.id}`);
                setSelectedAnime(anime);
              }}
              className="group relative bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-accent/30 transition-all text-left"
            >
              <div className="aspect-[3/4] relative overflow-hidden">
                <img
                  src={anime.image || anime.poster}
                  alt={anime.title || anime.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                {anime.subOrDub && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-accent/90 text-white text-[10px] font-bold rounded-md uppercase">
                    {anime.subOrDub}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-white text-xs font-medium line-clamp-2 leading-tight">
                  {anime.title || anime.name}
                </p>
                {anime.releaseDate && (
                  <p className="text-white/30 text-[10px] mt-1">{anime.releaseDate}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {results.length === 0 && !searching && query && (
        <div className="text-center py-12">
          <p className="text-white/40 text-sm">No results found</p>
        </div>
      )}
    </div>
  );
}
