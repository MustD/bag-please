---
baseline_commit: a3fdd3542a2e31658fb86c74dda3822c9136fc14
---

# Story 5.2: Authentication

Status: done

**Delivers:** FR1–FR4, FR6–FR10, FR21, FR27, FR32, FR33. **Excludes FR5** (one-time welcome message → Story 5.3),
FR11–FR12 (identity/change-password UI → Story 5.3), FR13–FR20 & FR30–FR31 (admin user mgmt + registration-toggle UI →
Story 5.4). The skipped number in the range is intentional — FR5 is **not** in scope here.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an unregistered or returning user,
I want to register, log in, stay signed in, and log out,
so that I can access my own account securely.

## Acceptance Criteria

1. **Auth page login (FR2, FR27):** `/auth` renders a login form (username + password). Submitting valid credentials
   authenticates the user and lands them in the app at `/`. On **any** authentication failure the UI shows a single,
   non-distinguishing error — "Invalid username or password" — inline on the form (never a toast/Snackbar/modal).
   Empty-field validation shows inline field errors before a request is made.
2. **Rate-limit feedback (NFR6):** when the backend throttles auth attempts (HTTP 429), the form surfaces a distinct,
   calm message ("Too many login attempts. Please try again later.") instead of the generic credential error.
3. **Register → auto-login (FR1, FR4):** a registration form (username + password) creates the account and, on success,
   **authenticates the user in the same action without a separate user-facing login step**, redirecting into the app at
   `/`. Registration failures surface the backend's error message inline (e.g. "Invalid credentials" for a
   taken/reserved username, "Registration is disabled").
4. **Conditional Register affordance (FR21, FR32):** the Register link/mode is shown **only when public registration is
   enabled**. When registration is disabled (or its state is not yet known), the Register affordance is hidden and "
   Contact your admin" guidance is shown instead. The auth page reflects the current server config on each visit (does
   not require an app reload).
5. **Logout (FR3, FR10):** an authenticated user can log out from the app shell; logout invalidates the server session (
   refresh token) and clears in-memory auth state, returning the user to `/auth`.
6. **Silent token refresh (FR6, FR7, FR8):** an expired short-lived access token is renewed via the refresh endpoint
   with no user interaction (this plumbing already exists from Story 5.1 — this story must verify it works end-to-end
   once a session is real).
7. **Session-expiry message (FR9, FR33):** when the session can no longer be refreshed, the user is returned to the
   login screen showing a specific session-expiry message ("Your session has expired. Please sign in again."). The
   message is keyed off the `/auth?expired=1` redirect the guard/error-link produces, uses `role="alert"`, and clears
   when the user starts typing or navigates away. **Scope decision:** the full Apollo-driven path (401 → silent
   refresh → refresh-fail → `clearAuth(true)` → redirect) must be **wired correctly and verified by hand** in this
   story, but its **automated end-to-end E2E is deferred to the first query-bearing story** (5.5/5.6) because 5.2 issues
   no GraphQL query to trigger a 401. 5.2's automated coverage is the banner-contract test (below); this is tracked
   debt, not "FR9 fully E2E-covered."
8. **Accessibility (NFR10, NFR13–NFR16):** all fields have visible associated labels; the form submits on **Enter**; the
   form is fully keyboard-navigable; error messages are programmatically associated with their fields; auth screens
   render on mobile with no layout shift.
9. **E2E coverage (reframe rules 1 & 2):** every flow above ships a **UI-driven** Playwright test (no API shortcuts
   except environment prep), FR-mapped in describe/test names, passing on **both** the `chromium` and `mobile` (Pixel 7)
   projects against the Caddy-served production image on `:2080`. The flow must be manually exercised in a real browser
   first.

## Tasks / Subtasks

