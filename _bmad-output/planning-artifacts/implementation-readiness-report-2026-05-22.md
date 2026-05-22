---
stepsCompleted:
  - step-01-document-discovery
documents:
  prd: _bmad-output/planning-artifacts/prd.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  epics: _bmad-output/planning-artifacts/epics.md
  ux: _bmad-output/planning-artifacts/ux-design-specification-epic-4.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-22
**Project:** bag-please

## Document Inventory

| Type | File | Size | Updated |
|------|------|------|---------|
| PRD | `prd.md` | 44K | 2026-05-20 |
| PRD Validation | `prd-validation.md` | 24K | 2026-05-20 |
| Architecture | `architecture.md` | 45K | 2026-05-20 |
| Epics & Stories | `epics.md` | 116K | 2026-05-20 |
| UX Design | `ux-design-specification-epic-4.md` | 116K | 2026-05-20 |

---

## PRD Analysis

### Functional Requirements

**User Authentication**
- FR1: Unregistered user can create an account with a username and password
- FR2: Registered user can authenticate with their username and password
- FR3: Authenticated user can log out of the application
- FR4: System automatically authenticates a user immediately after successful registration, without a separate login step
- FR5: System displays a one-time welcome message the first time a user successfully logs in after registration

**Session Management**
- FR6: System issues a short-lived access token upon successful authentication
- FR7: System issues a long-lived refresh token upon successful authentication
- FR8: System silently renews the access token using a valid refresh token when the access token is expired, without user interaction
- FR9: System redirects the user to the login screen with a session-expiry message when the refresh token is no longer valid
- FR10: System invalidates the user's refresh token when they log out

**User Account**
- FR11: Authenticated user can change their own password
- FR12: System displays the authenticated user's name in the application navigation on all screens

**Admin User Management**
- FR13: Admin can view a list of all registered user accounts
- FR14: Admin can create a new user account with a username and initial password
- FR15: Admin can delete a user account
- FR16: Admin can reset any user's password
- FR17: System requires explicit admin confirmation before executing destructive user management actions (delete, reset password)
- FR18: Admin account credentials are supplied via environment variables and are not stored in the user database
- FR19: Admin can change their own password only by updating environment variables

**Application Configuration**
- FR20: Admin can enable or disable public user self-registration at runtime
- FR21: System hides the registration option from the login screen when public registration is disabled
- FR22: Application configuration changes take effect immediately without requiring a service restart
- FR23: Application configuration is persisted as a runtime entity in the database

**Security & Access Control**
- FR24: System enforces role-based access control, distinguishing admin and regular user permissions on all protected operations
- FR25: System limits authentication and registration attempts from a single IP address within a time window
- FR26: System prevents users from registering a username reserved by the admin account
- FR27: System returns a consistent, non-distinguishing error message for all authentication failures
- FR28: System includes the authenticated user's identity and role in the request context for all API operations

**Navigation & Access Routing**
- FR29: Unauthenticated users accessing protected routes are redirected to the login screen
- FR30: Authenticated admin users can access the user management interface
- FR31: Non-admin users accessing admin-only interfaces are denied access
- FR32: System provides guidance on the login screen for users who cannot access their account (contact admin)
- FR33: System displays a specific message when a user is redirected to login due to session expiry

**List Management**
- FR34: User can create a named shopping list with an emoji icon and an optional description
- FR35: User can view all lists they own or are a member of
- FR36: User can switch between lists using a chip-row switcher; active list always visible in chip row, toolbar title, and URL
- FR37: Only the list owner can delete a list; deletion permanently removes list, all its items, and all its categories; non-owners can leave instead
- FR38: Active list identified by URL (`/list/[listId]`); `/` redirects to oldest list or to `/lists` if user has no lists

**List Sharing & Membership**
- FR39: List owner can share a list with another registered user by exact username match; creates a pending invite; list not accessible until accepted; sharing with unknown/existing/self produces descriptive error
- FR40: All list members can add, check off, edit, and delete items; no owner/member role distinction for item operations; owner can remove any member at any time
- FR41: User can only view and modify items/categories in lists they own or have been accepted as a member of; unauthorized access to `/list/[listId]` redirects to `/lists`
- FR55: A non-owner list member can leave a shared list at any time; items they added remain on the list

**Item Lifecycle**
- FR42: User can designate an item as a one-timer; checking off soft-deletes with directional exit animation; undo snackbar available until navigation away; hourly scheduler permanently removes items soft-deleted > 1 hour
- FR43: User can set an item as recurring (weekly/biweekly/monthly); hourly scheduler restores recurring items whose cadence has elapsed since check-off
- FR44: User can optionally specify a store for an item; editor surfaces pre-populated store suggestions from existing data
- FR45: Each item displays the username of the user who added it (`addedBy`) as avatar or label on item row
- FR54: Background scheduler service runs every hour: (a) restores recurring items whose cadence has elapsed; (b) permanently hard-deletes one-timer items soft-deleted > 1 hour; compound indexes back both queries

**Data Scoping & Migration**
- FR46: All newly created items and categories are associated with a specific list at creation time; no unscoped global items after Epic 4
- FR47: On first startup after Epic 4 deployment, existing unscoped items/categories migrated to a default list owned by the most recently created non-admin user; startup fails with descriptive error if no non-admin users exist; migration idempotent via `app_migrations`
- FR56: Admin account restricted to user management and configuration only; rejected by all list-related GQL operations; admin cannot create, own, view, or be a member of any list

