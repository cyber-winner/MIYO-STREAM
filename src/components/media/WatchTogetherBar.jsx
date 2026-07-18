import React, { useState, useEffect } from 'react';
import watchTogetherClient from '../../lib/watchTogetherClient';

export function WatchTogetherBar({ onOpenModal }) {
  const [roomCode, setRoomCode] = useState(watchTogetherClient.roomCode);
  const [userCount, setUserCount] = useState(watchTogetherClient.users.length);
  const [copied, setCopied] = useState(false);
  const [ping, setPing] = useState(0);

  useEffect(() => {
    const handleRoomJoined = (data) => setRoomCode(data.roomCode);
    const handleUsersChanged = (users) => setUserCount(users.length);
    const handleDisconnected = () => { setRoomCode(null); setUserCount(0); };
    const handlePing = (latency) => setPing(latency);

    watchTogetherClient.on('roomJoined', handleRoomJoined);
    watchTogetherClient.on('usersChanged', handleUsersChanged);
    watchTogetherClient.on('disconnected', handleDisconnected);
    watchTogetherClient.on('ping', handlePing);

    return () => {
      watchTogetherClient.off('roomJoined', handleRoomJoined);
      watchTogetherClient.off('usersChanged', handleUsersChanged);
      watchTogetherClient.off('disconnected', handleDisconnected);
      watchTogetherClient.off('ping', handlePing);
    };
  }, []);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeave = (e) => {
    e.stopPropagation();
    watchTogetherClient.disconnect();
  };

  if (!roomCode) return null;

  return (
    <div
      onClick={onOpenModal}
      className="flex items-center gap-3 px-4 py-2.5 mb-4 bg-accent/10 border border-accent/30 rounded-xl cursor-pointer hover:bg-accent/15 transition-all group"
    >
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-4 h-4">
          <div className="absolute w-3 h-3 rounded-full bg-accent/40 animate-ping" />
          <div className="relative w-2 h-2 rounded-full bg-accent" />
        </div>
        <span className="text-xs font-black text-accent uppercase tracking-[0.2em] font-mono">
          {roomCode}
        </span>
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        title="Copy Room Code"
        className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-text-secondary hover:text-accent hover:border-accent/30 transition-all"
      >
        {copied ? (
          <>
            <CheckSvg className="w-3 h-3 text-green-400" />
            <span className="text-green-400">Copied!</span>
          </>
        ) : (
          <>
            <CopySvg className="w-3 h-3" />
            <span>Copy</span>
          </>
        )}
      </button>

      {/* Users count */}
      <div className="flex items-center gap-1 text-text-secondary">
        <UsersSvg className="w-3.5 h-3.5" />
        <span className="text-xs font-bold">{userCount}</span>
      </div>

      {/* Ping */}
      {ping > 0 && (
        <span className="text-[10px] text-text-muted font-mono">{ping}ms</span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Open modal hint */}
      <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
        Open Room
      </span>

      {/* Leave button */}
      <button
        onClick={handleLeave}
        title="Leave Room"
        className="w-6 h-6 rounded-md flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
      >
        <LogOutSvg className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Mini SVG icons ───
function CopySvg({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CheckSvg({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function UsersSvg({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function LogOutSvg({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
