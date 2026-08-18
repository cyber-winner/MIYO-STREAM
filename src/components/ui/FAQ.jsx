import React, { useState } from 'react';
import { cn } from '../../lib/cn';

/**
 * Expandable FAQ accordion component.
 * @param {Array<{question: string, answer: string|React.ReactNode}>} items - FAQ items
 */
export function FAQ({ items = [] }) {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className={cn(
              'rounded-2xl border transition-colors duration-200',
              isOpen ? 'border-accent/30 bg-accent/5' : 'border-border bg-surface/60'
            )}
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer group"
              aria-expanded={isOpen}
            >
              <span className={cn(
                'text-sm font-semibold transition-colors',
                isOpen ? 'text-accent' : 'text-text-primary group-hover:text-accent'
              )}>
                {item.question}
              </span>
              <svg
                className={cn(
                  'w-4 h-4 flex-shrink-0 text-text-muted transition-transform duration-300',
                  isOpen && 'rotate-180 text-accent'
                )}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div
              className={cn(
                'overflow-hidden transition-all duration-300 ease-in-out',
                isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="px-5 pb-4 text-sm text-text-secondary leading-relaxed">
                {item.answer}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
