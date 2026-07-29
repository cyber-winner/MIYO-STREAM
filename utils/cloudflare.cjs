/**
 * Cloudflare Bypass Module (exact port from Strawverse/AnimeMapper)
 * Uses puppeteer-real-browser with patched Xvfb to solve Turnstile.
 * 
 * On HidenCloud: setup.js downloads all libs into ./libs/
 * This module patches Xvfb binary, sets LD_LIBRARY_PATH, and launches
 * a headed browser via Xvfb to solve Cloudflare challenges.
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

// ── Xvfb Patching (exact Strawverse pattern) ──
// Must run before puppeteer-real-browser is required
const ROOT_DIR = path.resolve(__dirname, "..");
const libsDir = path.join(ROOT_DIR, "libs");
const libsBinDir = path.join(libsDir, "usr/bin");

// Setup patched Xvfb that uses /tmp/xb/xkbcomp instead of /usr/bin/xkbcomp
(function () {
  // 1. Set LD_LIBRARY_PATH to include all library dirs from libs/
  if (fs.existsSync(libsDir)) {
    const libPaths = new Set();
    const scanForLibs = (dir) => {
      try {
        const files = fs.readdirSync(dir);
        let hasLib = false;
        for (const file of files) {
          const full = path.join(dir, file);
          try {
            const stat = fs.statSync(full);
            if (stat.isDirectory()) scanForLibs(full);
            else if (file.endsWith(".so") || file.includes(".so.")) hasLib = true;
          } catch (e) {}
        }
        if (hasLib) libPaths.add(dir);
      } catch (e) {}
    };
    scanForLibs(libsDir);

    // Add standard lib paths
    libPaths.add(path.join(libsDir, "usr/lib"));
    libPaths.add(path.join(libsDir, "lib/x86_64-linux-gnu"));
    libPaths.add(path.join(libsDir, "usr/lib/x86_64-linux-gnu"));
    libPaths.add(path.join(libsDir, "lib/aarch64-linux-gnu"));
    libPaths.add(path.join(libsDir, "usr/lib/aarch64-linux-gnu"));

    const existingPaths = Array.from(libPaths).filter((p) => fs.existsSync(p));
    const ldPath = existingPaths.join(":");
    if (!process.env.LD_LIBRARY_PATH || !process.env.LD_LIBRARY_PATH.includes(ldPath)) {
      process.env.LD_LIBRARY_PATH = ldPath + ":" + (process.env.LD_LIBRARY_PATH || "");
    }
  }

  // 2. Ensure PATH includes /tmp/bin and all bin dirs in libs/
  const binDirs = [
    path.join(libsDir, "bin"),
    path.join(libsDir, "usr/bin"),
    path.join(libsDir, "sbin"),
    path.join(libsDir, "usr/sbin"),
    "/tmp/bin",
    "/tmp/xb",
  ];
  for (const b of binDirs) {
    if (fs.existsSync(b) && !process.env.PATH.includes(b)) {
      process.env.PATH = b + ":" + process.env.PATH;
    }
  }

  // Create executable /tmp/bin/ps shell wrapper script so spawn('ps') never fails with ENOENT
  try {
    fs.mkdirSync("/tmp/bin", { recursive: true });
    try { fs.unlinkSync("/tmp/bin/ps"); } catch (e) {}
    const psWrapper = `#!/bin/sh\nfor p in /home/container/libs/bin/ps /home/container/libs/usr/bin/ps /usr/bin/ps /bin/ps; do\n  if [ -x "$p" ]; then exec "$p" "$@"; fi\ndone\nexit 0\n`;
    fs.writeFileSync("/tmp/bin/ps", psWrapper, { mode: 0o755 });
    console.log("[CF Bypass] Created /tmp/bin/ps fallback wrapper script.");
  } catch (e) {}

  // 3. Create /tmp/xb/xkbcomp shell wrapper script with full LD_LIBRARY_PATH exported
  const xkbcompSrc = path.join(libsBinDir, "xkbcomp");
  if (fs.existsSync(xkbcompSrc)) {
    try {
      fs.mkdirSync("/tmp/xb", { recursive: true });
      try { fs.unlinkSync("/tmp/xb/xkbcomp"); } catch (e) {}
      const ldPath = process.env.LD_LIBRARY_PATH || "";
      const wrapperScript = `#!/bin/sh\nexport LD_LIBRARY_PATH="${ldPath}:$LD_LIBRARY_PATH"\nexec "${xkbcompSrc}" "$@"\n`;
      fs.writeFileSync("/tmp/xb/xkbcomp", wrapperScript, { mode: 0o755 });
      console.log(`[CF Bypass] Created /tmp/xb/xkbcomp wrapper script pointing to ${xkbcompSrc}`);
    } catch (e) {
      console.log(`[CF Bypass] xkbcomp wrapper setup: ${e.message}`);
    }
  }

  // 4. Create patched Xvfb binary (replace /usr/bin with /tmp/xb in binary)
  const patchedXvfb = path.join(libsBinDir, "Xvfb_patched");
  const origXvfb = path.join(libsBinDir, "Xvfb");
  if (!fs.existsSync(patchedXvfb) && fs.existsSync(origXvfb)) {
    try {
      console.log(`[CF Bypass] Creating patched Xvfb binary...`);
      let data = fs.readFileSync(origXvfb);
      const search = Buffer.from("/usr/bin\x00");
      const replace = Buffer.from("/tmp/xb\x00\x00");
      let idx = 0, count = 0;
      while ((idx = data.indexOf(search, idx)) !== -1) {
        replace.copy(data, idx);
        count++;
        idx += replace.length;
      }
      fs.writeFileSync(patchedXvfb, data);
      fs.chmodSync(patchedXvfb, 0o755);
      console.log(`[CF Bypass] Patched ${count} occurrences. Saved to ${patchedXvfb}`);
    } catch (e) {
      console.error(`[CF Bypass] Failed to patch Xvfb: ${e.message}`);
    }
  }

  // 5. Override the xvfb module to use our patched binary and pass env
  if (fs.existsSync(patchedXvfb)) {
    try {
      const Xvfb = require("xvfb");
      Xvfb.prototype._spawnProcess = function (lockFileExists, onAsyncSpawnError) {
        var display = this.display();
        if (lockFileExists) {
          if (!this._reuse) {
            throw new Error("Display " + display + " is already in use and the \"reuse\" option is false.");
          }
        } else {
          console.log(`[CF Bypass] Spawning patched Xvfb: ${patchedXvfb} ${display}`);
          this._process = spawn(patchedXvfb, [display].concat(this._xvfb_args || []), {
            env: {
              ...process.env,
              LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
              XKB_CONFIG_ROOT: process.env.XKB_CONFIG_ROOT,
            }
          });
          this._process.stderr.on("data", function (data) {
            process.stderr.write(`[Xvfb Stderr] ${data.toString()}`);
          });
          this._process.stdout.on("data", function (data) {
            process.stdout.write(`[Xvfb Stdout] ${data.toString()}`);
          });
          this._process.once("error", function (e) {
            onAsyncSpawnError(e);
          });
        }
      };
    } catch (e) {
      console.log(`[CF Bypass] xvfb module not available: ${e.message}`);
    }
  }

  // Set XKB_CONFIG_ROOT for keyboard config files
  const xkbdirPath = path.join(libsDir, "usr/share/X11/xkb");
  if (fs.existsSync(xkbdirPath)) {
    process.env.XKB_CONFIG_ROOT = xkbdirPath;
  }
})();

// ── Cookie/Credential Storage ──
const STORE_PATH = path.join(ROOT_DIR, ".cf-store.json");
let storedCredentials = null;

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
      if (data && data.expiry > Date.now()) {
        storedCredentials = data;
        return data;
      }
      // Clean up expired store file
      try { fs.unlinkSync(STORE_PATH); } catch (e) {}
    }
  } catch (e) {}
  storedCredentials = null;
  return null;
}

const { saveCookieCredentials } = require("./proxyHeaders.cjs");

function saveStore(data) {
  storedCredentials = data;
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data), "utf8");
    if (data.domain && data.cf_clearance) {
      saveCookieCredentials(data.domain, data.cf_clearance, data.expiry, data.userAgent, data.allCookies);
    }
  } catch (e) {
    console.error("[CF Bypass] Failed to save store:", e.message);
  }
}

function getStoredCredentials() {
  if (storedCredentials && storedCredentials.expiry > Date.now()) {
    return storedCredentials;
  }
  return loadStore();
}

// ── Chrome Path Detection (exact Strawverse pattern) ──
function getChromePath() {
  // 1. Check local native Chromium in libs/
  const nativeChromiumLib = path.join(libsDir, "usr/lib/chromium/chromium");
  if (fs.existsSync(nativeChromiumLib)) return nativeChromiumLib;

  const nativeChromiumBrowserLib = path.join(libsDir, "usr/lib/chromium-browser/chromium-browser");
  if (fs.existsSync(nativeChromiumBrowserLib)) return nativeChromiumBrowserLib;

  const nativeChromiumBin = path.join(libsDir, "usr/bin/chromium");
  if (fs.existsSync(nativeChromiumBin)) return nativeChromiumBin;

  const nativeChromiumBrowserBin = path.join(libsDir, "usr/bin/chromium-browser");
  if (fs.existsSync(nativeChromiumBrowserBin)) return nativeChromiumBrowserBin;

  // 2. Check local Chrome downloaded by setup.js
  const localDir = path.join(ROOT_DIR, ".local-browsers");
  if (fs.existsSync(localDir)) {
    const findChrome = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const full = path.join(dir, file);
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            const found = findChrome(full);
            if (found) return found;
          } else if (file === "chrome" || file === "google-chrome") {
            return full;
          }
        } catch (e) {}
      }
      return null;
    };
    try {
      const found = findChrome(localDir);
      if (found) return found;
    } catch (e) {}
  }

  // 3. Check standard global paths
  const standardPaths = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/chrome",
  ];
  for (const p of standardPaths) {
    if (fs.existsSync(p)) return p;
  }

  // 4. Try which
  try {
    const result = execSync(
      "which chromium || which chromium-browser || which google-chrome 2>/dev/null",
      { encoding: "utf8" }
    ).trim();
    if (result && fs.existsSync(result)) return result;
  } catch (e) {}

  return null;
}

function getChromePathCached() {
  return getChromePath();
}

// ── Bypass Logic (exact Strawverse pattern) ──
let bypassInProgress = null;

async function bypassCloudflare(targetSite, originalUrl) {
  const chromePath = getChromePathCached();
  if (!chromePath || !fs.existsSync(chromePath)) {
    console.warn("[CF Bypass] No valid Chrome/Chromium executable found on system. Skipping browser challenge solver.");
    return false;
  }

  if (fs.existsSync(libsBinDir) && !process.env.PATH.includes(libsBinDir)) {
    process.env.PATH = libsBinDir + ":" + process.env.PATH;
  }

  console.log(`[CF Bypass] Launching browser to solve challenge using ${chromePath}...`);

  const hasXvfb = (() => {
    try {
      execSync("which xvfb-run || which Xvfb", { stdio: "ignore" });
      return true;
    } catch (e) {
      return false;
    }
  })();

  const isHeadless = process.env.PUPPETEER_HEADLESS === "true" || !hasXvfb;
  const disableXvfb = process.env.DISABLE_XVFB === "true" || !hasXvfb;

  console.log(`[CF Bypass] Environment: hasXvfb=${hasXvfb}, headless=${isHeadless}, disableXvfb=${disableXvfb}`);

  // Clean up stale X11 lock files
  try {
    const lockFiles = fs.readdirSync("/tmp").filter((f) => f.startsWith(".X") && f.endsWith("-lock"));
    for (const lock of lockFiles) {
      try { fs.unlinkSync(path.join("/tmp", lock)); } catch (e) {}
    }
  } catch (e) {}

  let browser, page;
  const chromeArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--no-first-run",
    "--no-zygote",
  ];

  try {
    const { connect } = require("puppeteer-real-browser");
    console.log(`[CF Bypass] Primary launch (headless=${isHeadless}, disableXvfb=${disableXvfb})...`);
    const res = await connect({
      headless: isHeadless,
      disableXvfb: disableXvfb,
      turnstile: true,
      customConfig: { chromePath: chromePath },
      args: chromeArgs,
    });
    browser = res.browser;
    page = res.page;
  } catch (err) {
    console.error("[CF Bypass] Primary launch failed:", err.message);
    // Fallback: headless mode
    console.log("[CF Bypass] Fallback: headless mode with disableXvfb=true...");
    try {
      const { connect } = require("puppeteer-real-browser");
      const res = await connect({
        headless: "new",
        disableXvfb: true,
        turnstile: true,
        customConfig: { chromePath: chromePath },
        args: chromeArgs,
      });
      browser = res.browser;
      page = res.page;
    } catch (fallbackErr) {
      console.error("[CF Bypass] Fallback launch failed:", fallbackErr.message);
      return false;
    }
  }

  const originalUA = await page.evaluate("navigator.userAgent");
  console.log(`[CF Bypass] Browser UA: ${originalUA}`);

  // Navigate to target site
  const siteUrl = targetSite || "https://weebcentral.com";
  console.log(`[CF Bypass] Navigating to ${siteUrl}...`);
  await page.goto(siteUrl, { waitUntil: "domcontentloaded" });

  let passed = false;
  let cfClearanceCookie = null;
  let userAgent = originalUA;

  // Poll for up to 120 seconds (same as Strawverse)
  for (let i = 0; i < 120; i++) {
    try {
      const title = await page.title();
      const url = page.url();
      const cookies = await page.cookies();
      const cfCookie = cookies.find((c) => c.name === "cf_clearance");

      if (
        cfCookie &&
        !title.toLowerCase().includes("just a moment") &&
        !title.toLowerCase().includes("attention required") &&
        !url.includes("cdn-cgi")
      ) {
        passed = true;
        cfClearanceCookie = cfCookie;
        userAgent = await page.evaluate("navigator.userAgent");
        break;
      }
    } catch (err) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (passed && cfClearanceCookie) {
    console.log("[CF Bypass] Challenge solved! Capturing clearance token...");

    // Capture ALL cookies from the browser session (not just cf_clearance)
    // Cloudflare Bot Management often requires __cf_bm and other cookies alongside cf_clearance
    let allBrowserCookies = await page.cookies();
    console.log(`[CF Bypass] Captured ${allBrowserCookies.length} cookies from browser session`);

    // Warm up the original failing path so Cloudflare grants clearance for that route too
    if (originalUrl) {
      try {
        const origParsed = new URL(originalUrl);
        if (origParsed.pathname && origParsed.pathname !== '/') {
          const warmupUrl = origParsed.origin + origParsed.pathname;
          console.log(`[CF Bypass] Warming up route: ${warmupUrl}...`);
          await page.goto(warmupUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
          await new Promise((r) => setTimeout(r, 2000));
          // Re-capture cookies after visiting the actual path
          allBrowserCookies = await page.cookies();
          const updatedCf = allBrowserCookies.find((c) => c.name === "cf_clearance");
          if (updatedCf) cfClearanceCookie = updatedCf;
          console.log(`[CF Bypass] Re-captured ${allBrowserCookies.length} cookies after route warmup`);
        }
      } catch (e) {
        console.log(`[CF Bypass] Route warmup failed (non-fatal): ${e.message}`);
      }
    }

    const allCookiesStr = allBrowserCookies
      .filter((c) => c.name && c.value)
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    const expiry = cfClearanceCookie.expires
      ? cfClearanceCookie.expires * 1000
      : Date.now() + 1000 * 60 * 60 * 2;

    const data = {
      cf_clearance: cfClearanceCookie.value,
      allCookies: allCookiesStr,
      userAgent: userAgent,
      expiry: expiry,
      domain: new URL(siteUrl).hostname,
    };

    saveStore(data);
    console.log(`[CF Bypass] Saved cf_clearance + ${allBrowserCookies.length} cookies (expires ${new Date(expiry).toISOString()})`);
  } else {
    console.log("[CF Bypass] Failed to solve challenge or browser was closed.");
  }

  try {
    if (browser) {
      if (typeof browser.process === "function" && browser.process()) {
        browser.process().on("error", () => {});
      }
      await browser.close().catch(() => {});
    }
  } catch (e) {}
  return passed;
}

/**
 * Main entry point - called by response interceptor when NEED_CAPTCHA / 403 / 503
 */
