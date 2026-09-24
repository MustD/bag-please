---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'epic9-story-9.1', 'epic9-story-9.2', 'epic9-story-9.3', 'epic9-story-9.4', 'epic9-story-9.5', 'epic9-story-9.6', 'epic9-story-9.7', 'epic9-story-9.8', 'epic9-story-9.9', 'epic9-story-9.10', 'epic9-story-9.11', 'epic9-story-9.12', 'step-03-create-stories', 'step-04-final-validation']
status: complete  # Epic 9 planned and validated 2026-09-15
inputDocuments:
  # Re-initialised from the template for Epic 9 on 2026-09-15 (md's choice). Epics 1–8 bodies are
  # verbatim in epics-archive.md; the previous requirements inventory is in git at b056451.
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-epic-9/ARCHITECTURE-SPINE.md
  # Reviewer-gate reports; every finding was folded into the final spine (see its .memlog.md).
  - _bmad-output/planning-artifacts/architecture/architecture-epic-9/reviews/review-rubric.md
  - _bmad-output/planning-artifacts/architecture/architecture-epic-9/reviews/review-currency.md
  - _bmad-output/planning-artifacts/architecture/architecture-epic-9/reviews/review-adversarial.md
  - _bmad-output/planning-artifacts/architecture.md
  # UX design contract (bmad-ux spine pair, status: current, verified 2026-09-09):
  - _bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - _bmad-output/implementation-artifacts/epic-8-retro-2026-09-11.md
  - docs/feedback.md
  # Shipped code is authoritative where it disagrees with a planning document. Spot-checked 2026-09-15:
  - bp_back/src/main/kotlin/com/bagplease/entity/user/gql/UserAdminApi.kt
  - bp_back/src/main/kotlin/com/bagplease/config/gql/ApplicationConfigApi.kt
  - bp_back/src/main/kotlin/com/bagplease/plugins/Migration.kt
  - bp_back/src/main/kotlin/com/bagplease/entity/category/CategoryService.kt
  - bp_back/src/main/resources/application.yaml
  - bp_front/src/components/AppShell.tsx
  - bp_front/src/components/StoreField.tsx
  - bp_front/src/components/ListFilters.tsx
  - bp_front/src/routes/ListDetailPage.tsx
---

# bag-please - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bag-please, decomposing the requirements from the PRD,
UX Design if it exists, and Architecture requirements into implementable stories.

**Epic set:** this file holds the live epic (**Epic 9 — User Feedback Pass**). Closed Epics 1–8 live verbatim in
[`epics-archive.md`](./epics-archive.md). The two files are one epic set — sprint planning must be run with **both**
(`--epic-file .../epics.md --epic-file .../epics-archive.md`), or the story keys for Epics 1–8 are reported as orphans
and dropped from `sprint-status.yaml`.

**Scope source:** `prd.md` → "Epic 9 — User Feedback Pass (Planned)", which maps `docs/feedback.md` items 1–6 and the
"Routed to Epic 9" index at the top of `deferred-work.md`.

## Requirements Inventory

### Functional Requirements

Every active FR in `prd.md`, condensed. **Bold** = new or amended for Epic 9 and stated in full; the rest are delivered
(Epics 1–8) and listed so a story can cite them without re-reading the PRD.

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
**FR13 (amended): Admin can view a list of all registered user accounts. The list is paginated: one page shows at most
20 users in a stable order (username, ascending), with controls to move between pages and a display of the total user
count. Creating or deleting a user keeps the admin on a valid page — deleting the only user on the last page moves back
one page.**
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

**User Feedback (new)**
**FR66: A regular user can send feedback — an idea, a feature request, or a problem — from any authenticated screen.
The account menu carries a Feedback entry that opens a form with a single free-text field (required, at most 2000
characters). Submitting stores the entry with the submitter's username and the submission time, confirms that it was
sent, and returns the user to the screen they came from; cancelling sends nothing. A user does not see, edit, or delete
feedback after sending it. The admin account's menu does not show the Feedback entry (FR56).**
**FR67: The admin can review user feedback in the admin area: all entries, newest first, each showing its text, the
submitter's username, and the submission time. Feedback text is displayed as plain text, never interpreted as markup.
The admin can delete an entry after explicit confirmation (as FR17 requires); deletion is permanent. This is the triage
point — the admin carries what is worth keeping into project planning outside the app, then deletes the entry; feedback
has no status, reply, or tagging in the app. Deleting a user account does not delete that user's feedback.**

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
**FR44 (amended): User can assign an item to zero, one, or several stores, since the same item can often be bought in
more than one place. Both the add-item and edit-item dialogs offer a multi-value store field that suggests stores derived
from existing item data and also accepts a new store name. Store names are trimmed; names differing only in letter case
count as the same store and are not held twice on one item. A store is thus recognised consistently across items — the
groundwork for showing only one store's items while shopping there (Phase 3). The shopping-view item row shows every
store the item carries, and all of them stay inside the row's single check target (FR60).**
FR45: Each item shows its `addedBy` username on the shopping-view row
FR54: An hourly scheduler restores recurring items whose cadence elapsed and hard-deletes one-timers soft-deleted over
an hour ago
FR58: Item save is a merge — `addedBy`, `checkedAt`, `deleted`/`deletedAt` survive; create vs update is decided by
whether the id exists on the target list; an id on a different list, or a category outside the target list, is rejected

**Data Scoping & Migration**
FR46: All new items and categories are associated with a list at creation
FR47: The one-time Epic 4 migration moves unscoped data to a default "Groceries" list, recorded in `app_migrations`
**FR56 (amended): The admin account is restricted only to user management, application configuration, and reviewing
user feedback (FR67); admin callers are rejected by all list-related GQL operations (`createList`, `lists`, `items`,
`categories`, `shareList`, `deleteList`, and all subscription operations); the admin cannot create, own, view, or be a
member of any list, and does not send feedback (FR66).**
**FR69 (new): No store data is lost when items move from one store to several (FR44): an item that had a store keeps it
as its only store, and an item without one has no stores. The conversion runs once, on the first startup of the release
that ships multi-store items, and does not re-run.**

**Navigation & UX**
FR48, FR49: *(Superseded — Epic 4 bottom-tab design that never shipped.)*
FR50: The lists index shows owned/member lists plus pending invites; a zero-lists state shows onboarding guidance
FR51: Item creation and editing happen in overlays without leaving the current view
**FR57 (amended): From any authenticated screen the user can return to the application home destination in one action:
the "Bag Please" app-bar title is a link to `/`, which delegates home resolution to the existing behaviour (the user's
oldest list by creation date, the lists index when they own none, the admin area for the admin account); the shopping
view additionally offers a back-to-lists affordance matching the list management screen's existing back link. No screen
is a navigational dead end requiring the browser back button. The account menu also carries a Home entry that goes to
the same destination as the title link, for users who look for navigation in the menu rather than on the title; on the
home route the Home entry simply closes the menu.**
FR59: The app is installable from Chrome on Android as a standalone WebAPK (manifest + PNG icons + service worker); no
offline capability
FR60: The whole shopping-view item row is one check target and one accessible control
**FR61 (amended): Item filtering and search are available on both list surfaces with the same controls and semantics:
a category filter accepting several categories (none selected = all) and a free-text name search, combined with AND;
the shopping view keeps its checked-status toggle, which is not added to the management screen. Empty categories show on
the management screen only when no filter or search is active; the shopping view always hides empty groups. The open
category menu covers most of a phone screen, so it carries an explicit confirm control that closes it; selections apply
as they are toggled, so confirming only closes and there is no cancel-and-revert. Tapping outside the menu or pressing
Escape still closes it too.**
FR62: Categories and their items are ordered by name identically on `/list/:id` and `/lists/:id`
FR63: A list member can rename a category from the management screen; the rename reaches other members in real time
**FR68 (new): The shopping view (`/list/:id`) offers a floating add button that adds an item to the list being viewed
without leaving the screen. It opens the same add-item dialog the list management screen uses (name, category, store(s)
per FR44) with the current list as the fixed target; the new item appears on the shopping view on save and reaches other
members in real time (FR52). The button stays reachable while scrolling and never permanently covers the last item row
or its controls. If the list has no categories yet, the dialog says a category is needed first and offers a way to the
list management screen.**

