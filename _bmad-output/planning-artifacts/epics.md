---
status: final  # Epic 10 planned and validated 2026-10-19
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  # Re-initialised from the template for Epic 10 on 2026-10-19 (md's choice). Epics 1–9 bodies are
  # verbatim in epics-archive.md; the Epic 9 requirements inventory is in git at 4321365.
  - docs/feedback.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/architecture/architecture-epic-9/ARCHITECTURE-SPINE.md
  # UX design contract (bmad-ux spine pair, ux-epic-8 — the only run folder):
  - _bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - _bmad-output/implementation-artifacts/epic-9-retro-2026-09-24.md
  # Epic 7 dependency-currency precedent (the HOLD/LAND protocol this epic reuses):
  - _bmad-output/implementation-artifacts/spec-7-10-typescript-6-to-7.md
  - _bmad-output/implementation-artifacts/spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md
  - _bmad-output/implementation-artifacts/spec-7-13-graphql-16-to-17.md
  # Shipped code is authoritative where it disagrees with a planning document. Spot-checked 2026-10-19:
  - bp_front/package.json
  - gradle/libs.versions.toml
  - bp_front/src/components/AppShell.tsx
  - bp_front/src/routes/ListShoppingPage.tsx
  - bp_front/src/routes/ListDetailPage.tsx
  - bp_front/e2e/sharing.spec.ts
  - AGENTS.md
---

# bag-please - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bag-please, decomposing the requirements from the PRD,
UX Design if it exists, and Architecture requirements into implementable stories.

**Epic set:** this file holds the live epic (**Epic 10**). Closed Epics 1–9 live verbatim in
[`epics-archive.md`](./epics-archive.md). The two files are one epic set — sprint planning must be run with **both**
(`--epic-file .../epics.md --epic-file .../epics-archive.md`), or the story keys for Epics 1–9 are reported as orphans
and dropped from `sprint-status.yaml`.

**Scope source:** `docs/feedback.md` (2026-10-19) — one user-feedback item and two technical-debt items. Rulings by md
on 2026-10-19: remove the back-to-lists link on **both** list screens; "Gql 11" means **graphql-kotlin 11**; the
documentation cleanup covers the `docs/` scan output, stale planning artifacts, **and** the agent context files.

## Requirements Inventory

### Functional Requirements

Every active FR in `prd.md`, condensed. **Bold** = amended for Epic 10 and stated in full; the rest are delivered
(Epics 1–9) and listed so a story can cite them without re-reading the PRD. `prd.md` does not yet carry the FR57
amendment — the story that removes the links amends it in the same commit.

**User Authentication**
FR1: Unregistered user can create an account with a username and password
FR2: Registered user can authenticate with their username and password
FR3: Authenticated user can log out
FR4: System auto-authenticates a user immediately after successful registration
FR5: System shows a one-time welcome message on the first login after registration

**Session Management**
FR6: System issues a short-lived access token on authentication
FR7: System issues a long-lived refresh token on authentication
FR8: System silently renews an expired access token with a valid refresh token
FR9: System redirects to login with a session-expiry message when the refresh token is invalid
FR10: System invalidates the refresh token on logout

**User Account**
FR11: Authenticated user can change their own password
FR12: System shows the authenticated user's name in the navigation on all screens

**Admin User Management**
FR13: Admin can view a list of all registered user accounts. The list is paginated: one page shows at most
20 users in a stable order (username, ascending), with controls to move between pages and a display of the total user
count. Creating or deleting a user keeps the admin on a valid page — deleting the only user on the last page moves back
one page.
FR14: Admin can create a user with a username and initial password
FR15: Admin can delete a user account
FR16: Admin can reset any user's password
FR17: Destructive user-management actions (delete, reset password) require explicit admin confirmation
FR18: Admin credentials come from environment variables, not the user database
FR19: Admin changes their own password only via environment variables

**Application Configuration**
FR20: Admin can enable/disable public self-registration at runtime
FR21: The registration option is hidden on the login screen when registration is disabled
FR22: Configuration changes take effect without a restart
FR23: Configuration is persisted as a runtime entity in the database

**User Feedback**
FR66: A regular user can send feedback — an idea, a feature request, or a problem — from any authenticated screen.
The account menu carries a Feedback entry that opens a form with a single free-text field (required, at most 2000
characters). Submitting stores the entry with the submitter's username and the submission time, confirms that it was
sent, and returns the user to the screen they came from; cancelling sends nothing. A user does not see, edit, or delete
feedback after sending it. The admin account's menu does not show the Feedback entry (FR56).
FR67: The admin can review user feedback in the admin area: all entries, newest first, each showing its text, the
submitter's username, and the submission time. Feedback text is displayed as plain text, never interpreted as markup.
The admin can delete an entry after explicit confirmation (as FR17 requires); deletion is permanent. This is the triage
point — the admin carries what is worth keeping into project planning outside the app, then deletes the entry; feedback
has no status, reply, or tagging in the app. Deleting a user account does not delete that user's feedback.

**Security & Access Control**
FR24: Role-based access control distinguishes admin and regular users on all protected operations
FR25: Authentication and registration attempts are rate-limited per IP
FR26: Users cannot register the admin's reserved username
FR27: All authentication failures return one non-distinguishing message
FR28: The authenticated identity and role are in the request context of every API operation

**Navigation & Access Routing**
FR29: Unauthenticated users on protected routes are redirected to login
FR30: Admin users can access the user management interface
FR31: Non-admin users are denied admin-only interfaces
FR32: The login screen guides users who cannot access their account (contact admin)
FR33: A specific message is shown on redirect to login after session expiry

**List Management**
FR34 (amended 2026-09-15, no work): User can create a named list with an emoji icon; the optional description is
dropped by decision
FR35: User can view all lists they own or are a member of
FR36: User switches lists with a chip-row switcher on the shopping view; the active list is visible in chips, title, URL
FR37: Only the owner can delete a list; deletion removes the list, its items and categories; subscribers are
disconnected; non-owners leave instead
FR38: The active list is identified by `/list/[listId]`; `/` redirects to the oldest list, or `/lists` when none

