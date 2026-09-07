# bag-please — Closed Epics Archive

Verbatim bodies of the closed epics, moved out of `epics.md` on 2026-09-07 to keep the live
planning file small. Epics 1–7 are all closed, each with a retrospective in
`_bmad-output/implementation-artifacts/`. Nothing here was edited — only relocated.

This file is part of the epic set: sprint planning must be run with BOTH files, e.g.
`--epic-file .../epics.md --epic-file .../epics-archive.md`, or the story keys for Epics 1–7
are reported as orphans and dropped from `sprint-status.yaml`.

---

## Epic 1: User Authentication, Session Management & Identity

Users can create their own accounts, log in with personal credentials, have their session maintained silently for 30
days, see their name in the app bar on every page, change their own password, and log out cleanly. The complete backend
auth infrastructure (User entity, JWT tokens, refresh tokens, RBAC, rate limiting, Principal in GQL context) is in place
as the foundation for everything that follows.

### Story 1.1: User Entity & Registration Backend

As a new user,
I want to be able to register an account with a username and password,
So that I have my own identity in bag-please instead of sharing the admin credential.

**Acceptance Criteria:**

**Given** the `users` MongoDB collection does not contain a user with username "mia"
**When** `POST /auth/register` is called with `{"username": "mia", "password": "secret123"}`
**Then** the response is HTTP 200 with body `{"username": "mia", "role": "user"}`
**And** the password is stored as a bcrypt hash (cost factor 12) — never as plaintext

**Given** a user with username "mia" already exists
**When** `POST /auth/register` is called with `{"username": "mia", "password": "other"}`
**Then** the response is HTTP 400
**And** the error body contains a uniform non-distinguishing message
**And** no new user is created in MongoDB

**Given** the admin username configured via `KTOR_ADMIN_LOGIN` is "admin"
**When** `POST /auth/register` is called with `{"username": "admin", "password": "any"}`
**Then** the response is HTTP 400 with the same uniform error message
**And** no user record is written to MongoDB

**Given** any registration request — success or failure
**When** the operation completes
**Then** no plaintext password value appears in application logs

**Given** the `UserStorage` has not been accessed since startup
**When** any `UserStorage` read or write is called
**Then** the storage syncs from the MongoDB `users` collection exactly once, then serves all subsequent calls from the
in-memory map

### Story 1.2: Login, Token System & Session Security Backend

As a registered user,
I want to log in with my credentials and have my session maintained securely via short-lived tokens,
So that I stay authenticated without repeatedly entering my password, with no plaintext tokens accessible from
JavaScript.

**Acceptance Criteria:**

**Given** user "mia" exists with a correctly hashed password
**When** `POST /auth/login` is called with correct credentials
**Then** the response is HTTP 200 with a JWT access token (15-minute expiry, claims: `username` + `role`)
**And** a `Set-Cookie` header sets an httpOnly, `SameSite=Strict` refresh token cookie (30-day expiry)
**And** the refresh token is stored in the MongoDB `refresh_tokens` collection

**Given** any authentication failure — wrong username, wrong password, or non-existent user
**When** `POST /auth/login` is called
**Then** the response is HTTP 401
**And** the error body is identical regardless of whether the username exists or the password was wrong
**And** no credential material appears in logs

**Given** 6 or more `POST /auth/login` requests from the same IP within 1 minute
**When** the 6th request arrives
**Then** the response is HTTP 429 (Too Many Requests)
**And** the same rate limit applies to `POST /auth/register`

**Given** a valid httpOnly refresh token cookie
**When** `POST /auth/refresh` is called
**Then** the response is HTTP 200 with a new 15-minute access token
**And** the original refresh token document remains in MongoDB until its 30-day TTL

**Given** an expired or absent refresh token cookie
**When** `POST /auth/refresh` is called
**Then** the response is HTTP 401

**Given** a valid refresh token exists in MongoDB
**When** `POST /auth/logout` is called with that cookie
**Then** the response is HTTP 200
**And** the refresh token document is deleted from `refresh_tokens`
**And** a subsequent `POST /auth/refresh` with the same cookie returns HTTP 401

**Given** `KTOR_ADMIN_LOGIN=admin` and `KTOR_ADMIN_PASS=admin`
**When** `POST /auth/login` is called with those credentials
**Then** the access token contains `role: "admin"`
**And** no admin document is stored in the `users` MongoDB collection

**Given** an authenticated request with a valid JWT containing `role: "user"`
**When** an admin-only endpoint is called
**Then** the response is HTTP 403

**Given** any authenticated GraphQL request
**When** the request is processed
**Then** the `Principal` (username + role) is available via the GraphQL context factory for all GQL operations

**Given** `POST /auth/change-password` with a valid access token and correct current password
**When** the request is processed with a new password
**Then** the response is HTTP 200
**And** the user's password hash in MongoDB is updated
**And** all existing refresh tokens for that user are invalidated

**Given** `POST /auth/change-password` with an incorrect current password
**Then** the response is HTTP 400 with a non-distinguishing error

### Story 1.3: Frontend Theme & Auth Infrastructure

As a user of the app,
I want the application to have a consistent visual identity and to keep me signed in transparently,
So that the app feels polished and authentication is invisible during normal use.

**Acceptance Criteria:**

**Given** any page in the application is loaded
**When** the page renders
**Then** the background is `#0e0e10`, primary accent is `#4db6a8`, font family is Inter
**And** all MUI Buttons render with sentence-case text (no ALL CAPS) and `borderRadius: 6`
**And** no visual styling (colour, typography, border, shadow) is applied via inline `sx` in component files — only
layout/spacing `sx` is used

**Given** the access token has expired but a valid refresh token cookie exists
**When** a GraphQL HTTP request returns 401
**Then** the frontend silently calls `POST /auth/refresh`
**And** on success, retries the original request with the new access token
**And** the user sees no loading state or interruption

**Given** the refresh token is also expired or absent when a 401 is received
**When** the recovery attempt fails
**Then** auth context is cleared (username and role set to null)
**And** the user is redirected to `/auth`

**Given** a user logs out
**When** the logout action fires
**Then** the access token is removed from auth context
**And** `POST /auth/logout` is called to invalidate the refresh cookie
**And** the user is immediately redirected to `/auth`

**Given** an unauthenticated user navigates to any route other than `/auth` or `/auth/register`
**When** the route guard evaluates
**Then** the user is redirected to `/auth`

**Given** `ThemeProvider` is registered in the root layout
**When** any page renders
**Then** the theme applies globally — no per-component theme import needed

### Story 1.4: Login & Registration UI

As a new or returning user,
I want clear, mobile-friendly login and registration screens with honest feedback,
So that I can get into the app quickly and understand exactly what happened when something goes wrong.

**Acceptance Criteria:**

**Given** an unauthenticated user visits `/auth`
**When** the login page renders
**Then** the layout is edge-to-edge (no Paper card wrapper), `maxWidth: 360` centred on desktop, full-width on mobile
**And** username and password fields have visible associated labels (not placeholder-only)
**And** pressing Enter from either field submits the form
**And** a "Register" link is visible

**Given** the login form is submitted with wrong credentials
**When** the server returns an error
**Then** an inline `FormHelperText` with `error` prop appears below the password field
**And** no Snackbar or floating Alert is shown for the error
**And** the submit button re-enables

**Given** the user was redirected to `/auth` due to session expiry
**When** the login page renders
**Then** an `Alert severity="warning"` is shown above the form heading with text "Your session has expired. Please sign
in again."

**Given** the user visits `/auth/register`
**When** the page renders
**Then** the layout is edge-to-edge matching the login page
**And** username and password fields have visible labels
**And** a link back to sign-in is visible

**Given** registration succeeds and auto-login completes
**When** the user lands on the home page
**Then** the `WelcomeBanner` is shown: "Welcome, [username]! You now have your own account."
**And** the banner has a dismiss `IconButton`

**Given** the `WelcomeBanner` was dismissed or the user navigated away
**When** the user returns to the home page in the same session
**Then** the `WelcomeBanner` is NOT shown again

**Given** registration fails because the username is already taken
**When** the error is received
**Then** an inline `FormHelperText` error appears below the username field

**Given** any form submit is in progress
**When** the async operation is pending
**Then** the primary action button shows `CircularProgress` (replacing button text) and is disabled

**Given** a field has a visible error
**When** the user modifies that field's value
**Then** the error clears immediately

### Story 1.5: User Identity & Account Management UI

As an authenticated user,
I want to see my name in the app bar and be able to change my password,
So that the app feels like mine and I can maintain my own account.

**Acceptance Criteria:**

**Given** an authenticated user loads any page
**When** the AppBar renders
**Then** a `UserChip` is visible showing a rounded avatar with the user's first-letter initial and the username
**And** it is styled entirely via `theme.components` overrides — no inline `sx` for visual style
**And** it is absent when the user is not authenticated

**Given** an authenticated user navigates to `/account/password`
**When** the page renders
**Then** it shows a "Current password" field, a "New password" field, and a submit button
**And** all fields have visible labels
**And** pressing Enter from the last field submits the form

**Given** the change-password form is submitted with the correct current password and a valid new password
**When** the server returns success
**Then** a success message is shown inline on the page
**And** the form fields are cleared

**Given** the change-password form is submitted with an incorrect current password
**When** the server returns an error
**Then** an inline `FormHelperText` error appears below the current-password field
**And** no Snackbar is shown

**Given** the form submit is in progress
**When** the request is pending
**Then** the submit button shows `CircularProgress` and is disabled until resolved

**Given** the navigation menu is open
**When** any authenticated user views it
**Then** a link to the change-password page is visible

---

## Epic 2: Admin User Management & Application Configuration

Admin can view the full user list, create users, reset any user's password, and delete accounts — all with explicit
confirmation dialogs on destructive actions. Admin can toggle public registration on or off at runtime. The admin panel
is accessible only to the admin role; non-admin users are blocked. The login screen adapts to the registration state (
link hidden / "contact admin" copy shown).

### Story 2.0: Remove UserStorage — Simplify UserService to Direct MongoDB

As a developer,
I want to eliminate the in-memory UserStorage cache layer,
So that the user data path is simpler, the concurrency hazards from the dual-map pattern are gone, and the codebase
is easier to maintain going into Epic 2.

**Acceptance Criteria:**

**Given** `UserStorage.kt` and its dual-map pattern exist from Epic 1
**When** this story is complete
**Then** `UserStorage.kt` is deleted
**And** `UserService` calls `UserRepository` methods directly for all user operations
**And** `UserRepository.findByUsername` (previously dead code) is the primary lookup for login and duplicate checks
**And** the MongoDB unique index on `username` (patched in Story 1.1 review) serves as the sole duplicate-prevention
mechanism

**Given** a user attempts to register with a username that already exists
**When** `UserRepository.save()` is called
**Then** MongoDB rejects the write via the unique index
**And** `UserService` maps the `MongoWriteException` to the same HTTP 400 response as before

**Given** all existing Story 1.1 and 1.2 backend tests
**When** this story is complete
**Then** all tests pass against the simplified `UserService` (tests updated to remove `UserStorage` setup/mocking)
**And** no test relies on in-memory map state

### Story 2.1: ApplicationConfig Entity & Registration Toggle Backend

As an admin,
I want to control whether public registration is available via a persistent, immediately-effective toggle,
So that I can manage who can join the app without restarting the service.

**Acceptance Criteria:**

**Given** the `app_config` MongoDB collection is empty on first startup
**When** the application starts
**Then** the ApplicationConfig is initialized with `registrationEnabled: false` and persisted to MongoDB

**Given** the GraphQL `applicationConfig` query is called with a valid admin JWT
**When** processed
**Then** the response contains `registrationEnabled` reflecting the current value read from MongoDB

**Given** the admin calls `setRegistrationEnabled(enabled: true)` mutation
**When** processed
**Then** the `app_config` MongoDB document is updated
**And** a subsequent `applicationConfig` query returns `registrationEnabled: true`

**Given** a non-admin user calls any admin GraphQL mutation
**When** the GQL context principal is checked
**Then** a GraphQL error with code FORBIDDEN is returned

**Given** an unauthenticated request calls any admin GraphQL mutation
**Then** a GraphQL error with code UNAUTHENTICATED is returned

### Story 2.2: Admin User Management Backend

As an admin,
I want to manage user accounts via GraphQL,
So that I can create, reset passwords, and remove users without direct database access, using the same API layer as
the rest of the application.

**Acceptance Criteria:**

**Given** the admin is authenticated
**When** the GraphQL `users` query is called
**Then** the response contains an array of `{id, username, role}` for all MongoDB users
**And** the admin account (env-var credentials) is NOT included in the list

**Given** a valid admin JWT and username "tom" does not yet exist
**When** the `createUser(username: "tom", password: "initial123")` mutation is called
**Then** the response contains `{id, username: "tom", role: "user"}`
**And** "tom" is stored in MongoDB with a bcrypt-12 hashed password
**And** a subsequent `users` query includes "tom"

**Given** user "tom" exists with a known UUID
**When** the `deleteUser(id: "…")` mutation is called by the admin
**Then** "tom" is removed from MongoDB
**And** a subsequent `users` query does not include "tom"

**Given** user "tom" exists with a known UUID
**When** the `resetUserPassword(id: "…", newPassword: "newpass")` mutation is called
**Then** "tom"'s password hash in MongoDB is updated to bcrypt-12("newpass")
**And** all of "tom"'s active refresh tokens are deleted from `refresh_tokens`
**And** "tom" can subsequently log in with "newpass"

**Given** a non-admin user calls any admin GraphQL mutation
**When** the GQL context principal is checked
**Then** a GraphQL error with code FORBIDDEN is returned

**Given** `deleteUser` is called with an ID that does not exist
**Then** a GraphQL error with code NOT_FOUND is returned

### Story 2.3: Admin User Management UI

As an admin,
I want a dedicated user management page to view and control all user accounts,
So that I can manage the user base on mobile or desktop without touching the database.

**Acceptance Criteria:**

**Given** the admin is authenticated and navigates to `/admin/users`
**When** the page renders
**Then** a Paper-wrapped MUI Table lists all users with username and role columns
**And** each row has a reset-password `IconButton` and a delete `IconButton` (both with `title` props)
**And** a "Create user" Button is visible above the table

**Given** the user list is loading
**When** the data fetch is in progress
**Then** a `CircularProgress` is shown centred in the table area while the table header remains visible

**Given** no users have been created yet
**When** the table renders
**Then** a single row with muted text "No users yet. Create the first one." is displayed

**Given** the admin clicks "Create user"
**When** the `ConfirmDialog` opens
**Then** it contains username and password `TextField` inputs
**And** the Cancel button receives initial focus
**And** on successful submit the new user appears in the table immediately without a page reload

**Given** the admin clicks the delete `IconButton` for user "tom"
**When** the `ConfirmDialog` opens
**Then** the title is "Delete user?" and the body plainly states the consequence ("This cannot be undone.")
**And** the Cancel button receives initial focus and the confirm button uses `color="error"`
**And** confirming removes "tom" from the table immediately

**Given** the admin clicks the reset-password `IconButton` for user "tom"
**When** the `ConfirmDialog` opens
**Then** it contains a new-password `TextField` and warns that Tom's current session will be invalidated
**And** confirming sends the request and closes the dialog with no success Snackbar

**Given** a non-admin user navigates to `/admin/users`
**When** the admin guard evaluates
**Then** the user is redirected to `/`

**Given** an admin opens the navigation menu
**When** the menu renders
**Then** a "User Management" MenuItem is visible and links to `/admin/users`
**And** this item is NOT rendered for non-admin users

### Story 2.4: Registration Toggle UI & Adaptive Login Screen

As an admin and as a user arriving at the login screen,
I want the registration option to reflect the admin's configuration in real time,
So that user onboarding is controlled and the login screen is never in a confusing state.

**Acceptance Criteria:**

**Given** the admin is on `/admin/users`
**When** the page renders
**Then** a `Switch` with `FormControlLabel` label "Allow public registration" is visible
**And** it reflects the current state from `GET /admin/config`

**Given** registration is currently disabled and the admin toggles the Switch on
**When** `PUT /admin/config {"registrationEnabled": true}` completes
**Then** the Switch reflects the enabled state immediately
**And** a visit to `/auth` now shows the "Register" link

**Given** registration is currently enabled and the admin toggles it off
**When** `PUT /admin/config {"registrationEnabled": false}` completes
**Then** the Switch reflects the disabled state immediately
**And** a visit to `/auth` now hides the "Register" link

**Given** an unauthenticated user visits `/auth` and registration is disabled
**When** the login page renders
**Then** no "Register" link is shown
**And** "Contact your admin to get access" text is visible below the form

**Given** an unauthenticated user visits `/auth` and registration is enabled
**When** the login page renders
**Then** the "Register" link is visible
**And** no "Contact admin" text is shown

**Given** `GET /admin/config` is fetched once on app load
**When** the registration state is resolved
**Then** it is available in app context so the login page uses it without an additional network request

### Story 1.6: E2E Test Infrastructure & Auth Flow Coverage

As a developer maintaining bag-please,
I want a Playwright e2e test suite covering the core auth flows,
So that regressions in login, registration, session handling, and route guards are caught before they reach
production.

**Acceptance Criteria:**

**Given** the Playwright suite is configured in `bp_front/`
**When** `npx playwright test` is run against a locally running app (nginx on `:2080`, backend on `:4000`,
MongoDB running)
**Then** all tests pass and an HTML report is produced

**Given** an unauthenticated user visits any protected route (e.g. `/`)
**When** the route guard evaluates
**Then** the browser is redirected to `/auth`

**Given** the login form is submitted with valid credentials
**When** the server responds with a token and username
**Then** the user lands on `/` and the `UserChip` shows the correct username in the AppBar

**Given** the login form is submitted with invalid credentials
**When** the server returns an error
**Then** an inline `FormHelperText` error appears below the password field
**And** no redirect occurs

**Given** a new username not already in the database
**When** the registration form is submitted
**Then** the user is auto-logged-in and redirected to `/`
**And** the `WelcomeBanner` is visible on the home page

