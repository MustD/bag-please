---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
status: complete
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - docs/architecture-bp_back.md
  - docs/architecture-bp_front.md
  - docs/integration-architecture.md
---

# bag-please - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bag-please, decomposing the requirements from the
PRD, UX Design Specification, and Architecture documents into implementable stories for the
**User Registration & Authentication** feature.

## Requirements Inventory

### Functional Requirements

FR1: Unregistered user can create an account with a username and password
FR2: Registered user can authenticate with their username and password
FR3: Authenticated user can log out of the application
FR4: System automatically authenticates a user immediately after successful registration, without a separate login step
FR5: System displays a one-time welcome message the first time a user successfully logs in after registration
FR6: System issues a short-lived access token upon successful authentication
FR7: System issues a long-lived refresh token upon successful authentication
FR8: System silently renews the access token using a valid refresh token when the access token is expired, without user
interaction
FR9: System redirects the user to the login screen with a session-expiry message when the refresh token is no longer
valid
FR10: System invalidates the user's refresh token when they log out
FR11: Authenticated user can change their own password
FR12: System displays the authenticated user's name in the application navigation on all screens
FR13: Admin can view a list of all registered user accounts
FR14: Admin can create a new user account with a username and initial password
FR15: Admin can delete a user account
FR16: Admin can reset any user's password
FR17: System requires explicit admin confirmation before executing destructive user management actions (delete, reset
password)
FR18: Admin account credentials are supplied via environment variables and are not stored in the user database
FR19: Admin can change their own password only by updating environment variables
FR20: Admin can enable or disable public user self-registration at runtime
FR21: System hides the registration option from the login screen when public registration is disabled
FR22: Application configuration changes take effect immediately without requiring a service restart
FR23: Application configuration is persisted as a runtime entity in the database
FR24: System enforces role-based access control, distinguishing admin and regular user permissions on all protected
operations
FR25: System limits authentication and registration attempts from a single IP address within a time window
FR26: System prevents users from registering a username reserved by the admin account
FR27: System returns a consistent, non-distinguishing error message for all authentication failures
FR28: System includes the authenticated user's identity and role in the request context for all API operations
FR29: Unauthenticated users accessing protected routes are redirected to the login screen
FR30: Authenticated admin users can access the user management interface
FR31: Non-admin users accessing admin-only interfaces are denied access
FR32: System provides guidance on the login screen for users who cannot access their account (contact admin)
FR33: System displays a specific message when a user is redirected to login due to session expiry

### NonFunctional Requirements

NFR1: User passwords are hashed using bcrypt with cost factor 12; plaintext passwords are never stored or logged
NFR2: Refresh tokens are stored in MongoDB with a TTL index matching their 30-day expiry; expired tokens are
automatically purged
NFR3: Refresh tokens are delivered exclusively via httpOnly, SameSite=Strict cookies; never accessible to JavaScript
NFR4: Access tokens are short-lived (15 minutes); refresh tokens are long-lived (30 days)
NFR5: All client-server communication uses HTTPS in production
NFR6: Authentication endpoints are rate-limited per IP address to prevent brute-force attacks
NFR7: No passwords, raw tokens, or credential material appear in application logs
NFR8: JWT payloads contain only username and role claims; no sensitive user data is embedded in tokens
NFR9: Authentication operations (login, register, token refresh) complete in under 1 second under normal load
NFR10: Auth UI screens (login, registration) render without perceptible layout shift or blocking on mobile devices
NFR11: System supports a small user base (tens of users) in v1; no horizontal scaling or distributed session management
required
NFR12: ApplicationConfig is read directly from MongoDB on each request; no in-memory cache required for v1 given the low
read frequency of admin config operations
NFR13: All input fields on auth forms have visible, associated labels
NFR14: Auth forms are fully keyboard-navigable (tab order, submit on Enter)
NFR15: Form error messages are associated with their corresponding input fields
NFR16: Text and interactive elements on auth screens meet minimum colour contrast for readability

### Additional Requirements

From Architecture (Backend):

- AR1: New auth REST endpoints replace the current single `/api/login` endpoint — `POST /auth/register`,
  `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` — all under Ktor's `/api/` root path
