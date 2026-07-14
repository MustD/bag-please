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
```

### Docker Compose

```bash
# Build & start everything (Caddy-served frontend + mongo + backend) on :2080
docker compose up --build

# Start only mongo + backend so the local Vite dev server can proxy to :4000
docker compose up mongo bp_back
```

## Architecture

### Backend layers

```
GQL layer (gql/)          – graphql-kotlin Query/Mutation/Subscription objects
Service layer (service/)  – business logic + Kotlin SharedFlow subscriptions
Storage layer (storage/)  – in-memory ConcurrentMap with lazy sync on first access
Mongo layer (mongo/)      – MongoDB coroutine driver repositories
```

Data flows from the GQL layer down through the service, through the in-memory storage, and is persisted to MongoDB. On
startup the storage is populated from MongoDB on first access (`synced` flag). Mutations emit on a `MutableSharedFlow`
which the GraphQL subscriptions expose as a `Flow`.

Each domain entity (Item, Category) has a parallel set of files in each layer:

- `storage/` — plain domain model (`Item`, `Category`)
- `mongo/model/` — MongoDB BSON model + mapper
- `gql/model/` — GraphQL model + mapper
- `service/` — orchestrates storage + emits subscription events
- `gql/` — Query/Mutation/Subscription objects registered in `GqlDefinition`

### Backend configuration

`application.yaml` reads env vars with fallback defaults:

| Env var              | Default      | Purpose            |
|----------------------|--------------|--------------------|
| `KTOR_MONGO_HOST`    | `localhost`  | MongoDB host       |
| `KTOR_MONGO_PORT`    | `27017`      | MongoDB port       |
| `KTOR_MONGO_DB_NAME` | `bag_please` | Database name      |
| `KTOR_MONGO_USER`    | `user`       | MongoDB user       |
| `KTOR_MONGO_PASS`    | `pass`       | MongoDB password   |
| `KTOR_JWT_SECRET`    | `secret`     | JWT signing secret |
| `KTOR_ADMIN_LOGIN`   | `admin`      | Admin login        |
| `KTOR_ADMIN_PASS`    | `admin`      | Admin password     |

### Security

The backend has a single admin user. `POST /api/login` returns a JWT (7-day expiry). All GraphQL mutations/queries
require this token as `Authorization: Bearer <token>`. GraphQL subscriptions do **not** require auth (via WebSocket).
The `CustomGraphQLContextFactory` in `GQL.kt` has commented-out code for exposing the principal through the GraphQL
context if needed.

### Frontend

Vite + React 19 single-page app (App entry `src/main.tsx` → `src/App.tsx`). Apollo Client handles all GraphQL
communication via a single split link (`src/lib/apollo/ApolloProvider.tsx`): HTTP for queries/mutations
(`/api/graphql`), WebSocket (`graphql-ws`) for subscriptions (`/api/subscriptions`), with the access token supplied in
`connectionParams`. Never instantiate a second Apollo or `graphql-ws` client.

Auth is **in-memory only** (`src/lib/auth/AuthContext.tsx`) — the access token lives in React state/context, never in
`localStorage`. On load the provider attempts a silent `POST /api/auth/refresh` (httpOnly cookie) to bootstrap a
session. Apollo's error link retries one silent refresh on HTTP 401, then clears auth and redirects to `/auth?expired=1`.

Routing is client-side via React Router (declarative `<BrowserRouter>`/`<Routes>`). `src/routes/RouteGuard.tsx` is the
auth guard (redirects unauthenticated users to `/auth` with `replace`); `src/routes/AdminGuard.tsx` guards `/admin/*`.

A single **dark** MUI theme (`src/theme.ts`, `createTheme({ palette: { mode: 'dark' }})`) is applied app-wide via
`ThemeProvider` + `CssBaseline`. Style with the theme + `sx` only. The `src/__generated__/` directory is auto-generated
by `graphql-codegen` — do not edit manually.

UI components are built with **Material UI (MUI)**. When working on frontend UI, use the `mcp__mui-mcp__fetchDocs` /
`mcp__mui-mcp__useMuiDocs` MCP tools to look up MUI component APIs and usage before writing or editing components.

### Caddy routing

The frontend is a multi-stage image (`bp_front/Dockerfile`): stage 1 builds the Vite bundle, stage 2 (`caddy:2-alpine`)
serves it with the `routing/Caddyfile`. All traffic enters on port 2080:

- `/api/subscriptions` → backend WebSocket (matched **before** `/api/*`)
- `/api/*` → backend HTTP
- everything else → the built SPA from `/srv`, with `try_files {path} /index.html` (SPA deep-link fallback)

Caddy reaches the backend over the compose network as `bp_back:4000`. For local dev there is no Caddy — the Vite dev
server's `server.proxy` forwards `/api` to `localhost:4000` instead.

### GraphQL schema management

`codegen.ts` points at `http://localhost:2080/api/graphql` and reads the admin Bearer token from `CODEGEN_TOKEN`
(access tokens are short-lived, so mint a fresh one at run time — see the `npm run generate` command above). The
generated output goes to `bp_front/src/__generated__/`.

`ApiPlayground/` contains `.http` files for manually exercising the API via IntelliJ HTTP Client.
