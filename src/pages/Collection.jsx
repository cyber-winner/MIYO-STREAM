import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useDevice } from '../context/DeviceContext';
import { Skeleton } from '../components/ui/Skeleton';
import { MediaCard } from '../components/media/MediaCard';
import { cn } from '../lib/cn';
export function Collection() {
  const { id } = useParams();
  const { isMobile } = useDevice();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    const loadCollection = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getCollectionDetails(id);
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadCollection();
    window.scrollTo(0, 0);
  }, [id]);
  if (loading) {
    return (
      <div className="pt-20 px-5 md:px-10 max-w-7xl mx-auto">
        <Skeleton className="w-full h-[40vh] rounded-3xl mb-10" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-2xl font-bold text-text-primary">Collection Not Found</h2>
        <Link to="/" className="text-accent hover:underline">Go Home</Link>
      </div>
    );
  }
  const backdrop = api.getBackdropUrl(data.backdrop_path);
  return (
    <div className="pb-20">
      <div 
        className="relative w-full h-[40vh] md:h-[50vh] bg-cover bg-center"
        style={{ backgroundImage: backdrop ? `url('${backdrop}')` : undefined }}
      >
        <div className="absolute inset-0 gradient-overlay-detail flex items-center justify-center sm:justify-start px-5 md:px-10">
          <div className="max-w-3xl pt-20">
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-4">
              {data.name}
            </h1>
            <p className="text-text-primary text-sm md:text-base leading-relaxed opacity-80 line-clamp-3 md:line-clamp-none">
              {data.overview}
            </p>
          </div>
        </div>
      </div>
      <div className="px-5 md:px-10 max-w-7xl mx-auto mt-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
          <h2 className="text-2xl font-bold text-white">Titles in this Series</h2>
          <span className="bg-surface px-3 py-1 rounded-full text-xs font-bold text-text-muted border border-surface-light">
            {data.parts?.length} Items
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {data.parts?.sort((a,b) => new Date(a.release_date) - new Date(b.release_date)).map((part) => (
            <MediaCard key={part.id} item={part} mediaType="movie" />
          ))}
        </div>
      </div>
    </div>
  );
}