---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
status: complete
completedAt: '2026-05-08'
releaseMode: phased
classification:
  projectType: web_app
  domain: consumer_productivity
  complexity: medium
  projectContext: brownfield
inputDocuments:
  - _bmad-output/project-context.md
  - docs/index.md
  - docs/project-overview.md
  - docs/architecture-bp_back.md
  - docs/architecture-bp_front.md
  - docs/architecture-routing.md
  - docs/api-contracts-bp_back.md
  - docs/data-models-bp_back.md
  - docs/component-inventory-bp_front.md
  - docs/integration-architecture.md
  - docs/development-guide.md
  - docs/deployment-guide.md
  - docs/source-tree-analysis.md
workflowType: 'prd'
---

# Product Requirements Document — bag-please: User Registration & Authentication

**Author:** md
**Date:** 2026-05-08

## Executive Summary

Bag Please is a shared shopping list and store management web application (full-stack SPA, real-time GraphQL) currently
operating with a single hardcoded admin credential distributed to all users. This feature introduces **user registration
and authentication** — establishing individual user identity as the foundational layer required to unlock data
personalization, user-specific sharing, and controlled user base growth.

The immediate deliverable is functional: users create accounts, log in with their own credentials, and admins manage the
user lifecycle. The strategic deliverable is architectural: user identity becomes a first-class concept in the system,
making every future per-user feature — private lists, data sharing rules, invitations — technically possible.

All existing shared data (items, categories) remains shared across all users in this release. Data isolation and sharing
rules are deferred to subsequent features.

### What Makes This Special

The current model has a hard ceiling: without user identity, the product cannot grow beyond a single trusted group
sharing one password. This feature removes that ceiling. Users transition from being handed a credential to creating an
account they own — a shift that reframes how they relate to the product. The implementation is deliberately minimal: no
email, no self-service password recovery, no complex session management. The goal is to establish identity cleanly
without overengineering the first step.

### Project Classification

| Attribute           | Value                                                                        |
|---------------------|------------------------------------------------------------------------------|
| **Project Type**    | Web application — full-stack SPA, real-time GraphQL subscriptions            |
| **Domain**          | Consumer productivity / household management                                 |
| **Complexity**      | Medium — new auth layer, token lifecycle, admin controls, MongoDB user store |
| **Project Context** | Brownfield — new feature on an existing working system                       |

## Success Criteria

### User Success

- A new user can register with a username and password and is immediately logged in without a separate step
- On first login after registration, an **onboarding moment** is shown — a clear UI message explaining the state
  change (e.g. "Welcome, Alex! You now have your own account.")
- The authenticated user's name is visible in the app bar on all pages
- Login and logout flows complete end-to-end with no dead ends or confusing states
- All form state changes are visible with specific, human-readable messages: registration success, username taken,
  invalid credentials, rate limit reached
- Session expiry is handled gracefully — the refresh token silently renews the session; on refresh token expiry (30
  days), the user is redirected to login with an expiry message
- Admin can create users, reset any user's password, delete user accounts, and toggle public registration via
  `/admin/users`

### Business Success

- At least one non-admin user account can be created and used to access the full application
- Admin user management controls are fully operational: create, reset password, delete, toggle registration
- Public registration is available but **off by default** — admin manually onboards users at this stage
- The user identity layer is in place as the prerequisite for future data segregation — no architectural rework required
  to build per-user features after this ships

### Technical Success

- Auth layer has test coverage for:
    - Registration (success, username taken, reserved username)
    - Login (success, wrong credentials, rate limiting)
    - Token refresh (success, expired refresh token, tampered token)
    - Logout (refresh token invalidated in MongoDB)
    - Admin operations (create user, reset password, delete user, toggle registration)
    - Role boundary enforcement (non-admin cannot access admin endpoints)
- `Principal` is threaded through the GraphQL context in v1; items and categories ignore it until the data isolation
  feature is built
- Code is structured for future extensibility: user status (active/suspended), per-user data ownership, and sharing
  rules can be layered on without replacing the auth foundation
- No regressions in existing item and category functionality

### Measurable Outcomes

| Outcome             | Definition of Done                                                                                            |
|---------------------|---------------------------------------------------------------------------------------------------------------|
| Registration works  | User submits form → auto-logged in → onboarding moment shown → name in app bar                                |
| Password recovery   | Admin can reset any user's password via `/admin/users`                                                        |
| Admin controls work | Admin can create, list, reset password, and delete users; toggle registration on/off                          |
| Auth is secure      | Rate limiting active; tokens use httpOnly `SameSite=Strict` cookie; bcrypt-12 hashing; uniform error messages |
| Session handled     | Transparent token refresh; graceful redirect to login on session expiry                                       |
| Foundation solid    | A future story for per-user data can begin without touching the auth layer                                    |

