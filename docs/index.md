---
generated: "2026-05-07"
project: "bag-please"
scan_level: "deep"
parts: 3
---

# Project Documentation Index — Bag Please

## Project Overview

- **Type:** Multi-part repository (3 parts)
- **Primary Languages:** Kotlin (backend), TypeScript (frontend)
- **Architecture:** Layered backend (GQL → Service → Storage → MongoDB) + Vite/React SPA served by Caddy (single
  entrypoint on `:2080`, HTTPS via an external edge proxy)

## Quick Reference

### bp_back (Backend API)

- **Type:** backend (Kotlin/Ktor)
- **Tech Stack:** Kotlin 2.3.21, Ktor 3.4.3, graphql-kotlin 9.2.0, MongoDB 8
- **Root:** `bp_back/`
- **Port:** 4000
- **Entry point:** `bp_back/src/main/kotlin/com/bagplease/Application.kt`

### bp_front (Frontend SPA)

- **Type:** web (Vite + React SPA)
- **Tech Stack:** TypeScript, Vite, React 19, Apollo Client, MUI (dark theme)
- **Root:** `bp_front/`
- **Port:** 5173 (Vite dev server); served via Caddy on `:2080` in the built stack
- **Entry point:** `bp_front/src/main.tsx` → `bp_front/src/App.tsx`

### routing (Caddy)

- **Type:** infra
- **Tech Stack:** Caddy (baked into the `bp_front` image; no standalone service)
- **Root:** `routing/`
- **Port:** 2080 (unified entry point)
- **Entry point:** `routing/Caddyfile`

## Generated Documentation

### Project-Wide

- [Project Overview](./project-overview.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Integration Architecture](./integration-architecture.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
- [Project Parts Metadata](./project-parts.json)

### Backend (bp_back)

- [Architecture — bp_back](./architecture-bp_back.md)
- [API Contracts — bp_back](./api-contracts-bp_back.md)
- [Data Models — bp_back](./data-models-bp_back.md)

### Frontend (bp_front)

- [Architecture — bp_front](./architecture-bp_front.md)
- [Component Inventory — bp_front](./component-inventory-bp_front.md)

### Routing

- [Architecture — routing](./architecture-routing.md)

## Existing Documentation

- [CLAUDE.md](../CLAUDE.md) — AI agent coding rules, tech stack details, critical patterns
- [routing/edge-proxy.md](../routing/edge-proxy.md) — external edge proxy / TLS / public domain contract
- [ApiPlayground/](../ApiPlayground/) — IntelliJ HTTP Client `.http` files for API operations

## Getting Started

### Run the app locally (dev mode)

```bash
# 1. Start infrastructure (mongo + backend in Docker)
docker compose up mongo bp_back

# 2. Start the frontend dev server (from bp_front/)
npm install && npm run dev        # Vite on :5173, proxies /api → :4000

# 3. Open browser
open http://localhost:5173
# Login: admin / admin
```

For backend hot reload, run `docker compose up mongo` + `cd bp_back && ../gradlew run -t` instead of the backend
container. See [development-guide.md](./development-guide.md).

### Run everything in Docker (built stack)

```bash
docker compose up --build         # served by Caddy on http://localhost:2080
```

HTTPS on `https://bag-please.localhost` is provided by an external edge proxy — see
[routing/edge-proxy.md](../routing/edge-proxy.md).

### Run backend tests

```bash
cd bp_back && ../gradlew test   # requires Docker running for Testcontainers
```

### Regenerate GraphQL types after schema change

```bash
# Mint a fresh admin access token and pass it via CODEGEN_TOKEN (do not edit codegen.ts):
cd bp_front
CODEGEN_TOKEN="$(curl -s -X POST http://localhost:2080/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')" npm run generate
```

## For AI Agents

Read these documents in this order when implementing features:

1. `CLAUDE.md` — mandatory rules and critical patterns
2. This `index.md` — project structure overview
3. `architecture-bp_back.md` or `architecture-bp_front.md` — relevant part architecture
4. `api-contracts-bp_back.md` — when touching GQL schema or API
5. `data-models-bp_back.md` — when touching entities or MongoDB
6. `integration-architecture.md` — when touching cross-part communication
