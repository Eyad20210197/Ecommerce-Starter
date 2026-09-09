import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiOrigin = env.API_ORIGIN || env.VITE_API_ORIGIN || 'http://127.0.0.1:4000';

  const proxyConfig = {
    '/api': {
      target: apiOrigin,
      changeOrigin: true,
      ws: true,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('origin', 'http://127.0.0.1:3000');
        });
      }
    }
  };

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: proxyConfig
    },
    preview: {
      port: 3000,
      host: true,
      proxy: proxyConfig
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true
    }
  };
});
