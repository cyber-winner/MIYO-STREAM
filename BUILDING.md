# Building MIYO Native Apps

The website is unchanged and still runs with `npm run dev` / deploys as before.
The native apps (Windows, Linux, Android) run **fully locally** — no server, no
Cloudflare proxy. They talk directly to TMDB, AniList and the anime providers
using native HTTP (which bypasses CORS and lets the app send Referer headers).

Each user enters their own **free TMDB API key** in the in-app **Settings**
page (a step-by-step guide is shown there). AniList and the anime providers
need no key.

## Easiest way: GitHub Actions (no local setup)

The repo ships with `.github/workflows/build-apps.yml`.

1. Push the repo to GitHub.
2. Go to **Actions → Build Desktop & Mobile Apps → Run workflow**
   (or push a tag like `v5.0.0`).
3. Download the artifacts:
   - `MIYO-windows` — `.msi` and `.exe` installers
   - `MIYO-linux` — `.AppImage`, `.deb`, `.rpm`
   - `MIYO-android` — debug `.apk` (installable directly on any Android device)

## Building locally

### Desktop (Tauri) — Windows & Linux

Prerequisites:
- Node.js 20+
- Rust (https://rustup.rs)
- **Linux only:** `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
- **Windows only:** Microsoft Visual Studio C++ Build Tools + WebView2 (preinstalled on Win 10/11)

```bash
npm install
npm run tauri:build     # production installers in src-tauri/target/release/bundle/
npm run tauri:dev       # run the desktop app in dev mode
```

Note: Tauri builds for the OS you run it on — build on Windows for the Windows
app, on Linux for the Linux app (or let GitHub Actions do both).

### Android (Capacitor)

Prerequisites:
- Node.js 20+
- Android Studio (or just the Android SDK + Java 21)

```bash
npm install
npm run android:sync    # builds web assets + syncs into android/
npm run android:open    # opens the project in Android Studio
```

Then in Android Studio: **Build → Build APK(s)**. Or from the CLI:

```bash
cd android && ./gradlew assembleDebug
# APK at android/app/build/outputs/apk/debug/app-debug.apk
```

For a signed release APK use `assembleRelease` with your own keystore.

## How the native apps work (architecture)

| Concern | Website (unchanged) | Native apps |
|---|---|---|
| TMDB | `/api/tmdb` proxy (server key) | Direct `api.themoviedb.org` (user's key from Settings) |
| AniList | `/api/anilist` proxy | Direct `graphql.anilist.co` |
| Anime providers | `/api/anime/*` (server runs extension) | anikoto extension bundled into the app, runs on-device |
| Video streams | `/api/proxy` (server adds Referer) | Native HTTP with Referer via a custom hls.js loader |
| Downloads | Browser save dialog | Native save dialog (desktop) / `Documents/MIYO` (Android) |

Key files:
- `src/platform/` — platform detection, native HTTP adapters (Tauri/Capacitor),
  in-app backend, native HLS loader
- `src/pages/Settings.jsx` — TMDB key entry + guide
- `src-tauri/` — Tauri (desktop) project
- `android/` — Capacitor (Android) project
- `capacitor.config.json` — Capacitor config
