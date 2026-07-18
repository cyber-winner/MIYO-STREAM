import React from 'react';
import { cn } from '../../lib/cn';
const clampClasses = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};
export function TruncatedText({
  children,
  lines = 2,
  as: Component = 'p',
  className,
  ...props
}) {
  return (
    <Component
      className={cn(clampClasses[lines] || 'line-clamp-2', className)}
      {...props}
    >
      {children}
    </Component>
  );
}