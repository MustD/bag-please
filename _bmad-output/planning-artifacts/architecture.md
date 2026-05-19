---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: complete
completedAt: '2026-05-18'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/architecture-epics-1-2.md
  - _bmad-output/project-context.md
  - _bmad-output/implementation-artifacts/epic-3-retro-2026-05-18.md
  - docs/index.md
  - docs/architecture-bp_back.md
  - docs/architecture-bp_front.md
  - docs/architecture-routing.md
  - docs/api-contracts-bp_back.md
  - docs/data-models-bp_back.md
  - docs/integration-architecture.md
  - docs/deployment-guide.md
  - docs/development-guide.md
  - docs/component-inventory-bp_front.md
  - docs/source-tree-analysis.md
workflowType: 'architecture'
project_name: 'bag-please'
user_name: 'md'
date: '2026-05-18'
epic: 'Epic 4 — Personal Lists & Sharing'
---

# Architecture Decision Document — Epic 4: Personal Lists & Sharing

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each
architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (from Epic 3 retro product decisions + design prototype):**

Epic 4 introduces **personal lists with sharing** — the first feature that introduces multi-tenancy. Current items and
categories are globally shared across all users; after Epic 4 they are scoped to a specific list. Nine high-level FRs
drive the scope:

- User can create a named list (with emoji icon)
- User can view and switch between their lists
- User can delete a list they own
- User can share a list with other users by username or email; invitee gains full peer write access (no
  owner/collaborator role distinction)
- Items and categories are scoped to a specific list
- A user can only see and modify items in lists they own or are a member of
- Existing global items and categories migrate to a default admin-owned list on first deploy after Epic 4
- List navigation/selection layer in the frontend: bottom tab navigation (Today, Lists, Household) replaces the
  current AppBar/drawer pattern
- Item entity gains new optional fields: `store` (where to buy), `recurring` (replenish cadence), `addedBy` (who
  added it)

**Non-Functional Requirements (inferred from retro decisions + existing stack):**

The NFRs with highest architectural weight:

- **NFR-L1: Subscription scoping** — current global `MutableSharedFlow` broadcasts to all subscribers; subscriptions
  must be scoped per-list so events from one list are invisible to users of another list
- **NFR-L2: Authorization at the service layer** — every item/category operation must verify the requesting user (from
  GQL context Principal, established in Epic 1 AR5) is a member of the target list
- **NFR-L3: Migration idempotency** — the startup migration seeding admin's default list from existing items/categories
  must be safe to run multiple times
- **NFR-L4: No cross-list data leakage** — storage and subscription layers must not expose one list's data to another
  list's members
- **NFR-L5: WebSocket auth prerequisite** — subscription scoping requires knowing which user is subscribing; the
  unauthenticated WebSocket path (tech debt from Epic 1) must be resolved as part of this epic

**Scale & Complexity:**

- Primary domain: Full-stack (backend entity slice + frontend structural redesign)
- Complexity level: **High** — first multi-tenancy feature; changes two existing entity shapes (Item, Category gain
  `listId`); introduces two new entities (List, ListMember); requires a one-time data migration; forces frontend
  navigation restructure; mandates WebSocket auth resolution
- Estimated architectural components: List *(new entity, full vertical slice)*, ListMember *(new join concept)*,
  Item *(modified — add listId, store, recurring, addedBy)*, Category *(modified — add listId)*, MigrationService
  *(new, startup-only)*, per-list subscription scoping strategy, frontend list-selection context layer, bottom tab
  navigation

### Technical Constraints & Dependencies

- **Principal is available in the GQL context** — Epic 1 AR5 wired it through `CustomGraphQLContextFactory`; username
  and role are accessible in every GQL operation today but not yet used by item/category operations
- **Existing ItemStorage/CategoryStorage are flat `ConcurrentMap<UUID, Entity>`** — no list concept; adding `listId`
  to items changes every query, mutation, and the storage key strategy
- **UserService calls UserRepository directly** (post Story 2.0; no in-memory cache) — username → userId resolution is
  a DB call; this matters for ListMember lookups when sharing by username
- **No referential integrity in MongoDB** — deleting a list will not auto-delete its items or categories; the service
  layer must handle cascades explicitly
- **WebSocket subscriptions are currently unauthenticated** (tech debt from Epic 1 `GQL.kt`) — per-list scoping
  requires auth on the WebSocket path; this is now a blocker, not deferred tech debt
- **MUI v9 is retained** — the design prototype uses a custom CSS variable system; Epic 4 adapts MUI to match the
  design's visual language (BottomNavigation, Drawer as bottom sheet, heavy theme customization) rather than replacing
  MUI

### Cross-Cutting Concerns Identified

1. **Per-list authorization** — Every item/category GQL operation must check that the context Principal is a member of
   the target list. Touches GQL layer, service layer, and storage layer for both existing entities. Currently neither
   ItemService nor CategoryService consumes the Principal at all.

