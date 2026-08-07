#!/usr/bin/env node
/**
 * prepare-dist.js
 *
 * Runs before `electron-builder` packages the app. It:
 *   1. Builds the Vite GUI (npm run build in root)
 *   2. Copies the built dist/ into electron/gui/
 *   3. Copies the backend (server.js, extensions/, utils/, database.db.gz, .env)
 *      into electron/backend/ so electron-builder can bundle them as extraResources
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const electronDir = path.resolve(__dirname, '..');
const projectRoot = path.resolve(electronDir, '..');
const guiDest = path.join(electronDir, 'gui');
const backendDest = path.join(electronDir, 'backend');

// ── Helpers ──
function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function cpdir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ Skipped (not found): ${src}`);
    return;
  }
  fs.cpSync(src, dest, { recursive: true });
  console.log(`  ✓ ${path.relative(projectRoot, src)} → ${path.relative(projectRoot, dest)}`);
}

function cpfile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ Skipped (not found): ${src}`);
    return;
  }
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  ✓ ${path.relative(projectRoot, src)} → ${path.relative(projectRoot, dest)}`);
}

// ═══════════════════════════════════════════════════════════════════
//  Step 1: Build the Vite GUI
// ═══════════════════════════════════════════════════════════════════
console.log('\n▶ Step 1: Building Vite GUI (ELECTRON=1 for relative paths)...\n');
try {
  execSync('npm run build', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, ELECTRON: '1' },
  });
} catch (err) {
  console.error('GUI build failed:', err.message);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════
//  Step 2: Copy dist → electron/gui
// ═══════════════════════════════════════════════════════════════════
console.log('\n▶ Step 2: Copying Vite dist → electron/gui/\n');
rmrf(guiDest);
const distSrc = path.join(projectRoot, 'dist');
if (!fs.existsSync(distSrc)) {
  console.error('dist/ not found — Vite build may have failed');
  process.exit(1);
}
cpdir(distSrc, guiDest);

// ═══════════════════════════════════════════════════════════════════
//  Step 3: Copy backend → electron/backend
// ═══════════════════════════════════════════════════════════════════
console.log('\n▶ Step 3: Copying backend files → electron/backend/\n');
rmrf(backendDest);
fs.mkdirSync(backendDest, { recursive: true });

// Core server
cpfile(path.join(projectRoot, 'server.js'), path.join(backendDest, 'server.js'));
cpfile(path.join(projectRoot, 'setup.cjs'), path.join(backendDest, 'setup.cjs'));

// Extensions (anime + manga providers)
cpdir(path.join(projectRoot, 'extensions'), path.join(backendDest, 'extensions'));

// Utils (includes database.cjs, cloudflare.cjs, proxyHeaders.cjs etc.)
cpdir(path.join(projectRoot, 'utils'), path.join(backendDest, 'utils'));

// Libs (if any)
if (fs.existsSync(path.join(projectRoot, 'libs'))) {
  cpdir(path.join(projectRoot, 'libs'), path.join(backendDest, 'libs'));
}

// Database
cpfile(path.join(projectRoot, 'database.db.gz'), path.join(backendDest, 'database.db.gz'));

// .env (if present)
cpfile(path.join(projectRoot, '.env'), path.join(backendDest, '.env'));

// Copy the root package.json (the backend uses it for require() resolution)
// but strip client-only deps and devDependencies
const rootPkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const backendPkg = {
  name: 'miyo-backend',
  version: rootPkg.version || '5.0.0',
  type: rootPkg.type || 'module',
  private: true,
  dependencies: {},
};

// Only include server-side deps (not React, Tauri, Capacitor, etc.)
const serverDeps = [
  'axios', 'better-sqlite3', 'cheerio', 'cors', 'dotenv',
  'express', 'express-rate-limit', 'hls-parser', 'node-cache',
  'puppeteer-real-browser', 'ssh2-sftp-client', 'ws', 'xvfb',
  'jszip', 'iso-639-1',
];
for (const dep of serverDeps) {
  if (rootPkg.dependencies?.[dep]) {
    backendPkg.dependencies[dep] = rootPkg.dependencies[dep];
  }
}

fs.writeFileSync(
  path.join(backendDest, 'package.json'),
  JSON.stringify(backendPkg, null, 2)
);
console.log('  ✓ Created backend/package.json');

// Create .cache directory
fs.mkdirSync(path.join(backendDest, '.cache'), { recursive: true });
console.log('  ✓ Created backend/.cache/');

// ═══════════════════════════════════════════════════════════════════
//  Step 4: Install backend node_modules
// ═══════════════════════════════════════════════════════════════════
console.log('\n▶ Step 4: Installing backend dependencies...\n');
try {
  execSync('npm install --omit=dev --ignore-scripts', {
    cwd: backendDest,
    stdio: 'inherit',
  });
  // Rebuild native modules (better-sqlite3) for the system Node.js
  execSync('npm rebuild better-sqlite3', {
    cwd: backendDest,
    stdio: 'inherit',
  });
} catch (err) {
  console.error('Backend npm install failed:', err.message);
  process.exit(1);
}

console.log('\n✅ Electron packaging preparation complete.\n');
console.log('Output:');
console.log(`  GUI:     ${guiDest}`);
console.log(`  Backend: ${backendDest}`);
console.log('');

