---
review: adversarial
target: _bmad-output/planning-artifacts/architecture/architecture-epic-9/ARCHITECTURE-SPINE.md
date: 2026-09-15
lens: construct two story-level units that each obey every AD to the letter yet build incompatibly
verdict: NOT READY — 5 High, 5 Medium, 2 Low holes; every High is closable with one tightened rule
---

# Adversarial Review — Epic 9 Architecture Spine

Method: for each finding, two units one level below the spine (stories or story halves) are built so that each one
complies with every AD as written. The collision between them is the hole. Code facts come from the working tree on
`epic-9` (2026-09-15).

Severity: **High** = data loss, a permanent orphan, or a red E2E gate that the spine makes likely. **Medium** =
user-visible divergence or a flake class. **Low** = cosmetic or narrow.

---

## F1 — High — FR69 migration can be skipped for items saved by the new code (data loss)

**Unit A — FR44 multi-store story (AD-3, AD-4).** Removes `store` from `Item`/`MongoItem`/`GqlItem`/`ItemInput`,
adds `MongoItem.stores = emptyList()`, and rewrites `ItemRepository.save` to `Updates.set("stores", item.stores)`.
AD-3 says "in the same story" for the schema change, which this satisfies.

**Unit B — FR69 conversion story (AD-5).** Adds `epic9-multi-store`, which matches only documents "where `stores` is
missing", runs before `configureGql`, and records completion last. This is also compliant.

**How they diverge.** Nothing binds A and B to the same story, commit, or deploy. If A lands first on any database
that is later migrated (the dev `db_data` volume, the E2E stack, or a prod deploy of an intermediate build), the
running code decodes legacy documents with `stores = []`. `EditItemDialog` shows no store. Any save, including a
check-through-edit or rename, writes `stores: []` while the old `store` stays on the document. When B runs, its filter (
"`stores` missing") skips that document, and FR69's promise ("an item that had a store keeps it") is broken
silently. The same happens if the save path sets `stores` but never unsets `store`: B's `$unset` never reaches those
documents, so both fields persist forever. Even in one release, A's repository must decide whether `save` unsets
`store`. AD-3 is silent on this, so a "harmless" leftover field is compliant.

**Proposed rule (tighten AD-5, cross-reference from AD-3):**

> **AD-5 (amended).** The `epic9-multi-store` migration ships in the same story and commit as the `MongoItem.stores`
> field. No build that decodes `stores` may exist without it. The migration's filter is **`store` exists**, not
> "`stores` missing". For each match it sets `stores` to the AD-4 normalization of
> `(existing stores ?: []) + [store]` and then `$unset`s `store`, so a document touched by new code before the
> migration still keeps its legacy value. `ItemRepository.save` writes `stores` with `$set` and `$unset`s `store` in
> the same update. The migration's backend test seeds three documents: legacy `store` only, `stores: []` with a
> leftover `store`, and already converted. It asserts all three end with `store` absent and the legacy value present.

---

## F2 — High — Cascade emissions are dropped by the existing SharedFlow buffer, leaving ghost items on other members' screens

**Unit A — category-cascade story (AD-7).** `ItemService.deleteAllInCategory` loops over the category's items and
calls `itemDeleteChannel.emit(item)` for each one, then `CategoryService` emits the category deletion. This follows
AD-7's wording exactly ("emits one item deletion per removed item before the category deletion").

**Unit B — shopping view (unchanged, inherited).** `ListShoppingPage` `subscribeToMore` removes an item from
`getItems` only when an `ItemUpdate` with `type: DELETED` for that id arrives. The category handler removes only the
category.

**How they diverge.** Both flows are `MutableSharedFlow(extraBufferCapacity = 1, onBufferOverflow = DROP_OLDEST)`
(`ItemService.kt:24-29`). `emit` never suspends. It overwrites the one-slot buffer of any collector that has not
drained yet, and each subscriber does a `map`, a GraphQL serialize, and a WebSocket write per event. A burst of N
deletions therefore delivers roughly the last one or two to a remote member. Unit B keeps the rest: items whose
category is gone. `groupItemsByCategory` then shows them in the synthetic `Uncategorized` bucket, and any action on
them fails or recreates the orphan class that AD-7 exists to kill. The two E2E actors in one test (the delete on
`/lists/:id` and the observer on `/list/:id`) will flake with a timing-dependent count. The spine also says cascades
"emit per child" in Consistency Conventions and never mentions the buffer.