2. **Subscription scoping** — The `MutableSharedFlow` broadcast pattern needs a per-list strategy. Two approaches are
   in play: per-list flows (one `MutableSharedFlow` per list, keyed in a Map) vs. filtered global broadcast (one flow,
   each subscriber filters by listId). The choice affects ItemService, CategoryService, and the GQL Subscription
   classes.

3. **Data migration** — On first startup after deploy: create an admin-owned default list, assign all existing
   `items` and `categories` documents to its `listId`. Must be idempotent (safe on repeated restarts). Must run before
   the in-memory storage sync, or the in-memory layer will load unscoped documents.

4. **Frontend navigation restructure** — Current AppBar + side drawer must give way to a bottom tab bar (Today, Lists,
   Household) matching the design prototype. The active list must be in React context so any nested screen (item
   editor, category view) can read it without prop-drilling.

5. **WebSocket authentication** — Resolving the unauthenticated subscription path is a hard prerequisite for per-list
   scoping. The frontend will need to pass the JWT on the WebSocket handshake; the backend will need to validate it
   before establishing the subscription stream.

6. **Item entity shape change** — `store`, `recurring`, `addedBy` are new optional fields on Item. All three layers
   (domain model, GQL model, Mongo model) and the item editor sheet must handle them. The item editor in the design
   shows store suggestions and a recurring segmented control — these are new UX patterns not yet in the component
   inventory.

## Starter Template Evaluation

### Primary Technology Domain

Brownfield full-stack web application. No starter template applies — the existing Kotlin/Ktor + Next.js stack is
already operational. No stack changes are required for Epic 4.

### Existing Stack Confirmed

All core technology decisions are inherited from the existing codebase (see `project-context.md`). Epic 4 adds
features on top of the working system from Epics 1–3. No new backend or frontend packages are required.

### New Dependencies Required

**Backend (`gradle/libs.versions.toml`):** None. The List and ListMember entities follow the same patterns as existing
entities. No new libraries needed.

**Frontend (`bp_front/package.json`):** None. All UI patterns for Epic 4 are available in `@mui/material` v9:
`BottomNavigation`, `SwipeableDrawer`, `Chip`, `ToggleButtonGroup`, `LinearProgress`. All already installed.

### Frontend Implementation Principles (Epic 4)

The `design/` prototype is the visual reference, not the implementation specification. The following principles govern
all new frontend work in Epic 4:

**MUI-first, minimal customization:**

- Use the MUI component that most closely matches the design pattern; accept visual approximation over deep style
  overrides
- Keep component files free of visual style `sx` — layout/spacing `sx` is permitted; color/typography/shape overrides
  belong in `theme.ts` only
- Prioritize MUI implementation simplicity over pixel-perfect design prototype match

**Resolved decisions:**

1. **Bottom sheet peek state** — implement a `BPSheet` wrapper component that owns a state machine controlling
   `SwipeableDrawer` open/closed and a secondary "peek" height via `PaperProps.style.height`. All bottom sheets in the
   app use `BPSheet`, never `SwipeableDrawer` directly.

2. **Theme switching** — use **MUI CSS variables mode** (`CssVarsProvider` from `@mui/material/styles`). Color tokens
   are sourced from `design/theme.js` palette values and mapped to MUI CSS variable names in `theme.ts`. Supports
   light/dark/sepia themes and multiple accent colors without re-rendering the provider. `ThemeProvider` is replaced by
   `CssVarsProvider` in `app/layout.tsx`.

3. **Font family** — MUI default (Roboto). The `next/font/google` Inter import from Epic 1 is removed in the first
   Epic 4 frontend story.

4. **Segmented controls** — MUI `ToggleButtonGroup` with minimal `sx` for border-radius and selected background.
   Visual delta from the prototype's pill shape is accepted.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Subscription scoping: filtered broadcast with two-point membership enforcement
- WebSocket auth: `connectionParams` JWT on `connection_init`; backend closes connection on token expiry
- Migration ownership: `MIGRATION_TARGET_USER` env var; hard-fail if unset with existing items; `migrationComplete`
  flag in `app_migrations` collection
- List authorization: service-layer explicit `CallerUsername` value class parameter
- Active list: URL is source of truth (`/list/[listId]`)

**Important Decisions (Shape Architecture):**

- ListMember storage: embedded UUID array in List document
- Item/Category storage: nested `Map<UUID, Map<UUID, Item>>` with `evictList` on deletion;
  `computeIfAbsent` for inner map creation
- Route structure: `/list/[listId]`, `/lists`, `/household`; sheets are overlay state, no URL
- Admin has no lists; admin has no personal data ownership

**Deferred Decisions (Post-MVP):**

- Subscription auth hardening (periodic token re-validation mid-session)
- Membership revocation UX (notify removed user vs. silent flow termination)

