# Deployment Guide

## Services

Docker Compose (`docker-compose.yaml`) defines three services on a single bridge network. There is **no** separate
`router`/nginx service — Caddy is baked into the `bp_front` image and is the served entry point.

| Service    | Image                                        | Port (host → container) | Notes                                                                                                                   |
|------------|----------------------------------------------|-------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `mongo`    | `mongo:8`                                    | `127.0.0.1:27217:27017` | Persistent volume `./db/data`; healthcheck; host port 27217 avoids clashing with a local MongoDB                        |
| `bp_back`  | Built from repo root (`bp_back/Dockerfile`)  | `127.0.0.1:4000:4000`   | Ktor fat JAR on `eclipse-temurin:25`; waits for mongo healthy                                                           |
| `bp_front` | Built from repo root (`bp_front/Dockerfile`) | `127.0.0.1:2080:80`     | **Entry point** — Caddy serves the Vite `dist/` and proxies `/api` to `bp_back`; waits for mongo healthy + back started |

All published ports are bound to `127.0.0.1` — nothing is reachable from other machines directly. Public exposure is the
job of an external edge proxy (see below).

## Docker Compose — Full Stack

```bash
docker compose up --build          # build & start everything on :2080   (mise run up)
docker compose up mongo bp_back    # infra only, for the Vite dev server  (mise run infra)
docker compose down                # stop & remove containers
docker compose down -v             # also remove volumes (wipes MongoDB data)
```

## External Edge Proxy & Public Domain

TLS and the public domain are owned by an **external edge proxy on the host**, not by this stack. The stack exposes a
single plain-HTTP entrypoint (`127.0.0.1:2080`, Caddy) for the edge to forward to. Locally the app is served over HTTPS
at **`https://bag-please.localhost`** (the `.localhost` TLD resolves to loopback automatically; use a locally-trusted
cert such as `mkcert`). HTTPS is required for auth to persist — the refresh cookie is `Secure` + `SameSite=Strict`.

The edge **must** overwrite `X-Forwarded-For` with the real client IP (not append it), because the backend keys its auth
rate limiter on that header. See `routing/edge-proxy.md` for the full integration contract (upstream, forwarded headers,
WebSocket upgrade, TLS).

```
browser --HTTPS--> edge proxy (TLS, domain) --HTTP--> Caddy :2080 --> bp_back :4000
                                                          |
                                                          +--> SPA (/srv)
```

## Configuration (Environment Variables)

Backend configuration lives in `bp_back/src/main/resources/application.yaml` using Ktor's `"$ENV_VAR:default"` syntax.
Override values by setting env vars — in production these are set on the `bp_back` service under `environment:` in
`docker-compose.yaml` (which already sets `KTOR_MONGO_*`, `MIGRATION_TARGET_USER`, and `KTOR_RATE_LIMIT_ATTEMPTS`).

| Variable                         | Default (in-container)          | Purpose                             |
|----------------------------------|---------------------------------|-------------------------------------|
| `KTOR_MONGO_HOST`                | `mongo` (compose) / `localhost` | MongoDB host                        |
| `KTOR_MONGO_PORT`                | `27017` (compose) / `27217`     | MongoDB port                        |
| `KTOR_MONGO_DB_NAME`             | `bag_please`                    | Database name                       |
| `KTOR_MONGO_USER`                | `user`                          | MongoDB user                        |
| `KTOR_MONGO_PASS`                | `pass`                          | MongoDB password                    |
| `KTOR_JWT_SECRET`                | `secret`                        | JWT signing secret                  |
| `KTOR_ADMIN_LOGIN`               | `admin`                         | Admin login                         |
| `KTOR_ADMIN_PASS`                | `admin`                         | Admin password                      |
| `KTOR_JWT_ACCESS_EXPIRY_MINUTES` | `15`                            | Access-token lifetime (minutes)     |
| `KTOR_JWT_REFRESH_EXPIRY_DAYS`   | `30`                            | Refresh-cookie lifetime (days)      |
| `KTOR_RATE_LIMIT_ATTEMPTS`       | `5` (compose sets `6000`)       | Auth attempts per window            |
| `KTOR_RATE_LIMIT_WINDOW_SECONDS` | `60`                            | Rate-limit window (seconds)         |
| `MIGRATION_TARGET_USER`          | empty (compose sets `mia`)      | One-time data-migration target user |