**Navigation & UX**
- FR48: Bottom tab navigation (Today · Lists · Household) replaces existing AppBar and navigation drawer; Household tab displays current user's list memberships and allows list owners to remove members
- FR49: Today tab displays active list's items organized by category with progress strip; category groups disappear when all items in group checked; completion state shown when all items checked; + button to add item — if multiple lists, shows list selector
- FR50: Lists tab displays all lists user owns or is member of, plus pending invites section; zero-lists state with no pending invites shows onboarding message
- FR51: All item creation and editing in bottom sheet overlays without navigating away; create-list sheet has name (required) and description (optional); closing returns user to exact scroll position

**Real-Time Collaboration & Authentication**
- FR52: Item updates (check-off, add, edit, delete) from any list member appear in real-time on all other members' shopping views via GraphQL subscription without manual refresh
- FR53: WebSocket subscription connections require valid JWT in `connectionParams` on connection establishment; unauthenticated connections rejected; backend closes connection when token expires; frontend disposes connection before clearing auth state

**Total FRs: 56** (FR1–FR56, noting FR54 and FR55 appear out of numeric sequence as Epic 4 additions)

---

### Non-Functional Requirements

**Security**
- NFR1: User passwords hashed using bcrypt with cost factor 12; plaintext passwords never stored or logged
- NFR2: Refresh tokens stored in MongoDB with a TTL index matching their 30-day expiry; expired tokens automatically purged
- NFR3: Refresh tokens delivered exclusively via httpOnly, `SameSite=Strict` cookies; never accessible to JavaScript
- NFR4: Access tokens short-lived (15 minutes); refresh tokens long-lived (30 days)
- NFR5: All client-server communication uses HTTPS in production
- NFR6: Authentication endpoints rate-limited per IP address to prevent brute-force attacks
- NFR7: No passwords, raw tokens, or credential material appear in application logs
- NFR8: JWT payloads contain only username and role claims; no sensitive user data embedded in tokens

**Performance**
- NFR9: Authentication operations (login, register, token refresh) complete in under 1 second under normal load
- NFR10: Auth UI screens (login, registration) render without perceptible layout shift or blocking on mobile devices

**Scalability**
- NFR11: System supports a small user base (tens of users) in v1; no horizontal scaling or distributed session management required
- NFR12: ApplicationConfig loaded at startup and may be cached in memory; writes invalidate the cache immediately

**Accessibility**
- NFR13: All input fields on auth forms have visible, associated labels
- NFR14: Auth forms are fully keyboard-navigable (tab order, submit on Enter)
- NFR15: Form error messages are associated with their corresponding input fields
- NFR16: Text and interactive elements on auth screens meet minimum colour contrast for readability

**Testing**
- NFR17: Frontend has a Playwright e2e test suite covering all auth and session flows; runs against full stack (nginx + backend + MongoDB); must pass with zero failures before any Epic 1 or Epic 2 story is marked done
- NFR18: E2E tests use browser-level isolation (no shared auth state across test files); authenticated scenarios use Playwright setup fixture calling `POST /api/auth/login` directly

**Lists & Sharing**
- NFR-L1: Subscription events scoped per-list; a subscriber to list A receives no events from list B under any circumstances; scoping enforced at subscribe time (membership gate) and per-event (membership re-evaluation via `takeWhile`)
- NFR-L2: Every service-layer method that reads or writes list-scoped data verifies the caller's list membership before accessing data; membership check precedes all data access including read-only queries; no exceptions
- NFR-L3: Epic 4 data migration is idempotent; running against an already-migrated database produces no changes, no duplicate lists, and no errors
- NFR-L4: No list's items or categories are accessible to users not listed as members at any layer of the stack (GQL resolver, service, storage); unauthorized access returns GQL error, not empty result
- NFR-L5: WebSocket subscription connections require valid JWT in `connectionParams`; backend validates token before establishing any subscription stream; connection closed when validated token expires; `clearAuth()` frontend function disposes WebSocket client before clearing auth state

**Total NFRs: 23** (NFR1–NFR18, NFR-L1–NFR-L5)

---

### PRD Completeness Assessment

The PRD is thorough and well-structured. Requirements are numbered, categorized, and traceable to user journeys. Epic 4 additions (FR34–FR56, NFR-L1–NFR-L5) are clearly differentiated from the Epics 1–3 foundation (FR1–FR33, NFR1–NFR18). The phase scoping section explicitly calls out delivered vs. current vs. future work, which provides strong traceability context. The PRD scores high on completeness.

---

## Epic Coverage Validation

### Coverage Matrix

All 56 FRs are present in the epics document's **FR Coverage Map** section with explicit story assignments. NFR-L1–NFR-L5 are also listed. Full matrix:

