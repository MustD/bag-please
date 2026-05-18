# Deferred Work

## Deferred from: code review of 3-2-e2e-test-coverage-admin-panel (2026-05-18)

- `webServer` has no teardown command — containers started by `docker compose up -d` during the test suite are never
  stopped; on CI this accumulates running containers across runs
- `webServer` `url` health check only verifies nginx responds on port 2080, not that Ktor or Next.js are fully ready
  inside containers; first tests may encounter 502 until backend warms up
- `webServer` has no `stdout`/`stderr` filtering — on compose startup failure Playwright silently waits the full 120 s
  timeout before surfacing the error
- AC1 page-reload assertion absent — the spec calls out "without a page reload" but asserting absence of navigation in
  Playwright requires a `framenavigated` listener; deferred as impractical at current test scope
- Orphaned test users from guard tests (`guardtest_*`, `guardnav_*`) accumulate in DB per run — accepted same-pattern as
  `auth.spec.ts`; clean dev DB periodically

## Deferred from: code review of 3-1-deferred-work-triage-high-priority-fixes (2026-05-15)

- Concurrent test in `UserRegistrationTest.kt` may only verify sequential duplicate-rejection; Ktor `testApplication`
  may serialize requests on a single-threaded engine, making the TOCTOU proof vacuous; MongoDB unique index is the real
  protection and the test still has regression value
- Permanent blank page if auth config fetch permanently fails: `AuthContext` swallows `getConfig` errors silently,
  leaving `registrationEnabled === null` forever; `/auth/register` shows a blank page indefinitely with no error message
- Authenticated users can navigate to `/auth/register` and overwrite their session: `RegisterLayout` checks only
  `registrationEnabled`, not auth state; an authenticated admin reaching `/auth/register` and submitting can overwrite
  their own JWT with a newly registered user token

## Deferred from: code review of 2-4-registration-toggle-ui-adaptive-login-screen (2026-05-15)

- `/auth/config` shares auth rate-limit bucket with `/auth/login` — page-load requests consume login quota per IP;
  intentional per spec placement; revisit rate-limit config if exhaustion observed in production
- `registrationEnabled` stays `null` permanently on `GET /api/auth/config` network failure — spec-accepted silent
  failure; both Register link and "Contact admin" are suppressed while null; may confuse users on transient backend
  outage
- `/auth/register` page directly accessible when registration is disabled — backend correctly rejects POST but user sees
  full form and gets no useful error message; frontend route guard is a follow-up UX enhancement
- `ApplicationConfigService` in-memory cache can diverge from MongoDB if DB write fails after `cache.set` succeeds —
  backend pre-existing issue; process restart recovers; fix with transactional write or cache invalidation on error

## Deferred from: code review of 2-3-admin-user-management-ui (2026-05-15)

- Client-side-only admin guard — `getUsersQuery` fires before `layout.tsx` redirect executes in `useEffect`; a logged-in
  non-admin user with a valid JWT receives the user list response before the React redirect runs; pre-existing Next.js
  App Router client-auth limitation; proper fix is middleware-level auth or server component guard

## Deferred from: code review of 2-2-admin-user-management-backend (2026-05-15)

- AC4 test does not verify `refresh_tokens` collection is cleared after `resetUserPassword` — direct DB inspection
  discouraged by project rules; `invalidateUserSessions` is tested as part of prior stories
- `deleteUser` session invalidation has a TOCTOU window — concurrent login between `adminDeleteUser` success and
  `invalidateUserSessions` call produces a live refresh token; requires transactional semantics not currently in
  codebase
- Password plaintext in GQL mutation arguments (`createUser`, `resetUserPassword`) — logged in debug mode; same pattern
  as `register()` and `changePassword()`; broader API design concern
- No pagination on `getAllRegularUsers` / `users` query — loads entire collection; out of scope for this story

## Deferred from: code review of 2-1-applicationconfig-entity-registration-toggle-backend (2026-05-14)