---

### Data Architecture

**List Entity**

```
List
  id: UUID
  name: String
  emoji: String
  ownerId: UUID          ← references users.id
  members: List<UUID>    ← embedded array; includes ownerId
  createdAt: Instant     ← required for default-list ordering and migration sort
```

Members array stores UUID references to `users._id`. No separate `list_members` collection — small scale,
member list always needed alongside list data, join overhead not justified.

**Item Entity — extended**

```
Item
  id: UUID
  name: String
  checked: Boolean
  category: UUID
  listId: UUID           ← NEW — FK to List.id
  store: String?         ← NEW — optional "where to buy"
  recurring: String?     ← NEW — null | "weekly" | "biweekly" | "monthly"
  addedBy: UUID?         ← NEW — references users.id; null for migrated items
```

**Category Entity — extended**

```
Category
  id: UUID
  name: String
  listId: UUID           ← NEW — FK to List.id
```

**Storage keying — nested map**

`ItemStorage` and `CategoryStorage` change from `ConcurrentHashMap<UUID, Entity>` to
`ConcurrentHashMap<UUID, ConcurrentHashMap<UUID, Entity>>` (listId → entityId → entity).

Key rules:

- Inner map creation uses `computeIfAbsent` (atomic) — never `getOrPut`
- `deleteList` must call `ItemStorage.evictList(listId)` and `CategoryStorage.evictList(listId)` — mandatory;
  documented in project-context.md alongside the existing lazy-sync rule
- Lazy `sync()` guard is preserved; outer map keyed by listId after MongoDB load

**Admin has no lists**

Admin credentials are env-var only; no `users` collection entry for admin. Admin interacts exclusively through
user management and app config interfaces. Admin cannot own, create, or be a member of lists.

**Data Migration**

One-time startup migration running directly against MongoDB repositories (bypasses in-memory storage). Runs in
`Application.module()` before route configuration — MongoDB documents are scoped before the first storage `sync()`.

```yaml
# application.yaml — new entry:
migration:
  targetUser: "$MIGRATION_TARGET_USER:"   # empty default triggers hard-fail
```

Logic:

1. Check `app_migrations` for `{ type: "epic4-list-seed", complete: true }` → if found, **no-op**
2. If `MIGRATION_TARGET_USER` unset and `items` non-empty → **hard-fail at startup** with descriptive error
3. If `MIGRATION_TARGET_USER` unset and `items` empty → skip (fresh install, no migration needed)
4. Verify named user exists in `users` → hard-fail if not found
5. Create default list (`name: "Groceries"`, `emoji: "🛒"`) owned by named user
6. `updateMany` items + categories to set `listId` where unset
7. Write `{ type: "epic4-list-seed", complete: true }` to `app_migrations`
8. Log outcome with item/category counts at INFO level

**Operational requirement:** Set `MIGRATION_TARGET_USER` in the deployment environment before first Epic 4
startup. Create the target user via admin panel before deploying.

---

### Authentication & Security

**WebSocket Authentication**

The `graphql-ws` `connection_init` carries `connectionParams`. Frontend sends
`{ Authorization: "Bearer <token>" }` from `AuthContext.accessToken`. Backend validates JWT before establishing
the subscription stream.

Connection lifecycle rules:

- Backend closes the WebSocket when the validated token expires — not just rejected at subscribe time
- `ApolloWrapper.tsx` `clearAuth()` calls graphql-ws client `dispose()` before redirecting — prevents orphaned
  connections delivering events after logout or password reset

**Per-List Authorization**

Enforced at the service layer via explicit non-nullable value class parameter:

```kotlin
@JvmInline value class CallerUsername(val value: String)

// GQL resolver — only place CallerUsername is constructed:
itemService.getItems(listId, CallerUsername(principal.username))

// Service method — compile-enforced, non-nullable:
suspend fun getItems(listId: UUID, caller: CallerUsername): List<Item>
```

Rules:

- `CallerUsername` constructed from validated JWT `Principal` in GQL resolver only
- Never accepted from client input; never nullable or defaulted
- Service calls `listService.verifyMembership(caller, listId)` before any data access

---

### API & Communication Patterns

**Subscription Scoping — Filtered Broadcast with Two-Point Membership Enforcement**

```kotlin
fun itemUpdates(listId: ID, caller: CallerUsername): Flow<GqlItemUpdate> {
    // Point 1: membership gate at subscribe time — throws if not member
    listService.verifyMembership(caller, UUID.fromString(listId.value))

    return merge(service.itemUpdates, service.itemDeletions)
        .filter { it.listId == UUID.fromString(listId.value) }
        // Point 2: re-evaluate on every event — terminates flow on revocation
        .takeWhile { listService.isMember(caller, UUID.fromString(listId.value)) }
        .map { GqlItemMapper.toUpdate(it) }
}
```

