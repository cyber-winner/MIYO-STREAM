import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useDevice } from '../context/DeviceContext';
import { Skeleton } from '../components/ui/Skeleton';
import { MediaRow } from '../components/media/MediaRow';
import { cn } from '../lib/cn';
export function Person() {
  const { id } = useParams();
  const { isMobile } = useDevice();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    const loadPerson = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getPersonDetails(id);
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadPerson();
    window.scrollTo(0, 0);
  }, [id]);
  if (loading) {
    return (
      <div className="pt-20 px-5 md:px-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          <Skeleton className="w-[200px] md:w-[300px] aspect-[2/3] rounded-2xl flex-shrink-0 mx-auto md:mx-0" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-1/2 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-2/3 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-2xl font-bold text-text-primary">Person Not Found</h2>
        <Link to="/" className="text-accent hover:underline">Go Home</Link>
      </div>
    );
  }
  const movieCredits = data.movie_credits?.cast || [];
  const tvCredits = data.tv_credits?.cast || [];
  const knownFor = [...movieCredits, ...tvCredits]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 15);
  return (
    <div className="pt-10 md:pt-20 pb-20">
      <div className="px-5 md:px-10 max-w-7xl mx-auto">
        <div className={cn(
          "flex gap-10",
          isMobile ? "flex-col items-center" : "flex-row text-left"
        )}>
          <div className="flex-shrink-0 w-[180px] md:w-[300px]">
            {data.profile_path ? (
              <img 
                src={api.getImageUrl(data.profile_path, 'h632')} 
                alt={data.name} 
                className="w-full rounded-3xl shadow-2xl border border-surface-light"
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-surface flex items-center justify-center rounded-3xl text-text-muted">
                No Image
              </div>
            )}
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-surface-light pb-2">Personal Info</h3>
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Known For</p>
                  <p className="text-sm text-white">{data.known_for_department}</p>
                </div>
                {data.birthday && (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Birthday</p>
                    <p className="text-sm text-white">
                      {data.birthday} ({new Date().getFullYear() - new Date(data.birthday).getFullYear()} years old)
                    </p>
                  </div>
                )}
                {data.place_of_birth && (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Place of Birth</p>
                    <p className="text-sm text-white">{data.place_of_birth}</p>
                  </div>
                )}
              </div>
              {data.external_ids && (
                <div className="flex flex-wrap gap-4 pt-4 border-t border-surface-light">
                  {data.external_ids.imdb_id && (
                    <a 
                      href={`https://www.imdb.com/name/${data.external_ids.imdb_id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-[#f5c518] text-black px-1.5 py-0.5 rounded font-black text-[10px] hover:opacity-80 transition-opacity"
                    >
                      IMDb
                    </a>
                  )}
                  {data.external_ids.instagram_id && (
                    <a href={`https://instagram.com/${data.external_ids.instagram_id}`} target="_blank" rel="noopener noreferrer" title="Instagram" className="text-text-muted hover:text-white transition-colors">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                    </a>
                  )}
                  {data.external_ids.twitter_id && (
                    <a href={`https://twitter.com/${data.external_ids.twitter_id}`} target="_blank" rel="noopener noreferrer" title="Twitter" className="text-text-muted hover:text-white transition-colors">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
                    </a>
                  )}
                  {data.external_ids.facebook_id && (
                    <a href={`https://facebook.com/${data.external_ids.facebook_id}`} target="_blank" rel="noopener noreferrer" title="Facebook" className="text-text-muted hover:text-white transition-colors">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-8">
              {data.name}
            </h1>
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
                Biography
              </h3>
              <p className="text-text-primary leading-relaxed text-sm md:text-base whitespace-pre-wrap opacity-80">
                {data.biography || "No biography available."}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-16">
        <MediaRow title="Known For" items={knownFor} />
        {movieCredits.length > 0 && (
          <MediaRow 
            title="Movies" 
            items={movieCredits.sort((a,b) => new Date(b.release_date) - new Date(a.release_date))} 
            mediaType="movie"
          />
        )}
        {tvCredits.length > 0 && (
          <MediaRow 
            title="TV Shows" 
            items={tvCredits.sort((a,b) => new Date(b.first_air_date) - new Date(a.first_air_date))} 
            mediaType="tv"
          />
        )}
      </div>
    </div>
  );
}