**Real-Time Collaboration & Authentication**
FR52: Item check-off, add, edit and delete reach other members' shopping views live via GraphQL subscription
FR53: WebSocket subscriptions require a valid JWT in `connectionParams`; the backend closes on expiry; the frontend
disposes the socket before clearing auth

**Epic 9 FR scope:** FR13, FR44, FR56, FR57, FR61 (amended); FR66, FR67, FR68, FR69 (new).
**Still deferred:** FR42, FR43 (not re-scoped by md). Phase 3 single-store shopping mode is not in Epic 9.

### NonFunctional Requirements

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

**Epic 9 NFR scope:** NFR17, NFR18, NFR64, NFR65 bind every story; NFR-L2 binds the category and user cascades (the
admin-gated purge is its single caller-less exception, AR-E9-8); NFR13–NFR15 bind the feedback and multi-store dialogs.

### Additional Requirements

From `ARCHITECTURE-SPINE.md` (Epic 9, final 2026-09-15), its inherited invariants, and the routed deferred work.
Identifiers are `AR-E9-n`; where one restates an architecture decision, the AD number is given.

**Starter template:** none — brownfield. No new dependency; the stack is pinned as of 2026-09-15 (Kotlin 2.4.10, Ktor
3.5.2, graphql-kotlin 10.2.1, Mongo driver 5.9.2, mongo:8, React 19.2.8, Apollo Client 4.2.11, MUI 9.3.1, TypeScript
6.0.3, Vite 8.2.1, Playwright 1.62.1, app 0.18.0). Epic 9 upgrades nothing.

**Inherited, binding on every story**
- AR-E9-0: Per-entity slice layout `entity/<name>/{Service,Storage,gql/,mongo/}`, one-way GQL → Service → Storage →
  Repository. One Apollo + `graphql-ws` client; the access token lives in memory only. Nothing under `/api` is cached
  or served as fallback by the service worker. Schema-changing stories regenerate codegen in the same story, never
  editing `__generated__/`; backend and frontend ship in one app version (`gradle.properties` = `package.json`).
- AR-E9-0a: Errors reuse `GraphQLForbiddenException` / `GraphQLInvalidInputException` / `GraphQLNotFoundException`; no
  new error envelope. Kotlin GraphQL classes are `Gql*` with `@GraphQLName`; migration ids are `epic<N>-<slug>`.
- AR-E9-0b: Backend rules are proven with Kotest + Testcontainers; every FR gets UI-driven E2E on both projects; 320px
  assertions cover `/admin`, the feedback dialog, the FAB and the multi-store row.

**Feedback slice (FR66, FR67, FR56)**
- AR-E9-1 (AD-1): New `entity/feedback/` — `Feedback`, `FeedbackService`, `mongo/FeedbackRepository` (collection
  `feedback`), `gql/FeedbackApi` — on the user/config pattern: no Storage cache, no SharedFlow, no subscription.
  Document: `_id` UUID stored as string (`UUIDSerializer`, filter with `id.toString()`), `text`, `username` (plain
  string copied from the principal, no user-id reference), `createdAt` Instant. User deletion never touches the
  collection. `com.bagplease.entity.feedback.gql` is added to the schema `packages` in `GQL.kt`.
- AR-E9-2 (AD-2): The two private `requireAdmin()` copies (verified in `UserAdminApi.kt` and `ApplicationConfigApi.kt`)
  become one `DataFetchingEnvironment.requireAdmin()` in new `plugins/GqlAuth.kt`, used by `UserAdminApi`,
  `ApplicationConfigApi` and `FeedbackApi`. `sendFeedback(text: String!): Boolean!` takes only text; the service
  rejects the admin (`caller != adminLogin`) with Forbidden, measures `text.trim().length` (UTF-16), rejects blank or
  >2000 with `GraphQLInvalidInputException`, stores the trimmed text, sets `username` from the principal and
  `createdAt` from the server clock. `feedback: [Feedback!]!` returns `createdAt` desc then `_id`, unpaginated;
  `deleteFeedback(id: ID!): ID!` returns the deleted id; both `requireAdmin()`. The client validates the same trimmed
  length with no raw `maxLength`, renders text only as React text nodes, confirms deletes with `ConfirmDialog`, and
  never re-sorts.

**Multi-store items (FR44, FR69, FR60) and check state**
- AR-E9-3 (AD-3): `stores: [String!]!` replaces `store` in every layer **in one story**: `Item.stores`,
  `MongoItem.stores = emptyList()`, `GqlItem.stores`, `ItemInput.stores`, both mappers, and `ItemRepository.save`,
  which writes `Updates.set("stores", …)` and `Updates.unset("store")` in one update. The same story ships the
  AR-E9-5 migration, removes `store` from the schema, updates every frontend document through the `ListItemFields`
  fragment, and updates the raw GraphQL in `e2e/item-editing.spec.ts`. `saveItem`'s update branch copies `name`,
  `category`, `stores`, `recurring`; check state goes through AR-E9-11.
- AR-E9-4 (AD-4): The server is the normalization authority: `trim()` each name, drop empties, dedupe by
  `lowercase(Locale.ROOT)` keeping first-occurrence casing and position; internal whitespace kept; applied on create
  and update. Identity is the lowercased key; stored casing is display data. `itemStoreSuggestions` returns one name
  per key — the lowest by (lowercase, then `compareTo`) — sorted in that order. The client mirror in
  `lib/lists/storeValue.ts` uses `trim()` + `toLowerCase()` (never locale variants), blocks duplicate keys, and treats a
  casing-only edit as a change; the server's result is authoritative. `STORE_MAX` per name stays client-side; a
  matching server check may be added without an AD.
- AR-E9-5 (AD-5): `configureMigration` runs `[epic4-list-seed, epic9-multi-store]` in order, each checking only its own
  `app_migrations` id — today the function returns early once `epic4-list-seed` is recorded (verified,
  `Migration.kt:33-35`), which would skip the new migration. `epic9-multi-store` processes item documents one at a
  time where `store` exists: `stores` = normalizer(`(existing stores ?: []) + [store]`) (null/blank adds nothing), then
  `store` is unset; completion record written last; runs before `configureGql`. Its test seeds legacy-only, `stores: []`
  plus a leftover `store`, null/blank/padded `store`, and already-converted documents, with `epic4-list-seed` recorded.
