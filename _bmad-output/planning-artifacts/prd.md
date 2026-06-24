---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
status: complete
completedAt: '2026-05-08'
lastEdited: '2026-06-23'
editHistory:
  - date: '2026-06-23'
    changes: 'Frontend Reframe (Epic 5): frontend re-implemented from scratch on Vite + Material UI, served by Caddy (replacing Next.js + nginx); backend unchanged. No FR changes — same requirements, new delivery vehicle. Deferred FR42 (one-timer) and FR43 (recurring) item UI; real-time (FR52/FR53) kept. Removed the old Epic 5 (Stabilization & Delivery). See sprint-change-proposal-2026-06-23.md.'
  - date: '2026-05-20'
    changes: 'Added Epic 4 (Personal Lists & Sharing): exec summary section, success criteria, 4 user journeys, FR34–FR56, NFR-L1–NFR-L5, updated phasing. Second pass: resolved 17 open issues — soft-delete + hourly scheduler (FR54), pending invite model (FR39), cascade delete (FR37), leave list (FR55), admin restrictions (FR56), Household tab = member management (FR48), category group disappear on completion (FR49), Today tab item-add with list selector (FR49), migration to most recent non-admin user (FR47), Epic 4 risk mitigation table'
releaseMode: phased
classification:
  projectType: web_app
  domain: consumer_productivity
  complexity: high
  projectContext: brownfield
inputDocuments:
  - _bmad-output/project-context.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification-epic-4.md
  - _bmad-output/implementation-artifacts/epic-3-retro-2026-05-18.md
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

# Product Requirements Document — bag-please

**Author:** md
**Date:** 2026-05-08 (Epic 4 additions: 2026-05-20)

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

> **Frontend Reframe (Epic 5, 2026-06-23).** The frontend is being re-implemented from scratch as a **Vite + Material UI
**
> single-page app served by **Caddy** (replacing the Next.js app and nginx). The Ktor/GraphQL backend is unchanged and
> consumed as-is. No functional requirements change — the same FRs are re-delivered on the new stack — except that
> one-timer (FR42) and recurring (FR43) item affordances are **deferred** (backend support remains) while real-time
> collaboration (FR52/FR53) is kept. The old "Epic 5: Stabilization & Delivery" is removed. Details:
> `sprint-change-proposal-2026-06-23.md`.

### What Makes This Special

The current model has a hard ceiling: without user identity, the product cannot grow beyond a single trusted group
sharing one password. This feature removes that ceiling. Users transition from being handed a credential to creating an
account they own — a shift that reframes how they relate to the product. The implementation is deliberately minimal: no
email, no self-service password recovery, no complex session management. The goal is to establish identity cleanly
without overengineering the first step.

### Epic 4: Personal Lists & Sharing

Epics 1–3 delivered the identity foundation: users have accounts, the admin manages the user base, and the system knows who is authenticated on every request. Epic 4 builds directly on that foundation to deliver the product's first multi-tenancy feature — **personal lists with sharing**.

Before Epic 4, all items and categories are globally visible to every user. After Epic 4, all data is scoped to a specific list. Each user owns their own lists, can share any list with other users by username, and collaborators receive full peer write access with no owner/member role distinction. Existing items are migrated to a default admin-owned list on first deploy.

The frontend undergoes a structural redesign: the AppBar/drawer pattern is replaced by bottom tab navigation (Today · Lists · Household). The Today tab is the primary shopping view, with a chip-row switcher for moving between lists. All create and edit actions occur in overlay sheets without leaving the shopping context.

Item lifecycle becomes explicit: items can be designated as one-timers (auto-deleted on check-off) or recurring (weekly, biweekly, monthly — automatically restored at the configured cadence). A new `store` field allows users to record where to buy each item, and `addedBy` surfaces who added each item in a shared list.

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

### Epic 4 — User Success

- A user can create a named list with an emoji icon and begin adding items immediately; after creation the app
  navigates directly to the new list's shopping view
- Switching the active list takes one tap on a chip; the active list is unambiguous at all times — chip row,
  toolbar title, and URL agree
