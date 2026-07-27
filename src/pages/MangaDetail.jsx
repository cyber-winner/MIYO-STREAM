import React, { useState, useEffect, useRef } from 'react';
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

  const displayedChapters = chaptersReversed ? [...chapters].reverse() : chapters;
  const visibleChapters = displayedChapters.slice(0, visibleCount);
  const cover = info?.image ? api.buildMangaImageUrl(info.image, '') : null;

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
                <Link
                  to={`/manga/reader/${provider}/${encodeURIComponent(chapters[0].id)}?manga=${encodeURIComponent(decodedId)}&ch=0`}
                  className="px-6 py-3 rounded-xl font-bold text-sm cyber-gradient text-white hover:opacity-90 transition-all active:scale-95 inline-flex items-center gap-2"
                >
                  <ReadIcon className="w-4 h-4" />
                  Start Reading
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

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
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border text-text-secondary hover:text-accent hover:border-accent transition-all"
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
            {visibleChapters.map((ch, i) => (
              <Link
                key={ch.id}
                to={`/manga/reader/${provider}/${encodeURIComponent(ch.id)}?manga=${encodeURIComponent(decodedId)}&ch=${chaptersReversed ? chapters.length - 1 - i : i}`}
                className="px-4 py-3 rounded-xl bg-surface border border-border text-sm font-bold text-text-primary hover:border-accent hover:text-accent transition-all group"
              >
                <span className="group-hover:text-accent transition-colors">
                  Ch. {ch.number}
                </span>
              </Link>
            ))}
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
