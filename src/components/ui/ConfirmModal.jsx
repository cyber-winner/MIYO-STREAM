import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '../../lib/cn';

/**
 * Reusable confirmation modal.
 * @param {boolean} open - Whether the modal is visible
 * @param {() => void} onClose - Called when backdrop/cancel is clicked
 * @param {() => void} onConfirm - Called when confirm button is clicked
 * @param {string} title - Modal title
 * @param {string|React.ReactNode} message - Modal body content
 * @param {string} confirmLabel - Confirm button text (default: "Confirm")
 * @param {string} cancelLabel - Cancel button text (default: "Cancel")
 * @param {boolean} danger - If true, confirm button is red
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
      const onKey = (e) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Modal */}
      <div
        className="relative bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary mb-2">{title}</h2>
        {message && (
          <p className="text-sm text-text-secondary leading-relaxed mb-6">{message}</p>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-transparent border border-border text-text-secondary hover:bg-white/5 hover:text-text-primary transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={() => { onConfirm(); onClose(); }}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-95',
              danger
                ? 'bg-red-600/10 border border-red-600/30 text-red-400 hover:bg-red-600/20'
                : 'cyber-gradient text-white hover:opacity-90'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