**Given** the registration form is submitted with a username already taken
**When** the server returns an error
**Then** an inline `FormHelperText` error appears below the username field

**Given** a logged-in user clicks Logout
**When** the logout action fires
**Then** the browser is redirected to `/auth`
**And** a subsequent navigation to `/` redirects back to `/auth`

**Given** the user was redirected to `/auth` due to session expiry
**When** the login page renders
**Then** an `Alert` with session-expiry text is visible above the form heading

**Technical Notes:**

- Playwright config lives at `bp_front/playwright.config.ts`
- Tests live at `bp_front/e2e/`
- Base URL: `http://localhost:2080`
- Use Playwright's built-in browser isolation; no shared auth state between test files
- Tests requiring an authenticated user must use a setup fixture that calls `POST /api/auth/login` directly
  and saves `storageState` — never drive the UI login form in every test
- `npm run test:e2e` added to `bp_front/package.json` scripts

---

## Epic 3: Technical Foundation

**Reconstructed on 2026-09-05 from the shipped record.** Epic 3 was defined entirely in the Epic 2 retrospective and
executed before it was ever written into this document, which is why it was missing here while `sprint-status.yaml`
carried it as done. The content below is taken from the two story files
(`3-1-deferred-work-triage-high-priority-fixes.md`, `3-2-e2e-test-coverage-admin-panel.md`) and
`epic-3-retro-2026-05-18.md`; nothing is invented and nothing is re-planned. Both stories are **done** (2/2, closed at
the retrospective on 2026-05-18).

The high-priority deferred items from Epics 1 and 2 are cleared, and the Epic 2 admin surface gains real-browser
coverage. Registration-disabled no longer leaves `/auth/register` reachable, admin dialogs surface mutation failures
instead of dying silently, the concurrent-registration TOCTOU path has a regression test, and an unhappy-path checklist
is embedded in the story template so later stories inherit it. Note that both stories predate the Epic 5 reframe and
name Next.js paths (`bp_front/src/app/...`) that no longer exist; the shipped Vite app re-delivers this behaviour.

### Story 3.1: Deferred Work Triage & High-Priority Fixes

As the development team maintaining the bag-please app,
I want high-priority deferred issues from Epics 1–2 addressed,
So that the app handles error scenarios correctly, prevents known concurrency bugs, and leaves no exploitable UX gaps.

**Acceptance Criteria:**

**AC1 — `/auth/register` redirects when registration is disabled**

**Given** registration is disabled (`registrationEnabled === false`)
**When** a user navigates to `/auth/register`
**Then** they are immediately redirected to `/auth`

**AC2 — `/auth/register` renders normally when registration is enabled**

**Given** registration is enabled (`registrationEnabled === true`)
**When** a user navigates to `/auth/register`
**Then** the registration form renders as before — no regression

**AC3 — `/auth/register` shows nothing while config is loading**

**Given** `registrationEnabled` is still `null` (config not yet fetched)
**When** a user is at `/auth/register`
**Then** the page renders nothing — no form flash before the redirect decision

**AC4 — the create-user dialog stays open and shows the error on mutation failure**

**Given** the admin opens the "Create user" dialog, fills in fields, and clicks "Create"
**When** the backend returns a GraphQL error (for example, a duplicate username)
**Then** the dialog remains open
**And** the error is displayed in an `Alert` inside the dialog
**And** the "Create" button becomes interactive again rather than sticking in its loading state

**AC5 — the delete and reset dialogs behave the same way**

**Given** the admin confirms a delete or a password reset
**When** the backend returns a GraphQL error
**Then** the dialog remains open, the error is shown in an `Alert`, and Cancel remains interactive

**AC6 — concurrent registration TOCTOU regression test**

**Given** two concurrent `POST /auth/register` requests carrying the same username
**When** both are submitted simultaneously in a test
**Then** exactly one returns `200 OK` and one returns `400 Bad Request`

**AC7 — the unhappy-path checklist is structural, not advisory**

**Given** Story 3.1 is complete
**Then** an unhappy-path and concurrency design checklist exists
**And** it is embedded in the story `template.md`, so every later story includes it automatically

### Story 3.2: E2E Test Coverage — Admin Panel

As a developer maintaining bag-please,
I want Playwright E2E tests covering all Epic 2 admin UI flows,
So that regressions in user management and registration configuration are caught before reaching production.

**Acceptance Criteria:**

**AC1 — create user**

**Given** the admin is on `/admin/users`
**When** they click "Create user", fill in a unique username and password, and click "Create"
**Then** the new user row appears in the table immediately, without a page reload

**AC2 — delete user**

**Given** the admin is on `/admin/users` and a test user exists
**When** the admin clicks that user's delete icon and confirms in the dialog
**Then** the user row is removed from the table

**AC3 — reset password**

**Given** the admin is on `/admin/users` and a test user exists
**When** the admin clicks the reset-password icon, fills a new password, and clicks "Reset"
**Then** the dialog closes with no error `Alert` visible

**AC4 — registration toggle, disable**

**Given** registration is currently enabled
**When** the admin toggles "Allow public registration" off and navigates to `/auth`
**Then** the "Contact your admin to get access" text is visible and the "Register" link is absent

**AC5 — registration toggle, enable**

**Given** registration is currently disabled
**When** the admin toggles "Allow public registration" on and navigates to `/auth`
**Then** the "Register" link is visible and the "Contact your admin" text is absent

**AC6 — admin guard redirects a non-admin**

**Given** a logged-in regular user navigates to `/admin/users`
**When** the admin guard evaluates
**Then** the user is redirected to `/`

**AC7 — "User Management" navigation visibility**

**Given** the admin opens the navigation menu
**When** the menu renders
**Then** a "User Management" item is visible
**And** that item is **not** rendered in a non-admin user's navigation menu

**AC8 — the suite starts its own stack**

**Given** `playwright.config.ts` carries a `webServer` block
**When** `npm run test:e2e` is run with no stack running (non-CI, `reuseExistingServer: true`)
**Then** Playwright starts the stack via `docker compose up -d` and the tests proceed

**Outcome (from `epic-3-retro-2026-05-18.md`):** 8 new tests joined the 8 existing ones, all 16 passing; 0 production
incidents; 8 further items filed to deferred work (webServer config gaps, the TOCTOU test's simultaneity caveat, and
auth-config failure edge cases).

---

## Epic 4: Personal Lists & Sharing

All data is scoped to lists. Each user owns their own lists, can share any list with other users by username, and collaborators receive full peer write access. Existing items are migrated to a default list on first deploy. The frontend moves to bottom tab navigation (Today · Lists · Household). Item lifecycle becomes explicit: one-timers auto-delete on check-off, recurring items restore automatically at the configured cadence. The backend introduces per-list authorization enforced at the service layer via `CallerUsername`, authenticated WebSocket subscriptions, and an idempotent startup migration.

### Story 4.1: List Entity Backend — CRUD, Authorization & Migration

As an authenticated non-admin user,
I want my items and categories scoped to a specific list I own,
So that my data is private to me and my collaborators from the moment Epic 4 ships.

**Acceptance Criteria:**

**Given** the `entity/list/` vertical slice is implemented (`List.kt`, `ListStorage.kt`, `ListService.kt`, `GqlList.kt`, `GqlListMapper.kt`, `ListApi.kt`, `MongoList.kt`, `MongoListMapper.kt`, `ListRepository.kt`) following the existing `entity/item/` pattern
**When** any list GQL operation is invoked
**Then** all layers compile and the GQL schema includes `lists`, `createList`, `deleteList` operations

**Given** `@JvmInline value class CallerUsername(val value: String)` is defined in `features/auth/CallerUsername.kt`
**When** a GQL resolver constructs it from `principal.username`
**Then** it is the only valid entry point for caller identity into the service layer; service and storage methods never accept raw `String` usernames for caller identity

**Given** `ItemStorage` and `CategoryStorage` are refactored to nested `ConcurrentHashMap<UUID, ConcurrentHashMap<UUID, Entity>>` (listId → entityId → entity) using `computeIfAbsent`
**When** `sync()` runs for either storage
**Then** it executes a single MongoDB `find()` over all documents in that collection, groups results in memory by `listId`, and populates the nested map in one pass
**And** the `synced` flag is set to `true` after this first call

**Given** `evictList(listId)` is called on `ItemStorage` or `CategoryStorage`
**When** the eviction completes
**Then** the inner map for `listId` is removed from the outer map
**And** the `synced` flag is NOT reset — subsequent reads do not trigger a full re-sync
**And** items and categories for all other `listId`s are unaffected
**And** a subsequent `items(listId)` call on the evicted list returns an empty result — not phantom data re-populated from MongoDB re-sync

**Given** a non-admin authenticated user calls `createList(name: "Groceries", emoji: "🛒")`
**When** the mutation resolves
**Then** a List document is created in MongoDB with `ownerId` = caller's userId, `members: [ownerId]`, `origin: "USER_CREATED"`
**And** the GQL response returns the new list's `id`, `name`, `emoji`, and `ownerId`

**Given** a non-admin authenticated user calls `createList` with `emoji` omitted or null
**When** the mutation resolves
**Then** the list is created with `emoji: null`; emoji is optional in the GraphQL input type and in the List output type

**Given** a non-admin authenticated user calls `createList` with a name longer than 100 characters
**When** the mutation is processed
**Then** a GQL validation error is returned specifying the max-length constraint
**And** no list document is written to MongoDB

**Given** an authenticated user calls `lists`
**When** the query resolves
**Then** only lists where the caller's userId is in `members` OR equals `ownerId` are returned
**And** lists the caller is not a member of are never included

**Given** a newly registered user (no existing lists) calls `lists` after Epic 4 deployment
**When** the query resolves
**Then** an empty array is returned
**And** no default list is auto-created; the frontend is responsible for the empty-state experience

**Given** the list owner calls `deleteList(id)` on a list they own
**When** the mutation resolves
**Then** items are deleted from MongoDB first, then categories, then the list document (in that order — this order enables partial-failure recovery via lazy-sync guard)
**And** `ItemStorage.evictList(listId)` and `CategoryStorage.evictList(listId)` are called after the MongoDB deletes succeed
**And** the GQL response returns `DeleteListResult { deletedItemCount: Int, deletedCategoryCount: Int }`

**Given** a non-owner authenticated user calls `deleteList(id)` on a list they are a member of
**When** the mutation is processed
**Then** a GQL error is returned — not an empty result, not HTTP 401
**And** the list, its items, and its categories are unchanged in MongoDB

**Given** `deleteList` successfully evicts from storage but the MongoDB item delete subsequently fails
**When** the partial failure is detected
**Then** a GQL error is returned
**And** the next `items(listId)` call re-syncs from MongoDB via the lazy-sync guard, recovering the still-present items
**And** the list document is not deleted until all cascade deletes (items → categories) succeed

**Given** `ListService.verifyMembership(caller: CallerUsername, listId: UUID)` is implemented as a suspend function using Arrow `raise` pattern (raising a typed `ListAuthError` if the caller is not a member)
**When** any service method reads or writes list-scoped data
**Then** `verifyMembership()` is the FIRST operation in that method, before any data access
**And** on failure it raises `ListAuthError`, which the GQL layer maps to a GQL error response (not an empty result)

**Given** `items(listId: ID!)` or `categories(listId: ID!)` is called by a caller who is not a member of `listId`
**When** `verifyMembership()` raises
**Then** a GQL error is returned immediately with no data accessed or returned

**Given** `saveItem` mutation is called with a `listId` in `ItemInput`
**When** the item is created or updated
**Then** the item is stored under the `listId` key in the nested storage map
**And** the item's `listId` is persisted to MongoDB

**Given** `saveItem` is called without a `listId` in `ItemInput`
**When** the mutation is processed
**Then** a GQL validation error is returned specifying that `listId` is required
**And** no item is created or modified

**Given** the admin account calls any of `createList`, `lists`, `items(listId)`, `categories(listId)`, or `deleteList`
**When** the service layer processes the request
**Then** a GQL error is returned for all these operations
**And** the block is enforced at the service layer (not only the GQL resolver) for defense in depth
**And** the error message communicates that admin accounts cannot manage lists *(this is a deliberate product decision — admins are operators, not list users; admin has no support-level read access to user lists in Epic 4)*

**Given** `itemUpdates(listId: ID!)` and `categoryUpdates(listId: ID!)` subscription schema is updated
**When** a subscription event fires
**Then** `listId` is present and required as a filter parameter in the schema
**And** each subscription event payload includes `listId: ID!` as a field, so the frontend can route events to the correct list when multiple lists are in state
**And** `npm run generate` produces updated TypeScript types for these operations *(this is the gate for all frontend stories that depend on these subscriptions)*

**Given** the application starts for the first time after Epic 4 deployment with existing items/categories that have no `listId`, and `MIGRATION_TARGET_USER` is set to a valid non-admin username
**When** `plugins/Migration.kt` runs before `configureRouting()` and finds no `{type: "epic4-list-seed", complete: true}` record in `app_migrations`
**Then** a default list (`name: "Groceries"`, `emoji: "🛒"`, `origin: "MIGRATED"`) is created and owned by that user
**And** all existing items and categories are updated with the new list's `id` in MongoDB
**And** a completion record `{type: "epic4-list-seed", complete: true, ranAt: <timestamp>}` is written to `app_migrations`

**Given** the application restarts after a completed migration
**When** `app_migrations` already contains `{type: "epic4-list-seed", complete: true}`
**Then** the migration is skipped entirely; no list is created; no items are modified

**Given** `MIGRATION_TARGET_USER` is not set and unscoped items exist in the items collection
**When** `Migration.kt` evaluates whether migration is needed
**Then** startup fails with: `"Epic 4 migration required but MIGRATION_TARGET_USER env var is not set. Set this to the username of the list owner before deploying."`
**And** the app does not start

**Given** `MIGRATION_TARGET_USER` is set but that username does not exist in the `users` collection
**When** `Migration.kt` attempts to resolve the target user
**Then** startup fails with: `"Epic 4 migration failed: MIGRATION_TARGET_USER '{username}' not found in users collection. Create this user before deploying Epic 4."`
**And** the app does not start

**Given** the application starts on a fresh install with no users and no items in MongoDB
**When** `Migration.kt` evaluates whether migration is needed (no `app_migrations` record, no unscoped items)
**Then** the migration is skipped with no error and no `app_migrations` record is written *(the completion record is only written when data is actually migrated)*

**Given** `Migration.kt` evaluates whether to run
**When** the detection logic executes
**Then** it checks `app_migrations` first — if a completion record exists, it skips immediately
**And** if no completion record, it queries the `items` collection for any documents missing the `listId` field
**And** only if unscoped items exist does it proceed with the migration (requiring `MIGRATION_TARGET_USER`)

**Technical Notes:**

- `lists` MongoDB collection schema: `_id` (UUID via `UUIDMongoSerializer`), `name` (String, max 100), `emoji` (String?, nullable), `ownerId` (UUID), `members` (List\<UUID\>), `origin` (String: `"USER_CREATED"` | `"MIGRATED"`), `createdAt` (Instant)
- `app_migrations` collection schema: `type` (String, idempotency key), `complete` (Boolean), `ranAt` (Instant)
- `deleteList` cascade order: items → categories → list document; this order ensures the lazy-sync guard can recover from partial failure
- `listId` is required (non-nullable) in `ItemInput` GraphQL input type
- `emoji` is optional (nullable) in `createList` input and in the `List` GQL output type
- `verifyMembership` uses Arrow `raise` pattern; the GQL layer maps `ListAuthError` to a GQL error response (not an empty result)
- **Sharing and member management (FR39, FR40, FR55) are explicitly out of scope for this story** — the `members` field is structural groundwork only; it is populated with `[ownerId]` at creation; member additions come in Story 4.3
- `MIGRATION_TARGET_USER` env var has no default; startup fails with a descriptive message if unset when migration is needed
- `@GraphQLName` required on `GqlList` and all GQL input/output types per project convention

**Test Requirements:**

- Negative membership path: caller not a member of `listId` → `verifyMembership` raises → GQL error returned (not empty result)
- Cross-tenant isolation: User A cannot access User B's list `items` or `categories`
- `evictList` both storages: after `evictList(listId)`, both `ItemStorage` and `CategoryStorage` return empty for that `listId`; a different `listId` is unaffected
- Phantom data guard: `evictList(listId)` followed immediately by `items(listId)` returns empty — not re-populated from MongoDB re-sync
- Admin block: admin caller on each of `createList`, `lists`, `items(listId)`, `categories(listId)`, `deleteList` → GQL error for each (not empty, not 401)
- `deleteList` cascade: after deletion, MongoDB items and categories for that `listId` are gone; a different list's items are untouched
- Migration idempotency: run migration twice against same MongoDB state → exactly one `app_migrations` record; item `listId` values unchanged on second run
- Migration failure — user not found: `MIGRATION_TARGET_USER` set but user absent → startup exception with exact expected message
- Migration failure — env var missing: `MIGRATION_TARGET_USER` unset, unscoped items present → startup exception with exact expected message
- Migration clean slate: no users, no items → migration skips, no error, no `app_migrations` record written
- *Test fixture note: migration tests must seed the `users` collection with at least one non-admin user via the GraphQL mutations API before running migration assertions*

### Story 4.2: WebSocket Auth & Per-List Subscription Scoping

As a list member,
I want real-time item and category updates to be delivered only to members of my list,
So that my data never leaks to users of other lists and my subscriptions are as secure as the rest of the API.

**Acceptance Criteria:**

**Given** a frontend client establishes a WebSocket connection to `/api/subscriptions`
**When** the connection init frame is sent
**Then** the backend validates the JWT supplied in `connectionParams.Authorization` (`Bearer <token>`) before establishing any subscription stream
**And** connections with a missing, malformed, or expired JWT are rejected immediately with a `4401` close code

**Given** a valid JWT is supplied and the connection is established
**When** the token expires during an active subscription session
**Then** the backend closes the WebSocket connection with an appropriate close code
**And** the frontend receives the close event

