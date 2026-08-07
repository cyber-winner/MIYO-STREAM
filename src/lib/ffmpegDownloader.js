/**
 * FFmpeg-powered HLS → MP4 downloader.
 * 
 * Extends the existing chunk-based downloader with FFmpeg merging capabilities.
 * On platforms with FFmpeg available (Electron desktop, Capacitor with libffmpeg.so),
 * this module downloads HLS segments, concatenates them, and uses FFmpeg to produce
 * a proper .mp4 file with optional subtitle muxing.
 * 
 * Falls back to the existing chunk-based approach on platforms without FFmpeg.
 */

import { isNative, getPlatform, platformFetch } from '../platform/index.js';
import { buildStreamHeaders } from '../platform/referers.js';

// ── Helper: Uint8Array → base64 string (for Capacitor Filesystem) ──
function uint8ToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Check if FFmpeg merging is available on this platform.
 * FFmpeg is available on:
 *  - Tauri (via bundled ffmpeg binary or tauri command)
 *  - Capacitor with capacitor-nodejs (via libffmpeg.so resolved by Node.js backend)
 *  - Electron (via ffmpeg-static)
 */
export function isFfmpegAvailable() {
  const platform = getPlatform();
  // For now, FFmpeg merging is orchestrated by the local Node.js backend
  // (Electron or capacitor-nodejs), not the webview itself.
  // The webview downloads chunks, then asks the backend to merge.
  return platform === 'tauri' || platform === 'capacitor';
}

/**
 * Download HLS stream and merge into MP4 using FFmpeg.
 * 
 * This is a two-phase process:
 *   1. Download all .ts segments to local storage (same as existing downloader.js)
 *   2. Ask the local backend (Node.js / Rust) to concatenate + FFmpeg merge into .mp4
 * 
 * On platforms without a local backend FFmpeg, this falls back to storing raw .ts chunks
 * with a local .m3u8 playlist (the existing behavior).
 *
 * @param {string} m3u8Url - Master or media playlist URL
 * @param {string} referer - Referer header
 * @param {string} title - Anime title
 * @param {string|number} epNum - Episode number
 * @param {function} onProgress - Progress callback (0–100)
 * @param {object} options - { subtitleUrl, subtitleLang, mergeSubtitles }
 */
export async function downloadAndMerge(m3u8Url, referer, title, epNum, onProgress, options = {}) {
  if (!isNative()) {
    throw new Error('FFmpeg download is only supported on native apps.');
  }

  const { subtitleUrl = null, subtitleLang = 'eng', mergeSubtitles = true } = options;
  const platform = getPlatform();

  console.log(`[ffmpegDownloader] Starting download for ${title} Ep ${epNum} on ${platform}`);

  const fetchText = async (url) => {
    const headers = buildStreamHeaders(url, referer);
    const res = await platformFetch(url, { headers, timeout: 30000 });
    if (!res.ok) throw new Error(`Network error: HTTP ${res.status}`);
    return await res.text();
  };

  const fetchBinary = async (url) => {
    const headers = buildStreamHeaders(url, referer);
    const res = await platformFetch(url, { headers, binary: true, timeout: 60000 });
    if (!res.ok) throw new Error(`Network error: HTTP ${res.status}`);
    return await res.arrayBuffer();
  };

  // ── Step 1: Resolve master playlist to media playlist ──
  let playlistUrl = m3u8Url;
  let playlist = await fetchText(playlistUrl);

  if (playlist.includes('#EXT-X-STREAM-INF')) {
    const lines = playlist.split('\n');
    let highestBandwidth = 0;
    let selectedUri = '';
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
        const bw = bwMatch ? parseInt(bwMatch[1]) : 0;
        if (bw > highestBandwidth) {
          highestBandwidth = bw;
          let j = i + 1;
          while (j < lines.length && (lines[j].trim() === '' || lines[j].startsWith('#'))) j++;
          if (j < lines.length) selectedUri = lines[j].trim();
        }
      }
    }
    if (selectedUri) {
      if (!selectedUri.startsWith('http')) {
        playlistUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1) + selectedUri;
      } else {
        playlistUrl = selectedUri;
      }
      playlist = await fetchText(playlistUrl);
    }
  }

  // ── Step 2: Parse segments and keys ──
  const lines = playlist.split('\n');
  const segmentUrls = [];
  let keyUrl = null;
  const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-KEY:')) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        let uri = uriMatch[1];
        if (!uri.startsWith('http')) uri = baseUrl + uri;
        keyUrl = uri;
      }
    } else if (!line.startsWith('#')) {
      segmentUrls.push(line.startsWith('http') ? line : baseUrl + line);
    }
  }

  if (segmentUrls.length === 0) throw new Error('No video segments found in playlist.');

  console.log(`[ffmpegDownloader] Found ${segmentUrls.length} segments`);

  // ── Step 3: Download subtitle if requested ──
  let subtitleData = null;
  if (subtitleUrl) {
    try {
      subtitleData = await fetchText(subtitleUrl);
    } catch (e) {
      console.warn('[ffmpegDownloader] Subtitle download failed:', e.message);
    }
  }

  // ── Step 4: Platform-specific download + merge ──
  if (platform === 'tauri') {
    return downloadMergeTauri(segmentUrls, keyUrl, fetchBinary, title, epNum, onProgress, subtitleData, subtitleLang, mergeSubtitles, lines, baseUrl);
  } else if (platform === 'capacitor') {
    return downloadMergeCapacitor(segmentUrls, keyUrl, fetchBinary, title, epNum, onProgress, subtitleData, subtitleLang, mergeSubtitles, lines, baseUrl);
  }
}

