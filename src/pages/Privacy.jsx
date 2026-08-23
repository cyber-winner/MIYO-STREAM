import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';

const ExtLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/30 hover:decoration-accent transition-colors">{children}</a>
);

export function Privacy() {
  useSEO({
    title: 'Privacy Policy',
    description: 'Privacy Policy for TETO-STREAM — what data we collect, how we store it, device fingerprinting, third-party integrations, and your rights.',
  });

  const sections = [
    {
      title: "1. Local-First Storage",
      content: "TETO-STREAM is designed as a local-first application. Your watch history, video progress, bookmarks, theme preferences, and UI settings are stored locally on your device via browser localStorage. This data never leaves your machine unless explicitly stated otherwise. TETO-STREAM does not require user accounts, logins, or any form of personal registration."
    },
    {
      title: "2. Data We Collect",
      content: "TETO-STREAM collects limited data for platform security and abuse prevention. This includes: anonymous device fingerprints (one-way hashes of GPU rendering, audio context, system fonts, screen resolution, timezone, locale, and browser entropy), API request logs (endpoint, HTTP method, response status, response time, IP address, fingerprint ID), and basic network information. We do not collect names, emails, phone numbers, or any personally identifiable information."
    },
    {
      title: "3. Device Fingerprinting",
      content: "To protect against automated abuse, scraping, and denial-of-service attacks, TETO-STREAM generates anonymous device fingerprints. These fingerprints are non-reversible SHA-256 hashes derived from your browser and hardware characteristics. They identify device configurations — not individuals. You cannot be personally identified from a device fingerprint. Fingerprint records are retained as long as the associated device actively visits the platform."
    },
    {
      title: "4. Server Logs & Retention",
      content: <>TETO-STREAM logs API requests for platform monitoring, performance optimization, and abuse detection. Logs include the endpoint URL, HTTP method, response status code, response time, client IP address, and device fingerprint ID. All server logs are automatically purged after 30 days via <ExtLink href="https://www.mongodb.com/docs/manual/core/index-ttl/">MongoDB TTL (Time-To-Live) indexes</ExtLink>. No logs are retained beyond this period.</>
    },
    {
      title: "5. Data Storage & Security",
      content: <>Server-side data (device fingerprints, API logs, ban records) is stored in a private <ExtLink href="https://www.mongodb.com/">MongoDB</ExtLink> database. Storage buckets are not publicly accessible. All data is encrypted in transit via TLS 1.2+. Database access is restricted to a single authorized administrator authenticated via <ExtLink href="https://developers.google.com/identity/protocols/oauth2">Google OAuth 2.0</ExtLink>. No user-submitted personal data exists because no signup or personal data submission is required.</>
    },
    {
      title: "6. Third-Party Services",
      content: <>TETO-STREAM integrates with third-party services that may independently collect data according to their own privacy policies: <ExtLink href="https://www.themoviedb.org/">TMDB (The Movie Database)</ExtLink> — movie and TV metadata, images, and trailers. <ExtLink href="https://anilist.co/">AniList</ExtLink> — anime and manga metadata via GraphQL API. Third-party embedded video players — may collect IP addresses or set cookies to deliver streams. <ExtLink href="https://github.com/TheYogMehta/StrawVerse">StrawVerse</ExtLink>-inspired proxy endpoints — resolve HLS segment URLs client-side without storing media. TETO-STREAM has no control over data practices of these external services.</>
    },
    {
      title: "7. Network Activity",
      content: <>Outbound network requests made by the application include: metadata API calls to <ExtLink href="https://www.themoviedb.org/">TMDB</ExtLink> and <ExtLink href="https://anilist.co/">AniList</ExtLink> from your browser, HLS stream segment requests resolved client-side through proxy endpoints, font and asset loading from CDNs, and optional <ExtLink href="https://analytics.google.com/">Google Analytics</ExtLink> tracking (if configured via environment variables). All requests occur directly from your device to the respective endpoints.</>
    },
    {
      title: "8. Cookies & Tracking",
      content: <>TETO-STREAM itself does not use tracking cookies, advertising pixels, or cross-site tracking mechanisms. However, third-party embedded iframes (video players) may independently set cookies. If <ExtLink href="https://analytics.google.com/">Google Analytics</ExtLink> is enabled, it uses cookies to measure traffic. You can control cookie behavior via your browser settings or our cookie consent banner.</>
    },
    {
      title: "9. Administrative Access",
      content: <>Platform administration is restricted to a single authorized administrator authenticated via <ExtLink href="https://developers.google.com/identity/protocols/oauth2">Google OAuth 2.0</ExtLink>. The admin panel provides access to: aggregated platform analytics (request counts, response times), device fingerprint records and ban management, abuse detection logs and rate-limit violations. No personally identifiable user data is stored or accessible through the admin panel.</>
    },
    {
      title: "10. No Fake Testimonials",
      content: "TETO-STREAM does not fabricate user testimonials, generate fake reviews, create misleading endorsements, or inflate usage statistics. Any user feedback displayed on the platform is genuine and unaltered."
    },
    {
      title: "11. Your Rights",
      content: "Since TETO-STREAM does not require accounts or collect personally identifiable information, there is no personal profile to delete, export, or modify. Device fingerprints are anonymous hashes that cannot be traced back to an individual. To reset all local data (watch history, preferences, bookmarks), clear your browser's localStorage for this site at any time."
    },
    {
      title: "12. Open-Source Verification",
      content: <>TETO-STREAM is completely open source under the <ExtLink href="https://github.com/cyber-winner/TETO-STREAM/blob/main/LICENSE">GNU General Public License v3.0 (GPL-3.0)</ExtLink>. You can audit the entire source code — including the server, fingerprinting system, proxy architecture, and admin panel — at any time on our <ExtLink href="https://github.com/cyber-winner/TETO-STREAM">GitHub repository</ExtLink>. Every claim in this privacy policy can be independently verified against the codebase.</>
    },
    {
      title: "13. Changes to This Policy",
      content: "We may update this Privacy Policy from time to time. Changes will be reflected on this page with an updated effective date. Continued use of the platform after changes constitutes acceptance of the revised policy."
    },
    {
      title: "14. Contact",
      content: <>If you have questions about this Privacy Policy, our data practices, or wish to report a concern, contact us at <a href="mailto:contact@tetocreations.bond" className="text-accent underline decoration-accent/30 hover:decoration-accent transition-colors">contact@tetocreations.bond</a> or open an issue on the official <ExtLink href="https://github.com/cyber-winner/TETO-STREAM/issues">TETO-STREAM GitHub repository</ExtLink>.</>
    }
  ];

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen animate-in fade-in duration-700">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase mb-4">
            Privacy <span className="text-accent animate-rgb-shift">Policy</span>
          </h1>
          <p className="text-text-secondary text-sm font-bold uppercase tracking-widest opacity-60">
            Effective Date: August 2026
          </p>
        </div>

        {/* Key summary callout */}
        <div className="mb-10 p-6 rounded-[2rem] bg-green-500/5 border border-green-500/15">
          <p className="text-green-400 text-sm font-semibold mb-2">🔒 Summary</p>
          <ul className="text-text-secondary text-sm leading-relaxed space-y-1">
            <li>• No accounts, no signup, no personal data collection</li>
            <li>• Watch history & preferences stored locally on your device</li>
            <li>• Anonymous device fingerprints for anti-abuse only</li>
            <li>• Server logs auto-purged after 30 days</li>
            <li>• Private database — storage is not public</li>
            <li>• 100% open source — <ExtLink href="https://github.com/cyber-winner/TETO-STREAM">verify everything in our codebase</ExtLink></li>
          </ul>
        </div>

        <div className="space-y-12">
          {sections.map((section, index) => (
            <section key={index} className="bg-surface/30 backdrop-blur-xl border border-white/5 p-8 rounded-[2rem] hover:border-accent/20 transition-colors group">
              <h2 className="text-xl font-black text-white mb-4 uppercase tracking-tight group-hover:text-accent transition-colors">
                {section.title}
              </h2>
              <p className="text-text-secondary leading-relaxed text-sm md:text-base opacity-90">
                {section.content}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-16 p-8 bg-accent/5 border border-accent/10 rounded-[2rem] text-center">
          <p className="text-sm font-bold text-text-secondary mb-4">
            Transparency matters. TETO-STREAM is open source — our code is public, our policies are honest.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="https://github.com/cyber-winner/TETO-STREAM" target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">
              Audit the Source Code
            </a>
            <a href="mailto:contact@tetocreations.bond" className="px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-xs text-accent hover:bg-accent/20 transition-colors">
              contact@tetocreations.bond
            </a>
            <Link to="/terms" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">
              Terms of Service
            </Link>
            <Link to="/dmca" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">
              DMCA & Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}