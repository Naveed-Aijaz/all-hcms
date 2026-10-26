import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API is proxied, so the browser talks to one origin (no CORS needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000', changeOrigin: true },
    },
  },
});
