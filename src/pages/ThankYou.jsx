import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';

export function ThankYou() {
  useSEO({ title: 'Thank You', description: 'Thank you for reaching out to MIYO-STREAM. We will get back to you shortly.' });

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen flex items-center justify-center animate-in fade-in duration-700">
      <div className="max-w-lg text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mb-8">
          <svg className="w-10 h-10 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase mb-4">
          Thank <span className="text-accent animate-rgb-shift">You</span>
        </h1>
        <p className="text-text-secondary leading-relaxed mb-2">
          Your message has been received. We typically respond within <span className="text-accent font-semibold">24 hours</span>.
        </p>
        <p className="text-text-muted text-sm mb-8">
          For urgent matters, email us directly at{' '}
          <a href="mailto:contact@cyber-winner.site" className="text-accent underline hover:opacity-80">contact@cyber-winner.site</a>
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="px-6 py-3 rounded-xl cyber-gradient text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all">
            Back to Home
          </Link>
          <Link to="/about" className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-text-secondary text-sm font-semibold hover:text-text-primary hover:border-accent/20 transition-all">
            Learn About Us
          </Link>
        </div>
      </div>
    </div>
  );
}
