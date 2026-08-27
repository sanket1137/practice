import { defineConfig } from 'vitest/config'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'spa-fallback',
      configureServer(server: ViteDevServer) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url || '';
          const accept = req.headers.accept || '';
          if (
            url !== '/' &&
            url !== '/index.html' &&
            accept.includes('text/html') &&
            !url.startsWith('/api') &&
            !url.startsWith('/hubs')
          ) {
            req.url = '/app.html';
          }
          next();
        });
      }
    }
  ],
  optimizeDeps: {
    exclude: ['@microsoft/signalr']
  },
  // Strip console/debugger statements from production builds only; keep dev logs.
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] as ('console' | 'debugger')[] } : {},
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
  build: {
    // Source maps so Sentry can symbolicate production stack traces
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html',
        app: './app.html'
      },
      output: {
        // Group heavyweight vendors into stable chunks; route-level code
        // splitting (React.lazy in src/App.tsx) handles the per-page splits.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material', '@mui/x-date-pickers'],
          charts: ['recharts'],
          maps: ['leaflet', 'react-leaflet', 'react-leaflet-cluster'],
          signalr: ['@microsoft/signalr'],
        },
      },
    }
  },
  server: {
    proxy: {
      // Proxy API requests to backend
      '/api': {
        target: 'http://localhost:5257',
        changeOrigin: true,
        secure: false,
      },
      // Proxy SignalR hub requests to backend
      '/hubs': {
        target: 'http://localhost:5257',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    }
  }
}))