JWT `issuer`/`audience`/`realm` are fixed in `application.yaml` (`bag-please.com`) and are not env-configurable.

> **`project.env` is not for backend config.** It only holds `DOCKER_IMAGE_BACK` / `DOCKER_IMAGE_FRONT` and is consumed
> by `images-build-push.sh`. Copy `project.example.env` → `project.env` before building/pushing images.

**Production:** always override `KTOR_JWT_SECRET`, `KTOR_ADMIN_LOGIN`, `KTOR_ADMIN_PASS`, and the MongoDB credentials.

## Dockerfiles

### bp_back (`bp_back/Dockerfile`)

Multi-stage Gradle build. Build context is the **repo root** (the Gradle wrapper, `settings.gradle.kts`, and the version
catalog live at the root). Stage 1 (`gradle:9.5.0-jdk25`) rewrites `settings.gradle.kts` to include only `bp_back` and
runs `:bp_back:buildFatJar`; stage 2 (`eclipse-temurin:25`) runs the fat JAR on port 4000.

### bp_front (`bp_front/Dockerfile`)

Multi-stage image, build context **repo root**. Stage 1 (`node:26-alpine`) runs `npm ci` + `npm run build` to produce
`dist/`; stage 2 (`caddy:2-alpine`) copies `routing/Caddyfile` and serves `dist/` from `/srv`, exposing port 80. This is
the production artifact the E2E suite runs against.

## Health Check

MongoDB has a built-in healthcheck (`db.adminCommand('ping')`); `bp_back` and `bp_front` both `depends_on` mongo with
`condition: service_healthy`.

**No backend health endpoint exists.** Use `GET http://localhost:2080/api/auth/config` returning 200 as a manual
readiness check (this is also what the E2E global setup polls).

## Building and Pushing Docker Images

`images-build-push.sh` automates multi-arch image builds and pushes, reading image names from `project.env`. Review its
contents before use.

## MongoDB Persistence

Data is mounted at `./db/data:/data/db` (`db/.gitignore` excludes the data files). Back up this directory to persist
data across container recreations. The host port is `27217` to avoid conflicting with a locally installed MongoDB.

## Production Hardening Checklist

- [ ] Set a strong `KTOR_JWT_SECRET` (min 32 chars, random)
- [ ] Change `KTOR_ADMIN_LOGIN` / `KTOR_ADMIN_PASS` from defaults
- [ ] Change MongoDB `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD` and matching `KTOR_MONGO_*`
- [ ] Terminate TLS at the external edge proxy and serve the public domain over HTTPS (required — the refresh cookie is
  `Secure`)
- [ ] Ensure the edge **overwrites** `X-Forwarded-For` with the real client IP (do not append), or rate limiting can be
  spoofed / degrades to one global bucket
- [ ] Keep `:2080` bound to `127.0.0.1` so only the edge (same host) reaches Caddy; on a shared host pin Caddy's
  `trusted_proxies` to the edge's exact CIDR
- [ ] Tune `KTOR_RATE_LIMIT_ATTEMPTS` / `KTOR_RATE_LIMIT_WINDOW_SECONDS` for production (compose uses a very high value
  for E2E)
- [ ] Back up `./db/data` regularly
- [ ] Consider rotating the JWT secret (invalidates existing tokens)

## Known GLIBC Issue (MongoDB on Kernel ≥ 6.19)

```yaml
mongo:
  environment:
    GLIBC_TUNABLES: "glibc:pthread:rseq=1"
```

This workaround is required on Linux hosts with kernel ≥ 6.19.
