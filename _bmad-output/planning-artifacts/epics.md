---
status: final  # Epic 11 planned and validated 2026-10-22
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  # Re-initialised from the template for Epic 11 on 2026-10-22 (md's choice). Epics 1–10 bodies are
  # verbatim in epics-archive.md; the Epic 10 requirements inventory is in git at 8f64c42.
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/addendum.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/architecture/architecture-epic-11/ARCHITECTURE-SPINE.md
  # Spine reviews (findings were folded into the spine on 2026-10-22; the ones still open are listed below):
  - _bmad-output/planning-artifacts/architecture/architecture-epic-11/reviews/review-adversary.md
  - _bmad-output/planning-artifacts/architecture/architecture-epic-11/reviews/review-reconcile.md
  - _bmad-output/planning-artifacts/architecture/architecture-epic-11/reviews/review-rubric.md
  - _bmad-output/planning-artifacts/architecture/architecture-epic-11/reviews/review-versions.md
  # Reference implementation for the Terraform and deploy stories (md's own project, same edge):
  - /home/md/projects/personal/mal_ui/deploy/
  - /home/md/projects/personal/mal_ui/mise.toml
  # UX design contract deliberately excluded (md, 2026-10-22): Epic 11 changes no UI (FR70).
---

# bag-please - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bag-please, decomposing the requirements from the PRD,
UX Design if it exists, and Architecture requirements into implementable stories.

**Epic set:** this file holds the live epic (**Epic 11**). Closed Epics 1–10 live verbatim in
[`epics-archive.md`](./epics-archive.md). The two files are one epic set — sprint planning must be run with **both**
(`--epic-file .../epics.md --epic-file .../epics-archive.md`), or the story keys for Epics 1–10 are reported as orphans
and dropped from `sprint-status.yaml`.

**Scope source:** md, 2026-10-21 (PRD "Epic 11 — PostgreSQL and a DigitalOcean Deployment"), with the technical choices
in `addendum.md` and every decision settled in the Epic 11 architecture spine (AD-1 … AD-20, final 2026-10-22). A
platform change with no user-visible behaviour change: every existing FR keeps holding. Production has 2 real users;
their data carries over.

## Requirements Inventory

### Functional Requirements

Every active FR in `prd.md`, condensed. **Bold** = new for Epic 11 and stated in full; the rest are delivered
(Epics 1–10) and listed so a story can cite them without re-reading the PRD. In Epic 11 they are the regression
surface: every one must behave exactly as before on PostgreSQL (FR70).

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
FR23: Configuration is persisted as a runtime entity in the database (the `app_config` row after Epic 11)

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
FR47: *(History after Epic 11.)* The one-time Epic 4 migration moved unscoped data to a default "Groceries" list,
recorded in `app_migrations`; not carried forward (AD-5)
FR56: The admin account is restricted only to user management, application configuration, and reviewing
user feedback (FR67); admin callers are rejected by all list-related GQL operations (`createList`, `lists`, `items`,
`categories`, `shareList`, `deleteList`, and all subscription operations); the admin cannot create, own, view, or be a
member of any list, and does not send feedback (FR66).
FR69: *(History after Epic 11; not carried forward, AD-5.)* No store data is lost when items move from one store to several (FR44): an item that had a store keeps it
as its only store, and an item without one has no stores. The conversion runs once, on the first startup of the release
that ships multi-store items, and does not re-run.

