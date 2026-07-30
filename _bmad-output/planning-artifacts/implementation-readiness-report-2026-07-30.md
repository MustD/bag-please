---
stepsCompleted: [1, 2, 3, 4, 5, 6]
status: complete
readinessStatus: 'READY — both plan-blocking defects (C1, C2) remediated 2026-07-30; residual items are documentation accuracy and story-level polish'
remediationApplied: ['C1 — FR58 create-vs-update rule corrected in prd.md + epics.md', 'C2 — epic-7 block + 15 story keys added to sprint-status.yaml', 'NFR17/NFR18 corrected in prd.md and added to epics.md inventory', 'M1 — Story 7.5 AC2 test vehicle named']
startedAt: '2026-07-30'
completedAt: '2026-07-30'
assessmentScope: 'Epic 7 — correctness, test harness, and dependency currency'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/ux-design-specification-epic-4.md
  - _bmad-output/project-context.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - _bmad-output/implementation-artifacts/deferred-work.md
  - _bmad-output/implementation-artifacts/epic-5-retro-2026-07-28.md
  - _bmad-output/implementation-artifacts/epic-6-retro-2026-07-29.md
referenceOnly:
  - _bmad-output/planning-artifacts/architecture-epics-1-2.md
  - _bmad-output/planning-artifacts/prd-validation.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-11.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-23.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-30
**Project:** bag-please

## Step 1 — Document Inventory

No sharded documents exist anywhere under `_bmad-output/planning-artifacts/`, so there are **no whole-vs-sharded
duplicate conflicts**. Several documents are layered by epic; lineage was verified via each file's `inputDocuments`
frontmatter and resolved without user intervention.

### PRD

| File | Size | Status |
|---|---|---|
| `prd.md` | 48K | **Authoritative.** completedAt 2026-05-08; lastEdited 2026-07-29 (Epic 7 planning pass added FR58, FR59) |
| `prd-validation.md` | 24K | Reference only — a validation report *about* the PRD, not a competing PRD |

### Architecture

| File | Size | Status |
|---|---|---|
| `architecture.md` | 48K | **Primary.** completedAt 2026-05-18; file touched 2026-06-24. Declares `architecture-epics-1-2.md` as its own input, so it supersedes it |
| `architecture-epics-1-2.md` | 40K | Historical reference only — completedAt 2026-05-08, narrower scope |

### Epics & Stories

| File | Size | Status |
|---|---|---|
| `epics.md` | 256K | **Authoritative.** Modified 2026-07-30 09:44. `stepsCompleted` covers `epic7-story-7.1`…`epic7-story-7.15` plus `epic7-step-04-final-validation` |

No per-story files exist for Epic 7. `implementation-artifacts/` holds story files through `5-4-*` and then
`spec-*.md` files for 5.5–6.2. No `epic-7-context.md` exists, though Epics 5 and 6 each have one.

### UX Design

| File | Size | Status |
|---|---|---|
| `ux-design-specification.md` | 40K | Base spec, completedAt 2026-05-08 |
| `ux-design-specification-epic-4.md` | 116K | Epic 4 addendum, 2026-05-19 |
| `ux-design-directions.html`, `ux-design-directions-epic-4.html` | 40K / 32K | Visual direction mockups, not markdown specs |

### Supporting artifacts (cross-check inputs)

`project-context.md` (77 rules, updated 2026-07-29, loaded as a persistent fact) ·
`implementation-artifacts/sprint-status.yaml` · `deferred-work.md` ·
`epic-5-retro-2026-07-28.md`, `epic-6-retro-2026-07-29.md`, retros for epics 1–4 ·
`epic-5-context.md`, `epic-6-context.md` · `sprint-change-proposal-2026-05-11.md`,
`sprint-change-proposal-2026-06-23.md` · prior readiness reports (2026-05-08, 2026-05-22)

### Discovery-stage concerns carried into later steps

1. **Architecture staleness (not a duplicate).** `architecture.md` predates Epic 5's from-scratch frontend rebuild
   (Next.js + nginx → Vite + MUI + Caddy). No Epic 5/6/7 architecture revision exists. Carried forward as an
   alignment gap.
2. **UX specs self-declared stale.** `epics.md` carries an inline note that the Epic 4 UX spec "is stale on
   presentation from Epic 5 onward." Neither UX document describes the shipped UI. Both read with that caveat.
3. **Epic 7 has no context file and no story files.** Epic 7 assessment rests on `epics.md` alone.

**Assessment scope confirmed:** Epic 7 readiness. Epics 1–6 are shipped (production `0.16.0`).

## Step 2 — PRD Analysis

Source: `_bmad-output/planning-artifacts/prd.md` (read in full, 742 lines). Numbering is continuous —
**FR1–FR59 with no gaps**, though the sections are ordered by delivery epoch rather than by number (FR54–FR59 are
interleaved into the Epic 4 sections they amend).

### Functional Requirements

**User Authentication**

- **FR1:** Unregistered user can create an account with a username and password
- **FR2:** Registered user can authenticate with their username and password
- **FR3:** Authenticated user can log out of the application
- **FR4:** System automatically authenticates a user immediately after successful registration, without a separate
  login step
- **FR5:** System displays a one-time welcome message the first time a user successfully logs in after registration

**Session Management**

- **FR6:** System issues a short-lived access token upon successful authentication
- **FR7:** System issues a long-lived refresh token upon successful authentication
- **FR8:** System silently renews the access token using a valid refresh token when the access token is expired,
  without user interaction
- **FR9:** System redirects the user to the login screen with a session-expiry message when the refresh token is no
  longer valid
- **FR10:** System invalidates the user's refresh token when they log out

**User Account**

- **FR11:** Authenticated user can change their own password
- **FR12:** System displays the authenticated user's name in the application navigation on all screens

**Admin User Management**

- **FR13:** Admin can view a list of all registered user accounts
- **FR14:** Admin can create a new user account with a username and initial password
- **FR15:** Admin can delete a user account
- **FR16:** Admin can reset any user's password
- **FR17:** System requires explicit admin confirmation before executing destructive user management actions
  (delete, reset password)
- **FR18:** Admin account credentials are supplied via environment variables and are not stored in the user database
- **FR19:** Admin can change their own password only by updating environment variables

**Application Configuration**

- **FR20:** Admin can enable or disable public user self-registration at runtime
- **FR21:** System hides the registration option from the login screen when public registration is disabled
- **FR22:** Application configuration changes take effect immediately without requiring a service restart
- **FR23:** Application configuration is persisted as a runtime entity in the database

**Security & Access Control**

- **FR24:** System enforces role-based access control, distinguishing admin and regular user permissions on all
  protected operations
- **FR25:** System limits authentication and registration attempts from a single IP address within a time window
- **FR26:** System prevents users from registering a username reserved by the admin account
- **FR27:** System returns a consistent, non-distinguishing error message for all authentication failures
- **FR28:** System includes the authenticated user's identity and role in the request context for all API operations

**Navigation & Access Routing**

- **FR29:** Unauthenticated users accessing protected routes are redirected to the login screen
- **FR30:** Authenticated admin users can access the user management interface
- **FR31:** Non-admin users accessing admin-only interfaces are denied access
- **FR32:** System provides guidance on the login screen for users who cannot access their account (contact admin)
- **FR33:** System displays a specific message when a user is redirected to login due to session expiry

**List Management**

- **FR34:** User can create a named shopping list with an emoji icon and an optional description
- **FR35:** User can view all lists they own or are a member of
- **FR36:** User can switch between lists using a chip-row switcher in the shopping view; the active list is always
  visible in the chip row, the toolbar title, and the URL
- **FR37:** Only the list owner can delete a list; deletion permanently removes the list, all its items, and all its
  categories from the database; active subscribers to the list are disconnected on deletion; non-owner members cannot
  delete — they can leave the list instead (see FR55)
- **FR38:** The active list is identified by URL (`/list/[listId]`); navigating to that URL loads the list's items;
  `/` redirects to the user's oldest list by creation date, or to `/lists` if the user has no lists

**List Sharing & Membership**

- **FR39:** List owner can share a list with another registered user by exact username match; sharing creates a
  pending invite; the invited user sees the invite with Accept and Reject buttons on the Lists page; the list is not
  accessible to the invited user until they accept; sharing with an unknown username, an existing member, or oneself
  produces a specific descriptive error message
- **FR40:** All list members (owner and shared users) can add, check off, edit, and delete items in a shared list; no
  owner/member role distinction exists within a list for item operations; the list owner can remove any member at any
  time — the removed member's items remain on the list and the removal takes effect on the member's next list data
  access (active subscription terminates via membership re-evaluation on next emitted event)
- **FR41:** A user can only view and modify items and categories in lists they own or have been accepted as a member
  of; pending invites do not grant access; unauthorized access to `/list/[listId]` redirects to `/lists`
- **FR55:** A non-owner list member can leave a shared list at any time; leaving removes the user from the member
  array immediately; items they added remain on the list

**Item Lifecycle**

