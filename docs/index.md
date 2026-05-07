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
- **Architecture:** Layered backend (GQL → Service → Storage → MongoDB) + Next.js App Router frontend + nginx reverse
  proxy

## Quick Reference

### bp_back (Backend API)

- **Type:** backend (Kotlin/Ktor)
- **Tech Stack:** Kotlin 2.3.21, Ktor 3.4.3, graphql-kotlin 9.2.0, MongoDB 8
- **Root:** `bp_back/`
- **Port:** 4000
- **Entry point:** `bp_back/src/main/kotlin/com/bagplease/Application.kt`

### bp_front (Frontend SPA)

- **Type:** web (Next.js/React)
- **Tech Stack:** TypeScript 6, Next.js 16.2.4, React 19, Apollo Client 4, MUI v9
- **Root:** `bp_front/`
- **Port:** 3000
- **Entry point:** `bp_front/src/app/layout.tsx`

### routing (nginx)

- **Type:** infra
- **Tech Stack:** nginx
- **Root:** `routing/`
- **Port:** 2080 (unified entry point)
- **Entry point:** `routing/nginx.conf`

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
- [bag-please.drawio](../documentation/bag-please.drawio) — Architecture diagram (DrawIO)
- [bp_front/README.md](../bp_front/README.md) — Next.js boilerplate README
- [bp_front/issues.md](../bp_front/issues.md) — In-progress frontend issue notes
- [ApiPlayground/](../ApiPlayground/) — IntelliJ HTTP Client `.http` files for all API operations

## Getting Started

### Run the app locally (dev mode)

```bash
# 1. Start infrastructure
docker compose up mongo router

# 2. Start backend (from bp_back/)
../gradlew run -t

# 3. Start frontend (from bp_front/)
npm install && npm run dev

# 4. Open browser
open http://localhost:2080
# Login: admin / admin
```

### Run everything in Docker

```bash
docker compose up --build
```

### Run backend tests

```bash
cd bp_back && ../gradlew test   # requires Docker running for Testcontainers
```

### Regenerate GraphQL types after schema change

```bash
# 1. Get JWT
curl -X POST http://localhost:2080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# 2. Update token in bp_front/codegen.ts, then:
cd bp_front && npm run generate
```

## For AI Agents

Read these documents in this order when implementing features:

1. `CLAUDE.md` — mandatory rules and critical patterns
2. This `index.md` — project structure overview
3. `architecture-bp_back.md` or `architecture-bp_front.md` — relevant part architecture
4. `api-contracts-bp_back.md` — when touching GQL schema or API
5. `data-models-bp_back.md` — when touching entities or MongoDB
6. `integration-architecture.md` — when touching cross-part communication