**Given** a client calls `itemUpdates(listId: ID!)` over an authenticated WebSocket
**When** the subscription is established
**Then** `listService.verifyMembership(caller, listId)` is called at subscribe time (Point 1)
**And** if the caller is not a member, the subscription is rejected with a GQL error — no events are ever delivered

**Given** a member's subscription to `itemUpdates(listId)` is active
**When** an item mutation event is emitted for that `listId`
**Then** `.takeWhile { listService.isMember(caller, listId) }` re-evaluates membership on every emitted event (Point 2)
**And** if the caller has been removed from the list since subscribing, the next emitted event terminates the flow — no further events are delivered to the removed member

**Given** two lists exist with active subscribers on each
**When** an item is mutated in list A
**Then** only subscribers to list A's `itemUpdates` receive the event
**And** subscribers to list B receive no event — no cross-list leakage under any circumstances

**Given** `categoryUpdates(listId: ID!)` subscription follows the same scoping rules
**When** a category mutation event is emitted
**Then** Point 1 (subscribe-time membership gate) and Point 2 (`takeWhile` per-event re-evaluation) are both enforced identically to `itemUpdates`

**Given** the frontend `ApolloWrapper.tsx` is updated to supply `connectionParams`
**When** the WebSocket connection is initiated
**Then** `connectionParams` supplies `{ Authorization: "Bearer <accessToken>" }` sourced from `AuthContext.accessToken` (not from `localStorage`)

**Given** `clearAuth()` is called (logout or password reset)
**When** the auth state is cleared
**Then** the sequence is strictly: `client.dispose()` → clear React auth state
**And** `client.dispose()` executes before auth state is cleared, preventing orphaned in-flight subscription events from reaching React state after logout

**Given** an unauthenticated user (no token) attempts to access a protected route and the WebSocket client has not been initialized
**When** the app initialises
**Then** no WebSocket connection is attempted until a valid access token is present in `AuthContext`

**Technical Notes:**

- Both enforcement points are mandatory — Point 1 alone misses mid-session membership revocation; Point 2 alone allows an unauthenticated initial subscription
- `isMember(caller, listId)` must be a lightweight in-memory check against `ListStorage` — not a MongoDB round-trip per event
- WebSocket close codes: `4401` for auth failure on connection init; standard `1000` or `1001` for token expiry close
- Backend implementation lives in the existing `GQL.kt` `configureGql()` function, extending the existing subscription setup
- `clearAuth()` is defined in `AuthContext.tsx`; the dispose-before-clear ordering is a required implementation note, not an optional best practice
- Subscription SharedFlow per-entity pattern still applies — `MutableSharedFlow` instances are unchanged; scoping is applied at the subscriber/collector level via `verifyMembership` + `takeWhile`, not by routing to per-list flows

**Test Requirements:**

- Unauthenticated connection rejected: WebSocket connect without JWT → `4401` close, no subscription established
- Expired token rejected: valid JWT at connect time, token expires mid-session → backend closes connection
- Subscribe-time membership gate: caller not a member of `listId` at subscribe time → subscription rejected, zero events delivered
- Mid-session removal: caller is a member at subscribe time, then removed → next emitted event terminates the flow, no further events delivered to removed member
- Cross-list isolation: item mutation in list A → subscribers of list B receive zero events (assert via two concurrent test subscriptions)
- `clearAuth()` ordering: assert `client.dispose()` is called before React auth state is cleared
- `connectionParams` sourced from `AuthContext`: assert the WS link reads `AuthContext.accessToken`, not `localStorage`

### Story 4.3: List Sharing Backend — Pending Invites & Member Management

As a list owner,
I want to share my list with other registered users and manage membership,
So that collaborators can join, contribute, or be removed, and members can leave lists they no longer need.

**Acceptance Criteria:**

**Given** the list owner calls `shareList(listId: ID!, username: String!)`
**When** the mutation resolves
**Then** a `ListMember` record is created with `{ userId, listId, status: PENDING }` in the `list_members` MongoDB collection
**And** the target user's userId is NOT added to the `List.members` array yet — membership becomes active only on acceptance
**And** the GQL response returns the updated list including the new pending member with their `status`

**Given** `shareList` is called with a username that does not exist in the `users` collection
**When** the mutation is processed
**Then** a GQL error is returned: `"User '{username}' not found"`
**And** no `ListMember` record is created

**Given** `shareList` is called with a username who is already an active member or has a pending invite
**When** the mutation is processed
**Then** a GQL error is returned with a specific message distinguishing the case: `"User '{username}' is already a member"` or `"User '{username}' already has a pending invite"`
**And** no duplicate `ListMember` record is created

**Given** `shareList` is called with the owner's own username
**When** the mutation is processed
**Then** a GQL error is returned: `"You cannot share a list with yourself"`

**Given** a non-owner list member calls `shareList`
**When** the mutation is processed
**Then** a GQL error is returned — only the list owner can share
**And** no `ListMember` record is created

**Given** a user has a pending invite (status: `PENDING`) to a list
**When** the invited user calls `acceptInvite(listId: ID!)`
**Then** the `ListMember` record status is updated to `ACCEPTED`
**And** the user's userId is added to the `List.members` array in MongoDB
**And** the user can now call `items(listId)`, `categories(listId)`, and subscribe to `itemUpdates(listId)` successfully

**Given** a user has a pending invite (status: `PENDING`) to a list
**When** the invited user calls `rejectInvite(listId: ID!)`
**Then** the `ListMember` record status is updated to `DECLINED`
**And** the user's userId is NOT added to `List.members`
**And** the list does not appear in the user's `lists` query result

**Given** a user attempts to call `items(listId)` or `categories(listId)` on a list where their invite is still `PENDING`
**When** `verifyMembership()` evaluates the caller
**Then** a GQL error is returned — pending status does not grant data access

**Given** the list owner calls `removeMember(listId: ID!, username: String!)`
**When** the mutation resolves
**Then** the target user's userId is removed from `List.members` in MongoDB
**And** the `ListMember` record status is updated to reflect removal (or the record is deleted)
**And** the removal takes effect on the removed member's next list data access — their active subscription terminates via the `takeWhile` membership re-evaluation on the next emitted event (Story 4.2 Point 2)

**Given** `removeMember` is called by a non-owner
**When** the mutation is processed
**Then** a GQL error is returned — only the list owner can remove members

**Given** `removeMember` is called targeting the list owner themselves
**When** the mutation is processed
**Then** a GQL error is returned: `"List owner cannot be removed — delete the list instead"`

**Given** a non-owner list member calls `leaveList(listId: ID!)`
**When** the mutation resolves
**Then** the caller's userId is removed from `List.members` immediately
**And** the `ListMember` record is deleted or status updated
**And** items the caller added remain on the list — they are not deleted
**And** the list no longer appears in the caller's `lists` query result

**Given** the list owner calls `leaveList` on their own list
**When** the mutation is processed
**Then** a GQL error is returned: `"List owner cannot leave — delete the list instead"`

**Given** the `lists` query is called by a user with pending invites
**When** the query resolves
**Then** the response includes a separate `pendingInvites` field so the frontend can render the accept/reject UI
**And** pending lists are not included in the main owned/member lists section

**Technical Notes:**

- New MongoDB collection: `list_members` with schema: `listId` (UUID), `userId` (UUID), `status` (String: `"PENDING"` | `"ACCEPTED"` | `"DECLINED"`), `createdAt` (Instant)
- `List.members` array contains only `ACCEPTED` userIds — it is the authoritative fast-path for `verifyMembership()` and `isMember()` checks; `list_members` is the source of truth for invite status
- `verifyMembership()` checks `List.members` (in-memory via `ListStorage`) — not `list_members` — so accepted membership is reflected immediately without an extra DB lookup
- `shareList` resolves username → userId via `UserRepository` (a DB call per the existing pattern)
- All mutations in this story must be rejected for admin callers (same service-layer admin block as Story 4.1)
- `removeMember` and `leaveList` do NOT cascade-delete the removed user's items — items remain on the list with their `addedBy` field intact
- List-level subscription events (membership changes) are out of scope for this story — list-level events are driven by the frontend's next `lists` query fetch, not a subscription push in Epic 4

**Test Requirements:**

- `shareList` happy path: invite created with `PENDING` status, not yet in `List.members`
- `shareList` errors: unknown username, already member, already pending, self-share, non-owner caller — each returns a distinct descriptive GQL error
- `acceptInvite`: status → `ACCEPTED`, userId added to `List.members`, `items(listId)` now succeeds for that user
- `rejectInvite`: status → `DECLINED`, userId NOT in `List.members`, list absent from `lists` query
- Pending does not grant access: `items(listId)` with `PENDING` status → GQL error
- `removeMember`: userId removed from `List.members`; removed member's items remain; non-owner caller → GQL error; owner self-remove → GQL error
- `leaveList`: caller removed from `List.members`; their items remain; owner leave → GQL error
- `lists` query: pending invites appear in `pendingInvites` field, not in main lists section

### Story 4.4: Item Lifecycle Backend — Extended Fields, One-Timer & Recurring Scheduler

As a list member,
I want items to carry a store, lifecycle designation, and authorship,
So that one-timers clean themselves up automatically, recurring items reappear at the right cadence, and everyone can see who added what.

**Acceptance Criteria:**

**Given** `Item.kt` is updated with new fields: `store: String?`, `recurring: Recurring?`, `addedBy: String?`, `deleted: Boolean = false`, `deletedAt: Instant?`, `checkedAt: Instant?`
**When** `saveItem` is called with or without these fields
**Then** all fields are persisted to MongoDB and returned in GQL responses
**And** `addedBy` is populated from `principal.username` in the GQL resolver — it is NOT part of `ItemInput`; clients cannot supply or override it
**And** items created by the migration (Story 4.1) have `addedBy: null`

**Given** `saveItem` is called with `store: "Pharmacy"` in `ItemInput`
**When** the item is saved
**Then** the `store` field is persisted and returned on subsequent `items(listId)` queries

**Given** `saveItem` is called with `recurring: WEEKLY` in `ItemInput`
**When** the item is saved
**Then** `item.recurring = Recurring.WEEKLY` is persisted to MongoDB as the string `"WEEKLY"`
**And** `recurring` is exposed in the GQL schema as a String (not a GQL enum) for forward compatibility

**Given** `saveItem` is called for a new item without specifying `recurring`
**When** the item is saved
**Then** `item.recurring = null` — a regular item that persists across check-offs with no lifecycle behaviour

**Given** a list member calls `checkItem(id: ID!, listId: ID!)` on a regular item (`recurring: null`)
**When** the mutation resolves
**Then** `item.checked = true` is persisted and the item remains in the list

**Given** a list member calls `checkItem` on a recurring item (`recurring: WEEKLY`, `BIWEEKLY`, or `MONTHLY`)
**When** the mutation resolves
**Then** `item.checked = true` and `item.checkedAt = now()` are persisted
**And** the item remains visible — no deletion, no scheduling performed at check-off time

**Given** a list member calls `checkItem` on a one-timer item (`recurring: ONE_TIME`)
**When** the mutation resolves
**Then** `item.deleted = true` and `item.deletedAt = now()` are persisted (soft-delete)
**And** the item is excluded from all subsequent `items(listId)` query results
**And** the GQL response signals the soft-delete so the frontend can start the 5-second undo window

**Given** a list member calls `uncheckItem(id: ID!, listId: ID!)` on a soft-deleted one-timer (within the undo window)
**When** the mutation resolves
**Then** `item.deleted = false` and `item.deletedAt = null` are cleared
**And** the item reappears in `items(listId)` query results

**Given** `items(listId)` is queried
**When** the query resolves
**Then** items with `deleted: true` are always filtered out — soft-deleted items are invisible to all GQL queries

**Given** the hourly background scheduler runs
**When** it processes recurring items
**Then** it queries using the `{listId, recurring, checkedAt}` compound index for items where `checked = true` AND `recurring` is not null and not `ONE_TIME` AND the cadence has elapsed since `checkedAt` (WEEKLY = 7 days, BIWEEKLY = 14 days, MONTHLY = 30 days)
**And** for each matched item it sets `checked = false` and clears `checkedAt`
**And** each item is restored exactly once per run regardless of how many cadence cycles have been missed

**Given** the hourly background scheduler runs
**When** it processes soft-deleted one-timers
**Then** it queries using the `{deleted, deletedAt}` compound index for items where `deleted = true` AND `deletedAt` is older than 1 hour
**And** for each matched item it permanently hard-deletes the document from MongoDB and evicts it from `ItemStorage`

**Given** the scheduler runs against a clean database (nothing to restore, nothing to hard-delete)
**When** it completes
**Then** it performs zero writes and logs a no-op completion — never treated as a failure

**Given** the application starts
**When** `Application.module()` initialises
**Then** the hourly scheduler is registered via `configureScheduler()` in `plugins/` as a coroutine that fires immediately on start, then every 60 minutes
**And** a missed run due to app restart self-heals on the next tick — no external state tracking required

**Given** `itemStoreSuggestions(listId: ID!)` is called by a list member
**When** the query resolves
**Then** it returns a distinct list of non-null `store` values from all items in that list
**And** `verifyMembership()` is called first; non-member caller receives a GQL error

**Technical Notes:**

- `Recurring` enum: `enum class Recurring { ONE_TIME, WEEKLY, BIWEEKLY, MONTHLY }` — `ONE_TIME` is a named value, not a boolean flag; `null` means regular (no lifecycle behaviour); GQL exposes recurring as String for forward compatibility
- Compound indexes added in `ItemRepository.init {}` block: `{listId, recurring, checkedAt}` and `{deleted, deletedAt}` — mandatory before scheduler runs in production
- `addedBy` is populated in the GQL resolver from `principal.username`, never from `ItemInput`
- Scheduler lives in `plugins/Scheduler.kt` as a `configureScheduler()` function using `launch { while(true) { runSchedulerCycle(); delay(1.hours) } }` pattern with an initial immediate run
- `checkItem` and `uncheckItem` mutations require `listId` parameter; `verifyMembership()` is the first call in each

**Test Requirements:**

- `addedBy` server-side: item created via mutation has `addedBy` = calling user's username; client-supplied value in input is ignored
- `store` round-trip: `saveItem` with store → `items(listId)` returns correct value
- `recurring` round-trip: each enum value persisted and returned; `null` item has no lifecycle behaviour on check-off
- One-timer soft-delete: `checkItem` on `ONE_TIME` item → `deleted: true`, item absent from `items(listId)`
- Undo restore: `uncheckItem` on soft-deleted item → `deleted: false`, item reappears
- Scheduler — recurring restore: seed `WEEKLY` item with `checked: true`, `checkedAt: 8 days ago`; run scheduler; assert `checked: false`, `checkedAt: null`
- Scheduler — no double-restore: run scheduler twice; item restored exactly once
- Scheduler — hard-delete: seed soft-deleted item with `deletedAt: 2 hours ago`; run scheduler; assert item absent from MongoDB
- Scheduler — no-op: clean DB; run scheduler; assert zero writes
- `itemStoreSuggestions`: returns distinct non-null store values; non-member caller → GQL error
- Compound index existence: assert both compound indexes exist in MongoDB after app start

### Story 4.5: Frontend Foundation — Theme, Navigation & Layout

As a user of bag-please,
I want the app to use a consistent visual system and bottom tab navigation,
So that the Epic 4 shopping experience feels coherent from the first screen.

**Acceptance Criteria:**

**Given** `src/lib/theme.ts` is created using `createTheme` (NOT `CssVarsProvider` — explicitly deferred)
**When** the theme is applied via `ThemeProvider` in the root layout
**Then** the MUI palette maps all tokens from `design/theme.js`: `background.default: #F2F2F7`, `background.paper: #FFFFFF`, `palette.primary.main: #2AA396`, `palette.error.main: #FF3B30`, `palette.success.main: #34C759`, `palette.text.primary: #000000`, `palette.text.secondary: rgba(60,60,67,0.6)`, `palette.divider: rgba(60,60,67,0.18)`
**And** custom tokens are accessible via `theme.custom.bp.{bg2, card, ter, navBg, accentSoft}` using TypeScript module augmentation

**Given** the TypeScript module augmentation for `theme.custom.bp` is in place
**When** a component accesses `theme.custom.bp.bg2`
**Then** TypeScript resolves the type without error; accessing undefined custom keys is a compile-time error

**Given** `lib/theme.ts` is the single source of truth for all color and shape tokens
**When** a component uses an `sx` prop
**Then** an ESLint rule (configured in `.eslintrc` or `eslint.config.mjs`) flags any `sx` object containing `color`, `bgcolor`, `borderRadius`, `fontFamily`, or `fontSize` keys and directs the author to `theme.ts` instead
**And** this rule is enforced in CI — a violation fails the lint check

**Given** the typography system is configured in `createTheme`
**When** MUI components render
**Then** `body1` is `1.0625rem / 1.3` (17px), `body2` is `0.8125rem / 1.4` (13px), `fontFamily` is `'Roboto, sans-serif'`
**And** the Inter font import is removed from the project

**Given** `lib/theme.ts` defines the light palette
**When** the file is read
**Then** a commented `darkPalette` stub is present showing the full palette shape for future dark mode implementation
**And** contrast exception comments are present: teal `#2AA396` passes for UI components and large text only (3.04:1), error red `#FF3B30` marginal for body text (4.02:1) — never use either for text under 18px

**Given** `BPBottomNav` is created as a composed MUI `BottomNavigation` + `BottomNavigationAction` component
**When** it renders
**Then** it displays three tabs: Today, Lists, Household — with appropriate icons
**And** the active tab is determined by an explicit `pathname → tab` map using `usePathname()` — not auto-derived
**And** the background uses `theme.custom.bp.navBg` (`rgba(242,242,247,0.82)`) for the frosted appearance
**And** all scrolling screens have `padding-bottom: 96px` applied to prevent content scrolling behind the nav bar

