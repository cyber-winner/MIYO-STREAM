import { isNative, getPlatform, platformFetch } from '../platform/index.js';
import { buildStreamHeaders } from '../platform/referers.js';

export async function downloadHls(m3u8Url, referer, title, onProgress) {
  if (isNative()) {
    return downloadHlsNative(m3u8Url, referer, title, onProgress);
  }
  try {
    let writable = null;
    let fallbackChunks = null;
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${title || 'Video'}.ts`,
          types: [{
            description: 'Video File',
            accept: { 'video/mp2t': ['.ts'] },
          }],
        });
        writable = await handle.createWritable();
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        console.warn("showSaveFilePicker failed or was blocked, falling back to Blob download.", e);
        fallbackChunks = [];
      }
    } else {
      console.warn("showSaveFilePicker is not available (maybe not localhost/HTTPS?), falling back to Blob download.");
      fallbackChunks = [];
    }
    const getProxyUrl = (url) => {
      if (url.startsWith('/api/proxy')) return url;
      return `/api/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
    };
    const fetchText = async (url) => {
      const res = await fetch(getProxyUrl(url));
      if (!res.ok) throw new Error('Network response was not ok');
      return await res.text();
    };
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
            while (j < lines.length && (lines[j].trim() === '' || lines[j].startsWith('#'))) {
              j++;
            }
            if (j < lines.length) {
              selectedUri = lines[j].trim();
            }
          }
        }
      }
            if (selectedUri) {
        if (!selectedUri.startsWith('http') && !selectedUri.startsWith('/')) {
           const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
           playlistUrl = baseUrl + selectedUri;
        } else {
           playlistUrl = selectedUri;
        }
        playlist = await fetchText(playlistUrl);
      }
    }
    const lines = playlist.split('\n');
    const chunks = [];
    const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
        for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#')) {
        let chunkUrl = line;
        if (chunkUrl.startsWith('/api/proxy')) {
        } else if (!chunkUrl.startsWith('http')) {
           chunkUrl = baseUrl + chunkUrl;
        }
        chunks.push(chunkUrl);
      }
    }
        if (chunks.length === 0) throw new Error('No video chunks found in playlist.');
    for (let i = 0; i < chunks.length; i++) {
      onProgress(Math.round(((i) / chunks.length) * 100));
            const res = await fetch(getProxyUrl(chunks[i]));
      if (!res.ok) throw new Error(`Failed to fetch chunk ${i}`);
            if (writable) {
        if (res.body) {
          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writable.write(value);
          }
        } else {
          const buffer = await res.arrayBuffer();
          await writable.write(buffer);
        }
      } else {
        const buffer = await res.arrayBuffer();
        fallbackChunks.push(new Uint8Array(buffer));
      }
    }
        if (writable) {
      await writable.close();
    } else {
      const blob = new Blob(fallbackChunks, { type: 'video/mp2t' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'Video'}.ts`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    onProgress(100);
    return true;
      } catch (err) {
    console.error('Download error:', err);
    throw err;
  }
}

// ---------------- Native (Tauri / Capacitor) download path ----------------
// Fetches the playlist + segments through the native HTTP client with the
// correct Referer headers, then saves the file with platform-native APIs.

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

  // Resolve master playlist -> highest bandwidth variant
  let playlistUrl = m3u8Url;
  let playlist = await fetchNativeText(playlistUrl);
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
          while (j < lines.length && (lines[j].trim() === '' || lines[j].startsWith('#'))) {
            j++;
          }
          if (j < lines.length) selectedUri = lines[j].trim();
        }
      }
    }
    if (selectedUri) {
      if (!selectedUri.startsWith('http')) {
        const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
        playlistUrl = baseUrl + selectedUri;
      } else {
        playlistUrl = selectedUri;
      }
      playlist = await fetchNativeText(playlistUrl);
    }
  }

  // Collect segment URLs
  const lines = playlist.split('\n');
  const segmentUrls = [];
  const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
  for (const raw of lines) {
    const line = raw.trim();
    if (line && !line.startsWith('#')) {
      segmentUrls.push(line.startsWith('http') ? line : baseUrl + line);
    }
  }
  if (segmentUrls.length === 0) throw new Error('No video chunks found in playlist.');

  const fileName = `${(title || 'Video').replace(/[\\/:*?"<>|]+/g, '_')}.ts`;
  const platform = getPlatform();

  if (platform === 'tauri') {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { open: openFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await save({
      defaultPath: fileName,
      filters: [{ name: 'Video File', extensions: ['ts'] }],
    });
    if (!filePath) {
      const err = new Error('Save cancelled');
      err.name = 'AbortError';
      throw err;
    }
    const file = await openFile(filePath, { write: true, create: true, truncate: true });
    try {
      for (let i = 0; i < segmentUrls.length; i++) {
        onProgress(Math.round((i / segmentUrls.length) * 100));
        const buffer = await fetchNativeBinary(segmentUrls[i]);
        await file.write(new Uint8Array(buffer));
      }
    } finally {
      await file.close();
    }
    onProgress(100);
    return true;
  }

  if (platform === 'capacitor') {
    // Android: save to the app's Documents directory chunk-by-chunk using
    // base64 appends (Capacitor Filesystem has no streaming write).
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const path = `MIYO/${fileName}`;
    // Create/truncate the file first
    await Filesystem.writeFile({
      path,
      data: '',
      directory: Directory.Documents,
      recursive: true,
    });
    for (let i = 0; i < segmentUrls.length; i++) {
      onProgress(Math.round((i / segmentUrls.length) * 100));
      const buffer = await fetchNativeBinary(segmentUrls[i]);
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const CHUNK = 0x8000;
      for (let o = 0; o < bytes.length; o += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(o, o + CHUNK));
      }
      await Filesystem.appendFile({
        path,
        data: btoa(binary),
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
