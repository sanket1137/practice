import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'spa-fallback',
      configureServer(server: any) {
        server.middlewares.use((req: any, _res: any, next: any) => {
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        app: './app.html'
      }
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
})