- **FR42:** User can designate an item as a one-timer at creation or via edit; checking off a one-timer soft-deletes
  it (`deleted: true`, `deletedAt: now`) and removes it from the list view with a directional exit animation; an undo
  snackbar is available until the user navigates away from the current screen — tapping undo clears the soft-delete
  flag and restores the item; navigating away cancels the undo opportunity; the hourly background scheduler (FR54)
  permanently removes items soft-deleted for more than one hour
- **FR43:** User can set an item as recurring (weekly, biweekly, or monthly); the cadence and any changes to it are
  configured in the item editor; the hourly background scheduler (FR54) restores recurring items whose cadence has
  elapsed since check-off: weekly = 7 days, biweekly = 14 days, monthly = 30 days; each cycle produces exactly one
  restoration regardless of how many cycles have been missed; restored items have `checked: false`
- **FR44:** User can optionally specify a store for an item; the item editor surfaces pre-populated store suggestions
  derived from existing item data
- **FR45:** Each item displays the username of the user who added it (`addedBy`) as an avatar or label on the item row
  in the shopping view
- **FR54:** A background scheduler service runs every hour; it performs two tasks: (a) restores recurring items whose
  cadence has elapsed since check-off by setting `checked: false`; (b) permanently hard-deletes one-timer items that
  have been soft-deleted for more than one hour; compound indexes on the items collection back both queries to keep
  each hourly run efficient (index definitions are in the architecture document)
- **FR58:** Saving an item that already exists modifies only the fields the item editor sends; the item's recorded
  author (`addedBy`), its check-off timestamp (`checkedAt`), and its soft-delete state (`deleted`, `deletedAt`)
  survive the save unchanged. A save naming an item id that does not exist on the target list is rejected with an
  error rather than creating the item, and a save naming a category that does not belong to the target list is
  rejected rather than being written as a dangling reference. This makes an edit a modification rather than a
  reconstruction, which FR45 (correct authorship) and FR54 (recurring restore, which reads `checkedAt`) both depend
  on, and which FR42/FR43 require before their item-editor lifecycle control can be built on top.

**Data Scoping & Migration**

- **FR46:** All newly created items and categories are associated with a specific list at creation time; no unscoped
  global items exist after Epic 4
- **FR47:** On first application startup after Epic 4 deployment, all existing items and categories without a
  `listId` are migrated to a default list (`name: "Groceries"`, `emoji: "🛒"`) owned by the most recently created
  non-admin user in the database; if no non-admin users exist, startup fails with a descriptive error; the migration
  writes a completion record to `app_migrations` and does not re-run on subsequent startups
- **FR56:** The admin account is restricted to user management and application configuration only; admin callers are
  rejected by all list-related GQL operations (`createList`, `lists`, `items`, `categories`, `shareList`,
  `deleteList`, and all subscription operations); the admin cannot create, own, view, or be a member of any list

**Navigation & UX**

- **FR48:** Bottom tab navigation (Today, Lists, Household) is the primary navigation chrome, replacing the existing
  AppBar and navigation drawer; the Household tab displays the current user's list memberships and allows list owners
  to remove members from lists they own
- **FR49:** The Today tab displays the active list's items organized by category with a progress strip; category
  groups disappear from view when all items in the group are checked off; a completion state is shown when all items
  across all categories are checked; the Today tab includes a + button to add a new item directly — if the user has
  multiple lists, a list selector is shown so they can choose which list to add to
- **FR50:** The Lists tab displays all lists the user owns or is a member of, plus a pending invites section showing
  lists awaiting accept or reject; a zero-lists state with no pending invites shows an onboarding message with
  guidance to create a first list, category, and item
- **FR51:** All item creation and editing occurs in bottom sheet overlays without navigating away from the shopping
  view; the create-list sheet contains a name field (required) and a description field (optional); closing any sheet
  returns the user to their exact scroll position
- **FR57:** From any authenticated screen the user can return to the application home destination in one action: the
  "Bag Please" app-bar title is a link to `/`, which delegates home resolution to the existing behaviour (the user's
  oldest list by creation date, the lists index when they own none, the admin area for the admin account); the
  shopping view additionally offers a back-to-lists affordance matching the list management screen's existing back
  link. No screen is a navigational dead end requiring the browser back button.
- **FR59:** The application is installable from Chrome on Android as a real standalone app rather than a bookmark
  shortcut: the browser menu offers "Install app", and the installed app has its own launcher icon, its own entry in
  the task switcher, and runs with no browser URL bar. Chrome builds a WebAPK only when HTTPS, a linked web app
  manifest carrying PNG icons at both 192×192 and 512×512, and a registered service worker with a fetch handler all
  hold at once; missing any one silently downgrades the result to a shortcut with no error surfaced anywhere. Running
  without browser chrome makes FR57's in-app home affordance load-bearing rather than convenient. Scope is
  Chrome-on-Android; iOS Safari's separate install route is not covered. No offline capability is implied — the app
  requires the network exactly as it does in the browser.

**Real-Time Collaboration & Authentication**

- **FR52:** Item updates (check-off, add, edit, delete) from any list member appear in real-time on all other
  members' shopping views via GraphQL subscription without requiring a manual refresh
- **FR53:** WebSocket subscription connections require a valid JWT supplied in `connectionParams` on connection
  establishment; unauthenticated connections are rejected; the backend closes the connection when the token expires;
  the frontend disposes the connection before clearing auth state on logout or password reset

**Total FRs: 59** (FR1–FR59, no gaps)

### Non-Functional Requirements

**Security**

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

**Performance**

- **NFR9:** Authentication operations (login, register, token refresh) complete in under 1 second under normal load
- **NFR10:** Auth UI screens (login, registration) render without perceptible layout shift or blocking on mobile
  devices

**Scalability**

- **NFR11:** System supports a small user base (tens of users) in v1; no horizontal scaling or distributed session
  management required
- **NFR12:** ApplicationConfig is loaded at startup and may be cached in memory; writes invalidate the cache
  immediately

