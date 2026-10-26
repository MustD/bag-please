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

Image build + push is `mise run deploy:build` / `deploy:push` (`deploy/scripts/`): both images are tagged with
`gradle.properties`' `version` only (never `latest`); `deploy:push` refuses a dirty tree or a tag already on Docker Hub.
The image names come from the gitignored `.secure.build.env` (copy `.secure.build.env.example`); run `docker login` once.

### Importing the Mongo export (Story 11.8)

`com.bagplease.tools.MongoImport` (Gradle source set `bp_back/src/import/`, never packaged in the `bp_back` image) loads a
`mongoexport --jsonArray` export (one `<collection>.json` per collection, directory `migration-export/`, gitignored)
into an EMPTY PostgreSQL database: it runs Flyway, refuses a non-empty target or any legacy single-`store` item, loads
everything in one transaction (any failure leaves zero rows) and prints export / loaded / dropped counts per record type.
Locally: `docker compose up -d --wait postgres`, then `mise run db:import:local [-- <export-dir>]`. The DB credentials
are `IMPORT_DB_*` variables set only on the `java` command in `mise/db_import.sh`. Never commit an export.

### Production infrastructure (Story 11.9)

`deploy/terraform/` declares the DigitalOcean droplet, its firewall, and the `bag_please` database and `bag_please_app`
user on a SHARED PostgreSQL cluster managed outside this repo (looked up by name; never create it or its database
firewall here). Its name, the client tag its firewall trusts (the droplet carries it) and the admin credentials for
`db:bootstrap` come from `.secure.deploy.env`; nothing reads another repo. The operator's machine reaches the cluster's
public host directly (its IP must be among the cluster's trusted sources; `db:import` also SSHes through the edge), so
there is no SSH tunnel. Secrets live
only in the gitignored `.secure.deploy.env` (copy `.secure.deploy.env.example`), loaded per task by mise:
`mise run infra:plan`, `infra:apply`, `db:bootstrap`, `db:import [-- <export-dir>]`, and the release tasks
`deploy:build`, `deploy:push`, `deploy [-- <version>]`, `deploy:status` (see `deploy/README.md`); `mise run deploy:test`
checks the script guards. Never run `infra:apply` without md. Runbook, costs and live verification steps: `deploy/README.md`.

### Releasing (Story 11.10)

`mise run deploy` is the release: clean tree, `back:test`, build + push `:<version>`, write the droplet's `.env`
(secrets only as `ssh` stdin, mode 600), pull, `up -d --wait` with `deploy/docker-compose.yml`, smoke-test
`/api/health` through the edge. `mise run deploy -- <version>` rolls onto an already published version (the rollback);
`mise run deploy:status` shows the running version and the public URL's HTTP status. Tasks load `.secure.deploy.env`
and/or `.secure.build.env` themselves; `lib.sh` strips every variable of both files, `TF_VAR_*` and `KTOR_*` before
nested Gradle or mise tasks. A deploy never runs Terraform and never rolls back by itself. Release procedure,
backups, rollback and the cutover order: `deploy/README.md`.

### Backups and rolling back a release

The MongoDB dump and restore procedure is gone with MongoDB. Backups (the shared cluster's daily backups, an optional
`pg_dump` before a migration release) and rollback (`mise run deploy -- <previous version>`) are in `deploy/README.md`.
