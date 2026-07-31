import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { cn } from '../../lib/cn';
import { isNative } from '../../platform/index.js';
export function VideoPlayer({ src, isHls, subtitles, className }) {
  const [adWarningVisible, setAdWarningVisible] = useState(true);
  const isYouTube = !isHls && (src?.includes('youtube.com') || src?.includes('youtube-nocookie.com') || src?.includes('youtu.be'));
  const videoRef = useRef(null);
  const [cleanSrc, setCleanSrc] = useState('');
  const [referer, setReferer] = useState('');
  const [nativeSubUrls, setNativeSubUrls] = useState({});
  useEffect(() => {
    if (src?.includes('#referer=')) {
      const parts = src.split('#referer=');
      setCleanSrc(parts[0]);
      setReferer(decodeURIComponent(parts[1]));
    } else {
      setCleanSrc(src || '');
      setReferer('');
    }
  }, [src]);
  useEffect(() => {
    if (isHls && cleanSrc && videoRef.current) {
      // Bypass HLS.js for direct MP4/WEBM video files
      if (cleanSrc.endsWith('.mp4') || cleanSrc.endsWith('.webm')) {
        videoRef.current.src = cleanSrc;
        return;
      }

      if (Hls.isSupported()) {
        let hls;
        let cancelled = false;
        if (isNative()) {
          // Native apps: fetch playlists/segments through the native HTTP
          // client with the correct Referer headers (no proxy server).
          import('../../platform/hlsLoader.js').then(({ createNativeHlsLoaderClass }) => {
            if (cancelled || !videoRef.current) return;
            hls = new Hls({ loader: createNativeHlsLoaderClass(referer) });
            // If playback can't start (network/CORS/codec), don't spin
            // forever — tell the page so it can fall back to the embed player.
            hls.on(Hls.Events.ERROR, (_evt, errData) => {
              console.error('[VideoPlayer] HLS error:', errData?.type, errData?.details, errData?.fatal);
              if (errData?.fatal) {
                try { hls.destroy(); } catch (e) {}
                window.dispatchEvent(new CustomEvent('miyo-hls-fatal', {
                  detail: { type: errData.type, details: errData.details },
                }));
              }
            });
            hls.loadSource(cleanSrc);
            hls.attachMedia(videoRef.current);
          });
        } else {
          hls = new Hls({
            xhrSetup: function(xhr, url) {
              if (url.includes('/api/proxy')) {
                const searchIdx = url.indexOf('?');
                if (searchIdx !== -1) {
                  xhr.open('GET', '/api/proxy' + url.substring(searchIdx), true);
                } else {
                  xhr.open('GET', url, true);
                }
              } else {
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
                xhr.open('GET', proxyUrl, true);
              }
            }
          });
          hls.loadSource(cleanSrc);
          hls.attachMedia(videoRef.current);
        }
        return () => {
          cancelled = true;
          if (hls) hls.destroy();
        };
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = cleanSrc;
      }
    }
  }, [cleanSrc, isHls, referer]);
  // Native apps: fetch subtitles through the native HTTP client and expose
  // them as blob: URLs (the <track> element can't send Referer headers).
  useEffect(() => {
    if (!isNative() || !subtitles?.length) return;
    let cancelled = false;
    const created = [];
    import('../../platform/hlsLoader.js').then(async ({ fetchSubtitleAsBlobUrl }) => {
      const map = {};
      await Promise.all(subtitles.map(async (sub) => {
        if (!sub?.url) return;
        try {
          const blobUrl = await fetchSubtitleAsBlobUrl(sub.url, referer);
          created.push(blobUrl);
          map[sub.url] = blobUrl;
        } catch (e) {
          console.warn('[VideoPlayer] Failed to fetch subtitle natively:', e?.message);
        }
      }));
      if (!cancelled) setNativeSubUrls(map);
    });
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
      setNativeSubUrls({});
    };
  }, [subtitles, referer]);
  // Helper: proxy a subtitle URL through the backend (web) or use the
  // natively-fetched blob URL (native apps)
  const proxySubUrl = (url) => {
    if (!url) return '';
    if (isNative()) return nativeSubUrls[url] || '';
    return `/api/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
  };
  return (
    <div className={cn("space-y-4", className)}>
      {adWarningVisible && !isYouTube && !isHls && (
        <div className="flex items-start justify-between bg-transparent border border-accent/30 bg-accent/5 rounded-xl px-4 py-4 mb-4 animate-scale-in">
          <div className="flex items-start gap-3 min-w-0">
            <WarningIcon className="w-6 h-6 text-rating flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              {isNative() ? (
                <>
                  <p className="text-sm text-text-primary font-bold mb-1 uppercase tracking-tight">Ad Protection Active</p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Pop-up ads and redirects from the player are <span className="text-accent font-bold">blocked by the app</span>.
                    If an ad appears inside the video frame, just close it — it cannot open a browser or leave MIYO.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-text-primary font-bold mb-1 uppercase tracking-tight">Security & Ad Notice</p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Our providers have blocked us from using iframe sandboxing. Therefore, when you click the player, there is a high chance of pop-up ads. To block ads, we recommend using{' '}
                    <span className="text-accent font-bold">Brave Browser</span> or the{' '}
                    <a
                      href="https://ublockorigin.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:opacity-80 underline underline-offset-2"
                    >
                      uBlock Origin
                    </a>{' '}
                    extension — or use the <span className="text-accent font-bold">MIYO desktop/mobile app</span>, which blocks ads automatically.
                  </p>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setAdWarningVisible(false)}
            className="text-text-muted hover:text-text-primary ml-3 flex-shrink-0 transition-colors mt-1"
            aria-label="Dismiss"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="relative group">
        <div className="player-container">
          {isHls ? (
            <div className="relative w-full h-full flex flex-col gap-2">
              <div className="flex justify-end">
                <button
                  onClick={(e) => {
                    if (sessionStorage.getItem('isDiscordActivity') && window.discordSdk) {
                      e.preventDefault();
                      window.discordSdk.commands.openExternalLink({ url: cleanSrc });
                    } else {
                      window.open(cleanSrc, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="px-3 py-1.5 bg-accent/20 text-accent font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-accent hover:text-black transition-colors border border-accent/30 flex items-center gap-1.5 w-max"
                >
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                  Blank Player? Open in Browser
                </button>
              </div>
              <div className="flex-1 w-full relative group/player">
                <video
                  ref={videoRef}
                  className="w-full h-full rounded-2xl bg-black outline-none absolute inset-0"
                  controls
                  crossOrigin="anonymous"
                  onError={(e) => {
                    const srcUrl = cleanSrc || '';
                    if (srcUrl.startsWith('capacitor://') || srcUrl.startsWith('asset://') || srcUrl.startsWith('http://localhost') || srcUrl.endsWith('.mp4') || srcUrl.endsWith('.ts')) {
                      console.error('[VideoPlayer] Local file playback failed:', e.target.error);
                      window.dispatchEvent(new CustomEvent('miyo-local-fatal'));
                    }
                  }}
                >
                {subtitles?.map((sub, index) => {
                  const resolvedUrl = proxySubUrl(sub.url);
                  return (
                    <track
                      key={`${index}-${resolvedUrl}`}
                      kind="subtitles"
                      label={sub.lang}
                      src={resolvedUrl}
                      default={index === 0}
                    />
                  );
                })}
              </video>
              {/* Custom CC Button overlay */}
              {subtitles && subtitles.length > 0 && (
                <div className="absolute top-4 right-4 z-10 opacity-0 group-hover/player:opacity-100 transition-opacity">
                  <select
                    className="bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 backdrop-blur-md outline-none cursor-pointer appearance-none"
                    onChange={(e) => {
                      const idx = parseInt(e.target.value, 10);
                      const tracks = videoRef.current?.textTracks;
                      if (!tracks) return;
                      for (let i = 0; i < tracks.length; i++) {
                        tracks[i].mode = (i === idx) ? 'showing' : 'disabled';
                      }
                    }}
                    defaultValue="0"
                  >
                    <option value="-1">CC: Off</option>
                    {subtitles.map((sub, i) => (
                      <option key={i} value={i}>CC: {sub.lang}</option>
                    ))}
                  </select>
                </div>
              )}
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col gap-2">
              <div className="flex justify-end">
                <button
                  onClick={(e) => {
                    if (sessionStorage.getItem('isDiscordActivity') && window.discordSdk) {
                      e.preventDefault();
                      window.discordSdk.commands.openExternalLink({ url: src });
                    } else {
                      window.open(src, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="px-3 py-1.5 bg-accent/20 text-accent font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-accent hover:text-black transition-colors border border-accent/30 flex items-center gap-1.5 w-max"
                >
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                  Blank Player? Open in Browser
                </button>
              </div>
              <div className="flex-1 min-h-[300px] w-full relative">
                <iframe
                  src={src}
                  allowFullScreen
                  {...(isYouTube ? { sandbox: 'allow-same-origin allow-scripts allow-presentation' } : {})}
                  title="Media Player"
                  className="w-full h-full rounded-lg absolute inset-0"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function WarningIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function XIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function ExternalLinkIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
function DownloadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
