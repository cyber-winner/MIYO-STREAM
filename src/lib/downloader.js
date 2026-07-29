import { isNative, getPlatform, platformFetch } from '../platform/index.js';
import { buildStreamHeaders } from '../platform/referers.js';
import muxjs from 'mux.js';

// ── TS → MP4 Transmuxer (Strawverse-style, runs entirely on-device) ──
// Uses mux.js to remux MPEG-TS segments into a fragmented MP4.
// This is the same tech hls.js uses internally — lightweight, pure JS, no FFmpeg.

function transmuxTsToMp4(tsSegments) {
  return new Promise((resolve, reject) => {
    try {
      const outputSegments = [];
      let initSegment = null;

      const transmuxer = new muxjs.mp4.Transmuxer({
        keepOriginalTimestamps: true,
        remux: true,
      });

      transmuxer.on('data', (segment) => {
        if (!initSegment && segment.initSegment) {
          initSegment = new Uint8Array(segment.initSegment.byteLength);
          initSegment.set(segment.initSegment);
        }
        if (segment.data) {
          const data = new Uint8Array(segment.data.byteLength);
          data.set(segment.data);
          outputSegments.push(data);
        }
      });

      transmuxer.on('done', () => {
        if (!initSegment || outputSegments.length === 0) {
          reject(new Error('Transmux produced no output'));
          return;
        }
        // Concatenate: init segment + all media segments = valid fMP4 file
        const totalSize = initSegment.byteLength + outputSegments.reduce((sum, s) => sum + s.byteLength, 0);
        const mp4 = new Uint8Array(totalSize);
        let offset = 0;
        mp4.set(initSegment, offset);
        offset += initSegment.byteLength;
        for (const seg of outputSegments) {
          mp4.set(seg, offset);
          offset += seg.byteLength;
        }
        resolve(mp4);
      });

      // Feed each TS segment into the transmuxer
      for (const tsData of tsSegments) {
        transmuxer.push(tsData);
      }
      transmuxer.flush();
    } catch (err) {
      reject(err);
    }
  });
}

// ── Helper: Uint8Array → base64 string (for Capacitor Filesystem) ──
function uint8ToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ── Resolve master playlist → highest bandwidth media playlist ──
async function resolvePlaylist(m3u8Url, fetchTextFn) {
  let playlistUrl = m3u8Url;
  let playlist = await fetchTextFn(playlistUrl);

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
      if (!selectedUri.startsWith('http') && !selectedUri.startsWith('/')) {
        playlistUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1) + selectedUri;
      } else if (selectedUri.startsWith('http')) {
        playlistUrl = selectedUri;
      }
      playlist = await fetchTextFn(playlistUrl);
    }
  }
  return { playlistUrl, playlist };
}

// ── Extract segment URLs from media playlist ──
function extractSegmentUrls(playlist, playlistUrl) {
  const lines = playlist.split('\n');
  const segments = [];
  const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
  for (const raw of lines) {
    const line = raw.trim();
    if (line && !line.startsWith('#')) {
      segments.push(line.startsWith('http') ? line : baseUrl + line);
    }
  }
  return segments;
}

// ════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ════════════════════════════════════════════════════════════════════

