import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useSEO } from '../hooks/useSEO';
export function NotFound() {
  useSEO({
    title: 'Page Not Found',
    description: 'This page doesn\'t exist on TETO-STREAM. Navigate back home or search for what you\'re looking for.',
  });
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-5 text-center">
      <img
        src="/images/image-404.png"
        alt="Lost in the void"
        className="w-48 h-48 md:w-64 md:h-64 object-contain opacity-80 drop-shadow-2xl"
        loading="lazy"
      />
      <div className="text-7xl md:text-9xl font-black text-accent/20 animate-rgb-shift select-none leading-none">
        404
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-text-primary -mt-2">
        This page got <span className="text-accent animate-rgb-shift">isekai&apos;d</span>
      </h1>
      <p className="text-text-muted max-w-md text-sm md:text-base leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist, has been moved, or was swallowed by a plot hole.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/">
          <Button variant="primary" size="lg">Go Home</Button>
        </Link>
        <Link to="/search">
          <Button variant="secondary" size="lg">Search</Button>
        </Link>
      </div>
    </div>
  );
}