**Navigation & UX**
FR48, FR49: *(Superseded — Epic 4 bottom-tab design that never shipped.)*
FR50: The lists index shows owned/member lists plus pending invites; a zero-lists state shows onboarding guidance
FR51: Item creation and editing happen in overlays without leaving the current view
FR57: From any authenticated screen the user can return to the application home destination in
one action: the "Bag Please" app-bar title is a link to `/`, which delegates home resolution to the existing behaviour
(the user's oldest list by creation date, the lists index when they own none, the admin area for the admin account).
The account menu carries a Home entry that goes to the same destination as the title link (on the home route it simply
closes the menu) and a My lists entry that opens the lists index. Those menu entries are the navigation; neither the
shopping view nor the list management screen carries its own back-to-lists link. No screen is a navigational dead end
requiring the browser back button.
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

**Data Store & Deployment (new for Epic 11, stated in full)**
**FR70: All persisted application data — users, refresh tokens, application configuration, lists, memberships and
pending invites, items, categories and feedback — is stored in PostgreSQL. MongoDB is not part of any environment:
local development, the E2E stack, or production. Every other FR behaves exactly as before.**
**FR71: A one-time import script, run by the operator, loads a JSON export of the production MongoDB into an
empty PostgreSQL database. Every user (with their existing password hash, so passwords keep working), list,
membership, pending invite, item (stores, recurring setting, check and soft-delete state, `addedBy` included),
category, feedback entry and configuration value carries over, and the relations between them stay intact.
Refresh tokens are not carried over: each user signs in once after the move. The script refuses to run
against a database that already holds application data, and finishes by printing, for each record type, the count
in the export and the count loaded.**
**FR72: The database schema is created and changed only by versioned migrations that the backend applies at
startup. Each migration applies once; a restart against an up-to-date schema changes nothing.**
**FR73: Production infrastructure is declared in Terraform in this repository: one droplet running the frontend
and backend, joined to the existing io-workshop VPC and reachable only from the edge proxy, and one separate
DigitalOcean Managed PostgreSQL database on the cheapest tier, which accepts connections only from that droplet.
The operator applies infrastructure changes by hand; a deploy never applies them.**
**FR74: The operator releases a version with one command: it builds and publishes the images, rolls the droplet to
that version, and checks that the site answers at `https://bag-please.io-workshop.net/`. A second command reports
which version is running.**

**Real-Time Collaboration & Authentication**
FR52: Item check-off, add, edit and delete reach other members' shopping views live via GraphQL subscription
FR53: WebSocket subscriptions require a valid JWT in `connectionParams`; the backend closes on expiry; the frontend
disposes the socket before clearing auth


**Epic 11 FR scope:** FR70–FR74 (new). FR71 is widened by spine AD-18: the import also prints, per record type, the
rows **dropped** and why (orphans the new foreign keys cannot hold), so "export = loaded + dropped" is the count
promise. FR47, FR69 (and NFR-L3) are Mongo-era history and are retired, not ported (AD-5). Every other FR is the
regression surface. **Still deferred:** FR42, FR43 (backend support remains and moves to PostgreSQL with the item
slice, including the scheduler steps).

### NonFunctional Requirements

Carried from the Epic 10 inventory; **bold** = new or amended for Epic 11 and stated in full.

**Security**
NFR1: Passwords hashed with bcrypt cost 12; plaintext never stored or logged
**NFR2: Refresh tokens are stored with their 30-day expiry; an expired token is never accepted, and expired tokens
are purged automatically.** *(Amended 2026-10-21: previously named a MongoDB TTL index.)*
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
NFR12: ApplicationConfig may be cached in memory; writes invalidate immediately. *(Permissive, not a mandate: Epic 11
removes the cache — AD-1 — and FR22 then holds trivially.)*

**Accessibility**
NFR13: Every input field has a visible, associated label
NFR14: Forms are fully keyboard-navigable (tab order, submit on Enter)
NFR15: Form error messages are associated with their fields
NFR16: Text and interactive elements meet minimum colour contrast

**Test gate**
**NFR17: The frontend has a Playwright e2e test suite covering every delivered flow; the suite runs against the
production artifact — the built SPA served by Caddy, plus the backend and its database — on both a desktop viewport
and a mobile viewport, and must pass with zero failures before any story in any epic is marked done.
*Exception (2026-10-22, Epic 11 only): stories land on an `epic-11` branch where the suite may be red between
stories; it must pass in full before the branch merges to main, and no release runs on the branch.***
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
NFR-L3: *(History after Epic 11; retired with FR47 by AD-5.)* The Epic 4 migration is idempotent via an
`app_migrations` completion record
NFR-L4: No list data is reachable by non-members at any layer; unauthorized access is a GQL error, not an empty result
NFR-L5: Subscriptions validate the `connectionParams` JWT before any stream, close on expiry, and `clearAuth()` disposes
the socket first

**Operations & Secrets (new for Epic 11; the repository is public, and every requirement here follows from that)**
**NFR-D1: No secret is ever committed. This covers the DigitalOcean API token, Spaces keys, database passwords and
connection strings, the JWT signing secret, admin credentials, Terraform state and variable files, and any data
export. Secrets live only in gitignored files; each such file has a committed example with blank values and a
comment per entry. The fixed local credentials that the dev and E2E Compose stack uses are not secrets: they
open nothing outside the developer's machine and are never used in production.**
**NFR-D2: Terraform state lives in a private remote store, never in the repository, because it holds the database
password. Tasks that need a secret load it themselves; it is not exported into an interactive shell.**
**NFR-D3: The managed database is not reachable from the public internet. It accepts connections only from the
application droplet, and the backend connects to it over TLS.**
**NFR-D4: Production data survives losing the droplet: it lives only in the managed database, which keeps the
provider's automatic daily backups. There is no restore drill: md accepts the risk of losing production data
(2026-10-22), and the off-repo Mongo archive (NFR-D5) is the manual fallback.**
**NFR-D5: The production MongoDB export holds every user's password hash and all list content. It stays outside
the repository (a gitignored path) and is removed from the repository working tree once the import is verified.
md keeps a copy off-repo, in their own storage, as the manual fallback for NFR-D4.**
**NFR-D6: The running cost stays at the smallest droplet that runs the frontend and backend, plus the cheapest
managed PostgreSQL tier; nothing is sized for more than the tens of users NFR11 describes.**

**Epic 11 NFR scope:** NFR2, NFR17 (with its branch exception) and NFR-D1–NFR-D6 are new work. NFR1–NFR8, NFR-L1,
NFR-L2, NFR-L4 and NFR-L5 are the regression surface the persistence move must not shift (membership gates,
subscription scoping, token lifetimes, cookie flags, rate limiting). NFR10, NFR13–NFR16, NFR64 and NFR65 are frontend
properties that Epic 11 does not touch; the E2E suite at the merge proves they still hold.

### Additional Requirements

From the Epic 11 architecture spine (AD-n cited), its four reviews, `addendum.md` and the mal_ui reference. Identifiers
are `AR-E11-n`. Versions are the spine's 2026-10-21 snapshot (verified in `review-versions.md`); a story re-measures
before it pins anything.

**Starter template:** none — brownfield.

**Branch and gate**
- AR-E11-0: **Inherited, unchanged.** Per-entity slice layout `entity/<name>/{Service, gql/, db/}`; NFR-L2 membership
  check in the service; FR56 admin excluded from lists and with no `users` row; Epic 9 AD-2 (one admin GQL gate on the
  JWT `role`), AD-4 (server-normalized stores, case-insensitive identity), AD-6 (users by `username`, binary order,
  server-located page), AD-9 (`/api/health` readiness; compose healthcheck on `bp_front` with busybox `wget`), AD-11
  (one check-state transition); the GraphQL schema and every response shape unchanged, so `npm run generate` is
  byte-identical; backend and frontend ship one app version.
- AR-E11-1 (AD-15, NFR17 exception): Stories merge into the long-lived **`feature/pg-migration`** branch in
  AR-E11-2's order. It is the branch NFR17 and the spine call `epic-11`, renamed in the plan by md (2026-10-22); the
  rule is unchanged. The E2E
  suite may be red between stories, but each story keeps `gradle :bp_back:test` green for what it touches. A slice is
  on Mongo **or** PostgreSQL, never both, and no code writes one entity to both stores. `feature/pg-migration` merges
  to `main` once, when Mongo is gone from code, Compose, tests and docs and the full NFR17 suite passes. No release
  runs from the branch. The merge is a **merge commit**, not a squash, so each story's commits survive on `main`
  (md, 2026-10-22; answers Epic 10 retro item 47's merge question for this epic).
- AR-E11-2 (AD-19): Slice order on the branch: (1) foundation; (2) `user` + `features/auth` + `config` + `feedback`;
  (3) `list` + membership; (4) `category`; (5) `item` + scheduler steps; (6) Mongo removal; (7) importer;
  (8) Terraform; (9) deploy tasks + droplet compose; (10) cutover. A later slice may reference an earlier one, never the
  reverse; a cross-slice call is non-atomic until both ends are on PostgreSQL, accepted on the branch only.

**Persistence (FR70, FR72)**
- AR-E11-3 (AD-17): `plugins/Database.kt` exports `suspend fun <T> tx(block: suspend TxScope.() -> T): T`, the only
  caller of `suspendTransaction`. It joins an open transaction or opens one; `useNestedTransactions = false`; max
  attempts 1 (no implicit retry — Exposed's default of 3 re-runs the block); `TxScope.afterCommit {}` queues on the
  outermost transaction, runs after its commit, and is dropped on rollback; Arrow `raise` inside `tx` rolls back, and
  services put `either {}` outside `tx {}` so a `Left` means nothing was written. Tests prove that a rolled-back outer
  `tx` drops a joined callee's queued events, and that `raise` rolls back.
- AR-E11-4 (AD-2): Every service method that touches the database, of any visibility, runs its body in `tx {}`.
  Repositories run only inside `tx`. GQL resolvers, REST routes, subscriptions and the scheduler call services only —
  never a repository, never `tx`. A cross-slice workflow is one service method: `UserService.deleteUser`,
  change-password + session invalidation, list views with members and unchecked counts
  (`ItemService.countUncheckedByList(listIds)`). Today's violations (`ListApi.kt` reading `ListMemberRepository` /
  `ItemStorage`, `UserAdminApi.kt` orchestrating the purge) are moved into services.
- AR-E11-5 (AD-3): No `emit` inside a `tx` body; services register `afterCommit { channel.emit(x) }`. Event payloads and
  the set of events each operation emits are unchanged.
- AR-E11-6 (AD-1): `ItemStorage`, `CategoryStorage`, `ListStorage` and `ApplicationConfigService`'s `AtomicReference`
  are deleted with no replacement cache. Each slice's `mongo/` becomes `db/` holding `<Name>Table.kt` (Exposed
  `object <Name>s : Table("<snake_plural>")`), `<Name>RowMapper.kt`, `<Name>Repository.kt`; `config/db/`,
  `features/auth/db/` likewise. Domain models keep their shape.
- AR-E11-7 (AD-4): `list_members(list_id, user_id, status, created_at)`, PK `(list_id, user_id)`, status ∈
  `PENDING | ACCEPTED | DECLINED`, is the only record of membership and invites. The owner holds an `ACCEPTED` row
  written in the list-creating `tx`. Access = an `ACCEPTED` row exists. GQL `List.members` keeps its meaning: `PENDING`
  + `ACCEPTED` rows **excluding the owner's**; the domain `members`/`memberUsernames` are derived the same way, never
  stored. `ListService.isMember` becomes `suspend`; the subscription `takeWhile` re-check is one indexed read in its own
  `tx`.
- AR-E11-8 (AD-5): Flyway owns the schema: `bp_back/src/main/resources/db/migration/V<n>__<snake_name>.sql`, applied at
  startup before GQL is configured, and by the importer before it loads. `V1__baseline.sql` is the **whole** Epic 11
  schema. A shipped migration is never edited; migrations are DDL only, never data rows; each is additive and
  backward-compatible with the previous release's image (a drop or rename ships one release after the code stops using
  it). Exposed tables never issue DDL (`SchemaUtils` / `MigrationUtils` unused). `Migration.kt`,
  `AppMigrationsRepository` and `app_migrations` are deleted; Mongo-era migrations are not ported.