NFR-L4 (no cross-list leakage): satisfied by Point 1. Membership revocation: handled by Point 2 — revoked
users' flows terminate at the next emitted event without waiting for WebSocket reconnect.

**GraphQL Schema Changes**

- `lists: [List]` — new query; returns lists the caller owns or is a member of
- `createList(name: String!, emoji: String!): List` — new mutation
- `deleteList(id: ID!): Boolean` — new mutation; triggers `evictList` in storage
- `shareList(listId: ID!, username: String!): List` — new mutation
- `items(listId: ID!): [Item]` — existing query gains required `listId` argument
- `categories(listId: ID!): [Category]` — existing query gains required `listId` argument
- `saveItem(item: ItemInput!): Item` — `ItemInput` gains `listId`, `store`, `recurring`
- `itemUpdates(listId: ID!): ItemUpdate` — existing subscription gains required `listId`
- `categoryUpdates(listId: ID!): CategoryUpdate` — existing subscription gains required `listId`

`npm run generate` required after schema changes; refresh codegen JWT token first.

---

### Frontend Architecture

**URL Routing (Next.js App Router)**

Active list encoded in URL — no `ListContext`. Main routes:

```
/list/[listId]   ← Today view (shopping) for a specific list — shareable, deep-linkable
/lists           ← All lists management + catalog
/household       ← Household members + activity
/               ← Redirects to user's oldest list by createdAt, or /lists if none
```

Sheets and overlays (item editor, new list, share) are in-memory React state only — no URL change.

Edge cases:

- `/list/[listId]` unauthorized: `error.tsx` boundary catches GQL auth error and redirects to `/lists`
- Zero-lists state: `/lists` page shows "Create your first list" CTA
- Bottom nav active tab derived from `usePathname()` — no additional state

**Bottom Navigation replaces AppHeader + Navigation drawer**

`BPBottomNav` uses MUI `BottomNavigation` + `BottomNavigationAction`. `app/layout.tsx` removes existing
`AppHeader` and `Navigation` components and renders `BPBottomNav` instead.

**Apollo subscription connection update**

`GraphQLWsLink` `connectionParams` supplies `Authorization: Bearer <token>` from `AuthContext`.
`clearAuth()` calls `client.dispose()` before clearing state and redirecting to `/auth`.

---

### Infrastructure & Deployment

No changes to Docker Compose, nginx, or MongoDB infrastructure. New MongoDB collections created automatically
on first write: `lists`, `app_migrations`. New compound index on `items { listId, _id }` for per-list
retrieval — added in `ItemRepository.init {}`.

New env var: `MIGRATION_TARGET_USER` — required for first Epic 4 deploy when historical items exist.

---

## Implementation Patterns & Consistency Rules

These patterns are **additions** to the 77 rules in `project-context.md`. They cover Epic 4-specific territory where
multiple AI agents could make different choices. Base conventions (naming, GQL registration, mapper boundaries, storage
lazy-sync, etc.) are already in `project-context.md` and are not repeated here.

---

### Backend Patterns

#### Storage — Nested Map Operations

**Inner map creation:** use `computeIfAbsent` only — never `getOrPut`. `getOrPut` is not atomic; concurrent writes on
the same `listId` key can race and produce two inner maps, with one silently discarded.

**List eviction:** `ListService.deleteList` owns both `ItemStorage.evictList(listId)` and
`CategoryStorage.evictList(listId)` calls, in sequence, before returning. This is service-layer responsibility — not
the GQL mutation. If the process crashes between the two calls, partial eviction self-heals on next access via the
existing lazy-sync-from-Mongo guard — no custom locking or transactions are needed.

**Nonexistent `listId` in outer map:** accessing items or categories for a `listId` not present in the outer map
returns an empty result (not a 404). This is consistent with how Mongo queries behave and avoids a null/missing
distinction that would complicate GQL resolvers.

#### Authorization — `CallerUsername`

**Construction site:** `CallerUsername(principal.username)` is constructed in the GQL resolver only. Never in the
service layer, never accepted from client input, never nullable.

**Missing principal:** if `principal` is absent on a GQL operation that requires it, the resolver throws
`UnauthorizedException` before constructing `CallerUsername`. This path exists when the auth middleware passes an
unauthenticated request through — treat it as a programming error, not a user error.

**Ordering in service methods:** validate inputs first (fail fast on malformed data), then call
`listService.verifyMembership(caller, listId)` as the first authorization step. This ordering ensures auth errors
never leak information about whether a resource exists. Applies to **all** service methods that accept a `listId`,
including read-only queries — no exceptions.

#### Subscription Scoping — Two-Point Enforcement

Both points are required. Implementing only Point 1 misses the mid-session membership revocation case.

**Point 1 (subscribe time):** `listService.verifyMembership(caller, listId)` throws if not a member. The GraphQL WS
protocol delivers this as an `error` frame to the client. The frontend handler for a subscription `error` frame must
redirect to `/auth` (not silently ignore).