- AR-E9-5a: **Deploy rule:** the release carrying `epic9-multi-store` is preceded by a `mongodump` of the `db_data`
  database; rollback = restore the dump + run the previous image. Recorded in `docs/deployment-guide.md` by that story.
- AR-E9-11 (AD-11): One private `ItemService.applyCheckState(stored, checked, recurring, now)` used by `checkItem`,
  `uncheckItem` and `saveItem`'s update branch: checked + `ONE_TIME` → `deleted = true`, `deletedAt = now`; checked +
  recurring cadence → `checkedAt = stored.checkedAt ?: now` (also when only `recurring` changed); checked + no cadence
  → nothing stamped; unchecked → clear `checkedAt`, `deleted`, `deletedAt`. Every other server-owned field survives
  (FR58). Closes the Story 7.4 deferred entry (`checked = true` with null `checkedAt`).
- AR-E9-12 (carry-in, rides FR44): correct the four factually wrong comments in `EditItemDialog.tsx` (Story 7-4 review
  entry), and an orphaned item's edit dialog must no longer close silently when saved without touching the category
  (Story 8.5/8.6 entry).

**Admin users pagination (FR13) and E2E data hygiene**
- AR-E9-6 (AD-6): `users(limit: Int!, offset: Int, around: String): UserPage!` →
  `UserPage { users: [User!]!, totalCount: Int!, offset: Int! }`, sorted by `username` asc (binary collation). Server
  clamps `limit` 1..100 and `offset` 0..last page; `around` naming an existing username returns the page containing it.
  Frontend page size 20; `/admin` shows `totalCount`; after create query `around: <new username>`, after delete
  `offset: min(current, lastPage)`. `AdminUsersQuery` uses `cache-and-network`; every successful `createUser`/
  `deleteUser` runs `cache.evict({fieldName: 'users'})` + `cache.gc()`. The unpaginated `users` field is removed.
  Test ids: `admin-users-prev`, `admin-users-next`, `admin-users-page`, `admin-users-total`. E2E helpers act on a
  created user only on the page the create landed on — never page-walk.
- AR-E9-6a (carry-in D4): per-run E2E data hygiene is owed regardless of pagination (users table grows ~120 rows per
  run; `createUserViaUi` measured 5015 ms vs a 5000 ms budget at ~5.5k rows). Mechanism chosen at story level within
  NFR18; a retry loop is forbidden.
- AR-E9-6b (carry-in): the `/admin` username cell `noWrap` + `{xs: 140, sm: 260}` cap and the missing floor assertion on
  `/admin` ride FR13 — measure and fix or record, with an `expectNotClipped` assertion. `/lists` half is closed by md.

**Cascades (routed backend fixes)**
- AR-E9-7 (AD-7): `CategoryService.deleteCategory` checks membership, deletes the category through `CategoryStorage`,
  then calls `internal ItemService.deleteAllInCategory(listId, categoryId)`, removing every item in that category —
  **including `deleted = true` items** — from Mongo and the per-list storage map. The cascade emits **only** the
  category `DELETED` event (the item SharedFlow is one-slot `DROP_OLDEST`; per-item events would be dropped). Clients
  treat category `DELETED` as authoritative for its children and prune cached items of that category. The client-side
  item delete loop in `ListDetailPage` (verified at `:449-451`) is removed. `saveItem` rejects a category outside the
  target list on **both** create and update branches (existing message; retire the create-hole tripwire test);
  `uncheckItem` rejects an item whose category no longer exists; `AddItemDialog` maps that error the way
  `EditItemDialog` does. E2E: delete a category holding ≥5 items while a second member watches `/list/:id`.
- AR-E9-8 (AD-8): Only `ListService` writes `list_members` or `List.members`/`memberUsernames`.
  `UserAdminMutations.deleteUser` (after `requireAdmin()`) runs in order: (1) `UserService.adminDeleteUser`; (2)
  `ListService.purgeUser(userId, username)`; (3) `AuthService.invalidateUserSessions`. `purgeUser` is idempotent, the
  only caller-less list-mutating entry point, writes only through `ListStorage.save` and `ListMemberRepository`, removes
  every `list_members` row for the user in any status, strips them from non-owned lists' `members` (by id) and
  `memberUsernames` (by name), and **deletes lists they own with full cascade** (md, 2026-09-15 — not transferred)
  through a private `cascadeDeleteList(list)` that `deleteList` also calls. `DeleteUserDialog` (FR17) states the number
  of owned lists that will be deleted, from new `User.ownedListCount: Int!`. List deletion emits no subscription event;
  other members are redirected on their next Forbidden (Story 5.6), which is all the E2E asserts.

**Readiness (carry-in F20 / Story 7.12)**
- AR-E9-9 (AD-9): `get("/health")` inside `routing {}`, outside `authenticate` and any `rateLimit`, served at
  `/api/health` via `rootPath: "api"` (verified in `application.yaml`). Mongo `ping` inside `withTimeout(2.seconds)`:
  200 on success, 503 on any exception or timeout. Backend test through `testApplication` with the real config.
  `playwright.config.ts` `webServer.url` = `http://localhost:2080/api/health`. A compose healthcheck, if added, runs on
  `bp_front` with busybox `wget -qO- http://localhost/api/health`; no probe tool is added to the `bp_back` image. The
  service-worker `/api` denylist is unchanged. `webServer` teardown and stdout filtering are chosen at story level.

**Frontend composition**
- AR-E9-10 (AD-10): The FAB opens the existing `AddItemDialog` with the current `listId` — no second add dialog;
  `AddItemDialog` owns the no-categories guidance. `StoreField` becomes one multi-value component (`value: string[]`)
  used by both item dialogs. `AppShell` adds the Home and Feedback account-menu entries once; Home reuses
  `useHomePath('observe')` and the existing `alreadyHome` comparison; the existing Lists entry stays; Feedback is
  hidden for the `admin` role and opens a dialog rendered by `AppShell` (not a route) so the current screen stays
  mounted. Store chips stay non-interactive inside the FR60 row; test ids `shopping-item-stores-<item>` (container) and
  `shopping-item-store-<item>-<store>` (chip).
- AR-E9-10a (Frontend data convention): every operation returning an `Item` spreads one fragment, `ListItemFields`, in
  `lib/lists/listsQueries.ts`; `subscribeToMore` handlers use the generated fragment type. Admin operations live in
  `lib/admin/adminQueries.ts`; admin collections use `cache-and-network` + evict-on-mutation.
- AR-E9-13 (carry-in, rides FR57): the empty `/lists` dead end in the installed PWA is closed by the Home menu entry;
  `useHomePath`'s `if (error)` branch is gated on `mode === 'resolve'` / reordered after `!data` (unreachable-in-observe
  + branch-order entries). The cold-start home-link question is **closed as leave-as-is** (md, 2026-09-15): observe mode
  stays `cache-only`.
- AR-E9-14 (carry-in, rides FR61): F2 — a category explicitly selected in the filter stays rendered on `/lists/:id` even
  when empty (e.g. `keepEmpty || filter.categoryIds.includes(group.key)`), covered in the FR61 empty-category spec.
  F5 — resolved by **de-keying**: the synthetic `Uncategorized` bucket is keyed by a sentinel id, frontend-only;
  `saveCategory` gains no name rule.

