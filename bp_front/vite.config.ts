import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {VitePWA} from 'vite-plugin-pwa'
import {fileURLToPath, URL} from 'node:url'

// Inner-loop dev server: native Vite + HMR on :5173, proxying /api to the
// local backend on :4000. No Caddy needed for day-to-day iteration.
// The production artifact (Caddy serving the built dist/) is exercised by E2E.
export default defineConfig({
  plugins: [
    react(),
    // Story 7.14 — installability. The three WebAPK preconditions (a linked
    // manifest, PNG icons at 192 and 512, a registered worker with a fetch
    // handler) must hold SIMULTANEOUSLY; missing any one silently downgrades
    // Chrome's offer to a bookmark shortcut, with no error anywhere.
    VitePWA({
      // Silent updates on next launch. No update toast, reload prompt or
      // version banner anywhere — UX-DR-E7-7.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/',
        name: 'Bag Please',
        short_name: 'Bag Please',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // BOTH colours are black on purpose. The app is dark-only
        // (src/theme.ts: mode 'dark', background.default '#000000', no light
        // variant), and background_color is Android's cold-launch splash
        // colour — the recipe's '#ffffff' would flash white before an
        // all-black app (AR-E7-14).
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'},
          {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png'},
          {src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // The API surface is untouchable. The load-bearing case is
        // GET /api/graphiql: it is a NAVIGATION, so without this denylist the
        // worker answers it with the SPA shell — and it is this project's only
        // backend-readiness check. runtimeCaching stays EMPTY: nothing under
        // /api (GraphQL HTTP, auth REST) may ever be served from a cache.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