## User Journeys

### Journey 1: The New Household Member — First Account (Happy Path)

**Persona:** Mia, partner of the current user. She's been sharing the admin credential — it's never felt like her
account.

**Opening Scene:** Mia opens bag-please, sees the login form with a "Register" link, taps it, enters a username and
password, and submits.

**Rising Action:** The frontend calls POST /auth/register. On success, it immediately uses the same credentials to call
POST /auth/login. Mia is auto-logged in. A one-time welcome banner appears: *"Welcome, Mia! You now have your own
account."* — shown once via a React component flag, not persisted. Her name appears in the app bar.

**Climax:** Mia sees the shared shopping list, adds an item, and it appears instantly. The experience is identical to
before — but it's hers.

**Resolution:** She logs out and back in. The welcome message does not reappear. The foundation for giving her a private
list is in place.

**Requirements revealed:** POST /auth/register → POST /auth/login chain, one-time welcome flag in React, name in app
bar, logout/login cycle, registration toggle must be on.

---

### Journey 2: The Colleague Who Arrives When Registration Is Closed

**Persona:** Tom, a colleague invited verbally. He visits the URL and sees the login form — no "Register" link, only "
Contact admin to reset your password."

**Opening Scene:** Tom has no credentials. He messages the admin.

**Rising Action:** The admin opens `/admin/users`, clicks "Create user", enters a username and password, confirms. The
admin sends Tom the credentials.

**Climax:** Tom logs in with the provided credentials. The one-time welcome banner appears. He's in.

**Resolution:** Tom navigates to account settings and changes his password. No forced redirect — his decision.

**Requirements revealed:** Registration toggle off = register link hidden, "Contact admin" copy on login, POST
/admin/users endpoint, one-time welcome on first login, user self-service password change.

---

### Journey 3: The Admin Manages the User Base

**Persona:** Alex, the admin. Pre-created from env vars at startup — credentials set in environment configuration, not
the database.

**Opening Scene:** Alex logs in with env-var credentials, navigates to `/admin/users`, sees the user list with roles.

**Creating a user:** Alex clicks "Create user", enters a username and initial password, confirms. The user appears in
the list immediately.

**Resetting a password:** Tom is locked out. Alex finds him, clicks "Reset password", enters a new password, confirms
via dialog: *"Reset Tom's password? This will invalidate his current session."* Done.

**Deleting a user:** A colleague leaves. Alex clicks "Delete", confirms via dialog: *"Delete this user? This cannot be
undone."* Account removed; their shared-list contributions remain.

**Toggling registration:** Alex briefly enables public registration for a family gathering via a toggle in the settings
section. Toggles it back off. Change takes effect immediately — stored as a runtime flag in the ApplicationConfig
MongoDB entity.

**Resolution:** Alex has full visibility and control. Destructive actions require explicit confirmation.

**Requirements revealed:** GET/POST/DELETE /admin/users, POST /admin/users/{id}/reset-password, confirmation dialogs on
destructive actions, PUT /admin/config (registration toggle), ApplicationConfig MongoDB entity.

---

### Journey 4: The Returning User — Session Handling

**Persona:** Mia, returning to the app at various intervals.

**Scene A — Within 15 minutes:** Access token is valid. Nothing happens. She's in.

**Scene B — After 15 minutes, within 30 days:** Access token expired, refresh token valid. The frontend detects the
expired access token (on app mount or first 401), calls POST /auth/refresh, receives a new access token. Mia never sees
a login screen.

**Scene C — After 30 days:** Refresh token expired. Frontend detects no valid refresh token, redirects to `/login` with:
*"Your session has expired. Please log in again."* She logs in, no welcome message, taken straight to the list.

**Resolution:** Token lifecycle is invisible when tokens are fresh. Expiry is communicated clearly, not silently.

**Requirements revealed:** POST /auth/refresh (triggered on expired access + valid refresh cookie), session expiry
message on login redirect, no onboarding message on re-login.

---

### Journey Requirements Summary

