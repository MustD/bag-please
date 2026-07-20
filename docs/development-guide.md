# Development Guide

## Prerequisites

| Tool    | Required Version           | Notes                                                                                            |
|---------|----------------------------|--------------------------------------------------------------------------------------------------|
| JDK     | 25                         | Must be exactly 25 — the Gradle JVM toolchain fails with a cryptic error on other versions       |
| Node.js | 26                         | Matches `mise` (`node = 26.4`) and both Dockerfiles (`node:26-alpine`)                           |
| Docker  | Any recent                 | Required for MongoDB + the built stack; also for backend Testcontainers (daemon must be running) |
| npm     | Bundled with Node          | Frontend dependencies                                                                            |
| Gradle  | via `gradlew` at repo root | Do NOT install a separate Gradle; use `./gradlew` from repo root or `../gradlew` from `bp_back/` |

`mise` pins the toolchain (`mise install` provisions `temurin-25` + `node 26.4`) and exposes tasks — run `mise tasks` to
list them. Every command below has a `mise run …` equivalent (noted inline).

**Verify JDK:**

```bash
java -version   # must report 25
```

---

## Local Development (Recommended Mode)

Run MongoDB + the backend in Docker, and the frontend locally with Vite HMR. The Vite dev server proxies `/api` to the
backend on `:4000` (`bp_front/vite.config.ts`), so there is no Caddy in this loop.

```bash
# Terminal 1: infrastructure — mongo + backend in Docker      (mise run infra)
docker compose up mongo bp_back

# Terminal 2: frontend dev server — Vite + HMR on :5173         (mise run front:dev)
cd bp_front
npm install
npm run dev
```

**Access the app (dev):** `http://localhost:5173`
**Default credentials:** admin / admin

### Backend hot reload

To iterate on the backend with continuous rebuild, run it locally instead of in Docker:

```bash
# Terminal 1: mongo only
docker compose up mongo

# Terminal 2: backend, continuous build (from bp_back/)        (mise run back:run)
cd bp_back
../gradlew run -t

# Terminal 3: Vite dev server                                  (mise run front:dev)
cd bp_front && npm run dev
```

`application.yaml` changes are **not** hot-reloaded — restart `../gradlew run -t` after editing it.

---

## Alternative: Fully Containerized Mode (Production Parity)

Build and run the whole stack — the Vite bundle served by Caddy, plus backend and mongo — on `:2080`:

```bash
docker compose up --build            # mise run up
```

**Access the app (built stack):** `http://localhost:2080`

For HTTPS on a domain, run an external edge proxy on the host that terminates TLS and forwards to `:2080` — the app is
then reachable at `https://bag-please.localhost`. HTTPS is required for auth to persist (the refresh cookie is
`Secure` +
`SameSite=Strict`). See `routing/edge-proxy.md`.

---

## Backend Commands (from `bp_back/`)

```bash
../gradlew build                                   # build            (mise run back:build)
../gradlew run -t                                  # run, hot reload  (mise run back:run)
../gradlew test                                    # tests (needs Docker daemon)  (mise run back:test)
../gradlew test --tests "com.bagplease.ApplicationTest"   # single test class
```

**Note:** the Gradle wrapper lives at the **repo root**, not inside `bp_back/`. From the repo root you can also run
`./gradlew :bp_back:<task>`.

---

## Frontend Commands (from `bp_front/`)

```bash
npm install         # dependencies                              (mise run front:install)
npm run dev         # Vite dev server on :5173                  (mise run front:dev)
npm run build       # tsc -b && vite build → dist/              (mise run front:build)
npm run preview     # preview the built dist/ locally
npm run lint        # eslint src/                               (mise run front:lint)
npm run generate    # regenerate GraphQL types (see below)      (mise run front:generate)
npm run test:e2e    # Playwright E2E                            (mise run front:e2e)
```

---

## Regenerating GraphQL Types

Run after any backend GraphQL schema change. The generator introspects the live schema at `:2080/api/graphql`, which
requires a Bearer token. Access tokens are short-lived (~15 min), so mint one at run time and pass it via the
`CODEGEN_TOKEN` env var — do **not** hand-edit `codegen.ts` or anything under `src/__generated__/`.

1. Start the full stack: `docker compose up -d --build` (backend must answer on `:2080`).
2. Regenerate:
   ```bash
   cd bp_front
   CODEGEN_TOKEN="$(curl -s -X POST http://localhost:2080/api/auth/login \
     -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')" npm run generate
   ```