- AR-E11-9 (AD-6): `uuid` PKs generated by the application, `feedback.id` included (the mapper converts the domain
  `String`). `app_config` has the fixed id `00000000-0000-0000-0000-000000000001`; a missing row means the defaults,
  reads never write it, only `update` upserts it. Every instant is `timestamptz` ↔ `java.time.Instant` via
  `exposed-java-time`. Enums are `text` + `CHECK`. snake_case identifiers. `users.username` is
  `text COLLATE "C" UNIQUE`. `items.stores` is `text[]` keeping order and casing. `items.added_by`,
  `feedback.username`, `refresh_tokens.username` are plain `text`, no FK. The repository translates SQLSTATE `23505`
  into the slice's existing domain conflict; it aborts and rolls back the `tx`.
- AR-E11-10 (AD-7): FKs to `lists` (`items`, `categories`, `list_members`) are `ON DELETE CASCADE` as a backstop; FKs to
  `users` (`lists.owner_id`, `list_members.user_id`) are `ON DELETE RESTRICT`; `items (list_id, category_id)`
  references `categories (list_id, id)` `ON DELETE CASCADE`, with `UNIQUE (list_id, id)` on `categories`. Services still
  delete children explicitly in today's order inside one `tx`, returning the same counts and events. User deletion is
  one `tx`: `SELECT … FOR UPDATE` on the user row, purge owned lists, delete the user's `list_members` rows and refresh
  tokens, delete the `users` row **last** (supersedes Epic 9 AR-E9-8's row-first order).
- AR-E11-11 (AD-8): Exposed DSL over `R2dbcDatabase` (`r2dbc-postgresql` + `r2dbc-pool`) on every request and
  scheduler path; no DAO; blocking JDBC only for Flyway. One `db.postgres` block — `host, port, name, user, password,
  sslmode, sslrootcert` ← `KTOR_DB_HOST`, `_PORT`, `_NAME`, `_USER`, `_PASSWORD`, `_SSLMODE`, `_SSLROOTCERT` — builds
  both URLs (R2DBC spells the CA option `sslRootCert`, pgJDBC `sslrootcert`). `application.yaml` defaults are the local
  dev values. `db.mongo.*`, `KTOR_MONGO_*` and `MIGRATION_TARGET_USER` are deleted.
- AR-E11-12 (AD-8, review-versions #2): **Spike in the foundation story, before any slice moves:** the app starts and
  connects to PostgreSQL over TLS with Ktor 3.6.0 (Netty 4.2.17) and `r2dbc-postgresql` 1.1.3 (reactor-netty 1.1.22,
  built for Netty 4.1) on one classpath, with `dependencyInsight --dependency netty` recorded. If it fails, the story
  stops and the persistence driver decision goes back to md.
- AR-E11-13 (AD-10, NFR2): `AuthService` keeps rejecting `expires_at <= now()`. The hourly scheduler cycle calls one
  service method per step — recurring restore, soft-delete hard-delete, `AuthService.purgeExpiredTokens()` — each in its
  own `tx`; a step that throws is logged and the following steps still run.
- AR-E11-14 (AD-16): PostgreSQL 18 everywhere: Compose `postgres:18` with fixed dev credentials (not secrets, NFR-D1)
  and a named volume mounted at `/var/lib/postgresql` (the 18+ image path, not `…/data`); Testcontainers `postgres:18`
  via `org.testcontainers.postgresql.PostgreSQLContainer` (`testcontainers-postgresql` 2.0.5); managed cluster on 18.
  The `mongo` service, the `db_data` volume and Testcontainers Mongo are removed. A major-version change moves all three.
- AR-E11-14a (review-rubric M9, review-adversary H3; md, 2026-10-22): **Local dev matches production privileges.**
  Compose publishes PostgreSQL on loopback only, `127.0.0.1:25432` (the 27217 pattern: no clash with a local install).
  An init script in Compose, and the same setup in `postgresContainer()`, creates a **non-superuser** role
  `bag_please_app` that owns the `public` schema of `bag_please`, and the backend, Flyway and tests connect as it: the
  privilege gap `db:bootstrap` closes in production then fails locally first. `application.yaml` defaults point at that
  port and role. `docker:back` / `docker:up` descriptions stop naming Mongo; the dev DB is reset by dropping the volume
  (Flyway `clean` stays disabled).
- AR-E11-15 (Consistency Conventions): Indexes carry today's intents and no more: `users(username)` unique,
  `items(list_id)`, `items(list_id, recurring, checked_at)`, `items(deleted, deleted_at)`,
  `list_members(user_id, status)`, `refresh_tokens(expires_at)`, `refresh_tokens(username)`; any other only with a
  reason in its migration. Tests: Kotest `FunSpec`; `FunSpec.postgresContainer()` replaces `mongoContainer()`; schema
  by running Flyway, never `SchemaUtils`; fixtures write through services, repositories inside `tx`, or SQL. Errors:
  expected outcomes become the slice's existing `Either` errors in the service, outside `tx`; GQL never inspects SQL
  state.
- AR-E11-16 (Stack): `exposed-core` / `exposed-r2dbc` / `exposed-java-time` 1.6.0; `r2dbc-postgresql` 1.1.3.RELEASE;
  `r2dbc-pool` 1.0.2.RELEASE; `flyway-core` + `flyway-database-postgresql` 13.11.1; `org.postgresql:postgresql`
  42.7.14 (Flyway only); `testcontainers-postgresql` 2.0.5. Kotlin 2.4.21 / Ktor 3.6.0 / temurin-25 unchanged.

**One-time import (FR71)**
- AR-E11-17 (AD-9): Export is `mongoexport --jsonArray` per collection, relaxed Extended JSON, into the gitignored
  `migration-export/` at the repo root. The importer is `com.bagplease.tools.MongoImport` in its own Gradle source set
  `bp_back/src/import/` — depends on `main`, reuses the `db/` Table objects, **not packaged into the image**. It runs
  Flyway, then in one `tx`: refuse if any of `users`, `lists`, `list_members`, `categories`, `items`, `feedback`,
  `refresh_tokens`, `app_config` holds a row (Flyway's history table excluded); load per AR-E11-18; print export /
  loaded / dropped-with-reason per record type. A failure rolls back to an empty database, so it can be re-run.
  `db:import` refuses a dirty tree and refuses while `bp_back` runs on the droplet (checked over SSH). It reaches the
  cluster via `ssh -J <edge> -L <local port>:<cluster private host>:<port> deploy@<droplet>`; only this connection
  uses `sslmode=verify-ca`. The `bag_please_app` credentials come from `terraform output` and go to the importer
  process only — never Gradle, a file, or the shell.
- AR-E11-18 (AD-18): Ids are accepted as a UUID string or `$binary` subtype `04`/`03` (`users._id` is binary today).
  `list_members._id` is not carried. Each list's `memberUsernames`, resolved through `users.username`, is authoritative
  for `ACCEPTED`; the owner is always `ACCEPTED`; a `list_members` document adds `PENDING`/`DECLINED` only for a user not
  already `ACCEPTED`; `lists.members` ids are unused. Dropped and counted with reason: a member username/id resolving to
  no user; a list whose owner resolves to no user; an item with null `listId`; an item whose category is the nil UUID
  or missing from its list; a category with null `listId`. Refresh tokens not imported; `app_config` as its single row;
  `{"$date": …}` → `timestamptz`.
- AR-E11-18a (review-reconcile B9; md, 2026-10-22): Production runs Epic 9, so the export is already multi-store. The
  importer still checks it: an item document carrying the legacy `store` field, or lacking `stores`, makes it **refuse
  before loading anything** and name the offending documents. FR69's guarantee is then a checked precondition, not an
  assumption.

**Infrastructure and release (FR73, FR74)**
- AR-E11-19 (AD-11, addendum): `deploy/terraform/` follows mal_ui: `main.tf`, `variables.tf`, `outputs.tf`,
  `versions.tf`, `cloud-init.yaml.tftpl`, committed `.terraform.lock.hcl`, its own `.gitignore`; the VPC and SSH key are
  data sources; the droplet has `lifecycle { ignore_changes = [user_data, image] }`; the firewall allows only 80 and 22
  from the edge's private IP; SSH via the edge as jump host; S3 backend in the `io-workshop-tfstate` Spaces bucket, key
  `bag-please/web.tfstate`. Terraform `~> 1.15`, provider `digitalocean` `~> 2.106`.
- AR-E11-20 (AD-11, NFR-D3, NFR-D6): The managed cluster runs PostgreSQL 18 on the cheapest tier (slug confirmed with
  `doctl databases options slugs --engine pg` at apply; ~$15/mo single node) in the same VPC; a
  `digitalocean_database_firewall` has exactly one trusted source, the droplet. Terraform creates database `bag_please`
  and user `bag_please_app` — the only identity of Flyway, the runtime and the importer. `doadmin` is used once, by
  `db:bootstrap` over the tunnel, to give `bag_please_app` ownership of `public` in `bag_please`; the first apply
  verifies against the real cluster that this is enough for Flyway. `infra:plan` / `infra:apply` are run by hand; a
  deploy never runs Terraform. Droplet size slug, `-Xmx`, `mem_limit` and the R2DBC pool size are chosen in these stories
  against the smallest droplet that runs both containers.
- AR-E11-21 (AD-14): Runtime TLS to the database is `verify-full`. The droplet compose hardcodes
  `KTOR_DB_SSLMODE: verify-full` and `KTOR_DB_SSLROOTCERT: /etc/bag-please/ca-certificate.crt` (committed, not secrets).
  The deploy writes the CA from the `digitalocean_database_ca` data source to `bag-please/ca-certificate.crt` (mode
  `644`), mounted read-only. The infra story verifies once from the droplet that `verify-full` passes against the
  cluster's **private** host (unverified in DO docs — review-versions #5); if it fails, AD-14 goes back to md. Local dev,
  E2E and Testcontainers run without TLS.
- AR-E11-22 (AD-12, NFR-D1, NFR-D2): Operator secrets live in `.secure.build.env` (Docker Hub user, image names;
  absorbs `project.env`, so `project.example.env` is retired) and `.secure.deploy.env` (DO token, Spaces key,
  `EDGE_SSH`, `TF_VAR_*`, `KTOR_JWT_SECRET`, `KTOR_ADMIN_LOGIN`, `KTOR_ADMIN_PASS`), each with a committed `.example`
  (blank values, a comment per entry). mise loads them per task; `lib.sh`'s strip list removes **every** variable of
  `.secure.deploy.env`, `KTOR_*` included, before any nested Gradle or mise task. Runtime secrets reach the droplet only
  in the deploy-written `bag-please/.env` (mode `600`, owner `deploy`); the deploy reads DB credentials from
  `terraform output` and refuses to write an empty value. `.gitignore` covers `.secure.*.env`, `migration-export/`,
  `*.tfstate*`, `*.tfvars`, `.terraform/`, `crash.log`, `*.archive` **before** the first such file exists. Images,
  compose files and committed Terraform hold no secret.
- AR-E11-23 (AD-13): The version is `gradle.properties`' `version`. `deploy:push` refuses a tag already on Docker Hub
  and never pushes `latest` (replaces `images:build-push`). `deploy` with no argument: refuses a dirty tree; runs
  `back:test`; builds and pushes; writes `.env` and runs `docker compose pull && up -d`; waits for `bp_front`'s
  healthcheck (busybox `wget` of `/api/health` through Caddy, covering backend and database); smoke-tests the droplet
  over the edge jump host (`http://<private ip>/api/health`). `deploy:status` checks the public
  `https://bag-please.io-workshop.net/` and prints the running version. `deploy <version>` redeploys a pushed tag — the
  rollback, safe across migrations by AR-E11-8. On failure it prints the rollback command and never rolls back itself.
- AR-E11-24 (Consistency Conventions, review B3): Droplet compose (`deploy/docker-compose.yml` → droplet
  `bag-please/docker-compose.yml`): `bp_front` published only on `${PRIVATE_IP}:80`; `bp_back` unpublished; both
  `read_only`, `tmpfs: [/tmp]`, `cap_drop: [ALL]` (`bp_front` adds `NET_BIND_SERVICE`), `no-new-privileges`,
  `mem_limit`; `bp_back` gets an explicit `-Xmx` via `JAVA_OPTS`. mise tasks: `infra:plan`, `infra:apply`,
  `db:bootstrap`, `db:import`, `deploy:build`, `deploy:push`, `deploy`, `deploy:status`, each loading only the
  `.secure.*.env` it needs; scripts in `deploy/scripts/` (`lib.sh`, `infra.sh`, `build.sh`, `push.sh`, `deploy.sh`,
  `smoke.sh`, `status.sh`, `bootstrap-db.sh`, `import.sh`).

**Cutover and docs**
- AR-E11-25 (AD-20): Cutover order: `infra:apply` → `db:bootstrap` → md takes the Mongo export → `db:import` (`bp_back`
  not yet deployed) → md checks the counts → `deploy` with the droplet smoke test → md checks both users' data through
  the edge jump → repoint the edge → `deploy:status` → retire the old deployment. `migration-export/` leaves the repo
  working tree once the import is verified; md keeps the export/archive off-repo as the only fallback. No restore drill.
  Edge configuration for `bag-please.io-workshop.net` belongs to the io-workshop edge, outside this repo.
- AR-E11-25a (review-reconcile B10, review-rubric H5; md, 2026-10-22): The root `CLAUDE.md` "Dump before a migration
  release" section is **replaced by a pointer** to `deploy/README.md`, which documents the managed daily backups,
  rollback by `deploy <previous>` (safe because migrations are additive, AR-E11-8), and an optional `pg_dump` over the
  tunnel before a release that adds a migration.
- AR-E11-26 (Consistency Conventions "Docs", review-rubric M8): Docs move with the behaviour they describe, in the story
  that changes it, not as a merge-time sweep: root `CLAUDE.md` (stack, Compose commands, `project.env` /
  `images:build-push`, the mongodump/restore section), `bp_back/CLAUDE.md` (layers, Storage, Mongo layer, tests, `tx`,
  Security's TTL index), `routing/edge-proxy.md` (production domain), and a new `deploy/README.md` operator runbook
  (infra, deploy, rollback, AR-E11-25). Zed tasks are re-synced whenever `mise.toml` tasks change (Story 10.10's
  `sync-zed-mise-tasks`).
- AR-E11-26a (review-rubric M6; md, 2026-10-22): Transactions run at PostgreSQL's default `READ COMMITTED`. The
  check-then-write paths (`shareList`, `acceptInvite`, `saveItem` create-vs-update) keep today's semantics with no row
  locks added; the only explicit lock is user deletion's `FOR UPDATE` (AR-E11-10). Creates `insert`; `ON CONFLICT`
  upserts only where today's semantics need them (`app_config.update`).

### UX Design Requirements

None. Epic 11 changes no screen, flow or copy (FR70), so the `ux-epic-8` contract was deliberately left out of the
inputs (md, 2026-10-22). The only user-visible effect is FR71's one-time sign-in after cutover, because refresh tokens
are not carried.

### FR Coverage Map

FR70: Epic 11 — every slice (`user`, `features/auth`, `config`, `feedback`, `list` + membership, `category`, `item` +
scheduler) moves to PostgreSQL; Mongo leaves code, Compose, Testcontainers and docs.
FR71: Epic 11 — one-time, one-transaction import of the production `mongoexport`, with export / loaded / dropped counts
per record type (widened by AD-18) and a refusal on legacy multi-store data (AR-E11-18a).
FR72: Epic 11 — Flyway `V<n>__*.sql` applied at startup (and by the importer); `V1__baseline.sql` is the whole schema.
FR73: Epic 11 — `deploy/terraform/`: droplet in the io-workshop VPC behind the edge, managed PostgreSQL 18 trusting only
the droplet, applied by hand.
FR74: Epic 11 — `deploy` (build, push an exact tag, roll the droplet, health wait, smoke test) and `deploy:status`.
FR47, FR69 (and NFR-L3): Epic 11 — retired as Mongo-era history, not ported (AD-5).
FR1–FR46, FR50–FR68 (except deferred FR42/FR43, superseded FR48/FR49, retired FR47): delivered in Epics 1–10;
regression-gated in Epic 11 — backend tests per story on the branch, the full NFR17 suite before the single merge to
`main`. FR42/FR43 stay deferred; their backend support moves with the item slice.

## Epic List

### Epic 11: Same App, New Home — PostgreSQL and a DigitalOcean Deployment

Both production users keep every list, item, share and password across the move, and nothing they see changes; md
gets a data store with real transactions and foreign keys in every environment, infrastructure declared in Terraform,
and a one-command release with a status check — on a public repository that holds no secret.

**FRs covered:** FR70, FR71, FR72, FR73, FR74 · retires FR47, FR69, NFR-L3 · regression surface: every other active FR
**NFRs:** NFR2, NFR17 (branch exception), NFR-D1 … NFR-D6 · AR-E11-0 … AR-E11-26a

**Why one epic, not two:** a persistence epic without the deployment could not release — `main` on PostgreSQL has no
production to run on until the droplet, the managed database and the import exist — and a deployment epic without the
persistence move has nothing to deploy. The architecture is final, so no feedback between halves could change
direction; the risk boundaries live inside the epic as gates instead (the Netty/TLS spike before any slice moves,
`verify-full` on the private host before the first deploy, md's count check before the edge moves).

**Shape (story order follows AR-E11-2):** foundation (`tx`, Flyway, baseline schema, PostgreSQL in Compose and
Testcontainers, the spike) → the slices in FK order → Mongo removal → importer → Terraform → deploy tasks and droplet
compose → cutover. All land on `feature/pg-migration`; the merge to `main` is the epic's last gate.

---

## Epic 11: Same App, New Home — PostgreSQL and a DigitalOcean Deployment

Both production users keep every list, item, share and password across the move, and nothing they see changes; md
gets a data store with real transactions and foreign keys in every environment, infrastructure declared in Terraform,
and a one-command release with a status check — on a public repository that holds no secret.

**Delivers:** FR70–FR74 · NFR2, NFR17 (branch exception), NFR-D1–NFR-D6 · AR-E11-0 … AR-E11-26a · retires FR47, FR69,
NFR-L3

**Binding on every story below:** the inherited invariants (AR-E11-0) — the GraphQL schema and every response shape are
unchanged, so `npm run generate` stays byte-identical; stories land on `feature/pg-migration` in this order
(AR-E11-1, AR-E11-2), and each keeps `gradle :bp_back:test` green for what it touches, while the E2E suite may be red
until Story 11.7; no code writes one entity to both stores; every new or changed test is observed failing before it is
accepted; test totals are read from the JUnit XML in the pass, never quoted; a migration file already on the branch is
edited only before Story 11.11's merge, never after (AR-E11-8); docs describing a changed behaviour change in the same
story (AR-E11-26); transactions stay at `READ COMMITTED`, creates are
`insert`s and `ON CONFLICT` upserts appear only where today's semantics need them (AR-E11-26a); Zed tasks re-synced whenever `mise.toml` tasks change; `sprint-status.yaml` reconciled at story
close. Versions are the 2026-10-21 snapshot (AR-E11-16) — each story re-measures before it pins anything.

**Deliberate departure from "create tables only when needed":** Story 11.1 ships the whole schema in
`V1__baseline.sql` (AD-19), so no later story edits a migration another story shipped. Nothing ships before the merge,
so no release ever carries a table its code does not use.

### Story 11.1: The backend can reach PostgreSQL safely

As md, maintaining the backend,
I want a PostgreSQL connection, a transaction helper and a versioned schema in place next to Mongo,
So that every slice after this one moves onto a foundation that is already proven, not invented per slice.

**Acceptance Criteria:**

**Given** nothing else in this story has been written yet
**When** the spike adds `exposed-core` / `exposed-r2dbc` / `exposed-java-time`, `r2dbc-postgresql`, `r2dbc-pool`,
`flyway-core` + `flyway-database-postgresql` and `org.postgresql:postgresql` (AR-E11-16) and starts the app against a
TLS-enabled `postgres:18`
**Then** the app starts on Ktor 3.6.0's Netty and runs `SELECT 1` over R2DBC with `sslmode=verify-full`, and the output
of `gradle :bp_back:dependencyInsight --dependency netty` is recorded in the story (AR-E11-12)
**And** if it cannot, the story stops there, records the failure verbatim, and the driver decision goes back to md;
no slice code is written

**Given** the spike passed
**When** `plugins/Database.kt` is written
**Then** one `db.postgres` block (`host, port, name, user, password, sslmode, sslrootcert` ← `KTOR_DB_*`) builds both
the R2DBC and the JDBC URL, with the CA option spelled `sslRootCert` for R2DBC and `sslrootcert` for pgJDBC, and
`application.yaml` defaults are the local dev values: `localhost:25432`, database `bag_please`, role `bag_please_app`
(AR-E11-11, AR-E11-14a)
**And** it exports `suspend fun <T> tx(block: suspend TxScope.() -> T): T` — the only caller of `suspendTransaction` —
which joins an open transaction or opens one, with `useNestedTransactions = false` and max attempts 1, and
`TxScope.afterCommit {}` queuing on the outermost transaction (AR-E11-3)

**Given** the `tx` helper
**When** its tests run in a Kotest `FunSpec` against `postgresContainer()`
**Then** an outer `tx` that fails after a joined inner `tx` registered `afterCommit` actions runs none of them
**And** an Arrow `raise` inside `tx` leaves no row written, and a successful outer `tx` runs its queued actions once,
after commit, in registration order

**Given** `bp_back/src/main/resources/db/migration/V1__baseline.sql`
**When** Flyway runs at startup, before GQL is configured
**Then** it creates the eight tables `users`, `lists`, `list_members`, `categories`, `items`, `feedback`,
`refresh_tokens`, `app_config` with the column conventions of AR-E11-9, the foreign keys and delete rules of
AR-E11-10, and exactly the indexes of AR-E11-15, and it holds DDL only — no data row (AR-E11-8)
**And** a second startup against the migrated database applies nothing and changes nothing (FR72)
**And** no Exposed `SchemaUtils` or `MigrationUtils` call exists anywhere in `bp_back`

**Given** `docker-compose.yaml`
**When** `docker compose up` runs
**Then** a `postgres:18` service runs **next to** `mongo`, published only on `127.0.0.1:25432`, with a named volume
mounted at `/var/lib/postgresql`, and an init script that creates the non-superuser role `bag_please_app` owning the
`public` schema of `bag_please`; the backend connects as that role, not as the image superuser (AR-E11-14, AR-E11-14a)
**And** `FunSpec.postgresContainer()` in `utils/TestContainers.kt` uses `org.testcontainers.postgresql.PostgreSQLContainer`
with `postgres:18`, the same role setup, and runs Flyway for the schema

**Given** `/api/health`
**When** PostgreSQL does not answer `SELECT 1` within 2 s, or Mongo does not answer its ping
**Then** it returns 503 `UNAVAILABLE`, and 200 `OK` only when both answer; `HealthApiTest` covers the PostgreSQL-down
case (Epic 9 AD-9; the Mongo half leaves in Story 11.7)

**Given** the story closes
**Then** `gradle :bp_back:test` is green, `bp_back/CLAUDE.md` documents `tx`, `afterCommit` and the Flyway rule, and no
slice reads or writes PostgreSQL yet

### Story 11.2: Accounts and sessions live in PostgreSQL

As a bag-please user,
I want my account, password and sign-in to work exactly as before when they move to PostgreSQL,
So that the platform change is invisible to me.

**Acceptance Criteria:**

**Given** Story 11.1 has landed
**When** the `user` slice moves
**Then** `entity/user/mongo/` is replaced by `entity/user/db/` (`UserTable.kt`, `UserRowMapper.kt`,
`UserRepository.kt`), and `features/auth/RefreshTokenRepository` by `features/auth/db/` on `refresh_tokens`
(AR-E11-6)
**And** every service method that touches either runs its body in `tx {}`, and no route or GQL resolver calls a
repository (AR-E11-4)

**Given** a username that differs from an existing one only in letter case, and one that is identical
**When** each is registered, or created by the admin
**Then** the different-case name is accepted (unchanged Mongo behaviour) and the identical name gets the existing
conflict error, produced by the repository translating SQLSTATE `23505` (AR-E11-9)
**And** the admin user list keeps its binary `username` order and 20-per-page pagination (FR13, Epic 9 AD-6), proven
by a test whose usernames mix cases and would sort differently under a locale collation

**Given** a refresh token whose `expires_at` is in the past
**When** it is presented to `/api/auth/refresh`
**Then** it is rejected as today
**And** `AuthService.purgeExpiredTokens()` deletes every expired row and no live one (NFR2, AR-E11-13)

**Given** `plugins/Scheduler.kt`
**When** the hourly cycle runs
**Then** it calls one service method per step — the existing item cycle, then `purgeExpiredTokens()` — each in its own
`tx`, and a test proves that a throwing step is logged and the next step still runs (AR-E11-13)

**Given** a user changes their password
**When** the change succeeds
**Then** the new hash and the invalidation of their refresh tokens are one `tx` in one service method; a failure
leaves both the old hash and the sessions in place

**Given** the admin deletes a user
**When** `UserService.deleteUser` runs (moved out of `UserAdminApi.kt`)
**Then** it locks the user row with `SELECT … FOR UPDATE`, purges the user's owned lists and memberships through
`ListService` (still on Mongo, so this call is not atomic yet — accepted on the branch, AR-E11-2), deletes their
refresh tokens, and deletes the `users` row **last**, returning the same counts and events as before (AR-E11-10)
**And** the user's feedback survives (FR67)

**Given** the story closes
**Then** `UserRegistrationTest`, `LoginTokenTest`, `AuthApiTest`, `AdminUserManagementTest` and `WebSocketAuthTest` run
on `postgresContainer()` and are green, NFR1, NFR3, NFR4, NFR7 and NFR8 hold unchanged, and `bp_back/CLAUDE.md`'s
Security section no longer names a TTL index

### Story 11.3: Settings and feedback live in PostgreSQL

As md, running bag-please as its admin,
I want the registration switch and user feedback to behave as before on PostgreSQL,
So that the admin area is unchanged and the import can trust an empty database to mean empty.

**Acceptance Criteria:**

**Given** Story 11.2 has landed
**When** the `config` slice moves to `config/db/`
**Then** `app_config` is read by its fixed id `00000000-0000-0000-0000-000000000001`; a missing row returns the
defaults **without writing one**; only `update` upserts it (AR-E11-9)
**And** `ApplicationConfigService`'s `AtomicReference` cache is deleted with no replacement (AR-E11-6)

**Given** a freshly migrated, empty database
**When** the login page is loaded, `/api/auth/register` is attempted and the admin reads the configuration
**Then** `app_config` still has zero rows — proven by a test, because the importer's emptiness check depends on it

**Given** the admin toggles registration
**When** the next request reads the setting
**Then** it sees the new value with no restart (FR20, FR21, FR22)

**Given** the `feedback` slice moves to `entity/feedback/db/`
**When** a user sends feedback and the admin lists and deletes it
**Then** behaviour is unchanged (FR66, FR67): newest first, plain text, 2000-character cap, survives user deletion
**And** `feedback.id` is a `uuid` column converted by the mapper from the domain `String`, and deleting an id that is
not a valid UUID returns the existing not-found error rather than a server error

**Given** the story closes
**Then** `ApplicationConfigTest` and `FeedbackTest` run on `postgresContainer()` and are green

### Story 11.4: Lists, shares and invites live in PostgreSQL

As a bag-please user who shares lists,
I want my lists, the people I share them with and my pending invites to behave exactly as before,
So that sharing keeps working after the move and nobody sees a list they are not a member of.

**Acceptance Criteria:**

**Given** Story 11.3 has landed
**When** the `list` slice moves to `entity/list/db/`
**Then** `list_members(list_id, user_id, status, created_at)` is the only record of membership and invites; the
`members` / `memberUsernames` arrays are not stored anywhere; `ListStorage` is deleted (AR-E11-6, AR-E11-7)
**And** creating a list writes the list row and the owner's `ACCEPTED` membership row in one `tx`

**Given** a list with an owner, one accepted member and one pending invitee
**When** the GQL `List.members` field and the Share dialog's data are read
**Then** they return the accepted member and the pending invitee and **not** the owner — byte-identical to the
pre-move response for the same data, captured before the change (AR-E11-7)

**Given** `ListApi.kt` today reads `ListMemberRepository` and `ItemStorage` directly
**When** the slice moves
**Then** list views with members and unchecked counts are composed by `ListService`, using
`ItemService.countUncheckedByList(listIds)` (items are still on Mongo here — accepted on the branch), and no GQL
resolver touches a repository or storage (AR-E11-4)

**Given** a subscriber to a list's items or categories
**When** they are removed from the list, or leave it, while subscribed
**Then** the `takeWhile` re-check — now `suspend ListService.isMember`, one indexed read in its own `tx` — ends their
stream on the next event (NFR-L1, AR-E11-7)
**And** `SubscriptionScopingTest` and `ListAuthorizationTest` are green on `postgresContainer()`

**Given** sharing by username, accepting, declining, leaving, removing a member and deleting a list
**When** each runs
**Then** it behaves as before (FR37, FR39, FR40, FR55): specific errors for unknown user, existing member and self; the
admin is rejected by every list operation and never appears in `lists.owner_id` or `list_members` (FR56)
**And** the membership check runs in the same `tx` as the work it guards (NFR-L2)

**Given** the admin deletes a user who owns lists and is a member of others
**When** `UserService.deleteUser` runs
**Then** the list and membership parts of the purge and the `users` delete now share one `tx` (the purged lists'
categories and items are still on Mongo, so that part stays non-atomic until Stories 11.5 and 11.6 — accepted on the
branch, AR-E11-2); a user row cannot be deleted while a `lists.owner_id` or
`list_members.user_id` row still references it (`ON DELETE RESTRICT`, AR-E11-10)

**Given** the story closes
**Then** `ListServiceTest` and `ListSharingTest` are green on `postgresContainer()`

### Story 11.5: Categories live in PostgreSQL

As a bag-please user,
I want my categories to be created, renamed and deleted exactly as before,
So that organising a list is unchanged after the move.

**Acceptance Criteria:**

**Given** Story 11.4 has landed
**When** the `category` slice moves to `entity/category/db/`
**Then** `CategoryStorage` is deleted, every `CategoryService` method runs in `tx {}`, and its subscription events are
registered with `afterCommit` (AR-E11-3, AR-E11-5, AR-E11-6)

**Given** a member renames a category
**When** the rename commits
**Then** other members' views receive the update in real time (FR63), and a rename that fails emits nothing

**Given** a category with items
**When** it is deleted
**Then** its items are deleted first and the category second, in today's order, inside one service method, with the
same counts and events as before (Epic 9 AD-7); items still live on Mongo here, so that step is not atomic yet —
accepted on the branch (AR-E11-2)

**Given** a category on list A
**When** a write tries to use it on list B
**Then** it is rejected as before (FR58)

**Given** the story closes
**Then** the category cases of `ItemCategoryStorageTest` are green on `postgresContainer()`

### Story 11.6: Items and the hourly jobs live in PostgreSQL

As a bag-please user shopping with others,
I want items, check-offs, stores and live updates to behave exactly as before,
So that the core shopping loop does not notice the move.

**Acceptance Criteria:**

**Given** Story 11.5 has landed
**When** the `item` slice moves to `entity/item/db/`
**Then** `ItemStorage` is deleted, `items.stores` is a `text[]` keeping each item's order and casing (FR44, Epic 9
AD-4), `items.added_by` is plain text (FR45), and an item's category is enforced by the composite foreign key
`(list_id, category_id) → categories (list_id, id)` (AR-E11-10)

**Given** an item save
**When** the id does not exist, exists on the target list, or exists on another list
**Then** it is created, merged — `addedBy`, `checkedAt`, `deleted` / `deletedAt` surviving — or rejected, exactly as
FR58 defines, with the one check-state transition of Epic 9 AD-11

**Given** an item mutation inside a service method
**When** the `tx` commits
**Then** its event reaches subscribers once (FR52); when it rolls back, nothing is emitted (AR-E11-5)

**Given** the hourly scheduler
**When** a cycle runs
**Then** recurring restore, soft-deleted hard-delete and `purgeExpiredTokens` are three steps, each one service method in
its own `tx`, and a throwing step does not stop the others (FR54, AR-E11-13)

**Given** a category deleted with items in it, and a list deleted with items and categories in it
**When** each runs
**Then** each is now one `tx`, removing children explicitly in today's order with the same counts and events
(AR-E11-10)

**Given** the story closes
**Then** `ItemApiTest`, `ItemCategoryStorageTest`, `ItemLifecycleTest` and `SubscriptionScopingTest` are green on
`postgresContainer()`, and no slice reads or writes Mongo any more

### Story 11.7: MongoDB leaves the stack

As md, maintaining bag-please,
I want every trace of MongoDB gone from code, Compose, tests and docs, with the full E2E suite green on PostgreSQL,
So that the branch is a single-store application that could merge.

**Acceptance Criteria:**

**Given** Story 11.6 has landed
**When** the Mongo code is removed
**Then** the `mongo/` package, `MongoConnection`, the BSON serializers, `plugins/Migration.kt`,
`AppMigrationsRepository`, `MigrationTest`, `mongoContainer()`, the Mongo driver and Testcontainers Mongo
dependencies, `db.mongo.*`, `KTOR_MONGO_*` and `MIGRATION_TARGET_USER` are deleted (AR-E11-8, AR-E11-11)
**And** `grep -rniE 'mongo|bson|app_migrations' bp_back/src bp_front/e2e docker-compose.yaml gradle mise.toml` returns
no hit outside a line that names the import of the Mongo export (Story 11.8)

**Given** `docker-compose.yaml`
**When** `docker compose up --build` runs
**Then** it starts `postgres`, `bp_back` and `bp_front` only; the `mongo` service and the `db_data` volume are gone;
`bp_front` and `bp_back` depend on `postgres` being healthy, and `/api/health` checks PostgreSQL only (AR-E11-14)
**And** the `docker:up` / `docker:back` task descriptions no longer name Mongo, and Zed tasks are re-synced

**Given** the full Playwright suite
**When** `npm run test:e2e` runs against the production image on every project (desktop, mobile and the 320px floor)
**Then** it passes with zero failures — the first time on the branch since Story 11.2 (FR70, NFR17, NFR18, NFR64,
NFR65)
**And** `npm run generate` is byte-identical to `main`

**Given** the docs
**When** the story closes
**Then** root `CLAUDE.md` names PostgreSQL 18, its volume and `docker compose up postgres bp_back` for Vite dev work, and
says that an old Mongo-based stack comes up on an empty PostgreSQL database; `bp_back/CLAUDE.md`'s layers read
GQL → Service → Repository → PostgreSQL with no Storage layer; any Playwright comment naming Mongo is corrected
(AR-E11-26)
**And** the root `CLAUDE.md` dump-and-restore section is left in place, marked as superseded by Story 11.10, so the
repo never documents a procedure for a database it no longer has without saying so

### Story 11.8: Production data can be imported in one go

As md, about to move two real users' data,
I want an importer that loads a Mongo export into an empty PostgreSQL database in one transaction and tells me exactly
what it loaded and dropped,
So that I can trust the move, or re-run it from scratch if anything fails.

**Acceptance Criteria:**

**Given** Story 11.7 has landed, and before any export file exists in the tree
**When** `.gitignore` is updated
**Then** it covers `.secure.*.env`, `migration-export/`, `*.tfstate*`, `*.tfvars`, `.terraform/`, `crash.log` and
`*.archive`, and `git check-ignore` confirms one sample path for each (AR-E11-22, NFR-D1, NFR-D5)

**Given** the importer
**When** it is built
**Then** `com.bagplease.tools.MongoImport` lives in its own Gradle source set `bp_back/src/import/`, depends on `main`,
reuses the `db/` Table objects, and is **not** in the `bp_back` image — proven by listing the image's classpath
(AR-E11-17)

**Given** a target database that holds any row in any of the eight application tables
**When** the importer runs
**Then** it refuses before loading and names the non-empty table; Flyway's history table does not count (FR71)

**Given** an export in which any item document carries the legacy `store` field or lacks `stores`
**When** the importer runs
**Then** it refuses before loading anything and lists those documents' ids (AR-E11-18a)

**Given** fixture exports written as `mongoexport --jsonArray` relaxed Extended JSON, covering: `users._id` as
`$binary` subtype `04` and `03` and other ids as strings; `{"$date": …}` instants; a list whose `memberUsernames`
contains an accepted member, plus `list_members` documents with `PENDING` and `DECLINED`; an item with several stores,
recurring settings, check state and soft-delete state; feedback; `app_config`; refresh tokens; and one of each orphan
AR-E11-18 names
**When** the importer runs against an empty `postgresContainer()`
**Then** Flyway runs first, everything loads in one `tx`, and the report prints per record type the export count, the
loaded count and the dropped count with one reason per dropped row, with export = loaded + dropped for every type
**And** a user's imported password hash signs them in, owners are `ACCEPTED`, `memberUsernames` wins over a conflicting
`list_members` document, no refresh token is loaded, and store order and casing are kept (FR71, AR-E11-18)

**Given** a fixture that makes the load fail part-way
**When** the importer runs
**Then** the database is left with zero rows in every application table, and a second run on a corrected fixture
succeeds

**Given** the importer and `docker compose up postgres` with an empty volume
**When** a local `db:import:local` task runs it against `migration-export/`
**Then** it succeeds through the same code path the production run will use, without TLS (AR-E11-21)
**And** the task passes database credentials to the importer process only, never to Gradle's environment or a file

### Story 11.9: The new home exists in Terraform

As md, operating bag-please,
I want the droplet and the managed database declared in Terraform and reachable only the way the architecture says,
So that production infrastructure is reproducible, private and sized for two users.

**Acceptance Criteria:**

**Given** Story 11.8 has landed
**When** `deploy/terraform/` is written following mal_ui
**Then** it holds `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf` (Terraform `~> 1.15`, provider
`digitalocean ~> 2.106`), `cloud-init.yaml.tftpl`, a committed `.terraform.lock.hcl` and its own `.gitignore`; the VPC
and SSH key are data sources; the droplet has `lifecycle { ignore_changes = [user_data, image] }`; the firewall allows
only 80 and 22 from the edge's private IP; state goes to the `io-workshop-tfstate` Spaces bucket under
`bag-please/web.tfstate` (FR73, AR-E11-19, NFR-D2)

**Given** the managed database
**When** `infra:plan` shows it
**Then** it is PostgreSQL 18 on the cheapest tier — the slug confirmed with `doctl databases options slugs --engine pg`
and recorded — in the same VPC, with a `digitalocean_database_firewall` whose only trusted source is the droplet, a
database `bag_please` and a user `bag_please_app` (AR-E11-20, NFR-D3, NFR-D6)
**And** the droplet size is the smallest that runs both containers, recorded with its price

**Given** `.secure.deploy.env.example`
**When** it is committed
**Then** every variable the infra and deploy tasks read is listed with a blank value and a one-line comment
(AR-E11-22, NFR-D1)
**And** `infra:plan` and `infra:apply` load `.secure.deploy.env` themselves, and nothing is exported into the
operator's shell

**Given** `infra:apply` has run
**When** `db:bootstrap` runs over `ssh -J <edge> -L …` as `doadmin`
**Then** `bag_please_app` owns the `public` schema of `bag_please`, `doadmin` is used by no other task, and a Flyway run
as `bag_please_app` through the tunnel creates the baseline schema (AR-E11-20)

**Given** the cluster's CA from the `digitalocean_database_ca` data source
**When** `psql "sslmode=verify-full sslrootcert=<ca> host=<private host>"` runs from the droplet
**Then** it connects, and the result is recorded (AR-E11-21)
**And** if it does not, the story stops and AD-14 goes back to md before any deploy is built on it

**Given** `db:import`
**When** it runs
**Then** it refuses a dirty tree, refuses while `bp_back` runs on the droplet (checked over SSH), opens the tunnel,
reads the `bag_please_app` credentials from `terraform output`, and passes them with `sslmode=verify-ca` to the importer
process only — never to Gradle, a file or the shell (AR-E11-17)
**And** a dry run against the empty cluster with a fixture export loads, and the cluster is emptied again afterwards

### Story 11.10: One command releases a version

As md, releasing bag-please,
I want one command that builds, publishes and rolls an exact version onto the droplet and a second that tells me
what is running,
So that a release is repeatable, a rollback is one command, and no secret leaves the place it belongs.

**Acceptance Criteria:**

**Given** Story 11.9 has landed
**When** `deploy/docker-compose.yml` is written
**Then** `bp_front` is published only on `${PRIVATE_IP}:80`, `bp_back` is not published, both are `read_only` with
`tmpfs: [/tmp]`, `cap_drop: [ALL]` (`bp_front` adds `NET_BIND_SERVICE`), `no-new-privileges` and a `mem_limit`,
`bp_back` gets an explicit `-Xmx` through `JAVA_OPTS`, and `KTOR_DB_SSLMODE: verify-full` and
`KTOR_DB_SSLROOTCERT: /etc/bag-please/ca-certificate.crt` are hardcoded (AR-E11-21, AR-E11-24)
**And** `bp_front`'s healthcheck is busybox `wget` of `/api/health` through Caddy (Epic 9 AD-9)

**Given** `deploy/scripts/lib.sh`
**When** any task runs a nested Gradle or mise task
**Then** every variable defined in `.secure.deploy.env` — `KTOR_*` included — is stripped first, proven by a nested
`env` dump showing none of them (AR-E11-22)

**Given** `deploy:push`
**When** the tag `gradle.properties`' `version` already exists on Docker Hub, or Docker Hub cannot be queried
**Then** it refuses; it never pushes `latest`; `images:build-push`, `mise/images-build-push.sh`, `project.env` and
`project.example.env` are retired in favour of `.secure.build.env` and its committed example (AR-E11-22, AR-E11-23)

**Given** `deploy` with no argument
**When** it runs
**Then** it refuses a dirty tree, runs `back:test`, builds and pushes, writes `bag-please/.env` (mode `600`, owner
`deploy`) with the DB credentials from `terraform output` — refusing an empty value — plus the JWT secret and admin
credentials, writes `ca-certificate.crt` (mode `644`), runs `docker compose pull && up -d`, waits for `bp_front`'s
healthcheck, and smoke-tests `http://<private ip>/api/health` through the edge jump host (AR-E11-23)
**And** on any failure it prints the rollback command and does not roll back itself

**Given** `deploy <version>`
**When** it names a tag already pushed
**Then** it redeploys that tag without building — the rollback (AR-E11-8)

**Given** `deploy:status`
**When** it runs
**Then** it prints the version running on the droplet and the HTTP status of `https://bag-please.io-workshop.net/`

**Given** the branch is not merged yet, so no release may run from it (AR-E11-1)
**When** the story is verified
**Then** a deploy of a pre-release tag to the new droplet passes the private-IP smoke test while the public URL still
serves the old deployment, `bp_back` is stopped again afterwards, and `app_config` on the cluster still has zero rows

**Given** the docs
**When** the story closes
**Then** `deploy/README.md` is the operator runbook — infra, bootstrap, import, deploy, status, rollback, the AD-20
cutover order, the managed daily backups and the optional `pg_dump` over the tunnel before a release that adds a
migration — and root `CLAUDE.md`'s dump-and-restore section is replaced by a pointer to it (NFR-D4, AR-E11-25a,
AR-E11-26)

### Story 11.11: Both users move to the new home

As a bag-please user,
I want to open the app after the move and find every list, item and share where I left it,
So that the change of home costs me one sign-in and nothing else.

**Acceptance Criteria:**

**Given** Stories 11.1–11.10 have landed on `feature/pg-migration`
**When** the release is prepared
**Then** `gradle.properties` and `bp_front/package.json` carry the next version, the full NFR17 suite passes with zero
failures on every project, `gradle :bp_back:test` is green, `npm run generate` is byte-identical, and the branch merges
to `main` as a **merge commit**, not a squash (AR-E11-1)

**Given** `main` holds the merged epic
**When** md runs the cutover from `main` in the AD-20 order — `infra:apply`, `db:bootstrap`, the production
`mongoexport` into `migration-export/`, `db:import` with `bp_back` not running
**Then** the import report shows, for each record type, export = loaded + dropped, and md accepts every dropped row by
its reason before going further (FR71, AR-E11-25)

**Given** the import is accepted
**When** `deploy` runs and md signs in as each production user through the edge jump host
**Then** each user's lists, items (stores, recurring, check and soft-delete state, `addedBy`), categories, shares and
pending invites match what the old deployment shows, and their existing password works; each signs in once, because
sessions were not carried (FR71)

**Given** both users' data is verified
**When** the edge is repointed to the droplet's private IP and `deploy:status` runs
**Then** `https://bag-please.io-workshop.net/` answers from the new droplet with the released version (FR74), and
`routing/edge-proxy.md` describes the production domain and its upstream

**Given** the new deployment serves both users' real data
**When** the move is closed
**Then** `migration-export/` is removed from the repository working tree and md has the export or archive in their own
off-repo storage (NFR-D5); the old deployment is retired only now; `git status` shows no secret or export file, and
`git ls-files` shows no path that `.gitignore` covers (NFR-D1)
