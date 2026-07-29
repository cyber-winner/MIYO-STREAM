import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initLogger } from './lib/logger';

try {
  const devMode = localStorage.getItem('miyo_dev_mode');
  if (devMode === 'true' || devMode === '1') {
    initLogger();
  }
} catch (e) {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);