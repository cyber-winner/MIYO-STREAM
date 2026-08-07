/**
 * MIYO Electron Main Process
 *
 * Architecture (mirrors StrawVerse):
 *   - Loads the Vite-built GUI from electron/gui/
 *   - Starts the Express backend (server.js + extensions + database) as a child process
 *   - Provides IPC for FFmpeg merging, download management, and Cloudflare bypass
 *   - In production, backend resources live in extraResources/backend/
 *   - In dev, it connects to the Vite dev server and the already-running backend
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ── Globals ──
let mainWindow = null;
let backendProcess = null;
const isDev = !app.isPackaged;
const BACKEND_PORT = 3000;
const VITE_DEV_PORT = 5173;

// ═══════════════════════════════════════════════════════════════════
//  Path Helpers
// ═══════════════════════════════════════════════════════════════════

function getBackendDir() {
  if (isDev) return path.join(__dirname, '..');
  return path.join(process.resourcesPath, 'backend');
}

function getGuiDir() {
  if (isDev) return null; // Dev loads from Vite dev server
  return path.join(__dirname, 'gui');
}

// ═══════════════════════════════════════════════════════════════════
//  Backend Server (runs server.js as a child process)
// ═══════════════════════════════════════════════════════════════════

function startBackend() {
  if (isDev) {
    // In dev mode, the user runs `node server.js` separately via concurrently
    console.log('[MIYO] Dev mode — expecting backend already running on :3000');
    return;
  }

  const backendDir = getBackendDir();
  const serverFile = path.join(backendDir, 'server.js');

  if (!fs.existsSync(serverFile)) {
    console.error(`[MIYO] Backend server.js not found at: ${serverFile}`);
    return;
  }

  // Use Electron's embedded Node.js runtime to avoid depending on system Node
  const nodeBin = process.execPath;

  console.log(`[MIYO] Starting backend: ${nodeBin} ${serverFile} (using ELECTRON_RUN_AS_NODE)`);

  backendProcess = spawn(nodeBin, [serverFile], {
    cwd: backendDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      SERVER_PORT: String(BACKEND_PORT),
      ELECTRON: '1',
      NODE_ENV: 'production',
      FFMPEG_PATH: getFfmpegPath() || '',
      NODE_PATH: path.join(backendDir, 'backend_modules'),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  backendProcess.stdout.on('data', (d) => console.log(`[Backend] ${d.toString().trim()}`));
  backendProcess.stderr.on('data', (d) => console.error(`[Backend] ${d.toString().trim()}`));
  backendProcess.on('close', (code) => {
    console.log(`[MIYO] Backend exited (code ${code})`);
    backendProcess = null;
  });
  backendProcess.on('error', (err) => {
    console.error(`[MIYO] Backend spawn error:`, err.message);
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('[MIYO] Stopping backend...');
    backendProcess.kill('SIGTERM');
    // Force kill after 3s if it doesn't exit cleanly
    setTimeout(() => {
      if (backendProcess) {
        backendProcess.kill('SIGKILL');
        backendProcess = null;
      }
    }, 3000);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  FFmpeg Path Resolution (StrawVerse pattern)
// ═══════════════════════════════════════════════════════════════════

let cachedFfmpegPath = null;

function getFfmpegPath() {
  if (cachedFfmpegPath && fs.existsSync(cachedFfmpegPath)) return cachedFfmpegPath;

  const binaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = [];

  // 1. Production — asar unpacked
  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', binaryName)
    );
  }

  // 2. ffmpeg-static module
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (typeof ffmpegStatic === 'string' && ffmpegStatic) {
      candidates.push(ffmpegStatic.replace('app.asar', 'app.asar.unpacked'));
      candidates.push(ffmpegStatic);
    }
  } catch (e) {}

  // 3. Dev — node_modules
  candidates.push(path.join(__dirname, 'node_modules', 'ffmpeg-static', binaryName));
  candidates.push(path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', binaryName));

  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      cachedFfmpegPath = p;
      console.log(`[FFmpeg] Resolved: ${cachedFfmpegPath}`);
      return cachedFfmpegPath;
    }
  }

  console.warn('[FFmpeg] Binary not found');
  return null;
}

// ═══════════════════════════════════════════════════════════════════
//  Window
// ═══════════════════════════════════════════════════════════════════

function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, '..', 'public', 'logo.png')
    : path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'MIYO',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32'
      ? { color: '#0a0a0a', symbolColor: '#ffffff', height: 36 }
      : false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
    backgroundColor: '#0a0a0a',
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${VITE_DEV_PORT}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const guiDir = getGuiDir();
    const indexPath = path.join(guiDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      // Fallback: connect to localhost backend
      mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
    }
  }

  // ── Adblocker & Navigation Protection ──
  const isAllowedNavigation = (navUrl) => {
    try {
      const urlObj = new URL(navUrl);
      if (urlObj.protocol === 'file:') return true;
      const host = urlObj.hostname;
      return host === 'localhost' ||
             host === '127.0.0.1' ||
             host === 'www.youtube.com' ||
             host === 'youtube.com' ||
             host === 'www.youtube-nocookie.com' ||
             host === 'videasy.net' ||
             host.endsWith('.videasy.net');
    } catch (e) {
      return false;
    }
  };

  // Block unauthorized main-frame navigations (e.g., ad redirects)
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    if (!isAllowedNavigation(navUrl)) {
      event.preventDefault();
      console.log(`[AdBlock] Blocked redirect to: ${navUrl}`);
    }
  });

  // Block unauthorized popups and open allowed ones in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedNavigation(url)) {
      console.log(`[AdBlock] Blocked popup to: ${url}`);
      return { action: 'deny' };
    }
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ═══════════════════════════════════════════════════════════════════
//  IPC Handlers
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('get-ffmpeg-path', () => getFfmpegPath());

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  isPackaged: app.isPackaged,
  backendPort: BACKEND_PORT,
}));

ipcMain.handle('select-download-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Download Directory',
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('merge-with-ffmpeg', async (_event, { tsFile, outputMp4, subtitles }) => {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error('FFmpeg binary not found');

  const args = ['-y', '-f', 'mpegts', '-i', tsFile];

  if (subtitles && subtitles.length > 0) {
    for (const sub of subtitles) args.push('-i', sub.path);
    args.push('-map', '0:v', '-map', '0:a?');
    for (let i = 0; i < subtitles.length; i++) args.push('-map', `${i + 1}:s`);
    args.push('-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text');
    for (let i = 0; i < subtitles.length; i++) {
      args.push(`-metadata:s:s:${i}`, `language=${subtitles[i].lang || 'eng'}`);
      if (subtitles[i].title) args.push(`-metadata:s:s:${i}`, `title=${subtitles[i].title}`);
    }
  } else {
    args.push('-c', 'copy');
  }
  args.push(outputMp4);

  const nativeDir = path.dirname(ffmpegPath);
  const spawnEnv = {
    ...process.env,
    LD_LIBRARY_PATH: nativeDir + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : ''),
  };

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { env: spawnEnv });
    let output = '';
    child.stderr.on('data', (d) => { output += d.toString(); });
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`FFmpeg exited with code ${code}\n${output}`));
      else resolve({ success: true, output: outputMp4 });
    });
    child.on('error', (err) => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  App Lifecycle
// ═══════════════════════════════════════════════════════════════════

app.whenReady().then(() => {
  startBackend();
  // Give the backend a moment to start (decompressing DB might take a few seconds)
  setTimeout(createWindow, isDev ? 500 : 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackend();
    app.quit();
  }
});

app.on('before-quit', () => stopBackend());
