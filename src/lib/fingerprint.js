/**
 * MIYO-STREAM Device Fingerprinting Engine
 * Collects signals from all 8 architectural layers to create a unique device fingerprint.
 * Runs client-side, sends composite hash + raw components to backend.
 */

// ─── Utility: SHA-256 hash ───
async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════════════════════════════════
// LAYER 1: Graphics & Hardware Acceleration Pipeline
// ═══════════════════════════════════════════════════════════════

function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 280, 60);

    // Text rendering (anti-aliasing varies by GPU/driver)
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#069';
    ctx.fillText('MIYO fingerprint 🎬🍿', 2, 2);

    // Styled text
    ctx.font = '18px Georgia';
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Canvas FP Test', 4, 22);

    // Geometric shapes
    ctx.beginPath();
    ctx.arc(200, 30, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6347';
    ctx.fill();

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 280, 0);
    gradient.addColorStop(0, '#00f2ff');
    gradient.addColorStop(1, '#ff00ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 50, 280, 10);

    return canvas.toDataURL();
  } catch (e) {
    return null;
  }
}

function getWebGLData() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return null;

    const result = {};

    // Unmasked vendor/renderer
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      result.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      result.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    }

    // Capabilities
    result.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    result.maxViewportDims = Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS));
    result.maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    result.maxCubeMapTextureSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
    result.maxTextureImageUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    result.maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    result.maxVertexUniformVectors = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    result.maxFragmentUniformVectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
    result.aliasedLineWidthRange = Array.from(gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE));
    result.aliasedPointSizeRange = Array.from(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE));
    result.shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
    result.glVersion = gl.getParameter(gl.VERSION);

    // Precision formats
    const precisionFormats = {};
    for (const shaderType of ['VERTEX_SHADER', 'FRAGMENT_SHADER']) {
      for (const precisionType of ['LOW_FLOAT', 'MEDIUM_FLOAT', 'HIGH_FLOAT', 'LOW_INT', 'MEDIUM_INT', 'HIGH_INT']) {
        try {
          const format = gl.getShaderPrecisionFormat(gl[shaderType], gl[precisionType]);
          if (format) {
            precisionFormats[`${shaderType}_${precisionType}`] = {
              min: format.rangeMin,
              max: format.rangeMax,
              precision: format.precision,
            };
          }
        } catch (e) {}
      }
    }
    result.precisionFormats = precisionFormats;

    // Supported extensions
    result.extensions = gl.getSupportedExtensions() || [];

    // WebGL render hash (simple 3D scene)
    try {
      canvas.width = 64;
      canvas.height = 64;
      const vShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vShader, 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}');
      gl.compileShader(vShader);
      const fShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fShader, 'precision mediump float;void main(){gl_FragColor=vec4(0.2,0.7,0.3,1.0);}');
      gl.compileShader(fShader);
      const program = gl.createProgram();
      gl.attachShader(program, vShader);
      gl.attachShader(program, fShader);
      gl.linkProgram(program);
      gl.useProgram(program);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, 0, 0.5]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const pixels = new Uint8Array(64 * 64 * 4);
      gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let hash = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        hash = ((hash << 5) - hash + pixels[i] + pixels[i + 1] + pixels[i + 2]) | 0;
      }
      result.renderHash = hash.toString(16);
    } catch (e) {
      result.renderHash = null;
    }

    return result;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// LAYER 2: Audio Processing Stack
// ═══════════════════════════════════════════════════════════════