3. Commit the regenerated files under `src/__generated__/`.

**Warning:** stale generated types may not cause TypeScript compile errors — always regenerate after schema changes.

---

## Testing

### Backend Tests

```bash
cd bp_back
../gradlew test
```

**Requirements:**

- Docker daemon must be running (Testcontainers spins up `mongo:8`)
- Tests run in parallel against a shared container — no test may assume the DB is empty
- Each test generates its own UUIDs and asserts only on data it created

**Structure:** `FunSpec` only; no mocking (real MongoDB via Testcontainers); use the `mongoContainer()` helper from
`utils/TestContainers.kt`; supply a valid token on every protected request.

### Frontend E2E (Playwright)

```bash
npm run test:e2e
```

- Runs against the **built** stack on `http://localhost:2080` (production parity: Vite bundle served by Caddy). The
  `webServer` block builds/starts the docker stack, or reuses an already-running `:2080`.
- Config: `bp_front/playwright.config.ts`; tests in `bp_front/e2e/`; desktop (`Desktop Chrome`) + mobile (`Pixel 7`)
  projects.
- To exercise the real HTTPS + Secure-cookie path through the edge domain (edge must be running):
  ```bash
  E2E_BASE_URL=https://bag-please.localhost npm run test:e2e
  ```
  `ignoreHTTPSErrors` is enabled, so an untrusted local cert won't fail the run.

There is no frontend component/unit test framework yet — TBD.

---

## Port Reference

| Port          | Service                         | Accessible                                           |
|---------------|---------------------------------|------------------------------------------------------|
| 2080          | Caddy (built-stack entry point) | `127.0.0.1:2080` — browser entry for the built stack |
| 5173          | Vite dev server                 | Local dev entry (HMR); proxies `/api` → `:4000`      |
| 4000          | Ktor backend                    | `127.0.0.1:4000` — direct access bypasses Caddy      |
| 27217 → 27017 | MongoDB                         | `127.0.0.1:27217` (host) — for local tooling         |

The public domain `https://bag-please.localhost` is served by an external edge proxy in front of `:2080` (see
`routing/edge-proxy.md`).

---

## Useful Development URLs

| URL                                       | Purpose                                           |
|-------------------------------------------|---------------------------------------------------|
| `http://localhost:5173`                   | App entry — local dev (Vite)                      |
| `http://localhost:2080`                   | App entry — built stack (Caddy)                   |
| `https://bag-please.localhost`            | App entry — via the TLS edge proxy                |
| `http://localhost:2080/api/graphql`       | GraphQL HTTP endpoint (POST; requires auth)       |
| `http://localhost:2080/api/subscriptions` | GraphQL subscriptions (WebSocket)                 |
| `http://localhost:2080/api/auth/config`   | Public config (registration flag); readiness ping |
| `http://localhost:2080/api/auth/login`    | Login (returns `accessToken` + refresh cookie)    |

> There is **no** GraphiQL/GraphQL Playground route and no `/health` endpoint. Use `GET /api/auth/config` returning 200
> as a manual readiness check.

---

## API Playground (IntelliJ HTTP Client)

`.http` files in `ApiPlayground/` exercise the API via the IntelliJ HTTP Client; environment config is in
`ApiPlayground/http-client.env.json`. Update these when adding new endpoints.

---

## Common Issues

| Symptom                                          | Cause                             | Fix                                                             |
|--------------------------------------------------|-----------------------------------|-----------------------------------------------------------------|
| Gradle toolchain error                           | Wrong JDK version                 | Install JDK 25; set `JAVA_HOME` (or `mise install`)             |
| Vite `/api` calls fail (dev)                     | Backend not on `:4000`            | Start `docker compose up mongo bp_back` or `../gradlew run -t`  |
| E2E can't reach `:2080`                          | Built stack not up                | `docker compose up -d --build`, or let `webServer` start it     |
| Auth doesn't persist on the domain               | Browser origin not HTTPS          | Use `https://bag-please.localhost` via the edge (Secure cookie) |
| `../gradlew test` fails with a Docker error      | Docker daemon not running         | Start Docker daemon                                             |
| GraphQL returns `{"data": ..., "errors": [...]}` | Missing/expired token             | Re-authenticate; refresh happens via `/api/auth/refresh`        |
| `npm run generate` fails                         | Stack not on `:2080` or bad token | Start the stack; mint a fresh `CODEGEN_TOKEN`                   |
| `application.yaml` changes not picked up         | Resources aren't hot-reloaded     | Restart `../gradlew run -t`                                     |