- [x] **Task 1 — Build the `/auth` UI in `AuthPage.tsx`** (AC: #1, #3, #4, #8)
    - [x] Single-page auth with two modes on one route: **Sign in** (default) and **Create account**; a link toggles
      between them. The "Create account" toggle is rendered **only** when registration is enabled (see Task 4).
    - [x] Both forms: `TextField` username + password (`type="password"`), full-width primary submit button; native
      `<form onSubmit>` so **Enter submits**; disable submit while a request is in flight (loading state on the button).
    - [x] Preserve `data-testid="auth-page"` on the root container (smoke tests depend on it). Add stable testids:
      `login-username`, `login-password`, `login-submit`, `register-username`, `register-password`, `register-submit`,
      `to-register-link`, `to-login-link`, `auth-error`, `contact-admin`, `session-expired-alert`.
    - [x] Layout per UX "Edge-to-Edge": form sits directly on the dark background — **no `Paper`/card wrapper** —
      centered column, `maxWidth: 360` on desktop, edge-to-edge with horizontal padding on mobile. Style with theme +
      `sx` only.
- [x] **Task 2 — Wire login** (AC: #1, #2)
    - [x] On submit: `await authApi.login(username, password)`; derive validated identity from `parseJwt(accessToken)`;
      call `setAuth({ username, role, accessToken })`. Do **not** manually navigate — `RouteGuard` moves the
      now-authenticated user off `/auth`; use `navigate('/', { replace: true })` only if a same-route re-render doesn't
      redirect (verify during manual exercise).
    - [x] Render the thrown error message in the `auth-error` region: `authApi.login` already maps 429 → "Too many login
      attempts…" and every other failure → "Invalid username or password" (uniform, FR27) — surface `err.message`
      verbatim; do **not** add a second message source.
- [x] **Task 3 — Wire register → auto-login** (AC: #3)
    - [x] On submit: `await authApi.register(username, password)`. **`register` returns `{ username, role }` with
      NO `accessToken` and sets NO cookie** — so immediately chain `await authApi.login(username, password)` to
      establish the session, then `setAuth(...)` exactly as in Task 2. This is how FR4 "no separate login step" is met.
    - [x] If `register` throws, show `err.message` in `auth-error` and stay in register mode (do not attempt login). If
      `register` succeeds but the chained `login` throws (rare — e.g. throttle), show a recoverable error and switch to
      Sign-in mode so the user can complete manually.
- [x] **Task 4 — Config-driven Register affordance + null handling** (AC: #4)
    - [x] On `AuthPage` mount, fetch `authApi.getConfig()` into local component state (retry once on failure). Treat the
      result as: `true` → show Register toggle; `false` or unresolved/failed → hide Register toggle and show
      `contact-admin` guidance ("Contact your admin to request access"). This resolves the Story 5.1 deferral (null
      `registrationEnabled`) and makes the auth page reflect the toggle on each visit.
    - [x] Do not rely solely on `useAuth().registrationEnabled` (fetched once at app bootstrap, may be stale/null); the
      auth page owns its own fresh read.
- [x] **Task 5 — Session-expiry banner** (AC: #7)
    - [x] Read `expired` from the URL via `useSearchParams()`; when `expired === '1'`, render
      `<Alert severity="warning" role="alert" data-testid="session-expired-alert">Your session has expired. Please sign in again.</Alert>`
      at the top of the form, above the heading.
    - [x] Clear the banner when the user starts typing in any field (and it naturally disappears on navigation).
      Removing the `expired` search param on first input is acceptable.
- [x] **Task 6 — Logout control** (AC: #5)
    - [x] Add a minimal logout affordance to the authenticated shell (`HomePage.tsx`) with
      `data-testid="logout-button"`. Handler: `await authApi.logout(); clearAuth();` — `clearAuth()` sets
      `username=null`, which makes `RouteGuard` redirect to `/auth`; the Apollo wrapper disposes the WS client as part
      of the `clearAuth` sequence. Do not navigate manually.
    - [x] Scope note: proper nav with the username label is **Story 5.3** — keep this to a functional logout button
      only.
- [x] **Task 7 — E2E tests** (AC: #9) — see **Testing requirements** below for the full spec, env-prep, and the resolved
  registration-toggle config-mock strategy.
    - [x] Manually exercise each flow in a real browser (Playwright MCP) on `:2080` first; then author
      `bp_front/e2e/auth.spec.ts`.
    - [x] Cover: (1) register → auto-login → logout → log back in; (2) session-expiry message on `/auth?expired=1` +
      clears on typing; (3) registration-disabled hides the Register link and shows contact-admin guidance. Run and pass
      on both projects.
- [x] **Task 8 — Verify silent-refresh & terminal-logout paths** (AC: #6)
    - [x] Confirm the Story 5.1 Apollo 401 → silent-refresh → retry, and the terminal `clearAuth(true)` →
      `/auth?expired=1` paths behave correctly now that a real authenticated session exists (these were built but never
      exercised authenticated). See **Previous story intelligence**.

## Dev Notes

### Scope boundary — build exactly this, no more

**In scope (5.2):** login UI, register UI + auto-login, config-driven Register link / contact-admin guidance, logout
control, session-expiry banner (`?expired=1`), uniform error + rate-limit feedback, silent-refresh verification, E2E.

**Out of scope — do NOT build here:**

- **One-time welcome message (FR5)** — belongs to **Story 5.3**, not 5.2. Although 5.2's FR range shorthand ("FR1–FR10")
  numerically includes FR5, the welcome banner is **not** in 5.2's AC bullets and is explicitly an AC of Story 5.3. Do
  not build it now.
- **Username shown in app navigation (FR12)** and the proper app bar/nav — **Story 5.3**. 5.2 adds only a minimal logout
  button.
- **Admin registration-toggle UI / users table (FR13–FR20, FR30, FR31)** — **Story 5.4**. 5.2 only *reads* the public
  `/api/auth/config` flag.
- **Change-password screen (FR11)** — **Story 5.3** (the `authApi.changePassword` client already exists; leave it).
- **Any backend change.** The auth API is consumed as-is. If you believe a backend change is needed, stop and confirm
  with `md` (reframe rule 2).

### The register→auto-login flow (the one non-obvious contract)

`POST /api/auth/register` returns **`{ username, role }` only — no `accessToken`, and it does NOT set
the `refresh_token` cookie.** Therefore you cannot populate a session from the register response, and calling
`refresh()` after register will fail (no cookie yet). **You must chain `authApi.login(username, password)` after a
successful `authApi.register(...)`** to obtain the access token + set the refresh cookie. From the user's perspective
this is a single "Create account" action (FR4 satisfied); the client just does two calls.

### Auth API contract — consume UNCHANGED (backend is the system of record)

All paths are under `/api` (Ktor `rootPath: api`). JSON via Jackson. Access token held **in memory only** — never
`localStorage`.

| Call     | Method / Path             | Request                  | Success                                                                                                                      | Failure                                                                                                               |
|----------|---------------------------|--------------------------|------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| Config   | `GET /api/auth/config`    | none                     | `200 { registrationEnabled: boolean }` (default **false**)                                                                   | non-OK → `authApi.getConfig` throws                                                                                   |
| Register | `POST /api/auth/register` | `{ username, password }` | `200 { username, role }` — **no token, no cookie**                                                                           | `403 { error:"Registration is disabled" }`; `400 { error:"Invalid credentials" }` (taken/reserved username — uniform) |
| Login    | `POST /api/auth/login`    | `{ username, password }` | `200 { accessToken, username, role }` + `Set-Cookie: refresh_token` (httpOnly, Secure, SameSite=Strict, Path=/api/auth, 30d) | `401 { error:"Invalid credentials" }` (uniform — unknown user & wrong password identical, FR27); `429` (rate limit)   |
| Refresh  | `POST /api/auth/refresh`  | none (reads cookie)      | `200 { accessToken }` — refresh token **not** rotated                                                                        | `401` missing/invalid/expired                                                                                         |
| Logout   | `POST /api/auth/logout`   | none (reads cookie)      | `200`, clears cookie, deletes server-side token                                                                              | never throws (`authApi.logout` swallows)                                                                              |

- **Access token TTL ≈ 15 min** (`KTOR_JWT_ACCESS_EXPIRY_MINUTES=15`), refresh/cookie 30 days. (CLAUDE.md's "7-day" note
  is outdated.) There is **no `me` GraphQL query** — identity comes from decoding the JWT (`parseJwt`).
- Uniform-credential handling is already baked into `authApi.login`: it throws `"Invalid username or password"` for any
  non-429 failure (it does not read the response body) and `"Too many login attempts. Please try again later."` for 429.
  Surface `err.message` directly.

### Reuse what Story 5.1 already built — do NOT reimplement

These exist and are complete; import and consume them:

- **`bp_front/src/lib/auth/authApi.ts`** — `login`, `register`, `logout`, `refresh` (single-flight, 8s abort),
  `getConfig`, `changePassword`. All error handling done.
- **`bp_front/src/lib/auth/AuthContext.tsx`** — `useAuth()` exposes
  `{ username, role, accessToken, setAuth(state), clearAuth(expired?), isLoading, registrationEnabled, expired }`.
  `setAuth` resets `expired`; `clearAuth(true)` marks expiry. Bootstraps `getConfig()` + silent `refresh()` on mount (no
  `localStorage`).
- **`bp_front/src/lib/auth/jwt.ts`** — `parseJwt(token): { username, role:'admin'|'user' } | null` (validated; use it to
  get the typed `role` for `setAuth`).
- **`bp_front/src/lib/apollo/ApolloProvider.tsx`** — one split-link Apollo client; ErrorLink does 401 → single silent
  refresh → retry → else `clearAuth(true)`; disposes graphql-ws before clearing. **Never create a second Apollo or
  graphql-ws client.**
- **`bp_front/src/routes/RouteGuard.tsx`** — redirects unauthenticated users to `/auth` (or `/auth?expired=1` when
  `expired`), `replace`. Single owner of that redirect. `AdminGuard.tsx` scaffolded (admin UI is 5.4).
- **`bp_front/src/theme.ts`** — dark-only MUI theme. Palette: `background.default #000`, `paper #1C1C1E`,
  `primary.main #4DC9BB` (teal), `error #FF453A`, `text.secondary rgba(235,235,245,0.6)`. Buttons `borderRadius 8`,
  `textTransform:none`; TextField default `variant:"outlined"`. Use theme + `sx` only.

### Project conventions (from project-context + Story 5.1)

- **TS strict, no `any`**; all props typed. Path alias **`@/` → `src/`** — no `../` chains.
- **Styling via MUI `sx` + theme only** — no `style={{}}`, no CSS modules, no `className` styling.
- **One default component export per file**; PascalCase component files.
- Router is **declarative** React Router 7 (`<BrowserRouter>` + `<Routes>`), effect-based redirects via `useNavigate`. *
  *All auth-driven redirects use `replace`, never `push`.**
- **No `console.log`** in components (ApolloProvider logs intentionally; nowhere else).
- **Never edit `src/__generated__/`.** This story is REST-only (`/api/auth/*`) and adds **no** GraphQL operations, so
  codegen is untouched.
- Use MUI MCP (`mcp__mui-mcp__fetchDocs` / `useMuiDocs`) before writing MUI v9 components — do not guess v9 API from
  v5/6 memory. Components you'll use: `TextField`, `Button`, `Box`/`Stack`, `Typography`, `Alert`, `Link`,
  `FormHelperText`, `CircularProgress`.

### UX / visual reference

- **Visual style reference only:** `design/Bag Please.html` (+ `design/*.jsx`, `theme.js`, `Bag Please — Design.pdf`) —
  palette/typography/look-and-feel. **Not a functional prototype**; behavior comes from these ACs, not the mockup.
- **Auth screen pattern (GitHub-style, "ambient identity"):** two fields, full-width submit, submit on Enter, inline
  errors, no CAPTCHA, no multi-step, no password-complexity rules, no modal auth. Auth succeeds once and disappears.
- **Errors:** inline, calm, honest, immediate (no artificial delay). Form-level auth error in the `auth-error` region
  below the submit button; field-empty validation via `FormHelperText`/`error`. **No Snackbar/toast for auth errors.**
- **Session-expiry:** top-of-form `Alert severity="warning"` shown only on the expiry redirect; auto-clears on
  typing/navigation.
- **Contact-admin guidance:** shown when registration is disabled/unknown — "Contact your admin to request access."

### Error handling & uniform message (FR27)

Login must be **non-distinguishing**: same message for unknown username and wrong password. `authApi.login` already
guarantees this. Do not attempt to read or reveal the backend's `{error}` body for login. For **register**, surfacing
the backend `error` (e.g. "Registration is disabled") is correct and expected.

### Config `null` handling (explicit Story 5.1 → 5.2 carry-over)

Story 5.1 deferred: "`getConfig()` failure leaves `registrationEnabled` stuck at `null` with no retry — handle
null/retry in the auth screen (5.2)." Implement in Task 4: local fetch on mount, retry once, and treat unresolved/failed
as "registration off" (hide Register, show contact-admin) — the safe default. Never render a broken/half state.

### Testing requirements (E2E — reframe rules 1 & 2)

**Framework/topology:** Playwright, `bp_front/e2e/`, `npm run test:e2e`. `baseURL http://localhost:2080` (Caddy-served
production image; `webServer` runs `docker compose up -d --build`). **Two projects: `chromium` + `mobile` (Pixel 7);
mobile is mandatory** — Epic 4's regression was mobile-only. UI-driven only; API allowed **only for environment prep**.
FR-map in `describe`/`test` names. Follow the existing `smoke.spec.ts` style (`getByTestId`, URL regex assertions).

**Scenarios (new `bp_front/e2e/auth.spec.ts`):**

1. **`FR1/FR4/FR2/FR3/FR10 — register → auto-login → logout → log back in`:** requires registration enabled (env prep —
   see below). Register a **unique** username per run (e.g. `mia_e2e_${Date.now()}`) → assert landed authenticated (
   `home-page` visible, "Signed in as <user>") → click `logout-button` → assert back on `auth-page` at `/auth` → sign in
   again with the same creds → assert authenticated again. Assert only on the user this test created (the DB volume
   `./db/data` persists across runs — do not assume a clean DB, mirror the backend "assert only what you created /
   unique IDs" rule).
2. **`FR8/FR9/FR33 — session-expiry banner (contract-only)`:** navigate to `/auth?expired=1` → assert
   `session-expired-alert` visible with text containing "session has expired" → type into a field → assert the alert
   disappears. This is deliberately the **banner + param contract**, not the full expiry path — see the AC #7 scope
   decision. The full Apollo-driven 401→refresh-fail→redirect is **wired and hand-verified** now (Task 8) and gets
   automated E2E in the first query-bearing story. Do **not** manufacture a throwaway query just to force a 401 here.
3. **`FR21/FR32 — registration-disabled hides Register link (config-mocked)`:** use
   `page.route('**/api/auth/config', r => r.fulfill({ json: { registrationEnabled: false } }))` to make the auth page
   render its disabled state, then load `/auth` → assert no `to-register-link` and that `contact-admin` guidance is
   visible. This mocks **only the config read** (the input to a conditional render) — it does **not** mutate the shared
   backend flag and does **not** mock the thing under test. Runs on both projects, fully parallel, race-free. The *real*
   `/api/auth/config` read is exercised for real by Scenario 1 (registration must genuinely be enabled for the register
   call to succeed), so the live integration stays covered.

**Environment prep (allowed — "API for env prep only"):** registration defaults to **`false`** and is persisted in
Mongo (`ApplicationConfig`), so it is **not** enabled by default. To make Scenario 1 deterministic, **enable
registration once for the whole suite** via the admin GraphQL API and leave it on: `POST /api/auth/login` as
`admin/admin` → use the token to run mutation `setRegistrationEnabled(enabled:true)` against `/api/graphql`. A
Playwright `globalSetup` (or a setup-project dependency) is the home for this. Because `./db/data` persists across
compose runs, make this idempotent (set to true; don't assume a starting value).

**Registration-toggle E2E — resolved strategy (no global-state race).** `registrationEnabled` is a single Mongo document
shared by every worker, and the two projects (`chromium` + `mobile`) run concurrently against one backend — so **no test
toggles it mid-run.** Instead the concern is split cleanly:

- **Real integration → Scenario 1:** global-setup enables registration once and leaves it **on**; the register flow hits
  the real `/api/auth/config` (must be truly enabled to succeed). The live config read is covered here, for real, on
  both projects.
- **Conditional-render logic → Scenario 3:** `page.route`-mock the `/api/auth/config` response to
  `{ registrationEnabled: false }` and assert the UI hides the Register link + shows contact-admin. This touches **no**
  shared state, so it runs fully parallel on both projects with zero race.
- **The one law:** mock only the *input to a render* (the config read). **Never** mock the thing under test —
  `/api/auth/login` and `/api/auth/register` stay real in every test. Faking a session via `page.route` is forbidden.

Rationale: the race isn't *managed*, it's *deleted* — you cannot flake on a global flag no test ever writes.

**`Secure`-cookie / real-device caveat (from Story 5.1):** the `refresh_token` cookie is `Secure`. Chrome accepts it on
`http://localhost` (so Playwright + the `:2080` image + Vite dev are fine), but **not** on a plain-`http` LAN IP —
real-device login over `http://192.168.x.x:2080` silently fails to persist a session. Real-device auth validation needs
HTTPS to the host (Caddy local cert or a tunnel). **Ownership:** the emulated Pixel-7 project is the mandatory
*automated* mobile gate for this story; the real-device auth check is owned by **`md` as a manual sign-off** (not
automated here). The dev agent is not blocked on it — deliver the emulator gate green; md verifies a physical device by
hand.

**Rate-limit note:** `docker-compose.yaml` sets `KTOR_RATE_LIMIT_ATTEMPTS: 6000`, so the E2E suite will not naturally
trip the 429 path. The 429 UI branch (AC #2) still must exist (`authApi.login` maps it), but exercising it in E2E would
require lowering the limit — treat automated 429 coverage as out of scope; verify the branch manually if desired.

### Previous story intelligence (Story 5.1 — done) — review items that land in 5.2

Story 5.1 fixed several bugs whose symptoms are "only visible once Story 5.2 lands." Verify each now that a real session
exists:

- **Silent-refresh retry / terminal-logout was dead code until now** — the Apollo 401 → refresh → retry path and the
  `clearAuth(true)` → `/auth?expired=1` terminal path were never exercised authenticated in 5.1's unauthenticated smoke.
  **Task 8 must verify them.**
- **`RouteGuard` used to strip `?expired=1`** (fixed): when `clearAuth()` fires, the error link navigates to
  `/auth?expired=1`, but the `username=null` re-render triggered the guard's own `navigate('/auth')` and clobbered the
  param. The fix must hold — **confirm the `expired` param survives to render the banner (AC #7).**
- **`getConfig()` null with no retry** — explicitly deferred to this story (Task 4).
- Bootstrap refresh has an 8s abort (hang-safety); `parseJwt` is the shared validated helper — reuse it, don't re-decode
  inline.
- Established patterns to keep: one Apollo/one graphql-ws client; in-memory token only; `replace` redirects; dark theme;
  declarative router.

### Git intelligence

Recent history is the Epic 5 reframe groundwork: `51fcc32 chore(epic5): reframe frontend architecture` (docs),
`3433bf8` (Dockerfile/compose + Caddy), `a3fdd35 chore: remove outdated e2e tests, frontend configurations, and assets`.
The tree is the fresh Vite scaffold from Story 5.1 — no legacy Next.js code remains. Follow the 5.1 file conventions
exactly (see file layout above).

### Library / framework versions (exact — `bp_front/package.json`)

React 19.2.5 · react-router-dom ^7.9.0 · @apollo/client 4.1.9 (v4 import paths: `@apollo/client`,
`@apollo/client/react`) · graphql-ws 6.0.8 · **MUI @mui/material 9.0.0** + @mui/icons-material 9.0.0 + @emotion 11.14 ·
Vite ^7.3.5 · TypeScript 6.0.3 · @playwright/test ^1.60.0. Dev proxy (`vite.config.ts`): `/api` →
`http://localhost:4000`, `/api/subscriptions` → `ws://localhost:4000`. Auth is REST — no codegen impact.

### Project Structure Notes

- **New file:** `bp_front/e2e/auth.spec.ts`; possibly `bp_front/e2e/global-setup.ts` (or a setup project) for enabling
  registration; wire it in `playwright.config.ts` if used.
- **Modified files:** `bp_front/src/routes/AuthPage.tsx` (placeholder → full auth UI),
  `bp_front/src/routes/HomePage.tsx` (add logout button).
- **No changes** to: `AuthContext.tsx`, `authApi.ts`, `jwt.ts`, `ApolloProvider.tsx`, `RouteGuard.tsx`, `App.tsx`,
  `theme.ts`, `src/__generated__/`, or anything in `bp_back/`. If you find yourself editing these, re-read the scope
  boundary.
- No conflicts with the unified structure: this story is additive UI on the existing shell.

### References

- Epic & ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2: Authentication (lines 1754–1774)] and Epic 5
  standing constraints (lines 1707–1727).
- FR
  text: [Source: _bmad-output/planning-artifacts/prd.md#Requirements FR1–FR10, FR21, FR27, FR32, FR33 (lines 524–579)];
  NFR4/6/10/13–16 (lines 668–695).
- Auth API surface: `bp_back/.../features/auth/AuthRoutes.kt`, `AuthService.kt`, `UserService.kt`, `dto/*`;
  `plugins/RateLimiting.kt`, `plugins/Security.kt`; `config/gql/ApplicationConfigApi.kt`;
  `src/main/resources/application.yaml`.
- Frontend foundation: `bp_front/src/lib/auth/*`, `bp_front/src/lib/apollo/ApolloProvider.tsx`, `bp_front/src/routes/*`,
  `bp_front/src/theme.ts`, `bp_front/e2e/smoke.spec.ts`, `bp_front/playwright.config.ts`, `bp_front/vite.config.ts`.
- Prior story +
  learnings: [Source: _bmad-output/implementation-artifacts/5-1-foundation-vite-mui-caddy-apollo-shell.md].
- UX behavior (apply behavior, not old Next.js
  paths): [Source: _bmad-output/planning-artifacts/ux-design-specification.md — auth screens, error/expiry/contact-admin copy].
-
Config: [Source: docker-compose.yaml (KTOR_RATE_LIMIT_ATTEMPTS=6000, MIGRATION_TARGET_USER=mia)]; [Source: CLAUDE.md — note the 7-day JWT claim is stale; real access TTL is 15 min].

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — BMad dev-story workflow.

### Debug Log References

- **Uncaught login error (found during manual exercise, fixed):** the initial
  `handleSubmit` wrapped only the register branch's calls in `try/catch`; the
  outer block had `try { … } finally { setLoading(false) }` with **no `catch`**.
  A failed login therefore threw out of the handler (surfaced in the console as
  `Error: Invalid username or password`) instead of populating the `auth-error`
  region. Fixed by wrapping the login branch in its own `try/catch` that calls
  `setAuthError(err.message)`. Re-verified in-browser: the uniform error now
  renders with `role="alert"`. This is exactly the class of bug the "manually
  exercise first" rule exists to catch.

### Completion Notes List

Implemented the full `/auth` experience on the Story 5.1 Vite/MUI/Caddy shell —
no backend changes, no new GraphQL operations (REST `/api/auth/*` only), so
codegen and `src/__generated__/` are untouched.

- **AC #1 (login + uniform error):** `AuthPage` login mode; empty-field inline
  validation before any request; `authApi.login`'s uniform `err.message`
  surfaced verbatim in the `auth-error` region (`role="alert"`, never a toast).
- **AC #2 (rate limit):** 429 branch is carried by `authApi.login` ("Too many
  login attempts…") and surfaced through the same region. Automated 429 E2E is
  out of scope (limit is 6000 in compose) — branch verified by code path.
- **AC #3 (register → auto-login):** register then chain login; register-only
  failures stay in register mode with the backend message; the rare
  register-ok/login-fail case switches to Sign-in with a recoverable message.
- **AC #4 (conditional Register):** `AuthPage` owns a fresh `getConfig()` read
  (retry once, fall back to "off"); `true` → `to-register-link`, otherwise
  `contact-admin`. Manually verified both states by toggling the backend flag.
- **AC #5 (logout):** minimal `logout-button` on `HomePage`; `authApi.logout()`
  then `clearAuth()` → RouteGuard redirects to `/auth`. Verified the server
  session is invalidated (post-logout reload does not restore the session).
- **AC #6 (silent refresh):** verified end-to-end — a full page reload while
  authenticated re-establishes the session via the httpOnly refresh cookie with
  no user interaction and stays on `/`.
- **AC #7 (session-expiry):** `?expired=1` renders the warning `Alert`
  (`role="alert"`); the param survives RouteGuard (Story 5.1 fix holds); typing
  drops the param and hides the banner. Full Apollo 401→refresh-fail→redirect
  path is wired (5.1 code intact) and hand-verified; its automated E2E is
  deferred to the first query-bearing story per the AC #7 scope decision.
- **AC #8 (a11y):** labelled `TextField`s (label↔input association), Enter
  submits (native `<form onSubmit>`, verified), keyboard-navigable, field errors
  programmatically associated via `helperText`, mobile renders with no layout
  shift (mobile E2E green).
- **AC #9 (E2E):** `bp_front/e2e/auth.spec.ts` — 3 UI-driven, FR-mapped tests;
  `globalSetup` enables registration idempotently; registration-disabled test
  mocks only the config read (no shared-state race). **12/12 passing on both
  `chromium` and `mobile` (Pixel 7).**

Manual real-device HTTPS auth check (Secure cookie over LAN IP) remains **md's**
manual sign-off per the story — not automated here.

### File List

- `bp_front/src/routes/AuthPage.tsx` (rewritten — placeholder → full auth UI)
- `bp_front/src/routes/HomePage.tsx` (modified — added logout control)
- `bp_front/e2e/auth.spec.ts` (new — 3 FR-mapped E2E scenarios)
- `bp_front/e2e/global-setup.ts` (new — idempotent registration-enable env prep)
- `bp_front/playwright.config.ts` (modified — wired `globalSetup`)
- `_bmad-output/implementation-artifacts/5-2-authentication.md` (story tracking)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status → review)

## Change Log

| Date       | Change                                                                                                                                                                                                                                                                                                                                |
|------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 2026-07-15 | Implemented Story 5.2 Authentication: full `/auth` UI (login, register → auto-login, config-driven Register affordance / contact-admin, session-expiry banner, uniform + rate-limit errors), logout control, silent-refresh verification, and E2E (`auth.spec.ts` + `global-setup.ts`) passing on chromium + mobile. Status → review. |

## Review Findings

_Code review 2026-07-15 (bmad-code-review). Acceptance Auditor found no AC violations; scope boundary fully respected. 6
patch, 2 defer, 9 dismissed as noise/by-design._

- [x] [Review][Patch] `canRegister === null` (config still loading) renders the "Contact your admin" branch — on every
  fresh login-mode visit where registration is enabled, users briefly see "Contact your admin to request access." before
  it flips to "Create one." The loading state is incorrectly bucketed with disabled; guard `null` to render
  nothing/placeholder [bp_front/src/routes/AuthPage.tsx:266]
- [x] [Review][Patch] Registration-disabled E2E cannot distinguish "disabled" from "loading/unresolved" — `null` and
  `false` render identically, so the assertions pass even if the config mock never applied; the test does not actually
  prove the disabled branch. Fixing the null-state guard above makes `contact-admin` visibility genuinely prove
  resolved-false, and/or await the mocked response [bp_front/e2e/auth.spec.ts:414]
- [x] [Review][Patch] Username validated with `.trim()` but sent to `authApi.login`/`register` untrimmed — `" mia "`
  passes empty-field validation and is submitted verbatim, creating a whitespace-padded account that only logs in with
  the exact padding. Derive the trimmed username once and use it for both validation and the API
  calls [bp_front/src/routes/AuthPage.tsx:120]
- [x] [Review][Patch] `switchMode()` does not clear the `?expired=1` banner — a user arriving via `/auth?expired=1` who
  clicks "Create one" without typing keeps "Your session has expired…" displayed above the Create-account form. Call
  `clearExpired()` in `switchMode` [bp_front/src/routes/AuthPage.tsx:91]
- [x] [Review][Patch] Expiry-banner E2E never asserts the `?expired` param is dropped after typing — a regression where
  the banner hides but the param persists (re-showing on re-render) would pass. Add
  `await expect(page).toHaveURL(/\/auth$/)` after typing [bp_front/e2e/auth.spec.ts:409]
- [x] [Review][Patch] No same-tick re-entry guard on `handleSubmit`, and the logout button has no in-flight disabled
  state — `setLoading(true)` only disables the form on the next render, so two rapid Enter presses both enter
  `handleSubmit` (double register/login); the logout button can be double-clicked. Add `if (loading) return` and a
  pending/disabled state on logout [bp_front/src/routes/AuthPage.tsx:128, bp_front/src/routes/HomePage.tsx:9]
- [x] [Review][Defer] `authApi.logout` has no timeout/abort (unlike `refresh`) — a hung (not refused) backend leaves
  `handleLogout`'s `await` unresolved, so `clearAuth()` never runs and the user cannot log
  out [bp_front/src/lib/auth/authApi.ts:24] — deferred, pre-existing (root fix belongs in `authApi.ts`, explicitly out
  of scope for 5.2)
- [x] [Review][Defer] An already-authenticated user navigating to `/auth` (bookmark/back/manual URL) sees the sign-in
  form instead of being redirected to `/` — `/auth` is public and outside `RouteGuard` [bp_front/src/App.tsx:12] —
  deferred, pre-existing (Story 5.1 routing design; not a 5.2 AC)
