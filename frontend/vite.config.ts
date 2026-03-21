import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@microsoft/signalr']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
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