- AR2: Admin operations are exposed via GraphQL mutations/queries (not REST): `users` query, `createUser`,
  `deleteUser`, `resetUserPassword` mutations, `applicationConfig` query, `setRegistrationEnabled` mutation. Auth
  endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/change-password`) remain REST
  because httpOnly cookie mechanics are not compatible with Apollo Client's response handling.
- AR3: `User` entity vertical slice: domain model (`User`), Mongo model + mapper (`MongoUser`), `UserService` calling
  `UserRepository` directly — no `UserStorage` in-memory cache layer. `UserStorage` is removed in Story 2.0.
  Registration in Routing.kt (REST, not GQL).
- AR4: `ApplicationConfig` entity for runtime flags (registration toggle): MongoDB `app_config` collection, read and
  written directly via `ApplicationConfigRepository` — no in-memory cache. Each read hits MongoDB.
- AR5: `Principal` must be threaded through the GraphQL context via `CustomGraphQLContextFactory` (currently
  commented-out code in `GQL.kt`) so downstream services can use it
- AR6: New MongoDB collections: `users`, `refresh_tokens`, `app_config`; `refresh_tokens` requires a TTL index on the
  expiry field
- AR7: Rate limiting must be added as a Ktor plugin (new `configure*()` function in `plugins/`), applied per-IP to
  `/auth/login` and `/auth/register`
- AR8: `src/test/resources/application.yaml` should replace `setUpJwt()` dynamic injection for static JWT config in
  tests (resolves documented tech debt)
- AR9: All new auth and admin route handlers follow the existing `configure*()` plugin pattern in `plugins/`; no inline
  configuration in `Application.kt`
- AR10: Test isolation rule applies to user data — tests must filter assertions by UUIDs created in the current test; no
  test may assume the users collection is empty

From Architecture (Frontend):

- AR11: Access token storage must migrate from `localStorage` to React state/context; `ApolloWrapper.tsx` SetContextLink
  must read from context, not `localStorage`
- AR12: A new React auth context must provide `username`, `role`, and token mutation functions (setToken, clearToken) to
  the component tree without creating a second Apollo client instance
- AR13: Apollo `onAuthError` callback must be enhanced to trigger silent token refresh on 401 before redirecting to
  login
- AR14: New App Router page files: `app/auth/register/page.tsx`, `app/admin/users/page.tsx`,
  `app/account/password/page.tsx`
- AR15: Any new GraphQL operations introduced (admin user management if exposed via GQL) go in
  `src/lib/auth/Queries.tsx`; `npm run generate` must be run after any schema change

### UX Design Requirements

UX-DR1: Create `src/lib/theme.ts` establishing the custom MUI v9 dark theme — palette (`background.default #0e0e10`,
`background.paper #1a1a1d`, `primary.main #4db6a8`, `primary.dark #3a9d96`, `error.main #d9534f`,
`text.primary #e8e8e8`, `text.secondary #9e9e9e`, `divider #2e2e32`), Inter font stack loaded via `next/font/google`,
and component defaults (`MuiButton` borderRadius 6 textTransform none, `MuiTextField` outlined variant, `MuiPaper`
subtle border, `MuiAppBar` flat no elevation); register via `ThemeProvider` in root layout; this must be done before any
component work

UX-DR2: Update `LoginPage` (`app/auth/page.tsx`) to edge-to-edge layout (no `Paper` card, `Box + Stack` only),
`maxWidth: 360` centred on desktop (`mx: "auto"`), inline `FormHelperText` errors (no Snackbar/floating Alert for form
errors), `Alert severity="warning"` above the heading for session expiry message, conditional "Register" link hidden
when registration is disabled, "Contact your admin" footer text when registration is off

UX-DR3: Create `RegisterPage` at `app/auth/register/page.tsx` — edge-to-edge layout matching login, username + password
fields with visible labels, inline `FormHelperText` for validation errors, link back to sign-in, triggers auto-login on
success and redirects to home

UX-DR4: Create `UserChip` component — rounded container (`Box` with `borderRadius: 20px`), avatar circle with username
initial, username `Typography`; styled entirely via `theme.components` overrides, no inline `sx` for visual style;
rendered in `AppHeader` only when user is authenticated; never shown when unauthenticated

UX-DR5: Create `WelcomeBanner` component (`app/store/WelcomeBanner.tsx`) — one-time dismissible, visibility controlled
by React `useState` flag set to `true` after auto-login post-registration (not persisted to localStorage or DB),
teal-tinted `Box` with welcome text including username and close `IconButton`; rendered on home page; disappears on
dismiss or page navigation

UX-DR6: Create `AdminUsersPage` at `app/admin/users/page.tsx` — `Paper`-wrapped MUI `Table` listing users with columns
for username and role; row-level `IconButton` actions for reset password and delete; "Create user" `Button`; `Switch`
with `FormControlLabel` for registration toggle; empty state row with muted "No users yet" text; `CircularProgress`
centred in table area while loading

UX-DR7: Create reusable `ConfirmDialog` at `app/admin/ConfirmDialog.tsx` — props: `open`, `title`, `message`,
`confirmLabel`, `confirmColor` (`"error"` | `"primary"`), `onConfirm`, `onCancel`, optional `children` for extra
fields (e.g. new password input); `maxWidth="xs"`; initial focus on Cancel button; confirm button shows loading
`CircularProgress` and is disabled during async operation; Escape closes dialog

UX-DR8: Create `ChangePasswordPage` at `app/account/password/page.tsx` — current password field + new password field,
submit `Button` with loading state, inline success confirmation on completion, accessible via account navigation

UX-DR9: Update `AppHeader` (`app/AppHeader.tsx`) — add `UserChip` rendered when `username` is available in auth context;
add admin-only "User Management" nav link/item visible only when user role is `admin`

UX-DR10: Update `Navigation` (`app/Navigation.tsx`) — add admin-only "User Management" `MenuItem` linking to
`/admin/users`; render conditionally based on role from auth context