**Point 2 (per event):** `takeWhile { listService.isMember(caller, listId) }` re-evaluates on every emitted event.
Exceptions thrown by `isMember` inside `takeWhile` are caught and treated as `false` — the flow terminates cleanly
rather than propagating to the WebSocket handler.

#### Data Migration

**Placement:** migration runs in `Application.module()` before route configuration. MongoDB documents are scoped to
lists before the first storage `sync()` call. Do not move it after route config.

**Idempotency guard:** check `app_migrations` for `{ type: "epic4-list-seed", complete: true }` at the start. If
found, skip everything and return. This is not optional — startup may be repeated across deploys and tests.

---

### Frontend Patterns

#### WebSocket Auth & Teardown

**Connection params:** `GraphQLWsLink` `connectionParams` supplies `{ Authorization: "Bearer <token>" }` sourced from
`AuthContext.accessToken`. No other source.

**`clearAuth()` sequence (strict ordering):**

1. `client.dispose()` — synchronous; stops all active subscription emissions immediately. No await needed.
2. `localStorage.removeItem('token')` — clear persisted token.
3. Clear React auth state (`setAccessToken(null)`, `setUsername(null)`, etc.)

This order prevents in-flight subscription events from hitting React state after teardown, and prevents a spurious
authenticated request from firing between state clear and disposal.

#### Navigation & Routing

**`listId` in mutations:** `listId` is sourced from `useParams()` in the page component and passed as a prop or
argument down to mutation call sites. It is never read inside mutation hooks via `useParams()` directly, never stored
in a context, never prop-drilled more than one level. Page component → direct child → mutation. If the chain is
longer, the component tree needs restructuring.

**`/lists` is always the list index:** `/lists` never auto-redirects to a specific list. It is always the list picker
view, regardless of how many lists the user has. Cold-start navigation (e.g. redirect from `/`) may target
`/list/[oldestListId]` but `/lists` itself does not.

**On first list creation:** after `createList` succeeds, navigate to `/list/[newListId]` directly. Do not return to
`/lists` first — that dead-end feel breaks the flow of someone creating their first list.

**Auth error redirects:** all auth-driven redirects (unauthorized list access, session expiry, membership loss)
use `router.replace`, not `router.push`. `router.push` leaves the unauthorized route in history, causing a back-button
loop. No exceptions.

**Membership loss mid-session:** if a query or mutation on `/list/[listId]` returns a 403/FORBIDDEN GQL error while
the user is actively on that route, the `error.tsx` boundary catches it and calls `router.replace('/lists')`. Per-
component inline handling of 403s is forbidden — it belongs in the boundary.

#### `BPSheet` Rules

`BPSheet` wraps **all** bottom sheets. `SwipeableDrawer` is not used directly anywhere in application code.

**Peek height** is controlled by user gesture only. Data events (item saved, list updated, mutation completed) never
trigger a peek height change or sheet collapse. A `useEffect` that closes or resizes a sheet in response to a data
event is a bug.

#### Theme

`CssVarsProvider` from `@mui/material/styles` replaces `ThemeProvider` in `app/layout.tsx`. This is a one-time swap
in the first Epic 4 frontend story. All subsequent stories assume `CssVarsProvider` is in place — no story should
import or use `ThemeProvider`.

#### Schema & Codegen

`items`, `categories`, and subscription operations gain required `listId` arguments — this is a breaking schema
change. Frontend stories that depend on these operations **must not start** until the backend story adding `listId` to
the schema is merged into the `epic-4` branch. After that merge, run `npm run generate` before writing any component
code.

---

### Testing Patterns

These are required test shapes — not suggestions. An agent that ships a story without these tests has not met the
acceptance criteria, even if all functional ACs pass.

**Per-list authorization — negative-path test:** every service test for a list-scoped method must include a case
where the caller is not a member of the target list and must assert the expected exception is thrown. Read-only
methods are not exempt.

**`evictList` isolation:** after deleting a list, assert (a) both `ItemStorage` and `CategoryStorage` return empty for
that `listId`, and (b) items/categories belonging to a *different* list are unaffected. The second assertion is
required — it proves the eviction is scoped, not global.

**Subscription `takeWhile` path:** the test for subscription scoping must exercise mid-stream membership removal.
Sequence: open subscription → remove caller from list via mutation → emit an item event → assert subscriber flow
completes (terminates, not just filters). A simpler "non-member can't subscribe" test does not cover the `takeWhile`
path. Use a Flow testing library (e.g. Turbine) for async assertion.

**Migration idempotency:** one test must pre-populate `app_migrations` with `{ type: "epic4-list-seed", complete: true
}` before running the migration and assert that no list is created and no items are re-assigned. Without this test the
idempotency guard is untested code.

