---
baseline_commit: 51fcc3262c12b1eeb5577ebeceff12cc17940112
---

# Story 5.1: Foundation — Vite + MUI + Caddy + Apollo Shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the team,
I want a new Vite + MUI single-page app scaffolded, wired to the existing backend through Caddy, with the auth/routing shell in place,
so that every subsequent Epic 5 feature story has a working foundation and a green E2E harness.

## Context & Constraints (read first)

This is the **first story of Epic 5: Frontend Reframe**. The frontend is being re-implemented **from scratch** as a Vite + React + TypeScript SPA with Material UI, served by **Caddy**, replacing the Next.js app (`bp_front`) and the nginx proxy (`routing/`). The Ktor/GraphQL backend is the system of record and is **consumed unchanged**.

**Hard standing constraints for ALL Epic 5 work:**

1. **Do NOT modify backend code** (`bp_back/`). The GraphQL schema and `/api/*` REST auth endpoints are consumed as-is. Any required backend change MUST be confirmed with `md` before proceeding. (reframe rule 2)
2. **Every feature ships a real-browser Playwright E2E test.** Manually exercise the flow in a real browser first (via the Playwright MCP) to discover the steps and confirm it works, *then* write the test. Tests are **UI-driven — no API-only shortcuts** — and FR-mapped. (reframe rule 1; this is the exact rule Epic 4 violated and left the app broken — see Dev Notes.)
3. **No scaffold exists yet.** Commit `51fcc32` ("reframe frontend architecture…") changed *only planning docs* despite its message — there is no Vite app, no Caddyfile, no tests. Build everything in this story from scratch.

**Design reference:** `design/Bag Please.html` + `design/theme.js` / `*.jsx` are a **visual style reference only** (palette, typography, look-and-feel) — **not** a functional prototype. Behavior and structure follow the FRs and story ACs, never the mockup. The Epic 4 UX spec (BPSheet 3-state, BPBottomNav, ProgressStrip, one-timer/recurring affordances) is **NOT carried forward**.

## Acceptance Criteria

1. **Vite app scaffolded** — A new Vite + React + TypeScript project replaces `bp_front`. The old Next.js `bp_front` source is removed. The app boots (`npm run dev`) and renders a shell with no console errors.
2. **MUI installed with a dark theme** — Material UI is installed and a single dark theme (`createTheme`) is applied app-wide via `ThemeProvider` + `CssBaseline`, with palette/typography derived from the `design/theme.js` **dark** palette (background `#000000`/`#0d0d10`, card `#1C1C1E`, text `#FFFFFF`, accent teal `#4DC9BB`). Visual approximation is acceptable — do not pixel-match.
3. **Caddy replaces nginx, serving the production build** — `routing/` is converted to Caddy. Caddy serves the **built** SPA (`vite build` → static `dist/`) via `file_server` with a `try_files {path} /index.html` SPA fallback, and proxies `/api/subscriptions` → backend WebSocket and `/api/*` → backend HTTP. The `/api/subscriptions` rule is matched **before** `/api/*`. The old `nginx.conf` and nginx `Dockerfile` are removed. (This is the production artifact — the same image the E2E suite runs against; see AC 10.)
4. **Old infra removed; production image builds** — The Next.js `bp_front` service is removed from `docker-compose.yaml`; nginx is gone. A multi-stage frontend build (node builds `dist/` → `caddy:2-alpine` serves it) produces the production image. `docker compose up -d --build` builds and serves the stack on `http://localhost:2080` (built SPA + `/api` proxy + mongo + backend); a deep-link (e.g. `/some/client/route`) returns `index.html`, not 404.
5. **Apollo Client (split link)** — Apollo Client is configured with a split link: HTTP terminating link → `/api/graphql`; WebSocket link (`graphql-ws`) → `/api/subscriptions` for subscriptions. The WS link supplies `connectionParams: { Authorization: "Bearer <accessToken>" }` from the in-memory auth state. A single `ApolloProvider` wraps the app — never instantiate a second client.
6. **GraphQL codegen retargeted** — `codegen.ts` (client-preset) targets the new Vite source tree (`src/**/*.{ts,tsx}` → `src/__generated__/`) against `http://localhost:2080/api/graphql`. `npm run generate` succeeds (base types only; no operations defined yet). `src/__generated__/` is never hand-edited.
7. **In-memory auth context** — An `AuthProvider` exposes `username`, `role`, `accessToken`, and `setAuth` / `clearAuth`. The **access token is held in memory only** (React state/context) — never in `localStorage`. On app load the provider attempts a silent `POST /api/auth/refresh` (httpOnly cookie) to bootstrap a session; while this is in flight an `isLoading` state is exposed.
8. **Client-side router + guards** — React Router provides client-side routing. A **protected-route layout (auth guard)** redirects unauthenticated users to `/auth` (FR29) using `replace` (not `push`). An **admin guard** wrapper for `/admin/*` is scaffolded (redirects non-admins). `/auth` renders a placeholder auth screen (full auth UI is Story 5.2).
9. **Silent-refresh error link** — Apollo's error link catches HTTP 401 on operations, attempts one silent `/api/auth/refresh`, updates auth state, and retries the operation once; a second failure calls `clearAuth()` and redirects to `/auth?expired=1`.
10. **Playwright harness + smoke E2E (production parity, two viewports)** — Playwright runs against the **production image** (`baseURL: http://localhost:2080`, `webServer: docker compose up -d --build`). The smoke E2E runs on **two projects — Desktop Chrome AND a mobile viewport (Pixel-class)** — and proves on both: (a) the app loads; (b) an unauthenticated visit to a protected route redirects to `/auth`. A deep-link to a non-root client route serves the SPA (proves Caddy's `try_files` fallback). The test is UI-driven (no API shortcuts) and passes via `npm run test:e2e`. **Manual validation first:** before writing the test, exercise the flow in a real browser via the Playwright MCP — and, where available, on the real Android device against the `:2080` production image over the host LAN IP (5.1's smoke is unauthenticated, so the `Secure`-cookie wall below does not apply yet).

