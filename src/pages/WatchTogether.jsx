import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import watchTogetherClient from '../lib/watchTogetherClient';
import voiceChatManager from '../lib/voiceChat';
import { VideoPlayer } from '../components/media/VideoPlayer';
import { cn } from '../lib/cn';

/**
 * WatchTogether — Full-page Twitch/Discord-style watch party.
 * Renders OUTSIDE AppShell for full immersion.
 *
 * Desktop:  [Video + Participants + Voice] | [Chat Panel]
 * Mobile:   Video → Participants → Voice → Chat (stacked)
 *
 * Back button keeps room alive. Only "Leave Room" disconnects.
 */
export function WatchTogether() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentMedia, setCurrentMedia] = useState(location.state?.media || watchTogetherClient.getCurrentMedia());

  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState(null);
  const [tempUsername, setTempUsername] = useState(localStorage.getItem('miyo-wt-name') || '');

  const [joinError, setJoinError] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatList, setChatList] = useState([]);
  const [roomCode, setRoomCode] = useState(watchTogetherClient.roomCode || null);
  const [isHost, setIsHost] = useState(watchTogetherClient.isHost);
  const [users, setUsers] = useState([...watchTogetherClient.users]);
  const [copied, setCopied] = useState(false);

  // Voice chat state
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceDeafened, setVoiceDeafened] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState([]);
  const [voiceStates, setVoiceStates] = useState({});
  const [mutedUsers, setMutedUsers] = useState([]);

  // Mention autocomplete
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Sync lock to prevent feedback loops
  const wtSyncLock = useRef(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const myName = watchTogetherClient.username || 'Guest';

  // ── Sync roomCode from client on mount or auto-join from URL ──
  useEffect(() => {
    const code = watchTogetherClient.roomCode;
    if (code && !roomCode) {
      setRoomCode(code);
      setIsHost(watchTogetherClient.isHost);
      setUsers([...watchTogetherClient.users]);
    } else if (!code && !roomCode) {
      const params = new URLSearchParams(location.search);
      const wtCode = params.get('wt');
      if (wtCode) {
        const joinCode = wtCode.toUpperCase();
        const savedName = localStorage.getItem('miyo-wt-name') || watchTogetherClient.username;
        if (savedName) {
          watchTogetherClient.joinRoom(joinCode, savedName).catch((err) => {
            console.error("Failed to auto-join room from URL:", err);
            setJoinError("Failed to connect to the server. Please try again.");
          });
        } else {
          setPendingJoinCode(joinCode);
          setShowUsernamePrompt(true);
        }
      }
    }
  }, [location.search, roomCode]);

  // ── WS event listeners ──
  useEffect(() => {
    const handleRoomJoined = (data) => {
      setRoomCode(data.roomCode);
      setIsHost(data.isHost);
      setJoinError(null);
    };
    const handleUsersChanged = (list) => setUsers([...list]);
    const handleChat = (msg) => setChatList(prev => [...prev, msg]);
    const handleMediaSync = (media) => setCurrentMedia(media);
    const handleDisconnected = () => {
      setRoomCode(null);
      setIsHost(false);
      setUsers([]);
      voiceChatManager.stop();
      setVoiceActive(false);
      setJoinError("Disconnected from server.");
    };

    watchTogetherClient.on('roomJoined', handleRoomJoined);
    watchTogetherClient.on('usersChanged', handleUsersChanged);
    watchTogetherClient.on('chatMessage', handleChat);
    watchTogetherClient.on('mediaStateSync', handleMediaSync);
    watchTogetherClient.on('disconnected', handleDisconnected);
    return () => {
      watchTogetherClient.off('roomJoined', handleRoomJoined);
      watchTogetherClient.off('usersChanged', handleUsersChanged);
      watchTogetherClient.off('chatMessage', handleChat);
      watchTogetherClient.off('mediaStateSync', handleMediaSync);
      watchTogetherClient.off('disconnected', handleDisconnected);
    };
  }, []);

  // ══════════════════════════════════════════
  //  VIDEO SYNC — incoming events from peers
  // ══════════════════════════════════════════
  useEffect(() => {
    if (!roomCode) return;

    const handlePlayPause = ({ isPlaying, timestamp }) => {
      const video = document.querySelector('.wt-player-override video');
      if (!video || wtSyncLock.current) return;
      wtSyncLock.current = true;
      video.currentTime = timestamp;
      if (isPlaying) video.play().catch(() => {});
      else video.pause();
      setTimeout(() => { wtSyncLock.current = false; }, 500);
    };

    const handleTimeSync = ({ timestamp, speed }) => {
      const video = document.querySelector('.wt-player-override video');
      if (!video || wtSyncLock.current) return;
      wtSyncLock.current = true;
      if (Math.abs(video.currentTime - timestamp) > 2) {
        video.currentTime = timestamp;
      }
      video.playbackRate = speed;
      setTimeout(() => { wtSyncLock.current = false; }, 500);
    };

    const handleCaptionSync = ({ trackLabel }) => {
      const video = document.querySelector('.wt-player-override video');
      if (!video) return;
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = (tracks[i].label === trackLabel) ? 'showing' : 'disabled';
      }
    };

    watchTogetherClient.on('playPause', handlePlayPause);
    watchTogetherClient.on('timeSync', handleTimeSync);
    watchTogetherClient.on('captionSync', handleCaptionSync);
    return () => {
      watchTogetherClient.off('playPause', handlePlayPause);
      watchTogetherClient.off('timeSync', handleTimeSync);
      watchTogetherClient.off('captionSync', handleCaptionSync);
    };
  }, [roomCode]);

  // ══════════════════════════════════════════════
  //  VIDEO SYNC — outgoing events to peers
  // ══════════════════════════════════════════════
  useEffect(() => {
    if (!roomCode) return;
    // Wait a tick for the video element to mount
    const timer = setTimeout(() => {
      const video = document.querySelector('.wt-player-override video');
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
      const onTrackChange = () => {
        if (wtSyncLock.current) return;
        const tracks = video.textTracks;
        for (let i = 0; i < tracks.length; i++) {
          if (tracks[i].mode === 'showing') {
            watchTogetherClient.sendCaptionSync(tracks[i].label);
            return;
          }
        }
        watchTogetherClient.sendCaptionSync('');
      };

      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('seeked', onSeeked);
      if (video.textTracks) {
        video.textTracks.addEventListener('change', onTrackChange);
      }

      // Store cleanup ref
      video._wtCleanup = () => {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('seeked', onSeeked);
        if (video.textTracks) {
          video.textTracks.removeEventListener('change', onTrackChange);
        }
      };
    }, 500);

    return () => {
      clearTimeout(timer);
      const video = document.querySelector('.wt-player-override video');
      if (video?._wtCleanup) {
        video._wtCleanup();
        delete video._wtCleanup;
      }
    };
  }, [roomCode, currentMedia?.playerSrc]);

  // ── Voice chat event listeners ──
  useEffect(() => {
    const handleState = ({ muted, deafened }) => {
      setVoiceMuted(muted);
      setVoiceDeafened(deafened);
    };
    const handleSpeaking = (ids) => setSpeakingUsers([...ids]);
    const handleVoiceStates = (states) => setVoiceStates({ ...states });
    const handleMutedUsers = (ids) => setMutedUsers([...ids]);
    const handleStopped = () => {
      setVoiceActive(false);
      setVoiceMuted(false);
      setVoiceDeafened(false);
      setSpeakingUsers([]);
    };

    voiceChatManager.on('stateChanged', handleState);
    voiceChatManager.on('speakingChanged', handleSpeaking);
    voiceChatManager.on('voiceStatesChanged', handleVoiceStates);
    voiceChatManager.on('mutedUsersChanged', handleMutedUsers);
    voiceChatManager.on('stopped', handleStopped);
    return () => {
      voiceChatManager.off('stateChanged', handleState);
      voiceChatManager.off('speakingChanged', handleSpeaking);
      voiceChatManager.off('voiceStatesChanged', handleVoiceStates);
      voiceChatManager.off('mutedUsersChanged', handleMutedUsers);
      voiceChatManager.off('stopped', handleStopped);
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatList]);

  // ── Mention suggestions ──
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users.filter(u => u.username?.toLowerCase().startsWith(q)).slice(0, 5);
  }, [mentionQuery, users]);

  // ── Handlers ──
  const handleLeaveRoom = () => {
    voiceChatManager.stop();
    watchTogetherClient.disconnect();
    setRoomCode(null);
    setChatList([]);
    navigate(-1);
  };

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleVoice = async () => {
    if (voiceActive) {
      voiceChatManager.stop();
      setVoiceActive(false);
    } else {
      await voiceChatManager.start();
      setVoiceActive(true);
    }
    voiceChatManager.retryAutoplay();
  };

  const handleToggleMute = () => {
    voiceChatManager.toggleMute();
    voiceChatManager.retryAutoplay();
  };
  const handleToggleDeafen = () => {
    voiceChatManager.toggleDeafen();
    voiceChatManager.retryAutoplay();
  };
  const handleToggleMuteUser = (userID) => voiceChatManager.toggleMuteUser(userID);

  const handleChatInputChange = (e) => {
    const val = e.target.value;
    setChatMessage(val);
    const cursor = e.target.selectionStart;
    const before = val.substring(0, cursor);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (username) => {
    const cursor = inputRef.current?.selectionStart || chatMessage.length;
    const before = chatMessage.substring(0, cursor);
    const after = chatMessage.substring(cursor);
    const newBefore = before.replace(/@\w*$/, `@${username} `);
    setChatMessage(newBefore + after);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleChatKeyDown = (e) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionSuggestions.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionIndex].username);
        return;
      }
      else if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    watchTogetherClient.sendChatMessage(chatMessage);
    setChatMessage('');
    setMentionQuery(null);
    inputRef.current?.focus();
    voiceChatManager.retryAutoplay();
  };

  const handleBack = () => {
    navigate(-1);
  };

  // If not in a room, show a simple "not connected" state (NO redirect)
  if (!roomCode) {
    if (showUsernamePrompt) {
      return (
        <div className="fixed inset-0 z-50 bg-[#0e0e10] flex items-center justify-center text-white p-4">
          <div className="bg-surface p-6 rounded-xl border border-white/10 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Join Room: {pendingJoinCode}</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!tempUsername.trim()) return;
              localStorage.setItem('miyo-wt-name', tempUsername.trim());
              setShowUsernamePrompt(false);
              watchTogetherClient.joinRoom(pendingJoinCode, tempUsername.trim()).catch((err) => {
                setJoinError("Failed to connect");
              });
            }}>
              <input 
                autoFocus
                type="text" 
                value={tempUsername}
                onChange={e => setTempUsername(e.target.value)}
                placeholder="Enter your display name"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 mb-4 text-sm text-white placeholder-[#636369] outline-none focus:border-[#9147ff]/60"
              />
              <button type="submit" className="w-full bg-[#9147ff] hover:bg-[#772ce8] py-2.5 rounded-lg font-bold text-sm transition-colors">
                Join Room
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 bg-[#0e0e10] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          {joinError ? (
            <p className="text-sm text-red-400">{joinError}</p>
          ) : (
            <div className="w-8 h-8 border-2 border-[#9147ff] border-t-transparent rounded-full animate-spin mx-auto" />
          )}
          <p className="text-sm text-[#adadb8]">{joinError ? '' : 'Connecting to room...'}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-[#636369] hover:text-white underline transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 bg-[#0e0e10] flex flex-col text-white overflow-hidden">

      {/* ── HEADER BAR ── */}
      <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-[#18181b] border-b border-white/[0.06] flex-shrink-0">
        <button onClick={handleBack} className="flex items-center gap-1 text-[#adadb8] hover:text-white transition-colors" title="Go back (room stays active)">
          <BackIcon className="w-4 h-4" />
          <span className="text-xs font-medium hidden sm:inline">Back</span>
        </button>

        <div className="flex items-center gap-1.5">
          <div className="relative w-2 h-2">
            <div className="absolute inset-0 rounded-full bg-red-500 animate-pulse" />
          </div>
          <span className="text-[11px] font-black text-[#9147ff] uppercase tracking-widest font-mono">{roomCode}</span>
        </div>

        <button onClick={handleCopyCode} className="text-[10px] text-[#adadb8] hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/[0.06] transition-all font-semibold hidden sm:block">
          {copied ? '✓ Copied' : 'Copy Code'}
        </button>
        
        <span className="text-[10px] text-[#636369] hidden md:inline ml-2 truncate">
          Tell friends to open this anime and paste the code to join!
        </span>

        <div className="flex items-center gap-1 text-[#adadb8]">
          <UsersIcon className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold">{users.length}</span>
        </div>

        {currentMedia?.title && (
          <span className="text-[11px] text-[#adadb8] truncate max-w-[160px] hidden lg:inline">
            {currentMedia.title}
          </span>
        )}

        <div className="flex-1" />

        <button onClick={handleLeaveRoom} className="text-[10px] text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all font-bold">
          Leave
        </button>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

        {/* ════ LEFT: Video + Participants + Voice Controls ════ */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {currentMedia?.title && (
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-surface/50 border-b border-white/5">
              <h2 className="font-black text-lg text-white/90 truncate">
                {currentMedia.title}
              </h2>
            </div>
          )}

          {/* Video Player */}
          <div className="flex-1 min-h-0 bg-black relative">
            <div className="w-full h-full wt-player-override">
              {currentMedia?.playerSrc ? (
                <VideoPlayer
                  src={currentMedia.playerSrc}
                  isHls={currentMedia.isHls}
                  subtitles={currentMedia.subtitles}
                  className="!space-y-0"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#adadb8]">
                  <div className="text-center">
                    <ScreenIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-semibold">No video loaded</p>
                    <p className="text-xs text-[#636369] mt-1">The host will load a video</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── PARTICIPANTS + VOICE (horizontal strip below video) ── */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#18181b] border-t border-white/[0.06] flex-shrink-0 overflow-hidden">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleToggleVoice}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all",
                  voiceActive
                    ? "bg-green-500/15 text-green-400 border border-green-500/25"
                    : "bg-white/5 text-[#adadb8] hover:text-white border border-white/10"
                )}
              >
                {voiceActive ? <><PhoneIcon className="w-3.5 h-3.5" /> Connected</> : <><PhoneOffIcon className="w-3.5 h-3.5" /> Voice</>}
              </button>

              {voiceActive && (
                <>
                  <button onClick={handleToggleMute} className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", voiceMuted ? "bg-red-500/20 text-red-400" : "bg-white/5 text-[#adadb8] hover:text-white")} title={voiceMuted ? 'Unmute' : 'Mute'}>
                    {voiceMuted ? <MicOffIcon className="w-3.5 h-3.5" /> : <MicIcon className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={handleToggleDeafen} className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", voiceDeafened ? "bg-red-500/20 text-red-400" : "bg-white/5 text-[#adadb8] hover:text-white")} title={voiceDeafened ? 'Undeafen' : 'Deafen'}>
                    {voiceDeafened ? <DeafenIcon className="w-3.5 h-3.5" /> : <HeadphonesIcon className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => { voiceChatManager.stop(); setVoiceActive(false); }} className="w-7 h-7 rounded-md flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/25 transition-all" title="Disconnect">
                    <PhoneOffIcon className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            <div className="w-px h-6 bg-white/10 flex-shrink-0 hidden sm:block" />

            <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0">
              {users.map((u, i) => {
                const isSpeaking = speakingUsers.includes(u.id);
                const userVState = voiceStates[u.id];
                const isUserMuted = mutedUsers.includes(u.id);
                const isMe = u.id === watchTogetherClient.userID;

                return (
                  <button
                    key={u.id}
                    onClick={() => { if (!isMe && voiceActive) handleToggleMuteUser(u.id); }}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all flex-shrink-0 text-left",
                      isSpeaking ? "bg-green-500/10 ring-1 ring-green-400/40" : "bg-white/[0.03] hover:bg-white/[0.06]",
                      isUserMuted && "opacity-40",
                      voiceActive && !isMe && !userVState?.active && "opacity-30 grayscale"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0",
                      isSpeaking && "ring-[1.5px] ring-green-400"
                    )} style={{ backgroundColor: userColor(i) }}>
                      {(u.username || 'G')[0].toUpperCase()}
                    </div>
                    <span className="text-[10px] font-semibold text-white/80 truncate max-w-[60px]">
                      {u.username || 'Guest'}
                    </span>
                    {u.isHost && <span className="text-[8px] text-[#9147ff]">★</span>}
                    {userVState?.muted && userVState?.active && <MicOffIcon className="w-2.5 h-2.5 text-red-400/60" />}
                  </button>
                );
              })}
            </div>

            {voiceActive && (
              <span className="text-[9px] text-green-400/50 font-mono flex-shrink-0 hidden lg:inline">
                Voice • {users.length}
              </span>
            )}
          </div>
        </div>

        {/* ════ RIGHT: Chat Panel ════ */}
        <div className={cn(
          "flex flex-col bg-[#18181b] border-l border-white/[0.06]",
          "w-full md:w-[320px] lg:w-[360px] flex-shrink-0",
          "h-[40vh] md:h-auto"
        )}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <ChatIcon className="w-3 h-3 text-[#9147ff]" />
              <span className="text-[11px] font-bold text-white uppercase tracking-wide">Chat</span>
            </div>
            <span className="text-[9px] text-[#636369]">{chatList.length} msgs</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 min-h-0">
            {chatList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#adadb8] gap-1.5">
                <ChatIcon className="w-6 h-6 opacity-15" />
                <span className="text-[11px] font-semibold">Welcome to the room!</span>
                <span className="text-[9px] text-[#636369]">Type @ to mention someone</span>
              </div>
            ) : chatList.map((m, i) => {
              const isMention = m.message?.toLowerCase().includes(`@${myName.toLowerCase()}`);
              return (
                <div key={i} className={cn(
                  "text-[13px] leading-relaxed py-0.5 px-1.5 -mx-1.5 rounded",
                  isMention ? "bg-[#9147ff]/10 border-l-2 border-[#9147ff]" : "hover:bg-white/[0.02]"
                )}>
                  <span className="font-semibold mr-1" style={{ color: nameColor(m.sender) }}>
                    {m.sender}
                  </span>
                  <span className="text-[#efeff1]">{renderMessageWithMentions(m.message)}</span>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="px-2.5 py-2 border-t border-white/[0.06] flex-shrink-0 relative">
            {mentionQuery !== null && mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 mx-2.5 bg-[#1f1f23] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
                {mentionSuggestions.map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => insertMention(u.username)}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-[12px] flex items-center gap-2 transition-colors",
                      i === mentionIndex ? "bg-[#9147ff]/25 text-white" : "text-[#adadb8] hover:bg-white/5"
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: nameColor(u.username) }} />
                    {u.username}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={chatMessage}
                onChange={handleChatInputChange}
                onKeyDown={handleChatKeyDown}
                className="flex-1 bg-[#0e0e10] border border-white/10 rounded-md px-2.5 py-1.5 text-[13px] text-white placeholder-[#636369] outline-none focus:border-[#9147ff]/60 transition-colors"
                placeholder="Send a message"
              />
              <button type="submit" className="px-3 py-1.5 rounded-md bg-[#9147ff] hover:bg-[#772ce8] text-white text-[11px] font-bold transition-colors flex-shrink-0">
                Chat
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Player style overrides */}
      <style>{`
        .wt-player-override .player-container {
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
          aspect-ratio: unset !important;
          height: 100% !important;
        }
        .wt-player-override .player-container iframe,
        .wt-player-override .player-container video {
          border-radius: 0 !important;
        }
        .wt-player-override > div {
          height: 100% !important;
        }
        .wt-player-override > div > .relative {
          height: 100% !important;
        }
        .wt-player-override > div > .relative > .player-container {
          height: 100% !important;
        }
      `}</style>
    </div>
  );
}

// ─── Parse @mentions in message text ───
function renderMessageWithMentions(text) {
  if (!text) return text;
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="font-semibold text-[#9147ff] bg-[#9147ff]/10 rounded px-0.5">{part}</span>;
    }
    return part;
  });
}

// ─── Twitch-style name colors ───
const COLORS = ['#FF6B6B','#4ECDC4','#FFE66D','#A8E6CF','#FF8B94','#6C5CE7','#FFA07A','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#F0B27A','#82E0AA','#D7BDE2','#F8C471'];
function nameColor(name) {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}
function userColor(index) { return COLORS[index % COLORS.length]; }

// ─── Icons ───
function BackIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
}
function UsersIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function ChatIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function ScreenIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
}
function MicIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
}
function MicOffIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
}
function HeadphonesIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>;
}
function DeafenIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/><line x1="1" y1="1" x2="23" y2="23" strokeWidth="2.5"/></svg>;
}
function PhoneIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function PhoneOffIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>;
}
