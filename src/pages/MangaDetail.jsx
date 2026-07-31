import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/cn';
import { useDevice } from '../context/DeviceContext';

export function MangaDetail() {
  const { provider, id, slug } = useParams();
  const navigate = useNavigate();
  const { isMobile = false } = useDevice() || {};
  const [info, setInfo] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chaptersReversed, setChaptersReversed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const [isPosterExpanded, setIsPosterExpanded] = useState(false);

  // ─── Inline Reader State ───
  const [activeChapterIdx, setActiveChapterIdx] = useState(null);
  const [readerPages, setReaderPages] = useState([]);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState(null);
  const [readerProgress, setReaderProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const readerRef = useRef(null);
  const readerScrollRef = useRef(null);

  const decodedId = decodeURIComponent(id);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [infoData, chapData] = await Promise.all([
          api.getMangaInfo(provider, decodedId),
          api.getMangaChapters(provider, decodedId),
        ]);
        if (cancelled) return;
        setInfo(infoData);
        setChapters(chapData?.chapters || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    window.scrollTo(0, 0);
    return () => { cancelled = true; };
  }, [provider, decodedId]);

  // ─── Load chapter pages inline ───
  const openChapter = useCallback(async (chapterObj, idx) => {
    setActiveChapterIdx(idx);
    setReaderLoading(true);
    setReaderError(null);
    setReaderPages([]);
    setReaderProgress(0);
    // Scroll reader into view
    setTimeout(() => {
      readerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    try {
      const data = await api.getMangaChapterPages(provider, chapterObj.id);
      setReaderPages(Array.isArray(data) ? data : []);
    } catch (err) {
      setReaderError(err.message);
    } finally {
      setReaderLoading(false);
    }
  }, [provider]);

  // ─── Chapter navigation ───
  const hasPrevChapter = activeChapterIdx !== null && activeChapterIdx > 0;
  const hasNextChapter = activeChapterIdx !== null && activeChapterIdx < chapters.length - 1;

  const goToChapter = useCallback((idx) => {
    if (idx < 0 || idx >= chapters.length) return;
    openChapter(chapters[idx], idx);
  }, [chapters, openChapter]);

  // ─── Scroll progress tracking ───
  const handleReaderScroll = useCallback(() => {
    const el = readerScrollRef.current;
    if (!el) return;
    const scrolled = el.scrollTop;
    const total = el.scrollHeight - el.clientHeight;
    if (total > 0) setReaderProgress(Math.round((scrolled / total) * 100));
  }, []);

  // ─── Fullscreen toggle ───
  const toggleFullscreen = useCallback(() => {
    const el = readerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    if (activeChapterIdx === null) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' && hasPrevChapter) goToChapter(activeChapterIdx - 1);
      if (e.key === 'ArrowRight' && hasNextChapter) goToChapter(activeChapterIdx + 1);
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'Escape' && isFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeChapterIdx, hasPrevChapter, hasNextChapter, goToChapter, toggleFullscreen, isFullscreen]);

  const displayedChapters = chaptersReversed ? [...chapters].reverse() : chapters;
  const visibleChapters = displayedChapters.slice(0, visibleCount);
  const cover = info?.image ? api.buildProxiedImageUrl(info.image, '') : null;
  const activeChapter = activeChapterIdx !== null ? chapters[activeChapterIdx] : null;

  if (loading) return <DetailSkeleton />;
  if (error || !info) return <ErrorView error={error} />;

  return (
    <div className="animate-in fade-in duration-700">
      {/* Background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: cover ? `url('${cover}')` : undefined, filter: 'blur(40px) brightness(0.3)' }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />

      {/* Hero Section */}
      <div className={cn(
        "relative w-full text-white",
        isMobile ? "min-h-[60vh]" : "min-h-[450px]"
      )}>
        <div className={cn(
          "relative z-10 max-w-[1400px] mx-auto flex gap-10",
          isMobile ? "flex-col p-6 pt-24" : "flex-row px-10 py-12"
        )}>
          {/* Cover */}
          <div
            className="flex-shrink-0 w-[220px] group relative cursor-pointer"
            onClick={() => setIsPosterExpanded(true)}
          >
            {cover ? (
              <img
                src={cover}
                alt={info.title}
                className="rounded-xl shadow-2xl w-full aspect-[2/3] object-cover border border-white/10"
              />
            ) : (
              <div className="rounded-xl w-full aspect-[2/3] bg-surface border border-white/10 flex items-center justify-center">
                <BookIcon className="w-12 h-12 text-text-muted" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col justify-center">
            <h1 className={cn(
              "font-black mb-2 tracking-tight capitalize",
              isMobile ? "text-2xl" : "text-4xl lg:text-5xl"
            )}>
              {info.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
              <Badge variant="accent">Manga</Badge>
              {info.status && (
                <span className="border border-white/40 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">
                  {info.status}
                </span>
              )}
              {info.type && <span className="text-text-secondary">{info.type}</span>}
              {info.author && (
                <>
                  <span className="mx-1 text-text-muted">•</span>
                  <span className="text-text-secondary">{info.author}</span>
                </>
              )}
              {info.released && (
                <>
                  <span className="mx-1 text-text-muted">•</span>
                  <span className="text-text-secondary">{info.released}</span>
                </>
              )}
              {chapters.length > 0 && (
                <>
                  <span className="mx-1 text-text-muted">•</span>
                  <span className="text-text-secondary">{chapters.length} Chapters</span>
                </>
              )}
            </div>

            {/* Genres */}
            {info.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {info.genres.map(g => (
                  <span key={g} className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-bold text-text-secondary">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {info.description && (
              <div className="max-w-2xl mb-6">
                <h3 className="text-lg font-black mb-2 uppercase tracking-tight">Synopsis</h3>
                <p className="leading-relaxed text-base opacity-95 line-clamp-4 hover:line-clamp-none transition-all cursor-default">
                  {info.description}
                </p>
              </div>
            )}

            {/* Quick Read Button */}
            {chapters.length > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={() => openChapter(chapters[0], 0)}
                  className="px-6 py-3 rounded-xl font-bold text-sm cyber-gradient text-white hover:opacity-90 transition-all active:scale-95 inline-flex items-center gap-2 cursor-pointer"
                >
                  <ReadIcon className="w-4 h-4" />
                  Start Reading
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Inline Reader Section ═══ */}
      {activeChapterIdx !== null && (
        <div
          ref={readerRef}
          className={cn(
            "relative bg-black",
            isFullscreen ? "fixed inset-0 z-[60]" : "w-full"
          )}
        >
          {/* Reader Controls Bar */}
          <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-sm border-b border-white/10">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
              {/* Close reader */}
              <button
                onClick={() => {
                  setActiveChapterIdx(null);
                  setReaderPages([]);
                  if (isFullscreen) document.exitFullscreen().catch(() => {});
                }}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                title="Close reader"
              >
                <CloseIcon className="w-5 h-5" />
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  Chapter {activeChapter?.number || '?'}
                  {activeChapter?.title && activeChapter.title !== `Chapter ${activeChapter.number}` && (
                    <span className="text-white/40 ml-2 font-normal">— {activeChapter.title}</span>
                  )}
                </p>
                <p className="text-[11px] text-white/40">{readerProgress}% read • {readerPages.length} pages</p>
              </div>

              {/* Chapter nav */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => hasPrevChapter && goToChapter(activeChapterIdx - 1)}
                  disabled={!hasPrevChapter}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    hasPrevChapter ? "hover:bg-white/10 text-white" : "text-white/15 cursor-not-allowed"
                  )}
                  title="Previous Chapter (←)"
                >
                  <ChevLeftIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => hasNextChapter && goToChapter(activeChapterIdx + 1)}
                  disabled={!hasNextChapter}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    hasNextChapter ? "hover:bg-white/10 text-white" : "text-white/15 cursor-not-allowed"
                  )}
                  title="Next Chapter (→)"
                >
                  <ChevRightIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Fullscreen toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
              >
                {isFullscreen ? <ExitFullscreenIcon className="w-5 h-5" /> : <FullscreenIcon className="w-5 h-5" />}
              </button>
            </div>
            {/* Progress bar */}
            <div className="h-0.5 bg-white/5">
              <div className="h-full bg-accent transition-all duration-200 animate-rgb-shift" style={{ width: `${readerProgress}%` }} />
            </div>
          </div>

          {/* Page images */}
          <div
            ref={readerScrollRef}
            className={cn(
              "overflow-y-auto overflow-x-hidden",
              isFullscreen ? "h-[calc(100vh-56px)]" : "max-h-[85vh]"
            )}
            onScroll={handleReaderScroll}
          >
            {readerLoading ? (
              <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                  <div className="inline-block w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-white/60 text-sm">Loading chapter...</p>
                </div>
              </div>
            ) : readerError ? (
              <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 text-2xl font-bold mx-auto">!</div>
                  <p className="text-red-400 text-sm">{readerError}</p>
                  <button
                    onClick={() => activeChapter && openChapter(activeChapter, activeChapterIdx)}
                    className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-bold"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : readerPages.length === 0 ? (
              <div className="flex items-center justify-center h-[60vh]">
                <p className="text-white/60">No pages found for this chapter.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full max-w-[900px] mx-auto">
                {readerPages.map((p, i) => (
                  <MangaPage key={`${p.page}-${i}`} page={p} />
                ))}

                {/* End of chapter */}
                <div className="w-full py-12 px-6 flex flex-col items-center gap-4 border-t border-white/10">
                  <p className="text-white/40 text-sm font-bold uppercase tracking-wider">
                    End of Chapter {activeChapter?.number}
                  </p>
                  <div className="flex gap-3">
                    {hasPrevChapter && (
                      <button
                        onClick={() => goToChapter(activeChapterIdx - 1)}
                        className="px-5 py-3 rounded-xl bg-surface border border-border text-white text-sm font-bold hover:border-accent transition-all cursor-pointer"
                      >
                        ← Previous
                      </button>
                    )}
                    {hasNextChapter && (
                      <button
                        onClick={() => goToChapter(activeChapterIdx + 1)}
                        className="px-5 py-3 rounded-xl cyber-gradient text-white text-sm font-bold hover:opacity-90 transition-all cursor-pointer"
                      >
                        Next Chapter →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chapters Section */}
      <div className="max-w-[1400px] mx-auto px-5 md:px-10 py-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              Chapters
            </h2>
            <span className="text-sm text-text-muted font-bold">({chapters.length})</span>
          </div>
          <button
            onClick={() => setChaptersReversed(r => !r)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border text-text-secondary hover:text-accent hover:border-accent transition-all cursor-pointer"
          >
            {chaptersReversed ? '↑ Oldest First' : '↓ Newest First'}
          </button>
        </div>

        {chapters.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface/60 p-8 text-center">
            <p className="text-text-secondary">No chapters found for this manga.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {visibleChapters.map((ch, i) => {
              // Find the real index in the non-reversed array for chapter navigation
              const realIdx = chaptersReversed ? chapters.length - 1 - i : i;
              const isActive = activeChapterIdx === realIdx;
              return (
                <button
                  key={ch.id}
                  onClick={() => openChapter(ch, realIdx)}
                  className={cn(
                    "px-4 py-3 rounded-xl text-sm font-bold transition-all group text-left cursor-pointer",
                    isActive
                      ? "bg-accent/15 border-2 border-accent text-accent animate-rgb-shift"
                      : "bg-surface border border-border text-text-primary hover:border-accent hover:text-accent"
                  )}
                >
                  <span className="group-hover:text-accent transition-colors">
                    Ch. {ch.number}
                  </span>
                  {isActive && (
                    <span className="block text-[10px] text-accent/60 mt-0.5 uppercase tracking-wider">Reading</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {visibleCount < displayedChapters.length && (
          <div className="text-center mt-6">
            <Button variant="secondary" onClick={() => setVisibleCount(c => c + 100)}>
              Show More Chapters
            </Button>
          </div>
        )}
      </div>

      {/* Poster Expanded Modal */}
      {isPosterExpanded && cover && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer backdrop-blur-sm"
          onClick={() => setIsPosterExpanded(false)}
        >
          <img src={cover} alt={info.title} className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

/* ─── Lazy-loaded manga page image ─── */
function MangaPage({ page }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const containerRef = useRef(null);

  const referer = page.headers?.Referer || '';
  const imgSrc = api.buildProxiedImageUrl(page.img, referer);

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

/* ─── Skeleton & Error views ─── */
function DetailSkeleton() {
  return (
    <div className="px-5 md:px-10 py-12">
      <div className="flex gap-10 flex-col md:flex-row">
        <Skeleton className="w-[220px] aspect-[2/3] rounded-xl" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-3/4 rounded-lg" />
          <Skeleton className="h-6 w-1/2 rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-12 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ErrorView({ error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 text-3xl font-bold">!</div>
      <h2 className="text-2xl font-black text-white uppercase">Failed to Load</h2>
      <p className="text-red-400 font-bold max-w-md text-center">{error || 'Could not fetch manga data.'}</p>
      <button onClick={() => window.location.reload()} className="px-6 py-3 bg-accent text-white text-sm font-bold uppercase tracking-widest rounded-xl">
        Retry
      </button>
    </div>
  );
}

/* ─── Icons ─── */
function BookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ReadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function CloseIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
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

function FullscreenIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ExitFullscreenIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}
