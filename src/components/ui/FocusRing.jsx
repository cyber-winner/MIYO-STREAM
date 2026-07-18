import React from 'react';
import { cn } from '../../lib/cn';
export function FocusRing({ children, className, as: Component = 'div', ...props }) {
  return (
    <Component
      className={cn('tv-focus-ring', className)}
      tabIndex={0}
      {...props}
    >
      {children}
    </Component>
  );
}