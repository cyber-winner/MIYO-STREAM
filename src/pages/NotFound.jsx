import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-5 text-center">
      <div className="text-8xl font-extrabold text-text-muted/20">404</div>
      <h1 className="text-2xl font-bold text-text-primary">Page Not Found</h1>
      <p className="text-text-muted max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link to="/">
        <Button variant="primary" size="lg">Go Home</Button>
      </Link>
    </div>
  );
}