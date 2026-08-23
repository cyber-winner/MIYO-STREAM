import React, { useState } from 'react';
import useSWR from 'swr';
import { cn } from '../lib/cn';
import { useSEO } from '../hooks/useSEO';
import { FAQ } from '../components/ui/FAQ';

const REPO = 'TetoCreations/TETO-STREAM';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
const INSTALL_CMD = 'curl -fsSL https://miyo-stream.tetocreations.bond/install.sh | bash';

const fetcher = (url) => fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then((r) => {
  if (!r.ok) throw new Error('No release found');
  return r.json();
});

function formatSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function matchAsset(assets, patterns) {
  for (const pattern of patterns) {
    const found = assets?.find((a) => pattern.test(a.name));
    if (found) return found;
  }
  return null;
}

export function Download() {
  useSEO({ title: 'Download', description: 'Download the TETO-STREAM app for Windows, Android, and Linux. Fully local, no servers needed.' });
  const { data: release, error, isLoading } = useSWR(RELEASES_API, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });
  const [copied, setCopied] = useState(false);

  const assets = release?.assets || [];
  const windowsExe = matchAsset(assets, [/\.exe$/i]);
  const windowsMsi = matchAsset(assets, [/\.msi$/i]);
  const androidApk = matchAsset(assets, [/\.apk$/i]);
  const linuxAppImage = matchAsset(assets, [/\.appimage$/i]);
  const linuxDeb = matchAsset(assets, [/\.deb$/i]);
  const linuxRpm = matchAsset(assets, [/\.rpm$/i]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — select fallback not needed
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-10 py-10 md:py-16">
      <header className="mb-12 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-text-primary tracking-tight text-balance">
          Download <span className="text-accent animate-rgb-shift">TETO</span>
        </h1>
        <p className="text-text-secondary mt-3 leading-relaxed max-w-2xl mx-auto text-pretty">
          Get the fully local app for your device. No servers, no dependencies — everything runs on
          your machine. Same UI, same features as the website.
        </p>
        {release && (
          <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border">
            <span className="w-2 h-2 rounded-full rgb-pattern-bg" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Latest version: <span className="text-accent animate-rgb-shift">{release.tag_name}</span>
            </span>
          </div>
        )}
      </header>

      {isLoading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary mt-4 text-sm">Fetching latest release...</p>
        </div>
      )}

      {error && (
        <section className="rounded-2xl border border-border bg-surface/60 p-8 text-center">
          <h2 className="text-lg font-bold text-text-primary mb-2">No release published yet</h2>
          <p className="text-sm text-text-secondary leading-relaxed max-w-xl mx-auto">
            The first release is being prepared. Check back soon, or visit GitHub for updates.
          </p>
          <a
            href={`https://github.com/${REPO}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 text-sm text-accent underline underline-offset-2 hover:opacity-80"
          >
            View releases on GitHub
          </a>
        </section>
      )}

      {release && (
        <>
          <div className="grid md:grid-cols-3 gap-5">
            {/* Windows */}
            <PlatformCard
              title="Windows"
              subtitle="Windows 10 / 11"
              icon={<WindowsIcon className="w-8 h-8" />}
            >
              {windowsExe ? (
                <DownloadButton
                  href={windowsExe.browser_download_url}
                  label="Download .exe"
                  size={formatSize(windowsExe.size)}
                  primary
                />
              ) : (
                <UnavailableNote />
              )}
              {windowsMsi && (
                <DownloadButton
                  href={windowsMsi.browser_download_url}
                  label="Download .msi"
                  size={formatSize(windowsMsi.size)}
                />
              )}
            </PlatformCard>

            {/* Android */}
            <PlatformCard
              title="Android"
              subtitle="Android 6.0+"
              icon={<AndroidIcon className="w-8 h-8" />}
            >
              {androidApk ? (
                <DownloadButton
                  href={androidApk.browser_download_url}
                  label="Download .apk"
                  size={formatSize(androidApk.size)}
                  primary
                />
              ) : (
                <UnavailableNote />
              )}
              <p className="text-xs text-text-muted leading-relaxed mt-1">
                Enable &quot;Install unknown apps&quot; in your Android settings to install the APK.
              </p>
            </PlatformCard>

            {/* Linux */}
            <PlatformCard
              title="Linux"
              subtitle="All distributions"
              icon={<LinuxIcon className="w-8 h-8" />}
            >
              {linuxAppImage ? (
                <DownloadButton
                  href={linuxAppImage.browser_download_url}
                  label="AppImage (universal)"
                  size={formatSize(linuxAppImage.size)}
                  primary
                />
              ) : (
                <UnavailableNote />
              )}
              {linuxDeb && (
                <DownloadButton
                  href={linuxDeb.browser_download_url}
                  label=".deb (Ubuntu / Debian)"
                  size={formatSize(linuxDeb.size)}
                />
              )}
              {linuxRpm && (
                <DownloadButton
                  href={linuxRpm.browser_download_url}
                  label=".rpm (Fedora / RHEL)"
                  size={formatSize(linuxRpm.size)}
                />
              )}
            </PlatformCard>
          </div>

          {/* Linux one-liner */}
          <section className="mt-10 rounded-2xl border border-border bg-surface/60 p-6">
            <div className="flex items-center gap-3 mb-3">
              <TerminalIcon className="w-5 h-5 text-accent animate-rgb-shift" />
              <h2 className="text-lg font-bold text-text-primary">
                Linux <span className="text-accent animate-rgb-shift">one-line install</span>
              </h2>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              Works on <span className="text-text-primary font-semibold">any distro</span> — it
              auto-detects your package manager and installs the right build (.deb, .rpm, or
              AppImage):
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 font-mono text-xs sm:text-sm text-accent bg-background border border-border rounded-xl px-4 py-3 overflow-x-auto whitespace-nowrap">
                {INSTALL_CMD}
              </code>
              <button
                onClick={handleCopy}
                className={cn(
                  'flex-shrink-0 px-5 py-3 rounded-xl text-sm font-bold transition-colors',
                  copied
                    ? 'bg-accent/20 text-accent border border-accent/40 animate-rgb-shift'
                    : 'cyber-gradient text-white hover:opacity-90'
                )}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </section>

          {/* Notes */}
          <section className="mt-8 rounded-2xl border border-border bg-surface/60 p-6">
            <h2 className="text-lg font-bold text-text-primary mb-4">
              Good to <span className="text-accent animate-rgb-shift">know</span>
            </h2>
            <ul className="space-y-3">
              <NoteItem>
                The apps are <span className="text-text-primary font-semibold">fully local</span> —
                they talk directly to TMDB, AniList, and anime providers with no middle server.
              </NoteItem>
              <NoteItem>
                For movie &amp; TV data, add your free TMDB API key in the app&apos;s{' '}
                <span className="text-accent font-semibold">Settings</span> page (a step-by-step
                guide is built in). Anime works with no key at all.
              </NoteItem>
              <NoteItem>
                All downloads are served from{' '}
                <a
                  href={RELEASES_PAGE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2 hover:opacity-80"
                >
                  GitHub Releases
                </a>{' '}
                — you can verify checksums and past versions there.
              </NoteItem>
            </ul>
          </section>
        </>
      )}

      {/* FAQ Section */}
      <section className="mt-12 pt-10 border-t border-border">
        <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
          <span className="text-accent">?</span> Frequently Asked Questions
        </h2>
        <FAQ items={[
          {
            question: 'Is TETO-STREAM free?',
            answer: 'Yes. TETO-STREAM is completely free and open source. No subscriptions, no hidden fees.',
          },
          {
            question: 'Do I need to create an account?',
            answer: 'No. TETO-STREAM works without any registration or login. Your preferences are stored locally on your device.',
          },
          {
            question: 'Is my data safe?',
            answer: 'We do not collect, store, or transmit any personal data. All viewing history and settings stay on your device. Check our Privacy Policy for details.',
          },
          {
            question: 'Which platforms are supported?',
            answer: 'TETO-STREAM is available as a web app (any browser), a Windows desktop app (.exe / .msi), an Android app (.apk), and Linux packages (.AppImage / .deb / .rpm).',
          },
          {
            question: 'How do I update the app?',
            answer: 'Visit this page or the GitHub Releases page to download the latest version. Auto-update support is coming in a future release.',
          },
          {
            question: 'Can I self-host TETO-STREAM?',
            answer: 'Absolutely. Clone the GitHub repository, run npm install, and start the dev server. See the README for full instructions.',
          },
        ]} />
      </section>
    </div>
  );
}

function PlatformCard({ title, subtitle, icon, children }) {
  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="text-accent animate-rgb-shift">{icon}</div>
        <div>
          <h2 className="text-lg font-bold text-text-primary leading-tight">{title}</h2>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 mt-auto">{children}</div>
    </section>
  );
}

function DownloadButton({ href, label, size, primary = false }) {
  return (
    <a
      href={href}
      className={cn(
        'flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors',
        primary
          ? 'cyber-gradient text-white hover:opacity-90'
          : 'bg-background border border-border text-text-primary hover:border-accent/50'
      )}
    >
      <span>{label}</span>
      {size && (
        <span className={cn('text-xs font-semibold', primary ? 'text-white/80' : 'text-text-muted')}>
          {size}
        </span>
      )}
    </a>
  );
}

function UnavailableNote() {
  return (
    <p className="text-xs text-text-muted px-1 py-2">
      Not available in the latest release yet.
    </p>
  );
}

function NoteItem({ children }) {
  return (
    <li className="flex gap-3 text-sm text-text-secondary leading-relaxed">
      <span className="w-1.5 h-1.5 rounded-full rgb-pattern-bg flex-shrink-0 mt-2" />
      <span>{children}</span>
    </li>
  );
}

function WindowsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 5.548l7.364-1.002v7.111H3V5.548zm0 12.904l7.364 1.002v-7.02H3v6.018zm8.174 1.112L21 21V12.434h-9.826v7.13zm0-15.128v7.221H21V3l-9.826 1.436z" />
    </svg>
  );
}

function AndroidIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.523 15.34a.996.996 0 1 1 0-1.992.996.996 0 0 1 0 1.992m-11.046 0a.996.996 0 1 1 0-1.992.996.996 0 0 1 0 1.992m11.4-5.996l1.994-3.452a.415.415 0 0 0-.152-.566.416.416 0 0 0-.566.152l-2.018 3.494A12.1 12.1 0 0 0 12 7.848c-1.837 0-3.575.416-5.135 1.124L4.847 5.478a.416.416 0 0 0-.566-.152.415.415 0 0 0-.152.566l1.994 3.452C2.61 11.264.376 14.652 0 18.62h24c-.376-3.968-2.61-7.356-6.123-9.276" />
    </svg>
  );
}

function LinuxIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2c-2.5 0-4 2-4 4.5 0 1.5-.3 2.6-1 3.8-.9 1.5-2 3.2-2 5.2 0 1.2.4 2.3 1.1 3.1.5.6 1.3.4 1.9.4.8 0 1.5.5 2.3.7.5.2 1.1.3 1.7.3s1.2-.1 1.7-.3c.8-.2 1.5-.7 2.3-.7.6 0 1.4.2 1.9-.4.7-.8 1.1-1.9 1.1-3.1 0-2-1.1-3.7-2-5.2-.7-1.2-1-2.3-1-3.8C16 4 14.5 2 12 2z" />
      <circle cx="10" cy="8" r="0.5" fill="currentColor" />
      <circle cx="14" cy="8" r="0.5" fill="currentColor" />
      <path d="M10.5 10.5c.5.5 1 .7 1.5.7s1-.2 1.5-.7" />
    </svg>
  );
}

function TerminalIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
