import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { initLogger } from './lib/logger';

try {
  const devMode = localStorage.getItem('miyo_dev_mode');
  if (devMode === 'true' || devMode === '1') {
    initLogger();
  }
} catch (e) {}

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (globalError) {
  document.getElementById('root').innerHTML = `
    <div style="padding: 20px; background: #900; color: #fff; font-family: monospace;">
      <h2>Global Initialization Error</h2>
      <pre>${globalError?.toString()}</pre>
      <pre>${globalError?.stack}</pre>
    </div>
  `;
}