**List Sharing & Membership**
FR39: Owner shares by exact username, creating a pending invite the invitee accepts or rejects; specific errors for
unknown user, existing member, or self
FR40: All members have full item write access; the owner can remove any member; the removed member's items remain
FR41: A user only views/modifies items and categories of lists they are an accepted member of; unauthorized
`/list/[listId]` redirects to `/lists`
FR55: A non-owner member can leave a shared list; their items remain

**Item Lifecycle**
FR42: *(Deferred since Epic 5, not re-scoped.)* One-timer items soft-delete on check-off with undo
FR43: *(Deferred since Epic 5, not re-scoped.)* Recurring items (weekly/biweekly/monthly) restored by the scheduler
FR44: User can assign an item to zero, one, or several stores, since the same item can often be bought in
more than one place. Both the add-item and edit-item dialogs offer a multi-value store field that suggests stores derived
from existing item data and also accepts a new store name. Store names are trimmed; names differing only in letter case
count as the same store and are not held twice on one item. A store is thus recognised consistently across items — the
groundwork for showing only one store's items while shopping there (Phase 3). The shopping-view item row shows every
store the item carries, and all of them stay inside the row's single check target (FR60).
FR45: Each item shows its `addedBy` username on the shopping-view row
FR54: An hourly scheduler restores recurring items whose cadence elapsed and hard-deletes one-timers soft-deleted over
an hour ago
FR58: Item save is a merge — `addedBy`, `checkedAt`, `deleted`/`deletedAt` survive; create vs update is decided by
whether the id exists on the target list; an id on a different list, or a category outside the target list, is rejected

**Data Scoping & Migration**
FR46: All new items and categories are associated with a list at creation
FR47: The one-time Epic 4 migration moves unscoped data to a default "Groceries" list, recorded in `app_migrations`
FR56: The admin account is restricted only to user management, application configuration, and reviewing
user feedback (FR67); admin callers are rejected by all list-related GQL operations (`createList`, `lists`, `items`,
`categories`, `shareList`, `deleteList`, and all subscription operations); the admin cannot create, own, view, or be a
member of any list, and does not send feedback (FR66).
FR69: No store data is lost when items move from one store to several (FR44): an item that had a store keeps it
as its only store, and an item without one has no stores. The conversion runs once, on the first startup of the release
that ships multi-store items, and does not re-run.

**Navigation & UX**
FR48, FR49: *(Superseded — Epic 4 bottom-tab design that never shipped.)*
FR50: The lists index shows owned/member lists plus pending invites; a zero-lists state shows onboarding guidance
FR51: Item creation and editing happen in overlays without leaving the current view
**FR57 (amended for Epic 10): From any authenticated screen the user can return to the application home destination in
one action: the "Bag Please" app-bar title is a link to `/`, which delegates home resolution to the existing behaviour
(the user's oldest list by creation date, the lists index when they own none, the admin area for the admin account).
The account menu carries a Home entry that goes to the same destination as the title link (on the home route it simply
closes the menu) and a My lists entry that opens the lists index. Those menu entries are the navigation; neither the
shopping view nor the list management screen carries its own back-to-lists link. No screen is a navigational dead end
requiring the browser back button.**
FR59: The app is installable from Chrome on Android as a standalone WebAPK (manifest + PNG icons + service worker); no
offline capability
FR60: The whole shopping-view item row is one check target and one accessible control
FR61: Item filtering and search are available on both list surfaces with the same controls and semantics:
a category filter accepting several categories (none selected = all) and a free-text name search, combined with AND;
the shopping view keeps its checked-status toggle, which is not added to the management screen. Empty categories show on
the management screen only when no filter or search is active; the shopping view always hides empty groups. The open
category menu covers most of a phone screen, so it carries an explicit confirm control that closes it; selections apply
as they are toggled, so confirming only closes and there is no cancel-and-revert. Tapping outside the menu or pressing
Escape still closes it too.
FR62: Categories and their items are ordered by name identically on `/list/:id` and `/lists/:id`
FR63: A list member can rename a category from the management screen; the rename reaches other members in real time
FR68: The shopping view (`/list/:id`) offers a floating add button that adds an item to the list being viewed
without leaving the screen. It opens the same add-item dialog the list management screen uses (name, category, store(s)
per FR44) with the current list as the fixed target; the new item appears on the shopping view on save and reaches other
members in real time (FR52). The button stays reachable while scrolling and never permanently covers the last item row
or its controls. If the list has no categories yet, the dialog says a category is needed first and offers a way to the
list management screen.

**Real-Time Collaboration & Authentication**
FR52: Item check-off, add, edit and delete reach other members' shopping views live via GraphQL subscription
FR53: WebSocket subscriptions require a valid JWT in `connectionParams`; the backend closes on expiry; the frontend
disposes the socket before clearing auth

**Epic 10 FR scope:** FR57 (amended). Every other FR is delivered and must stay green through the dependency and
documentation work — the upgrade stories are regression-gated against the whole suite, not against new behaviour.
**Still deferred:** FR42, FR43 (not re-scoped by md). Phase 3 single-store shopping mode is not in Epic 10.

### NonFunctional Requirements

Carried verbatim from the Epic 9 inventory; all delivered and all still binding.

**Security**
NFR1: Passwords hashed with bcrypt cost 12; plaintext never stored or logged
NFR2: Refresh tokens stored in MongoDB with a 30-day TTL index
NFR3: Refresh tokens delivered only via httpOnly `SameSite=Strict` cookies
NFR4: Access tokens 15 minutes; refresh tokens 30 days
NFR5: All client-server communication uses HTTPS in production
NFR6: Authentication endpoints are rate-limited per IP
NFR7: No passwords, raw tokens or credential material in logs
NFR8: JWT payloads carry only username and role

**Performance & Scalability**
NFR9: Login, register and refresh complete in under 1 second under normal load
NFR10: Auth screens render without perceptible layout shift on mobile
NFR11: Small user base (tens of users); no horizontal scaling
NFR12: ApplicationConfig may be cached in memory; writes invalidate immediately

**Accessibility**
NFR13: Every input field has a visible, associated label
NFR14: Forms are fully keyboard-navigable (tab order, submit on Enter)
NFR15: Form error messages are associated with their fields
NFR16: Text and interactive elements meet minimum colour contrast

**Test gate**
NFR17: A Playwright E2E suite covers every delivered flow, runs against the production artifact (Caddy-served SPA +
backend + MongoDB) on a desktop and a mobile viewport, and passes with zero failures before any story is marked done
NFR18: E2E tests use browser-level isolation and are UI-driven — each spec registers a fresh user and signs in through
the form; no login fixture, no `storageState`; direct API calls only to prepare the environment, never for the behaviour
under assertion; sessions are never faked by intercepting requests

**Narrow viewport**
NFR64: A 320px CSS width is a supported viewport — nothing overflows horizontally, no control is pushed off-screen, and
no text is clipped except where a story has measured the clipping and recorded the decision to keep it
NFR65: The 320px floor is gated by the E2E suite on every phone-emulating project, asserted mechanically, never by eye

**Lists & Sharing**
NFR-L1: Subscription events are scoped per list, at subscribe time and per event (`takeWhile` membership re-check)
NFR-L2: Every service method touching list-scoped data verifies membership before any access, reads included
NFR-L3: The Epic 4 migration is idempotent via an `app_migrations` completion record
NFR-L4: No list data is reachable by non-members at any layer; unauthorized access is a GQL error, not an empty result
NFR-L5: Subscriptions validate the `connectionParams` JWT before any stream, close on expiry, and `clearAuth()` disposes
the socket first

**Epic 10 NFR scope:** NFR17, NFR18, NFR64, NFR65 bind every story that ships code. NFR-L1–NFR-L5 and NFR1–NFR8 are
the regression surface the dependency bumps must not move (subscription auth, cookie flags, token lifetimes,
rate-limit behaviour). The documentation story ships no code; NFR17 is not applicable to it, recorded as a decision.

### Additional Requirements

From `architecture.md`, the Epic 9 spine's inherited invariants, the Epic 7 dependency-currency precedent (Stories
7.8–7.13) and the `deferred-work.md` ledger. Identifiers are `AR-E10-n`. Versions below were measured against the live
registries on 2026-10-19 and are a planning snapshot — every story re-measures before it moves anything.

