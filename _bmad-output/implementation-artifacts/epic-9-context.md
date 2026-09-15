# Epic 9 Context: User Feedback Pass

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Act on real user feedback from the running app. Users can send feedback (an idea, request or problem) from any screen, and the admin can review and delete it. Items can carry several stores, and no existing store value is lost. An item can be added from the shopping screen. The category filter menu can be closed on a phone, Home appears in the account menu, and the admin's user list is paginated. Underneath, deleting a category or a user no longer leaves orphaned data, recurring items checked through an edit keep working with the scheduler, and the E2E gate waits for a backend that is actually ready. Everything ships as one branch and one app version.

## Stories

- Story 9.1: The test run waits until the backend is ready
- Story 9.2: The admin's user list is paged instead of growing forever
- Story 9.3: Deleting a category deletes its items for everyone
- Story 9.4: Deleting a user leaves no phantom memberships
- Story 9.5: Checking an item through an edit keeps the scheduler working
- Story 9.6: An item can be in several stores
- Story 9.7: Home is in the account menu
- Story 9.8: The category filter menu can be closed on a phone
- Story 9.9: A user can send feedback from any screen
- Story 9.10: The admin reviews and clears feedback
- Story 9.11: An item can be added from the shopping screen
- Story 9.12: Small cleanups

## Requirements & Constraints

- **Feedback:** a regular user opens a single free-text form from the account menu. The text is required, at most 2000 characters after trimming. On submit, the server stores the text with the submitter's username and the server time; the user never sees, edits or deletes it afterwards. The admin does not send feedback. The admin sees all entries newest first, shown as plain text (never interpreted as markup), and deletes them permanently after confirmation. Entries have no status, reply or tags. Deleting a user keeps that user's feedback.
- **Admin scope:** the admin is limited to user management, app configuration and feedback review, and is still rejected by every list operation.
- **Multi-store:** an item has zero or more stores. Names are trimmed, and case-insensitive duplicates are dropped. Both item dialogs get a multi-value field that suggests existing stores and accepts new names. The shopping row shows every store inside its single check target. A one-time migration keeps every existing store value and does not re-run.
- **Pagination:** at most 20 users per page, sorted by username ascending, with prev/next controls and a total count. After a create or delete, the admin stays on a valid page.
- **Home entry:** the menu's Home entry goes where the title link goes. On the home route it only closes the menu.
- **Filter confirm:** the category menu has a Done control that only closes it. Selections apply live, with no revert, and tapping outside or pressing Escape still closes it.
- **Quick add:** a floating add button on `/list/:id` opens the existing add-item dialog. The button never permanently covers the last row. If the list has no categories, the dialog tells the user to create one first.
- **Binding on every story:**
  - E2E runs against the production artifact on desktop and at the 320px floor. Tests are UI-driven: API calls only for setup, no login fixture or storageState, no faked sessions. Horizontal overflow and clipping at 320px are asserted in code (NFR17/18/64/65).
  - Every new test must be seen failing before it is accepted.
  - New dialogs have visible labels, keyboard operation and errors tied to their fields.
  - Each story closes the deferred-work entries it discharges, in place, and reconciles `sprint-status.yaml` at close.
- **Out of scope:** one-timer/recurring UI (FR42/43), Phase 3 single-store shopping mode, Mongo transactions, feedback pagination or rate limit, a cap on stores per item, `/admin` page number in the URL.

## Technical Decisions

- **Stack:** brownfield, with no new dependencies and no upgrades (app 0.18.0 at start).
  - Backend slice layout is `entity/<name>/{Service,Storage,gql/,mongo/}`, called one way only: GQL → Service → Storage → Repository.
  - Reuse `GraphQLForbiddenException`, `GraphQLInvalidInputException` and `GraphQLNotFoundException`. Kotlin GraphQL classes are `Gql*` with `@GraphQLName`. Migration ids are `epic<N>-<slug>`.
  - Backend rules are proven with Kotest + Testcontainers.
  - Schema changes regenerate codegen in the same story; never edit `__generated__/`. `gradle.properties` and `package.json` versions stay equal.
