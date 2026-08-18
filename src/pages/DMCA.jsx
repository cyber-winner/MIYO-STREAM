import React from 'react';
import { useSEO } from '../hooks/useSEO';

export function DMCA() {
  useSEO({
    title: 'DMCA & Disclaimer',
    description: 'DMCA policy, copyright disclaimer, and legal notices for MIYO-STREAM. Learn how to submit takedown requests.',
  });

  const sections = [
    {
      title: "1. Platform Disclaimer",
      content: "MIYO-STREAM is an open-source client-side streaming interface. It does not host, store, archive, cache, upload, or distribute any video files, audio files, manga chapters, databases, or copyright-protected media. MIYO-STREAM serves strictly as a front-end catalog and search interface that aggregates publicly available metadata from third-party APIs (TMDB, AniList) and embeds playback from external sources."
    },
    {
      title: "2. Local Execution & User Responsibility",
      content: "All content discovery, stream resolution, playback mappings, and file downloads occur locally on the user's device. MIYO-STREAM utilizes a StrawVerse-inspired proxy architecture that resolves dynamic source links on the client side — no media is routed through, stored on, or served from MIYO-STREAM's infrastructure. Users are solely responsible for ensuring compliance with intellectual property laws and copyright regulations in their respective jurisdictions."
    },
    {
      title: "3. Third-Party Content & Embedded Players",
      content: "Video playback is handled entirely through embedded iframes from third-party video hosting services or through client-side HLS proxy resolution. MIYO-STREAM has no control over, and assumes no responsibility for, the content, availability, or legality of media hosted on third-party platforms. The appearance of any content within the MIYO-STREAM interface does not imply endorsement, ownership, or licensing of that content."
    },
    {
      title: "4. DMCA Takedown Requests",
      content: "Since MIYO-STREAM maintains zero media files and operates no central content servers, DMCA takedown requests regarding hosted video, audio, or image content should be directed to the third-party providers or web hosts where the content is actually stored and served. MIYO-STREAM cannot remove content it does not host."
    },
    {
      title: "5. How to Report Copyright Concerns",
      content: "If you believe that MIYO-STREAM's interface links to or facilitates access to content that infringes your copyright, you may contact us with the following information: (a) identification of the copyrighted work, (b) the specific URL or page on MIYO-STREAM where the content is accessible, (c) your contact information, and (d) a statement of good faith belief that the use is not authorized. Send reports to: contact@cyber-winner.site"
    },
    {
      title: "6. Open-Source Repository Concerns",
      content: "For concerns related to the MIYO-STREAM open-source codebase itself (e.g., code attribution, license compliance, or repository content), please open an issue on the official GitHub repository at github.com/cyber-winner/MIYO-STREAM or contact the maintainers directly."
    },
    {
      title: "7. Metadata & API Attribution",
      content: "Movie and TV show metadata, images, and synopses are provided by TMDB (The Movie Database). Anime and manga metadata is provided by AniList. MIYO-STREAM is not endorsed, certified, or affiliated with TMDB, AniList, or any content provider. All trademarks, logos, and images belong to their respective owners."
    },
    {
      title: "8. No Warranty",
      content: "MIYO-STREAM is provided 'as is' without warranty of any kind, express or implied. The developers and contributors are not liable for any claims, damages, or legal disputes arising from the use of this software, including disputes related to third-party content accessed through the interface."
    }
  ];

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen animate-in fade-in duration-700">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase mb-4">
            DMCA & <span className="text-accent animate-rgb-shift">Disclaimer</span>
          </h1>
          <p className="text-text-secondary text-sm font-bold uppercase tracking-widest opacity-60">
            Last Updated: August 2026
          </p>
        </div>

        {/* Key callout */}
        <div className="mb-10 p-6 rounded-[2rem] bg-amber-500/5 border border-amber-500/15">
          <p className="text-amber-400 text-sm font-semibold mb-2">⚠ Important</p>
          <p className="text-text-secondary text-sm leading-relaxed">
            MIYO-STREAM does not host, store, or distribute any copyrighted media files.
            All video playback is resolved client-side from third-party sources.
            DMCA requests for hosted content must be directed to the actual hosting providers.
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

        {/* Contact for DMCA */}
        <div className="mt-16 p-8 bg-accent/5 border border-accent/10 rounded-[2rem] text-center">
          <p className="text-sm font-bold text-text-secondary mb-3">
            For copyright inquiries or DMCA-related communication:
          </p>
          <a
            href="mailto:contact@cyber-winner.site"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors"
          >
            ✉ contact@cyber-winner.site
          </a>
        </div>
      </div>
    </div>
  );
}