| FR | Story Assignment | Status |
|----|-----------------|--------|
| FR1 | Epic 1 — Story 1.1 | ✓ Covered |
| FR2 | Epic 1 — Story 1.2 | ✓ Covered |
| FR3 | Epic 1 — Story 1.2 | ✓ Covered |
| FR4 | Epic 1 — Story 1.2 | ✓ Covered |
| FR5 | Epic 1 — Story 1.4 (WelcomeBanner) | ✓ Covered |
| FR6 | Epic 1 — Story 1.2 | ✓ Covered |
| FR7 | Epic 1 — Story 1.2 | ✓ Covered |
| FR8 | Epic 1 — Story 1.3 | ✓ Covered |
| FR9 | Epic 1 — Story 1.3 | ✓ Covered |
| FR10 | Epic 1 — Story 1.2 | ✓ Covered |
| FR11 | Epic 1 — Story 1.5 | ✓ Covered |
| FR12 | Epic 1 — Story 1.5 (UserChip) | ✓ Covered |
| FR13 | Epic 2 — Story 2.2 | ✓ Covered |
| FR14 | Epic 2 — Story 2.2/2.3 | ✓ Covered |
| FR15 | Epic 2 — Story 2.2/2.3 | ✓ Covered |
| FR16 | Epic 2 — Story 2.2/2.3 | ✓ Covered |
| FR17 | Epic 2 — Story 2.3 (ConfirmDialog) | ✓ Covered |
| FR18 | Epic 1 — Story 1.2 | ✓ Covered |
| FR19 | Epic 2 — Story 2.3 (documented constraint) | ✓ Covered |
| FR20 | Epic 2 — Story 2.1/2.4 | ✓ Covered |
| FR21 | Epic 2 — Story 2.4 | ✓ Covered |
| FR22 | Epic 2 — Story 2.1 | ✓ Covered |
| FR23 | Epic 2 — Story 2.1 | ✓ Covered |
| FR24 | Epic 1 — Story 1.2 | ✓ Covered |
| FR25 | Epic 1 — Story 1.2 | ✓ Covered |
| FR26 | Epic 1 — Story 1.1 | ✓ Covered |
| FR27 | Epic 1 — Story 1.2 | ✓ Covered |
| FR28 | Epic 1 — Story 1.2 | ✓ Covered |
| FR29 | Epic 1 — Story 1.3 | ✓ Covered |
| FR30 | Epic 2 — Story 2.3 | ✓ Covered |
| FR31 | Epic 2 — Story 2.3 | ✓ Covered |
| FR32 | Epic 2 — Story 2.4 | ✓ Covered |
| FR33 | Epic 1 — Story 1.3/1.4 | ✓ Covered |
| FR34 | Epic 4 — Story 4.8 (SheetNewList + createList) | ✓ Covered |
| FR35 | Epic 4 — Story 4.8 (lists query + Lists tab) | ✓ Covered |
| FR36 | Epic 4 — Story 4.7 (ListChipRow + URL routing) | ✓ Covered |
| FR37 | Epic 4 — Story 4.1 (deleteList) + Story 4.8 (UI) | ✓ Covered |
| FR38 | Epic 4 — Story 4.5 (redirect logic) | ✓ Covered |
| FR39 | Epic 4 — Story 4.3 (backend) + **missing frontend story** | ⚠️ Partial |
| FR40 | Epic 4 — Story 4.3 (removeMember) + **missing Household tab story** | ⚠️ Partial |
| FR41 | Epic 4 — Story 4.1 (verifyMembership) | ✓ Covered |
| FR42 | Epic 4 — Story 4.4 (backend) + Story 4.7 (check-off/undo) + **Story 4.9 missing (LifecycleBadge)** | ⚠️ Partial |
| FR43 | Epic 4 — Story 4.4 (backend) + **Story 4.9 missing (recurring UI in SheetItemEditor)** | ⚠️ Partial |
| FR44 | Epic 4 — Story 4.4 (backend) + **Story 4.9 missing (store field UI + suggestions)** | ⚠️ Partial |
| FR45 | Epic 4 — Story 4.4 (backend addedBy) + **no story assigns ItemCard addedBy rendering** | ⚠️ Partial |
| FR46 | Epic 4 — Story 4.1 (listId required on all new items) | ✓ Covered |
| FR47 | Epic 4 — Story 4.1 (Migration.kt) | ✓ Covered |
| FR48 | Epic 4 — Story 4.5 (BPBottomNav structure) + **missing Household tab content story** | ⚠️ Partial |
| FR49 | Epic 4 — Story 4.7 (Today tab full implementation) | ✓ Covered |
| FR50 | Epic 4 — Story 4.8 (Lists tab + pending invites) | ✓ Covered |
| FR51 | Epic 4 — Story 4.6 (BPSheet) + Story 4.8 (SheetNewList) + **Story 4.9 missing (SheetItemEditor)** | ⚠️ Partial |
| FR52 | Epic 4 — Story 4.2 (subscriptions scoping) | ✓ Covered |
| FR53 | Epic 4 — Story 4.2 (WebSocket JWT auth) | ✓ Covered |
| FR54 | Epic 4 — Story 4.4 (hourly scheduler) | ✓ Covered |
| FR55 | Epic 4 — Story 4.3 (leaveList) | ✓ Covered |
| FR56 | Epic 4 — Story 4.1 (admin block service layer) | ✓ Covered |
| NFR-L1 | Epic 4 — Story 4.2 | ✓ Covered |
| NFR-L2 | Epic 4 — Story 4.1/4.2 | ✓ Covered |
| NFR-L3 | Epic 4 — Story 4.1 | ✓ Covered |
| NFR-L4 | Epic 4 — Stories 4.1/4.2 | ✓ Covered |
| NFR-L5 | Epic 4 — Story 4.2 | ✓ Covered |

