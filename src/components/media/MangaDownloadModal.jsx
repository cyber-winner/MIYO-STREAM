import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '../../lib/cn';
import { downloadMangaZip, sanitizeFileName } from '../../lib/mangaDownloader';

/**
 * Interactive Modal for downloading manga chapters as a structured ZIP archive.
 * 
 * ZIP Structure produced:
 *   <Manga Title>/
 *     Chapter 1/
 *       001.jpg
 *       002.jpg
 *     Chapter 2/
 *       001.jpg
 *       ...
 */
export function MangaDownloadModal({
  open,
  onClose,
  mangaTitle = 'Manga',
  chapters = [],
  provider = 'weebcentral',
  initialChapterId = null,
}) {
  const [mode, setMode] = useState('all'); // 'all' | 'range' | 'custom' | 'single'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [singleChapterId, setSingleChapterId] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Download execution state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('idle'); // 'idle' | 'downloading' | 'completed' | 'error'
  const [downloadError, setDownloadError] = useState(null);
  const abortControllerRef = useRef(null);

  // Initialize defaults when modal opens or chapters change
  useEffect(() => {
    if (!open) {
      setIsDownloading(false);
      setDownloadProgress(null);
      setDownloadStatus('idle');
      setDownloadError(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }

    if (chapters.length > 0) {
      const minNum = chapters[0].number !== undefined ? chapters[0].number : 1;
      const maxNum = chapters[chapters.length - 1].number !== undefined ? chapters[chapters.length - 1].number : chapters.length;
      setRangeStart(minNum);
      setRangeEnd(maxNum);

      if (initialChapterId) {
        setMode('single');
        setSingleChapterId(initialChapterId);
        setSelectedIds(new Set([initialChapterId]));
      } else {
        setMode('all');
        setSelectedIds(new Set(chapters.map(c => c.id)));
      }
    }
  }, [open, chapters, initialChapterId]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (isDownloading) {
          if (window.confirm('A manga download is currently in progress. Cancel download and close?')) {
            cancelDownload();
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isDownloading, onClose]);

  // Compute chapters to download based on chosen mode
  const targetChapters = useMemo(() => {
    if (!chapters || chapters.length === 0) return [];

    if (mode === 'all') {
      return [...chapters];
    }

    if (mode === 'single') {
      const found = chapters.find(c => c.id === singleChapterId);
      return found ? [found] : (chapters[0] ? [chapters[0]] : []);
    }

    if (mode === 'range') {
      const start = Math.min(Number(rangeStart) || 1, Number(rangeEnd) || 1);
      const end = Math.max(Number(rangeStart) || 1, Number(rangeEnd) || 1);
      return chapters.filter(c => {
        const num = c.number !== undefined ? c.number : 1;
        return num >= start && num <= end;
      });
    }

    if (mode === 'custom') {
      return chapters.filter(c => selectedIds.has(c.id));
    }

    return chapters;
  }, [chapters, mode, rangeStart, rangeEnd, singleChapterId, selectedIds]);

  // Toggle selection in custom mode
  const toggleChapter = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(chapters.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Quick range helper
  const applyPresetRange = (count, fromEnd = false) => {
    if (!chapters.length) return;
    if (fromEnd) {
      const last = chapters[chapters.length - 1]?.number || chapters.length;
      const start = Math.max(1, last - count + 1);
      setRangeStart(start);
      setRangeEnd(last);
    } else {
      const first = chapters[0]?.number || 1;
      const end = Math.min(chapters[chapters.length - 1]?.number || chapters.length, first + count - 1);
      setRangeStart(first);
      setRangeEnd(end);
    }
  };

  // Start the download
  const handleStartDownload = async () => {
    if (targetChapters.length === 0) return;

    setIsDownloading(true);
    setDownloadStatus('downloading');
    setDownloadError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await downloadMangaZip({
        mangaTitle,
        chapters: targetChapters,
        provider,
        signal: abortController.signal,
        onProgress: (prog) => {
          setDownloadProgress(prog);
        },
      });

      setDownloadStatus('completed');
      setIsDownloading(false);
      abortControllerRef.current = null;
    } catch (err) {
      if (abortController.signal.aborted) {
        setDownloadStatus('idle');
      } else {
        console.error('[MangaDownloadModal] Error downloading manga:', err);
        setDownloadError(err.message || 'Failed to download manga.');
        setDownloadStatus('error');
      }
      setIsDownloading(false);
      abortControllerRef.current = null;
    }
  };

  // Cancel in-progress download
  const cancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsDownloading(false);
    setDownloadStatus('idle');
    setDownloadProgress(null);
  };

  if (!open) return null;

  const safeFolderName = sanitizeFileName(mangaTitle);
  const sampleChapterName = targetChapters[0]
    ? (targetChapters[0].title?.startsWith('Chapter') ? targetChapters[0].title : `Chapter ${targetChapters[0].number || 1}`)
    : 'Chapter 1';

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={!isDownloading ? onClose : undefined}
    >
      <div
        className="relative bg-surface border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between bg-white/[0.02]">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <DownloadIcon className="w-5 h-5 text-accent animate-rgb-shift" />
              <h2 className="text-lg font-black text-white tracking-tight uppercase">
                Download Manga ZIP
              </h2>
            </div>
            <p className="text-xs text-text-secondary truncate">
              {mangaTitle} • {chapters.length} Total Chapter{chapters.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={isDownloading ? cancelDownload : onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Active Download Progress State */}
          {downloadStatus === 'downloading' && (
            <div className="space-y-5 py-4">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 text-accent mb-2">
                  <DownloadIcon className="w-7 h-7 animate-bounce" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Packaging Manga Chapters
                </h3>
                <p className="text-xs text-text-secondary">
                  {downloadProgress?.message || 'Processing chapters and panels...'}
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-accent uppercase tracking-wider">
                    {downloadProgress?.status === 'compressing'
                      ? 'Compressing ZIP'
                      : downloadProgress?.status === 'fetching_chapters'
                      ? 'Fetching Details'
                      : 'Downloading Panels'}
                  </span>
                  <span className="text-white text-sm">{downloadProgress?.percent || 0}%</span>
                </div>
                <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-pink-500 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(236,72,153,0.5)]"
                    style={{ width: `${downloadProgress?.percent || 0}%` }}
                  />
                </div>
              </div>

              {/* Progress Detail Cards */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Chapter Progress</p>
                  <p className="text-sm font-bold text-white mt-1">
                    {downloadProgress?.chapterIndex || 0} / {downloadProgress?.totalChapters || targetChapters.length}
                  </p>
                  <p className="text-[11px] text-text-secondary truncate mt-0.5">
                    {downloadProgress?.currentChapterTitle || 'Preparing...'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Panels in Chapter</p>
                  <p className="text-sm font-bold text-white mt-1">
                    {downloadProgress?.pageIndex || 0} / {downloadProgress?.totalPages || '—'}
                  </p>
                  <p className="text-[11px] text-text-secondary truncate mt-0.5">
                    3-digit padded (001.jpg)
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2">
                <InfoIcon className="w-4 h-4 flex-shrink-0" />
                <span>Please keep this tab open while downloading and packaging your archive.</span>
              </div>
            </div>
          )}

          {/* Completed State */}
          {downloadStatus === 'completed' && (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckIcon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Download Complete!</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Your browser has downloaded the ZIP archive containing {targetChapters.length} chapter{targetChapters.length !== 1 ? 's' : ''}.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 text-left text-xs font-mono space-y-1 max-w-md mx-auto text-text-secondary">
                <p className="text-emerald-400 font-bold mb-1">✓ ZIP Archive Hierarchy Created:</p>
                <p className="truncate text-white">📦 {safeFolderName}.zip</p>
                <p className="pl-4 text-white">└── 📁 {safeFolderName}/</p>
                <p className="pl-8 text-accent">├── 📁 {sampleChapterName}/</p>
                <p className="pl-12 text-text-muted">├── 001.jpg</p>
                <p className="pl-12 text-text-muted">├── 002.jpg ...</p>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => setDownloadStatus('idle')}
                  className="px-5 py-2.5 rounded-xl border border-border text-xs font-bold text-text-secondary hover:text-white hover:border-accent transition-all cursor-pointer"
                >
                  Download Another Range
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl cyber-gradient text-xs font-bold text-white hover:opacity-95 transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Error State */}
          {downloadStatus === 'error' && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs space-y-3">
              <div className="flex items-start gap-2">
                <AlertIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-red-300">Download Failed</p>
                  <p className="mt-1 text-text-secondary">{downloadError}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDownloadStatus('idle')}
                  className="px-4 py-2 rounded-lg bg-surface border border-border text-white font-bold hover:border-red-400 cursor-pointer"
                >
                  Dismiss & Adjust Selection
                </button>
                <button
                  onClick={handleStartDownload}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 cursor-pointer"
                >
                  Retry Download
                </button>
              </div>
            </div>
          )}

          {/* Selection State (Idle) */}
          {downloadStatus === 'idle' && (
            <>
              {/* Mode Selection Tabs */}
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-white/[0.04] rounded-xl border border-white/5">
                {[
                  { id: 'all', label: 'All Chapters', count: chapters.length },
                  { id: 'range', label: 'Range', count: null },
                  { id: 'custom', label: 'Select', count: selectedIds.size },
                  { id: 'single', label: 'Single Ch.', count: 1 },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMode(tab.id)}
                    className={cn(
                      "py-2 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                      mode === tab.id
                        ? "bg-accent text-white shadow-md shadow-accent/20"
                        : "text-text-secondary hover:text-white hover:bg-white/5"
                    )}
                  >
                    <div>{tab.label}</div>
                    {tab.count !== null && (
                      <div className={cn("text-[10px] mt-0.5", mode === tab.id ? "text-white/80" : "text-text-muted")}>
                        ({tab.count})
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Mode: Range Controls */}
              {mode === 'range' && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                        From Chapter
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={chapters[chapters.length - 1]?.number || chapters.length}
                        value={rangeStart}
                        onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                        To Chapter
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={chapters[chapters.length - 1]?.number || chapters.length}
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(parseInt(e.target.value) || 1)}
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Preset Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-text-muted uppercase font-bold mr-1">Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyPresetRange(5, false)}
                      className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-text-secondary hover:text-white hover:border-accent transition-colors"
                    >
                      First 5
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetRange(10, false)}
                      className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-text-secondary hover:text-white hover:border-accent transition-colors"
                    >
                      First 10
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetRange(25, false)}
                      className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-text-secondary hover:text-white hover:border-accent transition-colors"
                    >
                      First 25
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetRange(10, true)}
                      className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-text-secondary hover:text-white hover:border-accent transition-colors"
                    >
                      Latest 10
                    </button>
                  </div>
                </div>
              )}

              {/* Mode: Single Chapter Controls */}
              {mode === 'single' && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Select Chapter To Download
                  </label>
                  <select
                    value={singleChapterId || (chapters[0]?.id || '')}
                    onChange={(e) => setSingleChapterId(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent cursor-pointer"
                  >
                    {chapters.map((ch) => (
                      <option key={ch.id} value={ch.id} className="bg-surface text-white">
                        {ch.title || `Chapter ${ch.number}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mode: Custom Checkboxes List */}
              {mode === 'custom' && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Search chapters..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-accent"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-[11px] text-accent font-bold hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-text-muted">•</span>
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="text-[11px] text-text-muted font-bold hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {chapters
                      .filter((ch) => {
                        if (!searchFilter.trim()) return true;
                        const s = searchFilter.toLowerCase();
                        return (
                          String(ch.number).includes(s) ||
                          (ch.title && ch.title.toLowerCase().includes(s))
                        );
                      })
                      .map((ch) => {
                        const checked = selectedIds.has(ch.id);
                        return (
                          <label
                            key={ch.id}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors border",
                              checked
                                ? "bg-accent/10 border-accent/40 text-white"
                                : "bg-white/[0.02] border-white/5 text-text-secondary hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleChapter(ch.id)}
                              className="rounded border-border text-accent focus:ring-0 w-3.5 h-3.5"
                            />
                            <span className="flex-1 truncate">
                              {ch.title || `Chapter ${ch.number}`}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              #{ch.number}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Folder & Structure Preview */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                    <FolderIcon className="w-3.5 h-3.5 text-accent" />
                    Archive Structure Preview
                  </span>
                  <span className="text-[11px] font-bold text-accent">
                    {targetChapters.length} Chapter{targetChapters.length !== 1 ? 's' : ''} Selected
                  </span>
                </div>
                <div className="text-[11px] font-mono text-text-muted leading-relaxed pl-1 space-y-0.5">
                  <div className="text-white font-bold truncate">
                    📦 {safeFolderName}.zip
                  </div>
                  <div className="pl-3 text-text-secondary truncate">
                    └── 📁 {safeFolderName}/
                  </div>
                  <div className="pl-6 text-accent truncate">
                    ├── 📁 {sampleChapterName}/
                  </div>
                  <div className="pl-9 text-text-muted">
                    ├── 🖼️ 001.jpg
                  </div>
                  <div className="pl-9 text-text-muted">
                    ├── 🖼️ 002.jpg ...
                  </div>
                  {targetChapters.length > 1 && (
                    <div className="pl-6 text-accent/80 truncate">
                      └── 📁 ... (+{targetChapters.length - 1} more chapter folders)
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {downloadStatus === 'idle' && (
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="text-xs text-text-muted">
              {targetChapters.length === 0 ? (
                <span className="text-amber-400">Please select at least 1 chapter.</span>
              ) : (
                <span>Ready to download {targetChapters.length} chapter{targetChapters.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-white border border-border hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={targetChapters.length === 0}
                onClick={handleStartDownload}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg",
                  targetChapters.length === 0
                    ? "opacity-40 cursor-not-allowed bg-surface border border-border"
                    : "cyber-gradient hover:opacity-95 shadow-accent/20 active:scale-95"
                )}
              >
                <DownloadIcon className="w-4 h-4" />
                Download ZIP ({targetChapters.length})
              </button>
            </div>
          </div>
        )}

        {/* Footer when Downloading */}
        {downloadStatus === 'downloading' && (
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
            <span className="text-xs text-text-secondary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              Downloading & Zipping...
            </span>
            <button
              type="button"
              onClick={cancelDownload}
              className="px-4 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/30 transition-all cursor-pointer"
            >
              Cancel Download
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Icons ──

export function DownloadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function FolderIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}

function CloseIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function InfoIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function AlertIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