**Small cleanups (own story, runs after the `AppShell` stories)**
- AR-E9-15: untrack `.idea/dataSources.xml` (or gitignore it); add `codegen.ts` to `tsconfig.node.json` `include`;
  sweep stale `./db/data` paths in `docs/deployment-guide.md` and `bp_front/e2e/` comments; drop the redundant trailing
  `Unit` in `UserService.changePassword`; gitignore `dev-dist/` (and ESLint ignores); delete dead `ListStorage.delete()`;
  delete the `custom.bp.*` theme tokens still unconsumed at that point (`bg2`, `card2`, `sheetBg`, `stripe` today) and
  their module-augmentation types, updating `DESIGN.md` §3/§11.2.

**Deferred by the architecture (not Epic 9 work):** Mongo transactions for cascades; username reuse within the token
window after deletion; feedback pagination and a `sendFeedback` rate limit; a max stores-per-item limit; Phase 3 store
mode; `/admin` page number in the URL; operational envelope beyond the pre-deploy `mongodump` and optional healthcheck.

### UX Design Requirements

UX source: the `ux-epic-8` spine pair (`DESIGN.md` + `EXPERIENCE.md`, `status: current`). It **describes** the deployed
app; Epic 9 is the first epic to change screens it documents, so its rulings bind and its descriptions must be kept true.

- UX-DR-E9-1: **No toast, no snackbar, no notification layer (UX-DR-E8-10 / UX-DR-E7-7 stand).** The architecture's
  "Notices" row ("existing snackbar pattern") is overruled by md (2026-09-15): no `Snackbar` exists in `src/`. The
  FR66 send confirmation and the FR67 delete result follow the existing inline idiom — a success confirmation is an
  in-flow `<Alert severity="success" role="status">` in the surface that caused it, the precedent being `/admin`'s
  reset-password confirmation (`AdminPage.tsx`, the only `role="status"` in `src/`). A failed send keeps the dialog open
  with the text intact and shows `feedback-error` inline, last inside `DialogContent`. A deleted feedback entry is
  confirmed by its row disappearing (state change confirmed by the UI changing).
- UX-DR-E9-2: **The feedback dialog follows the canonical form-dialog convention** (`CreateListDialog.tsx`): native
  `<form onSubmit noValidate>` so Enter submits (a multi-line field needs Ctrl/Cmd+Enter or the button — decide and
  test); validate on submit, errors clear on typing; same-tick re-entry guard; `graphqlErrorMessage(err)` inline;
  cancel disabled while in flight, submit shows `CircularProgress size={20}`; `fullWidth maxWidth="xs"`; a visible
  associated label and a character counter reflecting the trimmed length against 2000 (NFR13, NFR15). Test ids
  `feedback-dialog`, `feedback-text`, `feedback-cancel`, `feedback-submit`, `feedback-error`; the confirmation
  `feedback-sent`.
- UX-DR-E9-3: **Account menu gains Home and Feedback** (`AppShell` menu, today: Lists, Change password [non-admin],
  Admin [admin], Logout). Each is a `MenuItem` with a `ListItemIcon` at `fontSize="small"` from `@mui/icons-material`,
  test ids `menu-home` and `menu-feedback`. Order: Home first, then Lists, Change password / Admin, Feedback
  (non-admin only), Logout last. On the resolved home route the Home entry only closes the menu (no history entry).
  The app-bar title link's inert-but-present behaviour (AR-E7-8) is untouched.
- UX-DR-E9-4: **`/admin` gains a feedback panel** matching the existing panel shape — `Paper` with `p: {xs: 2, sm: 3}`,
  `h6` heading — and the standard branch order error → loading → empty → content with test ids `admin-feedback-error`,
  `admin-feedback-loading`, `admin-feedback-empty`, `admin-feedback-row-<id>` (keyed by id, not text). Each row shows
  the text as plain text with wrapping (no truncation of feedback text at 320px), the username and the submission time;
  a delete `IconButton` (`DeleteOutlined`, `color="error"`, `aria-label` naming the entry, `Tooltip`) opens
  `ConfirmDialog` as `delete-feedback-dialog` (`-confirm`/`-cancel`/`-error`).
- UX-DR-E9-5: **`/admin` users pagination** — prev/next controls with `aria-label`s, a page indicator and total count
  (AR-E9-6 test ids), usable at 320px with no horizontal overflow. `DeleteUserDialog` states how many owned lists will be
  deleted (AR-E9-8), naming the cascade in prose like the remove-category confirm does.
- UX-DR-E9-6: **Multi-value store field** in both item dialogs: selected stores as removable chips, suggestions from
  `itemStoreSuggestions`, free entry of a new name, case-insensitive duplicate prevention with the server authoritative.
  `StoreField` today is deliberately **not** an `Autocomplete` (its comment: avoid a second `role=combobox` inside the
  dialog) — the story must either keep that constraint or record why a combobox is now acceptable, and keep the
  `{testIdPrefix}` testid convention (`add-item-*`, `edit-item-*`). Fits and stays keyboard-operable at 320px.
- UX-DR-E9-7: **Shopping row shows every store, inside the closed row surface (FR60, AR-E8-8a).** Store chips are
  presentational, never affordances. **RULING (md, 2026-09-15), overriding AD-10's "accessible name" wording:** the
  row's accessible name stays exactly `` `Toggle ${item.name}` `` (`EXPERIENCE.md` §5.3.1); `Stores: A, B` goes in the
  row's accessible *description* beside `addedBy`, omitted when the item has no stores. Several stores must not push the check glyph or name off the row at 320px
  (`expectNotClipped`/`expectInsideViewport` on the multi-store row).