### Missing Requirements

#### Critical: Stories 4.9 and 4.10 Referenced but Not Written

Story 4.6 (BPSheet spike) explicitly references "downstream sheet stories **(4.7, 4.8, 4.9, 4.10)**" and Story 4.7 explicitly states `"LifecycleBadge is NOT part of this story — added in Story 4.9"`. Neither Story 4.9 nor Story 4.10 exists in the epics document.

**Story 4.9 (implied — SheetItemEditor & Item Lifecycle UI)** — covers:
- FR42 — one-timer `LifecycleBadge` on `ItemCard` (explicitly deferred from Story 4.7); Story 4.7 only covers check-off/undo, not the badge or the editor lifecycle controls
- FR43 — recurring cadence UI in `SheetItemEditor` (`ToggleButtonGroup`) — backend done (Story 4.4), editor UI unassigned
- FR44 — store `TextField` + suggestion chips in `SheetItemEditor` — backend done (Story 4.4), editor UI unassigned
- FR51 — `SheetItemEditor` implementation (Story 4.7 creates only a "stub" that opens when long-pressed)
- UX-DR-E4-12 (`SheetItemEditor` PEEKED/OPEN states, auto-focus, error states) — no story assigned
- UX-DR-E4-6 (`LifecycleBadge` component with tooltip, first-encounter localStorage flag) — no story assigned

**Story 4.10 (implied — Household Tab, Sharing UI, Invite Deep-Link)** — covers:
- FR39 frontend — `SheetShare` and `SheetInvite` components; Story 4.3 delivers the backend, but the share flow UI (opening from ListCard "Share & Members" option in Story 4.8) has NO acceptance criteria in any story
- FR40 frontend — Household tab member list with remove action (FR48 specifies this as Household tab content); Story 4.5 creates the tab *navigation* but no story creates the `/household` page content
- FR48 (partial) — Household tab page (`app/household/page.tsx`) with member management UI
- FR45 — `addedBy` avatar rendering on `ItemCard` meta line; `BPAvatar` is built in Story 4.8, but no story assigns wiring it into `ItemCard`
- UX-DR-E4-13 (`SheetShare`, `SheetInvite` components) — no story assigned
- UX-DR-E4-14 (`/invite/[token]` deep-linkable invite acceptance screen) — no story assigned
- AR-E4-15 two-actor real-time collaboration E2E test — no story assigned

#### Conflict: NFR12 Implementation Decision

- **PRD NFR12** states: *"ApplicationConfig is loaded at startup and may be cached in memory; writes invalidate the cache immediately"*
- **Epics NFR12** states: *"ApplicationConfig is read directly from MongoDB on each request; no in-memory cache required for v1 given the low read frequency"*

These represent different implementation approaches. Story 2.1 AC reads: `"the response contains registrationEnabled reflecting the current value read from MongoDB"` — consistent with the epics' no-cache approach. The delivered implementation follows epics (no-cache), which supersedes the PRD. This is not a gap in implementation but is a divergence between documents that should be noted.

#### Minor: NFR1–NFR18 Not in the Coverage Map

NFR1–NFR18 (Security, Performance, Scalability, Accessibility, Testing) are listed in the epics Requirements Inventory but not present in the FR Coverage Map section. Most are addressed via story acceptance criteria:

- NFR1–NFR8 (security): addressed in Story 1.1/1.2 ACs
- NFR9 (perf < 1s): not explicitly tested in any story AC
- NFR10 (no layout shift): addressed in Story 1.3/1.4 ACs
- NFR11 (small user base): documented constraint, no story needed
- NFR13–NFR16 (accessibility): addressed in Story 1.3–1.5 and UX-DR-15
- NFR17–NFR18 (Playwright): addressed in Story 1.6

**NFR5** (HTTPS in production) has no corresponding story or implementation task — this is a deployment/infrastructure concern but worth flagging as untracked.

### Coverage Statistics

- Total PRD FRs: **56** (FR1–FR56)
- FRs fully covered with complete story ACs: **43** (76.8%)
- FRs partially covered (backend story complete, frontend story missing): **9** (FR39, FR40, FR42, FR43, FR44, FR45, FR48, FR51, and the Household tab portion of FR48)
- FRs with no story coverage: **0**
- NFR-L coverage: **5/5** (100%)
- NFR1–NFR18 formal coverage map entries: **0/18** (addressed via ACs but not formally mapped)

**Overall FR coverage: 100% mapped; 9 FRs have frontend implementation gaps due to missing Stories 4.9 and 4.10.**

---

## UX Alignment Assessment

### UX Document Status

**Found:** `ux-design-specification-epic-4.md` (116K, 2026-05-18). Comprehensive — includes executive summary, color system, typography, motion spec, component specs, journey flows, UX consistency patterns, accessibility strategy, and a component implementation roadmap.

---

### Alignment Issues

#### Critical: Undo Window Duration Conflict

Three documents define the undo/snackbar window differently:

| Document | Value |
|----------|-------|
| PRD Journey 8 summary table | **4 seconds** |
| UX spec Journey 2 (inline) | "3-second Snackbar" |
| UX spec Feedback Patterns section (authoritative) | **5 seconds** |
| Epics Story 4.7 AC | "5-second duration" |