**Starter template:** none — brownfield.

**Inherited, binding on every story**
- AR-E10-0: The Epic 9 invariants stand unchanged (AR-E9-0, -0a, -0b): per-entity slice layout, one-way GQL → Service →
  Storage → Repository; existing error classes, no new envelope; codegen regenerated in the same story as any schema or
  GraphQL-server change, never hand-edited; backend and frontend ship in one app version (`gradle.properties` =
  `package.json`); backend rules proven with Kotest + Testcontainers via `./gradlew :bp_back:cleanTest :bp_back:test`.

**Dependency currency (feedback tech-debt item 1)**
- AR-E10-1: **Inventory first.** Every direct dependency is listed with its locked version and its latest stable
  version, measured on the day: `gradle/libs.versions.toml` (Kotlin 2.4.10, Ktor 3.5.2, graphql-kotlin 10.2.1, Arrow
  2.2.3, Logback 1.6.2, Mongo driver 5.9.2, Kotest 6.2.4, Testcontainers 2.0.5, bcrypt 0.10.2), `bp_front/package.json`
  (dependencies and devDependencies, including the `^`-ranged ones), the Docker base images (`gradle:9.6.1-jdk25`,
  `eclipse-temurin:25`, `node:26-alpine`, `caddy:2-alpine`, `mongo:8`) and the `mise.toml` toolchains (temurin-25,
  node 26). A prerelease (`-alpha`, `-beta`, `-RC`, `-canary`) is never a candidate.
- AR-E10-2: **One variable per move.** Minor/patch bumps may land together per side (backend / frontend); each major
  moves alone so a failure is attributable (Epic 7 ledger lesson, deferred-work.md "two variables" entry). A major may
  carry a co-mover only when the upgraded artifact's published metadata requires it (e.g. a POM's Kotlin floor), cited.
- AR-E10-3: **LAND or HOLD, never forced.** No `--legacy-peer-deps`, `--force`, `overrides`, `resolutions`, `.npmrc`
  change, Gradle `force`/`strictly`, `-Xskip-metadata-version-check` or added `@Suppress` left in the tree. A bump
  that cannot land cleanly is reverted to a byte-identical lockfile, its blocking symptom recorded verbatim in
  `deferred-work.md`, and the story still closes `done` (the S-AC3 rule from Epic 7).
- AR-E10-4: **TypeScript 7 retry.** Measured 2026-10-19: `typescript` latest `7.0.2`; `typescript-eslint` latest
  `8.71.2` still declares peer `typescript >=4.8.4 <6.1.0` — the same blocker that held Story 7.10. The story re-measures
  the peer range; if it still excludes 7.x the expected outcome is a HOLD at `6.0.3` with the evidence refreshed in the
  Story 7.10 ledger entry (not a duplicate), plus a fresh `tsc -b --force` under TS 7 to confirm the code itself is
  still clean. It does not swap the lint stack to escape the peer constraint.
