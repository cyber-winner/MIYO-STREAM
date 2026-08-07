#!/usr/bin/env node
/**
 * Bundles the MIYO Node.js backend into a single file using esbuild
 * for deployment inside the Capacitor Android app via capacitor-nodejs.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const capacitorRoot = path.resolve(__dirname, "..");
const nodejsDir = path.join(capacitorRoot, "nodejs");

console.log("[bundle] Bundling Node.js backend using esbuild...");

try {
  // Copy server.js and utils to nodejs dir
  const projectRoot = path.resolve(capacitorRoot, "..");
  const filesToCopy = ["server.js", "setup.cjs"];
  const dirsToCopy = ["utils", "extensions"];

  for (const file of filesToCopy) {
    const src = path.join(projectRoot, file);
    const dest = path.join(nodejsDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`[bundle] Copied ${file}`);
    }
  }

  for (const dir of dirsToCopy) {
    const src = path.join(projectRoot, dir);
    const dest = path.join(nodejsDir, dir);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
      console.log(`[bundle] Copied ${dir}/`);
    }
  }

  // Copy database.db.gz
  const dbSrc = path.join(projectRoot, "database.db.gz");
  const dbDest = path.join(nodejsDir, "database.db.gz");
  if (fs.existsSync(dbSrc)) {
    fs.copyFileSync(dbSrc, dbDest);
    console.log(`[bundle] Copied database.db.gz (${(fs.statSync(dbSrc).size / 1024 / 1024).toFixed(1)} MB)`);
  }

  // Create a minimal main.js entry point for capacitor-nodejs
  const mainJs = `
const { channel } = require('bridge');
const path = require('path');
const { spawn } = require('child_process');

// Start the Express server
process.env.SERVER_PORT = '3000';
process.env.CAPACITOR_NODEJS = '1';

// The server.js is an ESM module, so we need to use dynamic import
import('./server.js').then(() => {
  channel.send('backend-ready', { port: 3000 });
  console.log('[MIYO Android] Backend server started on port 3000');
}).catch(err => {
  channel.send('backend-error', { error: err.message });
  console.error('[MIYO Android] Backend failed to start:', err);
});

// Listen for IPC messages from the webview
channel.addListener('ffmpeg-merge', async (data) => {
  try {
    const { tsFile, outputMp4, subtitles } = JSON.parse(data);
    // Resolve libffmpeg.so path on Android
    const nativeLibDir = process.env.NATIVE_LIB_DIR || '/data/app/lib/arm64';
    const ffmpegPath = path.join(nativeLibDir, 'libffmpeg.so');

    const args = ['-y', '-f', 'mpegts', '-i', tsFile, '-c', 'copy', outputMp4];
    const child = spawn(ffmpegPath, args);
    let output = '';
    child.stderr.on('data', (d) => { output += d.toString(); });
    child.on('close', (code) => {
      channel.send('ffmpeg-result', JSON.stringify({ success: code === 0, output }));
    });
  } catch (err) {
    channel.send('ffmpeg-result', JSON.stringify({ success: false, error: err.message }));
  }
});
`;

  fs.writeFileSync(path.join(nodejsDir, "main.js"), mainJs);
  console.log("[bundle] Created main.js entry point");

  // Create package.json for the nodejs runtime
  const pkg = {
    name: "miyo-android-backend",
    version: "5.0.0",
    main: "main.js",
    type: "module",
  };
  fs.writeFileSync(path.join(nodejsDir, "package.json"), JSON.stringify(pkg, null, 2));
  console.log("[bundle] Created package.json");

  console.log("[bundle] Backend bundling complete!");
} catch (err) {
  console.error("[bundle] Failed to bundle backend:", err.message);
  process.exit(1);
}
