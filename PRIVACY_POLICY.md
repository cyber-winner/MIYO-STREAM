# TETO-STREAM Privacy Policy

Last Updated: August 2026

---

## 1. Information We Do Not Collect

TETO-STREAM is designed to respect your privacy. As an open-source catalog and streaming interface, we do not require you to register, log in, or provide an email address. We do not collect, store, or process personal identifiable information (PII) such as names, addresses, or payment details.

## 2. Local Storage & Client-Side Data

To enhance your experience, TETO-STREAM utilizes your browser's local storage to save preferences such as your watch history, progress on videos, UI preferences (e.g., light/dark mode), and saved bookmarks. This data remains strictly on your device and is never transmitted to our backend servers.

## 3. Third-Party Services & APIs

TETO-STREAM functions as an interface that pulls data from various third-party services. We fetch movie and TV show metadata from TMDB, and anime/manga metadata from AniList. Anime playback utilizes a StrawVerse-inspired backend proxy engine to securely fetch video segments.

## 4. Embedded Video Players

For non-anime content, TETO-STREAM does not host any video content. All video playback is handled via embedded iframes from third-party providers. When you stream an embedded video, the player provider may collect IP addresses, device information, or utilize cookies to deliver the stream.

## 5. Device Fingerprinting & Anti-Abuse Data Collection

To protect the platform from abuse, automated scraping, and denial-of-service attacks, TETO-STREAM collects anonymous device fingerprint data. This fingerprint is a non-reversible hash generated from your browser and hardware characteristics. It does not identify you personally — it identifies your device configuration. The following categories of technical data are collected:

### 5.1 Graphics & Hardware Rendering Data

We collect a hash of how your browser renders 2D canvas elements and 3D WebGL scenes. Sub-pixel rendering differences caused by GPU drivers, anti-aliasing implementations, and graphics hardware yield a distinct signature. We also collect your GPU vendor name, renderer identifier, and supported WebGL capabilities and extensions.

### 5.2 Audio Processing Characteristics

We generate an audio fingerprint by processing a test signal through your browser's AudioContext pipeline (oscillator → compressor → analyser). Subtle differences in DSP implementations across browsers and operating systems produce a unique hash. We also record audio sample rate and channel count.

### 5.3 Hardware Architecture & System Specs

We collect CPU core count (navigator.hardwareConcurrency), device memory (navigator.deviceMemory), screen resolution, color depth, device pixel ratio, color gamut support (sRGB/P3/Rec2020), HDR capability, and touch point count. Battery status may be queried where supported.

### 5.4 Installed System Fonts & Speech Engines

We detect which system fonts are installed by measuring text rendering dimensions against baseline fonts. We also enumerate available text-to-speech voices via the Web Speech API. The specific combination of installed fonts and TTS engines is highly unique to each system.

### 5.5 Browser Environment & Execution Quirks

We collect your User-Agent string, platform identifier, PDF viewer status, plugin count, cookie enablement status, Do Not Track setting, JavaScript engine type (detected via error stack format differences), and supported media codec profiles for audio and video formats.

### 5.6 Time, Locale & Internationalization

We collect your IANA timezone identifier, UTC offset, daylight saving time configuration, preferred language(s), and Intl API formatting rules for numbers, dates, and currency. These locale signals are combined with other attributes to strengthen the fingerprint.

### 5.7 Accessibility & System Preferences

We detect your operating system's accessibility preferences including color scheme (dark/light), reduced motion, reduced transparency, high contrast mode, and forced colors settings. These are queried via CSS media queries and are never used to discriminate — only to differentiate device configurations.

### 5.8 Network & Transport Information

We collect network connection type (WiFi/cellular), effective bandwidth, round-trip time (RTT), and data saver status via the Network Information API where available. On the server side, we record your IP address, TLS handshake metadata, and Cloudflare security headers.

## 6. Purpose of Device Fingerprinting

Device fingerprints are used exclusively for:

- (a) Detecting and blocking automated scrapers and bots
- (b) Enforcing API rate limits and preventing abuse
- (c) Identifying and banning devices engaged in denial-of-service patterns
- (d) Platform security monitoring

Fingerprints are anonymous device identifiers — they do not link to any personal identity, email, or account.

## 7. Data Retention & Storage

Fingerprint data is stored in a secured MongoDB database. Request analytics logs are automatically deleted after 30 days via TTL indexes. Device fingerprint records are retained as long as the device continues to visit the platform. Admin session tokens expire after 7 days. All data is encrypted in transit via TLS.

## 8. Analytics and Server Logs

TETO-STREAM logs API requests including endpoint, HTTP method, response status code, response time, IP address, and device fingerprint ID. These logs are used for platform monitoring, abuse detection, and performance optimization. They are retained for 30 days and then automatically purged.

## 9. Administrative Access

Platform administration is restricted to a single authorized administrator authenticated via Google OAuth 2.0. The admin panel provides access to aggregated device fingerprints, request analytics, ban management, and abuse detection reports. No personal user data is accessible through the admin panel.

## 10. Contact Us

If you have any questions about this Privacy Policy or how we handle data, please open an issue on our official GitHub repository.

---

*Your privacy is our priority. TETO-STREAM is an open-source project.*