- A list owner can share a list with another registered user by username; the invitee gains full peer write access
  immediately, without an invitation acceptance step
- One-timer items exit the list on first check-off with a directional animation signalling intent; an undo snackbar
  is available for 4 seconds
- Recurring items reappear on the list at the configured cadence (weekly, biweekly, or monthly) without any user
  action
- A collaborator's check-off or item add appears on all members' screens in real-time via subscription, with the
  `addedBy` avatar visible on the item row
- The progress strip fills when all items are checked, delivering a clear "job done" signal

### Epic 4 — Business Success

- All existing items and categories migrate to a default list on first Epic 4 deploy; no data is lost
- Each user's lists are fully access-controlled; no user can view or modify items in a list they are not a member of
- The architecture supports adding further per-list features (roles, list archive, household model) without
  reworking the list or membership data model

### Epic 4 — Technical Success

- Every service-layer method that reads or writes list-scoped data verifies caller membership before accessing data
- WebSocket subscriptions are authenticated; subscription events from list A are never delivered to a subscriber of
  list B
- The startup migration is idempotent; repeated restarts after a complete migration produce no side effects
- No regression in Epics 1–3 auth, admin, and item/category functionality

### Epic 4 — Measurable Outcomes

| Outcome               | Definition of Done                                                                                          |
|-----------------------|-------------------------------------------------------------------------------------------------------------|
| List creation works   | User creates list → navigates to `/list/[id]` → adds first item → item scoped to that list                 |
| Sharing works         | Owner shares by username → member can add/edit/check items → owner sees changes in real-time               |
| Lifecycle works       | One-timer exits on check-off with animation + undo; recurring item reappears next cadence cycle             |
| Data isolation solid  | User A cannot access any items or categories from lists they are not a member of                             |
| Migration safe        | First Epic 4 startup: all existing items assigned to default list; second startup: no-op, no duplicates     |
| WebSocket secured     | WS connections without valid JWT are rejected; connections closed when token expires                        |

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

---

### Journey 5: The New User — First List Creation

**Persona:** Mia, who just logged in for the first time after Epic 4 deploys. She lands on `/` which redirects to
`/lists` because she has no lists yet.

**Opening Scene:** `/lists` shows a designed empty state: *"You don't have any lists yet. Create your first one."*
She taps the button.

**Rising Action:** A bottom sheet opens. Mia types "Groceries", taps an emoji (🛒), confirms. The `createList`
mutation resolves. The app navigates to `/list/[newListId]`.

**Climax:** The Today tab shows her new list with an empty-state prompt: *"Tap + to add your first item."* She adds
"Milk". It appears in the list, scoped to this list. The progress strip shows 0 of 1 checked.

**Resolution:** Mia taps + again, adds three more items. She can now tap the Today tab from anywhere to return to
this list. The chip row at the top shows "Groceries 🛒 (4)".

**Requirements revealed:** `createList` mutation, zero-lists empty state on `/lists`, post-creation navigation to
`/list/[id]`, zero-items empty state on Today, chip-row item count, list-scoped item creation.

---

### Journey 6: Shopping the Active List — The Core Loop

**Persona:** Tom, mid-aisle at the grocery store with bag-please open on his phone.

**Opening Scene:** Tom opens the app. Today tab is active, chip row shows "Groceries 🛒 (6)". He can see milk,
eggs, butter — grouped by category. The progress strip is empty.

**Core loop:** Tom taps "Milk". It checks off with a smooth animation. The progress strip advances. An undo snackbar
appears for 4 seconds — he ignores it. He checks off "Eggs". Progress advances again.

**Detour:** Tom notices an item tagged with a one-timer icon (⚡). He checks it off — it exits with a directional
animation. The item count on the chip drops from 6 to 4. He's not alarmed; the icon told him this would happen.

**List complete:** Tom checks the last item. The progress strip fills. The UI shows a brief completion state — *"All
done."* He knows he can leave.

