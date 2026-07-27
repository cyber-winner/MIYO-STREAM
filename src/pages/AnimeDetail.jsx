import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { anilistApi } from '../lib/anilistApi';
import { api } from '../lib/api';
import { findBestMatch, buildSearchQueries } from '../lib/matchAnime';
import { useDevice } from '../context/DeviceContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { VideoPlayer } from '../components/media/VideoPlayer';
import { AnimeRow } from '../components/media/AnimeRow';
import { WatchTogetherModal } from '../components/media/WatchTogetherModal';
import { WatchTogetherBar } from '../components/media/WatchTogetherBar';
import watchTogetherClient from '../lib/watchTogetherClient';
import { cn } from '../lib/cn';
import { useSEO } from '../hooks/useSEO';
import { slugify } from '../lib/slugify';
import { isNative, isAndroid, youTubeEmbedUrl } from '../platform/index.js';
export function AnimeDetail() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { isMobile, isTv } = useDevice();
  const animeProvider = (() => { try { return localStorage.getItem('miyo-anime-provider') || 'anikoto'; } catch { return 'anikoto'; } })();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerSrc, setPlayerSrc] = useState('');
  const [activeEpisode, setActiveEpisode] = useState(1);
  const [visibleEpisodeCount, setVisibleEpisodeCount] = useState(100);
  const [isPosterExpanded, setIsPosterExpanded] = useState(false);
  const [timeUntilAiring, setTimeUntilAiring] = useState(0);
  // StrawVerse specific states
  const [anikotoEpisodes, setAnikotoEpisodes] = useState([]);
  const [isHls, setIsHls] = useState(false);
  const [hlsSubtitles, setHlsSubtitles] = useState([]);
  const [audioPreference, setAudioPreference] = useState('sub'); // 'sub' or 'dub'
  const [availableAudio, setAvailableAudio] = useState(['sub']); // ['sub', 'dub'] based on provider info
  const [loadingEpisode, setLoadingEpisode] = useState(false);
  // Background trailer state
  const [bgTrailerPhase, setBgTrailerPhase] = useState('image'); // 'image' | 'trailer'
  const [bgTrailerReady, setBgTrailerReady] = useState(false);
  const bgPlayerRef = useRef(null);
  const bgTimerRef = useRef(null);
  const bgIframeRef = useRef(null);
  const episodesContainerRef = useRef(null);
  // Watch Together state
  const [wtModalOpen, setWtModalOpen] = useState(false);
  const [wtRoomCode, setWtRoomCode] = useState(watchTogetherClient.roomCode);
  const wtSyncLock = useRef(false); // Prevents feedback loops when syncing playback

  // Auto-open Watch Together modal if URL has ?wt=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('wt') && !wtRoomCode) {
      setWtModalOpen(true);
    }
  }, [location.search, wtRoomCode]);
  // Watch Together: track room connection state
  useEffect(() => {
    const handleRoomJoined = (data) => setWtRoomCode(data.roomCode);
    const handleDisconnected = () => setWtRoomCode(null);

    watchTogetherClient.on('roomJoined', handleRoomJoined);
    watchTogetherClient.on('disconnected', handleDisconnected);

    // Sync play/pause from remote users
    const handlePlayPause = ({ isPlaying, timestamp }) => {
      const video = document.querySelector('video');
      if (!video || wtSyncLock.current) return;
      wtSyncLock.current = true;
      video.currentTime = timestamp;
      if (isPlaying) video.play().catch(() => {});
      else video.pause();
      setTimeout(() => { wtSyncLock.current = false; }, 500);
    };

    // Sync seek from remote users
    const handleTimeSync = ({ timestamp, speed }) => {
      const video = document.querySelector('video');
      if (!video || wtSyncLock.current) return;
      wtSyncLock.current = true;
      if (Math.abs(video.currentTime - timestamp) > 2) {
        video.currentTime = timestamp;
      }
      video.playbackRate = speed;
      setTimeout(() => { wtSyncLock.current = false; }, 500);
    };

    // Sync episode changes from remote host
    const handleLoadMedia = ({ animeID, episode }) => {
      // animeID is the AniList ID, episode is the episode number
      const ep = anikotoEpisodes.find(e => e.number === episode);
      if (ep) {
        handleEpisodeClick(episode, ep.id, audioPreference);
      }
    };

    watchTogetherClient.on('playPause', handlePlayPause);
    watchTogetherClient.on('timeSync', handleTimeSync);
    watchTogetherClient.on('loadMedia', handleLoadMedia);

    // Sync captions from remote users
    const handleCaptionSync = ({ trackLabel }) => {
      const video = document.querySelector('video');
      if (!video) return;
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = (tracks[i].label === trackLabel) ? 'showing' : 'disabled';
      }
    };
    watchTogetherClient.on('captionSync', handleCaptionSync);

    return () => {
      watchTogetherClient.off('roomJoined', handleRoomJoined);
      watchTogetherClient.off('disconnected', handleDisconnected);
      watchTogetherClient.off('playPause', handlePlayPause);
      watchTogetherClient.off('timeSync', handleTimeSync);
      watchTogetherClient.off('loadMedia', handleLoadMedia);
      watchTogetherClient.off('captionSync', handleCaptionSync);
    };
  }, [anikotoEpisodes, audioPreference]);
  // Watch Together: hook into the video element to broadcast play/pause/seek
  useEffect(() => {
    if (!wtRoomCode) return;
    const video = document.querySelector('video');
    if (!video) return;

    const onPlay = () => {
      if (wtSyncLock.current) return;
      watchTogetherClient.sendPlayPause(true, video.currentTime);
    };
    const onPause = () => {
      if (wtSyncLock.current) return;
      watchTogetherClient.sendPlayPause(false, video.currentTime);
    };
    const onSeeked = () => {
      if (wtSyncLock.current) return;
      watchTogetherClient.sendTimeSync(video.currentTime, video.playbackRate);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);

    // Watch Together: broadcast caption track changes
    const onTrackChange = () => {
      if (wtSyncLock.current) return;
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].mode === 'showing') {
          watchTogetherClient.sendCaptionSync(tracks[i].label);
          return;
        }
      }
      // No track showing — send empty to disable
      watchTogetherClient.sendCaptionSync('');
    };
    // textTracks fires 'change' when a track mode changes
    if (video.textTracks) {
      video.textTracks.addEventListener('change', onTrackChange);
    }

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      if (video.textTracks) {
        video.textTracks.removeEventListener('change', onTrackChange);
      }
    };
  }, [wtRoomCode, playerSrc]);
  // Watch Together: broadcast episode changes when host picks an episode
  useEffect(() => {
    if (!wtRoomCode || !watchTogetherClient.isHost) return;
    if (!activeEpisode || !data?.id) return;
    
    // Broadcast full media state for WatchTogether page users
    if (playerSrc) {
      watchTogetherClient.setCurrentMedia({
        playerSrc,
        isHls,
        subtitles: hlsSubtitles,
        title: `${data.title?.english || data.title?.romaji || ''} - EP${activeEpisode}`,
        animeId: data.id
      });
    }

    watchTogetherClient.sendLoadMedia(0, parseInt(data.id), activeEpisode);
  }, [activeEpisode, wtRoomCode, data?.id, playerSrc, isHls, hlsSubtitles, data?.title]);
  useEffect(() => {
    if (data?.nextAiringEpisode?.timeUntilAiring) {
      setTimeUntilAiring(data.nextAiringEpisode.timeUntilAiring);
      const timer = setInterval(() => {
        setTimeUntilAiring(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [data]);
  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Get rich metadata from AniList (decorations only)
        const result = await anilistApi.getDetail(id);
        setData(result);
        // 2. Fetch episodes directly from Anikoto — its search engine is the source of truth
        if (result.type === 'ANIME') {
          try {
            const searchQueries = buildSearchQueries(result);
            let bestMatch = null;
            let bestScore = 0;
            for (const query of searchQueries) {
              try {
                const providerResults = await api.getProviderSearch(animeProvider, query, 1);
                const matches = providerResults?.results || [];
                if (matches.length > 0) {
                  const { match, score } = findBestMatch(matches, result, 0.4);
                  if (match && score > bestScore) {
                    bestMatch = match;
                    bestScore = score;
                  }
                  if (bestScore >= 0.85) break; // confident match
                }
              } catch (searchErr) {
                console.warn(`[${animeProvider}] Search failed for "${query}":`, searchErr.message);
              }
            }
            if (bestMatch) {
              // Get AnimeInfo to get dataId
              const providerInfo = await api.getProviderInfo(animeProvider, bestMatch.id);
              if (providerInfo) {
                // Determine available audio types
                const idStr = providerInfo.id || '';
                const types = [];
                if (idStr.includes('sub') || idStr.includes('both')) types.push('sub');
                if (idStr.includes('dub') || idStr.includes('both')) types.push('dub');
                if (types.length > 0) setAvailableAudio(types);
                // If the user's preference isn't available, switch to what is
                if (types.length > 0 && !types.includes(audioPreference)) {
                  setAudioPreference(types[0]);
                }
                if (providerInfo.dataId) {
                  // Get episodes
                  const epData = await api.getProviderEpisodes(animeProvider, providerInfo.dataId);
                  const episodesList = epData?.episodes || [];
                  setAnikotoEpisodes(episodesList);
                  if (episodesList.length > 0) {
                    const firstEp = episodesList[0];
                    handleEpisodeClick(firstEp.number, firstEp.id, types.length > 0 ? (types.includes(audioPreference) ? audioPreference : types[0]) : null);
                  }

                }
              }
            }
          } catch (e) {
            console.error(`${animeProvider} fetch failed:`, e);
            // Fallback to Videasy if Anikoto fails
            setPlayerSrc(api.getAnimePlayerUrl(id, 1));
            setIsHls(false);
          }
        }
      } catch (err) {
        console.error('Failed to load anime detail:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (data && data.type === 'ANIME') {
      const title = data.title?.english || data.title?.romaji;
      const correctSlug = slugify(title);
      if (slug !== correctSlug) {
        navigate(`/anime/${id}/${correctSlug}`, { replace: true });
      }
    }
  }, [data, slug, id, navigate]);
  const handleEpisodeClick = async (epNum, anikotoEpId = null, prefAudio = audioPreference) => {
    setActiveEpisode(epNum);
    setLoadingEpisode(true);
    if (anikotoEpId) {
      try {
        // Ensure episode ID carries the correct sub/dub preference if it's 'both'
        let targetEpId = anikotoEpId;
        const currentEp = anikotoEpisodes.find(e => e.id === anikotoEpId);
        // Use the StrawVerse /api/watch POST endpoint to fetch sources
        const sourceData = await api.getProviderSources(animeProvider, targetEpId, prefAudio);
        let sourcesList = [];
        let subsList = [];
        // Handle StrawVerse format response
        if (prefAudio === 'dub' && sourceData?.dub?.sources?.length > 0) {
          sourcesList = sourceData.dub.sources;
          subsList = sourceData.dub.subtitles || sourceData.subtitles || [];
        } else if (prefAudio === 'sub' && sourceData?.sub?.sources?.length > 0) {
          sourcesList = sourceData.sub.sources;
          subsList = sourceData.sub.subtitles || sourceData.subtitles || [];
        } else if (sourceData?.sources?.length > 0) {
          sourcesList = sourceData.sources;
          subsList = sourceData.subtitles || [];
        }
        if (sourcesList.length > 0) {
           const source = sourcesList[0];
           const hlsUrl = source.url || source.file;
           const referer = source.headers?.Referer || '';
           // Use our proxy builder for the video player
           const proxiedUrl = api.buildProxiedHlsUrl(hlsUrl, referer);
           // We'll pass the unproxied URL to VideoPlayer with the referer hash
           // VideoPlayer handles proxying through hls.js
           setPlayerSrc(`${hlsUrl}#referer=${encodeURIComponent(referer)}`);
           setIsHls(true);
           setHlsSubtitles(subsList);
        } else {
           throw new Error('No valid sources returned');
        }
      } catch (e) {
        console.error('Failed to get sources:', e);
        // Fallback to Videasy Embed (data may still be null on first load, use route id)
        setPlayerSrc(api.getAnimePlayerUrl(data?.id || id, epNum));
        setIsHls(false);
        setHlsSubtitles([]);
        window.dispatchEvent(new CustomEvent('miyo-toast', {
          detail: { message: `Switched to fallback player.`, type: 'warning' }
        }));
      }
    } else {
      setIsHls(false);
      setPlayerSrc(api.getAnimePlayerUrl(data?.id || id, epNum));
    }
    setLoadingEpisode(false);
    // Only scroll to player if not already in view
    const playerSection = document.getElementById('anime-player-section');
    if (playerSection) {
      const rect = playerSection.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };
  // If native HLS playback fails fatally, fall back to the Videasy embed
  // instead of leaving the player loading forever.
  useEffect(() => {
    const onHlsFatal = () => {
      if (!isHls) return;
      setIsHls(false);
      setHlsSubtitles([]);
      setPlayerSrc(api.getAnimePlayerUrl(data?.id || id, activeEpisode || 1));
      window.dispatchEvent(new CustomEvent('miyo-toast', {
        detail: { message: 'Stream failed — switched to fallback player.', type: 'warning' }
      }));
    };
    window.addEventListener('miyo-hls-fatal', onHlsFatal);
    return () => window.removeEventListener('miyo-hls-fatal', onHlsFatal);
  }, [isHls, data, id, activeEpisode]);
  const isPlayingTrailer = playerSrc.includes('youtube.com');
  const toggleTrailer = () => {
    if (isPlayingTrailer) {
      if (anikotoEpisodes.length > 0) {
        const currentEp = anikotoEpisodes.find(e => e.number === activeEpisode);
        if (currentEp) {
          handleEpisodeClick(activeEpisode, currentEp.id);
        }
      } else {
        setPlayerSrc(api.getAnimePlayerUrl(data?.id || id, activeEpisode));
        setIsHls(false);
      }
    } else {
      if (data.trailer?.site === 'youtube') {
        setPlayerSrc(youTubeEmbedUrl(data.trailer.id, { autoplay: 1 }));
        setIsHls(false);
        document.getElementById('anime-player-section')?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };
  const handleAudioToggle = (type) => {
    if (type === audioPreference) return;
    setAudioPreference(type);
    // Reload current episode with new preference
    const currentEp = anikotoEpisodes.find(e => e.number === activeEpisode);
    if (currentEp) {
      handleEpisodeClick(activeEpisode, currentEp.id, type);
    }
  };
  const title = data ? (data.title?.english || data.title?.romaji || data.title?.userPreferred) : '';
  const description = data?.description?.replace(/<[^>]*>/g, '') || '';
  const cover = data ? (data.coverImage?.extraLarge || data.coverImage?.large) : '';
  // Background trailer: use AniList trailer data (computed before hooks, null-safe)
  const bgTrailer = (data?.type === 'ANIME' && data?.trailer?.site === 'youtube') ? data.trailer : null;
  // Load YouTube IFrame API once. All platforms now run on a real HTTP
  // origin (desktop serves from http://localhost via tauri-plugin-localhost),
  // so the standard YT.Player works everywhere — same as Android.
  useEffect(() => {
    if (!bgTrailer) return;
    if (window.YT && window.YT.Player) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }, [bgTrailer]);
  // Trailer cycling logic
  useEffect(() => {
    if (!bgTrailer || !data) return;
    if (bgTrailerPhase === 'image') {
      setBgTrailerReady(false);
      bgTimerRef.current = setTimeout(() => {
        setBgTrailerPhase('trailer');
      }, 5000);
      return () => clearTimeout(bgTimerRef.current);
    }
    if (bgTrailerPhase === 'trailer') {
      const initPlayer = () => {
        if (bgPlayerRef.current) {
          try {
            bgPlayerRef.current.seekTo(0);
            bgPlayerRef.current.playVideo();
          } catch(e) {}
          return;
        }
        const iframeEl = bgIframeRef.current;
        if (!iframeEl) return;
        bgPlayerRef.current = new window.YT.Player(iframeEl, {
          videoId: bgTrailer.id,
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            showinfo: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            loop: 1,
            playlist: bgTrailer.id,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              e.target.mute();
              e.target.playVideo();
              setTimeout(() => setBgTrailerReady(true), 800);
            },
            onStateChange: (e) => {
              if (e.data === 1) setBgTrailerReady(true);
              // Paused (e.g. app went to background): show the backdrop image
              if (e.data === 2) setBgTrailerReady(false);
              if (e.data === 0) {
                // Safety net — with loop:1 this normally never fires.
                setBgTrailerReady(false);
                setTimeout(() => setBgTrailerPhase('image'), 600);
              }
            },
            onError: () => {
              setBgTrailerReady(false);
              setBgTrailerPhase('image');
            },
          },
        });
      };
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }
    }
  }, [bgTrailerPhase, bgTrailer, data]);
  // Resume the trailer when the app comes back to the foreground. While
  // hidden the player pauses and the cover image is shown; on return we
  // replay — if that fails, fall back to the image permanently.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) return;
      if (!bgPlayerRef.current) return;
      try {
        bgPlayerRef.current.mute();
        bgPlayerRef.current.playVideo();
      } catch (e) {
        setBgTrailerReady(false);
        setBgTrailerPhase('image');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(bgTimerRef.current);
      if (bgPlayerRef.current) {
        try { bgPlayerRef.current.destroy(); } catch(e) {}
        bgPlayerRef.current = null;
      }
    };
  }, []);
  // Reset trailer state when navigating to a different item
  useEffect(() => {
    setBgTrailerPhase('image');
    setBgTrailerReady(false);
    if (bgPlayerRef.current) {
      try { bgPlayerRef.current.destroy(); } catch(e) {}
      bgPlayerRef.current = null;
    }
  }, [id]);
  useSEO({
    title,
    description,
    image: cover,
    url: window.location.href,
  });
  // Compute backdrop early so it persists during loading transitions
  const backdrop = data?.bannerImage;
  const BackgroundLayer = (
    <>
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2] transition-opacity duration-1000"
        style={{ 
          backgroundImage: backdrop ? `url('${backdrop}')` : cover ? `url('${cover}')` : undefined,
          opacity: bgTrailerReady ? 0 : 1,
        }}
      />
      <div className="fixed inset-0 gradient-overlay-detail z-[-1]" />
    </>
  );
  if (loading) return <>{BackgroundLayer}<DetailSkeleton /></>;
  if (error || !data) return <>{BackgroundLayer}<ErrorView error={error} /></>;
  const nativeTitle = data.title?.native;
  const romajiTitle = data.title?.romaji;
  const score = data.averageScore;
  const format = anilistApi.formatFormat(data.format);
  const status = anilistApi.formatStatus(data.status);
  const season = data.season ? `${anilistApi.formatSeason(data.season)} ${data.seasonYear || ''}` : '';
  const episodeCount = data.episodes;
  const chapterCount = data.chapters;
  const volumeCount = data.volumes;
  const duration = data.duration;
  const genres = data.genres || [];
  const studio = data.studios?.nodes?.[0];
  const isAnime = data.type === 'ANIME';
  const isManga = data.type === 'MANGA';
  const relations = data.relations?.edges || [];
  const recommendations = data.recommendations?.nodes?.map(n => n.mediaRecommendation).filter(Boolean) || [];
  const characters = data.characters?.edges || [];
  const staff = data.staff?.edges || [];
  const rankings = data.rankings || [];
  const externalLinks = data.externalLinks || [];
  const readLinks = isManga ? externalLinks.filter(l => l.type === 'STREAMING' || l.type === 'INFO' || l.url) : [];
  const youtubeLink = externalLinks.find(l => l.url?.includes('youtube.com') || l.url?.includes('youtu.be'));
  const nextAiring = data.nextAiringEpisode;
  let airingString = '';
  let airingDateString = '';
  if (nextAiring) {
    const seconds = timeUntilAiring || nextAiring.timeUntilAiring;
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    airingString = `EP ${nextAiring.episode} in ${d}d ${h}h ${m}m ${s}s`;
    const date = new Date(nextAiring.airingAt * 1000);
    airingDateString = date.toLocaleString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  }
  // Handle episode chunks for large lists
  const visibleEpisodes = anikotoEpisodes.slice(0, visibleEpisodeCount);
  return (
    <div className="animate-in fade-in duration-700">
      {/* Global Cinematic Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2] transition-opacity duration-1000"
        style={{ 
          backgroundImage: backdrop ? `url('${backdrop}')` : cover ? `url('${cover}')` : undefined,
          opacity: bgTrailerReady ? 0 : 1,
        }}
      />
      {/* Background YouTube Trailer (muted, behind everything) */}
      {bgTrailer && (
        <div 
          className="fixed inset-0 z-[-2] overflow-hidden transition-opacity duration-1000"
          style={{ opacity: bgTrailerReady ? 1 : 0 }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 'max(177.78vh, 100vw)',
              height: 'max(56.25vw, 100vh)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
            <div ref={bgIframeRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}
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
            className="flex-shrink-0 w-[260px] group relative cursor-pointer"
            onClick={() => setIsPosterExpanded(true)}
          >
            <img
              src={cover}
              alt={title}
              className="rounded-xl shadow-2xl w-full aspect-[2/3] object-cover border border-white/10"
              style={{ boxShadow: data.coverImage?.color ? `0 10px 40px ${data.coverImage.color}40` : undefined }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl backdrop-blur-sm">
               <span className="font-bold uppercase tracking-widest text-sm text-white">Expand Poster</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h1 className={cn(
              "font-black mb-1 tracking-tight transition-all",
              isMobile ? "text-3xl" : isTv ? "text-7xl" : "text-4xl lg:text-5xl"
            )}>
              {title}
            </h1>
            {romajiTitle && romajiTitle !== title && (
              <p className="text-lg text-text-secondary font-light mb-1 italic">{romajiTitle}</p>
            )}
            {nativeTitle && (
              <p className="text-sm text-text-muted mb-6">{nativeTitle}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-6 text-sm opacity-90">
              <Badge variant="accent">{format}</Badge>
              <span className="border border-white/40 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">{status}</span>
              {season && <span>{season}</span>}
              {isAnime && episodeCount && <><span className="mx-1">•</span><span>{episodeCount} Episodes</span></>}
              {isAnime && duration && <><span className="mx-1">•</span><span>{duration} min/ep</span></>}
              {isManga && chapterCount && <><span className="mx-1">•</span><span>{chapterCount} Chapters</span></>}
              {isManga && volumeCount && <><span className="mx-1">•</span><span>{volumeCount} Volumes</span></>}
              {studio && <><span className="mx-1">•</span><span className="font-bold">{studio.name}</span></>}
            </div>
            <div className="flex items-center gap-6 mb-8">
              {score && (
                <div className="flex items-center gap-3 group cursor-help" title="AniList Score">
                  <div className="relative w-16 h-16 rounded-full bg-[#081c22] flex items-center justify-center border-[4px]"
                    style={{ borderColor: score >= 75 ? '#21d07a' : score >= 60 ? '#d2d531' : '#db2360' }}
                  >
                    <span className="text-xl font-black tracking-tighter">{score}<span className="text-[10px] opacity-60">%</span></span>
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle
                        cx="32" cy="32" r="28" fill="transparent"
                        stroke={score >= 75 ? '#21d07a' : score >= 60 ? '#d2d531' : '#db2360'}
                        strokeWidth="4"
                        strokeDasharray={`${(score / 100) * 176} 176`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-black leading-tight w-14 group-hover:text-accent transition-colors">AniList Score</span>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm">
                {data.popularity && (
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <UsersIcon className="w-4 h-4" />
                    <span className="font-bold">{data.popularity.toLocaleString()}</span>
                  </div>
                )}
                {data.favourites && (
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <HeartIcon className="w-4 h-4 text-red-500" />
                    <span className="font-bold">{data.favourites.toLocaleString()}</span>
                  </div>
                )}
              </div>
              {data.type !== 'MANGA' && data.format !== 'MUSIC' && data.trailer?.site === 'youtube' && (
                <button onClick={toggleTrailer} className="flex items-center gap-2 ml-4 hover:opacity-70 transition-opacity">
                  <PlayIcon className="w-5 h-5 fill-white" />
                  <span className="font-black text-sm uppercase tracking-wider">
                    {isPlayingTrailer ? 'Watch Now' : 'Play Trailer'}
                  </span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {genres.map(g => (
                <Link key={g} to={`/anime/browse?genre=${encodeURIComponent(g)}`} className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-bold text-text-secondary hover:text-accent hover:border-accent transition-all">
                  {g}
                </Link>
              ))}
            </div>
            {nextAiring && (
              <div className="mb-8 max-w-xl bg-accent/5 border border-accent/20 rounded-2xl p-4 md:p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-xs font-black text-accent tracking-widest uppercase">
                    Airing Soon
                  </span>
                </div>
                <div className="pl-5">
                  <p className="text-2xl md:text-3xl font-black text-white mb-1">
                    {airingString}
                  </p>
                  <p className="text-sm font-medium text-text-muted">
                    {airingDateString}
                  </p>
                </div>
              </div>
            )}
            <div className="max-w-2xl">
              <h3 className="text-lg font-black mb-2 uppercase tracking-tight">Synopsis</h3>
              <p className="leading-relaxed text-base opacity-95 line-clamp-4 hover:line-clamp-none transition-all cursor-default">
                {description}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-5 md:px-10 py-10 flex flex-col lg:flex-row gap-10">
        <div className="flex-1 min-w-0 space-y-12">
          {isAnime && data.format === 'MUSIC' && youtubeLink ? (
            /* ── MUSIC: YouTube Embed ── */
            <section id="anime-player-section">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Listen Now</h2>
              </div>
              <div className="aspect-video w-full rounded-2xl overflow-hidden border border-surface-light shadow-2xl bg-black">
                <iframe
                  src={youTubeEmbedUrl(extractYouTubeId(youtubeLink.url), { autoplay: 0 })}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={title}
                />
              </div>
            </section>
          ) : isAnime ? (
            /* ── ANIME: HLS Player + Episodes ── */
            <section id="anime-player-section">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">Watch Now</h2>
                  {activeEpisode && (
                    <Badge variant="accent" size="sm">EP {activeEpisode}</Badge>
                  )}
                </div>
                {/* Watch Together button */}
                <button
                  onClick={() => setWtModalOpen(true)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    wtRoomCode
                      ? "bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30"
                      : "bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30"
                  )}
                  title="Watch Together"
                >
                  <span className="flex items-center gap-1.5">
                    <WtUsersIcon className="w-4 h-4" />
                    {wtRoomCode ? 'Room Active' : 'Watch Together'}
                  </span>
                </button>
                {/* Download button — Android only */}
                {isAndroid() && playerSrc && isHls && (
                  <button
                    onClick={async () => {
                      const { downloadHls } = await import('../lib/downloader.js');
                      const title = `${data.title?.english || data.title?.romaji} - EP${activeEpisode}`;
                      const toast = (message, type = 'info') =>
                        window.dispatchEvent(new CustomEvent('miyo-toast', { detail: { message, type } }));
                      toast(`Downloading "${title}"… keep the app open.`);
                      let lastMilestone = 0;
                      downloadHls(playerSrc, '', title, (progress) => {
                        // Surface progress at 25/50/75% so users can see it's working
                        if (progress >= lastMilestone + 25 && progress < 100) {
                          lastMilestone = Math.floor(progress / 25) * 25;
                          toast(`Download ${lastMilestone}% — ${title}`);
                        }
                      }).then(() => {
                        toast(`Download complete: ${title}`, 'success');
                      }).catch(err => {
                        if (err.name !== 'AbortError') {
                          console.error('[Download] Failed:', err);
                          toast(`Download failed: ${err.message || 'unknown error'}`, 'error');
                        }
                      });
                    }}
                    className="px-4 py-2 bg-accent/20 border border-accent/40 text-accent rounded-lg text-sm font-bold hover:bg-accent/30 transition-all"
                    title="Download this episode"
                  >
                    ↓ Download
                  </button>
                )}
              </div>
              {/* Watch Together Bar (shows when in a room) */}
              <WatchTogetherBar onOpenModal={() => setWtModalOpen(true)} />
              {/* Player */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-surface-light bg-black mb-8 aspect-video">
                {loadingEpisode && !isPlayingTrailer ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-sm z-10">
                    <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : null}
                <VideoPlayer src={playerSrc} isHls={isHls} subtitles={hlsSubtitles} />
              </div>
              {/* Episodes List */}
              <div className="space-y-6">
                {anikotoEpisodes.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-black uppercase tracking-tight">Episodes</h3>
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                         <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">StrawVerse Native</span>
                      </div>
                    </div>
                    <div 
                      ref={episodesContainerRef}
                      className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 gap-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-surface-light scrollbar-track-transparent pb-4"
                    >
                      {visibleEpisodes.map(ep => {
                        const isActive = activeEpisode === ep.number;
                        return (
                          <button
                            key={ep.id}
                            onClick={() => handleEpisodeClick(ep.number, ep.id, audioPreference)}
                            className={cn(
                              "ep-btn group",
                              isActive ? "ep-btn-active col-span-3 sm:col-span-3 md:col-span-3 lg:col-span-3" : ""
                            )}
                            title={ep.title}
                          >
                            <span className="relative z-10 whitespace-nowrap tracking-wider">
                              {isActive ? "Now Playing" : ep.number}
                            </span>
                            {/* Audio indicator dots */}
                            {ep.lang && !isActive && (
                              <div className="absolute bottom-1 w-full flex justify-center gap-0.5 z-10">
                                {(ep.lang === 'sub' || ep.lang === 'both') && <div className="w-1 h-1 rounded-full bg-blue-400 opacity-60" title="Sub available" />}
                                {(ep.lang === 'dub' || ep.lang === 'both') && <div className="w-1 h-1 rounded-full bg-red-400 opacity-60" title="Dub available" />}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {visibleEpisodeCount < anikotoEpisodes.length && (
                      <Button 
                        variant="secondary" 
                        className="w-full mt-4 py-3 border-none rgb-pattern-bg text-white shadow-lg hover:opacity-90 transition-opacity font-black text-lg"
                        onClick={() => setVisibleEpisodeCount(prev => prev + 100)}
                      >
                        Load More Episodes ({Math.min(visibleEpisodeCount, anikotoEpisodes.length)} / {anikotoEpisodes.length})
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-surface/50 border border-surface-light rounded-2xl">
                    <p className="text-text-secondary font-medium">No episodes found on streaming provider.</p>
                    <p className="text-xs text-text-muted mt-2">Checking fallbacks...</p>
                  </div>
                )}
              </div>
            </section>
          ) : isManga && readLinks.length > 0 ? (
            /* ── MANGA: Read Links ── */
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Read Online</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {readLinks.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 bg-surface border border-surface-light rounded-2xl px-5 py-4 hover:border-accent hover:shadow-lg hover:shadow-accent/5 transition-all group"
                  >
                    <BookIcon className="w-6 h-6 text-accent animate-rgb-shift flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-black text-sm text-white group-hover:text-accent transition-colors">{link.site}</p>
                      <p className="text-xs text-text-muted truncate">{link.url}</p>
                    </div>
                    <ExternalIcon className="w-4 h-4 ml-auto text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </a>
                ))}
              </div>
            </section>
          ) : null}
          {characters.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Characters</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-surface-light">
                {characters.slice(0, 15).map(edge => (
                  <div key={edge.node.id} className="w-[140px] flex-shrink-0 bg-surface rounded-xl overflow-hidden border border-surface-light shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
                    <img
                      src={edge.node.image?.large || edge.node.image?.medium}
                      alt={edge.node.name.full}
                      className="w-full aspect-[4/5] object-cover"
                    />
                    <div className="p-3">
                      <p className="font-black text-sm text-white leading-tight truncate">{edge.node.name.full}</p>
                      <p className="text-xs text-text-muted leading-tight mt-1">{edge.role}</p>
                      {edge.voiceActors?.[0] && (
                        <p className="text-[10px] text-text-muted mt-1 truncate opacity-60">{edge.voiceActors[0].name.full}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {relations.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Relations</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-surface-light">
                {relations.map((edge, i) => (
                  <Link
                    key={i}
                    to={`/anime/${edge.node.id}/${slugify(edge.node.title?.english || edge.node.title?.romaji)}`}
                    className="w-[160px] flex-shrink-0 bg-surface rounded-xl overflow-hidden border border-surface-light shadow-md hover:shadow-xl transition-all hover:-translate-y-1 group"
                  >
                    <img
                      src={edge.node.coverImage?.large || edge.node.coverImage?.medium}
                      alt={edge.node.title?.userPreferred}
                      className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="p-3">
                      <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">{edge.relationType?.replace(/_/g, ' ')}</p>
                      <p className="font-bold text-xs text-white leading-tight truncate">{edge.node.title?.userPreferred || edge.node.title?.romaji}</p>
                      <p className="text-[10px] text-text-muted mt-1">{anilistApi.formatFormat(edge.node.format)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {staff.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1.5 h-6 bg-transparent border border-accent animate-rgb-shift rounded-full" />
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Staff</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-surface-light">
                {staff.slice(0, 12).map((edge, i) => (
                  <div key={i} className="w-[140px] flex-shrink-0 bg-surface rounded-xl overflow-hidden border border-surface-light shadow-md">
                    <img
                      src={edge.node.image?.large || edge.node.image?.medium}
                      alt={edge.node.name.full}
                      className="w-full aspect-[4/5] object-cover"
                    />
                    <div className="p-3">
                      <p className="font-black text-sm text-white leading-tight truncate">{edge.node.name.full}</p>
                      <p className="text-xs text-text-muted leading-tight mt-1 line-clamp-2">{edge.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {recommendations.length > 0 && (
            <AnimeRow title="You Might Also Like" items={recommendations} />
          )}
        </div>
        <div className="w-full lg:w-[300px] space-y-8">
          <div className="border-b border-surface-light mb-6" />
          <div className="space-y-5">
            <Fact label="Format" value={format} />
            <Fact label="Status" value={status} />
            {isAnime && <Fact label="Episodes" value={episodeCount || 'TBA'} />}
            {isAnime && <Fact label="Duration" value={duration ? `${duration} min` : '-'} />}
            {isManga && <Fact label="Chapters" value={chapterCount || 'TBA'} />}
            {isManga && <Fact label="Volumes" value={volumeCount || 'TBA'} />}
            <Fact label="Season" value={season || '-'} />
            <Fact label="Start Date" value={formatFuzzyDate(data.startDate)} />
            <Fact label="End Date" value={formatFuzzyDate(data.endDate)} />
            {studio && <Fact label="Studio" value={studio.name} />}
            <Fact label="Source" value={data.source?.replace(/_/g, ' ') || '-'} />
            <Fact label="Average Score" value={score ? `${score}%` : '-'} />
            <Fact label="Mean Score" value={data.meanScore ? `${data.meanScore}%` : '-'} />
            <Fact label="Popularity" value={data.popularity?.toLocaleString() || '-'} />
            <Fact label="Favorites" value={data.favourites?.toLocaleString() || '-'} />
          </div>
          {data.tags?.length > 0 && (
            <div>
              <h3 className="font-black text-lg text-white mb-4 uppercase tracking-tighter">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {data.tags.slice(0, 15).map(tag => (
                  <span
                    key={tag.id}
                    className="bg-surface border border-surface-light px-2.5 py-1 rounded-md text-[11px] font-bold text-text-secondary hover:text-accent hover:border-accent cursor-pointer transition-all"
                    title={`${tag.rank}% relevance`}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {rankings.length > 0 && (
            <div>
              <h3 className="font-black text-lg text-white mb-4 uppercase tracking-tighter">Rankings</h3>
              <div className="space-y-2">
                {rankings.slice(0, 5).map((rank, i) => (
                  <div key={i} className="flex items-center gap-3 bg-surface border border-surface-light rounded-xl px-4 py-3">
                    <span className="text-xl font-black text-accent animate-rgb-shift">#{rank.rank}</span>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {rank.type === 'RATED' ? 'Highest Rated' : 'Most Popular'}
                        {rank.allTime ? ' (All Time)' : ''}
                      </p>
                      {rank.season && rank.year && (
                        <p className="text-[10px] text-text-muted">{anilistApi.formatSeason(rank.season)} {rank.year}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!isManga && data.externalLinks?.length > 0 && (
            <div>
              <h3 className="font-black text-lg text-white mb-4 uppercase tracking-tighter">External Links</h3>
              <div className="space-y-2">
                {data.externalLinks.slice(0, 8).map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-surface border border-surface-light rounded-xl px-4 py-3 text-sm font-bold text-text-secondary hover:text-accent hover:border-accent transition-all group"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>{link.site}</span>
                    <ExternalIcon className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}
          <a
            href={data.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-surface border border-surface-light rounded-2xl p-4 text-center hover:border-accent transition-all group"
          >
            <p className="text-xs font-black uppercase tracking-widest text-text-muted group-hover:text-accent transition-colors">
              View on AniList →
            </p>
          </a>
        </div>
      </div>
      {isPosterExpanded && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl overflow-y-auto p-4 md:p-10 cursor-zoom-out animate-in fade-in duration-300"
          onClick={() => setIsPosterExpanded(false)}
        >
          <div className="min-h-full w-full flex items-center justify-center">
            <img 
              src={cover} 
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
      {/* Watch Together Modal */}
      <WatchTogetherModal
        isOpen={wtModalOpen}
        onClose={() => setWtModalOpen(false)}
        username={localStorage.getItem('miyo_wt_username') || 'Guest'}
        currentMedia={{
          playerSrc,
          isHls,
          subtitles: hlsSubtitles,
          title: data?.title?.english || data?.title?.romaji || '',
          poster: data?.coverImage?.extraLarge || data?.coverImage?.large || '',
          animeId: id,
          episodeNum: activeEpisode,
        }}
      />
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
        </div>
        <div className="w-[300px] space-y-6">
          <Skeleton className="w-full h-64 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
function ErrorView({ error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-3xl font-black text-white">NOT FOUND</h2>
      <p className="text-text-muted">{error || "The anime you're looking for doesn't exist or failed to load."}</p>
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
function formatFuzzyDate(date) {
  if (!date || !date.year) return '-';
  const parts = [date.year];
  if (date.month) parts.push(String(date.month).padStart(2, '0'));
  if (date.day) parts.push(String(date.day).padStart(2, '0'));
  return parts.join('/');
}
function PlayIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>;
}
function HeartIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
}
function UsersIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function LinkIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
function ExternalIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
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
function WtUsersIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function extractYouTubeId(url) {
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  return match ? match[1] : '';
}
