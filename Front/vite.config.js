import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const onVercel = Boolean(process.env.VERCEL);

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: onVercel ? 'dist' : '../Back/public/app',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        timeout: 600000,
        proxyTimeout: 600000
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});