**FRs:** infrastructure, FR29 (unauthenticated → login redirect)
**E2E:** app loads (desktop + mobile viewport); unauthenticated visit to a protected route → `/auth` redirect; deep-link → SPA fallback.

## Tasks / Subtasks

- [x] **Task 1: Scaffold the Vite + React + TS app, remove old `bp_front`** (AC: 1)
  - [x] Create a new Vite React-TS project at `bp_front/` (delete the old Next.js source: `app/`, `next.config.*`, `.next/`, Next deps). Keep the `bp_front/` directory name (docker-compose, mise, codegen, CLAUDE.md all reference it).
  - [x] Set up `vite.config.ts` with `@vitejs/plugin-react`, path alias `@` → `src/`, dev server `port: 5173`, and `server.proxy` for `/api` → `http://localhost:4000` and `/api/subscriptions` (ws) — this is the **fast inner loop** (native Vite + HMR; no Caddy needed locally). See Dev Notes "Two modes".
  - [x] `tsconfig.json` strict mode on; `@/*` → `src/*`; `moduleResolution: bundler`.
  - [x] ESLint flat config: `typescript-eslint` + `eslint-plugin-react-hooks` (+ `eslint-plugin-react-refresh` as Vite scaffolds). Do **not** carry `eslint-config-next`. `npm run lint` runs `eslint src/`.
  - [x] App boots with `npm run dev`, renders a shell, zero console errors.
- [x] **Task 2: MUI dark theme** (AC: 2)
  - [x] Install `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` (match versions in Dev Notes).
  - [x] Create `src/theme.ts` — `createTheme({ palette: { mode: 'dark', ... } })` seeded from `design/theme.js` dark palette + teal accent. Wrap the app in `<ThemeProvider theme={theme}><CssBaseline/>…`.
  - [x] Consult the MUI MCP (`mcp__mui-mcp__fetchDocs` / `useMuiDocs`) for the v9 theme API before writing — do not guess from memory.
- [x] **Task 3: Caddy serves the production build (replaces nginx)** (AC: 3, 4)
  - [x] Delete `routing/nginx.conf` and the nginx `Dockerfile`. Add a production `Caddyfile` (snippet in Dev Notes) — `file_server` from `/srv` + `try_files {path} /index.html` fallback, `handle /api/subscriptions` and `handle /api/*` → `bp_back:4000`, the subscriptions block first.
  - [x] **Multi-stage frontend image** (Dev Notes "Docker topology"): stage 1 (`node`) runs `npm ci && npm run build` → `dist/`; stage 2 (`caddy:2-alpine`) copies `dist/` → `/srv` and the `Caddyfile`. This is the production artifact the E2E suite runs against.
  - [x] Update `docker-compose.yaml`: remove the Next `bp_front` service and the nginx `router`; add the multi-stage frontend service exposing `127.0.0.1:2080:80`. Keep `mongo` and `bp_back` unchanged (incl. `MIGRATION_TARGET_USER: "mia"`, `KTOR_RATE_LIMIT_ATTEMPTS`).
  - [x] `docker compose up -d --build` serves the **built** app at `http://localhost:2080`; `/api/graphiql` loads through the proxy; a deep-link client route returns `index.html` (not 404).
