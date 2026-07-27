import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import 'dotenv/config';

// VITE_NATIVE=1 builds the frontend for the native apps (Tauri desktop /
// Capacitor Android): relative base path so assets load from a custom
// protocol, and the anikoto provider extension bundled for the browser.
// Without the flag, the config is identical to the original website build.
const isNativeBuild = process.env.VITE_NATIVE === '1';

export default defineConfig({
  plugins: [react()],
  base: isNativeBuild ? './' : '/',
  define: {
    // The provider extensions use `global.axios` etc. (Node-style globals)
    global: 'globalThis',
  },
  server: {
    host: true, // Bind to all interfaces (including IPv6 [::1]) for Cloudflare Tunnel
    port: 24729,
    allowedHosts: ["miyo-stream.cyber-winner.site"],
    proxy: {
      '/api': {
        // Follow the same port resolution as server.js (SERVER_PORT || PORT || 3000)
        target: `http://localhost:${process.env.SERVER_PORT || process.env.PORT || 3000}`,
        changeOrigin: true,
      }
    },
    watch: {
      // Native build outputs — don't trigger dev-server reloads
      ignored: ['**/dist-native/**', '**/android/**', '**/src-tauri/**'],
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    outDir: isNativeBuild ? 'dist-native' : 'dist',
    commonjsOptions: {
      // Allow importing the .cjs provider extensions from ESM app code
      transformMixedEsModules: true,
      include: [/node_modules/, /extensions/],
    },
  },
});
