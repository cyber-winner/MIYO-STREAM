import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '../../lib/cn';
import { TOAST_DURATION_MS } from '../../lib/constants';
const ToastContext = createContext(null);
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

const TOAST_STYLES = {
  success: {
    border: 'border-green-500',
    icon: '✓',
    iconColor: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  error: {
    border: 'border-red-500',
    icon: '✕',
    iconColor: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  warning: {
    border: 'border-amber-500',
    icon: '⚠',
    iconColor: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  info: {
    border: 'border-accent',
    icon: 'ℹ',
    iconColor: 'text-accent',
    bg: 'bg-accent/10',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((toastData, type = 'info') => {
    const id = Date.now() + Math.random();
    const finalToast = typeof toastData === 'string' 
      ? { id, message: toastData, type, exiting: false }
      : { id, type, ...toastData, exiting: false };
    setToasts((prev) => [...prev, finalToast]);
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, TOAST_DURATION_MS);
    return id;
  }, []);
  const removeToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);
  useEffect(() => {
    const handleGlobalToast = (e) => {
      addToast(e.detail.message, e.detail.type);
    };
    window.addEventListener('miyo-toast', handleGlobalToast);
    return () => window.removeEventListener('miyo-toast', handleGlobalToast);
  }, [addToast]);
  return (
    <ToastContext.Provider value={{ addToast, showToast: addToast, removeToast }}>
      {children}
      {ReactDOM.createPortal(
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-[calc(100vw-3rem)]">
          {toasts.map((toast) => {
            const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
            return (
              <div
                key={toast.id}
                onClick={() => removeToast(toast.id)}
                className={cn(
                  'glass border px-5 py-4 rounded-xl shadow-2xl pointer-events-auto max-w-sm cursor-pointer transition-all',
                  style.border,
                  style.bg,
                  toast.exiting ? 'animate-fade-out' : 'animate-slide-in'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn('text-lg font-bold flex-shrink-0 mt-0.5', style.iconColor)}>
                    {style.icon}
                  </span>
                  <div className="min-w-0">
                    <span className="font-semibold text-text-primary text-sm">TETO-STREAM</span>
                    <p className="text-sm text-text-secondary mt-0.5 break-words">{toast.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
