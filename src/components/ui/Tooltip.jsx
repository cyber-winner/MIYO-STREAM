import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/cn';

/**
 * Rich tooltip component.
 * @param {string} content - Tooltip text
 * @param {'top'|'bottom'|'left'|'right'} position - Placement
 * @param {React.ReactNode} children - Trigger element
 */
export function Tooltip({ content, position = 'top', children, className }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  if (!content) return children;

  const posStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      ref={ref}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          'absolute z-[100] px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text-primary shadow-xl whitespace-nowrap pointer-events-none transition-all duration-200',
          posStyles[position],
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        )}
      >
        {content}
      </span>
    </span>
  );
}