**Proposed rule (new AD-7a, plus a line in Mutation & events):**

> **AD-7a — Cascade delivery is lossless on both ends.** (1) Server: every list-scoped SharedFlow that a cascade
> emits on is created with `onBufferOverflow = SUSPEND` and `extraBufferCapacity >= 64`. Alternatively, and
> preferably, the cascade emits one event per parent: the category `DELETED` event, emitted after the items are
> gone. A child flood is not an acceptable delivery mechanism. (2) Client: a category `DELETED` event is
> authoritative for its children. The shopping-view category handler also removes every `getItems` entry whose
> `category` equals the deleted id, through `cache.updateQuery` on `ItemsQuery` for the same `listId`. Per-item
> events remain an optimization, never the only path. The E2E for the cascade deletes a category holding at least 5
> items while a second member watches `/list/:id`.

---

## F3 — High — Cascade write order plus the unguarded create branch let the new FAB re-orphan items

**Unit A — category-cascade story (AD-7).** Sweeps items first, then deletes the category, then emits in the order
AD-7 dictates. Writes and emits naturally follow the same order.

**Unit B — FR68 FAB story (AD-10).** Opens `AddItemDialog` on `/list/:id` with the `categories` prop from the
shopping view's subscription-maintained cache. Saving goes through `saveItem`'s **create** branch, which by design
has no category-membership check ("The create hole is filed", `ItemService.kt:46-50`).

**How they diverge.**
(a) *Race:* member X opens the FAB dialog while member Y deletes the category. X's create lands after Y's item sweep
and before or after the category delete. In both cases the create succeeds with a dead category id and a permanent
orphan. Before Epic 9, create happened only on `/lists/:id`, where the category row is the entry point. The FAB makes
a stale-category create a first-class path, and F2 guarantees X's picker is stale. (b) *Soft-deleted children:* the only
list accessor on `ItemStorage` is `getByListId`, which filters
`!it.deleted`. A compliant `deleteAllInCategory` built on it misses the one-timers checked in the last hour. The
shopping view's undo snackbar (`uncheckItem`) then restores one of them into the deleted category. That creates an
orphan again, reachable through normal UI.

**Proposed rule (tighten AD-7):**

> **AD-7 (amended).** Write order is **category first, then items**: `CategoryStorage.delete`, then
> `ItemService.deleteAllInCategory`, which removes **every** item whose `category` matches from the raw storage map,
> including `deleted = true` rows. Emission order is items, then category, as before. Close the create hole in
> `saveItem` in the same story: both branches reject a `category` not present in
> `CategoryStorage.getByListId(listId)` with the existing
> `"Category … does not belong to list …"` message. `uncheckItem` rejects an item whose category no longer exists.
> `AddItemDialog` maps that error through `itemSaveErrorMessage`, the path `EditItemDialog` already uses.

---

## F4 — High — Server pagination plus the UI-driven E2E helpers make the admin suite fail by construction

**Unit A — FR13 pagination story (AD-6).** The page size is 20, sorted by username. After a create, the client stays
on `min(current, lastPage)`, which is exactly what AD-6 says.

**Unit B — E2E admin specs (inherited NFR18, "UI-driven").** `createUserViaUi` ends with
`expect(getByTestId('admin-user-row-${username}')).toBeVisible()` (`admin.spec.ts:43-51`), and every admin test
depends on it.