**Resolution needed:** The UX spec Feedback Patterns section (which explicitly states "3 seconds calibrated for a flagship device — insufficient on mid-tier Android in a grocery store environment") and Story 4.7 both use 5s. The PRD Journey table says 4s. The 5-second figure should be treated as the resolved decision, but the PRD Journey 8 summary table contains a stale 4s value that should be corrected to avoid future confusion.

#### Critical: PRD Internal Conflict — Sharing Model (Journey 7 vs FR39)

- **PRD Journey 7** states: *"The shareList mutation adds Tom as a member instantly. Tom's device receives a real-time subscription event; his Lists tab now shows Groceries."* — This implies **immediate access**, no invite step.
- **FR39** states: *"sharing creates a pending invite; the invited user sees the invite with Accept and Reject buttons on the Lists page; the list is not accessible to the invited user until they accept"*

The UX spec, epics, and Story 4.3 all implement the FR39 **pending invite model**. Journey 7 is stale text from before the invite model was decided. No implementation risk — the pending invite model is clearly the decided design — but the PRD has a visible internal contradiction that should be corrected.

#### Moderate: `actorId` on Subscription Events — Not in PRD FRs

The UX spec "Real-Time Collaboration Patterns" section requires: *"`actorId: String` (the performing user's ID)... mandatory field on all item mutation subscription events. This must be specified in the GraphQL schema before item mutation stories are written."*

This field is required so the frontend can determine "was this me?" and avoid double-announcing local mutations via the screen reader live region. It is **not present in any PRD FR**, not listed in the FR Coverage Map, and its architecture status is unclear. If `actorId` is absent from the GraphQL schema and TypeScript generated types, Story 4.7's "focus unchanged after subscription update" AC and the SRContext throttle behavior cannot be correctly implemented.

**Risk:** Missing UX requirement with no tracking in PRD or epics.

#### Moderate: Session Boundary Hiding for Recurring Items — UX-Only Feature

UX Journey 4 specifies a **session boundary hiding** behavior for checked recurring items:
> *"Session boundary: >30min gap or explicit refresh → checked recurring items hidden from view → first-time banner shown once: '2 recurring items are hidden until their next due date'"*

This behavior is **entirely absent from the PRD FRs** (FR43 only covers the hourly scheduler restore logic). It requires:
- Client-side session boundary detection (compare `Date.now()` to last-active timestamp)
- A "first-time banner" component with same `localStorage`-based persistence as the one-timer tooltip
- Different view states for Tom vs Mia (they may see different checked-recurring visibility states)

This is a real UX deliverable with no story, no FR, and no architectural coverage.

#### Moderate: Notification Badge on Lists Tab Icon

UX Journey 1b specifies: *"In-app badge: Tom opens app, sees notification badge on Lists tab"* — a numeric badge on the Lists tab icon showing pending invite count.

FR50 mentions the "pending invites section" within the tab page but does not specify a badge on the *tab icon* itself. The UX spec requires MUI `Badge` on `BottomNavigationAction` for the Lists tab — this is an additional UX requirement not in the PRD, and not called out in any story's acceptance criteria.

#### Minor: `/invite/[token]` Deep-Link Screen Has No Story

UX spec Phase 5 roadmap item #20: *"Invite acceptance screen — deep-linkable standalone view, accept/decline"*
UX Navigation Patterns: *"One deep-linkable view: invite acceptance at `/invite/[token]`"*
UX-DR-E4-14: *"standalone deep-linkable view at `/invite/[token]` (NOT a sheet — must survive direct URL load)"*

Story 4.8 covers Accept/Reject on the Lists tab for in-app invite discovery. The deep-link scenario (`/invite/[token]` direct URL) is a separate page that has no story. This belongs in the missing Story 4.10.

#### Minor: List-Level Subscription Events — Prerequisite Conflict

- **UX spec Phase 1 prerequisites** (hard exit criterion): *"List-level subscription events (rename, share changes, delete)"*
- **Story 4.3 technical notes**: *"List-level subscription events (membership changes) are out of scope for this story"*

The UX spec flags this as a hard prerequisite for Phase 2 stories; Story 4.3 defers it. If list-level events are never picked up in Stories 4.9/4.10, `ListCard` inline rename (Story 4.8) will not broadcast changes to other members' screens — violating the real-time collaboration promise for list management actions.

---

### Architecture–UX Alignment

The main architecture–UX alignment items are already documented in the epics (AR-E4-1 through AR-E4-15). Key points where UX spec explicitly overrides or extends architecture:

1. **`ThemeProvider` vs `CssVarsProvider`** — UX spec overrides `architecture.md` resolved decision; epics document this as AR-E4-10. ✓ Acknowledged and resolved.
2. **`actorId` in GraphQL schema** — Required by UX, not called out in architecture. ⚠️ Gap.
3. **`/invite/[token]` route** — Required by UX Phase 5 roadmap, not in AR-E4-9 route list. ⚠️ Gap.
4. **Session boundary hiding logic** — Client-side UX behavior, no architecture entry. ⚠️ Gap.

---

### Warnings

