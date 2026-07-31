import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import watchTogetherClient from '../../lib/watchTogetherClient';
import voiceChatManager from '../../lib/voiceChat';
import { cn } from '../../lib/cn';

/**
 * WatchTogetherModal — Twitch-style layout with:
 * - @Mentions in chat (highlight + autocomplete)
 * - Voice chat controls (mic, deafen, per-user mute)
 * - Speaking indicators on user chips
 *
 * Desktop: right-side chat panel
 * Mobile:  bottom sheet
 * Setup:   two-step card (name → create/join)
 */
export function WatchTogetherModal({ isOpen, onClose, username = 'Guest', currentMedia = null }) {
  const navigate = useNavigate();
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatList, setChatList] = useState([]);
  const [roomCode, setRoomCode] = useState(watchTogetherClient.roomCode);
  const [isHost, setIsHost] = useState(watchTogetherClient.isHost);
  const [users, setUsers] = useState(watchTogetherClient.users);
  const [errorMsg, setErrorMsg] = useState('');
  const [nameInput, setNameInput] = useState(() => { try { return localStorage.getItem('miyo-wt-name') || username || ''; } catch { return username || ''; } });
  const [collapsed, setCollapsed] = useState(false);
  const [step, setStep] = useState('name');

  // Voice chat state
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceDeafened, setVoiceDeafened] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState([]);
  const [voiceStates, setVoiceStates] = useState({}); // { userID: { muted, deafened } }
  const [mutedUsers, setMutedUsers] = useState([]);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed, string = filter
  const [mentionIndex, setMentionIndex] = useState(0);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // ── WS event listeners ──
  useEffect(() => {
    const handleRoomJoined = (data) => { setRoomCode(data.roomCode); setIsHost(data.isHost); setErrorMsg(''); };
    const handleUsersChanged = (list) => setUsers([...list]);
    const handleChat = (msg) => setChatList(prev => [...prev, msg]);
    const handleError = (err) => setErrorMsg(err.message || 'Error');
    const handleDisconnected = () => { setRoomCode(null); setIsHost(false); setUsers([]); voiceChatManager.stop(); setVoiceActive(false); };

    watchTogetherClient.on('roomJoined', handleRoomJoined);
    watchTogetherClient.on('usersChanged', handleUsersChanged);
    watchTogetherClient.on('chatMessage', handleChat);
    watchTogetherClient.on('error', handleError);
    watchTogetherClient.on('disconnected', handleDisconnected);
    return () => {
      watchTogetherClient.off('roomJoined', handleRoomJoined);
      watchTogetherClient.off('usersChanged', handleUsersChanged);
      watchTogetherClient.off('chatMessage', handleChat);
      watchTogetherClient.off('error', handleError);
      watchTogetherClient.off('disconnected', handleDisconnected);
    };
  }, []);

  // ── Voice chat event listeners ──
  useEffect(() => {
    const handleState = ({ muted, deafened }) => { setVoiceMuted(muted); setVoiceDeafened(deafened); };
    const handleSpeaking = (ids) => setSpeakingUsers([...ids]);
    const handleVoiceStates = (states) => setVoiceStates({ ...states });
    const handleMutedUsers = (ids) => setMutedUsers([...ids]);
    const handleStopped = () => { setVoiceActive(false); setVoiceMuted(false); setVoiceDeafened(false); setSpeakingUsers([]); };

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatList]);

  // Check URL for auto-join param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wtCode = params.get('wt');
    if (wtCode && !roomCode) {
      const code = wtCode.toUpperCase();
      setJoinCodeInput(code);
      const savedName = (() => { try { return localStorage.getItem('miyo-wt-name'); } catch { return null; } })() || watchTogetherClient.username;
      
      if (isOpen && savedName) {
        // If they already have a name saved, instantly join and navigate
        watchTogetherClient.joinRoom(code, savedName).then(() => {
          navigateToRoom();
        }).catch(() => {});
      }
    }
  }, [isOpen, roomCode]);

  // ── Mentions ──
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users.filter(u => u.username?.toLowerCase().startsWith(q)).slice(0, 5);
  }, [mentionQuery, users]);

  // Navigate to the Watch Together page after the server confirms room join
  // Defined before the early return so auto-join useEffect can reference it
  const navigateToRoom = useCallback(() => {
    return new Promise((resolve) => {
      if (watchTogetherClient.roomCode) {
        if (currentMedia) watchTogetherClient.setCurrentMedia(currentMedia);
        onClose();
        navigate('/watch-together', { state: { media: currentMedia } });
        resolve();
        return;
      }
      const onJoined = () => {
        watchTogetherClient.off('roomJoined', onJoined);
        watchTogetherClient.off('error', onError);
        if (currentMedia) watchTogetherClient.setCurrentMedia(currentMedia);
        onClose();
        navigate('/watch-together', { state: { media: currentMedia } });
        resolve();
      };
      const onError = (err) => {
        watchTogetherClient.off('roomJoined', onJoined);
        watchTogetherClient.off('error', onError);
        setErrorMsg(err?.message || 'Failed to join room');
        resolve();
      };
      watchTogetherClient.on('roomJoined', onJoined);
      watchTogetherClient.on('error', onError);
      setTimeout(() => {
        watchTogetherClient.off('roomJoined', onJoined);
        watchTogetherClient.off('error', onError);
      }, 10000);
    });
  }, [currentMedia, onClose, navigate]);

  if (!isOpen) return null;

  const displayName = nameInput.trim() || 'Guest';
  const myName = watchTogetherClient.username || displayName;

  // ── Handlers ──

  const handleCreateRoom = async () => {
    try {
      setErrorMsg('');
      await watchTogetherClient.createRoom(displayName);
      await navigateToRoom();
    } catch { setErrorMsg('Failed to connect'); }
  };
  const handleJoinRoom = async () => {
    if (!joinCodeInput.trim()) return;
    try {
      setErrorMsg('');
      await watchTogetherClient.joinRoom(joinCodeInput.trim(), displayName);
      await navigateToRoom();
    } catch { setErrorMsg('Failed to join'); }
  };
  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const handleLeaveRoom = () => {
    voiceChatManager.stop();
    watchTogetherClient.disconnect();
    setRoomCode(null); setChatList([]);
  };
  const handleNameContinue = () => {
    if (!nameInput.trim()) return;
    localStorage.setItem('miyo-wt-name', nameInput.trim());
    
    // Auto-join if we have a join code from the URL (or if they typed it earlier)
    const params = new URLSearchParams(window.location.search);
    if (params.has('wt') && joinCodeInput.trim()) {
      handleJoinRoom();
    } else {
      setStep('room');
    }
  };
  const handleToggleVoice = async () => {
    if (voiceActive) {
      voiceChatManager.stop();
      setVoiceActive(false);
    } else {
      await voiceChatManager.start();
      setVoiceActive(true);
    }
  };
  const handleToggleMute = () => voiceChatManager.toggleMute();
  const handleToggleDeafen = () => voiceChatManager.toggleDeafen();
  const handleToggleMuteUser = (userID) => voiceChatManager.toggleMuteUser(userID);

  // -- Moved useMemo above --
  const handleChatInputChange = (e) => {
    const val = e.target.value;
    setChatMessage(val);
    // Detect @mention: find last @ not followed by a space
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
  };

  // ═══════════════════════════════════════════
  //  SETUP VIEW — two-step flow
  // ═══════════════════════════════════════════
  if (!roomCode) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          className="w-full sm:max-w-sm bg-[#18181b] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Watch Together
            </h3>
            <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">{errorMsg}</div>}

          {step === 'name' ? (
            <>
              <p className="text-xs text-[#adadb8] mb-3">Enter your display name to continue</p>
              <input
                type="text" maxLength={20} value={nameInput} autoFocus
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNameContinue()}
                className="w-full bg-[#0e0e10] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#adadb8] outline-none focus:border-[#9147ff] transition-colors mb-3"
                placeholder="Your name..."
              />
              <button
                onClick={handleNameContinue}
                disabled={!nameInput.trim()}
                className="w-full py-2.5 rounded-lg bg-[#9147ff] hover:bg-[#772ce8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStep('name')} className="text-[#adadb8] hover:text-white transition-colors">
                  <BackIcon className="w-4 h-4" />
                </button>
                <span className="text-xs text-[#adadb8]">
                  Joining as <b className="text-white">{nameInput.trim()}</b>
                </span>
              </div>

              <button onClick={handleCreateRoom} className="w-full py-2.5 rounded-lg bg-[#9147ff] hover:bg-[#772ce8] text-white text-sm font-semibold transition-colors mb-3">
                Create Room
              </button>

              <div className="flex items-center gap-2 text-xs text-[#adadb8] mb-3">
                <div className="flex-1 h-px bg-white/10" /> or join <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text" maxLength={6} value={joinCodeInput} autoFocus
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  className="flex-1 bg-[#0e0e10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center uppercase tracking-[0.25em] font-mono placeholder-[#adadb8] outline-none focus:border-[#9147ff] transition-colors"
                  placeholder="CODE"
                />
                <button onClick={handleJoinRoom} className="px-5 py-2 rounded-lg bg-[#9147ff] hover:bg-[#772ce8] text-white text-sm font-semibold transition-colors">
                  Join
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  ACTIVE ROOM — Twitch-style chat panel
  // ═══════════════════════════════════════════

  const renderUserChip = (u, i) => {
    const isSpeaking = speakingUsers.includes(u.id);
    const userVState = voiceStates[u.id];
    const isUserMuted = mutedUsers.includes(u.id);
    const isMe = u.id === watchTogetherClient.userID;

    return (
      <span
        key={i}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-white whitespace-nowrap flex-shrink-0 transition-all cursor-default",
          isSpeaking ? "bg-green-500/20 ring-1 ring-green-400/50" : "bg-white/5",
          isUserMuted && "opacity-50"
        )}
        onClick={() => { if (!isMe && voiceActive) handleToggleMuteUser(u.id); }}
        title={!isMe && voiceActive ? (isUserMuted ? 'Click to unmute' : 'Click to mute') : ''}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: userColor(i) }} />
        {u.username || 'Guest'}
        {u.isHost && <span className="text-[8px] text-[#9147ff] font-bold">★</span>}
        {userVState?.muted && <MicOffMiniIcon className="w-2.5 h-2.5 text-red-400 ml-0.5" />}
        {userVState?.deafened && <DeafenMiniIcon className="w-2.5 h-2.5 text-red-400 ml-0.5" />}
        {isUserMuted && <span className="text-[8px] text-red-400 ml-0.5">🔇</span>}
      </span>
    );
  };

  const renderChatMessage = (m, i) => {
    const isMention = m.message.toLowerCase().includes(`@${myName.toLowerCase()}`);
    return (
      <div key={i} className={cn(
        "text-[13px] leading-relaxed py-0.5 px-1 -mx-1 rounded",
        isMention ? "bg-[#9147ff]/10 border-l-2 border-[#9147ff]" : "hover:bg-white/[0.03]"
      )}>
        <span className="font-semibold mr-1" style={{ color: nameColor(m.sender) }}>{m.sender}</span>
        <span className="text-[#efeff1]">{renderMessageWithMentions(m.message)}</span>
      </div>
    );
  };

  const renderMentionAutocomplete = () => {
    if (mentionQuery === null || mentionSuggestions.length === 0) return null;
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1f1f23] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
        {mentionSuggestions.map((u, i) => (
          <button
            key={u.id}
            onClick={() => insertMention(u.username)}
            className={cn(
              "w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 transition-colors",
              i === mentionIndex ? "bg-[#9147ff]/30 text-white" : "text-[#adadb8] hover:bg-white/5"
            )}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: nameColor(u.username) }} />
            {u.username}
          </button>
        ))}
      </div>
    );
  };

  const renderVoiceControls = () => (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5 flex-shrink-0">
      <button
        onClick={handleToggleVoice}
        className={cn(
          "px-2 py-1 rounded text-[10px] font-semibold transition-all",
          voiceActive
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : "bg-white/5 text-[#adadb8] hover:text-white border border-white/10"
        )}
      >
        {voiceActive ? '🎙 Voice On' : '🎙 Voice'}
      </button>

      {voiceActive && (
        <>
          <button
            onClick={handleToggleMute}
            className={cn(
              "p-1.5 rounded transition-all",
              voiceMuted ? "bg-red-500/20 text-red-400" : "bg-white/5 text-[#adadb8] hover:text-white"
            )}
            title={voiceMuted ? 'Unmute' : 'Mute'}
          >
            {voiceMuted ? <MicOffIcon className="w-3.5 h-3.5" /> : <MicIcon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleToggleDeafen}
            className={cn(
              "p-1.5 rounded transition-all",
              voiceDeafened ? "bg-red-500/20 text-red-400" : "bg-white/5 text-[#adadb8] hover:text-white"
            )}
            title={voiceDeafened ? 'Undeafen' : 'Deafen'}
          >
            {voiceDeafened ? <DeafenIcon className="w-3.5 h-3.5" /> : <HeadphonesIcon className="w-3.5 h-3.5" />}
          </button>
        </>
      )}
    </div>
  );

  const renderChatInput = () => (
    <form onSubmit={handleSendChat} className="p-2 border-t border-white/10 flex-shrink-0 relative">
      {renderMentionAutocomplete()}
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          type="text" value={chatMessage}
          onChange={handleChatInputChange}
          onKeyDown={handleChatKeyDown}
          className="flex-1 bg-[#0e0e10] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white placeholder-[#636369] outline-none focus:border-[#9147ff] transition-colors"
          placeholder="Send a message"
        />
        <button type="submit" className="px-3 py-1.5 rounded-md bg-[#9147ff] hover:bg-[#772ce8] text-white text-xs font-semibold transition-colors">
          Chat
        </button>
      </div>
    </form>
  );

  return (
    <>
      {/* ── DESKTOP: Right side panel ── */}
      <div className={cn(
        "hidden md:flex fixed top-0 right-0 z-40 h-full flex-col transition-all duration-300",
        collapsed ? "w-10" : "w-[340px]"
      )}>
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-14 bg-[#18181b] border border-white/10 border-r-0 rounded-l-lg flex items-center justify-center text-[#adadb8] hover:text-white transition-colors z-50"
          title={collapsed ? 'Show chat' : 'Hide chat'}
        >
          <ChevronHIcon className={cn("w-3.5 h-3.5 transition-transform", collapsed ? "rotate-180" : "")} />
        </button>

        {collapsed ? (
          <div className="w-full h-full bg-[#18181b] border-l border-white/10 flex flex-col items-center pt-4 gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-bold text-[#adadb8] uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">Chat</span>
            <span className="text-[9px] font-mono text-[#9147ff] [writing-mode:vertical-lr] rotate-180">{roomCode}</span>
            {voiceActive && <span className="text-[9px] text-green-400 [writing-mode:vertical-lr] rotate-180">🎙</span>}
          </div>
        ) : (
          <div className="w-full h-full bg-[#18181b] border-l border-white/10 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wide">Room Chat</span>
              </div>
              <div className="flex items-center gap-1.5">
                <UsersIcon className="w-3 h-3 text-[#adadb8]" />
                <span className="text-xs font-semibold text-[#adadb8]">{users.length}</span>
              </div>
            </div>

            {/* Room info bar */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e0e10] border-b border-white/5 flex-shrink-0">
              <span className="text-[10px] font-mono font-bold text-[#9147ff] tracking-widest">{roomCode}</span>
              <button onClick={handleCopyCode} className="text-[10px] text-[#adadb8] hover:text-white transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <span className="text-[10px] text-[#636369] hidden md:inline ml-1 truncate max-w-[150px]">
                Tell friends to open this anime & paste code
              </span>
              <button onClick={handleLeaveRoom} className="ml-auto text-[10px] text-red-400 hover:text-red-300 transition-colors px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20">
                Leave
              </button>
            </div>

            {/* Users (horizontal chips) */}
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5 overflow-x-auto scrollbar-none flex-shrink-0">
              {users.map(renderUserChip)}
            </div>

            {/* Voice controls */}
            {renderVoiceControls()}

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-[#2f2f35] min-h-0">
              {chatList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#adadb8] text-xs gap-1">
                  <span>Welcome to the room!</span>
                  <span className="text-[10px] text-[#636369]">Type @ to mention someone</span>
                </div>
              ) : chatList.map(renderChatMessage)}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            {renderChatInput()}
          </div>
        )}
      </div>

      {/* ── MOBILE: Bottom panel ── */}
      <div className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 transition-all duration-300",
        collapsed ? "h-[40px]" : "h-[55vh]"
      )}>
        {/* Collapsed / handle bar */}
        <div
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 px-3 py-2 bg-[#18181b] border-t border-white/10 cursor-pointer select-none"
        >
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-[11px] font-mono font-bold text-[#9147ff] tracking-widest">{roomCode}</span>
          <UsersIcon className="w-3 h-3 text-[#adadb8]" />
          <span className="text-[11px] font-semibold text-[#adadb8]">{users.length}</span>
          {voiceActive && <span className="text-[11px] text-green-400">🎙</span>}

          {collapsed && chatList.length > 0 && (
            <span className="text-[11px] text-[#adadb8] truncate flex-1 ml-1">
              <b style={{ color: nameColor(chatList[chatList.length - 1]?.sender) }}>
                {chatList[chatList.length - 1]?.sender}:
              </b>{' '}
              {chatList[chatList.length - 1]?.message}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <button onClick={(e) => { e.stopPropagation(); handleLeaveRoom(); }}
              className="text-[10px] text-red-400 px-1.5 py-0.5 rounded bg-red-500/10">
              Leave
            </button>
            <ChevronIcon className={cn("w-3.5 h-3.5 text-[#adadb8] transition-transform", collapsed ? "" : "rotate-180")} />
          </div>
        </div>

        {/* Expanded content */}
        {!collapsed && (
          <div className="flex flex-col bg-[#18181b] border-t border-white/5" style={{ height: 'calc(55vh - 40px)' }}>
            {/* Voice controls */}
            {renderVoiceControls()}

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-[#2f2f35] min-h-0">
              {chatList.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[#adadb8] text-xs">
                  Type @ to mention someone
                </div>
              ) : chatList.map(renderChatMessage)}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            {renderChatInput()}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Parse @mentions in message text ───
function renderMessageWithMentions(text) {
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
function UsersIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function XIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function ChevronIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>;
}
function ChevronHIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function BackIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
}
function MicIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
}
function MicOffIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
}
function MicOffMiniIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="currentColor"><path d="M13 8c0 .564-.094 1.107-.266 1.613l-.814-.814A3.5 3.5 0 0 0 12.5 8h1zm-4.5 3.5a3.5 3.5 0 0 1-3.311-2.38l-.814.814A4.5 4.5 0 0 0 7.5 12.95V14H6v1h4v-1H8.5v-1.05A4.502 4.502 0 0 0 12.5 8.5h-1A3.5 3.5 0 0 1 8.5 11.5zM4.5 8c0-.178.013-.353.04-.525L3.03 5.966A4.992 4.992 0 0 0 3 8.5h1c0-.168.014-.335.04-.5H4.5zm4-7a3.5 3.5 0 0 1 3.5 3.5v2.5l.001.127L13.464 8.59l.006-.09H13V4.5a4.5 4.5 0 0 0-9 0v.55L1.354 2.404.646 3.111l12 12 .708-.707L5.5 6.55V4.5A3.5 3.5 0 0 1 8.5 1z"/></svg>;
}
function HeadphonesIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>;
}
function DeafenIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/><line x1="1" y1="1" x2="23" y2="23" strokeWidth="2.5"/></svg>;
}
function DeafenMiniIcon({ className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a6 6 0 0 0-6 6v4h2v-2a1 1 0 0 1 1-1h1V7a4 4 0 0 1 8 0v1h1a1 1 0 0 1 1 1v2h2V7a6 6 0 0 0-6-6zM1.5 1L14 13.5l.5-.5L2 .5z"/></svg>;
}
