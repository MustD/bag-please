# Development Guide

## Prerequisites

| Tool    | Required Version           | Notes                                                                                            |
|---------|----------------------------|--------------------------------------------------------------------------------------------------|
| JDK     | 25                         | Must be exactly 25 — Gradle JVM toolchain will fail with cryptic error on other versions         |
| Docker  | Any recent                 | Required for MongoDB + nginx; also for Testcontainers (must be running)                          |
| Node.js | 22                         | Backend Dockerfile uses v22; match locally for consistency                                       |
| npm     | Bundled with Node          | Used for frontend dependencies                                                                   |
| Gradle  | via `gradlew` at repo root | Do NOT install a separate Gradle; use `./gradlew` from repo root or `../gradlew` from `bp_back/` |

**Verify JDK:**

```bash
java -version   # must report 25
```

---

## Local Development (Recommended Mode)

Run nginx + MongoDB in Docker, backend and frontend locally for hot reload:

```bash
# Terminal 1: Start infrastructure
docker compose up mongo router

# Terminal 2: Start backend (hot reload)
cd bp_back
../gradlew run -t

# Terminal 3: Start frontend (hot reload)
cd bp_front
npm install
npm run dev     # binds to :3000 — DO NOT use another port or nginx will 502
```

**Access the app:** `http://localhost:2080`  
**Default credentials:** admin / admin

---

## Alternative: Fully Containerized Mode

Run everything in Docker (no hot reload):

```bash
docker compose up --build
```

Note: To switch between dev and containerized nginx configs, you must manually edit `routing/nginx.conf` (swap
`host.docker.internal` ↔ container names). See architecture-routing.md for details.

---

## Backend Commands (from `bp_back/`)

```bash
# Build
../gradlew build

# Run with hot reload (recommended for dev)
../gradlew run -t

# Run tests (requires Docker daemon running)
../gradlew test

# Run a single test class
../gradlew test --tests "com.bagplease.ItemApiTest"
```

**Note:** Gradle wrapper is at the **repo root**, not inside `bp_back/`. Always use `../gradlew` from within `bp_back/`.

---

## Frontend Commands (from `bp_front/`)

```bash
# Install dependencies
npm install

# Dev server (port 3000)
npm run dev

# Production build
npm run build

# Lint
npm run lint

# Regenerate GraphQL types (requires backend running on :2080 with valid JWT)
npm run generate
```

---

## Regenerating GraphQL Types

Run after any backend schema change:

1. Ensure the backend is running: `../gradlew run -t` (from `bp_back/`) + `docker compose up mongo router`
2. Obtain a JWT:
   ```bash
   curl -X POST http://localhost:2080/api/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin"}'
   ```
3. Copy the `token` value into `bp_front/codegen.ts` as the `Authorization: Bearer` header value
4. Run: `cd bp_front && npm run generate`
5. Commit the updated `src/__generated__/graphql.ts`

**Warning:** Stale generated types may not cause TypeScript compile errors — always regenerate after schema changes.

---

## Testing

### Backend Tests

```bash
cd bp_back
../gradlew test
```

**Requirements:**

- Docker daemon must be running (Testcontainers spins up `mongo:8`)
- Tests run in parallel against a shared container
- No test data assumptions — each test generates its own UUIDs

**Test structure:**

- `FunSpec` only (no DescribeSpec, BehaviorSpec, etc.)
- No mocking — all tests hit real MongoDB via Testcontainers
- Auth: call `POST /login` to get a token; use `bearerAuth(token)` on requests
- Use `mongoContainer()` helper from `utils/TestContainers.kt`

### Frontend Tests

No framework is settled yet — TBD.

---

## Port Reference

| Port  | Service             | Accessible                       |
|-------|---------------------|----------------------------------|
| 2080  | nginx (entry point) | Browser → always use this        |
| 3000  | Next.js dev server  | Direct access bypasses nginx     |
| 4000  | Ktor backend        | Direct access bypasses nginx     |
| 27017 | MongoDB             | Docker-exposed for local tooling |

---

## Useful Development URLs

| URL                                   | Purpose                            |
|---------------------------------------|------------------------------------|
| `http://localhost:2080`               | App entry point                    |
| `http://localhost:2080/auth`          | Login page                         |
| `http://localhost:2080/api/graphiql`  | GraphQL playground (requires auth) |
| `http://localhost:2080/api/graphql`   | GraphQL endpoint                   |
| `http://localhost:2080/api/auth-test` | JWT validity check                 |

---

## API Playground (IntelliJ HTTP Client)

`.http` files in `ApiPlayground/` cover all operations:

- `ApiPlayground/security/` — login, auth-test
- `ApiPlayground/item/` — getItems, saveItem, deleteItem
- `ApiPlayground/category/` — getCategories, saveCategory, deleteCategory

Environment config is in `ApiPlayground/http-client.env.json`.

---

## Common Issues

| Symptom                                           | Cause                            | Fix                                                  |
|---------------------------------------------------|----------------------------------|------------------------------------------------------|
| Gradle toolchain error                            | Wrong JDK version                | Install JDK 25; set `JAVA_HOME`                      |
| nginx returns 502 on frontend                     | Next.js not on port 3000         | Kill other processes on :3000; restart `npm run dev` |
| `gradlew test` fails with Docker error            | Docker not running               | Start Docker daemon                                  |
| GraphQL returns `{"data": null, "errors": [...]}` | Missing/expired JWT              | Re-login; check token expiry (7 days)                |
| `npm run generate` fails                          | Backend not running or wrong JWT | Start backend; update token in `codegen.ts`          |
| `application.yaml` changes not picked up          | Resources aren't hot-reloaded    | Restart `../gradlew run -t`                          |