1. **Stale undo window value (4s) in PRD** — should be corrected to 5s to match UX spec and story ACs; risk of future developer confusion.
2. **Stale sharing narrative in PRD Journey 7** — should be updated to reflect the pending invite model; currently contradicts FR39.
3. **`actorId` must be in the GQL schema** — a missing field here will cause silent failures in SR announcement throttling and the "was this me?" logic; no story or FR currently tracks this.
4. **Session boundary hiding and in-app invite badge** are UX deliverables that need story coverage — both are untracked at any planning layer.
5. **Stories 4.9 and 4.10** remain unwritten and are the consolidation point for 7 of the above UX gaps.

---

## Epic Quality Review

### Epic Structure Validation

| Epic | User-Centric Title? | Standalone Value? | Independence |
|------|--------------------|--------------------|-------------|
| Epic 1: User Auth, Session & Identity | ✓ Users own their accounts | ✓ App is usable post-Epic 1 | ✓ No upstream dependencies |
| Epic 2: Admin User Management & Config | ✓ Admin manages users | ✓ Admin panel functional alone | ✓ Uses Epic 1 outputs only |
| Epic 4: Personal Lists & Sharing | ✓ Users own and share lists | ✓ Core product value | ✓ Uses Epics 1–3 outputs |

**Missing Epic 3 in planning document**: The `epics.md` has no Epic 3 section. Epic 3 was executed as a tech-debt / deferred-work sprint (implementation artifacts: `3-1-deferred-work-triage-high-priority-fixes.md`, `3-2-e2e-test-coverage-admin-panel.md`). Epic 4 epics were written with knowledge of Epic 3 output, but the planning document has a gap in epic numbering that could confuse future reviewers.

---

### Story Quality Assessment

#### 🔴 Critical Violations

**Story 4.7 — Explicit Forward Dependency on Non-Existent Story 4.9**

Story 4.7 ACs state: *"ItemCard long-press (500ms pointerdown timer...) opens `SheetItemEditor` — wired here but opens a stub until Story 4.9."*

This is a textbook forward dependency violation. Story 4.7 cannot be closed as "done" with a documented stub for a non-existent story. The `SheetItemEditor` is the primary path for:
- Setting item lifecycle (one-timer/recurring) — FR42/FR43
- Setting store — FR44
- Editing item name — FR51
- The visible edit icon on BPCheck focus (UX accessibility requirement)

A stub `SheetItemEditor` means all users with accessibility needs who cannot long-press have no path to edit items, and the lifecycle badge (`LifecycleBadge`, also deferred to Story 4.9) is missing from `ItemCard` rows.

**Remediation:** Story 4.7 should either: (a) include a minimal `SheetItemEditor` with just the item name field (scope the full editor to Story 4.9), or (b) split the `BPCheck` focus → edit icon path into a separate AC with clear exit criteria that don't require Story 4.9.

**Story 4.8 — SheetShare Has No Acceptance Criteria**

Story 4.8 lists "Share & Members" as a `ListCard` context menu option. The story has detailed ACs for Rename, Delete, and Leave flows — but zero ACs cover what happens when the user taps "Share & Members". The menu item appears but its behavior is entirely unspecified.

FR39 backend is in Story 4.3. The `SheetShare` + `SheetInvite` frontend components are listed in the FR Coverage Map and UX spec Phase 5 roadmap but exist in no story. Story 4.8 leaves a dead menu item with no defined behavior.

**Remediation:** Either add `SheetShare` ACs to Story 4.8 (scope them), or move the "Share & Members" menu item to Story 4.10 so it only appears once the handler exists.

---

#### 🟠 Major Issues

**Story 4.1 — Oversized Scope (5–7 story-points of work bundled)**

Story 4.1 encompasses in a single story:
1. Full list entity vertical slice (all 9 files)
2. `CallerUsername` value class
3. `ItemStorage` and `CategoryStorage` nested-map refactor
4. `evictList()` on both storages
5. `createList`, `deleteList`, `lists` GQL operations
6. `verifyMembership` service method
7. `saveItem` refactor (add `listId`)
8. Admin block enforcement
9. Subscription schema changes (`itemUpdates(listId)`, `categoryUpdates(listId)`)
10. Full `plugins/Migration.kt` idempotent migration

For a solo developer this may be practical, but as a reviewable unit this story is 2–3x the size of any other story in the document. The migration alone (Migration.kt, `app_migrations`, env var handling, startup failure modes, 8 distinct test cases) is a full story in its own right. The storage refactor (nested maps, `evictList`, `computeIfAbsent`) is another. If Story 4.1 stalls, all of Stories 4.2–4.8 are blocked.

**Remediation:** For a solo developer, accepted as-is with risk noted. If a developer other than the story author needs to pick this up, the scope needs splitting.

**Story 2.0 — Pure Refactoring Story With No User Value**

Story 2.0 ("As a developer, I want to eliminate the in-memory UserStorage...") is a tech-debt refactor explicitly framed from a developer perspective. The `UserStorage` removal has no user-visible effect. This is acceptable practice but violates the "user story" format strictly — it should be framed as a tech-story with ACs linking to unbroken existing test coverage.

**Minor:** This is already correctly placed (before Epic 2 user-facing work) and its ACs verify existing test coverage is maintained. The violation is cosmetic in this project context.

**Story 1.6 — Test Infrastructure Story Placed Out of Sequence**