- [x] **Task 4: Apollo Client split link** (AC: 5, 9)
  - [x] Install `@apollo/client@4.1.9`, `graphql@16.14.0`, `graphql-ws@6.0.8`.
  - [x] Port `bp_front`'s `lib/apollo/ApolloWrapper.tsx` logic to plain React: `split()` by operation type → `GraphQLWsLink` (subscriptions) vs `HttpLink('/api/graphql')`; `SetContextLink` injecting `Authorization`; `ErrorLink` doing 401 → silent refresh → retry-once → else `clearAuth()` + redirect. **Drop all Next/SSR pieces** (`ApolloNextAppProvider`, `SSRMultipartLink`, `@apollo/client-integration-nextjs`); use `ApolloProvider` from `@apollo/client/react` and `useNavigate` from React Router instead of `next/navigation`.
  - [x] WS `connectionParams` reads the current access token from a ref kept in sync with auth state (see existing pattern).
  - [x] `clearAuth` disposes the graphql-ws client **before** clearing React state (ordering matters — prevents orphaned subscription events).
- [x] **Task 5: Auth REST client + in-memory AuthContext** (AC: 7)
  - [x] Port `bp_front`'s `lib/auth/authApi.ts` (fetch-based: `login`, `logout`, `register`, `changePassword`, `getConfig`, `refresh` with the single-flight `refreshPromise`). It has no Next dependency — copy nearly verbatim.
  - [x] Port `lib/auth/AuthContext.tsx`: state `{username, role, accessToken}` + `isLoading` + `registrationEnabled`; on mount call `authApi.getConfig()` and `authApi.refresh()` to bootstrap; `parseJwt` to derive `username`/`role` from the access token. Remove `'use client'`. **No `localStorage`.**
- [x] **Task 6: Router shell + guards** (AC: 8)
  - [x] Install `react-router-dom@7`. Use the **declarative** API (`<BrowserRouter>` + `<Routes>`/`<Route>`), not the data-router (`createBrowserRouter`) — the ported `RouteGuard` (effect-based redirect via `useNavigate`) assumes declarative. Routes: `/auth` placeholder, a protected layout for app routes, `/admin/*` admin-guarded placeholder, `/` → protected.
  - [x] Port `RouteGuard` to React Router: redirect unauthenticated users to `/auth` with `navigate('/auth', { replace: true })`; render nothing while `isLoading` on protected routes.
  - [x] Scaffold an `AdminGuard` wrapper: redirect `role !== 'admin'` away from `/admin/*` (FR31). Placeholder content is fine.
- [x] **Task 7: GraphQL codegen** (AC: 6)
  - [x] Port `codegen.ts` (client-preset, `nonOptionalTypename`, `skipTypeNameForRoot`, `ignoreNoDocuments`, `allowPartialOutputs`). Keep schema URL `http://localhost:2080/api/graphql`; refresh the admin JWT in the header first (the committed token is expired — see project-context "Obtaining a codegen JWT").
  - [x] Add `"generate": "graphql-codegen --config codegen.ts"` to `package.json`. Run it (backend on :2080); confirm `src/__generated__/` regenerates cleanly. Delete the stale `codegen.yml`.
- [x] **Task 8: Playwright harness + smoke E2E (production parity, two viewports)** (AC: 10)
  - [x] Install `@playwright/test`; create `playwright.config.ts` (`testDir: ./e2e`, `baseURL: http://localhost:2080`, `webServer: docker compose up -d --build` from repo root with a generous `timeout` for the image build, `reuseExistingServer: !process.env.CI`). Add `"test:e2e": "playwright test"`.
  - [x] Define **two projects**: `chromium` (`devices['Desktop Chrome']`) and `mobile` (a Pixel-class device, e.g. `devices['Pixel 7']`). The smoke runs on both — mobile-viewport coverage is mandatory here because Epic 4's regression was a mobile-only failure.
  - [x] **Manually validate first** (Playwright MCP, and the real Android device against `:2080` over the LAN if available): load `/` unauthenticated → redirect to `/auth`; load `/auth`; hit a deep client route → app boots.
  - [x] Write `e2e/smoke.spec.ts`: (a) navigate to `/` → URL ends at `/auth`; (b) navigate to a protected route → redirected to `/auth`; (c) deep-link to a non-root client route → SPA loads (Caddy fallback). UI-driven only; passes on both projects.
