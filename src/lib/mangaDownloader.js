/**
 * Manga Downloader — downloads chapter images to local filesystem.
 * Supports both Tauri (desktop) and Capacitor (Android).
 * Optionally bundles images into a .cbz file for offline reading.
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
 * Download all images for a manga chapter.
 *
 * @param {string[]} imageUrls - Array of image URLs for the chapter
 * @param {string} referer - Referer header for image requests
 * @param {string} mangaTitle - Manga title (for folder naming)
 * @param {string|number} chapterNum - Chapter number/identifier
 * @param {function} onProgress - Progress callback (0–100)
 * @returns {{ dirPath: string, imageCount: number }}
 */
export async function downloadMangaChapter(imageUrls, referer, mangaTitle, chapterNum, onProgress) {
  if (!isNative()) {
    throw new Error('Manga downloading is only supported on native apps (Android/Desktop).');
  }
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No images provided for download.');
  }

  const safeTitle = (mangaTitle || 'Manga').replace(/[\\/:*?"<>|]+/g, '_').trim();
  const safeChapter = String(chapterNum).replace(/[\\/:*?"<>|]+/g, '_');
  const platform = getPlatform();

  console.log(`[mangaDownloader] Downloading ${imageUrls.length} images for ${safeTitle} Ch.${safeChapter}`);

  const fetchBinary = async (url) => {
    const headers = buildStreamHeaders(url, referer);
    const res = await platformFetch(url, { headers, binary: true, timeout: 60000 });
    if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
    return await res.arrayBuffer();
  };

  if (platform === 'tauri') {
    return downloadMangaTauri(imageUrls, fetchBinary, safeTitle, safeChapter, onProgress);
  } else if (platform === 'capacitor') {
    return downloadMangaCapacitor(imageUrls, fetchBinary, safeTitle, safeChapter, onProgress);
  }
  throw new Error('Unsupported platform for manga download');
}

// ══════════════════════════════════════════════════════════════════
//  TAURI (Desktop)
// ══════════════════════════════════════════════════════════════════
async function downloadMangaTauri(imageUrls, fetchBinary, safeTitle, safeChapter, onProgress) {
  const tauriFs = await import('@tauri-apps/plugin-fs');
  const tauriPath = await import('@tauri-apps/api/path');
  const docsDir = await tauriPath.documentDir();
  const dirPath = await tauriPath.join(docsDir, 'MIYO', 'Manga', safeTitle, `Chapter_${safeChapter}`);

  await tauriFs.mkdir(dirPath, { recursive: true });

  for (let i = 0; i < imageUrls.length; i++) {
    if (typeof onProgress === 'function') onProgress(Math.round(((i + 1) / imageUrls.length) * 100));

    try {
      const buffer = await fetchBinary(imageUrls[i]);
      const data = new Uint8Array(buffer);
      const ext = guessExtension(imageUrls[i]);
      const filePath = await tauriPath.join(dirPath, `${String(i + 1).padStart(4, '0')}${ext}`);
      const file = await tauriFs.open(filePath, { write: true, create: true, truncate: true });
      await file.write(data);
      await file.close();
    } catch (e) {
      console.warn(`[mangaDownloader] Failed to download image ${i + 1}:`, e.message);
    }
  }

  console.log(`[mangaDownloader] Finished Tauri download. Path: ${dirPath}`);
  return { dirPath, imageCount: imageUrls.length };
}

// ══════════════════════════════════════════════════════════════════
//  CAPACITOR (Android)
// ══════════════════════════════════════════════════════════════════
async function downloadMangaCapacitor(imageUrls, fetchBinary, safeTitle, safeChapter, onProgress) {
  const cap = await import('@capacitor/filesystem');
  const Filesystem = cap.Filesystem;
  const Directory = cap.Directory;
  const dirPath = `MIYO/Manga/${safeTitle}/Chapter_${safeChapter}`;

  try {
    await Filesystem.mkdir({ path: dirPath, directory: Directory.Documents, recursive: true });
  } catch (e) { /* may already exist */ }

  // .nomedia to hide from gallery
  try {
    await Filesystem.writeFile({
      path: `${dirPath}/.nomedia`,
      data: '',
      directory: Directory.Documents,
      encoding: cap.Encoding.UTF8,
    });
  } catch (e) {}

  for (let i = 0; i < imageUrls.length; i++) {
    if (typeof onProgress === 'function') onProgress(Math.round(((i + 1) / imageUrls.length) * 100));

    try {
      const buffer = await fetchBinary(imageUrls[i]);
      const data = new Uint8Array(buffer);
      const ext = guessExtension(imageUrls[i]);
      const fileName = `${String(i + 1).padStart(4, '0')}${ext}`;

      // Write in chunks to avoid OOM on large images
      const CHUNK_SIZE = 512 * 1024;
      await Filesystem.writeFile({ path: `${dirPath}/${fileName}`, data: '', directory: Directory.Documents });
      for (let j = 0; j < data.byteLength; j += CHUNK_SIZE) {
        const slice = data.subarray(j, Math.min(j + CHUNK_SIZE, data.byteLength));
        await Filesystem.appendFile({
          path: `${dirPath}/${fileName}`,
          data: uint8ToBase64(slice),
          directory: Directory.Documents,
        });
      }
    } catch (e) {
      console.warn(`[mangaDownloader] Failed to download image ${i + 1}:`, e.message);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('miyo-toast', {
      detail: { message: `Saved Chapter ${safeChapter} to Downloads`, type: 'success' }
    }));
  }

  const dirUri = (await Filesystem.getUri({ path: dirPath, directory: Directory.Documents })).uri;
  console.log(`[mangaDownloader] Finished Capacitor download. URI: ${dirUri}`);
  return { dirPath: dirUri, imageCount: imageUrls.length };
}

/**
 * Delete downloaded manga chapter files.
 */
export async function deleteMangaDownload(mangaTitle, chapterNum) {
  if (!isNative()) return;
  const safeTitle = (mangaTitle || 'Manga').replace(/[\\/:*?"<>|]+/g, '_').trim();
  const safeChapter = String(chapterNum).replace(/[\\/:*?"<>|]+/g, '_');
  const platform = getPlatform();

  if (platform === 'tauri') {
    const tauriFs = await import('@tauri-apps/plugin-fs');
    const tauriPath = await import('@tauri-apps/api/path');
    const docsDir = await tauriPath.documentDir();
    const dirPath = await tauriPath.join(docsDir, 'MIYO', 'Manga', safeTitle, `Chapter_${safeChapter}`);
    try {
      await tauriFs.remove(dirPath, { recursive: true });
    } catch (e) {
      console.warn('Failed to remove tauri manga directory:', e);
    }
  } else if (platform === 'capacitor') {
    const cap = await import('@capacitor/filesystem');
    const dirPath = `MIYO/Manga/${safeTitle}/Chapter_${safeChapter}`;
    try {
      await cap.Filesystem.rmdir({
        path: dirPath,
        directory: cap.Directory.Documents,
        recursive: true,
      });
    } catch (e) {
      console.warn('Failed to remove capacitor manga directory:', e);
    }
  }
}

// ── Helpers ──

function guessExtension(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.png')) return '.png';
    if (pathname.endsWith('.webp')) return '.webp';
    if (pathname.endsWith('.gif')) return '.gif';
    if (pathname.endsWith('.bmp')) return '.bmp';
  } catch {}
  return '.jpg'; // default
}
