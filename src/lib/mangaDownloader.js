import JSZip from 'jszip';
import { api } from './api';
import { isNative, getPlatform, platformFetch } from '../platform/index.js';

/**
 * Sanitizes a folder or file name for all operating systems (Windows, Linux, macOS).
 * Removes invalid characters: \ / : * ? " < > | and trims spaces/periods.
 */
export function sanitizeFileName(name) {
  if (!name) return 'Manga';
  return String(name)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '') || 'Manga';
}

/**
 * Left-pads a number to a fixed width (default 3 digits, e.g. 001, 002).
 */
export function padIndex(num, width = 3) {
  return String(num).padStart(width, '0');
}

/**
 * Extracts the file extension from an image URL or content type, defaulting to 'jpg'.
 */
export function getImageExtension(url, contentType = '') {
  if (contentType) {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  }
  if (url) {
    try {
      const cleanUrl = url.split('#')[0].split('?')[0];
      const match = cleanUrl.match(/\.([a-zA-Z0-9]{3,4})$/);
      if (match && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(match[1].toLowerCase())) {
        return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      }
    } catch (_) {}
  }
  return 'jpg';
}

/**
 * Fetches an image's binary data as an ArrayBuffer or Blob.
 */
async function fetchImageBuffer(imgUrl, referer = '', signal) {
  if (isNative()) {
    const res = await platformFetch(imgUrl, {
      method: 'GET',
      headers: referer ? { Referer: referer } : {},
      binary: true,
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    const contentType = res.headers ? (typeof res.headers.get === 'function' ? res.headers.get('content-type') : res.headers['content-type']) : '';
    return { buffer, contentType };
  } else {
    // Web: route through the /api/image proxy to attach required referer headers & bypass CORS
    const proxyUrl = api.buildMangaImageUrl(imgUrl, referer);
    const res = await fetch(proxyUrl, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching page image`);
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || '';
    return { buffer, contentType };
  }
}

/**
 * Triggers a file download from a Blob across Web, Tauri, and Capacitor.
 */
export async function saveBlobAsFile(blob, fileName) {
  if (isNative()) {
    try {
      const platform = getPlatform();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      if (platform === 'tauri') {
        const tauriFs = await import('@tauri-apps/plugin-fs');
        const tauriPath = await import('@tauri-apps/api/path');
        const downloadDir = await tauriPath.downloadDir();
        const filePath = await tauriPath.join(downloadDir, fileName);
        await tauriFs.writeFile(filePath, uint8Array);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('miyo-toast', {
            detail: { message: `Saved ${fileName} to Downloads folder`, type: 'success' }
          }));
        }
        return filePath;
      } else if (platform === 'capacitor') {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < uint8Array.length; i += CHUNK) {
          binary += String.fromCharCode.apply(null, uint8Array.subarray(i, i + CHUNK));
        }
        const base64Data = btoa(binary);
        const res = await Filesystem.writeFile({
          path: `Download/${fileName}`,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('miyo-toast', {
            detail: { message: `Saved ${fileName} to Documents/Download`, type: 'success' }
          }));
        }
        return res.uri;
      }
    } catch (nativeErr) {
      console.warn('[mangaDownloader] Native file save fallback to browser blob save:', nativeErr);
    }
  }

  // Web Browser default
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * Main Manga Downloader
 * 
 * Creates a ZIP file structured as:
 *   <Manga Name>/
 *   ├── Chapter 1/
 *   │   ├── 001.jpg
 *   │   ├── 002.jpg
 *   │   └── 003.jpg
 *   ├── Chapter 2/
 *   │   ├── 001.jpg
 *   │   └── 002.jpg
 * 
 * @param {Object} options
 * @param {string} options.mangaTitle - Title of the manga
 * @param {Array} options.chapters - Array of chapters [{ id, number, title }]
 * @param {string} [options.provider='weebcentral'] - Manga provider name
 * @param {Function} [options.onProgress] - Callback ({ percent, chapterIndex, totalChapters, pageIndex, totalPages, status, currentChapterTitle })
 * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
 * @returns {Promise<Blob>} The generated ZIP Blob
 */
export async function downloadMangaZip({
  mangaTitle = 'Manga',
  chapters = [],
  provider = 'weebcentral',
  onProgress,
  signal,
}) {
  if (!chapters || chapters.length === 0) {
    throw new Error('No chapters selected for download.');
  }

  const safeMangaName = sanitizeFileName(mangaTitle);
  const zip = new JSZip();

  // Root folder named after the manga
  const mangaFolder = zip.folder(safeMangaName);

  const totalChapters = chapters.length;
  let overallProcessedPages = 0;
  let estimatedTotalPages = totalChapters * 20; // Initial estimate

  onProgress?.({
    percent: 0,
    chapterIndex: 0,
    totalChapters,
    pageIndex: 0,
    totalPages: 0,
    status: 'fetching_chapters',
    currentChapterTitle: '',
    message: `Starting download for ${totalChapters} chapter${totalChapters > 1 ? 's' : ''}...`,
  });

  // Track all chapter page lists first
  const chapterJobs = [];
  for (let cIdx = 0; cIdx < totalChapters; cIdx++) {
    if (signal?.aborted) throw new Error('Download cancelled by user.');
    const ch = chapters[cIdx];
    const chNum = ch.number !== undefined ? ch.number : cIdx + 1;
    const chTitle = ch.title && ch.title !== `Chapter ${chNum}` ? ch.title : `Chapter ${chNum}`;

    onProgress?.({
      percent: Math.min(10, Math.round((cIdx / totalChapters) * 10)),
      chapterIndex: cIdx + 1,
      totalChapters,
      pageIndex: 0,
      totalPages: 0,
      status: 'fetching_chapter_pages',
      currentChapterTitle: chTitle,
      message: `Fetching pages for Chapter ${chNum}...`,
    });

    try {
      const pages = await api.getMangaChapterPages(provider, ch.id);
      const validPages = Array.isArray(pages) ? pages.filter(p => p && p.img) : [];
      chapterJobs.push({
        chapter: ch,
        chapterNumber: chNum,
        chapterTitle: chTitle,
        pages: validPages,
      });
    } catch (err) {
      console.warn(`[mangaDownloader] Failed to fetch pages for chapter ${ch.id}:`, err);
      chapterJobs.push({
        chapter: ch,
        chapterNumber: chNum,
        chapterTitle: chTitle,
        pages: [],
        error: err.message,
      });
    }
  }

  // Calculate actual total pages across all chapters
  const actualTotalPages = chapterJobs.reduce((acc, job) => acc + job.pages.length, 0);
  if (actualTotalPages === 0) {
    throw new Error('No pages were found for the selected chapters. The provider might be temporarily unavailable.');
  }

  // Process each chapter and download its panels
  let downloadedPanelsCount = 0;

  for (let cIdx = 0; cIdx < chapterJobs.length; cIdx++) {
    if (signal?.aborted) throw new Error('Download cancelled by user.');

    const job = chapterJobs[cIdx];
    const { chapterNumber, chapterTitle, pages } = job;

    // Subfolder for this chapter inside the manga root folder
    // Format: "Chapter X" or "Chapter X - Title"
    const safeChapterFolderName = sanitizeFileName(
      job.chapter.title?.startsWith('Chapter') ? job.chapter.title : `Chapter ${chapterNumber}`
    );
    const chapterFolder = mangaFolder.folder(safeChapterFolderName);

    const totalPagesInChapter = pages.length;

    for (let pIdx = 0; pIdx < totalPagesInChapter; pIdx++) {
      if (signal?.aborted) throw new Error('Download cancelled by user.');

      const page = pages[pIdx];
      const pageIndex = pIdx + 1;
      const referer = page.headers?.Referer || (provider === 'weebcentral' || page.img?.includes('lastation') || page.img?.includes('compsci88') ? 'https://weebcentral.com/' : '');

      onProgress?.({
        percent: Math.min(85, Math.round(10 + (downloadedPanelsCount / actualTotalPages) * 75)),
        chapterIndex: cIdx + 1,
        totalChapters,
        pageIndex,
        totalPages: totalPagesInChapter,
        status: 'downloading_panels',
        currentChapterTitle: chapterTitle,
        message: `Chapter ${chapterNumber} (${cIdx + 1}/${totalChapters}) • Panel ${pageIndex}/${totalPagesInChapter}`,
      });

      try {
        const { buffer, contentType } = await fetchImageBuffer(page.img, referer, signal);
        const ext = getImageExtension(page.img, contentType);
        const panelNumberStr = padIndex(pageIndex, 3);
        const fileName = `${panelNumberStr}.${ext}`;

        chapterFolder.file(fileName, buffer);
        downloadedPanelsCount++;
      } catch (imgErr) {
        console.warn(`[mangaDownloader] Failed to download panel ${pageIndex} of Chapter ${chapterNumber}:`, imgErr.message);
        // Continue downloading the other panels even if one fails
      }
    }
  }

  onProgress?.({
    percent: 88,
    chapterIndex: totalChapters,
    totalChapters,
    pageIndex: actualTotalPages,
    totalPages: actualTotalPages,
    status: 'compressing',
    currentChapterTitle: '',
    message: 'Compressing chapters into ZIP archive...',
  });

  // Generate ZIP file with progress
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 4 },
    },
    (metadata) => {
      const compPercent = Math.min(99, Math.round(88 + (metadata.percent / 100) * 11));
      onProgress?.({
        percent: compPercent,
        chapterIndex: totalChapters,
        totalChapters,
        pageIndex: actualTotalPages,
        totalPages: actualTotalPages,
        status: 'compressing',
        currentChapterTitle: '',
        message: `Compressing ZIP archive (${Math.round(metadata.percent)}%)...`,
      });
    }
  );

  onProgress?.({
    percent: 100,
    chapterIndex: totalChapters,
    totalChapters,
    pageIndex: actualTotalPages,
    totalPages: actualTotalPages,
    status: 'ready',
    currentChapterTitle: '',
    message: 'ZIP archive ready! Starting download...',
  });

  // Construct download filename
  let zipFileName = `${safeMangaName}.zip`;
  if (totalChapters === 1) {
    const chNum = chapters[0].number !== undefined ? chapters[0].number : 1;
    zipFileName = `${safeMangaName} - Chapter ${chNum}.zip`;
  } else if (totalChapters < 10) {
    const firstNum = chapters[0].number !== undefined ? chapters[0].number : 1;
    const lastNum = chapters[totalChapters - 1].number !== undefined ? chapters[totalChapters - 1].number : totalChapters;
    zipFileName = `${safeMangaName} - Ch ${firstNum}-${lastNum}.zip`;
  }

  saveBlobAsFile(zipBlob, zipFileName);

  return zipBlob;
}
