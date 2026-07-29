// Custom hls.js Loader that fetches playlists and segments through the
// native HTTP client with the correct Referer/Origin headers. This replaces
// the server-side /api/proxy for playback in the native apps.
//
// hls.js resolves relative URIs in playlists on its own, so no m3u8 URL
// rewriting is needed — every request simply flows through this loader.
import { platformFetch } from './index.js';
import { buildStreamHeaders } from './referers.js';

export function createNativeHlsLoaderClass(explicitReferer = '') {
  return class NativeHlsLoader {
    constructor(config) {
      this.config = config;
      this.stats = {
        aborted: false,
        loaded: 0,
        total: 0,
        retry: 0,
        chunkCount: 0,
        bwEstimate: 0,
        loading: { start: 0, first: 0, end: 0 },
        parsing: { start: 0, end: 0 },
        buffering: { start: 0, first: 0, end: 0 },
      };
      this._aborted = false;
    }

    load(context, config, callbacks) {
      this.context = context;
      this.callbacks = callbacks;
      const { url, responseType } = context;
      const isBinary = responseType === 'arraybuffer';
      const stats = this.stats;
      stats.loading.start = self.performance.now();

      const headers = buildStreamHeaders(url, explicitReferer);
      
      const isLocal = url.includes('localhost') || url.startsWith('/') || url.startsWith('asset://') || url.startsWith('http://localhost') || url.startsWith('capacitor://');

      const doFetch = isLocal
        ? window.fetch(url, { headers: { ...headers } })
            .then(async res => ({
              ok: res.ok,
              status: res.status,
              text: async () => res.text(),
              arrayBuffer: async () => res.arrayBuffer()
            }))
        : platformFetch(url, { headers, binary: isBinary, timeout: 30000 });

      doFetch
        .then(async (res) => {
          if (this._aborted) return;
          if (!res.ok) {
            callbacks.onError(
              { code: res.status, text: `HTTP ${res.status}` },
              context,
              null,
              stats
            );
            return;
          }
          const data = isBinary ? await res.arrayBuffer() : await res.text();
          if (this._aborted) return;
          const now = self.performance.now();
          stats.loading.first = stats.loading.first || now;
          stats.loading.end = now;
          const len = isBinary ? data.byteLength : data.length;
          stats.loaded = stats.total = len;

          const response = { url, data, code: res.status };
          callbacks.onSuccess(response, stats, context, null);
        })
        .catch((err) => {
          if (this._aborted) return;
          callbacks.onError(
            { code: 0, text: err?.message || 'Network error' },
            context,
            null,
            stats
          );
        });
    }

    abort() {
      this._aborted = true;
      this.stats.aborted = true;
      if (this.callbacks?.onAbort) {
        this.callbacks.onAbort(this.stats, this.context, null);
      }
    }

    destroy() {
      this._aborted = true;
      this.callbacks = null;
      this.context = null;
    }
  };
}

// Fetch a subtitle/track file natively and return a blob: URL usable in <track src>.
export async function fetchSubtitleAsBlobUrl(url, referer = '') {
  const headers = buildStreamHeaders(url, referer);
  const res = await platformFetch(url, { headers, timeout: 30000 });
  if (!res.ok) throw new Error(`Failed to fetch subtitle: ${res.status}`);
  const text = await res.text();
  const blob = new Blob([text], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}
