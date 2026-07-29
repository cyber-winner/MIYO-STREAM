import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../lib/cn';

const MAX_LOGS = 500;

// Severity → pill color
const LEVEL_STYLES = {
  log:   'bg-text-muted/20 text-text-secondary',
  info:  'bg-blue-500/20 text-blue-400',
  warn:  'bg-yellow-500/20 text-yellow-400',
  error: 'bg-red-500/20 text-red-400',
  debug: 'bg-purple-500/20 text-purple-400',
};

function formatArg(arg) {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
  if (typeof arg === 'object') {
    try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
  }
  return String(arg);
}

export function DevConsole() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const bottomRef = useRef(null);
  const autoScroll = useRef(true);

  // Intercept console methods once
  useEffect(() => {
    const original = {};
    const methods = ['log', 'info', 'warn', 'error', 'debug'];
    const pushLog = (level, args) => {
      const entry = {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        level,
        message: args.map(formatArg).join(' '),
      };
      setLogs(prev => {
        const next = [...prev, entry];
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
      });
    };

    for (const m of methods) {
      original[m] = console[m];
      console[m] = (...args) => {
        original[m].apply(console, args);
        pushLog(m, args);
      };
    }

    // Catch unhandled errors + promise rejections
    const onError = (e) => pushLog('error', [`[Uncaught] ${e.message || e}`]);
    const onReject = (e) => pushLog('error', [`[UnhandledRejection] ${e.reason?.message || e.reason || e}`]);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onReject);

    return () => {
      for (const m of methods) console[m] = original[m];
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onReject);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleScroll = useCallback((e) => {
    const el = e.target;
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-10 py-8 md:py-14">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
          Dev<span className="text-accent animate-rgb-shift">Console</span>
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Live console output — errors, warnings, and logs from the app.
        </p>
      </header>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {['all', 'error', 'warn', 'info', 'log', 'debug'].map(level => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer',
              filter === level
                ? 'bg-accent/15 border-accent text-accent'
                : 'bg-transparent border-border text-text-muted hover:text-text-secondary hover:bg-white/5'
            )}
          >
            {level}
            {level !== 'all' && (
              <span className="ml-1.5 opacity-60">
                {logs.filter(l => l.level === level).length}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setLogs([])}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          Clear
        </button>
      </div>

      {/* Log output */}
      <div
        onScroll={handleScroll}
        className="rounded-xl border border-border bg-background/80 backdrop-blur font-mono text-xs overflow-y-auto"
        style={{ height: 'calc(100vh - 280px)', minHeight: 300 }}
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            No logs yet — interact with the app to see output here.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map(entry => (
              <div key={entry.id} className="flex gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                <span className="text-text-muted flex-shrink-0 w-[72px] tabular-nums">{entry.time}</span>
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 leading-[18px]', LEVEL_STYLES[entry.level] || LEVEL_STYLES.log)}>
                  {entry.level}
                </span>
                <pre className="whitespace-pre-wrap break-all text-text-primary flex-1 leading-relaxed">{entry.message}</pre>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
