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
                xhr.open('GET', url, true);
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
            <video
              ref={videoRef}
              className="w-full h-full rounded-2xl bg-black outline-none"
              controls
              crossOrigin="anonymous"
            >
              {subtitles?.map((sub, index) => (
                <track
                  key={index}
                  kind="subtitles"
                  label={sub.lang}
                  src={proxySubUrl(sub.url)}
                  default={index === 0}
                />
              ))}
            </video>
          ) : (
            <iframe
              src={src}
              allowFullScreen
              // Videasy detects the sandbox attribute and refuses to play, so the
              // provider iframe stays unsandboxed. In the native apps, popups and
              // redirects are blocked at the webview level instead (Tauri
              // on_navigation guard + Android WebViewClient) where providers
              // cannot detect it. YouTube keeps a sandbox since it allows it.
              {...(isYouTube ? { sandbox: 'allow-same-origin allow-scripts allow-presentation' } : {})}
              // NOTE: Do NOT add an `allow` attribute here — Videasy detects it
              // (just like sandbox) and disables its player controls (pause,
              // seek ±10s, fullscreen). Only `allowFullScreen` is safe.
              title="Media Player"
              className="w-full h-full rounded-lg"
            />
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