function getAudioFingerprint() {
  return new Promise((resolve) => {
    try {
      const AudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AudioContext) { resolve(null); return; }

      const context = new AudioContext(1, 5000, 44100);
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, context.currentTime);

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, context.currentTime);
      compressor.knee.setValueAtTime(40, context.currentTime);
      compressor.ratio.setValueAtTime(12, context.currentTime);
      compressor.attack.setValueAtTime(0, context.currentTime);
      compressor.release.setValueAtTime(0.25, context.currentTime);

      oscillator.connect(compressor);
      compressor.connect(context.destination);
      oscillator.start(0);

      context.startRendering().then((buffer) => {
        const data = buffer.getChannelData(0);
        let sum = 0;
        for (let i = 4500; i < 5000; i++) {
          sum += Math.abs(data[i]);
        }
        resolve({
          hash: sum.toString(),
          sampleRate: context.sampleRate,
          channelCount: context.destination.channelCount,
          maxChannelCount: context.destination.maxChannelCount,
        });
      }).catch(() => resolve(null));

      // Timeout fallback
      setTimeout(() => resolve(null), 3000);
    } catch (e) {
      resolve(null);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// LAYER 3: Hardware Architecture & System Specs
// ═══════════════════════════════════════════════════════════════

function getHardwareInfo() {
  const info = {};

  // CPU
  info.cpuCores = navigator.hardwareConcurrency || null;

  // Memory
  info.deviceMemory = navigator.deviceMemory || null;

  // Screen
  info.screen = {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    devicePixelRatio: window.devicePixelRatio || 1,
  };

  // Color gamut detection
  info.colorGamut = null;
  if (window.matchMedia) {
    if (matchMedia('(color-gamut: rec2020)').matches) info.colorGamut = 'rec2020';
    else if (matchMedia('(color-gamut: p3)').matches) info.colorGamut = 'p3';
    else if (matchMedia('(color-gamut: srgb)').matches) info.colorGamut = 'srgb';
  }

  // HDR
  info.hdrSupport = window.matchMedia ? matchMedia('(dynamic-range: high)').matches : false;

  // Touch
  info.maxTouchPoints = navigator.maxTouchPoints || 0;
  info.touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  return info;
}

async function getBatteryInfo() {
  try {
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      return {
        charging: battery.charging,
        level: battery.level,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      };
    }
  } catch (e) {}
  return null;
}

// ═══════════════════════════════════════════════════════════════
// LAYER 4: Installed System Fonts & Speech Engines
// ═══════════════════════════════════════════════════════════════

function getInstalledFonts() {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial', 'Arial Black', 'Verdana', 'Tahoma', 'Trebuchet MS',
    'Impact', 'Times New Roman', 'Georgia', 'Palatino Linotype',
    'Courier New', 'Lucida Console', 'Lucida Sans Unicode',
    'Comic Sans MS', 'Gill Sans', 'Futura', 'Helvetica Neue',
    'Segoe UI', 'Calibri', 'Cambria', 'Consolas', 'Candara',
    'Franklin Gothic Medium', 'Century Gothic', 'Garamond',
    'Book Antiqua', 'Bookman Old Style', 'MS Gothic', 'MS PGothic',
    'MS Sans Serif', 'MS Serif', 'Palatino', 'Symbol', 'Wingdings',
    'Monaco', 'Menlo', 'Ubuntu', 'DejaVu Sans', 'Liberation Sans',
    'Noto Sans', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Source Sans Pro', 'PT Sans', 'Droid Sans', 'Fira Sans',
    'Apple SD Gothic Neo', 'Hiragino Kaku Gothic Pro', 'Meiryo',
    'Yu Gothic', 'Malgun Gothic', 'Microsoft YaHei', 'SimHei',
    'SimSun', 'PingFang SC', 'STHeiti', 'WenQuanYi Micro Hei',
    'Nirmala UI', 'Mangal', 'Tunga', 'Kartika', 'Vrinda',
    'Raavi', 'Shruti', 'Latha', 'Gautami', 'Aparajita',
    'Adobe Arabic', 'Arabic Typesetting', 'Traditional Arabic',
    'Papyrus', 'Copperplate', 'Brush Script MT', 'Rockwell',
    'Didot', 'American Typewriter', 'Optima', 'Baskerville',
    'Big Caslon', 'Bodoni 72', 'Chalkboard', 'Chalkduster',
    'Cochin', 'Herculanum', 'Marker Felt', 'Zapfino',
    'Inter', 'JetBrains Mono', 'Fira Code', 'Outfit',
    'SF Pro Display', 'SF Pro Text', 'New York',
  ];

  const detected = [];
  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';

  const span = document.createElement('span');
  span.style.position = 'absolute';
  span.style.left = '-9999px';
  span.style.top = '-9999px';
  span.style.fontSize = testSize;
  span.style.lineHeight = 'normal';
  span.textContent = testString;
  document.body.appendChild(span);

  // Measure base widths
  const baseWidths = {};
  const baseHeights = {};
  for (const base of baseFonts) {
    span.style.fontFamily = base;
    baseWidths[base] = span.offsetWidth;
    baseHeights[base] = span.offsetHeight;
  }

  // Test each font
  for (const font of testFonts) {
    let found = false;
    for (const base of baseFonts) {
      span.style.fontFamily = `'${font}', ${base}`;
      if (span.offsetWidth !== baseWidths[base] || span.offsetHeight !== baseHeights[base]) {
        found = true;
        break;
      }
    }
    if (found) detected.push(font);
  }

  document.body.removeChild(span);
  return detected;
}