**How they diverge.** The new user `admin_e2e_<label>_<project>_<ts>` sorts into whatever page its name falls on.
Unit A keeps the admin on the current page (page 1), so the assertion fails as soon as more than 20 users sort before
it. That describes the persistent `db_data` volume after a few runs, since all `acct_e2e_*` users sort before
`admin_*`. Walking pages does not save Unit B either: `fullyParallel` plus both projects registering users all the
time (`registerViaUi` in every other spec) shifts offset page boundaries between two page reads, so a walker can skip
the row. The spine's Deferred section says "AD-6 removes the size-driven cause" of D4. In fact it replaces an O (n)
render flake with a deterministic location miss.

**Proposed rule (tighten AD-6; option 1 needs an FR13 wording check with md):**

> **AD-6 (amended).** `users(offset: Int!, limit: Int!, search: String): UserPage!`. `search` is trimmed and matched
> as a case-insensitive **substring** of `username` in Mongo, with the pattern regex-escaped. `totalCount` counts the
> filtered set. `/admin` exposes a search field (`admin-users-search`), plus `admin-users-prev`, `admin-users-next`,
> `admin-users-page` and `admin-users-total`. After a create, the client navigates to the page that contains the
> created user by querying with `search` set to the new username, or by clearing the search and jumping to
> `floor(rank / 20)`, where `rank` comes from the `createUser` payload (`UserCreated { user, rank }`). E2E helpers
> never assert a row without first narrowing the table to that exact username through the search field. A bare
> page-walk is forbidden, because concurrent registration makes offset pages unstable.
>
> *If md rejects a search field:* replace it with `createUser` returning `rank`, the client landing on that page, and
> E2E asserting the row right after the create and before any other navigation. Accept the residual race, and file
> D4 hygiene (delete every E2E-created user through the UI in `afterEach`) as mandatory, not optional.

---

## F5 — Medium — Apollo cache: pages keyed by args go stale, and deleted feedback lingers

**Unit A — AdminPage pagination (AD-6).** `useQuery(AdminUsersQuery, {variables: {offset, limit}})` with the default
`cache-first`. Create and delete call `refetch()`, the existing pattern at `AdminPage.tsx` and in the dialogs.

**Unit B — delete-user and page-clamp flow (AD-6).** After a delete, `totalCount` shrinks and the client moves to
`min(current, lastPage)`, which changes variables.

**How they diverge.** `refetch()` refreshes only the current variables. `UserPage` has no id, so it is stored inline
under `ROOT_QUERY.users({"limit":20,"offset":N})` per page. Moving to a page visited earlier is served **from cache**,
and every row after the deleted username is shifted by one there. The admin sees a duplicate or a
missing user, and E2E rows appear or vanish depending on history. Feedback has the same shape: `Feedback` normalizes
by `id`. If `deleteFeedback` returns `Boolean` and the page calls `refetch`, a slow refetch leaves the row visible
after the confirm dialog closes. If it returns `Feedback`, Apollo keeps the entity and the list reference. AD-2
defines neither the return type nor the cache effect.

**Proposed rule (new convention row "Frontend cache"):**

> Admin collections are network-authoritative. `AdminUsersQuery` and `AdminFeedbackQuery` use
> `fetchPolicy: 'cache-and-network'`. After `createUser` or `deleteUser` succeeds, the mutation `update` calls
> `cache.evict({ fieldName: 'users' })` and `cache.gc()` before any page change. `deleteFeedback(id: ID!): ID!`
> returns the id, and its `update` evicts `cache.identify({__typename: 'Feedback', id})` and then calls `gc()`.
> `feedback` is ordered only by the server (`createdAt` descending, tie broken by `_id`), and the client never
> re-sorts it.

---

## F6 — High —
`purgeUser` races the doomed user's still-valid access token, and a mongo-direct purge bypasses the list cache

**Unit A — user-delete cascade story (AD-8).** Runs `purgeUser`, then `adminDeleteUser`, then
`invalidateUserSessions`, the order AD-8 dictates. To be efficient and still "only ListService writes membership",
`purgeUser` uses `listMemberRepository.deleteAllForUser(userId)` plus a `listRepository` `updateMany`
`$pull memberUsernames`.