- **Feedback slice:**
  - `entity/feedback/` has a repository only: no Storage cache, SharedFlow or subscription. Collection `feedback`: `_id` UUID stored as a string, `text`, `username` (plain string copy, no user reference), `createdAt`. Register the gql package in `GQL.kt`.
  - API: `sendFeedback(text: String!): Boolean!` takes text only and rejects the admin with Forbidden. The trimmed UTF-16 length must be 1..2000, else InvalidInput. `feedback: [Feedback!]!` is sorted by createdAt desc, then `_id`, unpaginated. `deleteFeedback(id: ID!): ID!` returns NotFound for a missing id.
  - The two private `requireAdmin()` copies merge into one `DataFetchingEnvironment.requireAdmin()` in `plugins/GqlAuth.kt`.
  - Client: validate the same trimmed length (no raw `maxLength`), render text only as React text nodes, never re-sort.
- **Stores:**
  - `stores: [String!]!` replaces `store` in every layer in one story: domain, Mongo, GQL, input, both mappers, repository, schema, frontend, and the raw GraphQL in E2E. `ItemRepository.save` sets `stores` and unsets `store` in one update.
  - The server normalizer is authoritative: `trim()`, drop empties, dedupe by `lowercase(Locale.ROOT)` keeping the first occurrence's casing and position. Suggestions return one name per key, the lowest by (lowercase, then compareTo), in that order.
  - The client mirror in `lib/lists/storeValue.ts` uses `trim()` + `toLowerCase()`. A casing-only edit counts as a change.
- **Migrations:** `configureMigration` runs `[epic4-list-seed, epic9-multi-store]` independently. Today it returns early once epic4 is recorded, so this must change. The new migration converts item documents one at a time (existing stores + `store`, normalized), unsets `store`, writes its completion record last, and runs before `configureGql`. Before deploying that release, `mongodump` the `db_data` volume; rollback means restoring the dump and running the previous image.
- **Check state:** one private `ItemService.applyCheckState(stored, checked, recurring, now)` serves check, uncheck and the `saveItem` update branch.
  - Checked one-time: set `deleted` and `deletedAt`.
  - Checked recurring: `checkedAt = stored.checkedAt ?: now`.
  - Checked with no cadence: stamp nothing.
  - Unchecked: clear all three.
  - Other server-owned fields survive the merge (FR58).
- **Category cascade:**
  - `CategoryService.deleteCategory` checks membership, deletes the category, then calls `internal ItemService.deleteAllInCategory`. That removes every item in the category, soft-deleted ones included, from Mongo and the storage map.
  - The server emits only the category `DELETED` event: the item SharedFlow is one-slot `DROP_OLDEST`, so per-item events would be dropped. Clients treat that event as authoritative and prune the category's items. The client-side delete loop in `ListDetailPage` goes away.
  - `saveItem` rejects a category from another list on create as well as update. `uncheckItem` rejects an item whose category no longer exists.
- **User purge:**
  - Only `ListService` writes memberships. `deleteUser` runs, in order: `adminDeleteUser`, then `ListService.purgeUser(userId, username)`, then `invalidateUserSessions`.
  - `purgeUser` is idempotent. It writes only through `ListStorage.save` and `ListMemberRepository` (no bulk repository `$pull`) and removes memberships in every status. Lists the user owns are deleted with a full cascade through a private `cascadeDeleteList` shared with `deleteList`.
  - New field `User.ownedListCount: Int!` feeds the delete dialog. List deletion emits no event.
- **Paging API:**
  - `users(limit: Int!, offset: Int, around: String): UserPage { users, totalCount, offset }`. The server clamps limit to 1..100 and offset to the last page; `around` returns the page that contains that user.
  - The unpaginated `users` field is removed.
  - Client: `cache-and-network`, and `cache.evict({fieldName:'users'})` + `gc()` after every create or delete.
  - E2E helpers never page-walk, and per-run data hygiene cannot use a retry loop.