**Given** `app/layout.tsx` is updated
**When** the layout renders
**Then** `AppHeader` and `Navigation` (drawer) are removed
**And** `BPBottomNav` is rendered as the persistent bottom navigation
**And** the root container uses `maxWidth: 480, mx: 'auto'` for centered layout on screens wider than 480px
**And** `height: '100vh'` is replaced with `100dvh` to account for mobile browser chrome

**Given** `app/page.tsx` (the root route `/`) is updated
**When** an authenticated user with at least one list visits `/`
**Then** they are redirected to `/list/[oldestListId]` (oldest by `createdAt`)

**Given** an authenticated user with no lists visits `/`
**When** the redirect logic runs
**Then** they are redirected to `/lists`

**Given** `app/store/` directory currently exists
**When** this story is complete
**Then** `app/store/` is deleted entirely — no parallel coexistence with `app/list/[listId]/` is permitted
**And** any imports referencing `app/store/` components are removed or replaced

**Technical Notes:**

- `createTheme` (not `extendTheme`) — standard `ThemeProvider` path; `CssVarsProvider` explicitly deferred until a future epic requires per-user theme switching
- No component may read `--bp-*` CSS variables directly from `:root` — all color references go through the MUI theme; add this as a comment in `lib/theme.ts`
- `BPBottomNav` active tab uses an explicit map: `{ '/list': 0, '/lists': 1, '/household': 2 }` evaluated against `usePathname()` with a `startsWith` check
- `app/store/` deletion is a hard requirement of this story — no story may leave both routes live simultaneously (AR-E4-11)
- The ESLint `no-sx-color` rule is a deliverable of this story, not a future backlog item
- `app/list/[listId]/page.tsx` scaffold (empty page with correct route structure) may be created here as a placeholder — full Today tab implementation is Story 4.7

**Test Requirements:**

- Theme tokens: assert `theme.palette.primary.main === '#2AA396'` and at least three other palette values match `design/theme.js`
- Custom tokens: assert `theme.custom.bp.navBg` resolves without TypeScript error
- ESLint rule: a file with `sx={{ color: 'red' }}` fails lint; a file with `sx={{ padding: 2 }}` passes
- `BPBottomNav` active state: visiting `/lists` highlights the Lists tab; visiting `/household` highlights Household
- Root redirect: authenticated user with lists → redirected to `/list/[id]`; user with no lists → redirected to `/lists`
- `app/store/` absent: assert the directory no longer exists after story completion
- `100dvh` present: assert `layout.tsx` does not contain `100vh`

### Story 4.6: Frontend — BPSheet Spike & Component

As a developer building Epic 4 sheet interactions,
I want a validated three-state bottom sheet component,
So that all create, edit, and share flows have a reliable, accessible interaction layer before any sheet story is estimated or built.

**Acceptance Criteria:**

**Given** `BPSheet` is implemented wrapping MUI `SwipeableDrawer` with three states: `'closed'`, `'peeked'`, `'open'`
**When** `state` prop changes or the user gestures
**Then** the sheet transitions through the state machine: `CLOSED → PEEKED → OPEN → PEEKED → CLOSED`
**And** swipe-down from `OPEN` moves to `PEEKED` (not directly to `CLOSED`)
**And** a second swipe-down from `PEEKED` moves to `CLOSED`
**And** back gesture follows the same two-step: `OPEN → PEEKED`, then `PEEKED → CLOSED`, with no route change and no history entry consumed on either step

**Given** the BPSheet spike is run on a real device or browser DevTools mobile emulation
**When** all four spike acceptance criteria are evaluated
**Then** (1) scroll inside an OPEN sheet on iOS Safari does not accidentally close the sheet
**And** (2) the iOS virtual keyboard viewport push does not fight the OPEN state focus trap
**And** (3) the PEEKED → OPEN height transition completes in under 16ms frame time on a mid-range Android device (Chrome DevTools CPU 4x throttle as proxy)
**And** (4) the back-gesture contract is correctly implemented: OPEN + back → PEEKED (no route change, no history entry consumed); PEEKED + back → CLOSED

**Given** `BPSheet` is in `OPEN` state
**When** the `Escape` key is pressed
**Then** the first `Escape` transitions `OPEN → PEEKED` via `onKeyDown` + `event.stopPropagation()` — MUI Modal's default one-press close is suppressed
**And** a second `Escape` from `PEEKED` allows MUI Modal close behaviour → `CLOSED`

**Given** `BPSheet` is in `OPEN` state
**When** the sheet is open
**Then** a focus trap is active — `Tab` cycles within sheet content only
**And** `disableEnforceFocus={false}` and `disableRestoreFocus={false}` are set on the underlying Modal (not overridden)

**Given** `BPSheet` accepts a `triggerRef?: React.RefObject<HTMLElement>` prop
**When** the sheet transitions to `CLOSED`
**Then** `triggerRef.current?.focus()` is called, restoring focus to the element that opened the sheet

**Given** `BPSheet` is opened
**When** the sheet enter animation completes (`transitionEnd`)
**Then** focus moves to the first focusable element inside the sheet — not on mount, on `transitionEnd`

**Given** `prefers-reduced-motion: reduce` is active
**When** `BPSheet` opens or closes
**Then** the translate/slide transition is replaced with an opacity crossfade — not an instant snap
**And** no spatial movement occurs

**Given** `BPSheet` is open and the scrim is tapped
**When** the tap registers
**Then** the sheet closes (transitions to `CLOSED`)

**Given** `BPSheet` has `role="dialog"`, `aria-modal="true"`, and `aria-label="{sheet title}"`
**When** a screen reader navigates to the open sheet
**Then** it announces the sheet as a dialog with the provided label

**Given** the spike concludes and criteria 1 or 3 fail
**When** the fallback decision is made
**Then** the fallback is a full-screen MUI `Dialog`; downstream sheet stories (4.7, 4.8, 4.9, 4.10) must be re-scoped before any are estimated; the decision is documented in a spike completion note appended to this story

**Props interface:**

```ts
interface BPSheetProps {
  state: 'closed' | 'peeked' | 'open'
  onStateChange: (state: 'closed' | 'peeked' | 'open') => void
  peekHeight?: number   // defaults to 200px
  title: string         // used for aria-label
  triggerRef?: React.RefObject<HTMLElement>
  children: ReactNode
}
```

**Technical Notes:**

- PEEKED is synthetic — `SwipeableDrawer open={true}` with `PaperProps.sx.height = peekHeight`; OPEN uses `height: '92%'`
- Back-gesture interception in Next.js App Router requires `history.pushState` sentinel entries or the Navigation API — exact mechanism resolved and documented in spike completion note
- `BPSheet` z-index must sit above `BPBottomNav`; use `theme.zIndex.drawer` (1200); bottom nav explicitly z-indexed below or hidden when sheet is open
- `react-swipeable` presence in `bp_front/package.json` must be confirmed during spike; install if absent
- Drag handle affordance required: visible pill at top of sheet disambiguates sheet swipe from inner list scroll

**Test Requirements:**

- State machine: programmatic `onStateChange` calls cycle through all transitions correctly
- Spike criteria 1–4: documented pass/fail in spike completion note (manual)
- Escape two-step: first Escape from OPEN → PEEKED (route unchanged); second Escape → CLOSED
- Focus trap: `Tab` from last focusable element wraps to first — does not escape to page content
- Focus restore: `triggerRef` element receives focus on sheet close
- Focus on open: first focusable element receives focus on `transitionEnd` (not on mount)
- Reduced-motion: no translate transition; opacity crossfade present
- Scrim tap closes sheet

### Story 4.7: Frontend — Today Tab, Shopping Loop & Core Components

As a list member,
I want a Today tab where I can see my active list's items, check them off, track progress, and switch between lists,
So that the core shopping loop works end-to-end in the browser.

**Acceptance Criteria:**

**Given** `app/list/[listId]/page.tsx` is implemented as the Today tab view
**When** a user navigates to `/list/[listId]`
**Then** the page calls `items(listId)` and `categories(listId)` GQL queries using the `listId` from the URL
**And** items are rendered grouped by category in `BPCategoryHeader` sections
**And** the `ProgressStrip` is rendered fixed below the toolbar, outside the scroll container

**Given** `app/list/[listId]/error.tsx` is implemented
**When** the current user is not a member of `listId` (GQL auth error returned)
**Then** the error boundary catches the error and redirects to `/lists`

**Given** `ListChipRow` is rendered at the top of the Today tab
**When** the user has multiple lists
**Then** all their lists are shown as chips with item counts
**And** the active list's chip is visually distinguished and scrolled into view
**And** tapping a chip calls `router.push('/list/[id]', { scroll: false })` — the URL updates without a full page scroll-reset

**Given** `BPCheck` is implemented as a custom `<div>` element (NOT a MUI Checkbox wrapper)
**When** it renders
**Then** it has `role="checkbox"`, `aria-checked={checked}`, `tabIndex={0}`, and a required `ariaLabel` prop
**And** unchecked label is `"Check off {item.name}"`; checked label is `"{item.name}, checked"`
**And** `Space` key triggers `onChange`
**And** the circle animates from border to filled accent in 150ms ease-out on check
**And** when `BPCheck` receives keyboard focus, a 44×44px edit icon appears at the trailing edge of the `ItemCard` row

**Given** `ItemCard` is implemented with the anatomy: `[BPCheck 42px] [Body flex-1 (name 17px + meta line 13px)] [LifecycleBadge? trailing]`
**When** rendered without a lifecycle value
**Then** no badge is shown and the row height is 52px (Cozy density)

**Given** a user taps an `ItemCard` row (single tap on `BPCheck`)
**When** the `checkItem` mutation is dispatched with `optimisticResponse`
**Then** the UI marks the item checked immediately before server confirmation
**And** the `ProgressStrip` advances
**And** a Snackbar appears: `"Removed · Undo"` with a 5-second duration
**And** on mutation failure the item snaps back to unchecked and an inline `Alert` appears on the row

**Given** a user taps Undo within 5 seconds of a check-off
**When** the Undo action fires
**Then** the `uncheckItem` mutation is dispatched
**And** the item is restored to unchecked state
**And** the Snackbar is dismissed

**Given** all items in the active list have `checked: true`
**When** the last check-off resolves
**Then** `ProgressStrip` transitions its fill colour to `success.main`
**And** `aria-label` on `ProgressStrip` changes to `"All done"`
**And** the toolbar subtitle shows `"All done · {N} items"`
**And** this state reverts automatically if any item is unchecked

**Given** the active list has no items
**When** the Today tab renders
**Then** `EmptyState` is shown with title `"Nothing here yet"`, subtitle `"Add your first item"`, and an action that opens the add-item sheet

**Given** the user has no lists at all
**When** they land on the Today tab
**Then** `EmptyState` is shown with title `"Choose a list to start"` and subtitle `"Tap a list below"`

**Given** `SRContext` is implemented at `bp_front/src/contexts/SRContext.tsx`
**When** mounted at the page root
**Then** a visually-hidden `<div aria-live="polite" aria-atomic="false">` is present in the DOM
**And** `announceToSR(message: string)` is available via React context with a 1.5-second throttle/batch

**Given** an item is removed
**When** the removal is dispatched
**Then** `announceToSR("{item.name} removed")` is called before the exit animation starts

**Given** a category group has all its items checked
**When** the last item in the group is checked
**Then** the category header and its items disappear from view (collapse)
**And** this reverses if any item in the group is unchecked

**Given** `ItemCard` receives a subscription update for an item in the active list
**When** the update arrives
**Then** the item row reflects the new state without a manual refresh
**And** `document.activeElement` is unchanged — focus is not disrupted by the subscription update

**Technical Notes:**

- `ProgressStrip` uses a plain `Box` — NOT MUI `LinearProgress`; outer 6px rounded `bgcolor: bg2 overflow: hidden`; inner `width: {pct}%` with `transition: width 320ms cubic-bezier(0.2,0.7,0.2,1)`
- `ListChipRow`: `role="listbox"`, `aria-label="Switch list"`, `aria-multiselectable="false"`; each chip `role="option"`, `aria-selected`; arrow keys navigate; Tab focuses selected chip first; Skeleton chips when loading
- `ItemCard` long-press (500ms `pointerdown` timer, cancel on 10px `pointermove`) opens `SheetItemEditor` — wired here but opens a stub until Story 4.9
- `BPCategoryHeader` collapses when all items in the group are checked
- Snackbar replace-queue policy: new Snackbar immediately replaces existing one
- `ItemCardSkeleton` variant: left 42px circle Skeleton + two text line Skeletons; used during initial load and list switching
- `LifecycleBadge` is NOT part of this story — added in Story 4.9
- Subscription wiring requires Story 4.2 complete; if not yet merged, subscription ACs are deferred but all other ACs must pass

**Test Requirements:**

- Route renders: `/list/[listId]` loads items grouped by category for a member; non-member redirected to `/lists` via `error.tsx`
- Chip switching: tapping a chip calls `router.push` with `scroll: false`; active chip scrolled into view
- `BPCheck` ARIA: `role`, `aria-checked`, `ariaLabel` correct for checked and unchecked states; Space key triggers onChange
- `BPCheck` focus: edit icon appears on keyboard focus; 44×44px touch target
- Optimistic check-off: UI updates before server responds; mutation failure → snap back + inline Alert
- Undo: within 5 seconds, Undo fires `uncheckItem` and restores item
- `ProgressStrip`: advances on each check; reaches `success.main` when all checked; reverts on uncheck
- Completion state: toolbar subtitle `"All done · N items"` when all checked; reverts on uncheck
- Category group collapse: all items in group checked → header and items hidden; uncheck one → reappears
- Empty states: no items → correct copy; no lists → correct copy
- `SRContext`: `announceToSR` called before exit animation; live region present in DOM; throttle batches rapid calls
- `ItemCardSkeleton`: renders during loading with correct dimensions
- Subscription update: focus unchanged after remote item state change

### Story 4.8: Frontend — Lists Tab, List Management & BPAvatar

As a list owner,
I want a Lists tab where I can see all my lists, create new ones, and manage them,
So that I can organise my shopping across multiple lists from one place.

**Acceptance Criteria:**

**Given** `app/lists/page.tsx` is implemented as the Lists tab view
**When** an authenticated user navigates to `/lists`
**Then** the `lists` GQL query is called and the response is rendered as `ListCard` components — one per owned or member list
**And** a `pendingInvites` section is rendered below the main list, showing lists awaiting accept/reject with Accept and Reject buttons
**And** a FAB (bottom-right) is present to open `SheetNewList`

**Given** the user has no lists and no pending invites
**When** the Lists tab renders
**Then** `EmptyState` is shown with title `"No lists yet"`, subtitle `"Create your first list to start shopping"`, and a `"Create list"` action that opens `SheetNewList`

**Given** `ListCard` is implemented
**When** it renders for a list
**Then** it displays the list emoji (if present), name, member `BPAvatar` row, and unchecked item count
**And** a `⋯` `IconButton` (48×48px) opens a context menu with options: Rename, Share & Members, Delete
**And** tapping the card body (not the overflow button) navigates to `/list/[listId]`

**Given** the list owner taps Rename in the `ListCard` context menu
**When** inline rename activates
**Then** the list name becomes an editable text field directly on the card
**And** pressing Enter or tapping ✓ fires the `renameList` mutation with `optimisticResponse`
**And** pressing Escape cancels and restores the original name without a mutation

**Given** the list owner taps Delete in the `ListCard` context menu
**When** the Delete option is selected
**Then** a blocking MUI `Dialog` appears with body: `"Delete '{listName}'? This list and all {N} items will be permanently removed."`
**And** the Dialog has two buttons: `"Delete"` (`color="error"`) and `"Cancel"`
**And** confirming fires `deleteList` and shows a success Snackbar: `"'{listName}' deleted"`
**And** the list disappears from the Lists tab

**Given** a non-owner member taps the `⋯` menu on a shared list
**When** the context menu opens
**Then** Delete is NOT shown — only `"Leave list"` is shown in its place
**And** tapping Leave fires `leaveList` after a confirmation action sheet

**Given** `SheetNewList` is implemented using `BPSheet`
**When** the user opens it and types a list name
**Then** the sheet opens in PEEKED state with the name field focused
**And** the user can tap Create without ever opening to OPEN state
**And** tapping Create fires `createList(name, emoji?)` and on success navigates to `/list/[newListId]`
**And** if the name field has content and the user attempts to close the sheet, an unsaved-changes Dialog appears: `"Discard changes? / Discard / Keep editing"`
**And** on mutation failure a Snackbar shows: `"Couldn't create list · Retry"`

**Given** `SheetNewList` includes an optional emoji picker
**When** the user taps the emoji field
**Then** an inline emoji picker opens within the sheet (does not open a new sheet or navigate)
**And** selecting an emoji sets it as the list icon and closes the picker
**And** the name field remains focused after emoji selection

**Given** `BPAvatar` is rendered with `status='active'`
**When** it renders
**Then** it shows the user's initial in a MUI `Avatar` with no overlay
**And** `aria-label="{displayName}"` is set

**Given** `BPAvatar` is rendered with `status='pending'`
**When** it renders
**Then** a semi-transparent grey overlay (`rgba(0,0,0,0.35)`) covers the avatar with a 12px clock icon centred in white
**And** `pointer-events: none` on the overlay so the touch target is unaffected
**And** `aria-label="{displayName} (pending invite)"` is set

**Given** a pending invite's `status` changes from `PENDING` to `ACCEPTED`
**When** the prop update arrives
**Then** `BPAvatar` crossfades from the pending overlay to the clear avatar in 200ms opacity transition

**Given** the pending invites section shows a list invite
**When** the user taps Accept
**Then** `acceptInvite(listId)` fires; the invite moves from the pending section to the main lists section
**And** the list is now accessible via `/list/[listId]`

**Given** the user taps Reject on a pending invite
**When** `rejectInvite(listId)` fires
**Then** the invite disappears from the pending section with no confirmation dialog required

**Technical Notes:**