**Requirements revealed:** Single-tap check-off, optimistic update with rollback, progress strip, undo snackbar (4s),
one-timer visual signal (icon on item row before tap), one-timer exit animation on check-off, all-done completion
state, chip-row item count updates.

---

### Journey 7: Sharing a List and Collaborating

**Persona:** Mia sharing her Groceries list with Tom so they can shop together.

**Opening Scene:** Mia is on `/list/[groceriesId]`. She taps the list options and opens the share sheet.

**Sharing:** She types Tom's username. The `shareList` mutation adds Tom as a member instantly. Tom's device receives
a real-time subscription event; his Lists tab now shows Groceries.

**Collaboration:** Tom opens the list. Both Mia and Tom see the same items. Tom checks off "Butter". On Mia's screen,
"Butter" checks off via subscription within a second — no refresh needed. The item row shows Tom's avatar (addedBy).

**Ambiguity prevention:** Mia adds an item to Groceries while Tom is mid-aisle. It appears on Tom's screen immediately.
He sees the `addedBy` avatar; he knows Mia added it, not an error.

**Requirements revealed:** `shareList` mutation by username, real-time item updates via subscription for all members,
`addedBy` avatar on item rows, membership-gated list access, Lists tab shows shared lists.

---

### Journey 8: Item Lifecycle — One-Timer and Recurring

**Persona:** Mia managing her grocery list over several weeks.

**Opening Scene A — One-timer:** Mia adds "WD-40" to the list, opens the item editor, sets lifecycle to *One-time*.
An icon appears on the item row signalling its behavior. When she checks it off, it exits with an animation. It does
not reappear. No manual deletion needed.

**Opening Scene B — Recurring:** Mia adds "Oat Milk" and sets recurring to *Weekly*. She checks it off on a Monday.
The following Monday the item reappears, unchecked, on the same list. She never has to re-add it.

**Edge case:** Mia changes her mind about WD-40 mid-shop and taps undo immediately after checking it off. The item
is restored in its checked-off → unchecked state. The deletion mutation is cancelled.

**Resolution:** The list curates itself. One-timers clean up on exit; recurring items return without effort. Mia's
mental load is reduced — the list reflects what she needs without her having to manage it.

**Requirements revealed:** `recurring` field on Item (`null` | `"weekly"` | `"biweekly"` | `"monthly"` |
`"one-time"`), item editor lifecycle segmented control, one-timer icon on item row, one-timer delete-on-check-off
mutation, recurring restore logic, undo snackbar cancelling delete on one-timers.

---

### Journey Requirements Summary

| Capability                                                 | Journeys    |
|------------------------------------------------------------|-------------|
| POST /auth/register → POST /auth/login chain               | J1          |
| One-time welcome banner (React flag)                       | J1, J2      |
| Name in app bar                                            | J1, J4      |
| Registration toggle (off by default, link hidden when off) | J2, J3      |
| "Contact admin" copy on login screen                       | J2          |
| User self-service password change                          | J2          |
| POST /admin/users (create user)                            | J2, J3      |
| POST /admin/users/{id}/reset-password                      | J3          |
| DELETE /admin/users/{id}                                   | J3          |
| Confirmation dialogs on destructive admin actions          | J3          |
| PUT /admin/config (registration toggle)                    | J3          |
| ApplicationConfig MongoDB entity (runtime feature flags)   | J3          |
| POST /auth/refresh (on expired access + valid refresh)     | J4          |
| Session expiry message on login redirect                   | J4          |
| Admin account from env vars (not DB)                       | J3          |
| `createList` mutation; post-creation nav to `/list/[id]`   | J5          |
| Zero-lists empty state on `/lists`                         | J5          |
| Zero-items empty state on Today; chip-row item count       | J5, J6      |
| Single-tap check-off; optimistic update + rollback         | J6          |
| Progress strip; all-done completion state                  | J6          |
| Undo snackbar (4s) on check-off and delete                 | J6, J8      |
| One-timer icon on item row; exit animation on check-off    | J6, J8      |
| `shareList` mutation by username                           | J7          |
| Real-time item updates via subscription for all members    | J6, J7      |
| `addedBy` avatar on item rows                              | J7          |
| `recurring` field; restore logic on cadence                | J8          |
| Item editor lifecycle segmented control                    | J8          |

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