**Unit B — ordinary list operations (inherited).** `verifyMembership` and `isMember` (the subscription `takeWhile`)
read `ListStorage`'s **in-memory** map. `createList` and `acceptInvite` look the caller up with
`userRepository.findByUsername`.

**How they diverge.**
(a) *Cache bypass:* a repository-level `$pull` complies with "only `ListService` writes" but never touches
`ListStorage`. `verifyMembership` still says yes, the deleted user's subscription stream never ends, and the next
`listStorage.save` of that list writes the phantom member back to Mongo. This is the exact phantom AD-8 claims to
prevent. (b) *Token window:* JWT access tokens remain valid for `accessExpiryMinutes`, and `invalidateUserSessions` only
deletes refresh tokens. Between steps 1 and 2 the doomed user can still call `createList` (the user row still
exists), which creates an owned list after the purge. That list has an `ownerId` with no user and can never be
deleted. `acceptInvite` in that window leaves a fresh membership as well. (c) *Username reuse:* `memberUsernames`,
`verifyMembership` and `isMember` are keyed by **username**, while
`list_members` is keyed by **userId**. Once the name is freed and re-registered, the old access token and any open
WebSocket authenticate as the new account. The old WebSocket's `takeWhile` then sees the new owner's memberships. (d)
*Inherited row conflict:* the Inherited Invariants table says caller-less cascade helpers "sit behind a public
method that performs the check", but `purgeUser` is invoked by the admin, whom every list method rejects (FR56). One
implementer impersonates the owner through `deleteList(id, CallerUsername(owner))`. Another adds an
`internal fun cascadeDeleteList`. Both read as compliant.