- AR-E10-5: **graphql-kotlin 11.** Measured 2026-10-19: `11.0.0` is released (locked `10.2.1`). Before the bump, the
  open Story 7.12 ledger entry (Jackson 2 and Jackson 3 both on the runtime classpath; which `ContentNegotiation`
  converter serialises GraphQL bodies unmeasured; `JacksonWebsocketContentConverter` at `GQL.kt` possibly vestigial) is
  resolved by measurement and recorded as a rule — the ledger says "before the next graphql-kotlin major, not after".
  The bump preserves the observable contract: failing-mutation and `FORBIDDEN` response bodies byte-identical; the
  resolver error prefix `Exception while fetching data (/<field>) : ` that `bp_front/src/lib/admin/adminErrors.ts`
  strips; `extensions.code` from the four `GraphQL*Exception` classes; a live subscription over `graphql-ws`; GraphiQL
  status. Codegen is re-run and its output either byte-identical or committed.
- AR-E10-6: **Verification set per bump:** `cleanTest test` totals read from the JUnit XML; `npm run lint`;
  `npm run build`; `npm run test:e2e` on all Playwright projects against the production image; `npm run generate`
  byte-check for any backend GraphQL change. Every count measured in the pass, none quoted from memory.
- AR-E10-7: Docs that name pinned versions (root/per-directory `CLAUDE.md`, `AGENTS.md`, `architecture.md`
  stack line) are updated in the same commit as the version they name.

**Documentation cleanup (feedback tech-debt item 2)**
- AR-E10-8: **Consumers decide what lives.** A file is kept only if something reads it: a `CLAUDE.md`/`AGENTS.md`
  load, a BMAD skill or `_bmad` config path (`project_knowledge` → `docs/`, `planning_artifacts`,
  `implementation_artifacts`), or a live planning document's citation. Each deletion is justified by a grep showing no
  live consumer; historical records under `implementation-artifacts/` that cite a deleted file are records and are not
  rewritten.
- AR-E10-9: **`docs/` scan output.** The 11 files from the old `document-project` scan (`index.md`,
  `project-overview.md`, `source-tree-analysis.md`, `api-contracts-bp_back.md`, `data-models-bp_back.md`,
  `component-inventory-bp_front.md`, `architecture-routing.md`, `deployment-guide.md`, `development-guide.md`,
  `project-parts.json`, `project-scan-report.json`) are reviewed against the code; anything still true and not already
  in a `CLAUDE.md` is folded into the right one; the rest is deleted. `docs/feedback.md` stays (it is the backlog
  intake). `project_knowledge` in the BMAD config is left pointing at a directory that exists and means something.
- AR-E10-10: **Stale planning artifacts.** Candidates: the three `implementation-readiness-report-*.md`, the two
  `ux-design-directions*.html`, the legacy `ux-design-specification*.md` (superseded by the `ux-epic-8` spine pair),
  `prd-validation.md`, the two `sprint-change-proposal-*.md`, and the `review-*-epic9.md` / `.memlog.md` leftovers at
  the planning root. Each is either deleted (no live consumer, value preserved in git) or kept with its consumer named.
  `prd.md`, `architecture.md`, the Epic 9 spine, the `ux-epic-8` pair, `epics.md` and `epics-archive.md` are kept.
- AR-E10-11: **Agent context files.** `AGENTS.md` (managed `bmad:context` block, verified at `1bb60cb`, 2026-09-07) is
  refreshed with `bmad-project-context`; the four `CLAUDE.md` files are checked line by line against the code — stale
  claims fixed, duplication between root, per-directory and `AGENTS.md` removed so each fact lives once.

**Back-to-lists removal (feedback user item 1)**
- AR-E10-12: The two links are `list-shopping-back` (`ListShoppingPage.tsx`, Story 6.2) and `list-detail-back`
  (`ListDetailPage.tsx`). E2E that navigates through them (`e2e/sharing.spec.ts` `backToLists()`, five call sites, and
  any spec asserting either test id) is moved to the account-menu `menu-lists` path through the shared helpers in
  `e2e/support/ui.ts`, not re-declared in the spec. The now-unused imports (`ArrowBackIcon`, `RouterLink`/`Link` where
  orphaned) are removed so lint stays clean.

**Out of scope unless md pulls them in:** the four open Epic 9 retro actions (ConfirmDialog consolidation of
`DeleteFeedbackDialog`/`DeleteUserDialog`; `ItemLifecycleTest.kt` split; F19 `bmad-build-auto` resume path; F21
`git_evidence.py` dotted story ids).

### UX Design Requirements

From the `ux-epic-8` contract (`DESIGN.md` + `EXPERIENCE.md`), as affected by the FR57 amendment.

