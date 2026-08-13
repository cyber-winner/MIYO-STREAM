import React from 'react';
export function Terms() {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: "By accessing and using MIYO-STREAM, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this service."
    },
    {
      title: "2. Nature of the Service",
      content: "MIYO-STREAM is an open-source web application designed as a catalog and search interface for publicly available entertainment metadata. We do not host, upload, or store any video, audio, or media files on our servers."
    },
    {
      title: "3. Third-Party APIs",
      content: "All movie, TV show, and anime metadata, images, and synopses are fetched dynamically from third-party APIs, primarily TMDB (The Movie Database) and AniList. MIYO-STREAM is not endorsed or certified by these providers."
    },
    {
      title: "4. Embedded Players & Copyright",
      content: "Streaming functionality relies entirely on embedded iframes from third-party video hosting services (such as videasy.net) or backend proxies resolving dynamic source links (powered by the StrawVerse architecture). MIYO-STREAM has no control over the content hosted on external servers. Any DMCA takedown requests regarding video content must be directed to the third-party platforms that are actually hosting the files."
    },
    {
      title: "5. Device Fingerprinting & Automated Data Collection",
      content: "By using MIYO-STREAM, you consent to the automated collection of anonymous device fingerprint data as described in our Privacy Policy. This includes hardware characteristics, browser environment data, rendering signatures, audio processing fingerprints, font detection, locale settings, accessibility preferences, and network information. This data is collected solely for platform security, abuse prevention, and rate-limit enforcement. Continued use of the platform constitutes your consent to this data collection."
    },
    {
      title: "6. Anti-Abuse Measures & Right to Deny Service",
      content: "MIYO-STREAM employs automated abuse detection systems including API rate limiting, burst request detection, scraping pattern recognition, and device fingerprint analysis. We reserve the right to immediately and without notice: (a) block, ban, or restrict access for any IP address or device fingerprint identified as abusive, (b) deny service to users engaging in automated scraping, denial-of-service attacks, or excessive API consumption, (c) permanently ban devices or networks that repeatedly violate rate limits or exhibit bot-like behavior. Bans may be temporary or permanent at the sole discretion of the platform administrator."
    },
    {
      title: "7. Prohibited Activities",
      content: "You agree not to: (a) use automated tools, bots, or scripts to scrape, crawl, or harvest data from MIYO-STREAM, (b) attempt to circumvent rate limits, device fingerprinting, or IP-based restrictions, (c) share or distribute tools designed to bypass MIYO-STREAM's security measures, (d) attempt to impersonate other devices by manipulating fingerprint signals, (e) launch denial-of-service attacks against the platform or its APIs, (f) reverse-engineer the admin panel or its authentication mechanisms."
    },
    {
      title: "8. Open Source License",
      content: "The MIYO-STREAM source code is licensed under the MIT License. You are free to view, use, modify, and distribute the source code in accordance with the terms of the MIT License. A special acknowledgment is given to the StrawVerse project."
    },
    {
      title: "9. Limitation of Liability",
      content: "The MIYO-STREAM software is provided 'as is', without warranty of any kind. In no event shall the developers or contributors be liable for any claim, damages, or other liability arising from your use of the application, including legal disputes arising from third-party streaming embeds, or damages resulting from enforcement actions (bans, blocks) taken against abusive devices or IPs."
    },
    {
      title: "10. User Responsibility",
      content: "Users are responsible for their own actions and the legality of the content they access in their respective jurisdictions. MIYO-STREAM is intended for educational and personal use only."
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
            Last Updated: August 2026
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
           <p className="text-sm font-bold text-text-secondary">
             Questions about our terms? Please open an issue on the MIYO-STREAM GitHub repository.
           </p>
        </div>
      </div>
    </div>
  );
}