- UX-DR-E9-8: **Floating add button on `/list/:id` (FR68).** MUI `Fab` with the `Add` icon, `aria-label="Add item"`,
  test id `shopping-add-item-fab`, fixed bottom-right with safe-area inset, reachable while scrolling; the page reserves
  bottom padding so the FAB never permanently covers the last row or its controls; inside the viewport at 320px.
  **RULING (md, 2026-09-15) — amends the manage-vs-use ruling** (`/list/:id` was "read + check only"): adding an item is
  now also a shopping-view action; editing and deleting stay management-only. `EXPERIENCE.md` §4's table is updated by
  the FAB story. The shopping empty-state copy ("Add categories and items from the
  list management screen") must be revised to match: with categories but no items it points at the FAB.
- UX-DR-E9-9: **No-categories guidance in `AddItemDialog`** (FR68): when the list has no categories the dialog says a
  category is needed first and offers a link/button to `/lists/:id`; it does not render a disabled form.
- UX-DR-E9-10: **Category filter menu gets a confirm control (FR61).** Inside the `multiple` `Select` menu, a clearly
  labelled button (e.g. "Done", test id `filter-category-confirm`) that closes the menu; selections still apply live;
  outside tap and Escape still close; reachable without scrolling the menu at 320px (sticky at the menu bottom). The
  closed control keeps its text summary (UX-DR-E8-4). Mounted once in `ListFilters.tsx`, so both screens get it
  (NFR-E8-5 one-definition rule).
- UX-DR-E9-11: **Category-deleted pruning is visible, not ghosted.** When a category is deleted, its items disappear on
  other members' `/list/:id` via the category `DELETED` event, and on the deleting client's `/lists/:id` via its own
  mutation result/refetch. **RULING (md, 2026-09-15):** `/lists/:id` has **no subscription by design** (AR-E8-6), so
  AD-7's "on `/lists/:id` the handler removes cached items" applies to that screen's own delete-category mutation path
  (prune + refetch); no subscription is added there.
- UX-DR-E9-12: **The design contract is kept true.** Per `DESIGN.md` §13 and `EXPERIENCE.md` §14, every story that
  changes `App.tsx`, a route component, `AppShell.tsx`, `playwright.config.ts`, `lib/lists/*` or `theme.ts` re-runs the
  check block and corrects the documents in the same commit (menu table §1.1, `/admin` states §5.4, shopping states
  §5.3, manage-vs-use table §4, dialog list §8, testid conventions §9.2, token table §3).
- UX-DR-E9-13: **Visual language unchanged.** Dark-only theme, system font stack, three component overrides, outlined
  icons for destructive/secondary actions, `color="error"` on destructive controls, `aria-label` on every icon-only
  control. Epic 9 adds no palette key and no theme override.

### FR Coverage Map

**Epic 9 (live):**

FR13: Epic 9 — server-paginated `users(limit, offset, around)` → `UserPage`, `/admin` pager + total (AR-E9-6)
FR44: Epic 9 — `stores: [String!]!` in every layer, server normalizer, multi-value `StoreField`, stores on the shopping row
FR56: Epic 9 — feedback review added to the admin's scope; `sendFeedback` rejects the admin; shared `requireAdmin`
FR57: Epic 9 — Home entry in the `AppShell` account menu (+ `/lists` dead end, `useHomePath` branch order)
FR61: Epic 9 — confirm control in the category filter menu (+ F2 selected-empty category, F5 de-keyed `Uncategorized`)
FR66: Epic 9 — Feedback menu entry + `AppShell`-hosted dialog + `sendFeedback` into `entity/feedback`
FR67: Epic 9 — `/admin` feedback panel, `feedback` query, `deleteFeedback` behind `ConfirmDialog`
FR68: Epic 9 — floating add button on `/list/:id` opening the existing `AddItemDialog`
FR69: Epic 9 — `epic9-multi-store` migration, independent of `epic4-list-seed`
NFR17, NFR18, NFR64, NFR65: Epic 9 — every story (production artifact, UI-driven, desktop + 320px floor)
NFR-L2: Epic 9 — category cascade stays membership-checked; `purgeUser` is the single admin-gated caller-less exception

**Delivered (Epics 1–8, bodies in `epics-archive.md`):**

Epic 1: FR1–FR12, FR18, FR24–FR29, FR33
Epic 2: FR13 (unpaginated original), FR14–FR17, FR19–FR23, FR30–FR32
Epic 4: FR34–FR41, FR45–FR47, FR50–FR56, NFR-L1–NFR-L5 (FR44 single store, FR56 admin block)
Epic 6: FR57 (app-bar home link, back-to-lists), FR44 store write path, FR40 edit verb
Epic 7: FR58, FR59; FR38/FR40/FR45/FR54/FR57 restored
Epic 8: FR60, FR61 (original), FR62, FR63, NFR64/NFR65 (as NFR-E8-1/-2)

**Deferred:** FR42, FR43 (not re-scoped). **Superseded:** FR48, FR49.

## Epic List

### Epic 9: User Feedback Pass

Users can tell the admin what they want from inside the app, and the admin can read and clear it. Items carry every
store they are sold in, with no existing store lost. An item can be added from the shopping screen without leaving it.
The category filter menu can be closed on a phone, Home is in the account menu, and the admin's user list is
paginated. Underneath, deleting a category or a user no longer leaves orphaned data behind, and the E2E gate waits for
a backend that is actually ready.

**FRs covered:** FR13, FR44, FR56, FR57, FR61 (amended); FR66, FR67, FR68, FR69 (new)
**NFRs binding every story:** NFR17, NFR18, NFR64, NFR65; NFR-L2 on the cascades; NFR13–NFR15 on the new dialogs
**Carries:** AR-E9-0 … AR-E9-15, UX-DR-E9-1 … UX-DR-E9-13, and the "Routed to Epic 9" deferred-work index
**Source:** `docs/feedback.md` items 1–6 (md's own use plus other users' feedback relayed by md)

**Why one epic (md, 2026-09-15).** The architecture spine is final with every open question ruled and the UX contract
describes the shipped app, so no early feedback could redirect later work. The two candidate halves (feedback/admin vs
shopping/items) share their core files — `AppShell.tsx` (Home + Feedback), `AdminPage.tsx` (pagination + feedback
panel), `UserAdminApi` (shared `requireAdmin` + purge), `AddItemDialog` (stores + FAB + category error) and
`ItemService` (stores + `applyCheckState` + cascade) — and the project ships one branch, one retro and one app version
per epic.

**Ordering constraints for story creation:**

1. The health endpoint (AR-E9-9) lands first: every later story is verified against a gate that today can abort on a
   cold start (F20).
2. Pagination with D4 data hygiene (AR-E9-6, -6a) lands early: the `createUserViaUi` flake grows with every suite run.
3. The category cascade (AR-E9-7) lands before or with the FAB: its `saveItem` create-branch category check is what
   stops the FAB creating items in a just-deleted category.
4. The multi-store change (AR-E9-3/-4/-5/-11/-12) is one indivisible story: schema, mappers, repository, migration,
   codegen and E2E GraphQL ship together in one app version.
5. Small cleanups (AR-E9-15) run last, after every `AppShell` story, so only still-unconsumed tokens are deleted.

**Rulings recorded at epic design (md, 2026-09-15):** the shopping row keeps its accessible name and carries stores in
its description (UX-DR-E9-7); `/lists/:id` prunes a deleted category's items via its own mutation path, having no
subscription (UX-DR-E9-11); adding an item joins checking as a shopping-view action, editing and deleting stay
management-only (UX-DR-E9-8).

---

## Epic 9: User Feedback Pass

Users can tell the admin what they want from inside the app, and the admin can read and clear it; items carry every
store they are sold in; an item can be added from the shopping screen; the category filter menu can be closed on a
phone; Home is in the account menu; the admin's user list is paginated. Deleting a category or a user no longer leaves
orphaned data, and the E2E gate waits for a ready backend.

**Delivers:** FR13, FR44, FR56, FR57, FR61, FR66, FR67, FR68, FR69 · AR-E9-0 … AR-E9-15 · UX-DR-E9-1 … UX-DR-E9-13

**Binding on every story below:** the inherited slice layout, error classes and naming (AR-E9-0, AR-E9-0a); backend
rules proven with Kotest + Testcontainers (AR-E9-0b); E2E against the production artifact on desktop **and** the 320px
floor, UI-driven (NFR17, NFR18, NFR64, NFR65); every new test observed failing before it is accepted; schema changes regenerate codegen
in the same story; no toast or snackbar (UX-DR-E9-1); `DESIGN.md` / `EXPERIENCE.md` corrected in the same commit as any
screen they describe (UX-DR-E9-12); each routed `deferred-work.md` entry a story discharges is closed in place by that
story; `sprint-status.yaml` reconciled at story close.

### Story 9.1: The test run waits until the backend is ready

As md, the developer running the E2E gate,
I want the suite to start only once the backend and its database actually answer,
So that a cold start never aborts the gate with zero tests run.

**Acceptance Criteria:**

**Given** the stack is running and MongoDB is reachable
**When** a client sends `GET /api/health` with no credentials
**Then** the response is `200`
**And** the route is declared as `get("/health")` outside `authenticate` and any `rateLimit`, served at `/api/health`
through `rootPath: "api"` (AR-E9-9)

**Given** MongoDB is unreachable, or its `ping` does not answer within 2 seconds
**When** a client sends `GET /api/health`
**Then** the response is `503`, returned after at most the 2-second timeout rather than a hang

**Given** a Kotest `testApplication` test using the real application config
**When** it requests `/api/health` with Mongo up and with Mongo down
**Then** it observes `200` and `503` respectively

**Given** a machine with no bag-please containers running
**When** md runs `npm run test:e2e`
**Then** Playwright waits on `http://localhost:2080/api/health` and the suite executes, with no
`Process from config.webServer exited early` abort
**And** a compose startup failure surfaces its output promptly instead of silently running out the webServer timeout
**And** the teardown and stdout-filtering choices are recorded in the story spec

**Given** the service worker's `/api` denylist
**When** `/api/health` is requested through Caddy
**Then** it reaches Ktor (never a service-worker fallback), and no probe tool is added to the `bp_back` image

**And** the deferred-work entries for Epic 8 retro F20, the Epic 5 "Playwright `webServer` gaps", the Story 7.1 review
cold-start finding and the Story 7.12 missing health endpoint are closed in place

### Story 9.2: The admin's user list is paged instead of growing forever

As the admin,
I want the users table to show at most 20 accounts per page with a total count,
So that `/admin` stays fast and usable however many accounts exist.

**Acceptance Criteria:**

**Given** 45 regular users exist
**When** the admin opens `/admin`
**Then** the table shows the first 20 users ordered by username ascending
**And** `admin-users-total` shows 45, `admin-users-page` shows the current page, `admin-users-prev` is disabled and
`admin-users-next` is enabled (FR13, UX-DR-E9-5)

**Given** the admin is on page 1 of 3
**When** they activate next twice and then previous
**Then** they see page 2, then page 3 holding the remaining 5 users, then page 2 again

**Given** the backend
**When** `users(limit, offset, around)` is called
**Then** it returns `UserPage { users, totalCount, offset }` sorted by username with Mongo's default binary collation
**And** `limit` is clamped to 1..100, `offset` to 0..last page, and an `around` naming an existing username returns the
page containing that user with that page's `offset`
**And** a non-admin caller is rejected with Forbidden, and the unpaginated `users` field no longer exists in the schema
**And** Kotest covers the ordering, both clamps and `around` (AR-E9-6)

**Given** the admin creates a user whose name sorts onto a different page
**When** the create succeeds
**Then** the table shows the page containing the new row (queried with `around`) and the total increases by one

**Given** the admin is on the last page, which holds a single user
**When** they delete that user
**Then** the table moves back one page and the total decreases by one
**And** after any create or delete no stale or shifted cached rows are shown (`cache-and-network`, `users` evicted and
garbage-collected on every successful mutation)

**Given** the E2E helpers that create and act on users
**When** they run
**Then** they act on a created user only on the page the create landed on and never walk pages

**Given** the suite has run many times against the same persistent database
**When** it runs again
**Then** the create-user flow's timing does not depend on how many users earlier runs left behind (Epic 7 action D4,
AR-E9-6a)
**And** the mechanism stays within NFR18, uses no retry loop, is recorded in the spec, and D4's status is updated in
`sprint-status.yaml`