**Proposed rule (replace AD-8's Rule):**

> **AD-8 (amended).** `ListService.purgeUser(userId: UUID, username: String)` is `internal`. It is the only caller-less
> list-mutating entrypoint, and its authorization is `requireAdmin()` in `UserAdminMutations.deleteUser`. That is
> documented as the single exception to the service-layer check. It writes only through `ListStorage.save` and
> `ListMemberRepository`, never through a `ListRepository` bulk update. It matches memberships by **both** `userId`
> (in `members` and `list_members`) and `username` (in `memberUsernames`). Owned lists go through a private
> `cascadeDeleteList(list)` that `deleteList` also calls. `purgeUser` is idempotent. Order: (1)
> `UserService.adminDeleteUser`, which makes `createList` and `acceptInvite` fail with `CallerNotFound` from this
> point on, then (2) `purgeUser(id, username)`, then (3) `invalidateUserSessions`. If (2) throws, the mutation
> returns an error and the orphans stay detectable with the documented `distinct("userId")` query. Subscriptions
> re-check membership on each event through `isMember`, and `isMember` also requires that the username still
> resolves to the **same userId the stream opened with** (capture it at subscribe time), so a re-registered username
> cannot inherit a live stream.

---

## F7 — Medium — The `checkedAt` carry-in and AD-3's "merge exactly as before" edit the same
`copy(...)` with different semantics

**Unit A — FR44 story (AD-3).** Adds `stores = item.stores` to `stored.copy(...)` and changes nothing else, because
AD-3 says "merges `stores` exactly as it merged `store` before (FR58)".

**Unit B — carry-in "`saveItem` stamps `checkedAt` when it checks an item"** (routed into the same FR44/FR69 story
per the PRD, but written from `deferred-work.md`). It stamps `checkedAt = now()` on a false→true transition.

**How they diverge.** The carry-in text covers only the recurring case. For `ONE_TIME`, `checkItem` sets
`deleted = true` and `deletedAt`, not `checkedAt`. A compliant Unit B stamps `checkedAt` on a one-timer that is
checked through `saveItem`. The item stays visible, checked, never hard-deleted and never restored: a third lifecycle
state that exists nowhere else. The inverse also slips through: an edit that changes `recurring` from `null` to
`WEEKLY` on an already-checked item has no false→true transition, so `checkedAt` stays null and the scheduler skips
it forever (`ItemService.kt:120`). This is the harmful state the deferred entry names. Unit A's reviewer reads
AD-3's "exactly as before" as forbidding B's change. Unit B's reviewer reads it as untouched by AD-3.

**Proposed rule (new AD-3a):**

> **AD-3a — One check-transition function.** `ItemService` has one private
> `applyCheckState(stored: Item, checked: Boolean, recurring: Recurring?, now: Instant): Item`, used by `checkItem`,
> `uncheckItem` and `saveItem`'s update branch. When `checked` is true, `ONE_TIME` gives `deleted = true` with
> `deletedAt = now` and a recurring cadence gives `checkedAt = stored.checkedAt ?: now` (also when only `recurring`
> changed). When `checked` is false, all three server-owned fields are cleared. `saveItem`'s merge copies
> `name`, `category`, `stores` and `recurring`, then passes the result through `applyCheckState`. The "merge exactly
> as before" clause in AD-3 refers only to `stores`.

---

## F8 — Medium — No shared item selection set: subscription, query and mutation documents drift on `stores`

**Unit A — FR44 story (AD-3).** Changes `store` to `stores` in `ItemsQuery` and `SaveItem`, and regenerates codegen.

**Unit B — FR68 FAB story, or any later touch (AD-10).** Reuses `AddItemDialog` and its mutation. Separately,
`ItemUpdatesSubscription` (`listsQueries.ts:276-290`) keeps its own hand-written field list.

**How they diverge.** There is no fragment today (`grep fragment` finds nothing). If one of the four item documents (the
Items query, SaveItem, the check/uncheck mutations, the ItemUpdates subscription) keeps `store` or omits
`stores`, codegen fails only for the one that names the removed field. A document that simply **omits** `stores`
still compiles. The shopping-view `updateQuery` then writes an item without `stores` into `getItems`. For a new id,
Apollo reports missing fields, `data` becomes partial, and the whole list can blank on another member's screen. That
only shows up in a two-actor test.

**Proposed rule (Frontend data convention):**

> Every operation that returns an `Item` spreads one fragment, `ListItemFields` in `lib/lists/listsQueries.ts`
> (`id name checked category listId stores addedBy recurring deleted`). Hand-written item field lists are not
> allowed. `subscribeToMore` handlers write through the generated fragment type, never through
> `as ListItemType[]`.

---

## F9 — Medium — Store identity is fixed, but representative casing and "is this edit a change" are not

**Unit A — backend suggestions (AD-4).** `itemStoreSuggestions` dedupes by lowercased key and keeps the first
occurrence. Iteration runs over `ItemStorage`'s `ConcurrentHashMap`, whose order is unstable. `order.ts` documents
three different sequences from three runs.

**Unit B — frontend `StoreField` and `EditItemDialog` (AD-4, AD-10).** Suggestion test ids are
`${prefix}-store-suggestion-${suggestion}`, using the returned casing. The dirty check compares normalized arrays by
AD-4's identity key, since "store identity anywhere is the trimmed, lowercased name".

**How they diverge.** (a) With `Lidl` and `lidl` on different items, the suggestion's casing flips between requests,
so E2E selectors and the chip a user saw a second ago disagree. (b) A user who corrects `lidl` to `Lidl` sees Save do
nothing, because Unit B's identity-key dirty check says unchanged, while the server would have accepted the new
casing. Both follow AD-4.

**Proposed rule (append to AD-4):**

> Representative casing for suggestions is deterministic: the first name in ascending `(lowercase, then ordinal
> String.compareTo)` order among the variants. A dirty check or "already on this item" check in the UI prevents
> **duplicates** by identity key, but decides **changed or unchanged** by exact string equality, so a casing-only edit
> is a real save. An edit that keeps the identity key replaces the stored casing in place.

---

## F10 — Medium — AD-9's literal path collides with `ktor.deployment.rootPath: "api"`

**Unit A — health story (AD-9).** Declares `get("/api/health")` in `Routing.kt`, since the rule says "A plain Ktor
route `GET /api/health`".

**Unit B — Caddy, Vite proxy and Playwright (AD-9).** Probe `:2080/api/health`. Caddy forwards `/api/*` unchanged,
and Ktor strips the configured `rootPath` (`application.yaml:9`). The auth routes are declared as `/auth/...` for
this reason.

**How they diverge.** Unit A's route is served at `/api/api/health`, and every probe gets 404. A Playwright readiness
loop that treats non-200 as "not ready" waits 600 s and fails the entire suite. The compose healthcheck (AD-9
"optional") also needs a probe binary inside the `bp_back` image, which the spine does not check.

**Proposed rule (amend AD-9):**

> The Ktor route is declared as `get("/health")` inside `routing {}`, outside `authenticate` and `rateLimit`. The
> external path `/api/health` comes from `rootPath: "api"`. The backend test hits `/api/health` through
> `testApplication` with the real config. A compose healthcheck is added only if the `bp_back` image contains the
> probe tool (`curl` or `wget`); otherwise it is left out. It is never satisfied by `mongosh`.

---

## F11 — Low — Deleting a user's owned lists is silent to the remaining members

**Unit A — AD-8 purge,** reusing the `deleteList` cascade, which emits nothing. The Mutation & events convention says
"Feedback and users emit nothing". **Unit B — other members on `/list/:id`.** Their streams end on the next event
because `isMember` is now false. With
no event, nothing arrives, and the screen stays on a list that no longer exists until the next mutation returns
FORBIDDEN and `isForbiddenError` redirects.

**How they diverge.** This is the same as today's owner `deleteList`, so it is not a regression. But E2E for the
purge story written as "a member's view updates" cannot pass, and one written as "a member's next action redirects"
can. The spine does not choose between them.

**Proposed rule (Mutation & events):** "List deletion (owner or purge) emits no subscription event. The accepted
behaviour for other members is redirect-on-next-FORBIDDEN (Story 5.6), and E2E for AD-8 asserts that and nothing
more."

---

## F12 — Low — Feedback length is counted on different strings on each side

**Unit A — server (AD-2).** Trims, then rejects more than 2000. **Unit B — dialog.** `maxLength={2000}` on the raw
value, plus a client-side blank check.

**How they diverge.** 2000 characters plus trailing newlines are blocked by the client and accepted by the server.
The client counter and the server can also disagree when the "at most 2000 characters" helper text counts
graphemes. This is minor, but an E2E boundary test written from each side's code will contradict the other.

**Proposed rule (append to AD-2):** "The 2000 limit is `String.length` (UTF-16 units) of the **trimmed** text on
both sides. The dialog counts and validates the trimmed value, and does not use `maxLength` on the raw input."

---

## Summary of new or tightened ADs

| Finding | Severity | Change                                                                                                 |
|---------|----------|--------------------------------------------------------------------------------------------------------|
| F1      | High     | AD-5: same story as `MongoItem.stores`; filter on `store` exists; `save` unsets `store`                |
| F2      | High     | new AD-7a: lossless cascade delivery; client category-DELETED drops children                           |
| F3      | High     | AD-7: category-first write order; sweep includes soft-deleted items; close create-branch category hole |
| F4      | High     | AD-6: `search` arg (or `rank`), E2E narrows before asserting; no page-walks                            |
| F6      | High     | AD-8: internal `purgeUser(id, username)`, via `ListStorage`, delete user first, userId-pinned streams  |
| F5      | Medium   | Frontend cache convention: cache-and-network, evict `users`, `deleteFeedback: ID!` evict               |
| F7      | Medium   | new AD-3a: single `applyCheckState` for check, uncheck and save                                        |
| F8      | Medium   | `ListItemFields` fragment is mandatory                                                                 |
| F9      | Medium   | AD-4: deterministic suggestion casing; casing-only edit is a change                                    |
| F10     | Medium   | AD-9: `get("/health")` under `rootPath: api`                                                           |
| F11     | Low      | Events convention: list deletion is silent; redirect-on-FORBIDDEN is the contract                      |
| F12     | Low      | AD-2: trimmed `String.length` on both sides                                                            |