function getSpeechVoices() {
  return new Promise((resolve) => {
    try {
      if (!window.speechSynthesis) { resolve([]); return; }

      const getVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          resolve(voices.map(v => ({
            name: v.name,
            lang: v.lang,
            localService: v.localService,
          })));
        }
      };

      getVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = getVoices;
      }

      // Timeout fallback
      setTimeout(() => resolve([]), 2000);
    } catch (e) {
      resolve([]);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// LAYER 5: Browser Environment & Execution Quirks
// ═══════════════════════════════════════════════════════════════

function getBrowserInfo() {
  const info = {};

  // User-Agent
  info.userAgent = navigator.userAgent;

  // Client Hints (high-entropy UA data)
  info.platform = navigator.platform || null;
  info.appVersion = navigator.appVersion || null;
  info.product = navigator.product || null;

  // userAgentData (Sec-CH-UA)
  if (navigator.userAgentData) {
    info.uaData = {
      brands: navigator.userAgentData.brands?.map(b => ({ brand: b.brand, version: b.version })) || [],
      mobile: navigator.userAgentData.mobile,
      platform: navigator.userAgentData.platform,
    };
  }

  // PDF viewer
  info.pdfViewerEnabled = navigator.pdfViewerEnabled ?? null;

  // Plugins
  info.pluginCount = navigator.plugins?.length || 0;

  // Cookies enabled
  info.cookiesEnabled = navigator.cookieEnabled;

  // Do Not Track
  info.doNotTrack = navigator.doNotTrack || window.doNotTrack || null;

  // JS engine detection via error stack format
  try {
    null[0]();
  } catch (e) {
    const stack = e.stack || '';
    if (stack.includes('at null')) info.jsEngine = 'V8'; // Chrome/Edge/Node
    else if (stack.includes('@')) info.jsEngine = 'SpiderMonkey'; // Firefox
    else if (stack.includes('evaluating')) info.jsEngine = 'JavaScriptCore'; // Safari
    else info.jsEngine = 'unknown';
  }

  // Codec support
  const video = document.createElement('video');
  const codecs = [
    { name: 'h264', type: 'video/mp4; codecs="avc1.42E01E"' },
    { name: 'h265', type: 'video/mp4; codecs="hev1.1.6.L93.B0"' },
    { name: 'vp8', type: 'video/webm; codecs="vp8"' },
    { name: 'vp9', type: 'video/webm; codecs="vp9"' },
    { name: 'av1', type: 'video/mp4; codecs="av01.0.01M.08"' },
    { name: 'ogg', type: 'video/ogg; codecs="theora"' },
    { name: 'mp3', type: 'audio/mpeg' },
    { name: 'aac', type: 'audio/mp4; codecs="mp4a.40.2"' },
    { name: 'opus', type: 'audio/webm; codecs="opus"' },
    { name: 'flac', type: 'audio/flac' },
    { name: 'wav', type: 'audio/wav' },
  ];
  info.codecs = {};
  for (const codec of codecs) {
    info.codecs[codec.name] = video.canPlayType(codec.type) || 'no';
  }

  return info;
}

// ═══════════════════════════════════════════════════════════════
// LAYER 6: Time, Locale & Internationalization
// ═══════════════════════════════════════════════════════════════

function getLocaleInfo() {
  const info = {};

  // Timezone
  info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  info.timezoneOffset = new Date().getTimezoneOffset();

  // DST detection
  const jan = new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(new Date().getFullYear(), 6, 1).getTimezoneOffset();
  info.dstOffset = Math.max(jan, jul) - Math.min(jan, jul);
  info.hasDST = jan !== jul;

  // Language
  info.language = navigator.language || null;
  info.languages = Array.from(navigator.languages || []);

  // Number formatting
  try {
    info.numberFormat = new Intl.NumberFormat().resolvedOptions();
  } catch (e) {
    info.numberFormat = null;
  }

  // Date formatting
  try {
    info.dateFormat = new Intl.DateTimeFormat().resolvedOptions();
  } catch (e) {
    info.dateFormat = null;
  }

  return info;
}

// ═══════════════════════════════════════════════════════════════
// LAYER 7: Accessibility & System Preferences
// ═══════════════════════════════════════════════════════════════

function getAccessibilityInfo() {
  const info = {};

  if (window.matchMedia) {
    info.prefersColorScheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' :
      matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'no-preference';
    info.prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    info.prefersReducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)').matches;
    info.prefersContrast = matchMedia('(prefers-contrast: more)').matches ? 'more' :
      matchMedia('(prefers-contrast: less)').matches ? 'less' : 'no-preference';
    info.forcedColors = matchMedia('(forced-colors: active)').matches;
    info.invertedColors = matchMedia('(inverted-colors: inverted)').matches;
  }

  return info;
}

