import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { MediaGrid } from '../components/media/MediaGrid';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';
import { useSEO } from '../hooks/useSEO';
export function Browse({ mediaType = 'movie' }) {
  const [genres, setGenres] = useState([]);
  const [activeGenre, setActiveGenre] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const isTv = mediaType === 'tv';
  const title = isTv ? 'TV Shows' : 'Movies';
  useSEO({ title: `Browse ${title}`, description: isTv ? 'Explore trending TV series by genre on MIYO-STREAM.' : 'Discover and browse popular movies by genre on MIYO-STREAM.' });
  useEffect(() => {
    const loadGenres = async () => {
      try {
        const data = isTv ? await api.getTvGenres() : await api.getMovieGenres();
        setGenres(data.genres || []);
      } catch (err) {
        console.error('Failed to load genres:', err);
      }
    };
    loadGenres();
  }, [isTv]);
  const loadContent = useCallback(async (genreId, pageNum, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      let data;
      if (genreId) {
        data = isTv
          ? await api.getTvByGenre(genreId, pageNum)
          : await api.getMoviesByGenre(genreId, pageNum);
      } else {
        data = isTv
          ? await api.getPopularTV(pageNum)
          : await api.getPopularMovies(pageNum);
      }
      if (append) {
        setItems((prev) => [...prev, ...data.results]);
      } else {
        setItems(data.results);
      }
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isTv]);
  useEffect(() => {
    setPage(1);
    loadContent(activeGenre, 1, false);
  }, [activeGenre, loadContent]);
  useEffect(() => {
    setActiveGenre(null);
    setPage(1);
    setItems([]);
    setGenres([]);
  }, [mediaType]);
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadContent(activeGenre, nextPage, true);
  };
  const handleGenreClick = (genreId) => {
    setActiveGenre(genreId === activeGenre ? null : genreId);
  };
  return (
    <div className="px-5 md:px-10 py-8 md:py-12">
      {/* Service intro + CTA above the fold */}
      <section className="mb-10 p-6 md:p-8 rounded-[2rem] bg-surface/30 backdrop-blur-xl border border-white/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight mb-2">
              Browse {title}
            </h1>
            <p className="text-text-secondary text-sm leading-relaxed max-w-xl">
              {isTv
                ? 'Explore trending TV series, filter by genre, and find your next binge. All data sourced from TMDB.'
                : 'Discover popular and upcoming movies, browse by genre, and start watching instantly. Powered by TMDB.'}
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link to="/search" className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-accent/20 transition-all">
              Search
            </Link>
            <Link to="/download" className="px-5 py-2.5 rounded-xl cyber-gradient text-sm font-bold text-white hover:opacity-90 active:scale-95 transition-all">
              Get the App
            </Link>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-8">
        <button
          onClick={() => handleGenreClick(null)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer',
            activeGenre === null
              ? 'bg-transparent border-accent text-accent animate-rgb-shift'
              : 'bg-transparent border-border text-text-secondary hover:bg-white/5 hover:text-text-primary'
          )}
        >
          All
        </button>
        {genres.map((genre) => (
          <button
            key={genre.id}
            onClick={() => handleGenreClick(genre.id)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer',
              activeGenre === genre.id
                ? 'bg-transparent border-accent text-accent animate-rgb-shift'
                : 'bg-transparent border-border text-text-secondary hover:bg-white/5 hover:text-text-primary'
            )}
          >
            {genre.name}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonGrid count={20} />
      ) : (
        <>
          <MediaGrid items={items} mediaType={mediaType} />
          <div className="text-center mt-10">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <LoadingSpinner className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </div>
        </>
      )}

      {/* Internal cross-links */}
      <div className="flex flex-wrap gap-3 mt-10 pt-8 border-t border-white/5">
        <Link to={isTv ? '/movies' : '/tv'} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">
          {isTv ? '→ Browse Movies' : '→ Browse TV Shows'}
        </Link>
        <Link to="/anime" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">→ Anime</Link>
        <Link to="/manga" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">→ Manga</Link>
        <Link to="/search" className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">→ Search All</Link>
      </div>
    </div>
  );
}
function LoadingSpinner({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}