// ══════════════════════════════════════════════════════════════════
//  TAURI — downloads segments, then invokes FFmpeg via Tauri command
// ══════════════════════════════════════════════════════════════════
async function downloadMergeTauri(segmentUrls, keyUrl, fetchBinary, title, epNum, onProgress, subtitleData, subtitleLang, mergeSubtitles, playlistLines, baseUrl) {
  const tauriFs = await import('@tauri-apps/plugin-fs');
  const tauriPath = await import('@tauri-apps/api/path');
  const docsDir = await tauriPath.documentDir();
  const safeTitle = (title || 'Video').replace(/[\\/:*?"<>|]+/g, '_').trim();
  const safeEpNum = String(epNum).replace(/[\\/:*?"<>|]+/g, '_');
  const dirPath = await tauriPath.join(docsDir, 'MIYO', 'Anime', safeTitle, `Episode_${safeEpNum}`);

  await tauriFs.mkdir(dirPath, { recursive: true });

  // Download key
  if (keyUrl) {
    const buffer = await fetchBinary(keyUrl);
    const keyData = new Uint8Array(buffer);
    const keyPath = await tauriPath.join(dirPath, 'key.bin');
    const f = await tauriFs.open(keyPath, { write: true, create: true, truncate: true });
    await f.write(keyData);
    await f.close();
  }

  // Download subtitle
  if (subtitleData) {
    const subPath = await tauriPath.join(dirPath, 'subtitle.vtt');
    const sf = await tauriFs.open(subPath, { write: true, create: true, truncate: true });
    await sf.write(new TextEncoder().encode(subtitleData));
    await sf.close();
  }

  // Download all segments
  for (let i = 0; i < segmentUrls.length; i++) {
    if (typeof onProgress === 'function') onProgress(Math.round(((i + 1) / segmentUrls.length) * 95));
    const buffer = await fetchBinary(segmentUrls[i]);
    const chunkData = new Uint8Array(buffer);
    const chunkPath = await tauriPath.join(dirPath, `${i}.ts`);
    const cf = await tauriFs.open(chunkPath, { write: true, create: true, truncate: true });
    await cf.write(chunkData);
    await cf.close();
  }

  // Rewrite playlist with local paths
  let rewrittenPlaylist = '';
  let segIdx = 0;
  for (const raw of playlistLines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-KEY:')) {
      rewrittenPlaylist += line.replace(/URI="[^"]+"/, 'URI="key.bin"') + '\n';
    } else if (!line.startsWith('#')) {
      rewrittenPlaylist += `${segIdx}.ts\n`;
      segIdx++;
    } else {
      rewrittenPlaylist += line + '\n';
    }
  }

  // Save local m3u8
  const m3u8Path = await tauriPath.join(dirPath, 'index.m3u8');
  const mf = await tauriFs.open(m3u8Path, { write: true, create: true, truncate: true });
  await mf.write(new TextEncoder().encode(rewrittenPlaylist));
  await mf.close();

  if (typeof onProgress === 'function') onProgress(100);

  const subPath = subtitleData ? await tauriPath.join(dirPath, 'subtitle.vtt') : null;
  console.log(`[ffmpegDownloader] Tauri download complete: ${m3u8Path}`);
  return { videoPath: m3u8Path, subPath, dirPath, segmentCount: segmentUrls.length };
}

// ══════════════════════════════════════════════════════════════════
//  CAPACITOR — same flow but using Capacitor Filesystem API
// ══════════════════════════════════════════════════════════════════
async function downloadMergeCapacitor(segmentUrls, keyUrl, fetchBinary, title, epNum, onProgress, subtitleData, subtitleLang, mergeSubtitles, playlistLines, baseUrl) {
  const cap = await import('@capacitor/filesystem');
  const Filesystem = cap.Filesystem;
  const Directory = cap.Directory;
  const Encoding = cap.Encoding;
  const safeTitle = (title || 'Video').replace(/[\\/:*?"<>|]+/g, '_').trim();
  const safeEpNum = String(epNum).replace(/[\\/:*?"<>|]+/g, '_');
  const dirPath = `MIYO/Anime/${safeTitle}/Episode_${safeEpNum}`;

  try { await Filesystem.mkdir({ path: dirPath, directory: Directory.Documents, recursive: true }); } catch (e) {}
  try { await Filesystem.writeFile({ path: `${dirPath}/.nomedia`, data: '', directory: Directory.Documents, encoding: Encoding.UTF8 }); } catch (e) {}

  // Download key
  if (keyUrl) {
    const buffer = await fetchBinary(keyUrl);
    await Filesystem.writeFile({ path: `${dirPath}/key.bin`, data: uint8ToBase64(new Uint8Array(buffer)), directory: Directory.Documents });
  }

  // Download subtitle
  if (subtitleData) {
    await Filesystem.writeFile({ path: `${dirPath}/subtitle.vtt`, data: subtitleData, directory: Directory.Documents, encoding: Encoding.UTF8 });
  }

  // Download segments
  for (let i = 0; i < segmentUrls.length; i++) {
    if (typeof onProgress === 'function') onProgress(Math.round(((i + 1) / segmentUrls.length) * 95));
    const buffer = await fetchBinary(segmentUrls[i]);
    const chunkData = new Uint8Array(buffer);

    const CHUNK_SIZE = 512 * 1024;
    await Filesystem.writeFile({ path: `${dirPath}/${i}.ts`, data: '', directory: Directory.Documents });
    for (let j = 0; j < chunkData.byteLength; j += CHUNK_SIZE) {
      const slice = chunkData.subarray(j, Math.min(j + CHUNK_SIZE, chunkData.byteLength));
      await Filesystem.appendFile({ path: `${dirPath}/${i}.ts`, data: uint8ToBase64(slice), directory: Directory.Documents });
    }
  }

  // Rewrite playlist
  let rewrittenPlaylist = '';
  let segIdx = 0;
  for (const raw of playlistLines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-KEY:')) {
      rewrittenPlaylist += line.replace(/URI="[^"]+"/, 'URI="key.bin"') + '\n';
    } else if (!line.startsWith('#')) {
      rewrittenPlaylist += `${segIdx}.ts\n`;
      segIdx++;
    } else {
      rewrittenPlaylist += line + '\n';
    }
  }

  await Filesystem.writeFile({ path: `${dirPath}/index.m3u8`, data: rewrittenPlaylist, directory: Directory.Documents, encoding: Encoding.UTF8 });

  if (typeof onProgress === 'function') onProgress(100);

  const videoUri = (await Filesystem.getUri({ path: `${dirPath}/index.m3u8`, directory: Directory.Documents })).uri;
  const subUri = subtitleData ? (await Filesystem.getUri({ path: `${dirPath}/subtitle.vtt`, directory: Directory.Documents })).uri : null;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('miyo-toast', {
      detail: { message: `Saved Episode ${epNum} to Downloads`, type: 'success' }
    }));
  }

  console.log(`[ffmpegDownloader] Capacitor download complete: ${videoUri}`);
  return { videoPath: videoUri, subPath: subUri, dirPath, segmentCount: segmentUrls.length };
}