**Approach:** Incremental platform build — each phase ships a complete, working slice before the next begins. No
overengineering, no premature abstractions. Solo developer. Phase 1 established user identity; Phase 2 scopes all data
to lists and introduces sharing.

### Phase 1 — Foundation (Delivered, Epics 1–3)

**Core journeys covered:** Registration, admin onboarding, admin user management, session lifecycle.

**Delivered:**

- POST /auth/register + POST /auth/login chain with auto-login
- POST /auth/refresh (triggered on expired access token + valid refresh cookie)
- POST /auth/logout (refresh token invalidated in MongoDB)
- JWT with username + role claims; access token 15 min, refresh token 30 days
- Refresh token stored in MongoDB with TTL index; httpOnly `SameSite=Strict` cookie delivery
- bcrypt-12 password hashing; rate limiting per IP on `/login` and `/register`
- Admin account from env vars (not DB)
- GET /admin/users, POST /admin/users, DELETE /admin/users/{id}, POST /admin/users/{id}/reset-password
- PUT /admin/config (registration toggle, off by default)
- ApplicationConfig MongoDB entity for runtime feature flags
- Role claim enforced server-side; Principal threaded through GraphQL context
- `/admin/users` page — mobile-first MUI, confirmation dialogs on destructive actions
- Login / registration forms — mobile-first MUI; one-time welcome banner; user's name in app bar
- Playwright e2e suite covering all auth and admin flows

### Phase 2 — Personal Lists & Sharing (Current, Epic 4)

**Core journeys covered:** List creation, shopping loop, sharing and collaboration, item lifecycle.

**Must-Have:**

- `createList`, `deleteList`, `shareList`, `lists` query, pending invite model — new GQL operations
- Items and categories scoped to `listId`; existing data migrated to default list owned by most recent non-admin user
- One-time startup migration; idempotent via `app_migrations`; hard-fails if no non-admin users exist with unscoped items
- Admin restricted to user/config management; list GQL operations rejected for admin callers
- Per-list authorization enforced at service layer via `CallerUsername` value class
- WebSocket subscriptions authenticated via `connectionParams` JWT; backend closes on token expiry
- Subscription events filtered per-list; no cross-list event leakage
- Pending invite model: share creates invite; Lists page shows Accept/Reject; list inactive until accepted
- Member removal by owner; items remain; effective on next data access
- Non-owner leave: member removes themselves; items remain
- `recurring` field on Item: `null` | `"one-time"` | `"weekly"` | `"biweekly"` | `"monthly"`
- Hourly background scheduler: restores recurring items (7/14/30 days after check-off); hard-deletes soft-deleted
  one-timers older than 1 hour; queries indexed on `{listId, recurring, checkedAt}` and `{deleted, deletedAt}`
- One-timer soft-delete on check-off; undo available until navigation away; scheduler handles hard delete
- Cascade delete on list removal (items + categories); non-owners leave instead of delete
- `store` (optional) and `addedBy` fields on Item
- Bottom tab navigation (Today · Lists · Household); Household tab = member management
- Today tab: category groups disappear when fully checked; + button adds item with list selector if multiple lists
- Lists tab: owned/member lists + pending invites section; zero-lists onboarding message
- `BPSheet` overlay for all create/edit; create-list sheet: name (required) + description (optional)
- Chip-row list switcher on Today; URL-encoded active list (`/list/[listId]`)
- Progress strip; undo snackbar until navigation; all-done completion state
- `addedBy` avatar on item rows
- MUI `ThemeProvider` with `theme.ts` token mapping; MUI CSS variables mode deferred

**Nice-to-Have (may slip):**

- Sepia/dark theme variants
- Store suggestion chips pre-populated from existing item data

### Phase 3 — Growth (Post-Epic 4)