// ═══════════════════════════════════════════════════════════════
// LAYER 8: Network (client-side portion)
// ═══════════════════════════════════════════════════════════════

function getNetworkInfo() {
  const info = {};

  // Network Information API
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    info.effectiveType = conn.effectiveType || null;
    info.downlink = conn.downlink || null;
    info.rtt = conn.rtt || null;
    info.saveData = conn.saveData || false;
    info.type = conn.type || null;
  }

  // Online status
  info.onLine = navigator.onLine;

  return info;
}

// ═══════════════════════════════════════════════════════════════
// MAIN: Collect all & hash
// ═══════════════════════════════════════════════════════════════

export async function collectFingerprint() {
  const components = {};

  // Layer 1: Graphics
  components.canvas = getCanvasFingerprint();
  components.webgl = getWebGLData();

  // Layer 2: Audio (async)
  components.audio = await getAudioFingerprint();

  // Layer 3: Hardware
  components.hardware = getHardwareInfo();
  components.battery = await getBatteryInfo();

  // Layer 4: Fonts & Speech
  components.fonts = getInstalledFonts();
  components.voices = await getSpeechVoices();

  // Layer 5: Browser
  components.browser = getBrowserInfo();

  // Layer 6: Locale
  components.locale = getLocaleInfo();

  // Layer 7: Accessibility
  components.accessibility = getAccessibilityInfo();

  // Layer 8: Network
  components.network = getNetworkInfo();

  // Generate composite hash from stable components (exclude volatile data like battery level)
  const stableData = {
    canvas: components.canvas,
    webglVendor: components.webgl?.vendor,
    webglRenderer: components.webgl?.renderer,
    webglRenderHash: components.webgl?.renderHash,
    webglMaxTextureSize: components.webgl?.maxTextureSize,
    webglExtensionCount: components.webgl?.extensions?.length,
    audioHash: components.audio?.hash,
    cpuCores: components.hardware?.cpuCores,
    deviceMemory: components.hardware?.deviceMemory,
    screenWidth: components.hardware?.screen?.width,
    screenHeight: components.hardware?.screen?.height,
    colorDepth: components.hardware?.screen?.colorDepth,
    dpr: components.hardware?.screen?.devicePixelRatio,
    maxTouchPoints: components.hardware?.maxTouchPoints,
    fontCount: components.fonts?.length,
    fonts: components.fonts?.sort().join(','),
    voiceCount: components.voices?.length,
    platform: components.browser?.platform,
    jsEngine: components.browser?.jsEngine,
    codecs: JSON.stringify(components.browser?.codecs),
    timezone: components.locale?.timezone,
    language: components.locale?.language,
    languages: components.locale?.languages?.join(','),
    colorScheme: components.accessibility?.prefersColorScheme,
    reducedMotion: components.accessibility?.prefersReducedMotion,
  };

  const fingerprintId = await sha256(JSON.stringify(stableData));

  return {
    id: fingerprintId,
    components,
    collectedAt: new Date().toISOString(),
  };
}

/**
 * Send fingerprint to backend. Runs once per session.
 */
export async function sendFingerprint() {
  const CACHE_KEY = 'miyo_fp_sent';

  // Only send once per session
  if (sessionStorage.getItem(CACHE_KEY)) return;

  try {
    const fingerprint = await collectFingerprint();
    sessionStorage.setItem(CACHE_KEY, fingerprint.id);

    await fetch('/api/fingerprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fingerprint),
    });

    return fingerprint.id;
  } catch (e) {
    // Silently fail — fingerprinting should never break the app
    console.debug('[MIYO-FP] Fingerprint collection failed:', e.message);
    return null;
  }
}