**Accessibility** (the section heading is the PRD's; NFR17/NFR18 are testing requirements filed under it)

- **NFR13:** All input fields on auth forms have visible, associated labels
- **NFR14:** Auth forms are fully keyboard-navigable (tab order, submit on Enter)
- **NFR15:** Form error messages are associated with their corresponding input fields
- **NFR16:** Text and interactive elements on auth screens meet minimum colour contrast for readability
- **NFR17:** The frontend has a Playwright e2e test suite covering all auth and session flows; the suite runs against
  the full stack (nginx + backend + MongoDB) and must pass with zero failures before any Epic 1 or Epic 2 story is
  marked done
- **NFR18:** E2E tests use browser-level isolation (no shared auth state across test files); tests that require an
  authenticated session establish it via a Playwright setup fixture calling `POST /api/auth/login` directly rather
  than driving the UI login form each time

**Lists & Sharing**

- **NFR-L1:** Subscription events are scoped per-list; a subscriber to list A receives no events originating from
  list B under any circumstances; scoping is enforced at both subscribe time (membership gate) and per-event
  (membership re-evaluation via `takeWhile`)
- **NFR-L2:** Every service-layer method that reads or writes list-scoped data verifies the caller's list membership
  before accessing data; the membership check precedes all data access including read-only queries; no exceptions
- **NFR-L3:** The Epic 4 data migration is idempotent; running it against an already-migrated database produces no
  changes, no duplicate lists, and no errors; idempotency is guaranteed by a `app_migrations` completion record
  checked at startup
- **NFR-L4:** No list's items or categories are accessible to users not listed as members of that list at any layer
  of the stack (GQL resolver, service, storage); unauthorized access returns a GQL error, not an empty result
- **NFR-L5:** WebSocket subscription connections require a valid JWT supplied in `connectionParams`; the backend
  validates the token before establishing any subscription stream; the connection is closed when the validated token
  expires; the `clearAuth()` frontend function disposes the WebSocket client before clearing auth state to prevent
  orphaned in-flight events reaching React state after logout

**Total NFRs: 23** (NFR1–NFR18 + NFR-L1–NFR-L5)

### Additional Requirements & Constraints

**Platform / architecture constraints** (from "Platform Requirements"):

- Client-side SPA rendering model; auth state in Apollo Client context; no server-side session
- Access token in memory / Apollo link; refresh token in httpOnly `SameSite=Strict` cookie
- Browser support matrix: Chrome / Firefox / Safari / Edge current = Full; legacy & IE = Not supported
- Mobile-first responsive design; MUI `sx` breakpoints; no fixed-width auth layouts

**Delivery constraints** (from "Project Scoping & Phased Development"):

- Incremental platform build, solo developer; each phase ships a complete working slice
- Phase 1 (Epics 1–3) delivered; Phase 2 (Epic 4) is the PRD's "current" phase
- Phase 3 — Growth (post-Epic 4, unscheduled): user status active/suspended; self-service password reset;
  password complexity requirements; membership revocation UX; subscription auth hardening (periodic token
  re-validation mid-session)
- Phase 4 — Vision (future): household/group model; invitations by link; OAuth; activity feed
- Epic 4 "Nice-to-Have (may slip)": sepia/dark theme variants; store suggestion chips pre-populated from existing
  item data (the latter is the *substance of FR44's second clause*, filed simultaneously as a must-have FR and a
  may-slip nice-to-have)

**Recorded risk mitigations** carrying implementation obligations: explicit frontend refresh trigger; Phase-2 freeze
until Phase 1 stable; admin env-var credentials documented with no recovery path by design; migration hard-fail with
descriptive error + deploy checklist; stateless self-healing scheduler with one restoration per item per run;
sharing UI states "full access" before invite; admin rejection for list ops enforced at service layer not route
level (FR56).

### PRD Completeness Assessment

The PRD is unusually strong on requirement *specificity* — FR39, FR42, FR43, FR54, FR58 and FR59 each state their own
truth conditions, and FR58/FR59 explicitly name the requirements they restore or make load-bearing, which is exactly
what makes traceability checkable. Numbering is complete with no gaps. Every FR is testable as written.

Five defects were found in the PRD itself. They are recorded here and carried into Step 3/4 rather than resolved now:

1. **NFR18 directly contradicts the project's established E2E convention.** NFR18 mandates that authenticated tests
   "establish it via a Playwright setup fixture calling `POST /api/auth/login` directly rather than driving the UI
   login form each time." `project-context.md` states the opposite as a hard rule: tests are UI-driven, API calls are
   permitted *only* for environment preparation and "never for the behavior being asserted," and records that **no
   login fixture and no `storageState` exist** — each spec registers a fresh user through the UI. One of these is
   wrong. Given Epic 7 is scoped to the test harness, this must be resolved *in this planning pass*, not discovered
   mid-story.
2. **NFR17 names a decommissioned component** — "the suite runs against the full stack (nginx + backend + MongoDB)."
   nginx was replaced by Caddy in Epic 5. NFR17 also gates only "any Epic 1 or Epic 2 story," so as literally
   written the zero-failures gate does not bind Epics 3–7 at all, despite the project treating E2E as its hard gate.
3. **The Platform Requirements section is stale by two epics.** It opens "bag-please is a Next.js App Router SPA,"
   and prescribes updating `ApolloWrapper.tsx`'s `SetContextLink` to stop reading `localStorage`. Epic 5 replaced
   Next.js with Vite and `ApolloWrapper.tsx` with `ApolloProvider.tsx`. The 2026-06-23 edit note says the reframe
   changed no FRs — true — but the Platform Requirements prose was never updated to match.
4. **An internal contradiction on subscription auth.** Platform Requirements still says "Existing GraphQL
   subscriptions remain unauthenticated (known tech debt); no change in scope," while FR53 and NFR-L5 mandate
   `connectionParams` JWT auth — delivered in Story 4.2. The stale sentence should be struck.
5. **No requirement covers two of Epic 7's three stated themes.** Epic 7 is titled "correctness, test harness, and
   dependency currency." FR58 covers correctness. Nothing in the PRD — no FR, no NFR — expresses *test-harness
   reliability* (the `registrationEnabled` shared-document race, `e2e/` sitting outside both quality gates, the
   four-way duplicated `toPass()` workaround) or *dependency currency*. Both are recorded in `project-context.md` and
   the Epic 6 retro, which are engineering artifacts, not requirement sources. Whether that is acceptable — a
   maintenance epic legitimately traced to retro action items instead of FRs — is the central traceability question
   for Step 3.

Also noted, non-blocking: the Executive Summary still describes the product in its pre-identity state ("currently
operating with a single hardcoded admin credential"), and success criteria and journeys reference a `/login` route
where the implementation uses `/auth`.

## Step 3 — Epic Coverage Validation

Source: `_bmad-output/planning-artifacts/epics.md` (3,731 lines). It carries an explicit **FR Coverage Map**
(lines 880–983) plus per-epic "FRs covered" lists, which made extraction direct. Coverage claims for Epics 1–6 were
**not taken at face value** — those epics are shipped, so each claim was checked against the code in `bp_front/src/`
and `bp_back/src/`. That check is what produced the findings below; the map alone would have reported 100%.

### Coverage Matrix

| FR | Requirement (abbreviated) | Epic coverage claimed | Status |
|---|---|---|---|
| FR1–FR5 | Register, login, logout, auto-login, welcome message | Epic 1; re-delivered Epic 5 | ✓ Covered |
| FR6–FR10 | Access/refresh tokens, silent renewal, expiry redirect, logout invalidation | Epic 1; Epic 5 | ✓ Covered |
| FR11–FR12 | Change own password, name in navigation | Epic 1; Epic 5 (5.3) | ✓ Covered |
| FR13–FR17 | Admin list/create/delete/reset + confirmation | Epic 2; Epic 5 (5.4) | ✓ Covered |
| FR18–FR19 | Admin from env vars; admin password via env only | Epic 1 / Epic 2 | ✓ Covered |
| FR20–FR23 | Registration toggle, hidden link, immediate effect, persisted config | Epic 2; Epic 5 (5.4) | ✓ Covered |
| FR24–FR28 | RBAC, rate limit, reserved username, uniform error, Principal in context | Epic 1 | ✓ Covered |
| FR29–FR33 | Route guards, admin access/denial, contact-admin copy, expiry message | Epic 1 / Epic 2; Epic 5 | ✓ Covered |
| **FR34** | Create list with emoji **and an optional description** | Epic 4 — `createList` + SheetNewList | ⚠️ **PARTIAL** |
| FR35 | View all owned/member lists | Epic 4; Epic 5 (5.5) | ✓ Covered |
| FR36 | Chip-row list switcher; chip + title + URL agree | Epic 4; Epic 5 (5.6) | ✓ Covered |
| FR37 | Owner-only delete, cascade, subscriber disconnect | Epic 4 (4.1) | ✓ Covered |
| FR38 | `/list/[listId]`; `/` → oldest list or `/lists` | Epic 4; **restored Epic 7 (7.5)** | ✓ Covered |
| FR39 | Share by username; pending invite; Accept/Reject | Epic 4 (4.3); Epic 5 (5.7) | ✓ Covered |
| FR40 | All members add/check/**edit**/delete; owner removes members | Epic 4; edit verb Epic 6; **restored Epic 7 (7.4)** | ✓ Covered |
| FR41 | Access only to owned/accepted lists | Epic 4 (4.1) | ✓ Covered |
| **FR42** | One-timer designation, soft-delete on check-off, undo | Epic 4 (backend only) | ❌ **NO OWNING STORY** |
| **FR43** | Recurring cadence set in the item editor | Epic 4 (backend only) | ❌ **NO OWNING STORY** |
| FR44 | Store field + suggestions in the item editor | Epic 4 read side; **write path Epic 6 (6.1)** | ✓ Covered |
| FR45 | `addedBy` shown on the item row | Epic 4; **restored Epic 7 (7.4)** | ✓ Covered |
| FR46 | All new items/categories scoped to a list | Epic 4 (4.1) | ✓ Covered |
| FR47 | Idempotent startup migration to a default list | Epic 4 (4.1) | ✓ Covered |
| **FR48** | **Bottom tab navigation (Today · Lists · Household)** + Household tab member management | Epic 4 (4.5); Epic 5 | ⚠️ **PARTIAL — chrome abandoned** |
| **FR49** | Today tab: category groups, **progress strip**, completion state, + with list selector | Epic 4 (4.7); Epic 5 (5.6) | ⚠️ **PARTIAL** |
| FR50 | Lists tab + pending invites + zero-lists onboarding | Epic 4 (4.8); Epic 5 (5.5, 5.7) | ✓ Covered |
| **FR51** | All create/edit in **bottom sheet overlays**; scroll position preserved | Epic 4 (4.6); Epic 5 | ⚠️ **PARTIAL — letter not met** |
| FR52 | Real-time item updates via subscription | Epic 4 (4.2); Epic 5 (5.6) | ✓ Covered |
| FR53 | WebSocket JWT in `connectionParams` | Epic 4 (4.2) | ✓ Covered |
| FR54 | Hourly scheduler: recurring restore + one-timer hard delete | Epic 4 (4.4); **restored Epic 7 (7.4)** | ✓ Covered |
| FR55 | Non-owner can leave a list | Epic 4 (4.3); Epic 5 (5.7) | ✓ Covered |
| FR56 | Admin restricted from all list operations | Epic 4 (4.1) | ✓ Covered |
| FR57 | Return home in one action from any screen | Epic 6 (6.2); **restored Epic 7 (7.5)** | ✓ Covered |
| FR58 | Item save is a merge, not a reconstruction | **Epic 7 — Story 7.4** | ✓ Covered (planned) |
| FR59 | Installable PWA (Chrome-on-Android WebAPK) | **Epic 7 — Story 7.14** | ✓ Covered (planned) |

### NFR Coverage

| NFR | Epic coverage | Status |
|---|---|---|
| NFR1–NFR11, NFR13–NFR16 | Inventoried in `epics.md`; **absent from the FR Coverage Map** | ⚠️ Inventoried, unmapped |
| **NFR12** | ApplicationConfig caching | ❌ **CONTRADICTED — three-way** |
| **NFR17** | Playwright suite, zero failures as a gate | ❌ **ABSENT from epics entirely** |
| **NFR18** | API-login fixture for authenticated tests | ❌ **ABSENT and actively contradicted** |
| NFR-L1–NFR-L5 | Epic 4 — mapped individually | ✓ Covered |
| NFR-E6-1–NFR-E6-3 | Epic 6 — mapped | ✓ Covered |
| NFR-E7-1–NFR-E7-8 | Epic 7 — each mapped to named stories | ✓ Covered (planned) |

### Missing Requirements

#### Critical

**FR48 — the navigation chrome it mandates does not exist and no story owns it.**
FR48 requires "Bottom tab navigation (Today, Lists, Household) … replacing the existing AppBar and navigation
drawer." Verified against the shipped code: `bp_front/src/` contains **no** `BottomNavigation`, **no** `/household`
route, and **no** "Today" surface — the only match for those terms anywhere in `src/` is an unrelated string in
`EditItemDialog.tsx`. Epic 5 replaced the whole pattern with a top `AppBar` + user menu, which `epics.md` itself
records in the Epic 6 UX source note. Yet the FR Coverage Map still reads "FR48: Epic 4 — BPBottomNav + Household
tab", and Epic 5's "FRs covered" line still claims FR48.
- **Impact:** FR48 is unfalsifiable as written — no test can pass it, and the map asserts it is done. The *capability*
  buried inside it (list owners removing members) did survive, as `ShareMembersDialog.tsx`; the navigation model did
  not. The requirement and the product disagree, and the map hides it.
- **Recommendation:** rewrite FR48 in the PRD to describe the shipped navigation, keeping the member-management
  clause and pointing it at the sharing dialog. This is a PRD edit, not a story. Do it before Epic 7 starts, because
  Story 7.5 AC6 and Story 7.14 AC7 both walk "every guarded route" — a route list that FR48 still describes wrongly.

**FR49 — the progress strip and completion state are not in the product.**
FR49 requires the active list's items "organized by category with a **progress strip**" and "a **completion state**
… when all items across all categories are checked", plus a "+ button … [with] a list selector … if the user has
multiple lists". Verified: the only `Progress` symbol in `ListShoppingPage.tsx` is a `CircularProgress` loading
spinner (line 375); `AddItemDialog` takes `listId` as a prop and offers no list selector. Category grouping and the
chip row are present.
- **Impact:** two named, user-visible affordances from the PRD's own Journey 6 ("the progress strip fills … *All
  done*" — also an Epic 4 success criterion: "The progress strip fills when all items are checked, delivering a clear
  'job done' signal") are absent, claimed as covered, and owned by no story in any epic.
- **Recommendation:** decide explicitly — either descope in the PRD, or file a story. Do not leave it claimed.

**NFR18 — absent from the epics document and contradicted by Epic 7.**
The epics' NFR inventory runs NFR1→NFR16 and then jumps to NFR-L1. NFR17 and NFR18 were never carried across from
the PRD. NFR18's substance is then *actively refuted* by AR-E7-5 and Story 7.2 AC3, which require that "every spec
still registers its own fresh user through the UI" and that "no `storageState`, no auth fixture, and no session reuse
across specs is introduced."
- **Impact:** Epic 7 is the test-harness epic. It will land a shared E2E support module while a live PRD NFR mandates
  the opposite design. Whichever a future reader trusts, the other is wrong — and the omission from the inventory is
  precisely *why* nobody noticed the conflict.
- **Recommendation:** amend NFR18 in the PRD to record the UI-driven convention (and NFR17 to say Caddy, not nginx,
  and to bind all epics rather than "any Epic 1 or Epic 2 story"). Add both to the epics inventory. Cheapest possible
  fix; highest ratio of risk removed.

#### High Priority

**FR34 — the optional description was never built and is now explicitly out of scope.**
FR34 requires "a named shopping list with an emoji icon **and an optional description**". Verified: `List.kt`
declares `id, name, emoji, ownerId, ownerUsername, memberUsernames, members, origin, createdAt` — no `description`,
and none in `MongoList`, `GqlList`, or `createList(name, emoji)`. `epics.md` acknowledges this (line 202: "FR34
(list description) still needs a `List.description` backend field and a schema change; it is out of Epic 7's scoped
unfreeze"), and UX-DR-E4-13 / FR51 both specify the description field in the create-list sheet.
- **Impact:** a small, honestly-recorded gap — but it lives only in an Epic 7 exclusion note, and the coverage map
  still reads "FR34: Epic 4 — createList mutation + SheetNewList". It has no owning story in any epic and no ledger
  entry.
- **Recommendation:** acceptable to defer. Record it in `deferred-work.md` (per NFR-E7-1's own rule about where
  deferrals live) rather than only as a line in an epic preamble.

**FR42 / FR43 — deferred three times, still claimed by the map.**
Both are deferred by explicit decision (Epic 5 reframe, restated in Epic 6 and Epic 7), and Epic 7 discharges their
recorded technical prerequisite via FR58 while leaving the UI unbuilt pending `md`'s requirements reconsideration.
This is a legitimate, well-documented deferral, tracked in `deferred-work.md` and as action item C3.
- **Impact:** low, *except* that the FR Coverage Map still says "FR42: Epic 4 — One-timer soft-delete on check-off +
  undo + hourly scheduler hard-delete" with no deferral marker on the line. The backend shipped; the user-facing
  requirement did not.
- **Recommendation:** annotate both lines in the map as backend-only/UI-deferred. No story needed.

**NFR12 — three documents give three answers.**
PRD NFR12: "loaded at startup and may be cached in memory; writes invalidate the cache immediately."
`epics.md` NFR12 (rewritten, not quoted): "read directly from MongoDB on each request; no in-memory cache required."
AR4 agrees with the epics. But the FR Coverage Map's own FR22 line says "ApplicationConfig **in-memory cache
invalidated on write**" — agreeing with the PRD and contradicting the epics' NFR12 two hundred lines above it.
- **Impact:** the requirement that governs config-change latency is stated three ways in two documents. FR22
  ("changes take effect immediately without a service restart") is satisfied by either design, so nothing is broken —
  but nothing is verifiable either.
- **Recommendation:** pick the shipped behaviour, correct the PRD, and fix the FR22 map line.

#### Structural defect in the FR Coverage Map itself

Three entries are **run together onto one line**, so a reader or script scanning the map will miss the second
requirement in each pair:
- line 943: `NFR-L5: … dispose ordering FR57: Epic 6 — App-bar title as a link to /`
- lines 951–953: `NFR-E6-2: … at ~360px NFR-E6-3: Epic 6 — Home affordance is a real focusable link`
- The same defect appears in the NFR inventory at lines 236–244, where **NFR-E6-1, NFR-E6-2 and NFR-E6-3 are one
  unbroken paragraph**.

FR57 — a whole epic's headline requirement — is currently discoverable in the map only by reading to the end of the
NFR-L5 line. Given this project's history (an FR9 item orphaned across a workflow handoff; Epic 6 never entering
`sprint-status.yaml`), a requirement hidden mid-line is a realistic loss vector, not a typo. Fix the line breaks.

### Coverage Statistics

- **Total PRD FRs:** 59
- **Fully covered with a traceable, verified implementation path:** 53 → **89.8%**
- **Partially covered (claimed done, materially incomplete):** 3 — FR48, FR49, FR51
- **No owning story in any epic:** 3 — FR34 (description clause), FR42, FR43
- **Newly introduced and correctly owned:** 2 — FR58 (Story 7.4), FR59 (Story 7.14)
- **Total PRD NFRs:** 23
- **Present in the epics requirements inventory:** 21 → **91.3%** (NFR17, NFR18 absent)
- **Explicitly mapped to an epic or story in the coverage map:** 18 of 23 → **78.3%** (NFR1–NFR11, NFR13–NFR16
  are inventoried but unmapped; NFR12 is contradicted; NFR17/NFR18 are missing)

### Epic 7 coverage assessment

Every Epic 7 requirement has an owning story, and every story names the requirement it delivers. Traced both
directions with no gaps:

| Requirement | Story |
|---|---|
| NFR-E7-3 | 7.1 |
| AR-E7-5 (shared support module) | 7.2 |
| NFR-E7-2 | 7.3, re-measured at 7.14 |
| FR58; FR45, FR54, FR40 restored | 7.4 |
| FR38, FR57 restored | 7.5 |
| AR-E7-11 (three backend safety fixes) | 7.6 |
| NFR-E7-1, NFR-E7-5 | 7.7–7.13 |
| NFR-E7-6 | structural — one story per major, 7.8–7.13 |
| FR59, NFR-E7-7, NFR-E7-8 | 7.14 |
| AR-E7-13 (dev-auto verdict) | 7.15 |

**Reverse trace is also clean:** no Epic 7 story exists without a stated requirement, including 7.15, the one story
with no code, which is explicitly justified (AR-E7-13 scope note).

**On the Step 2 concern that two of Epic 7's themes have no PRD backing** — this resolves better than expected. Test
harness and dependency currency are expressed as **NFR-E7-1 … NFR-E7-8**, authored in `epics.md`, each one specific
and measurable (two consecutive runs at `retries: 0`; both static gates; latest stable or a recorded reason in
`deferred-work.md`). They are genuine requirements that happen to live in the epics document rather than the PRD.
Given that they are maintenance NFRs derived from retro action items, that placement is defensible. The residual
risk is only that the PRD does not know they exist — worth a one-line pointer in the PRD, not a restructure.

## Step 4 — UX Alignment Assessment

### UX Document Status

**FOUND** — two layered markdown specs plus two HTML design-direction documents:

| Document | Date | Standing |
|---|---|---|
| `ux-design-specification.md` | 2026-05-08 | Base spec (Epics 1–3 auth/admin surfaces) |
| `ux-design-specification-epic-4.md` | 2026-05-19 | Epic 4 addendum (1,900+ lines, 19 UX-DRs) |
| `ux-design-directions.html` / `…-epic-4.html` | 2026-05-08 / 05-19 | Visual direction mockups |

**Neither has been revised since Epic 4.** Both are self-declared stale on presentation from Epic 5 onward, per the UX
source note in `epics.md`. Epic 5, 6 and 7 UX decisions live elsewhere: in `architecture.md`'s Frontend Reframe
section and in `epics.md`'s `UX-DR-E6-*` / `UX-DR-E7-*` blocks. **There is no single current UX document for this
product.**

### Correction to a Step 1 finding

My Step 1 note that `architecture.md` is "2 months stale" and carries no Epic 5 revision was **overstated, and I am
correcting it**: `architecture.md` lines 842–876 contain a **"Frontend Reframe (Epic 5, 2026-06-23)"** section that
explicitly supersedes its own frontend portions *and* `epics.md`'s AR11–AR15 and AR-E4-9/10/11, names the Vite + MUI +
Caddy topology, and lists what is not carried forward (Next.js pages, nginx, localStorage tokens, the Epic 4 component
spec, FR42/FR43 UI). The document self-corrects. The nine surviving Next.js/nginx/localStorage references sit in
sections that addendum supersedes.

What is genuinely true: architecture has **no Epic 6 or Epic 7 addendum** — Epic 7's architecture is the `AR-E7-0 …
AR-E7-15` block inside `epics.md`. That is consistent with how Epic 6 was handled (`AR-E6-*`) and those requirements
are unusually concrete (file paths, line numbers, rejected alternatives), so it is a *placement* choice rather than a
gap. Worth a pointer from `architecture.md` so a reader starting there does not conclude Epic 5 was the last
architectural decision made.

### Alignment Issues

**1. UX ↔ PRD: the abandoned Epic 4 component spec is the root of the FR48/FR49/FR51 gaps.**
The Step 3 findings and this step have the same cause. `UX-DR-E4-2` (BPBottomNav), `UX-DR-E4-3` (BPSheet 3-state),
`UX-DR-E4-7` (ProgressStrip), `UX-DR-E4-12` (SheetItemEditor) were all dropped by the Epic 5 reframe — explicitly, in
`architecture.md`: *"the Epic 4 UX component spec (BPSheet 3-state, BPBottomNav, ProgressStrip, one-timer/recurring
affordances) are not carried forward."* The architecture recorded the decision. **The PRD was never told.** FR48,
FR49 and FR51 still mandate that chrome, the coverage map still claims them, and the 2026-06-23 PRD edit note asserts
"No functional requirements change." Architecture and PRD are in direct conflict, and architecture won in code.

**2. UX ↔ implementation: the colour system in the base UX spec describes a palette that does not exist.**
The base spec mandates `background.default #0e0e10`, `paper #1a1a1d`, `primary #4db6a8`, `error #d9534f`. Shipped
(`src/theme.ts`): `#000000`, `#1C1C1E`, `#4DC9BB`, `#FF453A`, plus `success #30D158`, `warning #FFD60A` and the
`theme.custom.bp.*` tokens the spec never mentions. The spec's old `#0e0e10` survives only as `custom.bp.bg2`.

**Three different contrast analyses exist, and none describes the shipped theme:**
- base UX spec: `#4db6a8` on `#0e0e10` ≈ 6.7:1, "passes AA for normal text"
- `UX-DR-E4-1`: "teal 3.04:1 passes UI components/large text only; error red 4.02:1 marginal for body text"
- shipped palette: never analysed anywhere

I computed the shipped values. **`#4DC9BB` on `#000000` ≈ 10.4:1** and **`#FF453A` on `#000000` ≈ 6.2:1** — AAA and
AA respectively, comfortably clear of NFR16. So this is a **documentation-accuracy problem, not a product risk**: the
shipped theme is more accessible than either document claims, and the pessimistic 3.04:1 figure that has been carried
since Epic 4 is simply wrong about the current app. Worth correcting so nobody "fixes" a passing palette.

**3. UX ↔ implementation: the base spec mandates a font-loading mechanism that cannot exist in this stack.**
*"Font family: Inter … Loaded via `next/font/google`."* There is no Next.js. `UX-DR-E4-1` already resolved this
("remove Inter font import"), but the base spec was never amended, so the two UX documents contradict each other on
typography.

**4. An Epic 4 UX requirement mandating CI accessibility tooling was silently abandoned.**
`UX-DR-E4-19` requires `@axe-core/playwright` "on 3 routes in CI" plus CI-gated reduced-motion tests. Verified:
`@axe-core/playwright` is **not in `bp_front/package.json`**, and `prefers-reduced-motion` appears **nowhere in
`bp_front/src/`**. Ten E2E specs exist; none is an accessibility spec.
- **Impact:** moderate and worth naming plainly. NFR13–NFR16 (labels, keyboard, error association, contrast) have no
  automated coverage, and the one UX requirement that would have provided it was dropped without a `deferred-work.md`
  entry — the exact failure mode this project has repeatedly diagnosed (an item recorded only in a spec, not in the
  ledger). The reduced-motion requirements attached to `UX-DR-E4-5`/`-E4-7` went the same way with the components.
- **Recommendation:** file it in `deferred-work.md` now, during this planning pass. Not an Epic 7 story — Epic 7 is
  correctly scoped and adding an a11y-tooling story would dilute it — but it must stop being invisible.

**5. UX ↔ Architecture for Epic 7 specifically: strong, with the sequencing dependency made explicit.**
This is the alignment that matters for the epic about to run, and it holds up:
- `UX-DR-E7-1` (bumps are visually inert) is enforced by `S-AC2` on Stories 7.7–7.13, with the real-browser check on
  the production stack rather than a green suite.
- `UX-DR-E7-2`/`-E7-4` (home no-op; guard must not over-fire) map onto Story 7.5 AC3 and AC5, and AC5 asserts the
  non-suppressed cases rather than assuming them.
- `UX-DR-E7-6a` ↔ `AR-E7-8a` is the strongest piece of alignment in the document: it identifies that
  `display: 'standalone'` removes the URL bar *and* the back button, audits which routes have no back affordance
  (`/account/password`, `/admin` — cited to `AppShell.tsx:93`), derives the inert-**but-present** rule from that, and
  notes the admin case is safe only by coincidence. Story 7.5 AC4/AC6 and Story 7.14 AC7 both enforce it.
- `AR-E7-15` covers the two silent deployment hazards (`.webmanifest` MIME type via an explicit Caddy `header`
  directive; real-device verification over `chrome://inspect` because `bag-please.localhost` will not resolve on a
  phone), and Story 7.14 AC5/AC9 assert the served header and record the DevTools Installability panel.

### Warnings

- ⚠️ **No current UX document exists.** For Epic 7 this is acceptable — `UX-DR-E7-1…7` correctly specify an
  almost-invisible epic in terms of what must *not* change. It is not acceptable indefinitely: the FR48/FR49/FR51
  drift is what happens when UX decisions are recorded in three places and reconciled in none.
- ⚠️ **`@axe-core/playwright` and reduced-motion coverage were dropped without a ledger entry** (`UX-DR-E4-19`).
  NFR13–NFR16 have no automated coverage.
- ⚠️ **The base UX spec's palette, contrast figures, and font-loading mechanism are all wrong** for the shipped app.
  The pessimistic 3.04:1 contrast claim is the one most likely to cause a wrong decision later; the true figure is
  ~10.4:1.
- ⚠️ **`architecture.md` has no Epic 6/7 addendum**, so a reader starting there sees Epic 5 as the last architectural
  decision. The `AR-E6-*`/`AR-E7-*` blocks in `epics.md` are the real current architecture.
- ✅ **No UX gap blocks Epic 7.** FR59 is the epic's only new user-facing surface, and it is specified in more concrete
  detail than any prior epic's UX (exact manifest keys, the `background_color: '#000000'` correction against the
  recipe it came from, the maskable-icon padding requirement, and the MIME-type hazard).

## Step 5 — Epic Quality Review

Reviewed against `create-epics-and-stories` standards. Epics 1–6 are shipped, so enforcement focuses on **Epic 7**,
with structural observations on the document as a whole.

### Epic Independence

| Check | Result |
|---|---|
| Epic 7 requires only Epics 1–6 (all `done`) | ✓ Pass |
| Epic 7 requires no future epic to function | ✓ Pass |
| No circular epic dependencies | ✓ Pass |
| FR42/FR43 pushed to a future epic | ✓ Deferral, not a dependency |

### Forward-Dependency Audit — verified story by story

The epic claims: *"Every story is completable using only the stories before it… No story requires a later one."* I
checked every story rather than accepting the claim.

| Story | Declared dependency | Verified |
|---|---|---|
| 7.1 | none | ✓ |
| 7.2 | 7.1 (via AC5) | ✓ backward |
| 7.3 | 7.2 | ✓ backward |
| 7.4 | none | ✓ independent |
| 7.5 | none — **but AC6 cites Story 7.14** | ⚠️ see below |
| 7.6 | none | ✓ independent |
| 7.7 | none | ✓ |
| 7.8–7.9 | sequence position only | ✓ |
| 7.10 | 7.1 | ✓ backward |
| 7.11 | 7.10; AC3 cites 7.1 | ✓ backward |
| 7.12 | before 7.13 | ✓ |
| 7.13 | 7.12 | ✓ backward |
| 7.14 | 7.9 and 7.5 | ✓ backward |
| 7.15 | none | ✓ independent |

**The claim holds — no blocking forward dependencies.** Story 7.5 AC6 is the one that looks like a violation and is
not: it reads *"Given Story 7.14 **will** remove the browser's URL bar…"*, but the work it demands (walk every guarded
route asserting an in-app affordance; assert `window.history.length`) is fully executable before 7.14 exists.
AR-E7-8a makes this deliberate — *"Do not attempt to emulate a WebAPK — Playwright cannot install one"* — so the
coverage was designed specifically not to need the later story. This is a **motivational forward reference**, correctly
handled. Worth naming because this pattern is normally where independence breaks.

### 🔴 Critical Violations

**C1 — FR58's own text mandates behaviour that Story 7.4 explicitly refuses to implement, and Story 7.4 is right.**

FR58, identically in **both** `prd.md` (line 630) and `epics.md` (line 169):
> "A save naming an item id that does not exist on the target list **is rejected with an error rather than creating
> the item**."

Story 7.4 AC2:
> "When `saveItem` receives an id that does **not** exist on the target list → **the item is created**, with `addedBy`
> set from the caller exactly as today. And rejecting unknown ids is explicitly **not** implemented — it would reject
> every new item."

AR-E7-2 records why: `GqlItemInput.id` is non-nullable and the frontend generates the UUID with `crypto.randomUUID()`
for **creates** as well as edits, so an id is always present — *"An earlier draft of this requirement said … reject an
id that does not exist. **That draft was wrong and would have broken add-item entirely.**"* `md` ruled on 2026-07-29
that the discriminator is existence in storage.

**The ruling was made, the architecture requirement records it, the story implements it correctly — and the PRD was
edited on that same day and still carries the overruled draft.** The FR Coverage Map's own FR58 line ("explicit
create-vs-update replaces the blind upsert") also agrees with the story, not with the FR.

- **Impact:** anyone validating Story 7.4 against FR58 — a reviewer, a future agent, `bmad-dev-auto` — reads AC2 as a
  direct contradiction of the requirement it claims to deliver, and the "correct" reading breaks every item creation
  in the product. This is a live trap sitting on the epic's highest-value story.
- **Remediation:** reword FR58's second sentence in both documents to match the ruling. Note the clause is only
  *partly* wrong — AC3 does reject an id that exists on a **different** list. Suggested: *"A save naming an item id
  that exists on a different list is rejected with an error and moves nothing; an id that exists nowhere is created,
  with `addedBy` set from the caller."* The category clause is correct as written and needs no change.

**C2 — Epic 7 does not exist in `sprint-status.yaml`.**

`_bmad-output/implementation-artifacts/sprint-status.yaml` ends at `epic-6-retrospective: done`. There is **no
`epic-7` key and none of the fifteen `7-x-…` story keys**. Sprint planning has not been run for this epic.

This is the precise failure Epic 6 already suffered: its block was *"added retroactively at the Epic 6
retrospective"* because *"the dev-auto flow does not own sprint tracking, so neither story was ever recorded here"*
(action item A2). Epic 7's standing constraints require `sprint-status.yaml` be *"reconciled at story close, whichever
dev workflow ran"* — but reconciliation at close cannot create an epic block that never existed at open.

- **Impact:** the tracking artifact will not know the epic started, and with 15 stories the drift is larger than
  Epic 6's two. The project has already paid for this once and encoded a rule that does not cover the opening case.
- **Remediation:** run `bmad-sprint-planning` before Story 7.1 starts. A five-minute action that closes the single
  most likely repeat failure in the plan.

### 🟠 Major Issues

**M1 — Story 7.5 AC2 has no implementable test vehicle named, and the obvious one does not exist.**
AC2 requires that *"a test constructs the specific precision pair (one timestamp with zero nanos, one with a
fractional part) and asserts the earlier list wins"*, confirmed failing against `localeCompare` first. But
`createdAt` is server-generated from `Instant.now()`, and `project-context.md` states plainly: **"No component/unit
test framework exists — do not assume one"**; frontend tests are Playwright-only. There is no way to construct that
timestamp pair through the UI, and the 1-in-1000 window will not occur by chance.
A viable route does exist — mocking the `ListsQuery` response via `page.route`, which the project's own rule permits
("Mock only the *input to a render*, never the thing under test": the thing under test is `HomeRedirect`'s sort, the
input is the query result). But the story never names it.
- **Impact:** an implementer following AC2 literally will either add Vitest (an unscoped new test framework, inside a
  dependency-freeze epic) or write directly to MongoDB (violates the API-only test-data rule). Both are worse than
  the fix itself.