**Given** the 320px phone project and a user with a 42-character username
**When** `/admin` renders
**Then** the page does not overflow horizontally and the pager controls are fully inside the viewport
**And** the username cell is either not clipped (`expectNotClipped`) or its clipping is measured and recorded as a kept
decision (AR-E9-6b)

**And** the routed deferred-work entries this story discharges are closed in place: Epic 7 close-out "`AdminUsers` is
unpaginated", the Stories 7.8 + 7.9 `createUserViaUi` size-driven flake, and the `/admin` halves of the Story 8.2 entry
and its review

### Story 9.3: Deleting a category deletes its items for everyone

As a list member,
I want removing a category to remove every item in it on the server,
So that no item is left orphaned on anyone's screen.

**Acceptance Criteria:**

**Given** a category holding five items, one of them soft-deleted (`deleted = true`)
**When** a member deletes the category
**Then** the category and all six items are gone from MongoDB and from the per-list storage cache (AR-E9-7)
**And** Kotest asserts the soft-deleted item is included

**Given** a caller who is not a member of the list
**When** they call `deleteCategory`
**Then** it is rejected and nothing is deleted (NFR-L2)

**Given** member B is watching `/list/:id`
**When** member A deletes a category holding at least 5 items from `/lists/:id`
**Then** B's screen shows neither that category's group nor any of its items, without a reload (UX-DR-E9-11)
**And** the server emits exactly one category `DELETED` event and no per-item events

**Given** member A on `/lists/:id`
**When** A confirms the category removal
**Then** the category card and its items disappear from A's screen
**And** the handler sends one `deleteCategory` request and no `deleteItem` requests (the client loop is gone)

**Given** a `saveItem` **create** whose category does not belong to the target list
**When** it is sent
**Then** it is rejected with the existing message, nothing is created and no `SAVED` event is emitted
**And** the create-hole tripwire test is retired

**Given** an item whose category no longer exists
**When** a member calls `uncheckItem` on it
**Then** it is rejected

**Given** `AddItemDialog` is open on a category that another member deletes
**When** the user submits
**Then** the dialog stays open with the mapped message in `add-item-error`, the same path `EditItemDialog` uses

**And** orphans already in the data still appear in the `Uncategorized` group with their edit and remove controls
**And** the Story 8.5 "orphan CAUSE" deferred-work entry is closed in place

### Story 9.4: Deleting a user leaves no phantom memberships

As the admin,
I want deleting a user to remove them from every list and delete the lists they own, after telling me how many,
So that no phantom member and no ownerless list is left behind.

**Acceptance Criteria:**

**Given** user U owns two lists, is an accepted member of list L owned by V, and has a pending invite to list M
**When** the admin opens the delete dialog for U
**Then** the dialog states that U's 2 lists will be deleted with their items and categories, read from
`User.ownedListCount` (FR17, AR-E9-8, UX-DR-E9-5)

**Given** that dialog
**When** the admin confirms
**Then** U's user record is gone and every `list_members` row for U, in any status, is gone
**And** U no longer appears in L's `members` or `memberUsernames`
**And** both lists U owned are deleted with all their items and categories
**And** U's sessions are invalidated

**Given** the delete sequence
**When** it runs
**Then** `adminDeleteUser` runs before `purgeUser`, so a `createList` or `acceptInvite` by U after the first step fails
with `CallerNotFound`
**And** Kotest covers the order

**Given** a user already purged
**When** `purgeUser` runs again
**Then** it changes nothing and raises no error
**And** it writes only through `ListStorage.save` and `ListMemberRepository`, so V's Share dialog stops listing U
without a restart

**Given** `deleteList` and the purge
**When** either deletes a list
**Then** both go through the one private `cascadeDeleteList`, and the existing `deleteList` tests stay green

**Given** V is a member of a list U owned and has it open
**When** U is deleted
**Then** V's next data access to that list redirects V to `/lists` (Story 5.6), and no subscription event is emitted

**And** a non-admin caller cannot delete a user
**And** the Story 7-6 review "user deletion strands `list_members`" entry is closed in place