- UX-DR-E10-1: The shopping view (`/list/:id`) and the list management screen (`/lists/:id`) open directly on their
  header — no back link above the title. Vertical rhythm above the header is re-checked so the title does not jump
  against the app bar (the link's `mb: 2` spacing goes with it) on desktop and at the 320px floor.
- UX-DR-E10-2: Navigation to the lists index is the account menu's **My lists** entry and home is **Home** / the
  app-bar title; no in-page navigation affordance replaces the removed links.
- UX-DR-E10-3: `EXPERIENCE.md` (navigation / information-architecture sections and both screens' anatomy) and
  `DESIGN.md` (any back-link pattern or component listing) are corrected in the same commit as the removal; the
  "one back-link pattern" note is deleted rather than left describing nothing.

### FR Coverage Map

FR57: Epic 10 — the back-to-lists links on `/list/:id` and `/lists/:id` are removed; the app-bar title and the
account menu (Home, My lists) are the navigation.
FR1–FR56, FR58–FR69 (except deferred FR42/FR43 and superseded FR48/FR49): delivered in Epics 1–9; regression-gated in
Epic 10, no new work.

## Epic List

### Epic 10: Lighter Screens, a Current Stack and Docs That Earn Their Place

The two list screens lose a back link the account menu already provides and open straight on their header. Underneath,
every dependency is brought to its latest stable release or explicitly held with recorded evidence — including a retry
of TypeScript 7 and graphql-kotlin 11, the latter only after the Jackson 2/3 question from Story 7.12 is settled. The
documentation is cut to what agents and BMAD actually read, and what stays is verified against the code.

**FRs covered:** FR57 (amended); every other FR regression-gated
**NFRs binding:** NFR17, NFR18, NFR64, NFR65 on every code story; NFR1–NFR8 and NFR-L1–NFR-L5 as the bump regression
surface
**Carries:** AR-E10-0 … AR-E10-12, UX-DR-E10-1 … UX-DR-E10-3
**Source:** `docs/feedback.md` (2026-10-19) — user item 1, technical-debt items 1 and 2

**Why one epic (md, 2026-10-19).** No feedback loop runs between the three items: the removal is two screens and one
spec, the bumps follow the LAND/HOLD protocol proven in Epic 7, and the documentation pass must run last regardless.
The project ships one branch, one retro and one app version per epic.

**Ordering constraints for story creation:**

1. The back-link removal lands first, so its E2E change (`backToLists()` → `menu-lists`) is in the suite every upgrade
   is gated against.
2. The Jackson 2/3 measurement precedes graphql-kotlin 11 (the 7.12 ledger entry: "before the next major, not after").
3. Each major moves in its own story; minor/patch bumps are batched per side (backend / frontend).
4. The TypeScript 7 retry follows the frontend bumps, so it is measured against the newest `typescript-eslint`.
5. The documentation cleanup runs last: version lines in `CLAUDE.md`/`AGENTS.md` are only final after every bump, and
   `AGENTS.md` is refreshed against the final HEAD.

---

## Epic 10: Lighter Screens, a Current Stack and Docs That Earn Their Place

The two list screens open straight on their header, with navigation left to the account menu; every dependency is on
its latest stable release or held with recorded evidence; and the documentation is only what something actually reads,
verified against the code.

**Delivers:** FR57 (amended) · AR-E10-0 … AR-E10-12 · UX-DR-E10-1 … UX-DR-E10-3

**Binding on every story below:** the inherited invariants (AR-E10-0); E2E against the production artifact on desktop
**and** the 320px floor, UI-driven (NFR17, NFR18, NFR64, NFR65) for every story that ships code; every new or changed
test observed failing before it is accepted; every count, version and test total measured in the pass, never quoted;
any blocked bump reverted to byte-identical manifests and lockfiles and recorded in `deferred-work.md` with the story
still closing `done` (AR-E10-3); docs naming a moved version updated in the same commit (AR-E10-7); `DESIGN.md` /
`EXPERIENCE.md` corrected in the same commit as any screen they describe; `sprint-status.yaml` reconciled at story
close. Registry versions quoted below are the 2026-10-19 planning snapshot — each story re-measures before it moves
anything, and a newer stable release found on the day is the target instead.

### Story 10.1: The list screens open on their header

As a list member,
I want the shopping view and the list management screen to start with the list's own header,
So that I don't scroll past a back link that duplicates the account menu's Home and My lists entries.

**Acceptance Criteria:**

**Given** a signed-in user on the shopping view `/list/:id`
**When** the page renders
**Then** there is no back-to-lists link above the header: `list-shopping-back` is absent from the DOM
**And** the header (`shopping-header`) is the first content in the page container (UX-DR-E10-1)

**Given** a signed-in user on the list management screen `/lists/:id`
**When** the page renders
**Then** `list-detail-back` is absent from the DOM and the header block is the first content in the page container

**Given** either screen on a desktop viewport and at the 320px floor
**When** its top spacing is measured against the app bar
**Then** the header sits at the container's top padding with no leftover gap from the removed link's `mb: 2`, nothing
overflows horizontally, and the existing 320px layout assertions stay green (NFR64, NFR65)

**Given** a signed-in user on either screen
**When** they open the account menu and choose **My lists**
**Then** they land on `/lists`; choosing **Home** or the app-bar title still goes to the resolved home (FR57 amended,
UX-DR-E10-2)

**Given** the E2E suite (15 specs) references the removed test ids today — `sharing.spec.ts` (`backToLists()` helper),
`shopping.spec.ts`, `admin.spec.ts`, `lists.spec.ts`, `navigation.spec.ts`
**When** the story is done
**Then** every navigation that clicked `list-detail-back` or `list-shopping-back` goes through the shared
`openListsViaMenu()` in `e2e/support/ui.ts`, the local `backToLists()` helper is deleted, no spec re-declares a helper,
and `grep -rn "list-detail-back\|list-shopping-back" bp_front/` returns nothing (AR-E10-12)
**And** `navigation.spec.ts` assertions that the shopping view **shows** a back link (Story 6.2 / FR57) are replaced by
assertions that neither screen has one, each observed failing against the pre-change build before it is accepted

**Given** `ArrowBackIcon` and `RouterLink`/`Link` imports become unused in `ListShoppingPage.tsx` and `ListDetailPage.tsx`
**When** `npm run lint` and `npm run build` run
**Then** both pass with the orphaned imports removed, and `DESIGN.md`'s icon inventory drops `ArrowBack` (no remaining
consumer under `bp_front/src/`) with its count line updated

**Given** `prd.md` FR57 and the `ux-epic-8` contract still describe a back-to-lists affordance
**When** the code change is committed
**Then** the same commit amends FR57 in `prd.md` to the Epic 10 wording in this file's inventory (with a dated
`changes` entry in its frontmatter), and corrects `EXPERIENCE.md` (navigation / IA, both screens' anatomy) and
`DESIGN.md` so no sentence describes the removed link or the "one back-link pattern" (UX-DR-E10-3)

**Given** the full gate
**When** the story closes
**Then** `npm run lint`, `npm run build` and `npm run test:e2e` on every Playwright project pass with measured totals
recorded

### Story 10.2: We know which Jackson writes our GraphQL responses

As md, maintaining the backend,
I want a measured answer to which Jackson mapper serialises GraphQL bodies and WebSocket frames,
So that the graphql-kotlin 11 bump cannot silently flip response serialisation.

**Acceptance Criteria:**

**Given** the open Story 7.12 ledger entry in `deferred-work.md` (Jackson 2 and Jackson 3 both on `runtimeClasspath`;
`ContentNegotiation { jackson() }` on the root route at `Routing.kt`; `JacksonWebsocketContentConverter` at `GQL.kt`)
**When** the story runs at least two of the black-box discriminators the entry names — non-ASCII / astral-plane escaping
via the `emoji` field, `Accept`-header negotiation and 406 behaviour, the `Content-Type` `charset` suffix, field
ordering / pretty-print defaults — or a throwaway-build `pluginOrNull(ContentNegotiation)` read
**Then** the mapper serialising HTTP GraphQL `data`/`errors` is identified with the probe output captured verbatim
**And** the same is established for subscription frames over `graphql-ws`

**Given** the answer
**When** it is recorded
**Then** it becomes a rule in `bp_back/CLAUDE.md` (which mapper owns which path, and what moving or removing the root
`ContentNegotiation` install would change)
**And** a Kotest `testApplication` test pins the discriminating behaviour, so relocating the install fails the backend
suite; the test is observed failing with the install moved before it is accepted

**Given** the WebSocket converter is shown vestigial for GraphQL frames
**When** it is removed
**Then** a live subscription (item check-off reaching a second member) still works in E2E and the `FORBIDDEN` and
failing-mutation response bodies stay byte-identical to a captured baseline (md5 recorded before and after)
**And** if it is shown load-bearing instead, a code comment at `GQL.kt` says so and why, and nothing is removed

**Given** the story closes
**Then** the 7.12 ledger entry is closed in place with a pointer to the rule and the test; no dependency version moved
(`git diff gradle/libs.versions.toml` empty); `cleanTest test` totals read from the JUnit XML and the full E2E gate pass

### Story 10.3: The backend runs on current minor releases

As md, maintaining the backend,
I want every backend dependency below its next major brought to the latest stable minor/patch,
So that the graphql-kotlin major lands on a current base as the only variable.

**Acceptance Criteria:**

**Given** the backend inventory (AR-E10-1), re-measured on the day — snapshot: Kotlin 2.4.10 → 2.4.21, Ktor 3.5.2 → 3.6.0,
Mongo driver 5.9.2 → 5.13.0, Logback 1.6.2 → 1.6.5, Kotest 6.2.4 → 6.2.6; Arrow 2.2.3, Testcontainers 2.0.5, bcrypt 0.10.2
current; `gradle:9.6.1-jdk25` → current Gradle 9.x image; `eclipse-temurin:25`, `mongo:8`, mise `temurin-25`
**When** the story lists it
**Then** the record shows locked vs latest-stable for each, prereleases excluded (Kotlin 2.5.0-Beta*, Arrow 2.3.0-alpha*),
and `graphql-kotlin` explicitly left for Story 10.4

**Given** the minor/patch bumps applied together in `libs.versions.toml` and `bp_back/Dockerfile`
**When** `./gradlew :bp_back:cleanTest :bp_back:test` and `:bp_back:build` run
**Then** both pass with no added `@Suppress`, `force`/`strictly`, or `-Xskip-metadata-version-check` (AR-E10-3)
**And** if anything fails, the bumps are bisected and only the culprit is held — reverted and recorded verbatim in
`deferred-work.md` — while the rest land

**Given** the Story 10.2 rule and test
**When** the bumped backend runs
**Then** the Jackson-discrimination test stays green, and the `FORBIDDEN` / failing-mutation bodies match the 10.2 md5
baseline

**Given** Ktor moves a minor
**When** the auth and rate-limit surfaces are exercised
**Then** login, refresh-cookie flags (`Secure`, `HttpOnly`, `SameSite=Strict`), rate limiting, `/api/health` and the
subscription JWT close-on-expiry behave as before — covered by the existing Kotest and E2E suites, totals measured

**Given** the bumped stack built with `docker compose up --build`
**When** `npm run generate` runs with a fresh `CODEGEN_TOKEN`
**Then** `git status --short bp_front/src/__generated__/` is empty, or the change is committed and explained

**Given** the story closes
**Then** the full E2E gate passes on every project, and `bp_back/CLAUDE.md` / `AGENTS.md` / `architecture.md` lines
naming a moved version are updated in the same commit (AR-E10-7)

### Story 10.4: graphql-kotlin 10 → 11

As md, maintaining the backend,
I want graphql-kotlin on 11.x, or a recorded reason it cannot be,
So that the GraphQL server stays on a supported major without changing what clients see.

**Acceptance Criteria:**

**Given** Story 10.3 has landed and `graphql-kotlin` latest stable is re-measured (snapshot `11.0.0`)
**When** the compatibility source is checked
**Then** the `graphql-kotlin-ktor-server` POM's Ktor and Kotlin floors are cited (snapshot: Ktor 3.4.1, Kotlin 2.3.0 —
already met), and the release notes' breaking changes are listed against this codebase's usage (`GQL.kt`, schema
hooks, the four `GraphQL*Exception` classes, subscription server)