- **Health endpoint:** `get("/health")` sits outside `authenticate` and rate limiting and is served at `/api/health`. It runs a Mongo ping inside `withTimeout(2.seconds)`: 200 on success, 503 otherwise. Playwright's `webServer.url` points at it. Add no probe tool to the `bp_back` image, and leave the service-worker `/api` denylist unchanged.
- **Frontend composition:**
  - Every Item-returning operation spreads the `ListItemFields` fragment. Admin operations live in `lib/admin/adminQueries.ts`.
  - The FAB reuses `AddItemDialog`. `StoreField` becomes one `string[]` component for both dialogs.
  - `AppShell` hosts the Home and Feedback entries once. Home uses `useHomePath('observe')`, which stays `cache-only`; its error branch is gated to resolve mode. The Feedback dialog is rendered by `AppShell`, not a route.

## UX & Interaction Patterns

- **No toast or snackbar.** A successful send shows an in-flow `<Alert severity="success" role="status">` (`feedback-sent`) rendered by `AppShell`. A failed send keeps the dialog open with the text intact and shows `feedback-error`. A deleted entry is confirmed by its row disappearing.
- **Feedback dialog:** follows the `CreateListDialog` conventions: `<form noValidate>`, validate on submit, a re-entry guard, controls disabled or spinning while in flight, `maxWidth="xs"`, and a counter showing the trimmed length. Test ids are `feedback-*`.
- **Account menu order:** Home, Lists, Change password (non-admin) or Admin, Feedback (non-admin), Logout. Each entry has a small outlined icon. Test ids `menu-home` and `menu-feedback`.
- **`/admin` feedback panel:** a `Paper` with an `h6` heading. States render in the order error → loading → empty → rows, with test ids `admin-feedback-*` and rows keyed by id. Text wraps at 320px. Delete uses `ConfirmDialog` (`delete-feedback-dialog`). Pager test ids are `admin-users-prev/next/page/total`.
- **Shopping row:** the accessible name stays exactly `Toggle <name>`. `Stores: A, B` goes in the accessible description, omitted when the item has no stores. Chips are non-interactive (`shopping-item-stores-<item>`, `shopping-item-store-<item>-<store>`).
- **FAB:** an MUI `Fab` with `aria-label="Add item"` and test id `shopping-add-item-fab`, fixed bottom-right with a safe-area inset, and the page reserves bottom padding for it. Adding is now a shopping-view action; editing and deleting stay on the management screen. Revise the empty-state copy to match.
- **Store field:** today it deliberately avoids a second combobox. The story must keep that or record why it changes, and must keep the `add-item-*` / `edit-item-*` test ids.
- **Filter Done button:** `filter-category-confirm`, sticky at the bottom of the menu, defined once in `ListFilters.tsx`.
- **Visual language unchanged:** dark-only theme, no new palette keys or theme overrides.
- **Design docs:** any story touching `App.tsx`, routes, `AppShell`, `playwright.config.ts`, `lib/lists/*` or `theme.ts` corrects `DESIGN.md` / `EXPERIENCE.md` (in `planning-artifacts/ux-designs/ux-epic-8/`) in the same commit.

## Cross-Story Dependencies

- 9.1 (health endpoint) lands first, because every later story is verified against the E2E gate.
- 9.2 (pagination + E2E data hygiene) lands early, because the create-user flake grows with every run.
- 9.3 lands before 9.11: its category check on `saveItem` create stops the FAB from creating items in a just-deleted category.
- 9.6 is indivisible (schema, mappers, repository, migration, codegen, E2E GraphQL, version bump). 9.11 depends on its multi-value store field for the dialog.
- 9.5 and 9.6 both edit `ItemService.saveItem` and `EditItemDialog`. 9.3 and 9.6 both touch `AddItemDialog`.
- 9.7 and 9.9 both edit the `AppShell` menu. 9.2, 9.4 and 9.10 all touch `AdminPage` / `UserAdminApi`: 9.10 introduces the shared `requireAdmin`, and 9.4 changes the delete-user flow.
- 9.12 runs last, after every `AppShell` story, and deletes only the `custom.bp.*` tokens still unused at that point.
