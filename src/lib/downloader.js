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

// ════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ════════════════════════════════════════════════════════════════════

export async function downloadHls(m3u8Url, referer, title, epNum, onProgress, subtitleUrl = null) {
  console.log('[downloader] downloadHls called', { m3u8Url, referer, title, epNum, hasProgress: typeof onProgress, subtitleUrl });
  let cleanUrl = m3u8Url;
  let effectiveReferer = referer || '';
  if (m3u8Url.includes('#referer=')) {
    const [url, hash] = m3u8Url.split('#referer=');
    cleanUrl = url;
    if (!effectiveReferer && hash) {
      try { effectiveReferer = decodeURIComponent(hash); } catch { effectiveReferer = hash; }
    }
  }

  if (!isNative()) {
    throw new Error('M3U8 Directory downloading is only supported on native apps (Android/Desktop).');
  }

  return downloadHlsNative(cleanUrl, effectiveReferer, title, epNum, onProgress, subtitleUrl);
}

export async function deleteDownloadFiles(title, epNum) {
  if (!isNative()) return;
  const safeTitle = (title || 'Video').replace(/[\\/:*?"<>|]+/g, '_').trim();
  const safeEpNum = String(epNum).replace(/[\\/:*?"<>|]+/g, '_');
  const platform = getPlatform();

  if (platform === 'tauri') {
    const tauriFs = await import('@tauri-apps/plugin-fs');
    const tauriPath = await import('@tauri-apps/api/path');
    const docsDir = await tauriPath.documentDir();
    const dirPath = await tauriPath.join(docsDir, 'MIYO', 'Anime', safeTitle, `Episode_${safeEpNum}`);
    try {
      await tauriFs.remove(dirPath, { recursive: true });
    } catch (e) {
      console.warn('Failed to remove tauri download directory:', e);
    }
  } else if (platform === 'capacitor') {
    const cap = await import('@capacitor/filesystem');
    const dirPath = `MIYO/Anime/${safeTitle}/Episode_${safeEpNum}`;
    try {
      await cap.Filesystem.rmdir({
        path: dirPath,
        directory: cap.Directory.Documents,
        recursive: true
      });
    } catch (e) {
      console.warn('Failed to remove capacitor download directory:', e);
    }
  }
}

// ════════════════════════════════════════════════════════════════════
//  NATIVE (Tauri / Capacitor) download path
// ════════════════════════════════════════════════════════════════════

async function downloadHlsNative(m3u8Url, referer, title, epNum, onProgress, subtitleUrl = null) {
  try {
    console.log('[downloader] Starting native download for', title, 'Ep', epNum);
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

    // Fetch subtitle if requested
    let subtitleData = null;
    if (subtitleUrl) {
      try {
        console.log('[downloader] Fetching subtitle...');
        subtitleData = await fetchNativeText(subtitleUrl);
      } catch (e) {
        console.warn('[Download] Failed to download subtitle:', e);
      }
    }

    // Resolve playlist
    console.log('[downloader] Resolving playlist...');
    const { playlistUrl, playlist } = await resolvePlaylist(m3u8Url, fetchNativeText);
    
    const safeTitle = (title || 'Video').replace(/[\\/:*?"<>|]+/g, '_').trim();
    const safeEpNum = String(epNum).replace(/[\\/:*?"<>|]+/g, '_');
    const platform = getPlatform();

    console.log('[downloader] Platform:', platform, 'SafeTitle:', safeTitle);

    let Filesystem, Directory, Encoding, tauriFs, tauriPath;
    let dirPath = ''; // Relative or absolute path depending on platform

    if (platform === 'tauri') {
      tauriFs = await import('@tauri-apps/plugin-fs');
      tauriPath = await import('@tauri-apps/api/path');
      const docsDir = await tauriPath.documentDir();
      dirPath = await tauriPath.join(docsDir, 'MIYO', 'Anime', safeTitle, `Episode_${safeEpNum}`);
      
      // Create directory recursively
      await tauriFs.mkdir(dirPath, { recursive: true });
      // Save subtitle
      if (subtitleData) {
        const subFilePath = await tauriPath.join(dirPath, 'subtitle.vtt');
        const subFile = await tauriFs.open(subFilePath, { write: true, create: true, truncate: true });
        await subFile.write(new TextEncoder().encode(subtitleData));
        await subFile.close();
      }
    } else if (platform === 'capacitor') {
      const cap = await import('@capacitor/filesystem');
      Filesystem = cap.Filesystem;
      Directory = cap.Directory;
      Encoding = cap.Encoding;
      dirPath = `MIYO/Anime/${safeTitle}/Episode_${safeEpNum}`;
      
      console.log('[downloader] Creating directory:', dirPath);
      // Attempt to make directory, ignore if it exists
      try {
        await Filesystem.mkdir({
          path: dirPath,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (e) {
        // Directory might exist, which is fine
      }

      // Add .nomedia file to hide from gallery
      try {
        await Filesystem.writeFile({
          path: `${dirPath}/.nomedia`,
          data: '',
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
      } catch (e) {}

      if (subtitleData) {
        await Filesystem.writeFile({
          path: `${dirPath}/subtitle.vtt`,
          data: subtitleData,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
      }
    }

    // Parse playlist, identify segments and keys
    console.log('[downloader] Parsing playlist...');
    const lines = playlist.split('\n');
    const segmentUrls = [];
    let keyUrl = null;
    const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);

    // First pass: extract all download URLs
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

    if (segmentUrls.length === 0) throw new Error('No video chunks found in playlist.');

    console.log(`[downloader] Found ${segmentUrls.length} chunks. Downloading...`);
    // Download key if needed
    if (keyUrl) {
      if (typeof onProgress === 'function') onProgress(0); // Start downloading key
      const buffer = await fetchNativeBinary(keyUrl);
      const keyData = new Uint8Array(buffer);
      if (platform === 'tauri') {
        const keyFilePath = await tauriPath.join(dirPath, 'key.bin');
        const keyFile = await tauriFs.open(keyFilePath, { write: true, create: true, truncate: true });
        await keyFile.write(keyData);
        await keyFile.close();
      } else if (platform === 'capacitor') {
        await Filesystem.writeFile({
          path: `${dirPath}/key.bin`,
          data: uint8ToBase64(keyData),
          directory: Directory.Documents,
        });
      }
    }

    // Download all segments
    for (let i = 0; i < segmentUrls.length; i++) {
      if (typeof onProgress === 'function') onProgress(Math.round(((i + 1) / segmentUrls.length) * 98));
      const buffer = await fetchNativeBinary(segmentUrls[i]);
      const chunkData = new Uint8Array(buffer);
      
      if (platform === 'tauri') {
        const chunkFilePath = await tauriPath.join(dirPath, `${i}.ts`);
        const chunkFile = await tauriFs.open(chunkFilePath, { write: true, create: true, truncate: true });
        await chunkFile.write(chunkData);
        await chunkFile.close();
      } else if (platform === 'capacitor') {
        const CHUNK_SIZE = 512 * 1024;
        // Truncate file first
        await Filesystem.writeFile({
          path: `${dirPath}/${i}.ts`,
          data: '',
          directory: Directory.Documents,
        });
        // Append in chunks
        for (let j = 0; j < chunkData.byteLength; j += CHUNK_SIZE) {
          const slice = chunkData.subarray(j, Math.min(j + CHUNK_SIZE, chunkData.byteLength));
          await Filesystem.appendFile({
            path: `${dirPath}/${i}.ts`,
            data: uint8ToBase64(slice),
            directory: Directory.Documents,
          });
        }
      }
    }

    console.log('[downloader] Rewriting playlist...');
    // Rewrite playlist
    let rewrittenPlaylist = '';
    let segmentIndex = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#EXT-X-KEY:')) {
        const replaced = line.replace(/URI="[^"]+"/, 'URI="key.bin"');
        rewrittenPlaylist += replaced + '\n';
      } else if (!line.startsWith('#')) {
        rewrittenPlaylist += `${segmentIndex}.ts\n`;
        segmentIndex++;
      } else {
        rewrittenPlaylist += line + '\n';
      }
    }

    // Save index.m3u8
    console.log('[downloader] Saving index.m3u8...');
    if (platform === 'tauri') {
      const m3u8Path = await tauriPath.join(dirPath, 'index.m3u8');
      const m3u8File = await tauriFs.open(m3u8Path, { write: true, create: true, truncate: true });
      await m3u8File.write(new TextEncoder().encode(rewrittenPlaylist));
      await m3u8File.close();
      
      if (typeof onProgress === 'function') onProgress(100);
      const subPath = subtitleData ? await tauriPath.join(dirPath, 'subtitle.vtt') : null;
      console.log('[downloader] Finished Tauri. Path:', m3u8Path);
      return { videoPath: m3u8Path, subPath };
    } else if (platform === 'capacitor') {
      await Filesystem.writeFile({
        path: `${dirPath}/index.m3u8`,
        data: rewrittenPlaylist,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });

      if (typeof onProgress === 'function') onProgress(100);
      const videoUri = (await Filesystem.getUri({ path: `${dirPath}/index.m3u8`, directory: Directory.Documents })).uri;
      const subUri = subtitleData ? (await Filesystem.getUri({ path: `${dirPath}/subtitle.vtt`, directory: Directory.Documents })).uri : null;
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('miyo-toast', {
          detail: { message: `Saved Episode ${epNum} to Downloads`, type: 'success' }
        }));
      }
      console.log('[downloader] Finished Capacitor. Path:', videoUri);
      return { videoPath: videoUri, subPath: subUri };
    }
  } catch (err) {
    console.error('[downloader] FATAL ERROR in downloadHlsNative:', err);
    throw err;
  }
}