async function cloudflareBypass(url, force = false, referer = "") {
  if (!force) {
    const stored = getStoredCredentials();
    if (stored) return stored;
  }

  if (bypassInProgress) {
    console.log("[CF Bypass] Bypass already in progress, waiting...");
    return bypassInProgress;
  }

  bypassInProgress = (async () => {
    try {
      // Derive solve site from the actual failing URL instead of hardcoding
      let solveSite;
      try {
        solveSite = new URL(url).origin;
      } catch (e) {
        solveSite = "https://weebcentral.com";
      }

      const success = await bypassCloudflare(solveSite, url);
      if (!success) return null;
      return getStoredCredentials();
    } finally {
      bypassInProgress = null;
    }
  })();

  return bypassInProgress;
}

// Global process error handler to prevent spawn ps ENOENT from crashing server during cleanup
process.on("uncaughtException", (err) => {
  if (err && (err.code === "ENOENT" || err.syscall?.includes("spawn ps") || err.message?.includes("spawn ps"))) {
    console.warn("[CF Bypass] Handled non-fatal spawn ps error during process cleanup.");
    return;
  }
  console.error("Uncaught Exception:", err);
});

// Initialize on load
loadStore();

module.exports = {
  cloudflareBypass,
  bypassCloudflare,
  getStoredCredentials,
  getChromePath,
};