Story 1.6 (Playwright E2E infrastructure + auth flow coverage) is numbered after Story 1.5 but its ACs require all of Stories 1.1–1.5 to be complete (registration, login, logout, WelcomeBanner all tested). NFR17 requires E2E tests to pass *before* any Epic 1 or Epic 2 story is marked done — but Story 1.6 is the *last* story in Epic 1. As structured, you cannot comply with NFR17 because the test suite doesn't exist until all other Epic 1 stories are done.

**Remediation:** The NFR17 wording likely means "before the feature is shipped to prod" rather than "before each story is merged." The practical resolution is to treat Story 1.6 as an exit criterion for Epic 1 rather than a blocker mid-sprint. The story is correctly sequenced as the last step; the NFR language should be tightened.

---

#### 🟡 Minor Concerns

**Stories 4.7 and 4.8 — Large Story Sizes**

Story 4.7 (Today Tab, Shopping Loop & Core Components) bundles: page route, ListChipRow, BPCheck, ItemCard skeleton, ProgressStrip, SRContext, category group collapse, empty states, optimistic mutation, subscription wiring, and ARIA requirements. This is manageable for a single sprint but is larger than any Epics 1–2 story.

Story 4.8 (Lists Tab, List Management & BPAvatar) similarly bundles the Lists tab page, ListCard, inline rename, delete dialog, SheetNewList, emoji picker, BPAvatar, pending invite accept/reject. Manageable but large.

**No remediation required** for a solo developer project. Risk: if either story is 80% complete and blocked by a dependency, the blocked portion compounds with missing Stories 4.9/4.10 to create significant un-merged scope.

**Missing Test Coverage Declaration in Stories 4.5 and 4.6**

Stories 4.5 (Frontend Foundation) and 4.6 (BPSheet spike) include test requirements but do not explicitly state where the tests run (unit, Playwright integration, manual). Story 4.6 explicitly notes spike criteria 1–4 as "manual" — this is correctly specified. Story 4.5 test requirements mix unit-style assertions ("assert `theme.palette.primary.main === '#2AA396'`") with feature-level checks ("assert the directory no longer exists"). No explicit test file locations are mentioned.

**Dependency Chain Is Sound**

The Epic 4 story dependency graph is logically valid:
- 4.1 → 4.2 (subscription scoping requires list membership)
- 4.1 → 4.3 (sharing requires list entity)
- 4.1 → 4.4 (item lifecycle requires listId)
- 4.1 → 4.5 (frontend redirect requires `lists` query)
- 4.5 → 4.6 (BPSheet spike requires theme)
- 4.6 → 4.7 (Today tab requires BPSheet)
- 4.2 + 4.6 → 4.7 (subscription wiring requires auth)
- 4.3 + 4.6 → 4.8 (Lists tab requires sharing backend)

No circular dependencies. No backward references.

---

### Best Practices Compliance Summary

| Story | User Value | Independent | Forward Deps | ACs BDD | ACs Complete |
|-------|-----------|-------------|--------------|---------|-------------|
| 1.1 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 1.2 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 1.3 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 1.4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 1.5 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 1.6 | ✓ (NFR) | ✓ | ✓ | ✓ | ⚠️ NFR17 sequencing |
| 2.0 | ⚠️ Dev-only | ✓ | ✓ | ✓ | ✓ |
| 2.1 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2.2 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2.3 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2.4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4.1 | ✓ | ✓ | ✓ | ✓ | ✓ (oversized) |
| 4.2 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4.3 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4.4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4.5 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4.6 | ✓ (spike) | ✓ | ✓ | ✓ | ✓ |
| 4.7 | ✓ | ⚠️ stub | 🔴 Story 4.9 | ✓ | ⚠️ SheetItemEditor stub |
| 4.8 | ✓ | ⚠️ dead menu | 🔴 Story 4.10 | ✓ | 🔴 SheetShare missing |

---

## Summary and Recommendations

### Current Sprint Context

As of 2026-05-22:
- **Epics 1, 2, 3**: All stories done ✓
- **Epic 4**: Stories 4.1 and 4.2 done; **Story 4.3 is ready-for-dev (next up)**; Stories 4.4–4.8 in backlog; Stories 4.9 and 4.10 not yet written.

### Overall Readiness Status

**NEEDS WORK — Conditional on two actions before Stories 4.7/4.8 begin**

Stories 4.3 and 4.4 are ready to implement now with no blocking issues. The critical gap is the absence of Stories 4.9 and 4.10, which creates explicit stubs and dead menu items in Stories 4.7 and 4.8. These stubs should not ship as done.

---

### Critical Issues Requiring Immediate Action

1. **Write Story 4.9** before Story 4.7 is started (or at minimum before it is closed). Story 4.7 explicitly defers `LifecycleBadge` and `SheetItemEditor` to Story 4.9. Without it, `ItemCard` rows are missing lifecycle signals (FR42/FR43 partial) and the item editor is a non-functional stub (FR44/FR51/FR43 partial). Coverage for FR42, FR43, FR44, FR45, and FR51 is incomplete.

   **Minimum Story 4.9 scope:** `SheetItemEditor` (PEEKED/OPEN states, name + category + store + lifecycle `ToggleButtonGroup`), `LifecycleBadge` component, `addedBy` field rendering on `ItemCard`, UX-DR-E4-12, UX-DR-E4-6.