### Story 9.5: Checking an item through an edit keeps the scheduler working

As a list member with recurring items,
I want an item that becomes checked by any path to carry the check-off time the scheduler reads,
So that a recurring item is always restored on its cadence.

**Acceptance Criteria:**

**Given** `ItemService`
**When** `checkItem`, `uncheckItem` or `saveItem`'s update branch changes check state
**Then** all three go through one private `applyCheckState(stored, checked, recurring, now)` (AR-E9-11)

**Given** a weekly item that was never checked (`checkedAt` null)
**When** a `saveItem` update sends `checked: true`
**Then** `checkedAt` is set to now
**And** a scheduler run seven days later restores it (Kotest with a controlled clock)

**Given** a checked weekly item with `checkedAt` T
**When** a save changes only its name, or only its `recurring` value
**Then** `checkedAt` stays T

**Given** a checked one-time item
**When** its check state is applied
**Then** `deleted = true` and `deletedAt = now`

**Given** a checked item with no cadence
**When** its check state is applied
**Then** nothing is stamped

**Given** any item
**When** it becomes unchecked by any path
**Then** `checkedAt`, `deleted` and `deletedAt` are cleared

**And** `addedBy` and every other server-owned field survive, and the existing FR58, `checkItem` and `uncheckItem` tests
stay green
**And** the four factually wrong comments in `EditItemDialog.tsx` are rewritten to describe the merge and
`applyCheckState`, with no change to the dialog's behaviour or its `checked`/`recurring` carry-forward (AR-E9-12)
**And** the Story 7.4 `checkedAt` entry and the Story 7-4 review comments entry are closed in place

### Story 9.6: An item can be in several stores

As a list member,
I want to give an item every store it can be bought in,
So that I recognise it whichever store I am shopping in.

**Acceptance Criteria:**

**Given** the add-item dialog or the edit-item dialog
**When** the user enters "Lidl", then " lidl ", then "Aldi"
**Then** the field holds exactly Lidl and Aldi, because the duplicate by case-insensitive key is refused (FR44)
**And** it offers suggestions from `itemStoreSuggestions`, accepts a new name, and removes a store individually
**And** it has a visible associated label and is fully keyboard-operable (NFR13, NFR14)
**And** the spec records whether `StoreField` keeps its no-second-combobox constraint or why it no longer applies
(UX-DR-E9-6)

**Given** a save sending stores `[" Lidl ", "lidl", "", "Aldi Nord"]`
**When** the server processes it, on create or update
**Then** the item stores `["Lidl", "Aldi Nord"]` (AR-E9-4)
**And** an edit that only changes "Lidl" to "LIDL" is saved
**And** `itemStoreSuggestions` returns one name per key, the lowest by (lowercase, then `compareTo`), in that order

**Given** the schema and data layers
**When** the story ships
**Then** `stores: [String!]!` exists on `Item` and `ItemInput` and `store` exists nowhere in the schema
**And** `ItemRepository.save` sets `stores` and unsets `store` in one update
**And** every frontend document returning an item spreads `ListItemFields`, codegen is regenerated, and the raw GraphQL
in `e2e/item-editing.spec.ts` is updated (AR-E9-3, AR-E9-10a)

**Given** a database with `epic4-list-seed` recorded and items with: a legacy `store` "Lidl"; `store` " lidl " plus
`stores` ["LIDL"]; a null `store`; a blank `store`; and an already converted item
**When** the application starts
**Then** each item's `stores` is the normalizer's result of its existing stores plus its `store`, no item keeps a
`store` field, and `epic9-multi-store` is recorded last (FR69, AR-E9-5)
**And** a second start changes nothing, and a fresh database starts cleanly

**Given** an item with stores A and B on `/list/:id`
**When** the row renders
**Then** both stores are shown inside the row as non-interactive chips (`shopping-item-stores-<item>`,
`shopping-item-store-<item>-<store>`)
**And** activating anywhere on the row, chips included, toggles it (FR60)
**And** its accessible name is exactly `Toggle <name>` and its description includes `Stores: A, B`; an item with no
stores has no stores segment (UX-DR-E9-7)

**Given** the 320px phone project and an item with three long store names
**When** the shopping view renders
**Then** the page does not overflow horizontally and the row's check glyph and name stay inside the viewport

**Given** member A changes an item's stores
**When** member B is watching `/list/:id`
**Then** B sees the new stores without a reload

**Given** an orphaned item in the `Uncategorized` group
**When** the user opens its edit dialog and saves without choosing a category
**Then** the dialog does not close silently: it stays open and says a category must be chosen, and nothing is saved
(AR-E9-12)

**And** `gradle.properties` and `package.json` carry the same bumped version
**And** `docs/deployment-guide.md` records the pre-deploy `mongodump` of `db_data` and the rollback procedure (AR-E9-5a)
**And** the Story 8.5/8.6 orphan-dialog entry is closed in place

### Story 9.7: Home is in the account menu

As a user,
I want a Home entry in the account menu,
So that I can get home from the place I look for navigation.

**Acceptance Criteria:**

**Given** a regular user or the admin on an authenticated screen that is not their home
**When** they open the account menu and choose `menu-home`
**Then** they land on the same destination as the app-bar title link — the oldest list, `/lists` for a user with none,
or `/admin` for the admin (FR57)

**Given** the user is already on their resolved home route
**When** they choose `menu-home`
**Then** the menu closes and neither the URL nor `history.length` changes

**Given** the account menu
**When** it opens
**Then** its entries are, in order: Home, Lists, Change password (non-admin) or Admin (admin), Logout
**And** Home carries a small `@mui/icons-material` icon and is reachable and activatable by keyboard (UX-DR-E9-3)

**Given** a user with no lists on `/lists` in the installed app
**When** they open the menu
**Then** Home and Lists are both available, so the screen is not one menu away from a dead end

**Given** `useHomePath` in observe mode while the lists query is failing
**When** the app bar renders
**Then** the error branch does not fire in observe mode (gated on resolve mode, after the `!data` check), so the title
link stays live, while `HomeRedirect` in resolve mode still resolves to `/lists` (AR-E9-13)

**And** the title link's inert-but-present behaviour and its existing tests are unchanged, and observe mode stays
`cache-only` (md, 2026-09-15)
**And** `EXPERIENCE.md` §1.1's menu table and §3 are updated, and the Story 7.5, 7-5 review and epic-7-context
`useHomePath` entries are closed in place

### Story 9.8: The category filter menu can be closed on a phone

As a user filtering a list on my phone,
I want a Done button inside the category menu,
So that I can close a menu that covers most of the screen.

**Acceptance Criteria:**

**Given** the category filter menu is open on `/list/:id` or `/lists/:id` at 320px, on a list with 30 categories
**When** the menu renders
**Then** `filter-category-confirm` is fully visible without scrolling the menu (FR61, UX-DR-E9-10)

**Given** the open menu
**When** the user toggles categories
**Then** the list behind the menu filters as each is toggled

**Given** the user has selected two categories
**When** they activate `filter-category-confirm`
**Then** the menu closes, both selections remain applied, and focus returns to the category control

**Given** the open menu
**When** the user taps outside it or presses Escape
**Then** it closes and nothing is reverted

**And** the confirm control is defined once in `ListFilters.tsx` and appears on both screens