- User status: active / suspended (soft-disable without deletion)
- Self-service password reset via admin or email
- Password complexity requirements
- Membership revocation UX (notify removed user)
- Subscription auth hardening (periodic token re-validation mid-session)

### Phase 4 — Vision (Future)

- Household/group model with shared and private lists
- User invitations by link
- OAuth / social login
- Activity feed (opt-in)

### Risk Mitigation

| Risk                                                           | Mitigation                                                                                                              |
|----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| Token lifecycle complexity (refresh trigger: 401 vs app mount) | Specify frontend refresh trigger explicitly in functional requirements; build and test in isolation before integration  |
| Solo developer scope creep                                     | Phase 2+ features frozen until Phase 1 ships and is stable                                                              |
| Admin env-var credentials lost                                 | Document in deployment guide; no recovery path exists by design                                                         |
| Migration target user missing at deploy time                   | Startup hard-fails with descriptive error if no non-admin users exist and unscoped items are present; deploy checklist: create target user before deploying Epic 4 |
| Hourly scheduler missed cycles (app restart, downtime)         | Scheduler is stateless and reads from DB on each run; missed cycles self-heal on next hourly tick; one restoration per item per run regardless of elapsed cycles |
| Sharing mental model mismatch (users expect read-only)         | Sharing UI explicitly states "full access" before invite is sent; no read-only mode exists in Epic 4 (deferred to Phase 3) |
| Admin inadvertently accessing list data                        | All list GQL operations return auth error for admin callers (FR56); enforced at service layer, not only at route level  |

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

### List Management

- **FR34:** User can create a named shopping list with an emoji icon and an optional description
- **FR35:** User can view all lists they own or are a member of
- **FR36:** User can switch between lists using a chip-row switcher in the shopping view; the active list is always
  visible in the chip row, the toolbar title, and the URL
- **FR37:** Only the list owner can delete a list; deletion permanently removes the list, all its items, and all
  its categories from the database; active subscribers to the list are disconnected on deletion; non-owner members
  cannot delete — they can leave the list instead (see FR55)
- **FR38:** The active list is identified by URL (`/list/[listId]`); navigating to that URL loads the list's items;
  `/` redirects to the user's oldest list by creation date, or to `/lists` if the user has no lists

### List Sharing & Membership

- **FR39:** List owner can share a list with another registered user by exact username match; sharing creates a
  pending invite; the invited user sees the invite with Accept and Reject buttons on the Lists page; the list is
  not accessible to the invited user until they accept; sharing with an unknown username, an existing member, or
  oneself produces a specific descriptive error message
- **FR40:** All list members (owner and shared users) can add, check off, edit, and delete items in a shared list;
  no owner/member role distinction exists within a list for item operations; the list owner can remove any member
  at any time — the removed member's items remain on the list and the removal takes effect on the member's next
  list data access (active subscription terminates via membership re-evaluation on next emitted event)
- **FR41:** A user can only view and modify items and categories in lists they own or have been accepted as a member
  of; pending invites do not grant access; unauthorized access to `/list/[listId]` redirects to `/lists`
- **FR55:** A non-owner list member can leave a shared list at any time; leaving removes the user from the member
  array immediately; items they added remain on the list

### Item Lifecycle

- **FR42:** User can designate an item as a one-timer at creation or via edit; checking off a one-timer soft-deletes
  it (`deleted: true`, `deletedAt: now`) and removes it from the list view with a directional exit animation; an
  undo snackbar is available until the user navigates away from the current screen — tapping undo clears the
  soft-delete flag and restores the item; navigating away cancels the undo opportunity; the hourly background
  scheduler (FR54) permanently removes items soft-deleted for more than one hour
- **FR43:** User can set an item as recurring (weekly, biweekly, or monthly); the cadence and any changes to it are
  configured in the item editor; the hourly background scheduler (FR54) restores recurring items whose cadence has
  elapsed since check-off: weekly = 7 days, biweekly = 14 days, monthly = 30 days; each cycle produces exactly one
  restoration regardless of how many cycles have been missed; restored items have `checked: false`
