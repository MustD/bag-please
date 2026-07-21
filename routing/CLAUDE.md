# CLAUDE.md — Routing (`routing/`)

Guidance for the Caddy edge that serves the built SPA and proxies the API.

## Caddy routing

The frontend is a multi-stage image (`bp_front/Dockerfile`): stage 1 builds the Vite bundle, stage 2 (`caddy:2-alpine`)
serves it with the `routing/Caddyfile`. All traffic enters on port 2080:

- `/api/subscriptions` → backend WebSocket (matched **before** `/api/*`)
- `/api/*` → backend HTTP
- everything else → the built SPA from `/srv`, with `try_files {path} /index.html` (SPA deep-link fallback)

Caddy reaches the backend over the compose network as `bp_back:4000`. For local dev there is no Caddy — the Vite dev
server's `server.proxy` forwards `/api` to `localhost:4000` instead.