**Given** `/lists/:id` with an empty category "Zzz Empty" and a stocked category "Bakery"
**When** the user filters to "Zzz Empty" only
**Then** its card and its add-item affordance are shown (F2, AR-E9-14)
**And** empty categories that are not selected stay hidden while filtering, and the shopping view still hides empty
groups

**Given** a real category named "Uncategorized" and an orphaned item on the same list
**When** either screen renders
**Then** both groups render and the synthetic bucket's testids come from its sentinel key, so no locator matches two
elements (F5)
**And** `saveCategory` gains no name rule

**And** the Epic 8 retro F2 and F5 deferred-work entries are closed in place

### Story 9.9: A user can send feedback from any screen

As a regular user,
I want to send an idea, a request or a problem from wherever I am in the app,
So that the admin hears about it without me leaving what I was doing.

**Acceptance Criteria:**

**Given** a regular user on any authenticated screen
**When** they choose `menu-feedback` in the account menu
**Then** `feedback-dialog` opens over the current screen and the route does not change (FR66, UX-DR-E9-3)

**Given** the feedback dialog with text entered
**When** the user submits
**Then** a `feedback` document is stored with the trimmed text, the username from the caller's principal, and the
server's time (AR-E9-1, AR-E9-2)
**And** the dialog closes, the user is on the same screen with its state (e.g. active filters) intact, and an in-flow
`role="status"` confirmation `feedback-sent`, rendered by `AppShell`, says the feedback was sent (UX-DR-E9-1)

**Given** the text is empty or only whitespace
**When** the user submits
**Then** an inline field error is shown and nothing is sent

**Given** text whose trimmed length is exactly 2000
**When** submitted
**Then** it is accepted
**And** at 2001 trimmed characters the client blocks it with a field error and the server independently rejects it with
`GraphQLInvalidInputException`

**Given** the dialog
**When** the user cancels
**Then** nothing is sent

**Given** the server fails the send
**When** the user submits
**Then** the dialog stays open with the text intact and the reason in `feedback-error`

**Given** a regular user's account menu
**When** it opens
**Then** Feedback appears after Change password and before Logout, with a small icon, reachable by keyboard
(UX-DR-E9-3)

**Given** the admin account
**When** its account menu opens
**Then** there is no Feedback entry
**And** an admin call to `sendFeedback` is rejected with Forbidden and stores nothing (FR56)

**And** `sendFeedback` takes only `text`, so a client cannot set the author or the time
**And** Kotest covers admin rejection, trimmed UTF-16 length bounds, the stored fields and the string `_id`
**And** the dialog follows the canonical form-dialog conventions with `feedback-*` testids (UX-DR-E9-2) and fits at
320px with its actions inside the viewport

### Story 9.10: The admin reviews and clears feedback

As the admin,
I want to read all feedback newest first and delete what I have triaged,
So that the admin area is where user feedback gets turned into planning.

**Acceptance Criteria:**

**Given** the backend admin checks
**When** the story ships
**Then** one `DataFetchingEnvironment.requireAdmin()` lives in `plugins/GqlAuth.kt` and `UserAdminApi`,
`ApplicationConfigApi` and `FeedbackApi` all use it, with the two private copies removed (AR-E9-2)
**And** the existing admin tests stay green

**Given** three feedback entries sent at different times
**When** the admin opens `/admin`
**Then** the feedback panel lists them newest first, each with its text, the submitter's username and the submission time
(FR67, UX-DR-E9-4)

**Given** feedback text containing `<b>bold</b>` and `**markdown**`
**When** it is shown
**Then** the characters appear literally, never interpreted as markup

**Given** a long multi-line entry at 320px
**When** the panel renders
**Then** the text wraps without horizontal overflow or clipping

**Given** no feedback, a pending query, or a failed query
**When** the panel renders
**Then** it shows `admin-feedback-empty`, `admin-feedback-loading` or `admin-feedback-error` respectively

**Given** an entry
**When** the admin activates its delete control and confirms in `delete-feedback-dialog`
**Then** the entry disappears from the panel and from the database
**And** cancelling keeps it, a failed delete keeps the dialog open with `delete-feedback-dialog-error`, and deleting an
id that does not exist is reported as not found rather than silently succeeding

**Given** a regular user
**When** they call `feedback` or `deleteFeedback`
**Then** both are rejected with Forbidden

**Given** user U has sent feedback
**When** the admin deletes U
**Then** U's feedback is still listed with U's username

**And** the feedback query uses `cache-and-network` with the collection evicted on delete, codegen is regenerated, and
`EXPERIENCE.md` §5.4 is updated

### Story 9.11: An item can be added from the shopping screen

As a list member shopping,
I want an add button on the shopping screen,
So that I can add something I just remembered without going to list management.

**Acceptance Criteria:**

**Given** a member on `/list/:id` for a list with categories
**When** they activate `shopping-add-item-fab`
**Then** the existing `AddItemDialog` opens with that list as the fixed target, with no list choice (FR68, AR-E9-10)

**Given** the dialog filled with a name, a category and two stores
**When** the member saves
**Then** the item appears on the shopping view without a reload
**And** another member watching the same list sees it without a reload (FR52)

**Given** a list long enough to scroll, on desktop and at 320px
**When** the member scrolls to the bottom
**Then** the button stays visible throughout
**And** the last item row can be fully seen and activated, not covered by the button

**Given** a list with no categories
**When** the member activates the button
**Then** the dialog says a category is needed first and offers a link to `/lists/:id`, without rendering a form to submit
(UX-DR-E9-9)

**Given** a list with categories but no items
**When** the shopping view shows its empty state
**Then** the copy points the member at the add button
**And** a list with no categories keeps the list-management guidance

**Given** the button
**When** inspected
**Then** it has the accessible name "Add item", is reachable by keyboard, and sits inside the viewport at 320px

**And** row check-off, filters and the list switcher behave as before
**And** `EXPERIENCE.md` §4 and §5.3 record adding as a shopping-view action (md's ruling, UX-DR-E9-8)

### Story 9.12: Small cleanups

As md, maintaining the repository,
I want the routed hygiene items fixed,
So that tooling, docs and theme stop carrying traps and dead weight.

**Acceptance Criteria:**

**Given** the repository
**When** `git ls-files .idea/dataSources.xml` runs
**Then** it returns nothing, and the file is ignored

**Given** `tsconfig.node.json`
**When** `tsc -b` runs
**Then** `codegen.ts` is type-checked

**Given** `docs/` and `bp_front/e2e/`
**When** they are searched for `./db/data`
**Then** no stale path remains; they describe the `db_data` named volume

**Given** a forced backend compile
**When** it runs
**Then** no `Expression is unused` warning is emitted for `UserService.changePassword`

**Given** `.gitignore` and the ESLint `ignores`
**When** read
**Then** both list `dev-dist/`

**Given** the backend
**When** it is searched
**Then** `ListStorage.delete()` no longer exists and the build passes

**Given** `theme.ts` after every `AppShell` story has landed
**When** `custom.bp.*` consumers are counted
**Then** every token with no consumer is removed together with its module-augmentation type
**And** `DESIGN.md` §3 and §11.2 are updated

**And** `npm run lint`, `npm run build`, the backend tests and the full E2E suite pass
**And** each discharged deferred-work entry (F19b, `codegen.ts`, `./db/data`, trailing `Unit`, `dev-dist/`,
`ListStorage.delete()`, `custom.bp.*` tokens) is closed in place
