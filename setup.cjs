/**
 * TETO-STREAM Setup Script (ported from Strawverse/AnimeMapper)
 * Downloads Chrome + all required shared libraries for headless browser
 * operation on HidenCloud containers without root access.
 * 
 * Run once on first deploy: `node setup.js`
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function getBrowsersModule() {
  try {
    return require("@puppeteer/browsers");
  } catch (err) {
    console.log("[Setup] Installing @puppeteer/browsers to download browser...");
    try {
      execSync("npm install @puppeteer/browsers --no-save --no-audit --no-fund", {
        stdio: "inherit",
      });
      return require("@puppeteer/browsers");
    } catch (e) {
      console.error("[Setup] Failed to install @puppeteer/browsers:", e.message);
      return null;
    }
  }
}

async function setup() {
  console.log("=== TETO-STREAM: Starting System Setup ===");

  const localBrowsersDir = path.resolve(__dirname, "./.local-browsers");

  // 1. Install Chrome programmatically if not present
  let hasLocalChrome = false;
  if (fs.existsSync(localBrowsersDir)) {
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
      if (findChrome(localBrowsersDir)) {
        hasLocalChrome = true;
      }
    } catch (e) {}
  }

  // Check if Chrome is installed globally
  let hasGlobalChrome = false;
  try {
    execSync(
      "which google-chrome-stable || which google-chrome || which chromium || which chromium-browser",
      { stdio: "ignore" }
    );
    hasGlobalChrome = true;
  } catch (e) {}

  const isArm = process.arch.includes("arm") || process.arch.includes("aarch64");

  if (isArm) {
    console.log("[Setup] ARM platform detected. Will download native Chromium package.");
  } else if (hasLocalChrome || hasGlobalChrome) {
    console.log("[Setup] Chrome is already installed. Skipping Chrome download.");
  } else {
    const browsersModule = getBrowsersModule();
    if (browsersModule) {
      console.log("[Setup] Downloading Chrome using @puppeteer/browsers...");
      try {
        const { install, resolveBuildId, detectBrowserPlatform } = browsersModule;
        const platform = detectBrowserPlatform();
        const buildId = await resolveBuildId("chrome", platform, "stable");
        console.log(`[Setup] Platform: ${platform}, Build ID: ${buildId}`);
        await install({
          browser: "chrome",
          platform,
          buildId,
          cacheDir: localBrowsersDir,
        });
        console.log("[Setup] Chrome downloaded successfully.");
      } catch (err) {
        console.error("[Setup] Failed to download Chrome:", err.message);
      }
    }
  }

  // 2. Download and extract shared libraries
  await downloadLibs();
}

async function downloadLibs() {
  const isArm = process.arch.includes("arm") || process.arch.includes("aarch64");
  const libsDir = path.resolve(__dirname, "./libs");
  const successSentinel = path.join(libsDir, ".setup_success");

  // Force re-download if libxkbfile.so is missing from libs/
  const hasLib = (name) => {
    try {
      let found = false;
      const scan = (d) => {
        for (const f of fs.readdirSync(d)) {
          const full = path.join(d, f);
          if (fs.statSync(full).isDirectory()) scan(full);
          else if (f.includes(name)) found = true;
        }
      };
      scan(libsDir);
      return found;
    } catch (e) { return false; }
  };

  if (fs.existsSync(successSentinel) && !hasLib("libxkbfile")) {
    console.log("[Setup] Missing libxkbfile library. Re-running setup...");
    try { fs.unlinkSync(successSentinel); } catch (e) {}
  }

  if (fs.existsSync(successSentinel)) {
    console.log("[Setup] Libraries already present. Skipping download.");
    return;
  }

  console.log("[Setup] Downloading required system libraries...");

  try {
    fs.rmSync(libsDir, { recursive: true, force: true });
  } catch (e) {}

  // Same package groups as Strawverse AnimeMapper
  const packageGroups = [
    ["libnss3"],
    ["libnspr4"],
    ["libatk1.0-0", "libatk1.0-0t64"],
    ["libatk-bridge2.0-0", "libatk-bridge2.0-0t64"],
    ["libatspi2.0-0", "libatspi2.0-0t64", "libatspi0"],
    ["libgbm1", "libgbm1t64"],
    ["libdrm2"],
    ["libxkbcommon0", "libxkbcommon0t64"],
    ["libxkbfile1", "libxkbfile1t64"],
    ["libasound2", "libasound2t64"],
    ["libxcomposite1"],
    ["libxdamage1"],
    ["libxrandr2"],
    ["libxshmfence1"],
    ["xvfb"],
    ["libxfont2", "libxfont2t64"],
    ["libpixman-1-0"],
    ["libx11-xcb1"],
    ["libxcb-dri3-0"],
    ["libopenh264-7", "libopenh264-6", "libopenh264-cisco7", "libopenh264-cisco6", "libopenh264-5"],
    ["libcups2", "libcups2t64"],
    ["libdouble-conversion3", "libdouble-conversion3t64"],
    ["libharfbuzz-subset0", "libharfbuzz-subset0t64"],
    ["libminizip1", "libminizip1t64", "libminizip-dev"],
    ["libunwind8", "libunwind-8-dev"],
    ["libfontenc1", "libfontenc1t64"],
    ["libxnvctrl0"],
    ["libavahi-client3"],
    ["libavahi-common3"],
    ["xkbcomp", "x11-xkb-utils"],
    ["xkeyboard-config", "xkb-data"],
    ["procps"],
    ["libproc2-0", "libprocps8"],
  ];

  if (isArm) {
    packageGroups.push(["chromium-common"]);
    packageGroups.push(["chromium", "chromium-browser"]);
  }

  const tempDir = path.resolve(__dirname, "./libs-temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
  fs.mkdirSync(libsDir, { recursive: true });

  let allSuccess = true;

  for (const group of packageGroups) {
    let groupSuccess = false;
    for (const pkg of group) {
      console.log(`[Setup] Trying package: ${pkg}...`);
      try {
        execSync(`apt-get download ${pkg}`, { cwd: tempDir, stdio: "ignore" });
        const files = fs.readdirSync(tempDir);
        const debFile = files.find(
          (f) =>
            f.startsWith(pkg + "_") ||
            f.startsWith(pkg + "-") ||
            f === pkg + ".deb" ||
            (f.startsWith(pkg) && f.endsWith(".deb"))
        );
        if (debFile) {
          console.log(`[Setup] Extracting: ${pkg}...`);
          execSync(`dpkg -x "${path.join(tempDir, debFile)}" "${libsDir}"`);
          fs.unlinkSync(path.join(tempDir, debFile));
          groupSuccess = true;
          break;
        }
      } catch (err) {
        // Try next package in group
      }
    }
    if (!groupSuccess) {
      console.warn(`[Setup] Warning: Failed to get any package from group: ${group.join(", ")}`);
      allSuccess = false;
    }
  }

  // Clean up
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}

  if (allSuccess) {
    fs.writeFileSync(successSentinel, "true", "utf8");
    console.log("[Setup] All libraries downloaded and extracted successfully.");
  } else {
    // Still write sentinel — partial success is OK for most environments
    fs.writeFileSync(successSentinel, "partial", "utf8");
    console.warn("[Setup] Completed with some missing packages (may still work).");
  }
}

module.exports = setup;
if (require.main === module) {
  setup().catch((e) => {
    console.error("[Setup] Fatal error:", e.message);
    process.exit(1);
  });
}
