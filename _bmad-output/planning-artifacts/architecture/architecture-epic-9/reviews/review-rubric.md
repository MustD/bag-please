# Rubric Review: Architecture Spine for Epic 9 (User Feedback Pass)

- **Reviewed:** `ARCHITECTURE-SPINE.md` (draft, 2026-09-15) and its `.memlog.md`
- **Reviewer:** independent rubric review, 2026-09-15
- **Checked against:** `prd.md` (Epic 9 section, FR13/44/56/57/61/66-69, FR58, FR60), the parent `architecture.md`,
  `deferred-work.md` ("Routed to Epic 9"), `bp_back/CLAUDE.md`, `bp_front/CLAUDE.md`, and the code under
  `bp_back/src/main` and `bp_front/src` + `bp_front/e2e`

## Verdict

**Close, but not ready yet.** The spine picks the right divergence points: one `stores` field, server-side
normalization, independent migrations, parent-calls-child cascades, `ListService` as the only membership writer, and one
add-item dialog. Most of what it says about the existing code holds up: startup order, the early return in
`Migration.kt`, the exception classes, `lib/lists/storeValue.ts`, `AppShell`, and the service-worker `/api` denylist.

Two rules would not work as written once they meet the real code:

- **AD-6 pagination** breaks the existing E2E create-user helper. The rule has no way to find a user who lands on
  another page.
- **AD-7's emit-per-child promise** cannot hold on the existing `SharedFlow` configuration. The cascade also misses
  soft-deleted items.

Other gaps:

- The inherited `requireAdmin()` cannot be called from a new package as the spine assumes.
- There is no Open Questions section, and the two `[ASSUMPTION]`s and md's cold-start question are not tracked.
- The operational envelope is declared "unchanged", yet AD-5 makes a one-way destructive data change.

Severity counts: critical 0 · high 3 · medium 9 · low 8.

---

## Findings

### H1 (high): AD-6 has no way to reach a user who is not on the current page, which breaks the E2E admin flows

- **Location:** AD-6; Consistency Conventions / Tests; Inherited row "E2E is UI-driven".
- **Problem:** AD-6 sorts users by `username` and, after a create, keeps the admin on `min(current, lastPage)`. A newly
  created user therefore usually lands on some other page. The existing helper `createUserViaUi`
  (`bp_front/e2e/admin.spec.ts:43-51`) ends with `expect(getByTestId('admin-user-row-${username}')).toBeVisible()`. The
  reset-password and delete specs find rows the same way. As soon as the table holds more than 20 users (after one full
  suite run it holds about 120), these tests fail or depend on username ordering.

  The AD claims to prevent "a page shape the admin UI and the E2E helpers read differently". Yet it leaves open how a
  UI-driven test (NFR18 forbids API shortcuts for the flow under test) reaches its user. The pagination story and the D4
  data-hygiene story will each pick their own answer:
    - navigate pages until the row appears
    - jump to the page that holds the created user
    - add a username filter
    - wipe users per run
- **Fix:** Decide it in AD-6. Two options:
    - **(a)** After a successful create, the client jumps to the page that contains the created user. The server can
      return its index, or the client can compute it from a `userPage(containing: username)` query. Then
      `admin-user-row-<name>` is visible without paging. FR13 says "keeps the admin on a valid page", which this
      satisfies.
    - **(b)** Keep `min(current, lastPage)` and fix a single E2E helper contract (`findUserRowViaUi` pages forward via
      `admin-users-next` until the row appears), owned by the FR13 story.

  Also name the pagination test ids (`admin-users-prev`, `admin-users-next`, `admin-users-total`) in Naming, so the UI
  and helpers agree.

### H2 (high): AD-7 promises one deletion event per child, but the item `SharedFlow` drops them