**Given** baselines captured before the bump: the failing-`saveItem` error body, a `FORBIDDEN` body, an
`extensions.code` per exception class, `GET /api/graphiql` status, and the Story 10.2 discrimination output
**When** the version moves and only the `bp_back/` edits a captured compile or test error forces are made
**Then** after the bump the bodies are byte-identical (md5 before/after), `errors[0].message` still carries the prefix
`Exception while fetching data (/saveItem) : ` that `bp_front/src/lib/admin/adminErrors.ts` strips, every
`extensions.code` is unchanged, and GraphiQL answers as before (AR-E10-5)

**Given** the bumped backend
**When** `npm run generate` runs and the full E2E gate runs
**Then** codegen output is byte-identical or committed and explained, a live subscription and a live mutation pass on
both viewports, and the Story 10.2 test is green

**Given** the bump cannot land under AR-E10-3's prohibitions
**When** the story takes the HOLD branch
**Then** `libs.versions.toml` and any touched source are restored to byte-identical, the blocking error is recorded
verbatim in a `## Deferred from: Story 10.4` ledger section, and the story closes `done`

**Given** the story closes on LAND
**Then** `cleanTest test` totals come from the JUnit XML and docs naming the graphql-kotlin version are updated in the
same commit

### Story 10.5: The frontend runs on current minor releases