- `ListCard` inline rename is the only exception to the "sheets for all editing" rule — single text field, a full sheet is disproportionate
- `renameList` uses `optimisticResponse`; no success Snackbar — the name change is the confirmation
- `deleteList` and `leaveList` are async mutations (no `optimisticResponse`); success Snackbar confirms
- Unsaved-changes guard fires only for a dirty list name field in `SheetNewList` — not for emoji selection alone
- Auto-focus in `SheetNewList`: callback ref fires on sheet `transitionEnd`, not on component mount
- Submit button shows `CircularProgress` (18px, white) replacing label while `createList` is in flight; button disabled

**Test Requirements:**

- Lists tab: owned and member lists rendered; pending invites in separate section; FAB present
- Empty state: no lists + no invites → `EmptyState` with correct copy and Create action
- `ListCard` navigation: tap card body → navigates to `/list/[listId]`
- `ListCard` overflow menu: owner sees Delete; non-owner sees Leave instead
- Inline rename: Enter fires `renameList` optimistically; Escape cancels without mutation
- Delete Dialog: correct copy with list name and item count; confirms → `deleteList` + success Snackbar
- `SheetNewList`: opens in PEEKED with name field focused; Create fires `createList`; navigates on success; dirty-name close guard fires
- Emoji picker: selecting emoji sets list icon; name field focus retained
- `BPAvatar` active: no overlay; correct `aria-label`
- `BPAvatar` pending: grey overlay + clock icon; `aria-label` includes "(pending invite)"; `pointer-events: none` on overlay
- `BPAvatar` transition: pending → active triggers 200ms crossfade
- Accept invite: list moves to main section; accessible via navigation
- Reject invite: invite disappears; no confirmation required
- CI: tests run in `headed=false` mode; HTML report artifact retained

---

## Epic 5: Frontend Reframe — Vite + MUI + Caddy

The frontend is re-implemented from scratch as a **Vite + Material UI** single-page app served by **Caddy**, replacing
the Next.js app (`bp_front`) and the nginx reverse proxy (`routing/`). The existing Ktor / GraphQL backend is the system
of record and is consumed unchanged.

**Standing constraints for every Epic 5 story:**

- **Do not modify backend code.** The GraphQL schema and REST auth endpoints (`/api/*`, `/api/subscriptions`) are
  consumed as-is. Any required backend change must be confirmed with `md` before proceeding (reframe rule 2).
- **Every feature ships a real-browser Playwright E2E test.** Before writing the test, manually exercise the flow in a
  real browser to discover the steps and confirm it works (reframe rule 1). Tests are UI-driven (no API-only shortcuts)
  and FR-mapped.
- **Routing:** Caddy serves `/*` → frontend (SPA fallback), proxies `/api/*` → backend HTTP, `/api/subscriptions` →
  backend WebSocket.
- **Stack:** Vite + React + TypeScript, Material UI, Apollo Client (split link: HTTP for queries/mutations, WS for
  subscriptions), client-side routing (React Router) with auth/admin route guards.
- **Design reference:** `design/Bag Please.html` (and the accompanying `design/` assets — `components.jsx`, `app.jsx`,
  `data.js`, `Bag Please — Design.pdf`) is the **common visual style reference only** — palette, typography,
  look-and-feel. It is **not a functional prototype**; behavior, flows, and component structure are defined by the FRs
  and story ACs, not by the mockup.
- **Auth tokens:** access token held in memory (React context), refresh token via httpOnly cookie; no access token in
  `localStorage`.
- **Test account:** use `mia/mia` for list-feature browser/E2E flows; `admin` is blocked from list operations.

**Deferred from this epic:** one-timer items (FR42) and recurring items (FR43) — backend support remains; the UI
affordances are postponed.

### Story 5.1: Foundation — Vite + MUI + Caddy + Apollo Shell

As the team, we want a new Vite + MUI app scaffolded, wired to the backend through Caddy, with the auth/routing shell in
place, so that every subsequent feature story has a working foundation and a green E2E harness.

**Scope & Acceptance Criteria:**

- New Vite + React + TypeScript project created (replacing `bp_front`); MUI installed with the theme (
  palette/typography) derived from the `design/Bag Please.html` style reference (visual style only — not a functional
  prototype); app boots and renders a shell.
- **Caddy** added to `routing/` and `docker-compose.yml`, replacing nginx: `/*` → frontend with SPA fallback, `/api/*` →
  backend HTTP, `/api/subscriptions` → backend WebSocket. The old `bp_front` (Next.js) and nginx config are **removed**.
- Apollo Client configured with a split link: HTTP terminating link to `/api/graphql`, WebSocket link to
  `/api/subscriptions` for subscriptions; GraphQL codegen (`codegen.yml` / generate script) retargeted to the new source
  tree.
- Auth context provides `username`, `role`, `accessToken`, and `setAuth` / `clearAuth`; access token held in memory
  only.
- Client-side router with a protected-route layout: **auth guard** redirects unauthenticated users to `/auth` (FR29); *
  *admin guard** scaffolded for `/admin/*`.
- Playwright configured and running against the Caddy-served app; a smoke E2E proves the app loads and an
  unauthenticated visit to a protected route redirects to `/auth`.

**FRs:** infrastructure, FR29
**E2E:** app loads; unauthenticated → `/auth` redirect.

### Story 5.2: Authentication

As an unregistered or returning user, I want to register, log in, stay signed in, and log out, so that I can access my
own account securely.

**Scope & Acceptance Criteria:**

- **Auth page** (`/auth`): login form (username + password) with inline field errors; uniform "Invalid credentials"
  message on any auth failure (FR27); rate-limit feedback when the backend throttles attempts.
- **Register**: registration form; on success the user is auto-authenticated without a separate login step (FR4) and
  redirected into the app (FR1, FR2).
- **Register link is conditional**: hidden when public registration is disabled, with "contact your admin" guidance
  shown instead (FR21, FR32).
- **Logout** clears auth state and invalidates the session; user returns to `/auth` (FR3, FR10).
- **Silent token refresh**: an expired access token is renewed via the refresh endpoint without user interaction (FR6,
  FR7, FR8); when the refresh token is invalid, the user is redirected to `/auth` with a session-expiry message (FR9,
  FR33).

**FRs:** FR1–FR10, FR21, FR27, FR32, FR33
**E2E:** register → auto-login → logout → log back in; session-expiry redirect shows the expiry message;
registration-disabled hides the Register link.

### Story 5.3: User Account

As a signed-in user, I want to see who I am and manage my password, so that I control my own credentials.

**Scope & Acceptance Criteria:**

- Authenticated username is shown in the app navigation on every screen (FR12).
- **Change password** screen: current + new password fields, loading state, inline success confirmation (FR11).
- One-time **welcome message** shown the first time a user logs in right after registration; not persisted, disappears
  on dismiss/navigation (FR5).

**FRs:** FR5, FR11, FR12
**E2E:** change password then re-login with the new password; welcome message appears once after registration and not on
subsequent logins.

### Story 5.4: Admin User Management

As an admin, I want to manage user accounts and the registration toggle, so that I can control the user base.

**Scope & Acceptance Criteria:**

- `/admin/*` is reachable only by the admin role; non-admins are redirected (FR30, FR31).
- **Users table** lists all accounts with username and role; empty and loading states handled (FR13).
- **Create user** (username + initial password) (FR14).
- **Delete user** and **reset password**, each behind an explicit confirmation dialog; reset-password dialog includes
  the new-password field (FR15, FR16, FR17).
- **Registration toggle** (Switch) enables/disables public self-registration at runtime, reflected immediately on the
  auth page (FR20, ties to FR21).

**FRs:** FR13–FR17, FR20, FR30, FR31
**E2E:** admin creates a user, that user logs in; admin resets the user's password (confirm dialog), user logs in with
the new password; admin deletes the user; toggling registration off hides the Register link on `/auth`; a non-admin is
blocked from `/admin`.

### Story 5.5: Lists Management

As a user, I want to manage my lists and their categories and items, so that I can organize what I shop for.

**Scope & Acceptance Criteria:**

- **Lists index** shows all lists the user owns or is a member of; a zero-lists state gives onboarding guidance to
  create a first list (FR35, FR50).
- **Create list** (name required, emoji/icon, optional description) and **delete list** (owner-only; deletion removes
  the list and its items/categories) (FR34, FR37).
- **Category management** within a list: add and remove categories (scoped to the list).
- **Item management** within a list: add and remove items; new items/categories are always associated with a list at
  creation (FR46). Create/edit happen in overlays without losing place (FR51).

**FRs:** FR34, FR35, FR37, FR46, FR50, FR51
**E2E (account `mia/mia`):** create a list → add a category → add an item → remove the item → remove the category →
delete the list; owner-only delete enforced; zero-state shown when no lists exist.

### Story 5.6: List View, Shopping & Real-Time

As a user, I want to open a list and check items off with filtering and live updates, so that shopping is fast and
collaborative.

**Scope & Acceptance Criteria:**

- Route `/list/[listId]` loads that list's items; `/` redirects to the user's oldest list, or to the lists index if they
  have none (FR38).
- A **list switcher** (chip row) lets the user switch active lists; active list is reflected in the title and URL (
  FR36).
- Items are displayed **grouped by category**; each item can be **checked / unchecked** (FR40, FR49).
- **Filters**: by category, by checked status, and by free-text **search** (reframe step 7.1).
- Item rows show the optional **store** and the **addedBy** user (avatar/label) (FR44, FR45).
- **Real-time**: item add/check/edit/delete from any member appears live via per-list GraphQL subscription; the
  subscription connects over `/api/subscriptions` with the JWT in `connectionParams`; the WS client is disposed on
  logout (FR52, FR53).

**FRs:** FR36, FR38, FR40, FR44, FR45, FR49, FR52, FR53
**E2E:** open a list, check/uncheck items, apply each filter (category, checked, search); two-actor test — a second
member's change appears live without refresh; `/` redirects correctly.

### Story 5.7: Sharing & Membership

As a list owner or member, I want to share lists and manage membership, so that I can shop collaboratively and control
access.

**Scope & Acceptance Criteria:**

- Owner **shares a list** with another user by exact username; this creates a **pending invite**; sharing with an
  unknown user, an existing member, or oneself shows a specific error (FR39).
- Invited user sees the pending invite and can **accept or decline**; the list is inaccessible until accepted (FR39,
  ties to FR50).
- All members have full peer write access; unauthorized access to a list URL redirects away (FR40, FR41).
- **Member management**: owner can view members and **remove** any member; a non-owner member can **leave** a list (
  FR48, FR55).
- The **admin account is blocked** from all list operations — surfaced gracefully in the UI (FR56).

**FRs:** FR39, FR41, FR48, FR55, FR56
**E2E (two accounts):** owner shares with a second user → invite appears → accept → second user sees the list and edits
an item; owner removes the member; a member leaves a list; decline path removes the invite; admin cannot access list
features.

---

## Epic 6: Item Editing & Home Navigation

Two gaps the Epic 5 reframe left behind, both purely frontend. Users can change an item they already created — correct a
typo, move it to the right category, set or clear its store — instead of the delete-and-retype workaround that is the
only option today; and they can set a store while *adding* an item rather than having to go back and edit it. From
anywhere in the app they can reach home in one action, and the shopping view gains the back-to-lists affordance its
sibling management screen already has.

**Standing constraints for every Epic 6 story:**

- **The backend is frozen (AR-E6-0).** Both stories are frontend-only: no Kotlin file and no GraphQL schema change. Any
  backend need discovered mid-story stops the story and goes to `md`. This was challenged in review and re-affirmed.
- **Separation of intent (AR-E6-5).** `/lists/:id` is for *managing* a list; `/list/:id` is for *using* one. Item
  editing belongs to the manage surface; the shopping loop stays check-off-only and gains no edit or delete affordance.
- **Every story ships FR-tagged Playwright E2E passing on BOTH `chromium` and `mobile` (Pixel 7)**, against the
  production image on `:2080`. Each flow is manually exercised in a real browser before its test is written. Each spec
  registers its own fresh user through the UI and asserts only on data it created. `admin` is blocked from all list
  operations — use a registered regular user.
- **Epic 5 form, feedback, styling and testing conventions apply verbatim (AR-E6-9)** — each was paid for by a real bug:
  validate on submit only;
  `if (loading) return` re-entry guard; a real `catch` on every async branch; errors inline via `<Alert role="alert">`
  or
  `helperText`, never toasts; no success toast — the UI change is the confirmation; `helperText={… ?? ' '}` to reserve
  vertical space; on success `onClose()` → `void onDone().catch(() => {})`, never `await` a refetch inside the
  mutation's
  `try`.
- **MUI v9 APIs are looked up via the `mcp__mui-mcp__fetchDocs` MCP tool before writing components**, never recalled
  from v5/v6 memory. Styling is theme + `sx` only. Input testids go through
  `slotProps={{htmlInput: {'data-testid': …}}}`.
- **`src/__generated__/` is never hand-edited** — regenerate with `npm run generate` (stack on `:2080` + fresh
  `CODEGEN_TOKEN`).

**Story independence:** 6.1 and 6.2 share no file (6.1: `EditItemDialog.tsx`, `AddItemDialog.tsx`, `ListDetailPage.tsx`,
`listsQueries.ts`; 6.2: `AppShell.tsx`, `ListShoppingPage.tsx`). Neither depends on the other and either can be
implemented first. They are coupled only in experience: 6.2's navigation is the return path for 6.1's edit flow.

**Do not create a hidden forward dependency in the tests.** Story 6.1 asserts the store chip on the shopping view (AC5)
and a co-member's live update there (AC14). Those specs must reach `/list/:id` **by URL**, using navigation that shipped
in Epic 5 — never through Story 6.2's new title link or back link. If 6.1 is implemented first, routing its E2E through
6.2's affordances would make 6.1 un-completable on its own.

### Story 6.1: Edit an Item — Name, Category & Store with Suggestions

As a list member, I want to edit an item that I or a co-member already added — its name, its category, and the store it
belongs to — and to set a store while adding a new item, So that I can correct and refine a list in place instead of
deleting an item and retyping it.

**Delivers:** FR40 (the `edit` verb), FR44 (store write path + suggestions, both dialogs), NFR-E6-1, NFR-E6-3 **Files:**
new `src/components/EditItemDialog.tsx`, new shared store-field component, `src/components/AddItemDialog.tsx`,
`src/routes/ListDetailPage.tsx`, `src/lib/lists/listsQueries.ts`, regenerated `src/__generated__/`
**Reuses:** the existing `SaveItemMutation` document unchanged (same operation, same variables — an edit is a save with
the same `id`); `AddItemDialog`'s form conventions; `graphqlErrorMessage`; `ListDetailPage`'s existing `refetch()`

**Acceptance Criteria:**

**AC1 — the edit affordance exists and is reachable (UX-DR-E6-3, NFR-E6-3)**

**Given** I am a member of a list that has a category containing at least one item **When** I open the list management
view at `/lists/:id`
**Then** every item row shows an edit control alongside its existing remove control **And** the edit control carries an
item-specific accessible name (`Edit item {name}`), matching the existing
`Remove item {name}` idiom — not a bare "Edit"
**And** at a ~360px viewport both controls remain fully visible and tappable and the item name does not overlap them

**AC2 — the dialog opens seeded from the item it was opened on (UX-DR-E6-1)**

**Given** an item named "Bread" in category "Bakery" with store "Rewe"
**When** I activate that row's edit control **Then** an "Edit item" dialog opens with the name field pre-filled "Bread",
the category select set to "Bakery", and the store field pre-filled "Rewe"
**And** the name field holds focus **And** the seeding happens as a render-phase adjustment on the closed→open
transition (the `prevOpen` pattern), never a syncing `useEffect` — `react-hooks/set-state-in-effect` forbids it and
`npm run lint` must pass

**AC3 — a name change persists and is confirmed by the UI, not a toast (UX-DR-E6-4)**

**Given** the edit dialog is open on "Bread"
**When** I change the name to "Sourdough" and save **Then** the dialog closes and the row reads "Sourdough"
**And** no success toast or Snackbar is shown — the changed row is the confirmation **And** the item keeps its identity
(same `id`); no second item is created

**AC4 — a category change moves the item between groups**

**Given** the edit dialog is open on an item in "Bakery", and the list also has a "Produce" category **When** I change
the category to "Produce" and save **Then** the item appears under "Produce" and no longer under "Bakery"

**AC5 — a store can be set, changed and cleared (FR44)**

**Given** the edit dialog is open on an item with no store **When** I enter "Rewe" and save **Then** the item's row on
the shopping view shows the store chip "Rewe"
**And When** I edit the same item again, clear the store field, and save **Then** the store chip is gone from the row
**And** an empty or whitespace-only store is sent as `null`, never as an empty string

**AC6 — store suggestions come from the list's existing data (FR44, UX-DR-E6-2, AR-E6-4)**

**Given** the list already contains items with the stores "Rewe" and "Aldi"
**When** I open either the add-item or the edit-item dialog **Then** the list's distinct existing store values are
offered below the store field as clickable suggestions **And** activating a suggestion fills the store field with that
value **And** the field stays freely typable — a store not among the suggestions can be entered and saved **And When**
the list has no stores at all **Then** no suggestion row is rendered — not an empty container and not a "no suggestions"
placeholder **And** the suggestions are read via a newly authored `itemStoreSuggestions` operation in `listsQueries.ts`;
no backend file is modified

**AC7 — a store can be set while ADDING an item, from the same shared code (FR44, AR-E6-5a)**

**Given** I am adding a new item **When** I open the add-item dialog **Then** it presents the same store field and the
same suggestions as the edit dialog **And** the store input together with its suggestion chips is **one component that
both dialogs import** — not duplicated, so a later validation change cannot land in one dialog and miss the other
**And** saving with a store set creates the item with that store, visible as its chip on the shopping row **And** the
store remains optional — creating an item without one still succeeds

**AC8 — an edit preserves every field the form does not expose (AR-E6-2, NFR-E6-1) — REGRESSION TEST, NOT OPTIONAL**