- **Location:** AD-7; Consistency Conventions / "Mutation & events".
- **Problem:** `ItemService.itemDeleteChannel` is
  `MutableSharedFlow(extraBufferCapacity = 1, onBufferOverflow = DROP_OLDEST)` (`ItemService.kt:27-29`). Emitting N
  deletions in a tight loop never suspends. Any subscriber that has not collected keeps only the last one. So "emits one
  item deletion per removed item" does not actually stop "other members' shopping views keeping deleted items", which is
  the divergence the AD claims to prevent.

  Two stories can now reasonably disagree:
    - the backend story assumes events are delivered
    - the frontend story assumes it must prune items locally when a category `DELETED` arrives

  Today `ListShoppingPage.tsx:297` only filters the category out of its cache and leaves that category's items in the
  Apollo cache.
- **Fix:** Pick one contract and write it into AD-7:
    - **(a)** The client is authoritative for cascades. On a category `DELETED` event, both list surfaces drop cached
      items whose `category` equals the deleted id. Server per-item emits become best-effort.
    - **(b)** Raise the buffer, or switch the cascade to `suspend emit` with enough capacity, and test a slow
      subscriber.

  (a) is cheaper and also covers the existing `deleteList` path, which emits nothing. Either way, add "cascade events
  may be coalesced" to the Mutation & events convention.

### H3 (high): AD-7's cascade misses soft-deleted items, and FR58's create branch can still orphan items

- **Location:** AD-7; carry-in "Story 8.5, the orphan CAUSE".
- **Problem:**
    1. `ItemStorage.getByListId` filters out `deleted = true` items (`ItemStorage.kt:34-37`). A `deleteAllInCategory`
       built the obvious way on top of it leaves soft-deleted one-timers behind. `uncheckItem` (undo) then restores such
       an item into a category that no longer exists, which is an orphan again. The scheduler removes them only within
       the hour.
    2. `saveItem` checks that the category belongs to the list only in the update branch (`ItemService.kt:44-50`, the
       "create hole" pinned by a tripwire test). Epic 9 adds a second create entry point: the FR68 FAB on the shopping
       view, where categories change live. A stale `AddItemDialog` there can create an item in a just-deleted category.
       FR58 itself says such a save "is rejected". The carry-in is named "the orphan CAUSE", but AD-7 closes only one of
       the two causes.
- **Fix:**
    - In AD-7, require `deleteAllInCategory` to work on the raw per-list map, or on `repository` plus a storage
      eviction, and include soft-deleted items.
    - Either extend the category-existence check to the create branch of `saveItem` (retiring the tripwire test), or
      list the create hole explicitly under Deferred with the FR68 exposure noted.
    - Require `uncheckItem` to reject when the item's category is gone.

### M1 (medium): the inherited `requireAdmin()` is a private copy in two files and cannot be reused

- **Location:** Inherited Invariants row "Admin GQL ops gated by `requireAdmin()`"; AD-2; Structural Seed
  (`entity/feedback/gql/FeedbackApi`).
- **Problem:** `requireAdmin` is a `private fun DataFetchingEnvironment.requireAdmin()` duplicated in
  `UserAdminApi.kt:15` and `ApplicationConfigApi.kt:12`. `FeedbackApi` in a new package cannot call either copy, so the
  story will make a third copy. That is exactly the drift an inherited gate should prevent. A third copy could, for
  example, gate on `username == adminLogin` instead of the role claim.
- **Fix:** Add to AD-2, or as a small AD: "lift `requireAdmin` to one `internal` extension in `plugins/` (e.g.
  `plugins/GqlAuth.kt`), delete both private copies, and have `FeedbackApi` use it." Also note that `GQL.kt`'s schema
  `packages` list must gain `com.bagplease.entity.feedback.gql`. Registering the Query/Mutation classes is not enough
  for graphql-kotlin type resolution.

### M2 (medium): `purgeUser` breaks the NFR-L2 bridge claimed in Inherited Invariants and cannot reuse `deleteList`