2. **Write Story 4.10** before Story 4.8 is closed. Story 4.8 includes "Share & Members" in the `ListCard` overflow menu with no AC defining what happens when it is tapped. The `SheetShare`, `SheetInvite`, and Household tab page (`/household`) are all uncovered. FR39 (frontend), FR40 (Household tab), FR48 (Household content), and UX-DR-E4-13/14 all land here.

   **Minimum Story 4.10 scope:** `SheetShare` + `SheetInvite` components (FR39 frontend), Household tab page (`app/household/page.tsx`) with member list and remove action (FR48), `/invite/[token]` deep-link invite acceptance screen (UX-DR-E4-14), two-actor real-time collaboration Playwright E2E test (AR-E4-15).

3. **Add `actorId` to GQL subscription schema** before Story 4.7 begins. The UX spec requires this field on all item mutation subscription events for the "was this me?" check that drives `SRContext` throttling. If this field is not in the schema before `npm run generate` is run for Story 4.7, the frontend implementation will be incorrect and require a schema re-run.

---

### Recommended Next Steps (In Order)

1. **Now (before Story 4.3):** Note — Story 4.3 is ready and has no blocking issues. Proceed.

2. **Before Story 4.4 starts:** Confirm the `actorId` field decision and add it to the GQL schema if approved. It can be included in Story 4.4's schema changes since that story already touches `saveItem` and item mutations.

3. **Before Story 4.7 starts:** Write Story 4.9 (SheetItemEditor & Item Lifecycle UI). Story 4.7 is safe to start without 4.9 being done, but the story should not be closed until 4.9 scope is locked.

4. **Before Story 4.8 closes:** Write Story 4.10 (Household Tab, SheetShare, Invite Deep-Link). Remove "Share & Members" from Story 4.8's `ListCard` menu if Story 4.10 is not yet written — a dead menu item is worse than no menu item.

5. **Document cleanup (low priority):** Correct the PRD Journey 7 sharing narrative to align with FR39 (pending invite model). Update PRD Journey 8 undo window from 4s to 5s. Note the NFR12 cache-vs-no-cache decision as resolved (no-cache wins per Story 2.1 AC). These are correctness fixes to the living documents, not implementation blockers.

6. **After Epic 4 completes:** Close the Epic 3 gap in `epics.md` — add a brief Epic 3 section documenting what was done (tech debt triage, E2E coverage) so the document has a complete numbered epic history.

---

### Issue Inventory

| # | Severity | Category | Issue | Blocking? |
|---|----------|----------|-------|-----------|
| 1 | 🔴 Critical | Missing stories | Story 4.9 (SheetItemEditor, LifecycleBadge) not written | Blocks Story 4.7 close |
| 2 | 🔴 Critical | Missing stories | Story 4.10 (Household tab, SheetShare, invite deep-link) not written | Blocks Story 4.8 close |
| 3 | 🔴 Critical | Story quality | Story 4.8 "Share & Members" menu has no ACs | Story 4.8 incomplete |
| 4 | 🔴 Critical | Story quality | Story 4.7 has explicit forward dependency stub on Story 4.9 | Story 4.7 incomplete |
| 5 | 🟠 Major | UX gap | `actorId` in GQL subscription events — required by UX, untracked | Story 4.7 risk |
| 6 | 🟠 Major | UX gap | Session boundary hiding for recurring items — UX-only, no FR/story | Story 4.9 risk |
| 7 | 🟠 Major | UX gap | Notification badge on Lists tab icon for pending invites — no FR/AC | Story 4.8/4.10 risk |
| 8 | 🟠 Major | PRD conflict | Journey 7 (instant sharing) contradicts FR39 (pending invite model) | Documentation debt |
| 9 | 🟠 Major | Duration conflict | Undo window: PRD says 4s, UX spec says 5s | Documentation debt |
| 10 | 🟡 Minor | NFR conflict | NFR12: PRD says cache, epics say no-cache — decision resolved but undocumented | None |
| 11 | 🟡 Minor | Coverage gap | NFR1–NFR18 not in FR Coverage Map | Traceability |
| 12 | 🟡 Minor | Coverage gap | NFR5 (HTTPS) has no story | Ops awareness |
| 13 | 🟡 Minor | Story quality | Story 2.0 is developer-framed (no user value) | Cosmetic |
| 14 | 🟡 Minor | Story quality | Story 1.6 placement vs NFR17 sequencing | Process clarity |
| 15 | 🟡 Minor | Planning gap | Epic 3 absent from `epics.md` | Documentation debt |

**Total issues: 15** (4 critical, 5 major, 6 minor)

---

### Final Note

The planning artifacts for bag-please Epic 4 are substantive and well-structured. Epics 1–3 delivered a solid foundation. The PRD, UX specification, and architecture document are thorough and aligned on the core design decisions. The majority of the 56 FRs have complete, testable story coverage with clear BDD acceptance criteria.

The primary gap is structural, not conceptual: **Stories 4.9 and 4.10 need to be written.** They are referenced explicitly in the existing stories and their scope is well-understood — the work to define them is estimable. Once written, the planning artifact set will be complete.

**Stories 4.3 and 4.4 are ready to begin implementation today.**

---

*Report generated: 2026-05-22 | Assessed by: Implementation Readiness Skill*