As md, maintaining the frontend,
I want every frontend dependency below its next major brought to the latest stable minor/patch,
So that the PWA and TypeScript majors are each tried on a current base as the only variable.

**Acceptance Criteria:**

**Given** the frontend inventory (AR-E10-1), re-measured on the day — snapshot: React/React DOM 19.2.8 → 19.3.1,
`@apollo/client` 4.2.11 → 4.3.4, MUI 9.3.1 → 9.5.0, Vite 8.2.1 → 8.3.4, `@vitejs/plugin-react` → 6.1.2, Playwright
1.62.1 → 1.64.1, eslint → 10.13.0, `typescript-eslint` → 8.71.2, `graphql-ws` 6.2.1 → 6.4.1, codegen cli 7.2.0 → 7.4.6
and client-preset 6.1.3 → 6.2.3, `@types/*`, `react-router-dom`, `globals`, `eslint-plugin-react-refresh`; `node:26-alpine`,
`caddy:2-alpine`, mise `node 26`
**When** the story lists it
**Then** locked vs latest-stable is recorded for each, and `typescript` (Story 10.7) and `vite-plugin-pwa` (Story 10.6)
are explicitly left out

**Given** the bumps applied with exact pins where the package is pinned today and ranges kept where ranged today
**When** `npm install` runs with no flags and no `.npmrc` change
**Then** it exits 0 with no `overrides`/`resolutions`, and `npm run lint` and `npm run build` pass
**And** a package that cannot land cleanly is held — reverted and recorded verbatim — while the rest land (AR-E10-3)

**Given** `@apollo/client` and `graphql-ws` move a minor
**When** the E2E suite exercises login, silent refresh, a mutation, a live subscription across two members, and logout
disposing the socket before clearing auth
**Then** all pass on every project (NFR-L5, FR53)

**Given** Playwright moves a minor
**When** browsers are installed for the new version
**Then** the four-project topology and count invariants documented in `playwright.config.ts` still hold, with totals
measured

**Given** `npm run generate` runs against the live schema
**Then** `src/__generated__/` is byte-identical or the change is committed and explained

**Given** the story closes
**Then** the full E2E gate passes, `bp_front/CLAUDE.md` / `AGENTS.md` / `architecture.md` version lines are updated in
the same commit, and the bundle-size delta of `npm run build` is recorded (not a failure criterion)

### Story 10.6: vite-plugin-pwa 1 → 2

As someone who installed Bag Please on their phone,
I want the app to keep installing and updating exactly as it does today after the PWA plugin's major upgrade,
So that the upgrade is invisible to me.

**Acceptance Criteria:**

**Given** Story 10.5 has landed and `vite-plugin-pwa` latest stable is re-measured (snapshot `2.0.0`, peer `vite ^3 … ^8`,
`workbox-build`/`workbox-window ^7.4.1`)
**When** the release notes are read against `bp_front/vite.config.ts`
**Then** every breaking change touching the options this project uses — `registerType: 'autoUpdate'`,
`navigateFallback: '/index.html'`, `navigateFallbackDenylist: [/^\/api/]`, empty `runtimeCaching`, manifest and icons —
is listed with its effect

**Given** the plugin moves and only the config edits a captured break forces are made
**When** `npm install` (no flags), `npm run lint` and `npm run build` run
**Then** all exit 0, and the built `dist/` still emits `manifest.webmanifest` (or the renamed equivalent, with Caddy's
content type kept correct), `sw.js` at the root scope, and exactly one injected manifest link

**Given** the production image
**When** `e2e/pwa.spec.ts` runs
**Then** all seven tests pass unchanged: manifest content type and install keys, real PNG icons at declared sizes, `sw.js`
served as JavaScript and not long-term cached, one manifest link, the worker activated and answering navigations,
`/api/health` reaching Ktor under the worker, and no `/api` entry in Cache Storage after an authenticated session
(FR59, NFR-E7-7, AR-E7-15)
**And** `routing/Caddyfile` needs no change, or its change is part of the story and covered by those tests

**Given** an existing installation built on plugin 1.x
**When** the 2.x build is deployed over it
**Then** the old worker is replaced on the next load (`autoUpdate`) without a stale shell — verified by building 1.x,
loading it, rebuilding on 2.x and reloading, with the result recorded

**Given** the bump cannot land under AR-E10-3
**When** the story takes the HOLD branch
**Then** `package.json`, `package-lock.json` and `vite.config.ts` are byte-identical to before, the symptom is recorded in a
`## Deferred from: Story 10.6` ledger section, and the story closes `done`

**Given** the story closes on LAND
**Then** the full E2E gate passes and the `vite-plugin-pwa` version in `CLAUDE.md` / `bp_front/CLAUDE.md` is updated in the
same commit

### Story 10.7: TypeScript 7, tried again

As md, maintaining the frontend,
I want TypeScript 7 adopted if the lint toolchain now allows it, and the blocker re-evidenced if it does not,
So that the hold is current fact, not a two-month-old observation.

**Acceptance Criteria:**

**Given** Story 10.5 has landed (`typescript-eslint` on its newest stable)
**When** `npm view typescript version` and `npm view typescript-eslint peerDependencies` run
**Then** both outputs are recorded verbatim (snapshot: `typescript` 7.0.2; `typescript-eslint` 8.71.2 peer
`>=4.8.4 <6.1.0`)

