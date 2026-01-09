import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@microsoft/signalr']
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