| Capability                                                 | Journeys |
|------------------------------------------------------------|----------|
| POST /auth/register → POST /auth/login chain               | J1       |
| One-time welcome banner (React flag)                       | J1, J2   |
| Name in app bar                                            | J1, J4   |
| Registration toggle (off by default, link hidden when off) | J2, J3   |
| "Contact admin" copy on login screen                       | J2       |
| User self-service password change                          | J2       |
| POST /admin/users (create user)                            | J2, J3   |
| POST /admin/users/{id}/reset-password                      | J3       |
| DELETE /admin/users/{id}                                   | J3       |
| Confirmation dialogs on destructive admin actions          | J3       |
| PUT /admin/config (registration toggle)                    | J3       |
| ApplicationConfig MongoDB entity (runtime feature flags)   | J3       |
| POST /auth/refresh (on expired access + valid refresh)     | J4       |
| Session expiry message on login redirect                   | J4       |
| Admin account from env vars (not DB)                       | J3       |

## Platform Requirements

bag-please is a Next.js App Router SPA with real-time GraphQL subscriptions. The auth feature adds registration, login,
session management, and admin user management to the existing SPA. No architectural changes to the SPA model are
required.

### Technical Architecture Considerations

- **Rendering model:** Client-side SPA — auth state managed in Apollo Client context; no server-side session or
  cookie-based rendering
- **Token storage:** Access token held in memory / Apollo Client link; refresh token in httpOnly `SameSite=Strict`
  cookie — consistent with existing `ApolloWrapper.tsx` link architecture
- **Auth state propagation:** `SetContextLink` in `ApolloWrapper.tsx` currently reads `localStorage` for the token;
  update to read access token from memory/state instead, keeping the refresh cookie invisible to JS
- **Real-time:** Existing GraphQL subscriptions remain unauthenticated (known tech debt); no change in scope for this
  feature

### Browser Support

| Target            | Support Level |
|-------------------|---------------|
| Chrome (current)  | Full          |
| Firefox (current) | Full          |
| Safari (current)  | Full          |
| Edge (current)    | Full          |
| Legacy / IE       | Not supported |

### Responsive Design

**Mobile-first.** All auth and admin UI (login form, registration form, onboarding message, `/admin/users`) is designed
for mobile screens first and adapts up to desktop. MUI `sx` breakpoints throughout — no fixed-width layouts on auth
screens.

## Project Scoping & Phased Development

### Strategy & Philosophy

**Approach:** Platform foundation MVP — ship the minimum that establishes user identity cleanly and unblocks all future
per-user features. No overengineering, no premature abstractions. Solo developer; each phase ships a complete, working
slice before the next begins.

### Phase 1 — MVP (This Release)

**Core journeys covered:** All four (registration, admin onboarding, admin user management, session lifecycle).

**Must-Have:**

- POST /auth/register + POST /auth/login chain with auto-login
- POST /auth/refresh (triggered on expired access token + valid refresh cookie)
- POST /auth/logout (refresh token invalidated in MongoDB)
- JWT with username + role claims; access token 15 min, refresh token 30 days
- Refresh token stored in MongoDB with TTL index; httpOnly `SameSite=Strict` cookie delivery
- bcrypt-12 password hashing
- Rate limiting per IP on `/login` and `/register`
- Admin account from env vars (not DB); admin password changeable via env vars only
- GET /admin/users, POST /admin/users, DELETE /admin/users/{id}, POST /admin/users/{id}/reset-password
- PUT /admin/config (registration toggle, off by default)
- ApplicationConfig MongoDB entity for runtime feature flags
- Role claim enforced server-side; Principal threaded through GraphQL context (data layer ignores it)
- Block reserved usernames; uniform "invalid credentials" error message
- `/admin/users` page — mobile-first MUI, confirmation dialogs on destructive actions
- Login / registration forms — mobile-first MUI
- One-time welcome banner (React flag, not DB-persisted)
- User's name in app bar
- Session expiry message on login redirect
- User self-service password change
- "Contact admin" copy on login screen
- Registration link hidden when registration is off
- Test coverage: registration, login, token refresh, logout, admin CRUD, role boundaries

**Nice-to-Have (may slip):**

- Polished empty states on `/admin/users` when no users exist yet

### Phase 2 — Growth (Post-MVP)

- User status: active / suspended (soft-disable without deletion)
- Self-service password reset
- Per-user data isolation (items/categories owned by creating user)
- Password complexity requirements

### Phase 3 — Vision (Future)

- Data sharing rules between users
- User invitations (by link or username)
- Household/group model with shared and private lists
- OAuth / social login

### Risk Mitigation

| Risk                                                           | Mitigation                                                                                                             |
|----------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| Token lifecycle complexity (refresh trigger: 401 vs app mount) | Specify frontend refresh trigger explicitly in functional requirements; build and test in isolation before integration |
| Solo developer scope creep                                     | Phase 2+ features frozen until Phase 1 ships and is stable                                                             |
| Admin env-var credentials lost                                 | Document in deployment guide; no recovery path exists by design                                                        |