- [x] **Task 9: Update build tooling & docs** (AC: 1, 3)
  - [x] Update `mise.toml` frontend tasks (Next → Vite; dev port note) and the `up`/`infra` task comments if needed.
  - [x] Update `CLAUDE.md` frontend section to describe the Vite + Caddy stack (do this as part of the story so docs don't drift).
  - [x] Verify `npm run lint` and `npm run build` (`tsc && vite build`) pass.

### Review Findings

_Code review 2026-07-14 (adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor). 0 decision-needed, 4 patch, 3 deferred, 6 dismissed as noise._

- [x] [Review][Patch] Silent-refresh retry re-sends the stale access token; AC9 terminal logout path is unreachable dead code [bp_front/src/lib/apollo/ApolloProvider.tsx:82,85,65-69] — On 401, `authErrorLink` refreshes and updates `accessTokenRef`/auth state, but the retried operation is forwarded downstream (splitLink→httpLink) without re-running `authLink`, so it re-sends the Authorization header baked in on the first pass (the expired token); `httpLink` reads `context.headers`, never the ref. The retry 401s again and its error is piped to `observer.error` (line 88), which never re-enters `authErrorLink`, so the `retried` guard (65-69: AC9's "second failure → clearAuth + `/auth?expired=1`") is dead code. Net: the triggering operation always fails with a surfaced error; refresh does succeed so later fresh ops recover, but AC9's transparent retry never works. Fix: re-apply the Authorization header from the fresh token on the retried operation (line 82) AND move the terminal clearAuth+redirect into the retry error callback (line 88). Also fix the inner `forward` subscription leak — return an unsubscribe from the Observable. Not covered by the 5.1 smoke (unauthenticated). (source: blind+edge+auditor)
- [x] [Review][Patch] RouteGuard's redirect strips `?expired=1` from the expiry redirect [bp_front/src/routes/RouteGuard.tsx:14-16] — When `clearAuth()` fires on refresh failure, the error link navigates to `/auth?expired=1`, but the `username=null` re-render triggers RouteGuard's own `navigate('/auth')` (no query), which runs last and clobbers the param. The documented expiry signal is lost. Symptom only visible once Story 5.2 renders the expiry banner, but the logic is wrong now. Fix: preserve an existing `/auth` target in the guard, or centralize the expiry redirect. (source: blind)
- [x] [Review][Patch] No timeout on bootstrap silent-refresh → indefinite blank screen if the backend hangs [bp_front/src/lib/auth/authApi.ts:60-71] — `refresh()` uses a bare `fetch` with no `AbortController`; `isLoading` clears only in `.finally`; RouteGuard renders `null` while loading. A hung (not refused) backend — cold container, dead socket — leaves every route blank indefinitely with no fallback. Fix: add an `AbortController` timeout (e.g. 8s) to the bootstrap fetch and treat a timeout as unauthenticated. (source: blind+edge)
- [x] [Review][Patch] `parseJwt` duplicated in two files; unvalidated payload + unchecked `role` cast [bp_front/src/lib/apollo/ApolloProvider.tsx:15-22 & bp_front/src/lib/auth/AuthContext.tsx:17-24,62-66] — Byte-identical `parseJwt` in two files (drift risk); both do `payload.role as 'admin'|'user'` without narrowing and neither checks the payload actually has `username`/`role` — a token missing those claims would set `username=undefined`, tripping the guard to redirect despite a valid session (unreachable given the current backend contract, but undefended). Fix: extract one shared helper that validates the claims and narrows `role` at runtime. (source: blind+edge)
- [x] [Review][Defer] `getConfig()` failure leaves `registrationEnabled` stuck at `null` with no retry [bp_front/src/lib/auth/AuthContext.tsx:55-58] — deferred; consumed by the auth screen in Story 5.2, handle null/retry there.
- [x] [Review][Defer] WS `connectionParams` sends `Bearer ` (empty) when unauthenticated and won't refresh a live socket's token until reconnect [bp_front/src/lib/apollo/ApolloProvider.tsx:37-39] — deferred; no subscription operations exist in 5.1 (WS never opens) and backend WS is unauthenticated. Revisit when subscriptions land.
- [x] [Review][Defer] Bare `/api` (no subpath) falls through to the SPA `index.html` instead of the backend [routing/Caddyfile:10] — deferred; `handle /api/*` doesn't match exact `/api`, but the app only ever calls `/api/<subpath>`, so it's latent. Tighten the matcher if a bare `/api` call ever appears.

## Dev Notes

### Where things live now (ground truth, verified 2026-06-24)

- Backend (`bp_back/`) is **untouched** and already supports the full auth model this story needs. Exact surface: see the `reference-backend-auth-surface` memory and the table below.
- `bp_front/` is the **old Next.js app** — its `lib/auth/authApi.ts`, `lib/auth/AuthContext.tsx`, `lib/apollo/ApolloWrapper.tsx`, and `app/RouteGuard.tsx` are **near-directly portable** (the logic is framework-light). Read them; reuse them. The Next-specific bits to drop are listed per task.
- `routing/nginx.conf` shows the exact route shapes to replicate in Caddy.
- `design/theme.js` holds the palette tokens; `design/Bag Please.html` shows the dark default (`#0d0d10`).

### Backend API surface this story wires against (DO NOT change backend)

| Endpoint | Method | Body / Auth | Response |
|---|---|---|---|
| `/api/auth/config` | GET | none | `{registrationEnabled}` |
| `/api/auth/register` | POST | `{username,password}` | `{username,role}`; 403 if disabled |
| `/api/auth/login` | POST | `{username,password}` | `{accessToken,username,role}` + sets httpOnly `refresh_token` cookie |
| `/api/auth/refresh` | POST | reads cookie | `{accessToken}`; 401 if missing/expired |
| `/api/auth/logout` | POST | reads cookie | 200; clears cookie |
| `/api/auth/change-password` | POST | Bearer + `{currentPassword,newPassword}` | 200 |
| `/api/graphql` | POST | Bearer | GraphQL JSON |
| `/api/subscriptions` | WS | JWT in `connection_init` `connectionParams.Authorization` | subscription stream; closes 4401 if bad token |

- **Access token**: ~15 min expiry, claims `username` + `role` (`admin`|`user`). Decode client-side (`atob` of payload) to get identity — **there is no `me` query**.
- **Refresh token**: httpOnly cookie `refresh_token` (Secure, SameSite=Strict, path=`/api/auth`, 30d). The silent-refresh flow depends on this cookie being sent automatically.
- **Rate limit**: auth endpoints return **HTTP 429** when throttled (`KTOR_RATE_LIMIT_ATTEMPTS`, default 5/60s; compose sets 6000). `authApi.login` already maps 429 to a "too many attempts" message.

### Two modes (resolved in review — no third "proxy-to-host-Vite" topology)

There are exactly two run modes, split by purpose. Do not build a Caddy-proxies-to-host-Vite hybrid; it was considered and dropped.

- **Inner loop (fast iteration):** `npm run dev` → native Vite on `:5173` + HMR, with `server.proxy` forwarding `/api` → `http://localhost:4000` and `/api/subscriptions` (ws). Browse `:5173` directly — no Caddy. Run the backend via `docker compose up -d mongo bp_back` (or local gradle). This is where you live day-to-day.
- **Gate / ship (authoritative for E2E):** `docker compose up -d --build` → the **production image** (built `dist/` served by Caddy) on `http://localhost:2080`, proxying `/api`. Playwright `baseURL` = `:2080`. This is the artifact that ships, so E2E tests exactly it — production-parity from day one. Cost: a `vite build` + image layer before a cold suite run (`reuseExistingServer` avoids it locally).

**Why this shape:** the failure mode to avoid is E2E green against a dev server while the *shipped* bundle is broken (build-only bugs: asset hashing, base path, tree-shaking, SPA fallback misconfig, undefined-in-bundle env). Testing the production image closes that gap for the whole epic; every later story inherits the gate. **Scope note (John's flag):** this makes 5.1 "foundation **+ the real deployment artifact**" — the heaviest, most-depended-on story in Epic 5. That weight is intentional.

### Caddyfile (production — serves built static + proxies `/api`; backend service is `bp_back`)

`handle` blocks are mutually exclusive and evaluated in source order, so `/api/subscriptions` matches before `/api/*`. Caddy's `reverse_proxy` upgrades WebSockets automatically — no special directives needed (a real simplification over nginx). `try_files … /index.html` is the SPA deep-link fallback the smoke test asserts.

```
:80 {
    handle /api/subscriptions {
        reverse_proxy bp_back:4000
    }
    handle /api/* {
        reverse_proxy bp_back:4000
    }
    handle {
        root * /srv
        try_files {path} /index.html
        file_server
    }
}
```

### Docker topology (resolved)

Per the topology diagram (`lists-feature-reframe/diagram.drawio.html`), Caddy and the built Vite app live together in one "frontend docker" container. Realize it as a **multi-stage frontend `Dockerfile`**: stage 1 (`node`) `npm ci && npm run build` → `dist/`; stage 2 (`caddy:2-alpine`) `COPY --from` the `dist/` to `/srv` and copy the `Caddyfile`. Keep the `Caddyfile` source under `routing/` (honors "Caddy added to `routing/`") and COPY it into the image. `docker-compose.yaml` builds this as the `:2080` frontend service; `mongo` + `bp_back` unchanged.

### Real Android device (manual validation — not an automated gate)

- **Automated mobile coverage = emulated viewport** (Playwright `devices['Pixel 7']` project). Deterministic, no flakiness; catches the layout/touch class of bug that broke Epic 4. This is the CI gate.
- **The real device is for the mandatory "validate in a real browser first" step** — do that pass on the actual phone, pointed at the `:2080` production image over your host's LAN IP. Best honest signal: real device, real artifact, real touch. Do **not** wire real-device-over-ADB into the automated suite (USB/ADB/sleep flakiness).
- **Reaching the phone:** compose binds `127.0.0.1:2080` (localhost-only). To hit it from the phone you'll need the host LAN IP and the port bound to `0.0.0.0` (a local override, not the committed compose). Fine for 5.1's **unauthenticated** smoke.
- **`Secure`-cookie wall (5.2 prerequisite, flagged now):** the `refresh_token` cookie is `Secure`. Chrome accepts `Secure` cookies on `http://localhost` (trustworthy context) but **not** on a plain-`http` LAN IP — so real-device *login* over `http://192.168.x.x:2080` will silently fail to persist a session. That is a transport problem, not an app bug. Real-device auth testing needs **HTTPS to the host** (Caddy local cert, or an ngrok/cloudflared tunnel). Out of scope for 5.1 (smoke is unauthenticated); must be solved before validating 5.2 auth on the phone.

### Library versions (match the proven stack; drop Next-only deps)

Keep the versions already validated against this backend/schema in `bp_front/package.json`:
`@apollo/client` 4.1.9, `graphql` 16.14.0, `graphql-ws` 6.0.8, `@mui/material` 9.0.0, `@mui/icons-material` 9.0.0, `@emotion/react`/`@emotion/styled` 11.14.x, `react`/`react-dom` 19.2.x, `@graphql-codegen/cli` 7.0.0 + client-preset 6.0.0, `@playwright/test` ^1.60.
**Add:** `vite` (latest 7.x), `@vitejs/plugin-react`, `react-router-dom` (7.x, **declarative API** — `<BrowserRouter>`, not `createBrowserRouter`), `typescript` 6.0.x, and the ESLint flat-config stack: `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`.
**Drop:** `next`, `@apollo/client-integration-nextjs`, `@mui/material-nextjs`, `eslint-config-next`, and any Next-only deps. Carry `immutable`, `uuid`, `emoji-picker-react` only if a later story needs them — not required for 5.1.

- Apollo v4 import paths used by the existing code (all valid in plain React): `@apollo/client` (`ApolloLink`, `HttpLink`, `split`, `ApolloClient`, `InMemoryCache`), `@apollo/client/link/subscriptions` (`GraphQLWsLink`), `@apollo/client/link/context` (`SetContextLink`), `@apollo/client/link/error` (`ErrorLink`), `@apollo/client/errors` (`ServerError`, `CombinedGraphQLErrors`), `@apollo/client/utilities` (`getMainDefinition`), `@apollo/client/react` (`ApolloProvider`). When unsure about v4 plain-React client setup, consult the Apollo docs via Context7.

### Anti-patterns to avoid (project rules)

- **No second Apollo client / no second `graphql-ws` client** anywhere — one split-link client, period.
- **Never edit `src/__generated__/`** — always `npm run generate` (needs backend on :2080 + fresh admin JWT in `codegen.ts`).
- **No `localStorage` for the access token** — in-memory only (this is the reframe's explicit security posture; the old app *did* use localStorage and we are deliberately not carrying that).
- **All auth-driven redirects use `replace`**, never `push` (avoids back-button loops).
- **Styling via MUI `theme` + `sx`** — no `style={{}}`, no CSS modules.
- **TS strict** — no `any`; type all props.
- Use `@/` imports, not relative `../` chains.

### Lessons from the superseded frontend (why this epic exists)

The Epic 4 Next.js frontend was delivered **unverifiable**: mobile login broken, no smoke test, **zero E2E tests** (see `epic-4-retro-2026-05-26.md`, `spec-fix-list-golden-path.md`, `spec-fix-new-list-sheet-crash.md`). The `feedback-e2e-in-epics` rule is non-negotiable: **manually validate each flow in a real browser, then write a UI-driven E2E** — no API-only shortcuts. Story 5.1 sets up the harness that makes this enforceable for 5.2–5.7. A foundation story without a passing real-browser smoke test has not met its ACs.

### Project Structure Notes

- New app stays at `bp_front/` (path reused; the *contents* are replaced). Proposed layout (mirror the old app's `lib/`/`app/` separation where sensible, adapted to a Vite SPA):
  ```
  bp_front/
    index.html
    vite.config.ts  tsconfig.json  codegen.ts  playwright.config.ts  package.json
    src/
      main.tsx                 ← mounts <App/> with providers (Theme, Auth, Apollo, Router)
      App.tsx                  ← router definition + guards
      theme.ts
      lib/
        apollo/ApolloProvider.tsx   ← split link + error link (ported)
        auth/authApi.ts             ← fetch REST client (ported)
        auth/AuthContext.tsx        ← in-memory auth state + bootstrap refresh (ported)
      routes/
        RouteGuard.tsx              ← auth guard (ported to react-router)
        AdminGuard.tsx              ← admin guard scaffold
        AuthPage.tsx                ← placeholder (full UI in 5.2)
      __generated__/                ← codegen output (do not edit)
      main.tsx  Dockerfile          ← multi-stage: node build → caddy:2-alpine serves dist/
    e2e/
      smoke.spec.ts
  ```
- The production **`Caddyfile` lives under `routing/`** (honors the architecture's "Caddy added to `routing/`") and is COPYed into the multi-stage frontend image. `docker-compose.yaml` drops the Next `bp_front` service and the nginx `router`.
- **Deliberate decisions (named, not shrugged):**
  - **Dark-theme only.** `design/theme.js` ships light/dark/sepia; 5.1 implements the **dark** palette only (it is the design's own default — `#0d0d10`). Theme switching is post-MVP and explicitly not in scope. `CssVarsProvider` is **not** required (the Epic-4 mandate is superseded) — a plain MUI `ThemeProvider` dark theme is correct.
  - **Admin guard is scaffolded, not feature-tested.** FR31's redirect wrapper exists and the auth guard (FR29) *is* E2E-covered, but the admin-role redirect has no dedicated E2E in 5.1 (no admin UI to land on yet). That coverage lands in Story 5.4. This is a known, accepted gap — not "done."
- Deliberate variance from the Epic-4 architecture: it specified Next.js App Router, `CssVarsProvider`, and localStorage tokens — all **superseded** by the reframe (architecture.md §"Frontend Reframe (Epic 5)"). Use a plain MUI `ThemeProvider` dark theme and in-memory tokens.

### References

- [Source: epics.md#Epic 5 / Story 5.1] — scope & ACs (lines 1701–1752)
- [Source: epics.md#Standing constraints for every Epic 5 story] (lines 1707–1727)
- [Source: architecture.md#Frontend Reframe (Epic 5, 2026-06-23)] (lines 842–876)
- [Source: sprint-change-proposal-2026-06-23.md] — reframe rationale, deferrals, story table
- [Source: prd.md#FR29, FR31, FR53] — auth redirect, admin guard, WS JWT
- [Source: project-context.md] — TS/MUI/Apollo/codegen rules (note: its "Frontend" stack section describes the *old* Next.js app; the reframe supersedes the framework but the TS/lint/MUI-MCP/codegen rules still apply)
- [Source: bp_front/src/lib/{auth/authApi.ts,auth/AuthContext.tsx,apollo/ApolloWrapper.tsx}, app/RouteGuard.tsx] — portable reference implementations
- [Source: lists-feature-reframe/{description.md,diagram.drawio.html}] — UX-source-of-truth + topology
- [Source: design/theme.js, design/Bag Please.html] — palette/typography style reference

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story workflow)

### Debug Log References

- `eslint-plugin-react-hooks@7` flat config: use `reactHooks.configs.flat.recommended` (not `['recommended-latest']`, which is a legacy array-of-strings `plugins` shape).
- `@vitejs/plugin-react@6` requires Vite 8; pinned Vite to `^7.3.5` per story → used `@vitejs/plugin-react@^5`.
- `baseUrl` is deprecated in TS 6; dropped it — `paths` resolves without it under `moduleResolution: bundler`.
- codegen client-preset emits an unused local in `gql.ts` when zero operations exist; excluded `src/__generated__` from tsconfig program roots (still type-checked transitively once imported) so `noUnusedLocals` stays on for app code.
- `playwright.config.ts` runs as ESM (`"type":"module"`) — `__dirname` is undefined; used `webServer.cwd: '..'` (resolved relative to the config file).
- Access tokens are short-lived (~15 min), so `codegen.ts` reads the admin JWT from `CODEGEN_TOKEN` (minted at run time) instead of committing one.

### Completion Notes List

- ✅ All 10 ACs met. New Vite+React+TS SPA replaces the Next.js `bp_front` (directory name reused); old Next source removed.
- ✅ MUI v9 dark theme (`createTheme({palette:{mode:'dark'}})` seeded from `design/theme.js` dark + teal `#4DC9BB`) applied via `ThemeProvider`+`CssBaseline`. v9 theme API confirmed via MUI MCP.
- ✅ Caddy replaces nginx: `routing/Caddyfile` (`/api/subscriptions` before `/api/*`, SPA `try_files` fallback); multi-stage `bp_front/Dockerfile` (node build → `caddy:2-alpine`); `docker-compose.yaml` drops the nginx `router` and Next service, frontend service binds `127.0.0.1:2080:80`.
- ✅ Apollo split link ported to plain React (`src/lib/apollo/ApolloProvider.tsx`): WS vs HTTP split, `SetContextLink` auth, `ErrorLink` 401→silent-refresh→retry-once→`clearAuth`+`navigate('/auth?expired=1',{replace})`; `clearAuth` disposes the graphql-ws client before clearing state. All Next/SSR pieces dropped.
- ✅ In-memory `AuthContext` (no localStorage) + fetch `authApi` ported; bootstrap `getConfig`+`refresh` on mount, `parseJwt` for identity.
- ✅ React Router (declarative) shell + `RouteGuard` (FR29, `replace` redirect, renders nothing while `isLoading`) + `AdminGuard` scaffold (FR31) + `/auth` placeholder.
- ✅ `codegen.ts` (client-preset) retargeted to the Vite tree; `npm run generate` succeeds (base types only); stale `codegen.yml` removed.
- ✅ Playwright harness against the **production image** on :2080, two projects (Desktop Chrome + Pixel 7); `e2e/smoke.spec.ts` 3 UI-driven tests × 2 viewports = **6 passed**.
- ✅ Manual real-browser validation done via Playwright MCP (unauthenticated `/`→`/auth`, deep-link `/lists/123`→`/auth`, authenticated bootstrap→Home, dark theme on a mobile viewport). The only console "error" on the auth screen is the expected `401` from the silent `/api/auth/refresh` probe (browser network log, not an app exception).
- ⚠️ Real Android device validation (the "where available" manual aid) was not performed — no physical device in this environment. The emulated Pixel-7 Playwright project is the automated mobile gate and passes. The `Secure`-cookie-over-LAN-HTTP wall (a 5.2 prerequisite) is documented in the story but out of scope here (5.1 smoke is unauthenticated).
- Verification: `npm run lint` ✓, `npm run build` (`tsc -b && vite build`) ✓, `npm run test:e2e` 6/6 ✓, `docker compose up -d --build` serves :2080 with `/api` proxy + SPA deep-link fallback ✓.

### File List

**New (frontend SPA):**
- `bp_front/index.html`
- `bp_front/vite.config.ts`
- `bp_front/tsconfig.json`, `bp_front/tsconfig.app.json`, `bp_front/tsconfig.node.json`
- `bp_front/eslint.config.mjs` (rewritten as flat config)
- `bp_front/.gitignore` (rewritten)
- `bp_front/public/favicon.svg`
- `bp_front/src/main.tsx`
- `bp_front/src/App.tsx`
- `bp_front/src/vite-env.d.ts`
- `bp_front/src/theme.ts`
- `bp_front/src/lib/apollo/ApolloProvider.tsx`
- `bp_front/src/lib/auth/authApi.ts`
- `bp_front/src/lib/auth/AuthContext.tsx`
- `bp_front/src/routes/RouteGuard.tsx`
- `bp_front/src/routes/AdminGuard.tsx`
- `bp_front/src/routes/AuthPage.tsx`
- `bp_front/src/routes/HomePage.tsx`
- `bp_front/src/routes/AdminPage.tsx`
- `bp_front/e2e/smoke.spec.ts`

**Modified / replaced:**
- `bp_front/package.json`, `bp_front/package-lock.json` (Vite/React/Apollo/MUI/Router/Playwright deps; Next deps dropped; `allowScripts` for esbuild added by npm)
- `bp_front/Dockerfile` (multi-stage node build → `caddy:2-alpine`)
- `bp_front/codegen.ts` (env-var token; `CodegenConfig`)
- `bp_front/playwright.config.ts` (prod image :2080, two viewports)
- `bp_front/src/__generated__/{gql.ts,graphql.ts,fragment-masking.ts,index.ts}` (regenerated)
- `routing/Caddyfile` (new; replaces nginx)
- `docker-compose.yaml` (drop nginx router + Next service; add multi-stage frontend on :2080)
- `.dockerignore` (new, repo root)
- `mise.toml` (Next→Vite tasks; infra = mongo + bp_back)
- `CLAUDE.md` (frontend/routing/codegen sections → Vite + Caddy)

**Removed (old Next.js app + nginx):**
- `routing/nginx.conf`, `routing/Dockerfile`
- `bp_front/next.config.mjs`, `bp_front/codegen.yml`, `bp_front/README.md`, `bp_front/issues.md`, `bp_front/.editorconfig`, `bp_front/.gitattributes`, `bp_front/public/{next,vercel}.svg`, `bp_front/src/app/favicon.ico`
- old `bp_front/src/app/**` (Next App Router pages/components incl. old `RouteGuard.tsx`, `ThemeRegistry.tsx`, BP* components)
- old `bp_front/src/lib/{apollo/ApolloWrapper.tsx,theme.ts,**/Queries.tsx}`, `bp_front/src/contexts/SRContext.tsx`
- old `bp_front/e2e/*.spec.ts` + `auth.setup.ts`

### Change Log

- 2026-06-24: Implemented Story 5.1 — Vite + MUI + Caddy + Apollo foundation. Replaced the Next.js frontend and nginx proxy with a Vite/React SPA served by Caddy; ported auth/Apollo/router as a plain-React in-memory-auth shell; added a production-parity Playwright smoke suite (desktop + mobile). Status → review.