**Given** an item that is currently **checked**
**When** I edit its name and save **Then** the item is **still checked** afterwards **And** the `saveItem` request
carries the item's existing `checked` and `recurring` values, not `checked: false` and
`recurring: null`
**And** this is covered by an explicitly named E2E test — *edit a checked item, assert it stays checked* — running on
**both** the `chromium` and `mobile` projects **Rationale (AR-E6-1):** `saveItem` is a full-document upsert keyed by
`id`, not a partial patch — every field absent from
`ItemInput` reverts to its default. So copying `AddItemDialog`'s hardcoded `checked: false, recurring: null` would
silently uncheck an item mid-shop. Assessed in review as the single most likely defect in this epic.

**AC9 — saving an unchanged item sends nothing (UX-DR-E6-4a, AR-E6-3 mitigation)**

**Given** the edit dialog is open and I have changed none of the editable fields **When** I press Save **Then** the
dialog closes and **no** `saveItem` mutation is sent **And** no error, warning, or "nothing changed" message is shown —
it is indistinguishable from a successful save **Rationale:** the mutation would re-attribute a co-member's item
(BUG-E6-1) for no benefit whatsoever.

**AC10 — validation is on submit, inline, and blocks the request**

**Given** the edit dialog is open **When** I clear the name and save **Then** an inline "Name is required" error appears
on the name field and **no** mutation is sent **And** a name longer than 100 characters is rejected inline **And** the
error clears as soon as I modify the field **And** validation never fires on keystroke or blur — only on submit **And**
every field reserves its helper-text line so an inline error does not shift the layout

**AC11 — a failed save is reported inline and loses nothing (UX-DR-E6-4)**

**Given** the save fails (e.g. my membership was revoked while the dialog was open)
**When** I save **Then** an inline `<Alert severity="error" role="alert">` shows the message produced by
`graphqlErrorMessage`
**And** the dialog stays open with my input intact **And** the item row is unchanged **And** the failure arrives through
a real `catch` — never an uncaught throw out of the handler

**AC12 — double-submit is impossible and in-flight state is visible**

**Given** the dialog is open with valid input **When** I activate Save twice in rapid succession **Then** exactly one
`saveItem` mutation is sent (`if (loading) return` at the top of the handler — `setLoading(true)`
only disables the control on the next render)
**And** the Save control shows a loading indicator and is disabled while the request is in flight **And** Cancel and the
backdrop are inert while in flight **And** on success the order is `onClose()` → `void onDone().catch(() => {})`; a
failing refresh is never reported as a failed save

**AC13 — any member can edit any item on the list (FR40)**

**Given** a list shared with a second user who has accepted the invite, holding an item that the **other** member added
**When** I edit that item **Then** the edit succeeds — there is no owner/member distinction for item operations

**AC14 — the edit reaches other members live, with no new subscription code (AR-E6-6)**

**Given** a co-member has the shopping view for the same list open in another session **When** I save an edit on the
management view **Then** their row updates without a manual refresh, through the existing per-list subscription and its
existing
`subscribeToMore` merge **And** no subscription, cache-merge, or Apollo-client change is introduced by this story

**AC15 — the two known bugs are filed in the ledger before the story is done (AR-E6-3)**

**Given** `addedBy` and `checkedAt` cannot be preserved through `saveItem` from the frontend **When** the story is
completed **Then** `deferred-work.md` contains BUG-E6-1 (edit re-attributes `addedBy` — FR45 regression) and BUG-E6-2
(edit resets
`checkedAt`, blocking FR42/FR43), each with its cause, its user-visible impact, and its proposed server-side fix **And**
BUG-E6-2 is marked as a prerequisite for undeferring FR42/FR43 **Rationale:** this is an AC and not a note in a
requirements document because FR9's automated E2E was also "written down" — in story prose — and was still orphaned
across the 5.4 → 5.5 workflow handoff.

**AC16 — codegen is current and the backend is untouched (AR-E6-0, AR-E6-4)**

**Given** a new `itemStoreSuggestions` operation document was authored **When** the story is completed **Then**
`npm run generate` has been run and its `src/__generated__/` output is committed, with no file there hand-edited **And**
all GraphQL types consumed by the new components are imported from `@/__generated__`
**And** `git diff` shows **no** change under `bp_back/`
**And** `npm run lint` and `npm run build` both pass

### Story 6.2: Back to Home & Back to Lists Navigation

As a signed-in user, I want to reach home from any screen in one action, and to get back to my lists from the shopping
view, So that no screen is a dead end and I am not dependent on the browser's back button to move around the app.

**Delivers:** FR57, NFR-E6-2, NFR-E6-3 **Files:** `src/components/AppShell.tsx`, `src/routes/ListShoppingPage.tsx`
**Reuses:** `HomeRedirect`'s existing `/` resolution (FR38) — not re-implemented; `ListDetailPage`'s existing back-link
pattern, copied idiom-for-idiom

**Acceptance Criteria:**

**AC1 — the app-bar title is a real link on every guarded screen (FR57, UX-DR-E6-5, NFR-E6-3)**

**Given** I am signed in **When** I am on any guarded screen — lists index, list management, shopping view, change
password, admin **Then** the "Bag Please" title in the app bar is a link to `/`
**And** it is a genuine link element: reachable by Tab, activated by Enter, and exposed to assistive technology as a
link **And** it keeps its current type scale, weight and colour, with no underline at rest and a visible hover **and**
focus-visible state **And** it is not a Button — no ripple, no uppercase transform, no padding shift

**AC2 — home resolves to the user's oldest list (FR38, AR-E6-7)**

**Given** I am a regular user with more than one list, viewing my newest list at `/list/:id`
**When** I activate the title link **Then** I land on my **oldest** list by creation date **And** the destination is
resolved by the existing `HomeRedirect` at `/`; the app bar does not re-implement or duplicate that logic

**AC3 — home resolves to the lists index when the user has no lists (FR38)**

**Given** I am a regular user with no lists **When** I activate the title link **Then** I land on the lists index at
`/lists`

**AC4 — admin behaviour is unchanged (FR56, UX-DR-E6-7)**

**Given** I am signed in as `admin`
**When** I activate the title link **Then** I land on `/admin`
**And** no list-related affordance is added to any admin screen

**AC5 — navigation stays declarative and the guard keeps its monopoly**

**Given** the affordance is implemented **Then** it navigates via `component={RouterLink}` (the declarative react-router
7 API)
**And** no imperative `navigate()` call is added **And** `RouteGuard` remains the sole owner of every auth-driven
redirect — no competing redirect is introduced

**AC6 — the mobile app bar still fits (NFR-E6-2, UX-DR-E6-5)**

**Given** a ~360px viewport **Then** the title link and the username chip are both fully visible and tappable **And**
the username chip is not displaced, truncated, or pushed off-screen relative to how it renders today **And** the app bar
does not wrap to a second line or scroll horizontally

**AC7 — the shopping view gets a back-to-lists affordance (FR57, UX-DR-E6-6)**

**Given** I am on the shopping view at `/list/:id`
**Then** a "Back to lists" link with a back arrow appears above the list title **When** I activate it **Then** I land on
the lists index at `/lists`
**And** it matches `ListDetailPage`'s existing back link in structure and styling (AR-E6-8) — the same
`Link component={RouterLink}` + `ArrowBackIcon fontSize="small"` idiom, with its own `data-testid`, not a second
invented pattern **And** the switcher chip row and the filter bar keep their current spacing and layout

**AC8 — the shopping row gains no management affordance (AR-E6-5, UX-DR-E6-2a)**

**Given** I am on the shopping view **Then** item rows still offer check-off only — no edit control, no delete control,
no swipe-to-delete gesture **Rationale:** `/list/:id` is the *use* surface. Swipe-to-delete is additionally an explicit
Epic 4 anti-pattern (accidental deletion while scrolling in-aisle).

**AC9 — nothing leaks to unauthenticated visitors**

**Given** I am signed out on `/auth`
**Then** no app bar, no title link and no back link is rendered — the affordances live inside `AppShell`, which mounts
only within `RouteGuard`

**AC10 — verified on both viewports, real browser first**

**Given** the story is complete **Then** every flow above is covered by FR57-tagged Playwright specs passing on **both**
the `chromium` and `mobile`
projects against the production image **And** each flow was manually exercised in a real browser before its test was
written **And** `npm run lint` and `npm run build` pass, and `git diff` shows no change under `bp_back/`

## Epic 7: Item Integrity, a Trustworthy Test Suite & Dependency Currency

Three data-correctness defects are live in production by explicit Epic 6 decision; one server-side change removes all
three. Alongside them, `/` starts resolving to the genuinely oldest list and the home link stops costing a dead Back
press. Behind those repairs the epic makes the project's own hard gate trustworthy, brings every direct dependency
current, and ships the app as an installable PWA.

**Standing constraints for every Epic 7 story:**

- **The backend unfreeze is scoped, not general (AR-E7-0).** Only Stories 7.4, 7.6 and 7.12 may touch `bp_back/`, and
  each names the files it may change. A backend need discovered in any other story stops the story and goes to `md`.
- **Every story ships FR- or NFR-tagged Playwright E2E passing on BOTH `chromium` and `mobile` (Pixel 7)**, against the
  production image on `:2080`, for any user-facing change. Each flow is manually exercised in a real browser before its
  test is written. Each spec registers its own fresh user through the UI and asserts only on data it created. `admin`
  is blocked from all list operations.
- **A new test is unproven until it has been observed FAILING** (Epic 6 convention). Break the behaviour it guards,
  confirm red on **both** projects, restore. Six of Epic 6's seventeen review patches were assertions that could not
  fail; this applies to Kotest tests as well as Playwright specs (NFR-E7-4).
- **Epic 5 form, feedback and styling conventions apply verbatim**, and MUI v9 APIs are looked up via the
  `mcp__mui-mcp__fetchDocs` MCP tool rather than recalled from v5/v6 memory.
- **Deferred or discovered work goes in `deferred-work.md`**, the ledger both dev workflows read — never only in a story
  file, a spec, or a retro table.
- **`sprint-status.yaml` is reconciled at story close**, whichever dev workflow ran. Epic 6 produced no `epic-6` block
  at all.
- **The epic runs on a fresh `epic-7-*` branch** (AR-E7-12). Epics 5 and 6 both ran on `epic-4-lists`.

**Story independence.** Every story is completable using only the stories before it. 7.2 depends on nothing but makes
7.3 land in one file instead of four; 7.3 depends on 7.2; 7.10 depends on 7.1; 7.13 depends on 7.12; 7.14 depends on
7.9. No story requires a later one. 7.4, 7.5, 7.6 and 7.15 are independent of the whole chain and of each other.

### Story 7.1: Bring the E2E Suite Inside the Frontend Quality Gates

As a developer, I want `bp_front/e2e/` linted and type-checked like the rest of the frontend, So that "lint and build
pass" becomes a true statement about the suite the project treats as its hard gate, instead of saying nothing about it.

**Delivers:** NFR-E7-3 (AR-E7-4)
**Files:** new `bp_front/tsconfig.e2e.json`, `bp_front/tsconfig.json` (references), `bp_front/package.json` (lint
script), `bp_front/eslint.config.mjs`, plus any spec file carrying a real error
**Reuses:** the existing three-project tsconfig layout and the existing flat ESLint config

**Acceptance Criteria:**

**AC1 — a third tsconfig project covers the suite (NFR-E7-3)**

**Given** `tsconfig.json` currently references only `tsconfig.app.json` (`include: ["src"]`) and `tsconfig.node.json`
(`include: ["vite.config.ts"]`)
**When** the story is complete
**Then** a `tsconfig.e2e.json` covering `e2e` exists and is listed in `tsconfig.json`'s `references` array
**And** `npm run build` (`tsc -b && vite build`) type-checks the spec files as part of the normal build
**And** the new project targets a Node/Playwright environment, not `DOM` + `react-jsx` — the specs are not browser code

**AC2 — the lint glob covers the suite**

**Given** `package.json` runs `"lint": "eslint src/"`
**When** the story is complete
**Then** `npm run lint` lints `e2e/` as well as `src/`
**And** `src/__generated__` and `dist` remain ignored

**AC3 — spec files get rules appropriate to what they are**

**Given** the flat config currently applies `globals.browser` and `reactRefresh.configs.vite` to every `**/*.{ts,tsx}`
**When** the story is complete
**Then** spec files resolve `@playwright/test` types and Node globals
**And** `eslint-plugin-react-refresh`'s `only-export-components` rule does **not** apply to `e2e/` — a support module of
exported helper functions is precisely what Story 7.2 requires, and that rule is what forced `normalizeStore` out of
`StoreField.tsx` in Epic 6
**And** the rules applied to `src/` are unchanged — in particular `react-hooks/set-state-in-effect` still fires there

**AC4 — pre-existing errors are fixed, not silenced**

**Given** roughly 1,015 lines of Epic 6 spec code have never been type-checked or linted
**When** the gates are switched on
**Then** every error surfaced is fixed at the source
**And** no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or `skipLibCheck`-style widening is introduced to make the
gate pass
**And** if an error reveals a genuine test defect rather than a typing nit, it is called out in the story record — a
spec that does not compile may never have asserted what it claimed

**AC5 — the new gate is observed failing before it is accepted (NFR-E7-4)**

**Given** a gate that cannot fail proves nothing
**When** the story is completed
**Then** a deliberate type error and a deliberate lint error have each been introduced into a spec file, `npm run build`
and `npm run lint` confirmed to **fail** on them, and both reverted
**And** this is recorded in the story's dev notes

**AC6 — the suite's behaviour is unchanged**

**Given** this story changes tooling configuration, not tests
**When** the story is complete
**Then** the full Playwright suite still passes on both `chromium` and `mobile` against the production image
**And** no test's assertions were weakened to satisfy a type error

### Story 7.2: Extract One Shared E2E Support Module

As a developer, I want the E2E helper block to live in exactly one module, So that a fix to shared test logic lands once
instead of being copy-pasted into four spec files where the copies silently drift.

**Delivers:** AR-E7-5; prerequisite for Story 7.3
**Files:** new `bp_front/e2e/support/` module, `lists.spec.ts`, `shopping.spec.ts`, `sharing.spec.ts`,
`item-editing.spec.ts`
**Reuses:** the existing helper implementations verbatim — this is an extraction, not a rewrite

**Acceptance Criteria:**

**AC1 — one module, imported by every spec that needs it**

**Given** `uniqueUsername`, `registerViaUi`, `openListsViaMenu`, `createListAndOpen`, `addCategory`, `addItem`,
`loginApi` and `gql` are re-declared in four spec files, differing only in the `uniqueUsername` prefix
**When** the story is complete
**Then** each helper is defined exactly once in a shared support module and imported by every spec that uses it
**And** `grep` confirms no spec file re-declares any of them
**And** the per-spec `uniqueUsername` prefix is passed as a parameter, so each spec keeps its distinct prefix

**AC2 — extraction preserves behaviour exactly**

**Given** this is a refactor with no intended behaviour change
**When** the story is complete
**Then** the full suite passes on both `chromium` and `mobile` against the production image
**And** the extracted helpers are behaviourally identical to the copies they replace, including the
`expect(...).toPass()` workaround inside `registerViaUi` — **which stays for now** and is removed by Story 7.3, not here
**And** any behavioural difference found between the four copies during extraction is reported to `md` rather than
silently resolved by picking one

**AC3 — it is a support module, not a login fixture (AR-E7-5)**

**Given** the project deliberately has no login fixture and no `storageState`
**When** the story is complete
**Then** every spec still registers its own fresh user through the UI and logs in through the form
**And** no `storageState`, no auth fixture, and no session reuse across specs is introduced
**And** API calls remain permitted only for environment preparation, never for behaviour under test

**AC4 — the mobile gate is not quietly voided**

**Given** `browser.newContext()` does not inherit the project's `use` block, which silently ran a desktop viewport on
the `mobile` project in Epic 6
**When** any helper touching multi-actor setup is extracted
**Then** it does not introduce a hand-built context where the `page` fixture would do
**And** where a second actor genuinely needs its own context, the actor whose rendering the mobile gate must cover stays
on `page`

**AC5 — the new module is inside the gates**

**Given** Story 7.1 brought `e2e/` into lint and type-check
**When** the story is complete
**Then** the support module passes both, with no suppression comments

### Story 7.3: Delete the `registrationEnabled` Race

As a developer, I want the shared-registration-flag race removed at its source rather than retried, So that a green
suite means the application works instead of meaning the retries absorbed a known flake.

**Delivers:** NFR-E7-2 (AR-E7-6)
**Files:** the shared support module from Story 7.2, `bp_front/playwright.config.ts`, the admin registration-toggle
spec
**Depends on:** Story 7.2 (so the fix lands in one file rather than four)

**Acceptance Criteria:**

**AC1 — registration is enabled as the steady state**

**Given** `registrationEnabled` is one shared Mongo document and `global-setup.ts` already enables it idempotently
**When** the suite runs
**Then** registration is ON for the entire run except inside the one test that deliberately turns it off
**And** that test restores the enabled state in a `finally`, so a failing assertion inside it cannot leave registration
off for everything else

**AC2 — the disabled-registration test cannot run concurrently with anything that registers**

**Given** the `chromium` and `mobile` projects run **concurrently against one backend**, so the race is *across*
projects
**When** the fix is implemented
**Then** the registration-disabled test has genuine exclusivity for its OFF window
**And** `test.describe.configure({mode: 'serial'})` alone is explicitly **not** accepted as the mechanism — it
serializes within a project and this race is between projects
**And** the chosen mechanism (a dedicated project with a dependency, a worker-scoped lock, or equivalent) is recorded in
the story with the reason

**AC3 — the workaround is removed, not left alongside the fix**

**Given** `registerViaUi` carries an `expect(...).toPass()` retry wrapper for exactly this race
**When** the race is gone
**Then** that wrapper is removed from the shared support module
**And** no spec retains a local copy of it
**Rationale:** leaving both means the next occurrence of this flake is invisible.

**AC4 — the fix is proven, not assumed (NFR-E7-2)**

