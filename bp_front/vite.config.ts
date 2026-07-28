import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {fileURLToPath, URL} from 'node:url'

// Inner-loop dev server: native Vite + HMR on :5173, proxying /api to the
// local backend on :4000. No Caddy needed for day-to-day iteration.
// The production artifact (Caddy serving the built dist/) is exercised by E2E.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // WebSocket subscriptions — must be matched before the generic /api rule.
      '/api/subscriptions': {
        target: 'ws://localhost:4000',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