- **FR44:** User can optionally specify a store for an item; the item editor surfaces pre-populated store
  suggestions derived from existing item data
- **FR45:** Each item displays the username of the user who added it (`addedBy`) as an avatar or label on the item
  row in the shopping view
- **FR54:** A background scheduler service runs every hour; it performs two tasks: (a) restores recurring items
  whose cadence has elapsed since check-off by setting `checked: false`; (b) permanently hard-deletes one-timer
  items that have been soft-deleted for more than one hour; compound indexes on the items collection back both
  queries to keep each hourly run efficient (index definitions are in the architecture document)

### Data Scoping & Migration

- **FR46:** All newly created items and categories are associated with a specific list at creation time; no
  unscoped global items exist after Epic 4
- **FR47:** On first application startup after Epic 4 deployment, all existing items and categories without a
  `listId` are migrated to a default list (`name: "Groceries"`, `emoji: "🛒"`) owned by the most recently created
  non-admin user in the database; if no non-admin users exist, startup fails with a descriptive error; the
  migration writes a completion record to `app_migrations` and does not re-run on subsequent startups
- **FR56:** The admin account is restricted to user management and application configuration only; admin callers
  are rejected by all list-related GQL operations (`createList`, `lists`, `items`, `categories`, `shareList`,
  `deleteList`, and all subscription operations); the admin cannot create, own, view, or be a member of any list

### Navigation & UX

- **FR48:** Bottom tab navigation (Today, Lists, Household) is the primary navigation chrome, replacing the
  existing AppBar and navigation drawer; the Household tab displays the current user's list memberships and allows
  list owners to remove members from lists they own
- **FR49:** The Today tab displays the active list's items organized by category with a progress strip; category
  groups disappear from view when all items in the group are checked off; a completion state is shown when all
  items across all categories are checked; the Today tab includes a + button to add a new item directly — if the
  user has multiple lists, a list selector is shown so they can choose which list to add to
- **FR50:** The Lists tab displays all lists the user owns or is a member of, plus a pending invites section
  showing lists awaiting accept or reject; a zero-lists state with no pending invites shows an onboarding message
  with guidance to create a first list, category, and item
- **FR51:** All item creation and editing occurs in bottom sheet overlays without navigating away from the
  shopping view; the create-list sheet contains a name field (required) and a description field (optional);
  closing any sheet returns the user to their exact scroll position

### Real-Time Collaboration & Authentication

- **FR52:** Item updates (check-off, add, edit, delete) from any list member appear in real-time on all other
  members' shopping views via GraphQL subscription without requiring a manual refresh
- **FR53:** WebSocket subscription connections require a valid JWT supplied in `connectionParams` on connection
  establishment; unauthenticated connections are rejected; the backend closes the connection when the token expires;
  the frontend disposes the connection before clearing auth state on logout or password reset

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

### Lists & Sharing

- **NFR-L1:** Subscription events are scoped per-list; a subscriber to list A receives no events originating from
  list B under any circumstances; scoping is enforced at both subscribe time (membership gate) and per-event
  (membership re-evaluation via `takeWhile`)
- **NFR-L2:** Every service-layer method that reads or writes list-scoped data verifies the caller's list
  membership before accessing data; the membership check precedes all data access including read-only queries;
  no exceptions
- **NFR-L3:** The Epic 4 data migration is idempotent; running it against an already-migrated database produces no
  changes, no duplicate lists, and no errors; idempotency is guaranteed by a `app_migrations` completion record
  checked at startup
- **NFR-L4:** No list's items or categories are accessible to users not listed as members of that list at any layer
  of the stack (GQL resolver, service, storage); unauthorized access returns a GQL error, not an empty result
- **NFR-L5:** WebSocket subscription connections require a valid JWT supplied in `connectionParams`; the backend
  validates the token before establishing any subscription stream; the connection is closed when the validated
  token expires; the `clearAuth()` frontend function disposes the WebSocket client before clearing auth state to
  prevent orphaned in-flight events reaching React state after logout
