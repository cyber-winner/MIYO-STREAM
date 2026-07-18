# Privacy Policy for MIYO-STREAM

**Last Updated:** June 2026

Welcome to MIYO-STREAM! Your privacy is critically important to us. This Privacy Policy explains how we collect, use, and protect your information when you use our web application.

## 1. Information We Do Not Collect
MIYO-STREAM is designed to respect your privacy. As an open-source catalog and streaming interface:
- **No Accounts Required:** We do not require you to register, log in, or provide an email address to use the platform.
- **No Personal Data Storage:** We do not collect, store, or process personal identifiable information (PII) such as names, addresses, or payment details.

## 2. Local Storage & Client-Side Data
To enhance your experience, MIYO-STREAM utilizes your browser's local storage (e.g., `localStorage`) to save preferences such as:
- Your watch history or progress on videos.
- UI preferences (e.g., light/dark mode, preferred layouts).
- Saved bookmarks or collections.

This data remains strictly on your device and is never transmitted to our backend servers. If you clear your browser data, these preferences will be reset.

## 3. Third-Party Services & APIs
MIYO-STREAM functions as an interface that pulls data from various third-party services. When you use MIYO-STREAM, you may also be interacting with these services, which have their own privacy policies:
- **TMDB (The Movie Database):** We fetch movie and TV show metadata from TMDB.
- **AniList:** We fetch anime and manga metadata via the AniList API.
- **Anime Providers (StrawVerse engine):** Anime video playback operates via a backend proxy engine (inspired by StrawVerse) that fetches streams directly from public providers without tracking you.
- **Movie Embeds:** Non-anime video playback is handled via embedded iframes from third-party providers. When you stream a video using these iframes, the player provider may collect IP addresses or utilize cookies to deliver the stream.

## 4. Server Logs
Because MIYO-STREAM uses an Express backend to proxy API requests and video segments, standard server logs (such as IP addresses, browser types, and timestamped requests) may be temporarily captured by the host for security and rate-limiting purposes. We do not use this data for marketing or tracking individual users.

## 5. Changes to This Policy
Because MIYO-STREAM is an open-source project in active development, we may update this Privacy Policy from time to time. Any changes will be reflected in this document within the GitHub repository.

## 6. Contact Us
If you have any questions about this Privacy Policy or the open-source project, please open an issue on our [GitHub repository](https://github.com/cyber-winner/MIYO-STREAM/issues).
