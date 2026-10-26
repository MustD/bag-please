# Bag Please

**A shared shopping list for households: one list per shop run, checked off together in real time.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/MustD/bag-please?label=version)](https://github.com/MustD/bag-please/tags)
[![Kotlin](https://img.shields.io/badge/Kotlin-2.4-7F52FF?logo=kotlin&logoColor=white)](https://kotlinlang.org)
[![Ktor](https://img.shields.io/badge/Ktor-3.6-087CFA?logo=ktor&logoColor=white)](https://ktor.io)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![GraphQL](https://img.shields.io/badge/API-GraphQL-E10098?logo=graphql&logoColor=white)](https://graphql.org)

**Live demo:** <https://bag-please.io-workshop.net>

Bag Please is a self-hostable, mobile-first web app (an installable PWA) for keeping shopping lists that several people
share. Items, categories and stores live in lists; everyone on a list sees changes as they happen.

## Features

- **Shared lists**: create lists with an emoji icon, invite other users by username, accept or decline invites, leave
  a list at any time.
- **Real-time updates**: check-offs, adds, edits and deletes appear instantly for every member (GraphQL subscriptions
  over WebSocket).
- **Smart items**: one-timer items disappear once bought; recurring items (weekly, biweekly, monthly) come back on their
  own; an item can belong to several stores.
- **Categories, filters and search**: group items by category, filter by several categories at once, search by name.
- **Accounts**: registration and login, silent session renewal, change your password, send feedback to the admin.
- **Admin area**: manage users, reset passwords, turn public registration on or off at runtime, read user feedback.
- **Installable**: add it to an Android home screen as a standalone app.

## How it fits together

```
browser ──► Caddy (bp_front image, :2080)
              ├── /        built React SPA (Vite + Material UI + Apollo Client)
              └── /api ──► Ktor backend (bp_back, :4000) ── GraphQL + WebSocket
                                 └──► PostgreSQL 18 (Flyway migrations)
```

| Part                     | Stack                                                                               |
|--------------------------|-------------------------------------------------------------------------------------|
| [`bp_back/`](bp_back)    | Kotlin 2.4, Ktor 3.6, graphql-kotlin 11, Exposed 1.6 (R2DBC), Flyway 13, JWT auth   |
| [`bp_front/`](bp_front)  | React 19, TypeScript 6, Vite 8, Material UI 9, Apollo Client 4, `vite-plugin-pwa`   |
| [`routing/`](routing)    | `Caddyfile`: serves the SPA and proxies `/api` to the backend                       |
| [`deploy/`](deploy)      | Terraform (DigitalOcean), production Compose file and release scripts               |

## Quick start (Docker)

Requires Docker with Compose.

```bash
git clone https://github.com/MustD/bag-please.git
cd bag-please
docker compose up --build
```

Open <http://localhost:2080> and sign in as `admin` / `admin`. The admin account manages users and settings; create a
regular user (or enable registration) from the admin area to start making lists.

The first build compiles both images and takes a few minutes.

The values in [`docker-compose.yaml`](docker-compose.yaml) are for local use only. Before anyone else can reach your
instance, change `KTOR_JWT_SECRET`, `KTOR_ADMIN_PASS` and the database passwords, and drop `KTOR_RATE_LIMIT_ATTEMPTS:
6000` (it is raised for the E2E suite and effectively disables login rate limiting). Behind any host other than
`localhost`, serve the app over HTTPS: the refresh cookie is `Secure` and `SameSite=Strict`, so sessions do not
survive a reload over plain HTTP. See [`routing/edge-proxy.md`](routing/edge-proxy.md); the production setup in
[`deploy/`](deploy) is a worked example.

## Development

The toolchain (Java 25, Node 26, Gradle 9) is pinned in [`mise.toml`](mise.toml). The repo ships no Gradle wrapper, so
without mise install JDK 25 and Gradle 9 yourself.

```bash
mise install        # provision the toolchain
mise tasks          # list every task
```

Run the backend and database in Docker and the frontend with hot reload:

```bash
docker compose up postgres bp_back     # or: mise run docker:back
cd bp_front && npm install && npm run dev   # Vite on http://localhost:5173, proxies /api to :4000
```

Or run the backend from source, with only the database in Docker (the `run` task supplies local dev values for the
JWT secret and admin credentials):

```bash
docker compose up postgres
gradle :bp_back:run -t                 # or: mise run back:run
```

The frontend's GraphQL types are generated from the live schema with `npm run generate` in `bp_front/`; it needs the
stack on :2080 and an admin access token in `CODEGEN_TOKEN` (the full command is in [`CLAUDE.md`](CLAUDE.md)).
Architecture notes for each part are in [`bp_back/CLAUDE.md`](bp_back/CLAUDE.md),
[`bp_front/CLAUDE.md`](bp_front/CLAUDE.md) and [`routing/CLAUDE.md`](routing/CLAUDE.md).

### Tests

```bash
gradle :bp_back:test                   # backend (Kotest; uses Testcontainers, so Docker must be running)
cd bp_front && npm run lint            # frontend lint
cd bp_front && npm run test:e2e        # Playwright E2E; builds and starts the Docker stack on :2080 if it is not up
```

## Configuration

The backend reads its settings from environment variables (see
[`application.yaml`](bp_back/src/main/resources/application.yaml)). The first three have no default: the backend
refuses to start without them (Docker Compose and the Gradle `run` task supply local dev values).

| Variable                                              | Purpose                                             | Default          |
|-------------------------------------------------------|-----------------------------------------------------|------------------|
| `KTOR_JWT_SECRET`                                     | Secret used to sign access tokens                   | none (required)  |
| `KTOR_ADMIN_LOGIN`, `KTOR_ADMIN_PASS`                 | Admin credentials (the admin is not stored in the DB) | none (required)  |
| `KTOR_JWT_ACCESS_EXPIRY_MINUTES`                      | Access token lifetime                               | `15`             |
| `KTOR_JWT_REFRESH_EXPIRY_DAYS`                        | Refresh token lifetime                              | `30`             |
| `KTOR_RATE_LIMIT_ATTEMPTS`, `KTOR_RATE_LIMIT_WINDOW_SECONDS` | Login/registration attempts per IP per window | `5` per `60` s   |
| `KTOR_DB_HOST`, `KTOR_DB_PORT`, `KTOR_DB_NAME`        | PostgreSQL location                                 | `localhost`, `25432`, `bag_please` |
| `KTOR_DB_USER`, `KTOR_DB_PASSWORD`                    | PostgreSQL credentials                              | `bag_please_app`, `bag_please_app` |
| `KTOR_DB_SSLMODE`, `KTOR_DB_SSLROOTCERT`              | TLS mode and CA certificate path for the database   | `disable`, empty |
| `KTOR_DB_POOL_MAX_SIZE`                               | Connection pool size                                | `5`              |

## Deployment

Production runs the two images (`bp_front`, `bp_back`) on a single droplet against a managed PostgreSQL database,
provisioned with Terraform and released with one command (`mise run deploy`). The runbook, backups and rollback are in
[`deploy/README.md`](deploy/README.md).

## Project layout

```
bp_back/     Kotlin/Ktor GraphQL backend
bp_front/    React SPA and Playwright E2E suite
routing/     Caddy configuration and edge-proxy contract
deploy/      Terraform, production Compose file, release scripts
postgres/    Local database init scripts
design/      UI design prototypes
_bmad-output/ Planning documents (PRD, architecture, epics, story specs)
```

## License

[MIT](LICENSE) © 2026 Ilya Obukhov