UX-DR11: Implement consistent form patterns across all auth/admin forms: validation fires on submit only (not on
blur/keystroke); errors clear when the user modifies the field; Enter from any field in a single-column form submits;
primary action button shows `CircularProgress` replacing button text and is disabled while async operation is in flight

UX-DR12: Implement route guards: auth guard redirects unauthenticated users from any protected route to `/auth`
immediately; admin guard redirects non-admin users from `/admin/*` to `/`; post-login destination is always `/` in Phase
1

UX-DR13: Apply button hierarchy rules: one `variant="contained"` primary action per screen or dialog maximum;
`variant="outlined"` for cancel/secondary; `variant="contained" color="error"` for destructive confirm only; no Snackbar
for form errors; no success toasts — mutations confirmed by immediate UI update (row appears/disappears, dialog closes)

UX-DR14: Responsive implementation: all new screens designed mobile-first targeting ~360px viewport; auth screens use
`Box maxWidth: 360, mx: "auto", px: 2, py: 5` (no Paper card); admin table accepts horizontal scroll on `xs`; MUI
default breakpoints only; all spacing uses `theme.spacing()` multiples — no raw `px` values

UX-DR15: Accessibility compliance: `label` prop on all `TextField` instances (never placeholder-only); `title` prop on
all `IconButton` instances; `FormHelperText` with `error` prop for field errors (auto `aria-describedby`); Dialog MUI
focus trap must not be suppressed; registration `Switch` wrapped in `FormControlLabel` with visible text; `Alert` for
session expiry uses MUI's default `role="alert"`; WCAG AA contrast verified; keyboard-only navigation smoke test on each
new screen before merge

### FR Coverage Map

FR1: Epic 1 — Registration endpoint + RegisterPage
FR2: Epic 1 — Login endpoint + LoginPage update
FR3: Epic 1 — Logout endpoint + logout action
FR4: Epic 1 — Auto-login chain after register
FR5: Epic 1 — WelcomeBanner component
FR6: Epic 1 — Access token (15 min JWT) issuance
FR7: Epic 1 — Refresh token issuance + MongoDB TTL index
FR8: Epic 1 — Silent renewal via POST /auth/refresh + Apollo 401 intercept
FR9: Epic 1 — Session expiry redirect from frontend
FR10: Epic 1 — Logout invalidates refresh token in MongoDB
FR11: Epic 1 — ChangePasswordPage + endpoint
FR12: Epic 1 — UserChip in AppHeader
FR13: Epic 2 — GET /admin/users + AdminUsersPage table
FR14: Epic 2 — POST /admin/users + create dialog
FR15: Epic 2 — DELETE /admin/users/{id} + ConfirmDialog
FR16: Epic 2 — POST /admin/users/{id}/reset-password + ConfirmDialog with new-password field
FR17: Epic 2 — ConfirmDialog component, used for delete and reset
FR18: Epic 1 — Admin credentials sourced from env vars in login endpoint
FR19: Epic 2 — Documented constraint; no password field for admin in admin panel
FR20: Epic 2 — PUT /admin/config endpoint + registration Switch UI
FR21: Epic 2 — LoginPage conditionally hides Register link based on config
FR22: Epic 2 — ApplicationConfig in-memory cache invalidated on write
FR23: Epic 2 — ApplicationConfig MongoDB entity (app_config collection)
FR24: Epic 1 — JWT role claim; backend role enforcement on all protected endpoints
FR25: Epic 1 — Rate-limiting Ktor plugin on /auth/login + /auth/register
FR26: Epic 1 — Reserved username check in register endpoint
FR27: Epic 1 — Uniform "Invalid credentials" error on all auth failures
FR28: Epic 1 — Principal threaded through GraphQL context factory
FR29: Epic 1 — Auth guard redirecting unauthenticated to /auth
FR30: Epic 2 — Admin nav link + /admin/users route accessible to admin
FR31: Epic 2 — Admin guard redirecting non-admin from /admin/* to /
FR32: Epic 2 — "Contact your admin" copy on login when registration is off
FR33: Epic 1 — Session expiry Alert shown on login redirect

## Epic List

### Epic 1: User Authentication, Session Management & Identity

Users can create their own accounts, log in with personal credentials, have their session maintained silently for 30
days, see their name in the app bar on every page, change their own password, and log out cleanly. The complete backend
auth infrastructure (User entity, JWT tokens, refresh tokens, RBAC, rate limiting, Principal in GQL context) is in place
as the foundation for everything that follows.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR18, FR24, FR25, FR26, FR27, FR28,
FR29, FR33

### Epic 2: Admin User Management & Application Configuration

Admin can view the full user list, create users, reset any user's password, and delete accounts — all with explicit
confirmation dialogs on destructive actions. Admin can toggle public registration on or off at runtime. The admin panel
is accessible only to the admin role; non-admin users are blocked. The login screen adapts to the registration state (
link hidden / "contact admin" copy shown).

**FRs covered:** FR13, FR14, FR15, FR16, FR17, FR19, FR20, FR21, FR22, FR23, FR30, FR31, FR32

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
- CI: tests run in `headed=false` mode; HTML report artifact retained
