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
  // Ensure libs/usr/bin is in PATH
  if (fs.existsSync(libsBinDir) && !process.env.PATH.includes(libsBinDir)) {
    process.env.PATH = libsBinDir + ":" + process.env.PATH;
    console.log(`[CF Bypass] Prepended ${libsBinDir} to PATH.`);
  }

  // Create /tmp/xb/xkbcomp symlink pointing to our local xkbcomp
  const xkbcompSrc = path.join(libsBinDir, "xkbcomp");
  if (fs.existsSync(xkbcompSrc)) {
    try {
      fs.mkdirSync("/tmp/xb", { recursive: true });
      try { fs.unlinkSync("/tmp/xb/xkbcomp"); } catch (e) {}
      fs.symlinkSync(xkbcompSrc, "/tmp/xb/xkbcomp");
      console.log(`[CF Bypass] Created /tmp/xb/xkbcomp -> ${xkbcompSrc}`);
    } catch (e) {
      console.log(`[CF Bypass] xkbcomp symlink setup: ${e.message}`);
    }
  }

  // Create patched Xvfb binary (replace /usr/bin with /tmp/xb in binary)
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

  // Override the xvfb module to use our patched binary
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
          this._process = spawn(patchedXvfb, [display].concat(this._xvfb_args || []));
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

  // Set LD_LIBRARY_PATH to include all library dirs from libs/
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
    }
  } catch (e) {}
  return null;
}

const { saveCookieCredentials } = require("./proxyHeaders.cjs");

function saveStore(data) {
  storedCredentials = data;
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data), "utf8");
    if (data.domain && data.cf_clearance) {
      saveCookieCredentials(data.domain, data.cf_clearance, data.expiry);
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

async function bypassCloudflare(targetSite) {
  const chromePath = getChromePathCached();
  if (!chromePath || !fs.existsSync(chromePath)) {
    console.warn("[CF Bypass] No valid Chrome/Chromium executable found on system. Skipping browser challenge solver.");
    return false;
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

  try {
    const { connect } = require("puppeteer-real-browser");
    console.log(`[CF Bypass] Primary launch (headless=${isHeadless}, disableXvfb=${disableXvfb})...`);
    const res = await connect({
      headless: isHeadless,
      disableXvfb: disableXvfb,
      turnstile: true,
      customConfig: { chromePath: chromePath },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
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
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
      browser = res.browser;
      page = res.page;
      console.log("[CF Bypass] Fallback connection successful!");
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
    const expiry = cfClearanceCookie.expires
      ? cfClearanceCookie.expires * 1000
      : Date.now() + 1000 * 60 * 60 * 2;

    const data = {
      cf_clearance: cfClearanceCookie.value,
      userAgent: userAgent,
      expiry: expiry,
      domain: new URL(siteUrl).hostname,
    };

    saveStore(data);
    console.log(`[CF Bypass] Saved cf_clearance (expires ${new Date(expiry).toISOString()})`);
  } else {
    console.log("[CF Bypass] Failed to solve challenge or browser was closed.");
  }

  await browser.close().catch(() => {});
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
      let solveSite = "https://weebcentral.com";
      if (url.includes("animepahe")) {
        solveSite = "https://animepahe.pw";
      }

      const success = await bypassCloudflare(solveSite);
      if (!success) return null;
      return getStoredCredentials();
    } finally {
      bypassInProgress = null;
    }
  })();

  return bypassInProgress;
}

// Initialize on load
loadStore();

module.exports = {
  cloudflareBypass,
  bypassCloudflare,
  getStoredCredentials,
  getChromePath,
};