- Non-atomic AtomicReference cache init in `ApplicationConfigService.get()` — benign in practice (idempotent upsert
  means double-load has no observable effect); use `compareAndSet` or a `Mutex` if stricter guarantees needed
- Admin password compared with `==` (timing-vulnerable, no bcrypt) — pre-existing in UserService; accepted design
  trade-off (also noted in story 1.2 deferred items)
- `changePassword` uses upsert `save` rather than targeted atomic update — pre-existing pattern in UserService
- Duplicate-username detection relies on MongoDB unique index not established in this diff — index should exist from
  story 1.1; tests pass; verify index creation in UserRepository on startup
- `DataFetchingException` used as error type for auth failure in `GraphQLForbiddenException` — clients should use
  `extensions.code`; minor semantic; revisit when standardizing GQL error taxonomy
- Magic number `11000` for MongoDB duplicate-key error in `UserService` — replace with `ErrorCategory.DUPLICATE_KEY`
  check when tightening error handling
- `CONFIG_ID` is an instance `val` in `ApplicationConfigRepository` rather than a companion-object constant — trivial;
  move to companion object if additional instances are ever created

## Deferred from: code review of 1-6-e2e-test-infrastructure-auth-flow-coverage (2026-05-14)

- Hardcoded admin/admin credentials in test files — documented default dev credentials; swap to env var pattern if
  credentials become environment-specific
- Registration test accumulates test users with no teardown — explicitly accepted in dev notes; clean dev DB
  periodically or add a purge script before prod migration
- `button[aria-haspopup="true"]` selector not scoped to AppBar — stable for current UI; refactor to scoped selector if
  additional `aria-haspopup` buttons are added to the header
- `[aria-label="logout"]` selector fragile to future label/i18n changes — use `data-testid` for logout trigger when
  accessibility labels evolve
- No `webServer` config in playwright.config.ts — out of scope per story; add `webServer` block with `docker compose`
  invocation when CI pipeline is configured
- No `playwright install` step in `test:e2e` script — one-time manual setup; document in CI pipeline onboarding
- No explicit timeout overrides on URL/element assertions — Playwright default (5s) is adequate for local dev; increase
  if flakiness observed in CI

## Deferred from: code review of 1-5-user-identity-account-management-ui (2026-05-11)

- Silent return when `accessToken` is null gives user no feedback — spec-designed loading-window guard; UX improvement
  is post-scope
- UserChip causes layout shift during hydration — AppHeader renders chip once auth context resolves; needs
  skeleton/loading state design
- No client-side check that new password differs from current — server enforced
- No minimum password length client validation — server enforced; depends on backend password policy rules
- Non-wrong-password server errors (401, 500) surfaced under "Current password" field — only AC4 wrong-password case is
  spec'd; general error placement is post-scope design
- No spacing `sx` between UserChip and Navigation icon in Toolbar — no spec requirement; adjust if design calls for it

## Deferred from: code review of 1-4-login-registration-ui (2026-05-11)

- `LoginForm` / `RegisterPage` near-identical components — same layout, state structure, and submit pattern with zero
  shared abstraction; will diverge silently; architectural refactor deferred beyond story scope
- Unsafe `role as 'admin' | 'user'` cast in both `auth/page.tsx` and `register/page.tsx` — unexpected backend role value
  silently accepted; cross-cutting TypeScript concern; deferred as it matches the existing pattern
- `authApi.register` success response JSON parse unguarded — if `res.ok` is true but body is not valid JSON the
  rejection is unhandled; matches existing `authApi.login` behaviour; deferred as cross-cutting API hardening
- `WelcomeBanner` reappears if `username` repopulates after auth expiry while `showBanner` is still `true` — edge case;
  acceptable for v1

## Deferred from: code review of 1-3-frontend-theme-auth-infrastructure (2026-05-09)

