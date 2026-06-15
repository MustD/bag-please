# Deferred Work

## Deferred from: code review of 4-8-frontend-lists-tab-list-management-bpavatar (2026-05-25)

- `ListStorage.rename` not atomic — in-memory updated before MongoDB write; if MongoDB throws, in-memory reflects rename
  but DB does not until process restart; same pre-existing pattern as `save()` and `delete()` across all Storage classes
- Concurrent delete+rename race causes `IllegalStateException` bypassing GQL error model — service confirms existence
  via `listStorage.getById`, then storage re-confirms; a concurrent `deleteList` between the two calls evicts the list
  from the map, causing `storage[id] ?: throw IllegalStateException(...)` to throw an uncaught 500 instead of a
  structured GQL error; pre-existing pattern across all Storage classes

## Deferred from: code review of 4-7-frontend-today-tab-shopping-loop-core-components (2026-05-25)

- `usePrefersReducedMotion` hook duplicated in `ItemCard.tsx` and `ProgressStrip.tsx` — registers separate matchMedia
  listeners per instance; extract to a shared `src/hooks/usePrefersReducedMotion.ts`
- `announceToSR` fires immediately on check before mutation resolves — on checkItem failure, SR has already announced
  item as removed; no correction is announced; AC10 satisfied for happy path only; error path SR UX not spec'd
- `uncheckItem` (Undo) failure is silent — no onError handler; UI shows unchecked while backend may remain checked; not
  spec'd for this story
- Concurrent check+undo race — if Undo is tapped while checkItem is still in-flight, both mutations run concurrently;
  last writer wins; rare edge case not spec'd
- `ListChipRow` shows skeleton chips when user genuinely has zero lists — `lists.length === 0` shows skeletons
  regardless of loading state; requires a separate `loading` prop to distinguish; enhancement deferred
- Subscription `updateQuery` merge safety — `{...items[idx], ...update.item}` overwrites known-good fields with
  undefined if the subscription document is trimmed in future; low-risk forward-looking concern

## Deferred from: code review of 4-6-frontend-bpsheet-spike-component (2026-05-25)

- No keyboard alternative for drag handle expand/collapse — drag handle is `aria-hidden` and `useSwipeable` is
  touch/mouse only; keyboard users cannot move the sheet between PEEKED and OPEN states; not in spec scope for this
  story; forward-looking accessibility gap to address when BPSheet API is locked
- `triggerRef.current` null at focus restore leaves focus on `<body>` — if the trigger element is conditionally
  unmounted while the sheet is open, focus after close lands on `<body>`; component handles it safely via optional
  chaining (no crash); caller responsibility to keep trigger mounted until close

## Deferred from: code review of 4-5-frontend-foundation-theme-navigation-layout (2026-05-24)

- Today tab `onChange` navigates to `/lists` instead of a list route — intentional scaffold; dev notes confirm Story 4.7 wires the Today tab properly with a real `listId`
- `no-sx-color` ESLint rule only inspects flat `ObjectExpression` — spread/nested/conditional `sx` patterns bypass enforcement; acceptable for current scope, enhance rule when a bypass is observed in practice
- `router` in `useEffect` dependency array on `page.tsx` — theoretically triggers re-fire if router identity changes; stable in Next.js practice; `page.tsx` will be substantially rewritten in Story 4.7
- `AuthContext` `clearAuth` + `isLoading` timing edge case — if `clearAuth` fires before initial `refresh` resolves, `isLoading` stays `true` until `refresh` completes, holding `RouteGuard` in null-render state while Apollo redirect fires; pre-existing in `AuthContext`, not introduced by this story

## Deferred from: code review of 4-3-list-sharing-backend-pending-invites-member-management (2026-05-22)

- Untyped status strings `"PENDING"/"ACCEPTED"/"DECLINED"` — no sealed enum or constants; typos silently produce broken state; pre-existing design choice not introduced by this story
- `acceptInvite` TOCTOU double-accept race — two concurrent accepts can both pass the `PENDING` check and insert the user's UUID into `List.members` twice; spec-acknowledged acceptable at this scale
- `deleteList` doesn't clean up `list_members` rows — orphaned `list_members` rows accumulate for deleted lists; `getLists` silently drops them via null-map; `deleteList` predates this story
- Re-invite after DECLINE overwrites original `createdAt` — `shareList` constructs a new `ListMember(..., Instant.now())` on re-invite, upsert overwrites original invite timestamp; acceptable for current audit requirements
- Username recycling UUID/username desync — `removeMember`/`leaveList` filter `List.members` by resolved UUID but `memberUsernames` by string; if a username is re-registered to a different UUID the two arrays diverge; pre-existing design gap not introduced by this story
- Non-auth validation errors wrapped in `GraphQLForbiddenException` — `UserNotFound`, `AlreadyMember`, `AlreadyPending`, `SelfShare` are semantic validation errors but use the same exception type as auth failures; pre-existing GQL error taxonomy (noted in 2-1 deferred items)
- `acceptInvite` UUID oracle via error differentiation — valid `listId` returns `NotPendingInvite` (confirming existence) vs error for unknown UUIDs; auth-gated endpoint, UUID space makes enumeration infeasible; acceptable design tradeoff
- `runBlocking` in `ListMemberRepository.init` — follows same pattern as all other repository `init` blocks; already deferred in 4-1 review

## Deferred from: code review of 4-2-websocket-auth-per-list-subscription-scoping (2026-05-22)