- **Location:** AD-8; Inherited Invariants row NFR-L2 ("Cascade helpers called without a caller still sit behind a
  public method that performs the check").
- **Problem:**
    - `ListService.purgeUser(user)` writes list-scoped data with no caller membership check. Its only guard is
      `requireAdmin()` in `UserAdminMutations`. That contradicts the spine's own Inherited row, which says caller-less
      helpers sit behind a method that checks membership.
    - "Deletes every list they own through the same cascade as `deleteList`" cannot literally reuse `deleteList`. That
      method starts with `ensure(caller != adminLogin)` and `ensure(list.ownerUsername == caller)`
      (`ListService.kt:117-120`), so two stories may either copy the cascade or pass a fake caller.
    - Kotlin `internal` is module-wide in this single-module backend, so it restricts nothing.
- **Fix:**
    - Amend the NFR-L2 row: "list-scoped writes without a member caller are allowed only from admin-gated orchestration
      (`UserAdminMutations`, after `requireAdmin()`)."
    - In AD-8, require extracting a private `cascadeDeleteList(list)` that both `deleteList` (after its owner check) and
      `purgeUser` call.
    - Drop the implication that `internal` enforces anything, or say GraphQL exposure is controlled by which classes are
      registered in `GQL.kt`.

### M3 (medium): AD-8 owned-list deletion is an unconfirmed destructive assumption with no Open Question entry

- **Location:** AD-8 `[ASSUMPTION: owned lists are deleted, not transferred]`; missing Open Questions section.
- **Problem:** Deleting a user silently deletes shared lists that other members actively use, along with all items. That
  destroys data belonging to other users. FR15 and FR17 confirmation copy ("Delete user?") do not warn about it.

  The memlog says "Needs md confirmation", but the spine has no Open Questions section, so nothing blocks a story from
  building on it. The frontend `DeleteUserDialog` copy (FR17) and the backend behaviour could also diverge.
- **Fix:**
    - Add an **Open Questions** section listing:
        - this assumption
        - the AD-10 dialog-vs-route assumption
        - md's open "cold-start home-link" question (carry-in, Code review of 7-5)
    - For each, name the owner and the story that is blocked until it is answered.
    - If deletion stands, require `DeleteUserDialog` to state how many owned lists will be deleted, e.g. from a
      `ownedListCount` field on `User`, or say that no warning is shown by decision.

### M4 (medium): the operational envelope is declared unchanged, but AD-5 is one-way with no backup or rollback rule

- **Location:** AD-5; Deferred / "Operational envelope".
- **Problem:** `epic9-multi-store` does `$unset: store`. Rolling back to 0.18.0 after the migration leaves every item
  without a visible store. The old `ItemRepository.save` then `$set`s `store: null` on every edit, so a later re-deploy
  of 0.19 would not re-run (the migration is already recorded). The data in `stores` would survive, but the rollback
  path is undefined.

  This is also the first migration since `db_data` moved to a named volume (root `CLAUDE.md`). The spine claims nothing
  operational changes.
- **Fix:** Add a sentence to AD-5 or the envelope. Either:
    - "deploy of 0.19 requires a `mongodump` of `items` first; rollback = restore dump + old image", or
    - "the migration copies `store` to `stores` and leaves `store` in place; a later epic unsets it."

  (The second still satisfies AD-3, since the domain, Mongo model and schema no longer read the field.)

### M5 (medium): AD-4 does not decide which casing wins in suggestions or across items

- **Location:** AD-4.
- **Problem:** "`itemStoreSuggestions` returns names deduped by that key" does not say which casing survives when item A
  holds `Lidl` and item B holds `LIDL`. `ItemStorage` is backed by `ConcurrentHashMap`, so "first seen" is
  nondeterministic, and suggestion chips would flicker between casings. E2E testids built from the suggestion text
  (`add-item-store-suggestion-${suggestion}`) would also be unstable.

  Other gaps:
    - Internal whitespace (`Whole  Foods`) is not addressed.
    - Kotlin `trim()` and JS `trim()` differ on U+FEFF and a few other characters, so the "client mirror" can disagree
      with the server.
- **Fix:** Fix a deterministic tiebreak, e.g. "the casing held by the most items; ties broken by lexicographic
  (`compareTo`) order". Either collapse internal whitespace runs to one space or state explicitly that they are kept.
  Define trim as "strip `\s` per the JS definition", implemented identically on both sides, or say the client only trims
  ASCII whitespace for preview and the server result is authoritative after save.

### M6 (medium): the FR44 shopping row's accessible name and test ids for several stores are not fixed

- **Location:** AD-3 / AD-10; Consistency Conventions / Naming; Capability map row FR44.
- **Problem:** FR44 requires the row to show every store inside the single FR60 check target. Today
  `ListShoppingPage.tsx:73` builds the accessible name as `Store: ${item.store}`, and the chip test id is
  `shopping-item-store-${item.name}`. With several stores:
    - the accessible-name format is undecided ("Stores: A, B"? one phrase per store?)
    - the per-chip test id is undecided (`shopping-item-store-${name}` is no longer unique)
    - the chip-click region used by `shopping.spec.ts:334` has no defined target

  The FR44 story and later FR68/FR61 E2E specs will drift.
- **Fix:** In Naming, define:
    - `shopping-item-stores-${itemName}` for the chip container
    - `shopping-item-store-${itemName}-${storeName}` for each chip
    - the accessible name segment "Stores: A, B", with the segment omitted when there are no stores

  Restate that the chips stay non-interactive inside the row button (FR60).

### M7 (medium): AD-9 has the compose healthcheck probing "through Caddy", and the image has no probe binary

- **Location:** AD-9; Deferred / Operational envelope.
- **Problem:**
    - A compose `healthcheck` belongs to a container. Probing `:2080/api/health` through Caddy from the backend
      service's healthcheck makes the backend's health depend on the frontend container. From the Caddy service it only
      proves the proxy chain.
    - The runtime image is `eclipse-temurin:25` (`bp_back/Dockerfile`). The spine does not say whether it has `curl` or
      `wget`, so a story may add a dependency or a JVM-based probe ad hoc.
    - Ktor's `rootPath: "api"` (`application.yaml`) means the route is declared as `get("/health")`, not `/api/health`.
      A story writing `get("/api/health")` would serve `/api/api/health`.
- **Fix:** Reword:
    - "Ktor route `get("/health")` (served at `/api/health` via `rootPath`)"
    - "Playwright `webServer.url` = `http://localhost:2080/api/health`" (Playwright treats Caddy's 502 and Ktor's 503 as
      not ready, which is what is wanted)
    - "a compose healthcheck, if added, runs on `bp_back` against `localhost:4000/api/health` using a tool verified
      present in the image, or is deferred"

  Also cover the other two `webServer` gaps from the routed rollup entry (no teardown, no stdout filtering). Mark them
  in scope or deferred, since they are part of carry-in F20.

### M8 (medium): PRD requirements quietly dropped or left implicit

- **Location:** Capability → Architecture Map; AD-2, AD-6, AD-10.
- **Problem:** These PRD clauses have no home in any AD, convention or deferral:
    - **FR66 "confirms that it was sent"**: no feedback pattern (snackbar vs inline) is named. Nor is the failure path:
      does the dialog stay open with the text kept?
    - **FR66 "cancelling sends nothing"** and **"returns the user to the screen they came from"**: covered implicitly by
      the AD-10 dialog, but only under an `[ASSUMPTION]`. If the assumption flips to a route, FR66 has no rule.
    - **FR67 "explicit confirmation" before delete (FR17)**: the existing `ConfirmDialog.tsx` is not named, so a story
      may build its own.
    - **FR67 display fields** (text, username, submission time): the time format is not fixed; `createdAt` ISO is shown
      how?
    - **FR13 "display of the total user count"**: `totalCount` exists but displaying it is not stated, and neither is
      "deleting the only user on the last page moves back one page". The `min(current, lastPage)` rule covers the
      latter, but no test is required.
    - **FR57 "on the home route the Home entry simply closes the menu"**: the spine does not say the entry reuses
      `useHomePath('observe')` and the existing `alreadyHome` compare in `AppShell`. The existing **"Lists" menu entry**
      (`menu-lists`) sits beside the new Home entry, and nothing says whether it stays.
    - **FR57 carry-ins** (`/lists` dead end, `useHomePath` branch order) appear only in the map with no governing rule.
      That is acceptable for a single-story area, but md's open cold-start question must be tracked (see M3).
    - **FR68 "never permanently covers the last item row"**: story-level is fine, but the 320px floor assertion for the
      FAB is not listed among the "dialogs touched" in Tests.
- **Fix:** Add one line per item to the Capability map's "Governed by" column. It can read "story-level, no cross-story
  invariant". For FR67 confirmation, name `ConfirmDialog`. For FR66 confirmation, name the shared notice pattern. For
  FR57, state that Home reuses `useHomePath('observe')` and `alreadyHome`, and decide the fate of the `Lists` entry.

### M9 (medium): FR61, F2 and F5 are "governed by" a Consistency Conventions row that does not exist

- **Location:** Capability map row "FR61 filter confirm (+ F2, F5) → Consistency Conventions (frontend-only)"; Deferred
  F2/F5.
- **Problem:** The Consistency Conventions table has no FR61 or filter row, so the map points at nothing. F5 ("reserve
  or de-key `Uncategorized`") is not purely frontend if the chosen answer is "reserve". Reserving means
  `CategoryService.saveCategory` must reject the name, which is a backend change riding the unfreeze. A backend story
  and the FR61 story could pick different options.
- **Fix:** Point the row at "story-level (Deferred)" and say explicitly that F5 is decided as **de-key** (frontend-only:
  key the Uncategorized bucket by a sentinel id, not a name). If "reserve" is preferred, add a one-line AD saying the
  server rejects the name, case-insensitively.

---

### L1 (low): AD-1 does not fix how the feedback `_id` is stored

- **Location:** AD-1.
- **Problem:** The repo stores UUIDs inconsistently. `UUIDSerializer` writes strings; items filter with `id.toString()`
  (the `ItemRepository.findById` comment warns that "a raw-UUID filter matches nothing without reporting anything").
  `UserRepository` filters with a raw `UUID`. `deleteFeedback(id)` can silently match nothing.
- **Fix:** Store `_id` as a string via `UUIDSerializer` and filter with `id.toString()`. Require a test showing that
  delete removes the document.

### L2 (low): AD-2 leaves the length semantics and the error class for invalid input implicit

- **Location:** AD-2; Errors convention.
- **Problem:** "Longer than 2000 characters" is not said to be measured after trimming or in UTF-16 units (Kotlin
  `length` and HTML `maxlength` both use UTF-16 units, so choose that explicitly). The error for blank or oversized text
  is not named.
- **Fix:** "Count `trim().length` (UTF-16 code units) on both sides; blank or >2000 → `GraphQLInvalidInputException`;
  the client `maxLength` = 2000 on the raw field."

### L3 (low): there is no abuse bound on `sendFeedback`

- **Location:** AD-2; Deferred.
- **Problem:** Any authenticated user can post without limit into an unpaginated admin query. The auth rate limiter does
  not cover GraphQL.
- **Fix:** Add a Deferred entry, "no per-user rate limit on `sendFeedback`; revisit on abuse", so the omission is a
  decision.

### L4 (low): the migration refactor does not pin the ordering or the fresh-install behaviour of `epic4-list-seed`

- **Location:** AD-5.
- **Problem:** `Migration.kt` also returns early *without* writing a record on fresh installs ("No unscoped items…").
  After the refactor, a story might start recording `epic4-list-seed` on fresh installs, or might not. That is harmless
  but untested. The order within the list is also not fixed: FR69 on documents that still lack `listId` is
  order-independent, but say so.
- **Fix:** "Migrations run in declaration order `[epic4-list-seed, epic9-multi-store]`; each keeps its existing record
  semantics; a test starts with `epic4-list-seed` recorded and asserts `epic9-multi-store` still runs."

### L5 (low): AD-3 does not name the hand-written `$set` in `ItemRepository.save`

- **Location:** AD-3; Structural Seed `entity/item/`.
- **Problem:** `ItemRepository.save` builds its update with string-literal field names
  (`Updates.set("store", item.store)`, `ItemRepository.kt:59`). The seed lists only `Item`, `MongoItem`, `GqlItem` and
  `GqlItemInput`. The mappers (`GqlItemMapper`, `MongoItemMapper`) and the `e2e/item-editing.spec.ts:56` raw GraphQL
  setup query (`... store recurring`) also have to change.
- **Fix:** Add `mongo/ItemRepository.save` (`"stores"` literal), both mappers and `e2e/item-editing.spec.ts` to the seed
  line.

### L6 (low): the `checkedAt` carry-in is listed in neither the map nor an AD

- **Location:** Capability map; AD-3 ("merges `stores` exactly as it merged `store`").
- **Problem:** The routed carry-in "`saveItem` stamps `checkedAt` on a false→true merge" (Story 7.4) and the two
  `EditItemDialog` carry-ins (stale comments, orphan dialog closing silently) ride the FR44 story but appear nowhere.
  The `checkedAt` rule also interacts with FR58: the PRD says `checkedAt` "survives the save unchanged".
- **Fix:** Add a map row for the `saveItem` `checkedAt` stamp. State that stamping on false→true (and not clearing on
  true→false) is the reading of FR58 in force.

### L7 (low): users sort order does not specify a collation

- **Location:** AD-6.
- **Problem:** Mongo's default sort is binary (`Zed` before `alice`). FR13 says "username, ascending" without a
  collation, so the UI expectation and an E2E ordering assertion could disagree.
- **Fix:** State "binary (default) collation, matching the case-sensitive unique index", or require
  `Collation.locale("en").strength(2)`.

### L8 (low): the small-cleanups row says "none", but one item is a decision

- **Location:** Capability map, "Small cleanups".
- **Problem:** "Adopt or delete the four `custom.bp.*` theme tokens" is a choice. The FR57/FR66 AppShell work touches
  the theme too (`theme.custom.bp.navBg`), so a story could adopt a token the cleanup story deletes.
- **Fix:** Decide "delete the unused four" (or name which ones get adopted), or mark the cleanup story to run after the
  AppShell stories.

---

## Claims verified against code (no finding)

- `Application.kt`: `configureMigration` runs before `configureAuthRoutes`, `configureGql` and `configureRouting`. The
  scheduler starts inside `configureGql`, and storages sync lazily. AD-5's "no cache populated before it" holds.
- `Migration.kt`: `return@runBlocking` fires as soon as `epic4-list-seed` is found, so AD-5's stated divergence is real.
- Exception classes: `GraphQLForbiddenException`, `GraphQLInvalidInputException`, `GraphQLNotFoundException` and
  `GraphQLConflictException` all exist (Java, `plugins/`).
- `ListService.deleteList` is ordered and non-transactional, then evicts caches. The comment matches the inherited row.
- `UserAdminMutations.deleteUser` today runs `adminDeleteUser` then `invalidateUserSessions` and never touches
  `list_members`. The carry-in is real.
- `ListDetailPage.tsx:449-450`: the client loop deletes items before the category.
- `lib/lists/storeValue.ts` (`STORE_MAX = 100`, `normalizeStore`), `components/StoreField.tsx`,
  `components/AppShell.tsx` and `lib/lists/homePath.ts` all exist as named.
- `vite.config.ts` has `navigateFallbackDenylist: [/^\/api/]` with empty `runtimeCaching`.
- The auth `RateLimit` is registered by name and applied only to auth routes. A health route outside it is unaffected.
- `playwright.config.ts` `webServer.url` is `http://localhost:2080` (proves Caddy only). F20 is real.
- The dependency diagram matches the current constructors: `ItemService(… listService, … categoryStorage)`,
  `CategoryService(storage, listService)`, and `ListService` holding item/category storage and repositories.
  `CategoryService → ItemService` is a new edge, and no cycle is introduced.