**Cross-tenant isolation (required on all list-scoped query tests):** every test for a query that returns list-scoped
data must include an assertion that a second user who is NOT a member of the target list either receives an auth error
or an empty result when querying the same resource. This assertion proves the multi-tenancy boundary.

**Playwright — subscription event isolation:** at least one E2E test must have two authenticated users, two separate
lists, with concurrent mutations, asserting that each user's UI reflects only their own list changes. This is the
integration-level proof of the entire multi-tenancy guarantee.

---

### All Agents MUST

- Call `listService.verifyMembership` as the first auth step in every list-scoped service method, after input
  validation, including reads
- Construct `CallerUsername` only in GQL resolvers
- Use `computeIfAbsent` (not `getOrPut`) for inner map creation in `ItemStorage` and `CategoryStorage`
- Call both `evictList` methods from `ListService.deleteList` — never from the GQL layer
- Use `router.replace` for all auth-driven navigation redirects
- Use `BPSheet` for all bottom sheets — never `SwipeableDrawer` directly
- Source `listId` from `useParams()` at the page level only
- Include the negative-path membership test and cross-tenant isolation assertion in every list-scoped test

---

## Project Structure & Boundaries

This section documents the **Epic 4 delta** only. The full project tree and base conventions are in
`project-context.md` and `docs/source-tree-analysis.md`. Agents should read those before implementing any Epic 4
story.

---

### New Backend Files

All paths relative to `bp_back/src/main/kotlin/com/bagplease/`.

**New entity — `entity/list/` (full vertical slice):**

```
entity/list/
  List.kt                        ← domain model; id, name, emoji, ownerId, members: List<UUID>, createdAt
  ListStorage.kt                 ← ConcurrentHashMap<UUID, List>; lazy sync; standard Storage pattern
  ListService.kt                 ← verifyMembership, isMember, createList, deleteList, shareList
  gql/
    GqlList.kt                   ← @GraphQLName("List") data class; id, name, emoji, ownerId, members
    GqlListMapper.kt             ← object GqlListMapper; mapListToGql()
    ListApi.kt                   ← @Suppress("unused") Query + Mutation; lists(), createList(), deleteList(), shareList()
  mongo/
    MongoList.kt                 ← @Serializable; _id mapped via UUIDMongoSerializer
    MongoListMapper.kt           ← object MongoListMapper
    ListRepository.kt            ← suspend fun findByMember, save, delete
```

`ListApi.kt` follows the existing `ItemApi.kt` / `CategoryApi.kt` pattern (Query + Mutation in one file).
No Subscription on List — list membership changes do not emit subscription events in Epic 4.

**`CallerUsername` value class:**

```
features/auth/
  CallerUsername.kt              ← @JvmInline value class CallerUsername(val value: String)
```

Lives in `features/auth/` — it is an auth boundary marker derived from a validated JWT Principal. Used by
`ItemService`, `CategoryService`, and `ListService`. Never instantiated outside a GQL resolver.

**Migration:**

```
plugins/
  Migration.kt                   ← fun Application.configureMigration(); called from Application.kt before
                                   configureRouting(); reads MIGRATION_TARGET_USER from application.yaml;
                                   checks app_migrations before running; hard-fails if env var unset and
                                   items collection non-empty
```

---

### Modified Backend Files

| File                                     | Change                                                                                                                             |
|------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| `entity/item/Item.kt`                    | Add `listId: UUID`, `store: String?`, `recurring: String?`, `addedBy: UUID?`                                                       |
| `entity/item/gql/GqlItem.kt`             | Add new fields; `GqlItemInput` gains `listId`, `store`, `recurring`                                                                |
| `entity/item/gql/ItemApi.kt`             | `items(listId: ID!)` and subscriptions gain required `listId`; `saveItem` input updated                                            |
| `entity/item/mongo/MongoItem.kt`         | Add new fields                                                                                                                     |
| `entity/item/ItemStorage.kt`             | Refactor from `ConcurrentHashMap<UUID, Item>` to `ConcurrentHashMap<UUID, ConcurrentHashMap<UUID, Item>>`; add `evictList(listId)` |
| `entity/item/ItemService.kt`             | All methods gain `caller: CallerUsername`; call `listService.verifyMembership` before storage access                               |
| `entity/category/Category.kt`            | Add `listId: UUID`                                                                                                                 |
| `entity/category/gql/CategoryApi.kt`     | `categories(listId: ID!)` and subscriptions gain required `listId`                                                                 |
| `entity/category/mongo/MongoCategory.kt` | Add `listId` field                                                                                                                 |
| `entity/category/CategoryStorage.kt`     | Same nested map refactor as `ItemStorage`; add `evictList(listId)`                                                                 |
| `entity/category/CategoryService.kt`     | All methods gain `caller: CallerUsername`; call `listService.verifyMembership`                                                     |
| `config/gql/GQL.kt`                      | Register `ListApi` in `packages`, `queries`, `mutations`                                                                           |
| `Application.kt`                         | Call `configureMigration()` before `configureRouting()`                                                                            |

