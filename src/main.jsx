import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initLogger } from './lib/logger';
import { installFetchInterceptor, setFingerprintId, getFingerprintId } from './lib/fetchInterceptor';
import { sendFingerprint } from './lib/fingerprint';

try {
  const devMode = localStorage.getItem('miyo_dev_mode');
  if (devMode === 'true' || devMode === '1') {
    initLogger();
  }
} catch (e) {}

// ── Device Fingerprinting ──
// 1. Install fetch interceptor FIRST so all API calls carry the fingerprint ID
installFetchInterceptor();

// 2. Collect & send fingerprint in background after page loads
// If we already have a stored fingerprint ID, use it immediately.
// Then re-collect in background to keep it fresh.
if (typeof window !== 'undefined') {
  const boot = async () => {
    try {
      // Use stored fingerprint immediately for API calls
      const existingId = getFingerprintId();
      
      // Collect fresh fingerprint after a short delay to not block rendering
      setTimeout(async () => {
        try {
          const fpId = await sendFingerprint();
          if (fpId) setFingerprintId(fpId);
        } catch (e) {
          // Silently fail — fingerprinting must never break the app
        }
      }, 2000);
    } catch (e) {}
  };
  
  if (document.readyState === 'complete') {
    boot();
  } else {
    window.addEventListener('load', boot, { once: true });
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);