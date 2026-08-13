import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useDevice } from '../context/DeviceContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { VideoPlayer } from '../components/media/VideoPlayer';
import { EpisodeCard } from '../components/media/EpisodeCard';
import { SeasonSelector } from '../components/media/SeasonSelector';
import { MediaRow } from '../components/media/MediaRow';
import { TVRow } from '../components/media/TVRow';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/cn';
import { useSEO } from '../hooks/useSEO';
import { slugify } from '../lib/slugify';
import { youTubeEmbedUrl } from '../platform/index.js';
export function Detail({ mediaType = 'movie' }) {
  const { id } = useParams();
  const { isMobile, isTv } = useDevice();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerSrc, setPlayerSrc] = useState('');
  const [activeSeason, setActiveSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState('popular');
  const [isPosterExpanded, setIsPosterExpanded] = useState(false);

  const { showToast } = useToast();
  const navigate = useNavigate();
  const { slug } = useParams();
  const isTvShow = mediaType === 'tv';
  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = isTvShow
          ? await api.getTvDetails(id)
          : await api.getMovieDetails(id);
        setData(result);
        const progressKey = `progress_${mediaType}_${id}`;
        let savedProgress = 0;
        try {
          const saved = JSON.parse(localStorage.getItem(progressKey));
          if (saved?.progress) savedProgress = saved.progress;
        } catch (e) {}
        const src = isTvShow
          ? api.getTvPlayerUrl(id, 1, 1, savedProgress)
          : api.getMoviePlayerUrl(id, savedProgress);
        setPlayerSrc(src);
        if (isTvShow && result.seasons) {
          const validSeasons = result.seasons.filter((s) => s.season_number > 0);
          if (validSeasons.length > 0) setActiveSeason(validSeasons[0].season_number);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
    window.scrollTo(0, 0);
  }, [id, mediaType, isTvShow]);
  useEffect(() => {
    if (data) {
      const fetchedTitle = isTvShow ? data.name : data.title;
      const correctSlug = slugify(fetchedTitle);
      if (slug !== correctSlug) {
        navigate(`/${mediaType}/${id}/${correctSlug}`, { replace: true });
      }
    }
  }, [data, slug, mediaType, id, navigate, isTvShow]);
  const loadSeason = useCallback(async (seasonNum) => {
    setEpisodesLoading(true);
    try {
      const seasonData = await api.getTvSeason(id, seasonNum);
      setEpisodes(seasonData.episodes || []);
      setActiveEpisode(seasonData.episodes?.length > 0 ? seasonData.episodes[0].episode_number : null);
    } catch (err) {
      console.error('Failed to load season:', err);
    } finally {
      setEpisodesLoading(false);
    }
  }, [id]);
  useEffect(() => {
    if (activeSeason && isTvShow) loadSeason(activeSeason);
  }, [activeSeason, isTvShow, loadSeason]);
  const isPlayingTrailer = playerSrc.includes('youtube.com');
  const toggleTrailer = () => {
    if (isPlayingTrailer) {
      const progressKey = `progress_${mediaType}_${id}`;
      let savedProgress = 0;
      try {
        const saved = JSON.parse(localStorage.getItem(progressKey));
        if (saved?.progress) savedProgress = saved.progress;
      } catch (e) {}
      const src = isTvShow
        ? api.getTvPlayerUrl(id, activeSeason || 1, activeEpisode || 1, savedProgress)
        : api.getMoviePlayerUrl(id, savedProgress);
      setPlayerSrc(src);
      document.getElementById('media-player-section')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      const trailer = data.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || data.videos?.results?.[0];
      if (trailer) {
        setPlayerSrc(youTubeEmbedUrl(trailer.key, { autoplay: 1 }));
        document.getElementById('media-player-section')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        showToast('No trailer found for this title.', 'info');
      }
    }
  };
  const title = data ? (isTvShow ? data.name : data.title) : '';
  const description = data?.overview || '';
  const poster = data ? api.getImageUrl(data.poster_path) : '';

  useSEO({
    title,
    description,
    image: poster,
    url: window.location.href,
  });
  // Compute backdrop early so it persists during loading transitions
  const backdrop = data ? api.getBackdropUrl(data.backdrop_path) : '';
  const BackgroundLayer = (
    <>
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ 
          backgroundImage: backdrop ? `url('${backdrop}')` : undefined,
        }}
      />
      <div className="fixed inset-0 gradient-overlay-detail z-[-1]" />
    </>
  );
  if (loading) return <>{BackgroundLayer}<DetailSkeleton /></>;
  if (error || !data) return <>{BackgroundLayer}<ErrorView error={error} /></>;
  const date = isTvShow ? data.first_air_date : data.release_date;
  const year = date ? new Date(date).getFullYear() : '';
  const rating = data.vote_average ? (data.vote_average * 10).toFixed(0) : '0';
  const certification = !isTvShow 
    ? data.release_dates?.results?.find(r => r.iso_3166_1 === 'US')?.release_dates?.[0]?.certification
    : data.content_ratings?.results?.find(r => r.iso_3166_1 === 'US')?.rating;
  const crew = data.credits?.crew || [];
  const keyCrew = crew.filter(c => ['Director', 'Writer', 'Screenplay', 'Creator'].includes(c.job)).slice(0, 6);
  return (
    <div className="animate-in fade-in duration-700 relative">
      {/* Global Cinematic Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ 
          backgroundImage: `url('${backdrop}')`,
        }}
      />
      <div className="fixed inset-0 gradient-overlay-detail z-[-1]" />
      <div
        className={cn(
          "relative w-full text-white transition-all duration-700",
          isMobile ? "min-h-[70vh]" : isTv ? "min-h-[90vh]" : "min-h-[510px]"
        )}
      >
        <div className={cn(
          "relative z-10 max-w-[1400px] mx-auto flex gap-10",
          isMobile ? "flex-col p-6 pt-24" : isTv ? "flex-col p-16 pt-32" : "flex-row px-10 py-12"
        )}>
          <div 
            className="flex-shrink-0 w-[300px] group relative cursor-pointer"
            onClick={() => setIsPosterExpanded(true)}
          >
            <img src={poster} alt={title} className="rounded-xl shadow-2xl w-full aspect-[2/3] object-cover border border-white/10" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl backdrop-blur-sm">
               <span className="font-bold uppercase tracking-widest text-sm text-white">Expand Poster</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h1 className={cn(
              "font-black mb-2 tracking-tight transition-all",
              isMobile ? "text-4xl" : isTv ? "text-8xl" : "text-5xl lg:text-6xl"
            )}>
              {title} <span className="font-light opacity-50">({year})</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 mb-8 text-sm opacity-90">
              {certification && <span className="border border-white/40 px-1.5 py-0.5 rounded text-[10px] font-black">{certification}</span>}
              <span>{date.split('-').reverse().join('/')} (US)</span>
              <span className="mx-1">•</span>
              <span>{data.genres?.map(g => g.name).join(', ')}</span>
              <span className="mx-1">•</span>
              <span>{isTvShow ? `${data.number_of_seasons} Seasons` : `${Math.floor(data.runtime/60)}h ${data.runtime%60}m`}</span>
            </div>
            <div className="flex items-center gap-6 mb-8">
              <div className="flex items-center gap-3 group cursor-help" title="User Score">
                <div className="relative w-16 h-16 rounded-full bg-[#081c22] flex items-center justify-center border-[4px] border-[#204529]">
                  <span className="text-xl font-black tracking-tighter">{rating}<span className="text-[10px] opacity-60">%</span></span>
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle 
                      cx="32" cy="32" r="28" fill="transparent" stroke="#21d07a" strokeWidth="4" 
                      strokeDasharray={`${(parseFloat(rating)/100) * 176} 176`} strokeLinecap="round"
                    />
                  </svg>
                </div>
                <span className="text-sm font-black leading-tight w-12 group-hover:text-accent transition-colors">User Score</span>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={toggleTrailer}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                >
                  <PlayIcon className="w-5 h-5 fill-white" />
                  <span className="font-black text-sm uppercase tracking-wider">
                    {isPlayingTrailer ? 'Watch Now' : 'Play Trailer'}
                  </span>
                </button>
              </div>
            </div>
            <div className="max-w-2xl">
              <p className="text-lg italic opacity-70 mb-4 font-light">&ldquo;{data.tagline}&rdquo;</p>
              <h3 className="text-xl font-black mb-2 uppercase tracking-tight">Overview</h3>
              <p className="leading-relaxed text-base opacity-95 line-clamp-4 hover:line-clamp-none transition-all cursor-default">
                {data.overview}
              </p>
            </div>
            {!isMobile && (
              <div className={cn(
                "grid grid-cols-3 gap-y-6 gap-x-8 mt-10",
                isTv && "grid-cols-4 lg:grid-cols-6 gap-12"
              )}>
                {keyCrew.map((member, i) => (
                  <div key={i}>
                    <p className={cn("font-black hover:text-accent cursor-pointer transition-colors", isTv ? "text-xl" : "text-sm")}>{member.name}</p>
                    <p className={cn("opacity-70", isTv ? "text-base" : "text-xs")}>{member.job || 'Creator'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-10 py-10 flex flex-col lg:flex-row gap-10">
        <div className="flex-1 min-w-0 space-y-12">
          <section id="media-player-section">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Watch Now</h2>
              </div>
              {/* Movies/TV play through the Videasy third-party embed — the app
                  never has access to the raw stream, so direct downloads are
                  impossible here (they only work for anime, which streams HLS
                  directly). The old button silently failed every time. */}
            </div>
            <VideoPlayer src={playerSrc} />
            {isTvShow && (
              <div className="mt-8 space-y-6">
                <SeasonSelector seasons={data.seasons.filter(s => s.season_number > 0)} activeSeason={activeSeason} onSelect={setActiveSeason} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {episodes.map(ep => (
                    <EpisodeCard key={ep.id} episode={ep} seasonNumber={activeSeason} isActive={activeEpisode === ep.episode_number} onClick={() => {
                        setActiveEpisode(ep.episode_number);
                        setPlayerSrc(api.getTvPlayerUrl(id, activeSeason, ep.episode_number));
                    }} />
                  ))}
                </div>
              </div>
            )}
          </section>
          <section>
             <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Top Billed Cast</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-surface-light group">
              {data.credits?.cast?.slice(0, 12).map(actor => (
                <div key={actor.id} className="w-[140px] flex-shrink-0 bg-surface rounded-xl overflow-hidden border border-surface-light shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
                  <Link to={`/person/${actor.id}`}>
                    <img src={api.getImageUrl(actor.profile_path, 'w185')} alt={actor.name} className="w-full aspect-[4/5] object-cover" />
                    <div className="p-3">
                      <p className="font-black text-sm text-white leading-tight truncate">{actor.name}</p>
                      <p className="text-xs text-text-muted leading-tight mt-1 line-clamp-2">{actor.character}</p>
                    </div>
                  </Link>
                </div>
              ))}
              <div className="flex-shrink-0 w-[140px] flex items-center justify-center bg-surface-light/20 rounded-xl hover:bg-surface-light/40 transition-colors cursor-pointer group">
                 <span className="font-black text-sm uppercase tracking-widest text-text-muted group-hover:text-white">View Full Cast →</span>
              </div>
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Media</h2>
              </div>
              <div className="flex gap-6 text-sm font-black opacity-60">
                 <button 
                   onClick={() => setActiveMediaTab('popular')}
                   className={cn("transition-all", activeMediaTab === 'popular' && "text-white underline underline-offset-8 decoration-accent decoration-2 opacity-100")}
                 >Most Popular</button>
                 <button 
                   onClick={() => setActiveMediaTab('videos')}
                   className={cn("hover:opacity-100 transition-opacity", activeMediaTab === 'videos' && "text-white underline underline-offset-8 decoration-accent decoration-2 opacity-100")}
                 >Videos ({data.videos?.results?.length})</button>
                 <button 
                   onClick={() => setActiveMediaTab('posters')}
                   className={cn("hover:opacity-100 transition-opacity", activeMediaTab === 'posters' && "text-white underline underline-offset-8 decoration-accent decoration-2 opacity-100")}
                 >Posters</button>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-surface-light">
               {(activeMediaTab === 'popular' || activeMediaTab === 'videos') && (
                 (activeMediaTab === 'popular' ? data.videos?.results?.slice(0, 5) : data.videos?.results)?.map(v => (
                   <div key={v.id} className="w-[300px] md:w-[480px] flex-shrink-0 aspect-video rounded-xl overflow-hidden border border-surface-light relative group bg-black">
                      <iframe className="w-full h-full" src={youTubeEmbedUrl(v.key)} allowFullScreen />
                   </div>
                 ))
               )}
               {activeMediaTab === 'posters' && data.images?.posters?.slice(0, 15).map((img, i) => (
                 <div key={i} className="w-[180px] flex-shrink-0 aspect-[2/3] rounded-xl overflow-hidden border border-surface-light shadow-lg">
                    <img src={api.getImageUrl(img.file_path, 'w342')} alt="poster" className="w-full h-full object-cover" />
                 </div>
               ))}
            </div>
          </section>
          {isTv ? (
            <TVRow title="Recommendations" items={data.recommendations?.results} mediaType={mediaType} />
          ) : (
            <MediaRow title="Recommendations" items={data.recommendations?.results} mediaType={mediaType} />
          )}
        </div>
        <div className="w-full lg:w-[300px] space-y-8">
          <div className="border-b border-surface-light mb-6" />
          <div className="space-y-6">
            <Fact label="Status" value={data.status} />
            <Fact label="Original Language" value={data.original_language?.toUpperCase()} />
            {!isTvShow && (
              <>
                <Fact label="Budget" value={data.budget > 0 ? `$${data.budget.toLocaleString()}` : '-'} />
                <Fact label="Revenue" value={data.revenue > 0 ? `$${data.revenue.toLocaleString()}` : '-'} />
              </>
            )}
            {isTvShow && (
              <>
                <Fact label="Network" value={data.networks?.map(n => n.name).join(', ')} />
                <Fact label="Type" value={data.type} />
              </>
            )}
          </div>
          <div>
            <h3 className="font-black text-lg text-white mb-4 uppercase tracking-tighter">Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {data.keywords?.keywords?.map(k => (
                <span key={k.id} className="bg-surface border border-surface-light px-2.5 py-1 rounded-md text-[11px] font-bold text-text-secondary hover:text-accent hover:border-accent cursor-pointer transition-all">
                  {k.name}
                </span>
              ))}
              {isTvShow && data.keywords?.results?.map(k => (
                <span key={k.id} className="bg-surface border border-surface-light px-2.5 py-1 rounded-md text-[11px] font-bold text-text-secondary hover:text-accent hover:border-accent cursor-pointer transition-all">
                  {k.name}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-surface p-6 rounded-3xl border border-surface-light">
             <h3 className="font-black text-white mb-1">Content Score</h3>
             <div className="flex items-center gap-2 mb-2">
                <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                   <div className="h-full bg-accent w-[91%]" />
                </div>
                <span className="text-xs font-black">91</span>
             </div>
             <p className="text-[10px] text-text-muted leading-relaxed">Yes! Looking good! This page is almost perfect.</p>
          </div>
        </div>
      </div>
      {isPosterExpanded && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl overflow-y-auto p-4 md:p-10 cursor-zoom-out animate-in fade-in duration-300"
          onClick={() => setIsPosterExpanded(false)}
        >
          <div className="min-h-full w-full flex items-center justify-center">
            <img 
              src={poster} 
              alt={title} 
              className="w-full max-w-[500px] md:max-w-[700px] object-cover rounded-xl shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300" 
            />
          </div>
          <button 
            className="fixed top-6 right-6 z-50 p-3 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-surface-hover transition-all backdrop-blur-md border border-white/10"
            onClick={(e) => { e.stopPropagation(); setIsPosterExpanded(false); }}
            aria-label="Close"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
function DetailSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="w-full h-[500px]" />
      <div className="max-w-[1400px] mx-auto px-10 flex gap-10">
        <div className="flex-1 space-y-10">
          <Skeleton className="w-full h-[400px] rounded-3xl" />
          <Skeleton className="w-3/4 h-8" />
          <div className="flex gap-4 overflow-hidden"><Skeleton className="w-32 h-44 flex-shrink-0 rounded-xl" /><Skeleton className="w-32 h-44 flex-shrink-0 rounded-xl" /><Skeleton className="w-32 h-44 flex-shrink-0 rounded-xl" /></div>
        </div>
        <div className="w-[300px] space-y-6"><Skeleton className="w-full h-64 rounded-3xl" /></div>
      </div>
    </div>
  );
}
function ErrorView({ error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-3xl font-black text-white">404 - NOT FOUND</h2>
      <p className="text-text-muted">{error || "The content you're looking for doesn't exist or failed to load."}</p>
      <Button variant="primary" onClick={() => window.history.back()}>Go Back</Button>
    </div>
  );
}
function Fact({ label, value }) {
  return (
    <div>
      <p className="font-black text-sm text-white leading-tight">{label}</p>
      <p className="text-sm font-medium opacity-80 mt-0.5">{value || '-'}</p>
    </div>
  );
}
const PlayIcon = ({ className }) => <svg className={className} viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;
