# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Temporary files

- Use `.tmp/` at the project root for any temporary data (scratch files, intermediate artifacts, downloads, generated
  outputs not meant to be committed).
- Within `.tmp/`, create a subdirectory named after the current Claude session ID (e.g., `.tmp/<session-id>/`) and write
  all temporary files there.
- Clean up by removing `.tmp/<session-id>/` at the end of the session.
- Do not write temp files anywhere else in the project tree, and do not reuse another session's subdirectory.

## Project Overview

**Bag Please** is a full-stack shopping list / store management app consisting of:

- `bp_back/` — Kotlin/Ktor backend exposing a GraphQL API (port 4000)
- `bp_front/` — Vite + React 19 SPA (Apollo Client, Material UI); built static bundle served by Caddy
- `routing/` — `Caddyfile` for the frontend image: serves the built SPA and proxies `/api` to the backend (entry point port 2080)
- `db/` — MongoDB 8 data directory (mounted as a volume)

All services are orchestrated via Docker Compose. For day-to-day frontend work, run the Vite dev server locally
(`npm run dev` on :5173, proxying `/api` to the backend on :4000); the full production stack (built SPA served by
Caddy + backend + mongo) runs on :2080 via `docker compose up --build`.

An external edge proxy on the host terminates TLS and serves the app over HTTPS at **`https://bag-please.localhost`**,
forwarding to the single Caddy entrypoint on `127.0.0.1:2080`. HTTPS is required for auth to persist (the refresh cookie
is `Secure` + `SameSite=Strict`). This repo does not manage the cert or domain — see `routing/edge-proxy.md`
for the edge contract and the `bag-please.localhost` local setup.

Deep-dive guidance lives in per-directory `CLAUDE.md` files that load when you work in that tree: `bp_back/CLAUDE.md`
(backend layers + security), `bp_front/CLAUDE.md` (frontend architecture + GraphQL codegen), `routing/CLAUDE.md`
(Caddy routing).

## Commands

### Backend (`bp_back/`)

Use the Gradle wrapper (`./gradlew`) from the repo root. It's a multi-project build, so qualify
backend tasks with `:bp_back:`:

```bash
# Build
./gradlew :bp_back:build

# Run (dev mode)
./gradlew :bp_back:run -t

# Run all tests
./gradlew :bp_back:test

# Run a single test class
./gradlew :bp_back:test --tests "com.bagplease.ApplicationTest"
```

These map to mise tasks: `mise run back:build`, `back:run`, `back:test`.

Tests use Kotest with JUnit 5 platform (`useJUnitPlatform()` is set in build.gradle.kts).

### Frontend (`bp_front/`)

```bash
cd bp_front && npm install

# Dev server (Vite, with HMR) — proxies /api to the backend on :4000
npm run dev          # starts Vite on :5173

# Build (type-check + production bundle → dist/)
npm run build        # tsc -b && vite build

# Lint
npm run lint

# Regenerate GraphQL types from the live schema (requires backend on :2080 + a fresh admin token)
CODEGEN_TOKEN="$(curl -s -X POST http://localhost:2080/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')" npm run generate

# E2E (Playwright) — runs against the production image on :2080, desktop + mobile viewports
npm run test:e2e

# E2E through the TLS edge domain (real HTTPS + Secure-cookie path; edge must be running)
E2E_BASE_URL=https://bag-please.localhost npm run test:e2e
```

### Docker Compose

```bash
# Build & start everything (Caddy-served frontend + mongo + backend) on :2080
docker compose up --build

# Start only mongo + backend so the local Vite dev server can proxy to :4000
docker compose up mongo bp_back
```
