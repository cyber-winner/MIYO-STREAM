import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';

const ExtLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/30 hover:decoration-accent transition-colors">{children}</a>
);

export function Terms() {
  useSEO({
    title: 'Terms of Service',
    description: 'Terms of Service for MIYO-STREAM — open-source license, client-side behavior, user responsibilities, anti-abuse, and service guarantees.',
  });

  const sections = [
    {
      title: "1. Open-Source Software License",
      content: <>MIYO-STREAM is free, open-source software licensed under the <ExtLink href="https://github.com/cyber-winner/MIYO-STREAM/blob/main/LICENSE">GNU General Public License v3.0 (GPL-3.0)</ExtLink>. You are permitted to inspect, modify, fork, and distribute the codebase in accordance with the terms of the GPL-3.0 license. Special acknowledgment is given to the <ExtLink href="https://github.com/TheYogMehta/StrawVerse">StrawVerse</ExtLink> project, whose proxy architecture inspired MIYO-STREAM's streaming resolution engine.</>
    },
    {
      title: "2. Client-Side Application Behavior",
      content: <>MIYO-STREAM functions primarily as a client-side web application and catalog interface. The frontend executes in your browser. Stream resolution, HLS proxy mapping, and source link lookups are performed locally on your device via the <ExtLink href="https://github.com/TheYogMehta/StrawVerse">StrawVerse</ExtLink>-inspired architecture. MIYO-STREAM does not host, upload, cache, or store any video, audio, manga chapters, or copyright-protected media files on its servers.</>
    },
    {
      title: "3. Third-Party APIs & Metadata",
      content: <>All movie and TV show metadata, images, trailers, and synopses are fetched dynamically from <ExtLink href="https://www.themoviedb.org/">TMDB (The Movie Database)</ExtLink>. Anime and manga data is sourced from <ExtLink href="https://anilist.co/">AniList</ExtLink> via GraphQL. MIYO-STREAM is not endorsed, affiliated with, or certified by TMDB, AniList, or any content provider. All trademarks belong to their respective owners.</>
    },
    {
      title: "4. Embedded Players & Streaming",
      content: <>Video playback relies on embedded iframes from third-party video hosting services or client-side HLS proxy resolution. For anime, episode sources are resolved through backend proxy endpoints that fetch and relay HLS segments without storing them. MIYO-STREAM has no control over the content hosted on external platforms. DMCA takedown requests regarding video content must be directed to the third-party platforms actually hosting the files — see our <Link to="/dmca" className="text-accent underline decoration-accent/30 hover:decoration-accent transition-colors">DMCA page</Link> for details.</>
    },
    {
      title: "5. User Responsibility",
      content: "Users are solely responsible for compliance with copyright and intellectual property laws in their respective jurisdictions. Any third-party integrations, external streaming sources, or user-configured providers are accessed entirely at the user's discretion. MIYO-STREAM is intended for educational and personal use only."
    },
    {
      title: "6. Device Fingerprinting & Anti-Abuse",
      content: "By using MIYO-STREAM, you consent to automated collection of anonymous device fingerprints for platform security. This includes GPU rendering signatures, audio context fingerprints, system fonts, screen properties, timezone, locale, and browser entropy. These fingerprints are one-way hashes — they identify device configurations, not individuals. We use this data to: detect bots and automated scrapers, enforce API rate limits, block denial-of-service attacks, and ban abusive devices or IPs. Bans may be temporary or permanent at the sole discretion of the administrator."
    },
    {
      title: "7. Prohibited Activities",
      content: "You agree not to: (a) use automated tools, bots, or scripts to scrape or crawl MIYO-STREAM, (b) circumvent rate limits, device fingerprinting, or IP-based restrictions, (c) distribute tools designed to bypass MIYO-STREAM's security measures, (d) manipulate fingerprint signals to impersonate other devices, (e) launch denial-of-service attacks against the platform or its APIs, (f) reverse-engineer the admin panel or its authentication mechanisms."
    },
    {
      title: "8. No Account Required",
      content: <>MIYO-STREAM guarantees: (a) the platform will remain free — no paywalls, premium tiers, or hidden charges will ever be introduced, (b) no signup or account creation will ever be required to browse or stream content, (c) the source code will remain open source under the <ExtLink href="https://github.com/cyber-winner/MIYO-STREAM/blob/main/LICENSE">GPL-3.0 License</ExtLink>, (d) we will never fabricate user testimonials or reviews, (e) all data practices will be transparently documented in our <Link to="/privacy" className="text-accent underline decoration-accent/30 hover:decoration-accent transition-colors">Privacy Policy</Link>.</>
    },
    {
      title: "Disclaimer",
      content: <>MIYO-STREAM is an independent open-source client-side streaming interface. It does not stream, host, archive, cache, or distribute any media assets, video files, manga chapters, databases, or copyright-protected files. It serves strictly as a client-side interface for user-defined external sources. All indexing lookups, stream playback mappings, and file downloads occur locally on the user's end machine. Sourcing external mapping repositories or content providers is subject to those individual providers' policies. Users are solely responsible for ensuring compliance with intellectual property regulations in their jurisdictions. For more details, see our <Link to="/dmca" className="text-accent underline decoration-accent/30 hover:decoration-accent transition-colors">DMCA & Disclaimer</Link> page.</>
    },
    {
      title: "9. Service Availability",
      content: <>MIYO-STREAM operates 24/7. While we strive for maximum uptime, we do not guarantee uninterrupted service. Maintenance windows, upstream API outages (<ExtLink href="https://www.themoviedb.org/">TMDB</ExtLink>, <ExtLink href="https://anilist.co/">AniList</ExtLink>), or infrastructure issues may cause temporary disruptions. For support: email inquiries are answered within 24 hours, <ExtLink href="https://github.com/cyber-winner/MIYO-STREAM/issues">GitHub issues</ExtLink> within 48 hours, and security reports within 12 hours.</>
    },
    {
      title: "10. Disclaimer of Warranties",
      content: "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS, CONTRIBUTORS, OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM YOUR USE OF THE APPLICATION, INCLUDING LEGAL DISPUTES ARISING FROM THIRD-PARTY STREAMING EMBEDS OR ENFORCEMENT ACTIONS TAKEN AGAINST ABUSIVE DEVICES."
    },
    {
      title: "11. Support & Contributions",
      content: <>Community support, bug reports, feature requests, and code contributions are welcomed on the official <ExtLink href="https://github.com/cyber-winner/MIYO-STREAM">MIYO-STREAM GitHub repository</ExtLink>. For direct inquiries, contact <a href="mailto:contact@cyber-winner.site" className="text-accent underline decoration-accent/30 hover:decoration-accent transition-colors">contact@cyber-winner.site</a>.</>
    },
    {
      title: "12. Changes to These Terms",
      content: "We may update these Terms of Service from time to time. Changes will be reflected on this page with an updated effective date. Continued use of the platform after changes constitutes acceptance of the revised terms."
    }
  ];

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen animate-in fade-in duration-700">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase mb-4">
            Terms of <span className="text-accent animate-rgb-shift">Service</span>
          </h1>
          <p className="text-text-secondary text-sm font-bold uppercase tracking-widest opacity-60">
            Effective Date: August 2026
          </p>
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
            Questions about our terms?
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <ExtLink href="https://github.com/cyber-winner/MIYO-STREAM">
              <span className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors inline-block no-underline">GitHub Repository</span>
            </ExtLink>
            <a href="mailto:contact@cyber-winner.site" className="px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-xs text-accent hover:bg-accent/20 transition-colors">
              contact@cyber-winner.site
            </a>
            <Link to="/dmca" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">
              DMCA & Disclaimer
            </Link>
            <Link to="/privacy" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-text-secondary hover:text-accent hover:border-accent/20 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}