- Stale `isMember` cache — `ListStorage.getByIdCached` bypasses `sync()`; a user revoked from a list mid-subscription may continue receiving events until the process restarts or the cache is refreshed; full test requires Story 4.3 member-removal mutation
- Race window between Point 1 `verifyMembership` and `emitAll` start — theoretical TOCTOU gap; mitigated in practice by Point 2 `takeWhile` re-check on every event; acceptable design tradeoff given two-point enforcement
- Lost SharedFlow events during subscribe setup — events emitted between `verifyMembership` and `emitAll` may be silently dropped if the SharedFlow buffer is full (DROP_OLDEST); pre-existing SharedFlow backpressure behavior not introduced by this change
- AC4 Point 2 (`takeWhile` membership revocation) test absent — implementation exists and is correct; test blocked on Story 4.3 member-removal mutation (noted with TODO in `SubscriptionScopingTest.kt`)

## Deferred from: code review of 4-1-list-entity-backend-crud-authorization-migration (2026-05-22)

- TOCTOU `synced` flag — `private var synced = false` is non-volatile; two coroutines can double-sync on startup; pre-existing pattern in `UserStorage` from story 1.2; affects `ItemStorage`, `CategoryStorage`, and new `ListStorage`
- `runBlocking` in repository init + duplicate instantiation — repository constructors call `runBlocking { createIndexes }` (pre-existing pattern); `Application.kt` and `GQL.kt` now create separate repository instances, doubling startup index-creation calls; idempotent but wasteful
- `isMember` cold-cache false-denial — `ListStorage.getByIdCached` bypasses `sync()`; if called before any sync, returns `false` for legitimate members; `isMember` is currently unused in production paths but is a latent trap
- `deleteList` partial-failure stale in-memory data — if `listRepository.delete()` throws after `itemRepository.deleteAllInList` + `categoryRepository.deleteAllInList` succeed, the `evictList` calls are never reached; in-memory data stays stale for the process lifetime; process restart recovers from MongoDB; design-acknowledged via spec cascade ordering
- `verifyMembership` error message leaks list existence — "List not found" vs "Access denied" reveals whether a list UUID exists; UUID space makes enumeration infeasible in practice
- `GqlItem @GraphQLName("Item")` input/output collision — same class used as both input and output type in graphql-kotlin; pre-existing pattern before this story; all 65 tests pass; investigate if schema generation creates `ItemInput` vs `Item` conflict
- AC7 error shape — `IllegalArgumentException` for list name > 100 chars produces a GQL execution error, not a formal GQL validation error; behavior is correct (no DB write, error returned to client) but error format differs from spec intent
- `ListStorage.delete()` dead code — the method exists but `ListService.deleteList` bypasses it (calls `listRepository.delete` + `evictFromCache` directly); latent inconsistency; could cause a double-delete if future code routes through `listStorage.delete()`

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

## Deferred from: code review of spec-fix-new-list-sheet-crash (2026-06-15)

- BPSheet focus-on-open does not fire under reduced motion — `bp_front/src/app/BPSheet.tsx`: with
  `prefers-reduced-motion: reduce`, the Paper has `transition: 'none'` and uses a `Fade` slot, so no `height`
  `transitionend` ever fires and `handleTransitionEnd` never runs; the open sheet's first focusable (e.g. the New list
  name field) is never auto-focused. A11y gap, pre-existing — needs a fallback (e.g. focus on `Fade` `onEntered` or an
  effect keyed on `state === 'open'`). Out of scope for the crash/blink fix.
- BPSheet re-fires focus-on-open on every height transition — `bp_front/src/app/BPSheet.tsx:handleTransitionEnd`: any
  completed `height` transition while `state !== 'closed'` (incl. peeked↔open collapse and the picker-toggle expand)
  re-runs `first?.focus()`, which can yank focus to the first focusable mid-interaction. Pre-existing; the
  `target === currentTarget` guard only filters child-vs-self transitions, not open-vs-peeked re-entry. Consider firing
  focus only on the initial open transition.

## Deferred from: code review of spec-fix-list-golden-path (2026-06-15)

- BPSheet history sentinels carry no per-instance identity — `bp_front/src/app/BPSheet.tsx`: every instance (and the
  consumer-pushed sentinel in `SheetNewList`) uses the identical `{bpSheetSentinel: true}` marker. If two BPSheet
  consumers were ever open/closing concurrently, one instance's cleanup `history.back()` could pop another's sentinel.
  No current trigger (only one sheet is open at a time on `/lists` and `/list/[listId]`). Fix: tag each sentinel with a
  unique per-instance id and only pop your own.
- Orphan sentinel history entry after create-navigate — `SheetNewList` create path intentionally skips the sentinel
  pop and `router.push`es over it, leaving one extra `/lists` history entry beneath the new list. Cosmetic: pressing
  Back from the new list still lands on the lists view; there is just a redundant duplicate entry. Consider
  `router.replace`-style cleanup if history hygiene matters.
- `crypto.randomUUID()` requires a secure context — `bp_front/src/app/list/[listId]/page.tsx` generates item/category
  UUIDs client-side; `crypto.randomUUID` is undefined over plain `http://<LAN-IP>` (non-localhost), so add-item throws
  on a phone hitting the LAN IP. Ties into Epic 5 mobile-login work. Fix: a UUID fallback, or have the backend generate
  the id like `createList` does. (`SheetNewList` is unaffected — the server generates the list id there.)
- Orphan empty "Uncategorized" category on partial add failure — `handleAddItem`: if `saveCategory` succeeds but the
  subsequent `saveItem` throws, the list keeps a created-but-empty category. Minor data hygiene; low priority.