- `auth/page.tsx` still calls bare `fetch('/api/login')` + writes `localStorage` — full replacement is story 1.4 scope;
  currently broken but unreachable because RouteGuard redirects to `/auth` (which then fails to populate AuthContext)
- `AuthProvider` refresh failure silently swallowed — `.catch(() => {})` per spec intent; no user-visible error on
  session expiry; consider a toast or redirect with message in a future UX pass
- No inverse guard for authenticated users visiting `/auth` — authenticated users land on the login page; they must
  manually navigate away; add redirect-if-authenticated logic before or during story 1.4 login UI
- `isLoading` stays `true` on `AuthProvider` unmount before refresh resolves — React StrictMode double-invoke in dev
  causes two parallel refresh calls; add `AbortController` cleanup to the `useEffect` as a hardening step

## Deferred from: code review of 1-2-login-token-system-session-security-backend (2026-05-08)

- Admin timing attack — plain-text `==` on admin password is faster than bcrypt+DB; spec intentionally chose this;
  timing side-channel exists but is an accepted design trade-off
- Admin password in JVM heap — config-sourced String not zeroed; general JVM concern; not actionable without moving to
  char[]
- Refresh tokens stored as plaintext in MongoDB — should hash with SHA-256 before storing; DB exfiltration exposes all
  active sessions; security hardening deferred
- Access token not revoked on password change — 15-min JWTs stay valid after change-password; requires a token blocklist
  to fix; known JWT architecture limitation
- Admin timing leak vs regular user — admin check bypasses bcrypt+DB; ~100ms timing difference reveals admin account;
  inherent in plain-text design choice
- No `iat` (issued-at) claim in JWT — prevents "invalidate tokens issued before T" without a blocklist; security
  hardening
- `UserStorage.sync()` check-then-act race — `synced` flag is not atomically guarded; double-sync possible under
  coroutine concurrency; pre-existing in storage layer
- CORS plugin does not allow credentials or expose Authorization header — frontend is same-origin via nginx;
  cross-origin clients (API playground, mobile) will fail; pre-existing config
- MongoDB error handling absent in repositories — `insertOne`/`deleteOne` throw MongoWriteException as 500; pre-existing
  pattern across all repositories; needs global error handler
- AC2 log sanitization — Ktor monitoring may log request bodies including credentials; audit `configureMonitoring()`
  before production; flagged in Story 1.1 deferred items

## Deferred from: code review of 1-1-user-entity-registration-backend (2026-05-08)

- No input validation on username/password (length, blank, character set) — out of scope for Story 1.1; consider a
  validation layer before Story 1.4 login UI
- BCrypt 72-byte password truncation — passwords longer than 72 bytes are silently truncated by BCrypt; no max length
  enforced at API boundary; security hardening out of scope
- `password.toCharArray()` not zeroed after hashing — not actionable in JVM given the upstream `String` is also
  unzeroable
- `role` field is raw String, not typed enum — design concern; consider converting to `enum class Role` when more roles
  are added
- `UserRepository.findByUsername` is dead code — storage intentionally serves from memory only; the repository method
  exists for potential future direct-DB lookup but is currently never called
- No test for malformed / empty JSON request body — `call.receive<RegisterRequest>()` throws on bad input; behavior
  untested; out of scope for this story
- No test verifies bcrypt hash stored in MongoDB — test only checks HTTP response doesn't contain plaintext; would
  require direct DB access against project testing policy
- UUID deserialization byte-swap risk — `UUIDMongoSerializer.asUuid()` may use JAVA_LEGACY byte order vs STANDARD used
  by `MongoClientSettings`; needs cross-cutting investigation against existing ItemRepository to confirm consistency
- Rate limiter coverage of `/auth/login` — `RateLimitName("auth")` is already reusable; Story 1.2 just wraps
  `/auth/login` in `rateLimit(RateLimitName("auth"))`; no structural refactor needed
- Monitoring plugin may log request bodies including passwords — pre-existing concern not introduced by Story 1.1; audit
  `configureMonitoring()` before production deployment
