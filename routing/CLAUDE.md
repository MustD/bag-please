# CLAUDE.md — Routing (`routing/`)

Guidance for the Caddy edge that serves the built SPA and proxies the API.

## Caddy routing

The frontend is a multi-stage image (`bp_front/Dockerfile`): stage 1 builds the Vite bundle, stage 2 (`caddy:2-alpine`)
serves it with the `routing/Caddyfile`. All traffic enters on port 2080:

- `/api/subscriptions` → backend WebSocket (matched **before** `/api/*`)
- `/api/*` → backend HTTP
- everything else → the built SPA from `/srv`, with `try_files {path} /index.html` (SPA deep-link fallback)

Two `header` directives sit inside that last block (Story 7.14, installability). Both are **pins, not repairs** —
`caddy:2-alpine` was measured at v2.11.4 already doing the right thing, and `:2-alpine` is a moving tag:

- `/manifest.webmanifest` → `Content-Type: application/manifest+json`. A wrong content type kills installability
  with **no error anywhere**, which is why it is asserted on the served response in `bp_front/e2e/pwa.spec.ts`
  rather than trusted from the base image's MIME table.
- `/sw.js` → `Cache-Control: no-cache`. Belt-and-braces: browsers already bypass the HTTP cache for the top-level
  worker script and cap its freshness at 24h regardless.

The SPA that Caddy serves now registers a **service worker** that intercepts every navigation. It falls back to
`/index.html` for client-side routes but denylists `/^\/api/`, so `/api/subscriptions`, `/api/*` and in particular
the `GET /api/graphiql` readiness check still reach the backend. Keep the route order above intact.

Caddy reaches the backend over the compose network as `bp_back:4000`. For local dev there is no Caddy — the Vite dev
server's `server.proxy` forwards `/api` to `localhost:4000` instead.