export async function downloadHls(m3u8Url, referer, title, onProgress) {
  if (isNative()) {
    return downloadHlsNative(m3u8Url, referer, title, onProgress);
  }

  // ── Web browser path (desktop + mobile browser) ──
  try {
    const getProxyUrl = (url) => {
      if (url.startsWith('/api/proxy')) return url;
      return `/api/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
    };
    const fetchText = async (url) => {
      const res = await fetch(getProxyUrl(url));
      if (!res.ok) throw new Error('Network response was not ok');
      return await res.text();
    };

    // Resolve playlist
    const { playlistUrl, playlist } = await resolvePlaylist(m3u8Url, fetchText);
    const chunks = extractSegmentUrls(playlist, playlistUrl);
    if (chunks.length === 0) throw new Error('No video chunks found in playlist.');

    // Download all segments
    const segmentBuffers = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress(Math.round((i / chunks.length) * 95));
      const res = await fetch(getProxyUrl(chunks[i]));
      if (!res.ok) throw new Error(`Failed to fetch chunk ${i}`);
      segmentBuffers.push(new Uint8Array(await res.arrayBuffer()));
    }

    // Transmux TS → MP4
    onProgress(96);
    let outputData;
    let outputType;
    let outputExt;
    try {
      outputData = await transmuxTsToMp4(segmentBuffers);
      outputType = 'video/mp4';
      outputExt = 'mp4';
    } catch (transmuxErr) {
      console.warn('[Download] Transmux failed, falling back to .ts:', transmuxErr.message);
      // Fallback: concatenate as raw TS
      const totalSize = segmentBuffers.reduce((s, b) => s + b.byteLength, 0);
      outputData = new Uint8Array(totalSize);
      let off = 0;
      for (const buf of segmentBuffers) { outputData.set(buf, off); off += buf.byteLength; }
      outputType = 'video/mp2t';
      outputExt = 'ts';
    }

    const safeTitle = (title || 'Video').replace(/[\\/:*?"<>|]+/g, '_');

    // Try File System Access API first (desktop Chrome)
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${safeTitle}.${outputExt}`,
          types: [{
            description: 'Video File',
            accept: { [outputType]: [`.${outputExt}`] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(outputData);
        await writable.close();
        onProgress(100);
        return true;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        // Fall through to blob download
      }
    }

    // Blob download fallback (mobile browsers)
    const blob = new Blob([outputData], { type: outputType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.${outputExt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onProgress(100);
    return true;
  } catch (err) {
    console.error('Download error:', err);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════════
//  NATIVE (Tauri / Capacitor) download path
// ════════════════════════════════════════════════════════════════════

async function downloadHlsNative(m3u8Url, referer, title, onProgress) {
  const fetchNativeText = async (url) => {
    const headers = buildStreamHeaders(url, referer);
    const res = await platformFetch(url, { headers, timeout: 30000 });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.text();
  };
  const fetchNativeBinary = async (url) => {
    const headers = buildStreamHeaders(url, referer);
    const res = await platformFetch(url, { headers, binary: true, timeout: 60000 });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.arrayBuffer();
  };

  // Resolve playlist
  const { playlistUrl, playlist } = await resolvePlaylist(m3u8Url, fetchNativeText);
  const segmentUrls = extractSegmentUrls(playlist, playlistUrl);
  if (segmentUrls.length === 0) throw new Error('No video chunks found in playlist.');

  const safeTitle = (title || 'Video').replace(/[\\/:*?"<>|]+/g, '_');
  const platform = getPlatform();

  // ── Download all segments into memory ──
  const segmentBuffers = [];
  for (let i = 0; i < segmentUrls.length; i++) {
    onProgress(Math.round((i / segmentUrls.length) * 90));
    const buffer = await fetchNativeBinary(segmentUrls[i]);
    segmentBuffers.push(new Uint8Array(buffer));
  }

  // ── Transmux TS → MP4 ──
  onProgress(92);
  let outputData;
  let outputExt;
  try {
    outputData = await transmuxTsToMp4(segmentBuffers);
    outputExt = 'mp4';
    console.log(`[Download] Transmuxed to MP4: ${(outputData.byteLength / 1024 / 1024).toFixed(1)} MB`);
  } catch (transmuxErr) {
    console.warn('[Download] Transmux failed, falling back to .ts:', transmuxErr.message);
    const totalSize = segmentBuffers.reduce((s, b) => s + b.byteLength, 0);
    outputData = new Uint8Array(totalSize);
    let off = 0;
    for (const buf of segmentBuffers) { outputData.set(buf, off); off += buf.byteLength; }
    outputExt = 'ts';
  }

  const fileName = `${safeTitle}.${outputExt}`;

  // ── Tauri: save via native dialog ──
  if (platform === 'tauri') {
    onProgress(95);
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { open: openFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await save({
      defaultPath: fileName,
      filters: [{ name: 'Video File', extensions: [outputExt] }],
    });
    if (!filePath) {
      const err = new Error('Save cancelled');
      err.name = 'AbortError';
      throw err;
    }
    const file = await openFile(filePath, { write: true, create: true, truncate: true });
    try {
      // Write in 1MB chunks to avoid memory pressure
      const CHUNK_SIZE = 1024 * 1024;
      for (let i = 0; i < outputData.byteLength; i += CHUNK_SIZE) {
        const chunk = outputData.subarray(i, Math.min(i + CHUNK_SIZE, outputData.byteLength));
        await file.write(chunk);
      }
    } finally {
      await file.close();
    }
    onProgress(100);
    return true;
  }

  // ── Capacitor (Android): save to Documents/MIYO/ ──
  if (platform === 'capacitor') {
    onProgress(95);
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const dirPath = `MIYO/${fileName}`;

    // Write in chunks (Capacitor requires base64)
    const CHUNK_SIZE = 512 * 1024; // 512KB chunks for base64
    // Create/truncate file
    await Filesystem.writeFile({
      path: dirPath,
      data: '',
      directory: Directory.Documents,
      recursive: true,
    });
    for (let i = 0; i < outputData.byteLength; i += CHUNK_SIZE) {
      const chunk = outputData.subarray(i, Math.min(i + CHUNK_SIZE, outputData.byteLength));
      await Filesystem.appendFile({
        path: dirPath,
        data: uint8ToBase64(chunk),
        directory: Directory.Documents,
      });
    }

    onProgress(100);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('miyo-toast', {
        detail: { message: `Saved to Documents/MIYO/${fileName}`, type: 'success' }
      }));
    }
    return true;
  }

  throw new Error('Unsupported platform for native download');
}
