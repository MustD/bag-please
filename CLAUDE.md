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
- `bp_front/` — Vite + React 19 SPA (Apollo Client, Material UI); built static bundle served by Caddy.
  Since Story 7.14 it is an **installable PWA**: the build emits a web app manifest and a service worker
  (`vite-plugin-pwa`), so the served origin registers a worker that intercepts every navigation
- `routing/` — `Caddyfile` for the frontend image: serves the built SPA and proxies `/api` to the backend (entry point port 2080)
- PostgreSQL 18 (service `postgres`) is the only data store; its data lives in the named Docker volume `pg_data`
  (`docker-compose.yaml`). A stack that previously ran on MongoDB (the old `db_data` volume or `./db/data` bind mount)
  comes up on an EMPTY PostgreSQL database; the Mongo export is brought in by the importer below (Story 11.8).

All services are orchestrated via Docker Compose. For day-to-day frontend work, run the Vite dev server locally
(`npm run dev` on :5173, proxying `/api` to the backend on :4000); the full production stack (built SPA served by
Caddy + backend + postgres) runs on :2080 via `docker compose up --build`.

An external edge proxy on the host terminates TLS and serves the app over HTTPS at **`https://bag-please.localhost`**,
forwarding to the single Caddy entrypoint on `127.0.0.1:2080`. HTTPS is required for auth to persist (the refresh cookie
is `Secure` + `SameSite=Strict`). This repo does not manage the cert or domain — see `routing/edge-proxy.md`
for the edge contract and the `bag-please.localhost` local setup.

Deep-dive guidance lives in per-directory `CLAUDE.md` files that load when you work in that tree: `bp_back/CLAUDE.md`
(backend layers + security), `bp_front/CLAUDE.md` (frontend architecture + GraphQL codegen), `routing/CLAUDE.md`
(Caddy routing).

## Commands

`mise install` provisions the toolchain pinned in `mise.toml`'s `[tools]` (`java = "temurin-25"`, `node = "26"`,
`gradle = "9"`); `mise tasks` lists the task aliases.

### Backend (`bp_back/`)

Use `gradle` (provisioned by mise; the repo ships no Gradle wrapper) from the repo root. It's a multi-project build,
so qualify backend tasks with `:bp_back:`:

```bash
# Build
gradle :bp_back:build

# Run (dev mode)
gradle :bp_back:run -t

# Run all tests
gradle :bp_back:test

# Run a single test class
gradle :bp_back:test --tests "com.bagplease.ApplicationTest"
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

# Serve the built dist/ locally (vite preview)
npm run preview

# Lint
npm run lint

# Regenerate the PWA launcher icons after changing public/favicon.svg
npm run icons       # rsvg-convert + magick -> public/icons/*.png (deterministic; a clean re-run is a no-op)

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
# Build & start everything (Caddy-served frontend + postgres + backend) on :2080
docker compose up --build

# Start only postgres + backend so the local Vite dev server can proxy to :4000
docker compose up postgres bp_back
```

Image build + push is `mise run images:build-push` (`mise/images-build-push.sh`): it tags both images with
`gradle.properties`' `version` and reads the image names from `project.env`, which is gitignored — copy
`project.example.env` to `project.env` first.

### Importing the Mongo export (Story 11.8)

`com.bagplease.tools.MongoImport` (Gradle source set `bp_back/src/import/`, never packaged in the `bp_back` image) loads a
`mongoexport --jsonArray` export (one `<collection>.json` per collection, directory `migration-export/`, gitignored)
into an EMPTY PostgreSQL database: it runs Flyway, refuses a non-empty target or any legacy single-`store` item, loads
everything in one transaction (any failure leaves zero rows) and prints export / loaded / dropped counts per record type.
Locally: `docker compose up -d --wait postgres`, then `mise run db:import:local [-- <export-dir>]`. The DB credentials
are `IMPORT_DB_*` variables set only on the `java` command in `mise/db_import.sh`. Never commit an export.

### Dump before a migration release, restore to roll back (AR-E9-5a)

> **Superseded by Story 11.10.** This section describes the MongoDB-era procedure (the `mongo` service and
> `Migration.kt` no longer exist); Story 11.10 replaces it with a PostgreSQL release procedure. Kept until then.

Startup migrations (`bp_back/.../plugins/Migration.kt`) rewrite documents in place, each gated on its own
`app_migrations` record, and the app cannot reverse them (`epic9-multi-store` unsets every item's legacy `store`
field, which the previous image still reads). Before deploying a release that adds a migration, dump with the stack
still on the OLD image. The credentials below (`user` / `pass`) are the dev / E2E ones from `docker-compose.yaml`;
a real deployment uses its own. `*.archive` is gitignored, so a dump in the repo root is never committed.

```bash
docker compose exec -T mongo mongodump \
  --username user --password pass --authenticationDatabase admin \
  --db bag_please --archive > backup-$(date +%Y%m%d-%H%M%S).archive
docker compose up -d --build
docker compose logs bp_back | grep -i "migration"   # each migration logs "completed" or "already complete, skipping"
```

Rollback is restore **then** the previous image — rolling the image back alone leaves migrated data the old code
cannot read. `--wait` blocks until mongo's healthcheck passes, so the restore does not race startup:

```bash
docker compose down && docker compose up -d --wait mongo
docker compose exec -T mongo mongorestore \
  --username user --password pass --authenticationDatabase admin \
  --nsInclude 'bag_please.*' --drop --archive < backup-<timestamp>.archive
git checkout <previous-release-tag>   # tags are bare versions, e.g. 0.17.0
docker compose up -d --build
```