- **Remediation:** name the vehicle in AC2 — a `page.route` interception of `ListsQuery` returning the crafted pair.

**M2 — Six of 26 direct npm dependencies are named in no story, though NFR-E7-1 covers all of them.**
NFR-E7-1: *"every direct dependency in `bp_front/package.json` and `gradle/libs.versions.toml` is either at its latest
stable release or is deliberately held back with the reason recorded."* Story 7.7 AC1 enumerates 13 npm packages and
Stories 7.8–7.13 name 7 more — 20 of the 26 declared direct dependencies. Unnamed anywhere:

`@emotion/react` · `@emotion/styled` · `@types/react-dom` · `typescript-eslint` · `eslint-plugin-react-hooks` ·
`eslint-plugin-react-refresh`

Three are *implicitly* forced to move: `typescript-eslint` by Story 7.10 AC3, and both eslint plugins by Story 7.11
AC1. The two Emotion packages and `@types/react-dom` are named nowhere at all — and Emotion is MUI's peer dependency,
moving alongside `@mui/material` 9.0→9.2 in Story 7.7.
- **Impact:** NFR-E7-1 is the epic-close gate. As written it cannot be satisfied, because six dependencies have no
  story that checks them.
- **Remediation:** add a closing AC to Story 7.7 (or 7.13) that enumerates *all* direct dependencies and records each
  as current or held back, instead of relying on the hand-listed subset.

