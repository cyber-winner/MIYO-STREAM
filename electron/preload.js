/**
 * MIYO Electron Preload Script
 * 
 * Exposes a safe API bridge to the renderer process via contextBridge.
 * The renderer (React app) can call window.miyo.* methods without
 * having direct access to Node.js APIs.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('miyo', {
  // ── Platform info ──
  platform: process.platform,
  isElectron: true,

  // ── App info ──
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // ── FFmpeg ──
  getFfmpegPath: () => ipcRenderer.invoke('get-ffmpeg-path'),
  mergeWithFfmpeg: (opts) => ipcRenderer.invoke('merge-with-ffmpeg', opts),

  // ── File dialogs ──
  selectDownloadDirectory: () => ipcRenderer.invoke('select-download-directory'),

  // ── Window controls ──
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
});
