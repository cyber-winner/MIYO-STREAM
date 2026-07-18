import React from 'react';
export function Privacy() {
  const sections = [
    {
      title: "1. Information We Do Not Collect",
      content: "MIYO-STREAM is designed to respect your privacy. As an open-source catalog and streaming interface, we do not require you to register, log in, or provide an email address. We do not collect, store, or process personal identifiable information (PII) such as names, addresses, or payment details."
    },
    {
      title: "2. Local Storage & Client-Side Data",
      content: "To enhance your experience, MIYO-STREAM utilizes your browser's local storage to save preferences such as your watch history, progress on videos, UI preferences (e.g., light/dark mode), and saved bookmarks. This data remains strictly on your device and is never transmitted to our backend servers."
    },
    {
      title: "3. Third-Party Services & APIs",
      content: "MIYO-STREAM functions as an interface that pulls data from various third-party services. We fetch movie and TV show metadata from TMDB, and anime/manga metadata from AniList. Anime playback utilizes a StrawVerse-inspired backend proxy engine to securely fetch video segments."
    },
    {
      title: "4. Embedded Video Players",
      content: "For non-anime content, MIYO-STREAM does not host any video content. All video playback is handled via embedded iframes from third-party providers. When you stream an embedded video, the player provider may collect IP addresses, device information, or utilize cookies to deliver the stream."
    },
    {
      title: "5. Analytics and Server Logs",
      content: "Because MIYO-STREAM is deployed via an Express backend to proxy video segments, standard server logs (such as IP addresses, browser types, and timestamped requests) may be temporarily captured by the hosting provider for security and rate-limiting purposes. We do not use this data for marketing."
    },
    {
      title: "6. Contact Us",
      content: "If you have any questions about this Privacy Policy or how we handle data, please open an issue on our official GitHub repository."
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
            Last Updated: June 2026
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
             Your privacy is our priority. MIYO-STREAM is an open-source project.
           </p>
        </div>
      </div>
    </div>
  );
}