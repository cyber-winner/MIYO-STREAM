import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { cn } from '../lib/cn';

export function MangaReader() {
  const { provider, chapterId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mangaId = searchParams.get('manga') || '';
  const chapterIndex = parseInt(searchParams.get('ch') || '0');
  const decodedChapterId = decodeURIComponent(chapterId);
  const decodedMangaId = decodeURIComponent(mangaId);

  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(chapterIndex);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const controlsTimer = useRef(null);
  const containerRef = useRef(null);

  // Load chapters list for navigation
  useEffect(() => {
    if (!decodedMangaId) return;
    api.getMangaChapters(provider, decodedMangaId)
      .then(data => setChapters(data?.chapters || []))
      .catch(() => {});
  }, [provider, decodedMangaId]);

  // Load chapter pages
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setPages([]);
      setProgress(0);
      try {
        const data = await api.getMangaChapterPages(provider, decodedChapterId);
        if (cancelled) return;
        setPages(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    // Scroll to top when chapter changes
    if (containerRef.current) containerRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
    return () => { cancelled = true; };
  }, [provider, decodedChapterId]);

  // Track scroll progress
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const scrolled = el.scrollTop;
    const total = el.scrollHeight - el.clientHeight;
    if (total > 0) setProgress(Math.round((scrolled / total) * 100));
  }, []);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    return () => clearTimeout(controlsTimer.current);
  }, []);

  const currentChapter = chapters[currentChapterIdx];
  const hasPrev = currentChapterIdx > 0;
  const hasNext = currentChapterIdx < chapters.length - 1;

  const navigateChapter = (idx) => {
    if (idx < 0 || idx >= chapters.length) return;
    const ch = chapters[idx];
    setCurrentChapterIdx(idx);
    navigate(
      `/manga/reader/${provider}/${encodeURIComponent(ch.id)}?manga=${encodeURIComponent(decodedMangaId)}&ch=${idx}`,
      { replace: true }
    );
  };

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' && hasPrev) navigateChapter(currentChapterIdx - 1);
      if (e.key === 'ArrowRight' && hasNext) navigateChapter(currentChapterIdx + 1);
      if (e.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasPrev, hasNext, currentChapterIdx, chapters]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top Bar */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-20 transition-all duration-300",
          showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
        )}
      >
        <div className="bg-gradient-to-b from-black/90 to-transparent px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              Chapter {currentChapter?.number || '?'}
            </p>
            <p className="text-xs text-white/60">{progress}% read</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => hasPrev && navigateChapter(currentChapterIdx - 1)}
              disabled={!hasPrev}
              className={cn(
                "p-2 rounded-lg transition-colors",
                hasPrev ? "hover:bg-white/10 text-white" : "text-white/20 cursor-not-allowed"
              )}
              title="Previous Chapter"
            >
              <ChevLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => hasNext && navigateChapter(currentChapterIdx + 1)}
              disabled={!hasNext}
              className={cn(
                "p-2 rounded-lg transition-colors",
                hasNext ? "hover:bg-white/10 text-white" : "text-white/20 cursor-not-allowed"
              )}
              title="Next Chapter"
            >
              <ChevRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-white/10">
          <div className="h-full bg-accent transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Reading Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onScroll={handleScroll}
        onClick={showControlsTemporarily}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-white/60 text-sm">Loading chapter...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 text-2xl font-bold mx-auto">!</div>
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-bold">
                Retry
              </button>
            </div>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/60">No pages found for this chapter.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full max-w-[900px] mx-auto">
            {pages.map((p, i) => (
              <MangaPage
                key={`${p.page}-${i}`}
                page={p}
                index={i}
              />
            ))}

            {/* End of chapter navigation */}
            <div className="w-full py-12 px-6 flex flex-col items-center gap-4">
              <p className="text-white/40 text-sm font-bold uppercase tracking-wider">End of Chapter {currentChapter?.number}</p>
              <div className="flex gap-3">
                {hasPrev && (
                  <button
                    onClick={() => navigateChapter(currentChapterIdx - 1)}
                    className="px-5 py-3 rounded-xl bg-surface border border-border text-white text-sm font-bold hover:border-accent transition-all"
                  >
                    ← Previous
                  </button>
                )}
                {hasNext && (
                  <button
                    onClick={() => navigateChapter(currentChapterIdx + 1)}
                    className="px-5 py-3 rounded-xl cyber-gradient text-white text-sm font-bold hover:opacity-90 transition-all"
                  >
                    Next Chapter →
                  </button>
                )}
              </div>
              <Link
                to={`/manga/read/${provider}/${encodeURIComponent(decodedMangaId)}`}
                className="text-accent text-sm font-bold hover:underline mt-2"
              >
                Back to Chapter List
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MangaPage({ page, index }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const referer = page.headers?.Referer || '';
  const imgSrc = api.buildMangaImageUrl(page.img, referer);

  // Lazy loading with IntersectionObserver
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '500px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full relative"
      style={{ minHeight: loaded ? undefined : '50vh' }}
    >
      {isVisible && !errored && (
        <img
          ref={imgRef}
          src={imgSrc}
          alt={`Page ${page.page}`}
          className={cn(
            "w-full h-auto transition-opacity duration-300 select-none",
            loaded ? "opacity-100" : "opacity-0"
          )}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          draggable={false}
        />
      )}
      {isVisible && !loaded && !errored && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/5">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {errored && (
        <div className="w-full h-[50vh] flex items-center justify-center bg-white/5">
          <div className="text-center space-y-2">
            <p className="text-white/40 text-sm">Page {page.page} failed to load</p>
            <button
              onClick={() => { setErrored(false); setLoaded(false); }}
              className="text-accent text-xs font-bold hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BackIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevLeftIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevRightIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