**Given** the suite is currently green only under CI's `retries: 2`, and this flake has been accepted seven times
across two epics
**When** the story is completed
**Then** **two consecutive full runs at `retries: 0`** pass on both `chromium` and `mobile` with zero flaky results
**And** both runs are recorded in the story with their output
**And** a single green run is explicitly not sufficient evidence

**AC5 — the deleted race is observed, not inferred**

**Given** the Epic 6 convention that a test is unproven until seen failing
**When** the story is completed
**Then** the exclusivity mechanism has been deliberately disabled, a full run at `retries: 0` confirmed to reproduce the
race, and the mechanism restored
**And** if the race cannot be reproduced with the mechanism disabled, that is reported — it would mean the fix is not
demonstrably the thing that closed it

**AC6 — the ledger entry is closed**

**Given** `deferred-work.md` carries this item from the Epic 5 close-out as still open
**When** the story is complete
**Then** that entry is marked resolved with the mechanism used, rather than a new entry being added alongside it

### Story 7.4: An Item Edit Modifies the Stored Item Instead of Reconstructing It

As a list member, I want editing an item to change only what I edited, So that fixing a co-member's typo does not steal
their authorship, and editing a checked item does not silently break its recurrence.

**Delivers:** FR58; restores FR45, FR54 and FR40 (AR-E7-1, AR-E7-2, AR-E7-2a, AR-E7-3, NFR-E7-4, UX-DR-E7-3)
**Files:** `bp_back/src/main/kotlin/com/bagplease/entity/item/ItemService.kt`, its Kotest tests, one Playwright spec.
`bp_back/.../gql/GqlItemInput.kt` is **not** modified
**Scoped unfreeze:** this is the first deliberate `bp_back/` change since Epic 4 (AR-E7-0)

**Acceptance Criteria:**

**AC1 — an edit preserves every server-owned field (FR58, BUG-E6-1, BUG-E6-2)**

**Given** an item with a recorded `addedBy`, a non-null `checkedAt`, and `deleted`/`deletedAt` state
**When** a **different** member saves it with a changed name
**Then** `addedBy` is unchanged — the original author keeps authorship
**And** `checkedAt`, `deleted` and `deletedAt` are unchanged
**And** only the fields `ItemInput` carries (`name`, `checked`, `category`, `store`, `recurring`) reflect the input
**Rationale (AR-E7-1):** `GqlItemMapper.mapItemFromInput` builds a **fresh** `Item` whose defaults then overwrite these
fields, because `ItemRepository.save` `Updates.set`s everything.

**AC2 — create still works, and the discriminator is storage existence (AR-E7-2)**

**Given** `GqlItemInput.id` is non-nullable and the frontend generates the UUID client-side with
`crypto.randomUUID()` for **new** items as well as edits
**When** `saveItem` receives an id that does **not** exist on the target list
**Then** the item is created, with `addedBy` set from the caller exactly as today
**And When** the id **does** exist on the target list
**Then** the stored item is loaded and the input merged onto it
**And** the frontend is **not** changed and continues to supply client-generated UUIDs
**And** rejecting unknown ids is explicitly **not** implemented — it would reject every new item

**AC3 — an id belonging to another list is rejected**

**Given** an item id that exists, but on a list other than the `listId` in the input
**When** `saveItem` is called
**Then** it fails with an error and writes nothing
**And** the item is not moved between lists

**AC4 — a category outside the list is rejected (BUG-E6-3b)**

**Given** a save whose `category` does not belong to the target list — the state a stale dialog produces after a
co-member deletes a category
**When** `saveItem` is called
**Then** it fails with an error and writes nothing
**And** no item is left with a dangling `category` rendering under no group
**Rationale:** this outcome's only recovery today is direct database access.

**AC5 — the check-off clock survives an edit, so recurrence still works (FR54)**

**Given** a recurring item that was checked off, so `checkedAt` is set
**When** its name is edited and saved
**Then** `checkedAt` is unchanged
**And** `runSchedulerCycle` still restores it once its cadence elapses — it no longer `continue`s on a null `checkedAt`
**And** this is covered by a Kotest test that drives the scheduler, not only by asserting the field

**AC6 — the already-correct paths do not regress (AR-E7-3)**

**Given** `checkItem`, `uncheckItem` and `runSchedulerCycle` already `copy()` the stored item
**When** the story is complete
**Then** their existing Kotest coverage still passes unchanged
**And** `uncheckItem` still deliberately clears `checkedAt` — that is the scheduler contract, not an instance of this
bug

**AC7 — Kotest coverage exists and was observed failing first (NFR-E7-4)**

**Given** every AC above is a server-side behaviour
**When** the story is completed
**Then** each of AC1–AC5 has Kotest coverage
**And** each new test was proven non-vacuous by reverting the fix, confirming the test goes **red**, and restoring
**And** that break-and-restore is recorded in the story's dev notes
**And** the full backend suite passes

**AC8 — one end-to-end proof that the user-visible symptom is gone (FR45)**

**Given** the shopping view renders `addedBy` as `shopping-item-addedby-<name>`
**When** a list is shared with a second member who accepted, member A adds an item, and member B edits its name
**Then** the shopping row still attributes the item to **A**
**And** this is an FR45/FR58-tagged Playwright spec passing on **both** `chromium` and `mobile` against the production
image
**And** it was manually exercised in a real browser first, and observed failing before being accepted

**AC9 — BUG-E6-3a is recorded, not silently closed (AR-E7-2a)**

**Given** `ItemStorage.delete` is a hard delete, so a save against a deleted id takes the create branch and the item
returns
**When** the story is completed
**Then** `deferred-work.md` records BUG-E6-3a as **severity-downgraded rather than fixed**: the item now returns as a
genuinely new row (`addedBy` = the editor, who did create it; `checkedAt` null, correct for a new item) and is
removable through the UI
**And** the entry names the real fix — making `deleteItem` a soft delete, with the tombstones the scheduler would then
own — and states that it is outside Epic 7's scoped unfreeze
**And** the BUG-E6-1 and BUG-E6-2 entries are marked resolved by this story

**AC10 — the change is scoped, the schema is untouched, and the edit UI gains nothing (AR-E7-0, AR-E7-1, UX-DR-E7-3)**

**Given** the unfreeze is scoped to named files, and FR58 is entirely server-side
**When** the story is completed
**Then** `git diff` under `bp_back/` shows changes only to `ItemService.kt` and its tests
**And** `GqlItemInput.kt` is unchanged, no GraphQL schema change occurred, and **no `npm run generate` run was needed**
**And** `git diff` shows no change under `bp_front/src/` other than the new spec — `EditItemDialog.tsx`,
`AddItemDialog.tsx` and the shared store field are untouched, and no edit or delete affordance appears on the shopping
view (UX-DR-E6-2a still holds: `/lists/:id` manages, `/list/:id` uses)
**And** the only user-visible change is the correction itself — the `addedBy` avatar stops flipping to whoever last
edited, and a checked item edited by a co-member stays checked with its clock intact

### Story 7.5: Resolve Home Correctly, and Make the Home Link Inert When Already Home

As a signed-in user, I want `/` to take me to my genuinely oldest list, and the home link to do nothing visible when I
am already there, So that the app does not occasionally open the wrong list or waste a Back press on a spinner.

**Delivers:** restores FR38 and FR57 (AR-E7-7, AR-E7-8, AR-E7-8a)
**Files:** `bp_front/src/routes/HomeRedirect.tsx`, `bp_front/src/components/AppShell.tsx`, one spec
**Reuses:** `HomeRedirect`'s existing `ListsQuery` and `<Navigate replace/>` resolution — the app bar still does not
re-derive the home path (AR-E6-7)

**Acceptance Criteria:**

**AC1 — the oldest list is chosen numerically, not lexicographically (FR38)**

**Given** the backend emits `createdAt` as `Instant.toString()`, which omits the fractional part entirely when nanos are
zero — so `…:05Z` sorts *after* `…:05.100Z` under `localeCompare` (`'Z'` 0x5A > `'.'` 0x2E)
**When** a user with two lists created within the same second navigates to `/`
**Then** they land on the list created first
**And** the comparison uses `Date.parse(createdAt)` numerically
**And** the backend wire format is **not** changed — AR-E7-7 rejects that alternative explicitly

**AC2 — the wrong-list bug is proven fixed against the real precision case**

**Given** the defect window is roughly 1-in-1000 per list pair and will not appear by chance in a test run
**When** the story is completed
**Then** a test constructs the specific precision pair (one timestamp with zero nanos, one with a fractional part) and
asserts the earlier list wins
**And** the test was confirmed to **fail** against `localeCompare` before the fix was applied
**And** the vehicle is a Playwright `page.route` interception of the `ListsQuery` response returning the crafted
`createdAt` pair — `createdAt` is server-generated from `Instant.now()`, so the precision case cannot be produced
through the UI. This is permitted under the standing rule "mock only the *input to a render*, never the thing under
test": the thing under test is `HomeRedirect`'s comparison, and the query result is its input.
**And** it is explicitly **not** implemented by adding a unit-test framework (none exists in `bp_front/`, and this epic
is not the place to introduce one) nor by writing `createdAt` values directly into MongoDB (which would violate the
API-only test-data rule)

**AC3 — activating home while already home changes nothing visible (FR57, UX-DR-E7-2)**

**Given** I am standing on the route `/` resolves to
**When** I activate the app-bar title link
**Then** the screen is visually unchanged: no `home-redirect-loading` spinner appears and the scroll position does not
move
**And** no browser-history entry is added, so a single Back still returns me to the screen I came from

**AC4 — the inert link remains a real, present link (AR-E7-8, NFR-E6-3)**

**Given** the link must not regress into a `Button`, a disabled control, or a removed element
**When** it is in its inert state
**Then** it is still rendered, still reachable by Tab, still exposed to assistive technology, and keeps its type scale,
weight and colour
**And** it is never hidden or unmounted — a title that vanishes on one route reads as a broken render
**And** the suppression happens in `HomeRedirect` or a shared hook exposing the resolved path, **not** by the app bar
re-deriving it (AR-E6-7)

**AC5 — the guard does not over-fire (UX-DR-E7-4)**

**Given** a guard that suppresses too eagerly turns FR57 into a dead control on the screens that need it most
**When** I activate the home link from `/lists`, from a list that is **not** my home list, from change-password, or from
any admin screen
**Then** it navigates and resolves through `HomeRedirect` exactly as Epic 6 shipped it
**And** the admin case still resolves to `/admin` (FR56)
**And** each of these is asserted, not assumed

**AC6 — every guarded route keeps an in-app way out (AR-E7-8a)**

**Given** Story 7.14 will remove the browser's URL bar and back button, making these affordances the entire navigation
model
**When** the story is complete
**Then** a test walks every guarded route — `/lists`, `/lists/:id`, `/list/:id`, `/account/password`, `/admin` — and
asserts each exposes at least one in-app navigation affordance
**And** `window.history.length` after landing on the resolved home route is asserted, documenting that the launch stack
is one deep
**And** for the admin account, whose home **is** `/admin`, the inert title link is confirmed present and the single-screen
outcome is recorded as deliberate rather than incidental

**AC7 — coverage and gates**

**Given** the story is user-facing
**When** it is completed
**Then** the above are covered by FR38/FR57-tagged specs passing on **both** `chromium` and `mobile` against the
production image, manually exercised first and observed failing before acceptance
**And** `npm run lint` and `npm run build` pass, and `git diff` shows no change under `bp_back/`

### Story 7.6: Backend Safety Fixes Riding the Same Unfreeze

As a maintainer, I want three catalogued Epic 4 defects closed while the backend is legitimately open, So that they stop
being carried across retrospectives and cannot surprise a future story.

**Delivers:** AR-E7-11, NFR-E7-4
**Files:** `ItemStorage.kt`, `CategoryStorage.kt`, `ListStorage.kt`, `ListMember.kt`, `ListService.kt`,
`ListMemberRepository.kt`, `GqlListMapper.kt`, plus Kotest tests. `MongoListMember.kt` is **not** changed
**Scoped unfreeze:** AR-E7-0

**Acceptance Criteria:**

**AC1 — the lazy-sync flags are volatile**

**Given** `private var synced = false` at `ItemStorage.kt:12`, `CategoryStorage.kt:12` and `ListStorage.kt:12` is
non-volatile, so two coroutines can double-sync on startup
**When** the story is complete
**Then** all three carry `@Volatile`
**And** the `if (synced.not()) { … synced = true }` guard is otherwise unchanged in every Storage class

**AC2 — invite status is typed in the domain (AR-E7-11b)**

**Given** `"PENDING"` / `"ACCEPTED"` / `"DECLINED"` appear as bare strings at `ListService.kt:151-152,162-163,179-180`,
`ListMemberRepository.kt:49,62` and `GqlListMapper.kt:17`
**When** the story is complete
**Then** `ListMember.status` is a typed enum and every domain-layer comparison is compile-time checked

**AC3 — the enum stops at the storage boundary (AR-E7-11b) — THIS IS NOT A STYLE CHOICE**

**Given** the codebase already solves this: `MongoItem.recurring` is `String?` while `Item.recurring` is the `Recurring`
enum, converted at the mapper
**When** the story is complete
**Then** `MongoListMember.status` remains a `String`, and conversion happens in the mapper
**And** the persisted string values are unchanged, so no data migration is required
**Rationale:** kotlinx-serialization throws `SerializationException` on an unknown enum value, and
`listMemberRepository.findActiveByListId` is called at `ListApi.kt:30,60,72,92,104,124` — on essentially every list
query and mutation response — so one unexpected row would fail the entire `lists` query for every member of that list.
Today it merely falls through `!= "DECLINED"`. Putting the enum in the Mongo model would be **strictly worse than the
strings it replaces**.

**AC4 — deleting a list cleans up its membership rows**

**Given** `ListService.deleteList` cascades items → categories → list but never removes the list's `list_members` rows
**When** a list is deleted
**Then** its `list_members` rows are deleted too, inside the same ordered cascade — after the category delete, before
`listRepository.delete`
**And** a Kotest test asserts no `list_members` rows remain for the deleted list **and** that another list's rows are
untouched

**AC5 — no backfill, and the assumption is recorded (`md`, 2026-07-29)**

**Given** the cascade fixes future deletes only
**When** the story is complete
**Then** **no** migration or one-off cleanup of already-orphaned rows is written
**And** the story records `md`'s ruling that production is assumed to hold none, so that a future orphan reads as a new
finding rather than a regression of this story

**AC6 — coverage observed failing, and the ledger updated (NFR-E7-4)**

**Given** three low-risk changes against live production data
**When** the story is completed
**Then** each behavioural change has a Kotest test that was confirmed **red** before the fix and green after
**And** the full backend suite passes
**And** the corresponding `deferred-work.md` entries from the Epic 4 code reviews are marked resolved
**And** `git diff` shows no change under `bp_front/`

### Story 7.7: Minor and Patch Dependency Sweep

As a maintainer, I want every non-major dependency current in one pass, So that the majors that follow start from a
clean baseline instead of compounding two kinds of change at once.

**Delivers:** NFR-E7-1, NFR-E7-5 (AR-E7-9, AR-E7-10)
**Files:** `bp_front/package.json`, `bp_front/package-lock.json`, `gradle/libs.versions.toml`

**Standing acceptance criteria — these apply to Stories 7.7 through 7.13 and are not repeated in each:**

**S-AC1 — verified before the next story starts (AR-E7-10, NFR-E7-6).** `npm run lint`, `npm run build`, and the **full
Playwright suite on both `chromium` and `mobile`** against the production image pass; for any story touching the Gradle
catalog, `./gradlew :bp_back:test` passes too. No later dependency story begins until this one is green.
**S-AC2 — no user-visible change (NFR-E7-5, UX-DR-E7-1).** A real-browser pass on the `:2080` production stack confirms
identical rendering: the same `src/theme.ts` tokens, spacing, type scale, and layout at ~360px and on desktop. A visible
difference is an upgrade regression to diagnose, not a drift to accept.
**S-AC3 — a failed bump is reverted and recorded, never worked around (AR-E7-10, NFR-E7-1).** If a version cannot be
made green, it is reverted and an entry is added to **`deferred-work.md`** — not `project-context.md` — naming the
version attempted and the concrete blocking symptom. **A held-back dependency closes its story; it does not fail it.**
**S-AC4 — no scope bleed.** Only version numbers and the changes strictly required by the upgrade are touched. Product
behaviour, test assertions, and unrelated refactors are out of scope. Weakening an assertion to make a bump pass is
forbidden.

**Story-specific Acceptance Criteria:**

**AC1 — every non-major bump lands together**

**Given** the 2026-07-29 audit (AR-E7-9)
**When** the story is complete
**Then** npm is current on `@apollo/client` 4.2.8, `@mui/material` and `@mui/icons-material` 9.2.0,
`@graphql-codegen/cli` 7.2.0, `@graphql-codegen/client-preset` 6.1.0, `@playwright/test` 1.62.0, `react` and
`react-dom` 19.2.8, `graphql-ws` 6.2.0, `react-router-dom` 7.18.2, `rxjs` 7.8.2, `@types/react` 19.2.17, `globals`
17.8.0
**And** Gradle is current on Ktor 3.5.1, MongoDB driver 5.9.1, Kotest 6.2.3, Arrow 2.2.3, Logback 1.6.1
**And** Testcontainers (2.0.5), bcrypt (0.10.2) and the Gradle wrapper (9.6.1) are confirmed already current and left
alone

**AC2 — Kotlin is deliberately excluded (`md`, 2026-07-29)**

**Given** a Kotlin minor is not a no-migration-risk bump and `graphql-kotlin` 9.2.0 may cap the supported version
**When** the story is complete
**Then** `kotlin` in `libs.versions.toml` is **unchanged** at 2.3.21
**And** it is bumped in Story 7.12 alongside `graphql-kotlin`, pinned to what that version supports
**Rationale:** bumping Kotlin here could break the backend five stories before the story permitted to fix it.

**AC3 — codegen output is verified current, not assumed**

**Given** `@graphql-codegen/cli` and `client-preset` both move
**When** the story is complete
**Then** `npm run generate` has been re-run and any change to `src/__generated__/` is committed
**And** no file under `src/__generated__/` was hand-edited
**And** if the generated output is byte-identical, that is stated explicitly