---

### New Frontend Files

All paths relative to `bp_front/src/`.

```
app/
  BPBottomNav.tsx                ← MUI BottomNavigation + BottomNavigationAction; replaces AppHeader + Navigation;
                                   active tab from usePathname(); rendered in app/layout.tsx
  BPSheet.tsx                    ← SwipeableDrawer wrapper; owns open/closed state + peek height state machine;
                                   all bottom sheets in the app use this, never SwipeableDrawer directly
  list/
    [listId]/
      page.tsx                   ← Today view (shopping list for active list); sources listId from useParams()
      error.tsx                  ← catches GQL FORBIDDEN error; calls router.replace('/lists')
  lists/
    page.tsx                     ← list picker / all lists index; zero-lists state shows create CTA;
                                   never auto-redirects even if user has lists
  household/
    page.tsx                     ← household members + activity
lib/
  list/
    Queries.tsx                  ← LISTS_QUERY, CREATE_LIST_MUTATION, DELETE_LIST_MUTATION, SHARE_LIST_MUTATION
```

---

### Modified Frontend Files

| File                           | Change                                                                                                                                                                   |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/layout.tsx`               | Swap `ThemeProvider` → `CssVarsProvider` from `@mui/material/styles`; remove `AppHeader` + `Navigation`; add `BPBottomNav`; remove Inter font import                     |
| `app/page.tsx`                 | Redirect to `/list/[oldestListId]` if user has lists, else `/lists`                                                                                                      |
| `lib/apollo/ApolloWrapper.tsx` | Add `connectionParams: { Authorization: "Bearer <token>" }` to `GraphQLWsLink`; update `clearAuth()` to dispose → clear localStorage → clear React state (in that order) |
| `lib/theme.ts`                 | Migrate to MUI CSS variables mode; map color tokens from `design/theme.js`; remove Inter configuration                                                                   |
| `lib/item/Queries.tsx`         | Add required `listId` to `ITEMS_QUERY`, `SAVE_ITEM_MUTATION`, `ITEM_UPDATES_SUBSCRIPTION`                                                                                |
| `lib/category/Queries.tsx`     | Add required `listId` to `CATEGORIES_QUERY`, `CATEGORY_UPDATES_SUBSCRIPTION`                                                                                             |

---

### Story-to-File Mapping

This maps expected Epic 4 stories to the files they primarily touch. Exact story boundaries are defined in `epics.md`
once it is updated for Epic 4; this is a structural guide, not a story specification.

| Concern                        | Primary Backend Files                                                                       | Primary Frontend Files                                      |
|--------------------------------|---------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| List entity (CRUD + sharing)   | `entity/list/**`, `GQL.kt`, `Application.kt`                                                | `lib/list/Queries.tsx`, `app/lists/page.tsx`                |
| Item/category list-scoping     | `Item.kt`, `ItemStorage.kt`, `ItemService.kt`, `ItemApi.kt` (+ category equivalents)        | `lib/item/Queries.tsx`, `lib/category/Queries.tsx`          |
| Data migration                 | `plugins/Migration.kt`                                                                      | —                                                           |
| WebSocket auth                 | `plugins/GQL.kt` (WS auth gate)                                                             | `lib/apollo/ApolloWrapper.tsx`                              |
| Navigation redesign            | —                                                                                           | `app/layout.tsx`, `BPBottomNav.tsx`, `app/page.tsx`         |
| List Today view                | —                                                                                           | `app/list/[listId]/page.tsx`, `app/list/[listId]/error.tsx` |
| Theme migration                | —                                                                                           | `lib/theme.ts`, `app/layout.tsx`                            |
| CallerUsername / authorization | `features/auth/CallerUsername.kt`, `ItemService.kt`, `CategoryService.kt`, `ListService.kt` | —                                                           |

---

### Key Integration Boundaries

**Backend authorization boundary:** `CallerUsername` is constructed in GQL resolvers (`ListApi`, `ItemApi`,
`CategoryApi`). It crosses into service layer as a non-nullable parameter. The service layer calls
`listService.verifyMembership` — `ListService` is the single authority on membership. Services never call each
other's membership checks.

**Storage eviction boundary:** `ListService.deleteList` is the only caller of `evictList` on both `ItemStorage` and
`CategoryStorage`. No other code path evicts list data. GQL mutations do not touch storage directly.

**Frontend list context boundary:** `listId` is URL state. It enters the component tree via `useParams()` at the page
component level only (`app/list/[listId]/page.tsx`). It does not live in React context, is not stored in Apollo
cache variables, and is not prop-drilled more than one level.

**Theme boundary:** `CssVarsProvider` in `app/layout.tsx` is the single theme provider. No component imports or
instantiates a theme provider. Color values come exclusively from `lib/theme.ts` CSS variable definitions mapped from
`design/theme.js`.

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices are compatible. Kotlin 2.3.21 / Ktor 3.4.3 / graphql-kotlin 9.2.0 /
MongoDB Kotlin Coroutine Driver 5.5.1 have no version conflicts. `CssVarsProvider` is available in `@mui/material`
v9.0.0. `graphql-ws` 6.0.8 supports `connectionParams`. Arrow-kt 2.1.2 is available for service-layer error handling
in `ListService`.

**Pattern Consistency:** `CallerUsername` construction → GQL resolver; `verifyMembership` → service layer; data
access → storage. This chain is consistent across `ItemService`, `CategoryService`, and `ListService`. Naming
follows established conventions: `GqlListMapper`, `MongoListMapper`, `ListApi.kt`, `ListStorage.kt`.

**Structure Alignment:** `entity/list/` mirrors `entity/item/` and `entity/category/` exactly. `plugins/Migration.kt`
follows the `configure*()` convention. `features/auth/CallerUsername.kt` sits with auth infrastructure, not entity code.

### Requirements Coverage ✅

All nine Epic 4 functional requirements have architectural support:

| FR                      | Architectural Support                                               |
|-------------------------|---------------------------------------------------------------------|
| Create named list       | `createList` mutation, `ListService`, `ListStorage`                 |
| View/switch lists       | `lists` query, `/lists` route, `/list/[listId]` route               |
| Delete owned list       | `deleteList` mutation + `evictList` in `ListService.deleteList`     |
| Share list              | `shareList` mutation, `members` array in List document              |
| Items/categories scoped | `listId` on Item + Category; nested storage map                     |
| Access control          | `verifyMembership` in all list-scoped service methods               |
| Data migration          | `plugins/Migration.kt` with idempotency guard                       |
| Bottom tab navigation   | `BPBottomNav.tsx` replaces AppHeader + Navigation                   |
| Item extended fields    | `store`, `recurring`, `addedBy` in Item domain model and all layers |

All five NFRs (subscription scoping, service-layer auth, migration idempotency, no cross-list leakage, WebSocket
auth) are covered by the decisions in this document.

### Implementation Readiness ✅

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Minor Clarifications (non-blocking)

**1. `addedBy` is server-set, not client-provided.**
`addedBy: UUID?` is populated in the GQL resolver from `principal.userId` — it is **not** included in `ItemInput`.
Clients cannot supply or override this field. Migrated items have `addedBy: null`.

**2. `recurring` is a Kotlin enum in the domain model.**
Valid values (`weekly`, `biweekly`, `monthly`) are expressed as `enum class Recurring { WEEKLY, BIWEEKLY, MONTHLY }`
with `recurring: Recurring?` in `Item.kt`. The GQL model exposes it as a String (graphql-kotlin serializes enums as
strings by default). The Mongo model stores the enum name as a string field.

**3. `app/store/` is replaced, not co-existed.**
The current `app/store/` directory (Today view, item and category pages) is replaced by `app/list/[listId]/` during
Epic 4. Store components (`ItemsList.tsx`, `ItemView.tsx`, `CreateItem.tsx`, etc.) are migrated to the new route
structure or deleted. No story should leave `app/store/` as a live route alongside `app/list/[listId]/`.

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — all FRs architecturally covered, all critical decisions resolved, implementation patterns
address the identified agent conflict points, project structure delta is precise.

**Key Strengths:**

- `CallerUsername` value class makes authorization enforcement compile-time visible, not convention-only
- Two-point subscription scoping handles both subscribe-time rejection and mid-session membership revocation
- URL-as-list-state eliminates an entire category of context synchronization bugs
- Idempotent migration with `app_migrations` guard is safe across repeated restarts and test runs
- Testing patterns (negative-path, cross-tenant isolation, `takeWhile` test) are documented alongside implementation
  patterns

**Areas for Future Enhancement (Post-Epic 4):**

- Periodic WebSocket token re-validation mid-session (currently deferred)
- Membership revocation UX notification (currently silent flow termination)
- List-level subscription events (notify all members when someone joins/leaves)

### Implementation Handoff

**For AI Agents:**

- Read `project-context.md` before any implementation work — base conventions are there
- Read this document for all Epic 4-specific decisions and patterns
- The `Implementation Patterns & Consistency Rules` section contains mandatory rules; treat them as acceptance criteria
- The `Project Structure` section shows exactly which files to create and which to modify
- Run `npm run generate` after the backend schema story is merged, before starting any frontend story that touches
  items, categories, or subscriptions

**First Implementation Priority:**
Begin with the backend `List` entity vertical slice and `CallerUsername` value class — these unblock all downstream
stories. `plugins/Migration.kt` should be implemented in the same story or immediately after, since it must run on
startup before any list-scoped data can be correctly served.