**M3 — Story 7.7 bundles the one bump most likely to break visual inertness with fifteen others.**
`@mui/material` + `@mui/icons-material` 9.0.0→9.2.0 is the change most likely to violate UX-DR-E7-1/S-AC2 ("identical
rendering, same theme tokens, same layout at ~360px"), and it lands in a single story alongside ~15 other bumps
including React, Apollo and Playwright. NFR-E7-6 requires each major be *"independently attributable"* and exempts
minors by design — but the reasoning behind NFR-E7-6 (a break should name its own cause) applies with full force to a
MUI minor and is not honoured here.
- **Impact:** a rendering regression caught at S-AC2 is attributable to a 16-package change. The epic's own
  attributability principle is undermined in the one place where the risk is cosmetic-but-real.
- **Remediation:** land the MUI pair as its own commit inside Story 7.7 (not a separate story), with its own
  real-browser pass before the rest of the sweep.

**M4 — Story 7.6 has no AC asserting the GraphQL schema is unchanged.**
Story 7.4 AC10 explicitly asserts *"`GqlItemInput.kt` is unchanged, no GraphQL schema change occurred, and no
`npm run generate` run was needed."* Story 7.6 touches `GqlListMapper.kt` while converting `ListMember.status` to an
enum and has **no equivalent AC**. If the enum reaches the GQL-exposed type, that is a schema change requiring codegen
— which needs the stack on `:2080` plus a fresh `CODEGEN_TOKEN`, something no Epic 7 story except 7.7/7.12
anticipates.
- **Impact:** a silent schema change on a story scoped as three low-risk safety fixes.
- **Remediation:** add an AC mirroring 7.4 AC10 — the GQL-exposed status stays a `String`, schema unchanged, no
  codegen run.

**M5 — Story 7.14 cannot be closed without a physical Android device and human judgment.**
AC1 requires Chrome's menu to offer "Install app" and the DevTools Installability panel to report no unmet criterion;
AC2 requires the maskable icon *"verified against a circle and a squircle mask, not just eyeballed as a square"*;
AC9 requires `chrome://inspect` port forwarding to a real phone with the panel output recorded. All three are
correct — AR-E7-15 established that `bag-please.localhost` will not resolve on a device — but they are **manual,
hardware-dependent and unautomatable**.
- **Impact:** this project runs `bmad-dev-auto` unattended. Story 7.14 will either stall or be closed on inference.
  Epic 6's retro found six assertions that could not fail; a criterion that *cannot be executed at all* is the
  adjacent failure mode.
- **Remediation:** mark Story 7.14 as requiring `md` in the loop, and separate the automatable ACs (AC3–AC6, AC8 —
  manifest contents, API denylist, Caddy header, suite green, no offline UI) from the device-gated ones (AC1, AC2,
  AC7, AC9), so the story can be partially verified in CI and closed only after the device pass.

**M6 — 12 of 15 stories deliver no user value, and 10 are written "As a developer/maintainer".**
Strictly, `create-epics-and-stories` treats technical milestones as invalid epic content. Stories 7.1, 7.2, 7.3, 7.6,
7.7–7.13 and 7.15 are internal-quality work; only 7.4, 7.5 and 7.14 change what a user experiences.

**The epic's counter-argument is on the record and is substantially sound**, so this is reported as Major rather than
Critical: it self-declares the position (*"These are not user value and this epic does not claim they are"*),
justifies consolidation in "Why one epic and not three" (the sweep must be gated by the repaired harness; the race fix
must be gated by the shared module; splitting would create the cross-epic ordering dependency the rules forbid), and
cites file-level overlap (7.1, 7.2 and 7.3 all rewrite the same four spec files' helper blocks). The user value that
*is* present is real and high — three data-correctness defects live in production, plus a genuinely new capability in
FR59.
- **Residual risk:** an epic where 80% of stories are maintenance has no natural stopping point if the dependency
  sweep goes badly. AR-E7-10's revert-and-record rule and 7.13 AC2's "a hold-back closes the story" are the
  mitigations, and they are adequate.
- **Recommendation:** accept, with the value distribution stated explicitly so it is a decision rather than a drift.
  Front-loading 7.4 ahead of 7.1–7.3 would land user value earlier — though the epic's reason for sequencing it after
  a trustworthy gate is the better engineering argument, and I would keep the current order.

### 🟡 Minor Concerns

- **N1 — Epic 3 has no entry in the Epic List.** `sprint-status.yaml` records `epic-3: done` with two stories
  (`3-1-deferred-work-triage-high-priority-fixes`, `3-2-e2e-test-coverage-admin-panel`) and a completed retro, but
  `epics.md`'s Epic List jumps Epic 2 → Epic 4. An entire executed epic is undocumented in the epic breakdown.
- **N2 — Story 1.6 is filed inside the Epic 2 section** (line 1554, after Story 2.4), so the document's story order
  does not match its own epic structure.
- **N3 — NFR-E7-1 does not say whether "latest stable" means the declared range or the resolved version.**
  `package.json` mixes pinned exact versions (`react 19.2.5`, `graphql 16.14.0`) with caret ranges
  (`@playwright/test ^1.60.0`, `eslint ^9.39.4`, `vite ^7.3.5`). AR-E7-9's audit cites resolved versions
  (`@playwright/test 1.61.1`), so a caret range can satisfy the NFR while the version file never changes. One
  clarifying clause fixes it.
- **N4 — 15 stories is the largest epic in the project's history** (Epic 4: 8, Epic 5: 7, Epic 6: 2), six of them
  near-identical dependency bumps. Justified by one-story-per-major, but it makes the epic long-running, which raises
  the chance the NFR-E7-2 measurement decays between 7.3 and close — a risk the epic already anticipates by
  re-measuring at 7.14.
- **N5 — FR Coverage Map run-on lines** hide FR57, NFR-E6-3 and the NFR-E6-1/2/3 boundaries (detailed in Step 3).

### Acceptance Criteria Quality — assessed

Epic 7's ACs are the **strongest in this project's history** and materially exceed the standard this step enforces.
Recorded because it is the substance of readiness, not a courtesy:

- **Given/When/Then throughout**, with explicit `Rationale:` lines on the non-obvious ones (7.4 AC1 cites the
  mechanism; 7.6 AC3 cites the `MongoItem.recurring` precedent *and* the concrete failure mode of the alternative).
- **Falsifiability is enforced, not requested.** 7.1 AC5 (a deliberate type error *and* a lint error, both confirmed
  failing), 7.3 AC5 (disable the exclusivity mechanism, confirm the race reproduces, restore), 7.4 AC7 (revert the
  fix, confirm red, restore, record it), 7.5 AC2 (confirmed failing against `localeCompare` first), 7.11 AC2
  (introduce a `useEffect` state-sync, confirm lint fails). This directly encodes the Epic 6 retro finding.
- **Perverse incentives are pre-empted.** 7.13 AC2 makes a hold-back a *successful* closure, removing the pressure to
  force a bad upgrade; 7.3 AC3 forbids leaving the `toPass()` workaround beside the fix, "or the next flake will be
  invisible"; 7.1 AC4 forbids `@ts-ignore`/`eslint-disable` to make the new gate pass.
- **Negative and boundary cases are present:** 7.4 AC3 (id on another list), AC4 (foreign category), AC6
  (already-correct paths must not regress, including `uncheckItem`'s deliberate `checkedAt` clear); 7.5 AC5 (the guard
  must not over-fire, each case asserted rather than assumed).
- **A known-unfixed defect is scheduled to be recorded rather than closed** (7.4 AC9, the BUG-E6-3a severity
  downgrade) — the antidote to the "silently resolved" pattern the Epic 6 retro identified.
- **The dependency audit is accurate.** I verified AR-E7-9's baselines against `package.json` and
  `gradle/libs.versions.toml`: Kotlin 2.3.21, Ktor 3.4.3, graphql-kotlin 9.2.0, Mongo 5.5.1, Kotest 6.1.11, Arrow
  2.1.2, Logback 1.5.18, Testcontainers 2.0.5, bcrypt 0.10.2, and every npm baseline — all match exactly. The
  2026-07-29 audit is current.

### Best-Practices Compliance — Epic 7

| Check | Result |
|---|---|
| Epic delivers user value | ⚠️ Partial — 3 of 15 stories; self-declared and justified (M6) |
| Epic can function independently | ✓ Pass |
| Stories appropriately sized | ✓ Pass, except Story 7.7's 16-bump scope (M3) |
| No forward dependencies | ✓ Pass — verified story by story |
| Entities/collections created when needed | ✓ N/A — no new collections, no data migration (7.6 AC5) |
| Clear acceptance criteria | ✓ Strong pass, with M1 and M4 as gaps |
| Traceability to FRs maintained | ⚠️ Compromised by C1 — FR58 contradicts its own story |
| Brownfield integration points identified | ✓ Pass — AR-E7-0 scoped unfreeze, named files per story |

## Summary and Recommendations

### Overall Readiness Status

## ⚠️ NEEDS WORK — but narrowly, and the fixes are hours not weeks

Epic 7 is the **best-planned epic in this project's history** and I want that stated before the findings, because the
findings are small relative to it. Its acceptance criteria enforce falsifiability rather than requesting it, its
sequencing is argued rather than asserted, its dependency audit is accurate to the day, and every one of its fifteen
stories traces to a named requirement in both directions. The rulings that shaped it (`md`, 2026-07-29) are recorded
with the rejected alternatives and the reason for rejection — which is why C1 below was findable at all.

The blocking issues are **two document defects, not plan defects**. Neither requires re-planning. Both must be fixed
before Story 7.4 begins, because both are traps laid in the path of the epic's highest-value work.

### Critical Issues Requiring Immediate Action

**1. FR58 mandates behaviour that would break the application, and Story 7.4 correctly refuses it.** (C1)
FR58 — in `prd.md` line 630 *and* `epics.md` line 169 — says an item id that does not exist on the target list "is
rejected with an error rather than creating the item." AR-E7-2 records `md`'s ruling that this exact draft "was wrong
and would have broken add-item entirely," because the frontend generates client-side UUIDs for creates too. Story 7.4
AC2 implements the ruling. The PRD was edited the same day the ruling was made and kept the overruled text.
**Anyone validating Story 7.4 against FR58 will read its central AC as a requirement violation.**

**2. Epic 7 does not exist in `sprint-status.yaml`.** (C2)
No `epic-7` key, none of the fifteen story keys. This is Epic 6's action item A2 recurring verbatim — that block had to
be added retroactively at the retro because "the dev-auto flow does not own sprint tracking." The epic's standing
constraint ("reconciled at story close") cannot create a block that never existed at open. With 15 stories the drift
will be seven times Epic 6's.

**3. Three FRs are claimed complete and are materially absent from the product.** (Step 3)
FR48 (bottom tab navigation + Household tab), FR49 (progress strip + completion state), FR51 (bottom-sheet overlays)
describe the Epic 4 UX that Epic 5 deliberately abandoned. `architecture.md` records the decision explicitly; the PRD
was never updated, and the 2026-06-23 edit note still asserts "No functional requirements change." I verified against
shipped code: no `BottomNavigation`, no `/household` route, no progress strip. Not urgent for Epic 7 — but Story 7.5
AC6 and Story 7.14 AC7 both walk "every guarded route," and FR48 currently describes that route set wrongly.

**4. NFR18 mandates the test design Epic 7 is built to avoid.** (Step 2, Step 3)
NFR18 requires an API-login fixture. `AR-E7-5` and Story 7.2 AC3 require the opposite and say so explicitly. NFR17 and
NFR18 were never carried into the epics' requirements inventory at all — which is *why* the conflict went unnoticed for
three epics. NFR17 also still names nginx.

### Recommended Next Steps

Ordered by ratio of risk removed to effort. Items 1–4 are the gate; 5–8 are hygiene that can run alongside the epic.

1. **Reword FR58's item-id clause in `prd.md` and `epics.md`** to match AR-E7-2 and Story 7.4 AC2. Suggested: *"A save
   naming an item id that exists on a different list is rejected with an error and moves nothing; an id that exists
   nowhere is created, with `addedBy` set from the caller."* The category clause is correct — leave it. **~10 minutes.
   Do this first.**
2. **Run `bmad-sprint-planning` for Epic 7** before Story 7.1 starts, so an `epic-7` block and all fifteen story keys
   exist at open rather than being reconstructed at the retro. **~5 minutes.**
3. **Fix NFR17 and NFR18 in `prd.md`, and add both to the epics' NFR inventory.** NFR18 → the UI-driven convention with
   API calls permitted only for environment preparation. NFR17 → Caddy not nginx, and bind it to all epics rather than
   "any Epic 1 or Epic 2 story." **~15 minutes.**
4. **Name the test vehicle in Story 7.5 AC2** (M1) — a `page.route` interception of `ListsQuery` returning the crafted
   timestamp pair. Without this an implementer will add Vitest or write to MongoDB, both worse than the fix. **~5
   minutes.**
5. **Close the four Epic 7 story-level gaps** (M2–M5): a closing AC covering *all* 26 direct dependencies, not the
   hand-listed 20; land the MUI pair as its own commit inside 7.7; add a no-schema-change AC to 7.6 mirroring 7.4
   AC10; split Story 7.14's device-gated ACs (AC1, AC2, AC7, AC9) from its automatable ones and flag it as requiring
   `md` in the loop.
6. **Rewrite FR48/FR49/FR51 in the PRD** to describe the shipped navigation — keeping FR48's member-management clause
   and pointing it at `ShareMembersDialog` — or descope the missing affordances explicitly. Either is fine; leaving
   them claimed-and-absent is not.
7. **File in `deferred-work.md`:** FR34's missing `List.description`, the FR42/FR43 UI deferral annotation on the
   coverage-map lines, and `UX-DR-E4-19`'s abandoned `@axe-core/playwright` + reduced-motion coverage (verified: axe
   is not installed and `prefers-reduced-motion` appears nowhere in `src/`, so NFR13–NFR16 have no automated
   coverage). This is NFR-E7-1's own rule about where deferrals live, applied to the deferrals that predate it.
8. **Housekeeping:** fix the FR Coverage Map's three run-on lines (FR57 is currently hidden mid-line); reconcile NFR12
   across the PRD, the epics' NFR12 and the FR22 map line; correct the base UX spec's palette, contrast figures and
   `next/font/google` reference — the shipped theme measures **~10.4:1** for primary teal and **~6.2:1** for error red
   on black, both better than either document claims; add an Epic 3 entry to the Epic List; add an Epic 6/7 pointer to
   `architecture.md`.

### Assessment of Epic 7 as scoped

| Dimension | Verdict |
|---|---|
| Requirement traceability (Epic 7 internal) | ✓ Complete, both directions |
| Story independence | ✓ Verified story by story, no forward dependencies |
| AC quality | ✓ Strongest in project history — falsifiability enforced |
| Architecture specification | ✓ AR-E7-0…15, verified against code and live registries |
| UX specification | ✓ Adequate — correctly specifies what must *not* change |
| Dependency audit accuracy | ✓ Verified against `package.json` + `libs.versions.toml` today |
| Sequencing rationale | ✓ Each step gates the next, argued not asserted |
| User value distribution | ⚠️ 3 of 15 stories; self-declared and defensible |
| Requirement text correctness | 🔴 C1 — FR58 contradicts its own story |
| Process artifact readiness | 🔴 C2 — no `epic-7` in sprint tracking |

**My recommendation: fix items 1–4, then start Story 7.1.** Do not hold the epic for items 5–8. Item 1 in particular
is a ten-minute edit standing between the plan and its most valuable story, and it is the kind of defect that would
otherwise be discovered by an implementer mid-story and resolved by guessing.

One observation worth carrying into the retro: **every critical finding in this report is a documentation-synchronisation
failure, not a thinking failure.** The rulings were right, the architecture recorded them, the stories implement them —
and the PRD lagged in three separate places (FR58's overruled draft, FR48/49/51's abandoned UX, NFR18's contradicted
test design). This project's planning quality is high and its *document reconciliation* is where the risk concentrates.
That is the same root cause as Epic 6's orphaned FR9 item and Epic 5's 0/7 action items, and it is now visible three
times in one review.

### Final Note

This assessment identified **17 issues across 5 categories**: 2 critical plan-blocking defects, 4 critical
requirement-accuracy defects, 6 major story-level gaps, and 5 minor documentation concerns. Address items 1–4 before
proceeding to implementation. These findings can be used to improve the artifacts, or you may choose to proceed as-is —
though items 1 and 2 are strongly recommended, since each has already caused a recorded failure in this project's
history.

---

## Post-Assessment Remediation (2026-07-30, same day)

Items 1–4 of the Recommended Next Steps were applied immediately after the assessment, on `md`'s instruction, with
`md` confirming the governing premise for item 1: **the frontend is expected to send an id on both create and
update.** That confirmation is what makes FR58's original clause definitively wrong rather than merely suspect.

| # | Issue | Action taken | Status |
|---|---|---|---|
| 1 | **C1** — FR58 mandated rejecting an unknown item id | FR58 rewritten in **both** `prd.md` and `epics.md` to discriminate on existence in storage: not found → create (`addedBy` from caller); found → merge; found on a *different* list → reject. The category clause was correct and is unchanged. | ✅ Fixed |
| 2 | **C2** — Epic 7 absent from sprint tracking | `epic-7: backlog` plus all **15 story keys** and `epic-7-retrospective: optional` added to `sprint-status.yaml` at epic **open**, with a comment recording why (Epic 6 action item A2 recurring). YAML re-parsed and validated: 17 new keys, 59 total. | ✅ Fixed |
| 3 | **NFR17/NFR18** — decommissioned component + contradicted test design | NFR17: nginx → the production artifact (Caddy-served SPA), mandatory desktop **and** mobile viewports, gate widened from "any Epic 1 or Epic 2 story" to any story in any epic. NFR18: reversed to the UI-driven convention (fresh user per spec, no login fixture, no `storageState`, API calls for environment preparation only). **Both added to `epics.md`'s NFR inventory**, where they had never appeared — the omission that let the contradiction survive three epics. | ✅ Fixed |
| 4 | **M1** — Story 7.5 AC2 had no implementable vehicle | AC2 now names the vehicle: a Playwright `page.route` interception of the `ListsQuery` response returning the crafted `createdAt` pair, with the justification under the "mock only the input to a render" rule — and explicitly rules out adding a unit-test framework or writing to MongoDB. | ✅ Fixed |

**Also recorded:** a `2026-07-30` entry was added to `prd.md`'s `editHistory` describing all three PRD changes and why,
so the corrections are traceable from the document itself rather than only from this report.

**Deliberately not actioned** (items 5–8 — hygiene, safe to run alongside the epic): the four remaining Epic 7
story-level gaps (**M2** all-dependency closing AC, **M3** MUI commit split, **M4** Story 7.6 no-schema-change AC,
**M5** Story 7.14 device-gated AC split); the FR48/FR49/FR51 rewrite; the `deferred-work.md` entries for FR34's
missing `List.description`, the FR42/FR43 coverage-map annotation, and `UX-DR-E4-19`'s abandoned axe/reduced-motion
coverage; and the documentation housekeeping (FR Coverage Map run-on lines, NFR12 three-way reconciliation, base UX
spec palette/contrast/font corrections, missing Epic 3 entry, `architecture.md` Epic 6/7 pointer).

**Revised readiness status: ✅ READY to begin Story 7.1.** Both plan-blocking defects are closed. The residual items
are documentation accuracy and story-level polish; none blocks implementation, and **M2–M5 are best applied to the
stories they affect just before those stories run** rather than in a single pass now.

---

**Assessed by:** Product Manager (requirements traceability review)
**Date:** 2026-07-30
**Scope:** Epic 7 readiness — Epics 1–6 shipped (production `0.16.0`)
**Method:** full PRD extraction (59 FRs, 23 NFRs); coverage claims verified against shipped code in `bp_front/src/`
and `bp_back/src/` rather than accepted from the coverage map; dependency baselines verified against `package.json`
and `gradle/libs.versions.toml`; contrast ratios computed from `src/theme.ts`
