import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// API paths proxied to FastAPI in development (production uses VITE_API_BASE_URL or a same-origin proxy).
const API_PATHS = ['/auth', '/health', '/graph', '/entities', '/analytics', '/ai', '/public'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_API_TARGET || 'http://localhost:8000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: Object.fromEntries(API_PATHS.map((path) => [path, { target, changeOrigin: true }])),
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            graph: ['cytoscape'],
            charts: ['recharts'],
          },
        },
      },
    },
  };
});