**Given** the peer range admits `7.x`
**When** `typescript` moves to the latest 7.x with a plain `npm install`
**Then** `npm run lint`, `npm run build` (`tsc -b && vite build`) and the full E2E gate pass, `tsconfig*.json` changes are
only those a captured diagnostic forces, `tsconfig.app.json` still excludes `src/__generated__`, and version lines are
updated in the same commit

**Given** the peer range still excludes `7.x` (the expected path)
**When** a throwaway reproduction forces the install (`--legacy-peer-deps`, in that task only)
**Then** the `npm install` resolution error and the `npm run lint` failure are captured verbatim
**And** `npx tsc -b tsconfig.json --force` under TS 7 is run and its exit code and any diagnostics recorded — a non-zero
exit is new evidence and changes the ledger wording
**And** the tree is restored: `git checkout -- bp_front/package.json bp_front/package-lock.json`, `npm ci`,
`git status --short` empty, `npx tsc --version` reporting `6.0.3`

**Given** the HOLD branch
**When** the evidence is recorded
**Then** the existing Story 7.10 ledger entry in `deferred-work.md` is updated in place with the 2026-10 re-measurement
(no duplicate section), the story does not swap the lint stack to escape the peer constraint (AR-E10-4), and it closes
`done`

### Story 10.8: Only documents something reads are kept

As md, and as every agent loading context in this repo,
I want documentation that no skill, config or context file reads removed, and anything still useful moved to where it is loaded,
So that nobody reads a stale scan or a superseded spec as truth.

**Acceptance Criteria:**

**Given** the candidates — `docs/` scan output (`index.md`, `project-overview.md`, `source-tree-analysis.md`,
`api-contracts-bp_back.md`, `data-models-bp_back.md`, `component-inventory-bp_front.md`, `architecture-routing.md`,
`deployment-guide.md`, `development-guide.md`, `project-parts.json`, `project-scan-report.json`) and planning-root
leftovers (three `implementation-readiness-report-*.md`, two `ux-design-directions*.html`, `ux-design-specification.md`,
`ux-design-specification-epic-4.md`, `prd-validation.md`, two `sprint-change-proposal-*.md`, `review-rubric-epic9.md`,
`review-polish-epic9.md`, `.memlog.md`)
**When** the story audits them
**Then** a table records, per file, its live consumers found by grep over `CLAUDE.md` files, `AGENTS.md`, `_bmad/` config,
`.claude/skills/`, `prd.md`, `architecture.md`, the Epic 9 spine, the `ux-epic-8` pair and `epics*.md` — and the
verdict: delete, keep (consumer named), or fold-then-delete (AR-E10-8)

**Given** a `docs/` file holds a fact that is still true against the code and is not already in a loaded file
**When** it is folded
**Then** the fact lands once in the `CLAUDE.md` whose tree it describes (root, `bp_back/`, `bp_front/`, `routing/`) and is
checked against the cited source file; facts found false are dropped, not carried (AR-E10-9)

**Given** `docs/feedback.md`
**Then** it is kept as the backlog intake, and is the only file left in `docs/` unless the audit names another consumer

**Given** `project_knowledge` resolves to `{project-root}/docs` in the BMAD config
**When** `docs/` is reduced
**Then** `project_knowledge` still points at an existing directory whose content matches what BMAD skills expect from it,
changed through the supported config path (`_bmad/custom/` override or the installer config), and
`uv run _bmad/scripts/resolve_config.py --project-root .` shows the resolved value

**Given** a live planning document links to a deleted file
**When** the deletion is committed
**Then** the link is updated or removed in the same commit; historical records under `implementation-artifacts/` are not
rewritten (AR-E10-8), and `prd.md`, `architecture.md`, the Epic 9 spine, the `ux-epic-8` pair, `epics.md` and
`epics-archive.md` are kept (AR-E10-10)

**Given** the story ships no product code
**Then** `git diff --stat bp_front/src bp_front/e2e bp_back` is empty, and NFR17's E2E gate is deliberately not applicable —
recorded so its absence reads as a decision

### Story 10.9: The agent context files match the code

As md, and as every agent working in this repo,
I want `AGENTS.md` and the four `CLAUDE.md` files to say only what is true at HEAD, each fact once,
So that an agent follows current commands and conventions instead of stale or contradicting ones.

**Acceptance Criteria:**

**Given** Stories 10.1–10.8 have landed
**When** `AGENTS.md`'s managed `bmad:context` block is refreshed with `bmad-project-context`
**Then** its "Verified" line names the current HEAD and date, and content outside the markers is preserved

**Given** the root, `bp_back/`, `bp_front/` and `routing/` `CLAUDE.md` files
**When** each is checked line by line
**Then** every command is run or its target confirmed to exist (Gradle tasks, npm scripts, mise tasks, file paths, test ids,
ports), every version matches `libs.versions.toml` / `package.json` / Dockerfiles, and a table records each fixed or
deleted claim with the evidence (AR-E10-11)
**And** time-bound notes that no longer apply (e.g. the 2026-08-13 `./db/data` migration instructions, if the old bind
mount data is gone) are removed or reworded by md's ruling, not silently

**Given** a fact appears in more than one of these files
**When** duplication is resolved
**Then** it lives in the most specific file that loads where it is needed (per-directory over root, `CLAUDE.md` over
`AGENTS.md` for architecture and commands, as `AGENTS.md` itself states), and the others drop it

**Given** `mise.toml` and `.zed/tasks.json`
**When** any documented command changes
**Then** the two stay in sync (the `sync-zed-mise-tasks` skill), or the record states no task changed

**Given** the story ships no product code
**Then** `git diff --stat bp_front/src bp_front/e2e bp_back` is empty and NFR17 is recorded as not applicable