### Story 7.8: `@types/node` 25 → 26

As a maintainer, I want the cheapest major taken first, So that the majors sequence begins on low risk and any early
failure is trivially attributable.

**Delivers:** NFR-E7-1, NFR-E7-6 (AR-E7-9)
**Files:** `bp_front/package.json`, `bp_front/package-lock.json`
**Standing ACs S-AC1 – S-AC4 apply.**

**Acceptance Criteria:**

**AC1 — types-only, verified against the build's Node**

**Given** `@types/node` 25.6.0 → 26.1.2 is a types-only major
**When** the story is complete
**Then** the declared version matches the Node major actually running the build and the Docker build stage
**And** if they disagree, the mismatch is reported to `md` rather than resolved by guessing — a types package ahead of
its runtime produces confident, wrong type-checking

**AC2 — it interacts with `tsconfig.node.json` and the new e2e project**

**Given** `tsconfig.node.json` covers `vite.config.ts` and Story 7.1 added a Node-flavoured `tsconfig.e2e.json`
**When** the story is complete
**Then** both projects type-check clean under the new types
**And** no `skipLibCheck` widening is added to absorb a failure

### Story 7.9: Vite 7 → 8 with `@vitejs/plugin-react` 5 → 6

As a maintainer, I want the build chain moved to Vite 8 with its matching React plugin in one atomic change, So that the
pair that cannot be split is never split.

**Delivers:** NFR-E7-1, NFR-E7-5, NFR-E7-6 (AR-E7-9)
**Files:** `bp_front/package.json`, `bp_front/package-lock.json`, `bp_front/vite.config.ts` if the upgrade requires it
**Standing ACs S-AC1 – S-AC4 apply.**

**Acceptance Criteria:**

**AC1 — the two move together, in one commit**

**Given** `@vitejs/plugin-react` v6 requires Vite 8, and bumping either alone breaks the build — already recorded in
`project-context.md`
**When** the story is complete
**Then** `vite` 8.1.5 and `@vitejs/plugin-react` 6.0.4 are both present
**And** they landed in a single commit; there is no intermediate state where one is bumped without the other

**AC2 — the production artifact is what gets verified**

**Given** the E2E gate builds the production image, and the shipped bundle is what a build-tool major can break —
asset hashing, base path, tree-shaking, SPA fallback
**When** the story is complete
**Then** the full suite passes against the production image on `:2080`, not the dev server
**And** the dev server (`npm run dev` on `:5173`) with its `/api` and `/api/subscriptions` proxies is separately
confirmed working, since it is the day-to-day inner loop and is **not** covered by the E2E gate

**AC3 — the `@/*` path alias survives**

**Given** `@/*` → `src/*` is configured in both `tsconfig` and `vite.config.ts` and is used throughout
**When** the story is complete
**Then** alias resolution works in build, dev server, and type-check

### Story 7.10: TypeScript 6 → 7

As a maintainer, I want TypeScript current, So that the type system checking this codebase is the current one — across
the whole codebase, including the E2E suite.

**Delivers:** NFR-E7-1, NFR-E7-6 (AR-E7-9)
**Files:** `bp_front/package.json`, `bp_front/package-lock.json`, the three tsconfig projects if required
**Depends on:** Story 7.1
**Standing ACs S-AC1 – S-AC4 apply.**

**Acceptance Criteria:**

**AC1 — the major checks 100% of the code, not 80%**

**Given** Story 7.1 brought `e2e/` into a tsconfig project
**When** TypeScript 7.0.2 lands
**Then** `tsc -b` type-checks `src`, `vite.config.ts` **and** `e2e` under the new compiler
**And** every error is fixed at the source, with no `@ts-ignore` / `@ts-expect-error` added to absorb the migration

**AC2 — strictness is not traded away for a green build**

**Given** `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` and
`moduleResolution: bundler` are all in force
**When** the story is complete
**Then** no compiler option has been relaxed
**And** `src/__generated__` remains excluded from program roots exactly as documented in `tsconfig.app.json`

**AC3 — `typescript-eslint` still functions**

**Given** `typescript-eslint` 8.x consumes the TypeScript version
**When** the story is complete
**Then** `npm run lint` runs clean with no parser or version-range warnings
**And** if `typescript-eslint` does not support TS 7, that is the blocking symptom recorded under S-AC3

### Story 7.11: ESLint 9 → 10

As a maintainer, I want the linter current, So that the rules protecting this codebase's hardest-won conventions are on
a supported version.

**Delivers:** NFR-E7-1, NFR-E7-6 (AR-E7-9)
**Files:** `bp_front/package.json`, `bp_front/package-lock.json`, `bp_front/eslint.config.mjs` if required
**Depends on:** Story 7.10
**Standing ACs S-AC1 – S-AC4 apply.**

**Acceptance Criteria:**

**AC1 — the plugin set moves with it**

**Given** `eslint` and `@eslint/js` go to 10, and `typescript-eslint`, `eslint-plugin-react-hooks` v7 and
`eslint-plugin-react-refresh` all peer on ESLint
**When** the story is complete
**Then** every plugin resolves against ESLint 10 with no peer warnings
**And** the flat-config shape in `eslint.config.mjs` still loads

**AC2 — `react-hooks/set-state-in-effect` must survive — this is load-bearing**

**Given** that rule is what forbids `useEffect` state-sync and forces the render-phase-adjustment (`prevOpen`) pattern
used by the dialogs
**When** the story is complete
**Then** the rule is still active and still reports
**And** it is proven by introducing a `useEffect` state-sync, confirming lint **fails**, and reverting
**And** if ESLint 10 drops or renames it, the replacement is wired up and the equivalence demonstrated the same way

**AC3 — the Story 7.1 rule split is preserved**

**Given** Story 7.1 excluded `react-refresh/only-export-components` from `e2e/` so the shared support module is legal
**When** the config is migrated
**Then** that exclusion still holds and the support module lints clean
**And** the rule still applies to `src/`

### Story 7.12: `graphql-kotlin` 9 → 10, with Kotlin

As a maintainer, I want the GraphQL server library and Kotlin moved together to their newest mutually compatible
versions, So that the highest-risk backend upgrade is one attributable change rather than a surprise inside a sweep.

**Delivers:** NFR-E7-1, NFR-E7-6 (AR-E7-9)
**Files:** `gradle/libs.versions.toml`, plus whatever the major requires under `bp_back/`
**Scoped unfreeze:** AR-E7-0
**Standing ACs S-AC1 – S-AC4 apply.**

**Acceptance Criteria:**

**AC1 — Kotlin is pinned to what `graphql-kotlin` 10 supports (`md`, 2026-07-29)**

**Given** `md`'s ruling that Kotlin should go to the latest version compatible with the latest `graphql-kotlin`
**When** the story is complete
**Then** `graphql-kotlin` is 10.2.0 and `kotlin` is the newest version that release supports
**And** the compatibility source is cited in the story, not assumed
**And** the Kotlin serialization plugin tracks `version.ref = "kotlin"` and therefore moves in lockstep automatically —
confirm rather than assume

**AC2 — the generated schema is compared, not trusted**

**Given** `graphql-kotlin` owns schema generation, and the frontend's `src/__generated__/` is produced from it
**When** the story is complete
**Then** the generated schema is captured before and after and **diffed**
**And** any difference is reported to `md` before proceeding — a silent schema change would reach the frontend through
codegen
**And** `npm run generate` is re-run and its output committed if anything moved

**AC3 — the whole GraphQL surface is exercised, not just compilation**

**Given** the major touches schema generation, the subscription transport, and the auth wrapper simultaneously
**When** the story is complete
**Then** `./gradlew :bp_back:test` passes in full
**And** the full Playwright suite passes on both projects — this is what covers real-time subscriptions, WebSocket auth
in `connection_init`, and the `authenticate(authMethod)` boundary end to end
**And** `/api/graphiql` still loads, since it is the project's only backend-readiness check

**AC4 — JVM toolchain 25 is confirmed, not assumed**

**Given** the build targets JDK 25 and a wrong JDK produces a cryptic toolchain error rather than a clear mismatch
**When** the story is complete
**Then** the toolchain still resolves and the Docker build stage still succeeds

### Story 7.13: `graphql` 16 → 17

As a maintainer, I want the GraphQL client library current if its ecosystem allows it, So that we either land the last
major or record exactly what is blocking it.

**Delivers:** NFR-E7-1, NFR-E7-6 (AR-E7-9)
**Files:** `bp_front/package.json`, `bp_front/package-lock.json`
**Depends on:** Story 7.12
**Standing ACs S-AC1 – S-AC4 apply.**

**Acceptance Criteria:**

**AC1 — the four peer ranges are checked before the attempt, not after**

**Given** `graphql` is a simultaneous peer of `@apollo/client`, `graphql-ws`, `@graphql-codegen/cli` and
`@graphql-codegen/client-preset`
**When** the story starts
**Then** all four are checked for v17 support first, at the versions Story 7.7 landed
**And** the finding is recorded whichever way it goes

**AC2 — a hold-back is a successful outcome (S-AC3)**

**Given** any one unsupported peer blocks the upgrade
**When** at least one does not accept v17
**Then** the bump is not attempted, `graphql` stays at 16.14.0, and `deferred-work.md` records the blocking package and
its published peer range
**And** the story closes as **done**, not failed — NFR-E7-1 is satisfied by a recorded reason
**And** no peer dependency is force-installed, overridden, or `--legacy-peer-deps`'d to get past it

**AC3 — if it does land, it is verified against the current schema**

**Given** Story 7.12 may have moved the generated schema
**When** the bump lands
**Then** `npm run generate` is re-run against the schema as of Story 7.12 and its output committed
**And** the full suite passes on both projects, covering queries, mutations and subscriptions

### Story 7.14: Install Bag Please as a Real App

As a shopper, I want to install Bag Please on my phone like any other app — its own icon, its own place in the app
switcher, no browser bar — So that reaching my list is one tap from the home screen instead of finding a tab.

**Delivers:** FR59, NFR-E7-7, NFR-E7-8 (AR-E7-14, AR-E7-15, UX-DR-E7-5, UX-DR-E7-6, UX-DR-E7-6a, UX-DR-E7-6b)
**Files:** `bp_front/package.json`, `bp_front/vite.config.ts`, `bp_front/src/main.tsx`, new
`bp_front/public/icons/*.png`, `routing/Caddyfile`, one spec
**Depends on:** Story 7.9 (the plugin peers on Vite) and Story 7.5 (which makes the navigation model whole)

**Acceptance Criteria:**

**AC1 — Chrome offers "Install app", not "Add to Home screen" (FR59)**

**Given** Chrome builds a WebAPK only when HTTPS, a linked manifest with PNG icons at both 192×192 and 512×512, and a
registered service worker with a fetch handler **all** hold
**When** the app is opened in Chrome on Android
**Then** the menu offers **"Install app"**, and the installed result has its own launcher icon, its own task-switcher
entry, and no URL bar
**And** DevTools → Application → Manifest reports **no** unmet installability criterion — that panel is the evidence,
not the presence of a menu item

**AC2 — the icons are generated and committed (UX-DR-E7-5)**

**Given** `bp_front/public/` currently contains only `favicon.svg` (305 bytes) and **Chrome will not build a WebAPK icon
from SVG**
**When** the story is complete
**Then** committed PNGs exist at 192×192, 512×512, and a 512×512 `purpose: 'maskable'` variant carrying ~20% padding so
Android's adaptive-icon mask does not clip the artwork
**And** they are derived from the existing `favicon.svg` so the installed app is visually continuous with the browser tab
**And** the maskable variant is verified against a circle and a squircle mask, not just eyeballed as a square

**AC3 — the manifest is correct for a dark-only app (UX-DR-E7-6)**

**Given** `src/theme.ts` sets `background.default: '#000000'` and the theme is dark-only
**When** the manifest is authored
**Then** it declares `id: '/'`, `name` and `short_name` "Bag Please", `start_url: '/'`, `scope: '/'`,
`display: 'standalone'`, `theme_color: '#000000'` and **`background_color: '#000000'`**
**And** `background_color` is **not** `#ffffff` — it is Android's cold-launch splash colour and white would flash before
an all-black app
**And** the built `dist/index.html` is inspected to confirm the manifest link was actually injected

**AC4 — the service worker never touches the API surface (NFR-E7-7)**

**Given** a service worker that shadows the backend would be indistinguishable from an outage
**When** the worker is registered
**Then** `navigateFallback: '/index.html'` is paired with `navigateFallbackDenylist: [/^\/api/]` and there is **no**
runtime caching of any `/api` route
**And** `GET /api/graphiql` returns GraphiQL, **not** the SPA shell — it is a navigation, and it is the project's only
backend-readiness check
**And** GraphQL POSTs, the auth REST endpoints, and the `/api/subscriptions` WebSocket upgrade all behave exactly as
before, with real-time collaboration still working
**And** no authenticated response is written to any cache

**AC5 — Caddy serves the manifest with the right content type (AR-E7-15)**

**Given** `routing/Caddyfile` uses `try_files {path} /index.html` + `file_server`, and the Alpine-based Caddy image
cannot be relied on to carry `.webmanifest` in its MIME table — a wrong content type kills installability silently
**When** the story is complete
**Then** the manifest is served as `application/manifest+json` via an explicit `header` directive
**And** the assertion is on the **served response header**, not on the file existing in `dist/`
**And** the service worker is served from the root scope and is not long-term cached
**And** the existing route order is preserved — `/api/subscriptions` before `/api/*` before the SPA handler

**AC6 — the suite stays green with a global request interceptor in place (NFR-E7-8)**

**Given** a service worker intercepts every navigation, in a suite where every spec navigates
**When** the story is completed
**Then** **two consecutive full runs at `retries: 0`** pass on both `chromium` and `mobile`, re-establishing the
NFR-E7-2 measurement taken in Story 7.3
**And** any new flake is attributed to the service worker and fixed, not absorbed by retries

**AC7 — the app is navigable without browser chrome (UX-DR-E7-6a, AR-E7-8a)**

**Given** `display: 'standalone'` removes the URL bar **and** the browser back button, leaving only the Android system
back gesture, which exits the app once the history stack is exhausted
**When** the installed app is exercised on a device
**Then** every guarded screen is escapable using only in-app affordances — with `/account/password` and `/admin`
depending entirely on the app-bar title link
**And** Story 7.5's inert-but-present behaviour is confirmed on the resolved home route
**And** the one-deep launch history — system back exits from the home screen — is confirmed as accepted behaviour and
recorded

**AC8 — no offline mode is introduced (UX-DR-E7-7)**

**Given** the service worker exists solely to satisfy Chrome's WebAPK criterion
**When** the story is complete
**Then** `runtimeCaching` is empty, and no offline UI, cached-data indicator, or "you're offline" affordance is added
**And** `registerType: 'autoUpdate'` picks up a new deployment silently: no update toast, no reload prompt, no version
banner
**And** the app requires the network exactly as it does today

**AC9 — real-device verification uses the only route that works (AR-E7-15)**

**Given** `https://bag-please.localhost` neither resolves nor validates on a physical phone
**When** installability is verified
**Then** it is done over `chrome://inspect` port forwarding so the device reaches `http://localhost:2080`, which Chrome
treats as a secure context
**And** the DevTools Installability panel output is recorded in the story
**And** iOS Safari is explicitly **out of scope** — it uses a separate `apple-touch-icon` route (FR59)

### Story 7.15: Give the dev-auto Warnings a Measured Verdict

As a maintainer, I want to know whether `oversized` and `multiple-goals` mean anything, So that a signal that has
accumulated unread across three epics either starts being acted on or stops being emitted.

**Delivers:** AR-E7-13
**Files:** either `_bmad/custom/bmad-dev-auto.toml` or `_bmad-output/project-context.md` — the verdict decides which
**Independent of** every other story in the epic

**Acceptance Criteria:**

**AC1 — measure**

**Given** the budget is 900–1600 tokens (`spec-template.md:12`), and five consecutive specs carry `oversized` — 5.5,
5.6, 5.7, 6.1, 6.2
**When** the story starts
**Then** the exact token count of each of the five specs is recorded against that budget
**And** the estimates used in planning (5.5 ≈ 2×, 6.2 ≈ 2×, 6.1 ≈ 4×) are replaced with measurements

**AC2 — correlate**

**Given** the review-finding counts for those stories already exist in their records
**When** the measurement is done
**Then** the story states whether spec size predicts review-finding count across the five
**And** it notes the one data point already visible: Story 6.1 was the largest spec, the only one flagged
`multiple-goals`, and the story that produced the most review findings — including six assertions that could not fail
**And** it says plainly whether five samples support a conclusion or not, rather than over-reading them

**AC3 — the correct `multiple-goals` flag is accounted for**

**Given** the flag on 6.1 was **right** — that story delivered the FR40 edit verb *and* the FR44 store write path
across both dialogs, two independently shippable goals
**When** the verdict is formed
**Then** it records that the scope came from the Epic 6 planning review, that `bmad-dev-auto` reported it in its own
blocked report **before Epic 6 ran**, and that it was ignored
**And** a warning that was correct is weighed differently from a warning that was noise

**AC4 — encode the verdict as an artifact, whichever way it goes**

**Given** both outcomes are legitimate closures
**When** the verdict is reached
**Then** **either** the threshold is raised or waived in `_bmad/custom/bmad-dev-auto.toml`, on the grounds that every
bag-please spec must carry a large body of standing convention — **or** a spec-size convention is added to
`project-context.md`
**And** "we looked and the threshold is wrong for this codebase" is an accepted, complete result
**And** the outcome does **not** live only in this epic's retrospective — that is the exact failure mode the Epic 6
retro identified when its predecessor's seven action-item rows came back 0/7

**AC5 — the ledger entry is closed**

**Given** `deferred-work.md` carries this item as open since the Epic 5 close-out, escalating
**When** the story is complete
**Then** that entry is marked resolved with the verdict and the artifact that now holds it

---