## Functional Requirements

### User Authentication

- **FR1:** Unregistered user can create an account with a username and password
- **FR2:** Registered user can authenticate with their username and password
- **FR3:** Authenticated user can log out of the application
- **FR4:** System automatically authenticates a user immediately after successful registration, without a separate login
  step
- **FR5:** System displays a one-time welcome message the first time a user successfully logs in after registration

### Session Management

- **FR6:** System issues a short-lived access token upon successful authentication
- **FR7:** System issues a long-lived refresh token upon successful authentication
- **FR8:** System silently renews the access token using a valid refresh token when the access token is expired, without
  user interaction
- **FR9:** System redirects the user to the login screen with a session-expiry message when the refresh token is no
  longer valid
- **FR10:** System invalidates the user's refresh token when they log out

### User Account

- **FR11:** Authenticated user can change their own password
- **FR12:** System displays the authenticated user's name in the application navigation on all screens

### Admin User Management

- **FR13:** Admin can view a list of all registered user accounts
- **FR14:** Admin can create a new user account with a username and initial password
- **FR15:** Admin can delete a user account
- **FR16:** Admin can reset any user's password
- **FR17:** System requires explicit admin confirmation before executing destructive user management actions (delete,
  reset password)
- **FR18:** Admin account credentials are supplied via environment variables and are not stored in the user database
- **FR19:** Admin can change their own password only by updating environment variables

### Application Configuration

- **FR20:** Admin can enable or disable public user self-registration at runtime
- **FR21:** System hides the registration option from the login screen when public registration is disabled
- **FR22:** Application configuration changes take effect immediately without requiring a service restart
- **FR23:** Application configuration is persisted as a runtime entity in the database

### Security & Access Control

- **FR24:** System enforces role-based access control, distinguishing admin and regular user permissions on all
  protected operations
- **FR25:** System limits authentication and registration attempts from a single IP address within a time window
- **FR26:** System prevents users from registering a username reserved by the admin account
- **FR27:** System returns a consistent, non-distinguishing error message for all authentication failures
- **FR28:** System includes the authenticated user's identity and role in the request context for all API operations

### Navigation & Access Routing

- **FR29:** Unauthenticated users accessing protected routes are redirected to the login screen
- **FR30:** Authenticated admin users can access the user management interface
- **FR31:** Non-admin users accessing admin-only interfaces are denied access
- **FR32:** System provides guidance on the login screen for users who cannot access their account (contact admin)
- **FR33:** System displays a specific message when a user is redirected to login due to session expiry

## Non-Functional Requirements

### Security

- **NFR1:** User passwords are hashed using bcrypt with cost factor 12; plaintext passwords are never stored or logged
- **NFR2:** Refresh tokens are stored in MongoDB with a TTL index matching their 30-day expiry; expired tokens are
  automatically purged
- **NFR3:** Refresh tokens are delivered exclusively via httpOnly, `SameSite=Strict` cookies; never accessible to
  JavaScript
- **NFR4:** Access tokens are short-lived (15 minutes); refresh tokens are long-lived (30 days)
- **NFR5:** All client-server communication uses HTTPS in production
- **NFR6:** Authentication endpoints are rate-limited per IP address to prevent brute-force attacks
- **NFR7:** No passwords, raw tokens, or credential material appear in application logs
- **NFR8:** JWT payloads contain only username and role claims; no sensitive user data is embedded in tokens

### Performance

- **NFR9:** Authentication operations (login, register, token refresh) complete in under 1 second under normal load
- **NFR10:** Auth UI screens (login, registration) render without perceptible layout shift or blocking on mobile devices

### Scalability

- **NFR11:** System supports a small user base (tens of users) in v1; no horizontal scaling or distributed session
  management required
- **NFR12:** ApplicationConfig is loaded at startup and may be cached in memory; writes invalidate the cache immediately

### Accessibility

- **NFR13:** All input fields on auth forms have visible, associated labels
- **NFR14:** Auth forms are fully keyboard-navigable (tab order, submit on Enter)
- **NFR15:** Form error messages are associated with their corresponding input fields
- **NFR16:** Text and interactive elements on auth screens meet minimum colour contrast for readability
- **NFR17:** The frontend has a Playwright e2e test suite covering all auth and session flows; the suite runs
  against the full stack (nginx + backend + MongoDB) and must pass with zero failures before any Epic 1 or
  Epic 2 story is marked done
- **NFR18:** E2E tests use browser-level isolation (no shared auth state across test files); tests that require
  an authenticated session establish it via a Playwright setup fixture calling `POST /api/auth/login` directly
  rather than driving the UI login form each time
