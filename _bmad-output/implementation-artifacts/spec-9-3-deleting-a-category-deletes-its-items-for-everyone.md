---
title: 'Story 9.3: Deleting a category deletes its items for everyone'
type: 'feature'
created: '2026-09-17'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'ee92b179735b444fba024a1699a5bf696fb0847f'
warnings: [ oversized ]
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `CategoryService.deleteCategory` does not cascade, so `ListDetailPage`'s confirm handler deletes the
category's items in a client-side loop over the items *that client happens to hold*. Items another member added since
the last refetch survive their category and become orphans pointing at a dangling id; the loop is also non-atomic, so a
mid-loop failure leaves the category gone and some items behind. On `/list/:id` the category `DELETED` event removes the
group but never its items, so a watching member keeps seeing rows of a category that no longer exists. This is the
Story 8.5 "orphan CAUSE" entry, whose recorded fix is exactly this story (AR-E9-7).

**Approach:** Make the server cascade: `deleteCategory` checks membership, deletes the category, then removes every item
of that category — soft-deleted ones included — from Mongo and from the per-list item cache, emitting **only** the
category `DELETED` event. Clients treat that event as authoritative for the category's children and prune locally; the
client-side item loop is deleted. Close the two remaining ways to create a fresh orphan: `saveItem` rejects an
out-of-list category on its **create** branch too, and `uncheckItem` refuses to resurrect an item whose category is
gone.

## Boundaries & Constraints

**Always:**

- The cascade runs inside `CategoryService.deleteCategory`, after `listService.verifyMembership(...).bind()`. A
  non-member is rejected and nothing is deleted (NFR-L2).
- The cascade removes items with `deleted = true` as well, so it must iterate the raw per-list cache map, never
  `ItemStorage.getByListId` (which filters soft-deleted rows out).
- Exactly one event is emitted: category `DELETED`. No per-item events — both SharedFlows are
  `extraBufferCapacity = 1` / `DROP_OLDEST`, so a fan-out would be dropped anyway.
- Mongo first, then cache, mirroring `ListService.deleteList` (:110-135). That ordering is convention, not
  transactional safety — do not claim atomicity.
- Only `ListService` writes membership data (AR-E9-8); this story touches none of it.
- Orphans already in the data keep appearing in the synthetic `Uncategorized` group on `/lists/:id`, with their
  per-item edit and remove controls.
- Every new E2E test is observed failing first and runs untagged on both viewport projects; the two-member realtime
  idiom is copied from `lists.spec.ts:1007`, with the **watcher on the `page` fixture** (a hand-built context does not
  inherit the project's `use` block).

- The orphan guard covers `uncheckItem` only, not `checkItem` (md, 2026-09-17). A pre-existing orphan that is already
  checked therefore stays checked until its category is reassigned in `EditItemDialog`; that dialog's own orphan defect
  is the Story 8.6 deferred entry and is deliberately not fixed here.

**Never:**

- No GraphQL schema change: `deleteCategory(id, listId): Category` and both update payloads keep their shape, so no
  `npm run generate` run is needed.
- No subscription is added to `/lists/:id` — it is refetch-driven by design (AR-E8-6, UX-DR-E9-11).
- Do not touch `lib/lists/order.ts` grouping, `checkItem`, the list/membership code, the Apollo link chain, the
  subscription plumbing in `CategoryApi.kt` / `ItemApi.kt`, or the generated files.
- Do not fix the Story 8.6 orphan-`EditItemDialog`-closes-silently entry here; it stays routed and open.
- No toast or snackbar anywhere; errors surface in the inline alerts that already exist.

## I/O & Edge-Case Matrix

| Scenario                     | Input / State                                                                | Expected Output / Behavior                                                                     | Error Handling                                                                                                  |
|------------------------------|------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| Cascade                      | Member deletes a category holding 5 visible items + 1 soft-deleted           | Category and all 6 items gone from Mongo and from the item cache; one category `DELETED` event | N/A                                                                                                             |
| Not a member                 | Non-member calls `deleteCategory`                                            | Rejected `Access denied: not a list member`; category and items untouched                      | `ListAuthError.NotMember` → `GraphQLForbiddenException`                                                         |
| Empty category               | Category with no items                                                       | Category deleted, no items removed, one `DELETED` event                                        | N/A                                                                                                             |
| Unknown category             | `deleteCategory` on an absent id                                             | Unchanged: `IllegalStateException("Category not found")`, no items removed                     | existing behaviour                                                                                              |
| Create with foreign category | `saveItem` create whose category is not on the target list                   | Rejected `Category <id> does not belong to list <id>`; nothing created, no `SAVED` event       | `IllegalArgumentException`, same message as the update branch                                                   |
| Uncheck an orphan            | `uncheckItem` on an item whose category no longer exists                     | Rejected; the item is not resurrected and no event is emitted                                  | `IllegalArgumentException` with the same "does not belong to list" message, mapped to friendly copy client-side |
| Watcher prune                | Member B on `/list/:id` receives category `DELETED`                          | The group and every item of that category disappear with no reload                             | N/A                                                                                                             |
| Stale add                    | `AddItemDialog` open on a category another member just deleted; user submits | Dialog stays open, friendly mapped message in `add-item-error`                                 | `itemSaveErrorMessage(err)`                                                                                     |

</frozen-after-approval>

## Code Map

**Backend** (`bp_back/src/main/kotlin/com/bagplease/`)

- `entity/category/CategoryService.kt:13-16` -- ctor `(categoryStorage, listService)`; add `itemService`. `:18-26` the
  two SharedFlows. `:40-45` `deleteCategory` — membership `:41`, `storage.delete(id, listId)` `:42`,
  `categoryDeleteChannel.emit` `:43`. **The cascade call goes between `:42` and `:43`.**
- `entity/item/ItemService.kt:17-22` ctor; `:24-32` flows. `:39-72` `saveItem` — update branch `:43-59` with the
  category guard at `:48-50` and its exact message; **create branch `:60-67` has no guard** (the hole, commented
  `:44-47`). `:74-79` `deleteItem`. `:94-102` `uncheckItem` — resurrects via `deleted = false`, `deletedAt = null`; add
  the category-existence guard here. `:109-132` `runSchedulerCycle` is the precedent for bulk removal — but it emits
  per-item events, which the cascade must **not** do.
- `entity/item/ItemStorage.kt:9-12` -- `ConcurrentHashMap<listId, ConcurrentHashMap<itemId, Item>>`; `:33`
  `getByListId` filters `!deleted` (bypass it); `:43-48` single `delete`; `:50` `evictList` is the shape to copy for a
  new bulk removal.
- `entity/item/mongo/ItemRepository.kt:128-131` -- `deleteAllInList(listId): Int` is the exact template for a new
  category-scoped `deleteMany`. Field name `MongoItem::category.name` (`:111`); UUIDs always filtered as `.toString()`.
  Indexes `:82-88` include `("listId","_id")` — a `and(listId, category)` filter uses the `listId` prefix.
- `entity/list/ListService.kt:17-28` `ListAuthError` (no invalid-input/not-found member — those stay plain thrown
  exceptions); `:110-135` `deleteList`'s Mongo-then-cache cascade, the pattern to mirror.
- `plugins/GQL.kt:88-90` -- `itemService` is constructed **before** `categoryService`, so passing it in needs no
  reordering.
- `src/test/kotlin/com/bagplease/ItemLifecycleTest.kt` -- `FunSpec`; helpers `registerAndLogin :60`, `createList :70`,
  `saveCategory :79`, `saveItem :96`, `checkItem :116`, `shareList :125`, `acceptInvite :134`, `getItems :143`;
  container `:48` via `utils/TestContainers.kt` `mongoContainer() :19`. `:784-798` asserts the update-branch message. **
  `:801-820` is the create-hole tripwire** (`"7.4 AC4 … (ruling A tripwire)"`, rationale `:802-805`) — it asserts the
  hole is open and must be **retired** by this story. **No test calls `deleteCategory` today** — cascade coverage is
  greenfield.

**Frontend** (`bp_front/src/`)

- `routes/ListDetailPage.tsx:440-454` -- the confirm handler: `:449-450` the per-item delete loop (**delete it**),
  `:452` `deleteCategory`, `:453` `void refetch()`. The comment `:442-448` states the backend does not cascade and is
  now false — **rewrite it**. `:66` is the two-query refetch helper; `:106-107` binds both mutations —
  `deleteItem` stays (the remove-item dialog `:458-473` still uses it). `:236-373` renders the groups;
  `:277-309` gates category controls on `category &&` so `Uncategorized` shows none; `:352-370` the per-item
  edit/remove buttons that are the orphan recovery path.
- `routes/ListShoppingPage.tsx:286-308` -- `subscribeToMoreCategories`; `:297-298` filters the category out of
  `getCategories` on `DELETED` but **never prunes items** — this is where the cascade prune belongs. `updateQuery`
  cannot reach the Items query, so prune through `useApolloClient()` (`cache.updateQuery` on `ItemsQuery{listId}`, or
  `cache.evict` + `gc()`); **no `cache.` call exists anywhere in `src/` today.** `:259-284` the items subscription
  (leave alone). `:373-386` `handleToggle` already surfaces failures in `shopping-action-error` (`:449-452`) via
  `graphqlErrorMessage`.
- `components/AddItemDialog.tsx:120-123` -- catch uses raw `graphqlErrorMessage`; alert `:184-188`
  (`add-item-error`). Switch to `itemSaveErrorMessage`, the path `EditItemDialog.tsx:148-151` / `:211` already uses.
- `lib/admin/adminErrors.ts:49` -- `CATEGORY_NOT_ON_LIST` regex; `:51-57` `itemSaveErrorMessage`.
- `lib/lists/listsQueries.ts:143/158/193/204/219/277/293` -- `CategoriesQuery`, `ItemsQuery`, `DeleteCategoryMutation`,
  `SaveItemMutation`, `DeleteItemMutation`, `ItemUpdatesSubscription`, `CategoryUpdatesSubscription`. No fragments exist
  in the repo. `lib/apollo/ApolloProvider.tsx:108` -- `new InMemoryCache()`, no `typePolicies`.

**E2E & docs**

- `bp_front/e2e/lists.spec.ts:1007-1039` -- **the template**: observer parked on `/list/:id`, actor mutating from
  `/lists/:id` in a hand-built context, membership seeded by `gql` (`shareList` + `acceptInvite`), `countWebSockets`
  asserting `/lists/:id` opens none, `ctx.close()` in `finally`. `:752` `renameCategory`; `:117` / `:515` show category
  removal driven inline via `withCategoryMenu` + `ConfirmDialog` testids.
- `bp_front/e2e/support/ui.ts` -- `registerViaUi :35`, `createListAndOpen :94`, `addCategory :106`, `addItem :117`,
  `withCategoryMenu :152`, `countGraphqlRequests :166`, `countWebSockets :179`. `support/api.ts` -- `gql :34`,
  `loginApi :23`.
- `bp_front/playwright.config.ts:160-260` -- the counts ledger; latest row `:246-259` reads
  `2026-09-16 (Story 9.2): 236 = 116 / 116 / 2 / 2` with 23 skips. Measure, never quote.
- `_bmad-output/implementation-artifacts/deferred-work.md:70` (index bullet) and `:576-606` (the Story 8.5 orphan CAUSE
  entry, whose `:597-599` names this exact fix) -- **close in place**, using the `✅ CLOSED by Story 9.2 … Was: …`
  idiom at `:35-43`. The Story 8.6 entry (`:51-52`, `:608-615`) stays open.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md:322-331` -- "Remove-category is a client-side
  cascade" plus its failure-residue paragraph — **stale, rewrite**. Check `:302` and `:315-317` (the `Uncategorized`
  rationale survives but its cause narrows to pre-existing orphans); `:668-700` §10 Realtime documents the two
  subscriptions and needs the prune added. `DESIGN.md` is unaffected; its §13 check block is at `:432-465`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:117` -- `9-3-…: backlog` → reconcile at story close.

## Tasks & Acceptance

**Execution:**

- [x] `bp_back/src/test/kotlin/com/bagplease/ItemLifecycleTest.kt` -- **written FIRST, run red.** Add: the cascade case
  (5 visible + 1 soft-deleted item, assert all 6 gone from `getItems` and from a direct Mongo count, and the
  category gone); a non-member `deleteCategory` rejected with nothing deleted; an empty category; a create with a
  foreign category rejected with the exact update-branch message and no item created; `uncheckItem` on an orphan
  rejected. Retire the create-hole tripwire at `:801-820` (delete it and its rationale comment). Record the red run.
- [x] `bp_back/src/test/kotlin/com/bagplease/SubscriptionScopingTest.kt` -- add a case asserting a cascade delete emits
  exactly one category `DELETED` event and **no** item events -- this is the constraint the one-slot buffer makes
  easy to violate silently.
- [x] `bp_back/.../entity/item/mongo/ItemRepository.kt` -- add `deleteAllInCategory(listId, categoryId): Int` modelled
  on `deleteAllInList :128-131` -- a category-scoped `deleteMany` is the only Mongo-side primitive missing.
- [x] `bp_back/.../entity/item/ItemStorage.kt` -- add a bulk cache removal for one category that iterates the raw inner
  map (soft-deleted rows included) and calls the new repository method -- `getByListId`'s `!deleted` filter makes
  the obvious implementation silently miss rows.
- [x] `bp_back/.../entity/item/ItemService.kt` -- add `internal suspend fun deleteAllInCategory(listId, categoryId)`
  that removes through storage and emits **no** events; add the create-branch category guard reusing the update
  branch's message; add the category-existence guard to `uncheckItem`. Update the `:44-47` comment: the hole is
  closed.
- [x] `bp_back/.../entity/category/CategoryService.kt` -- take `itemService` in the ctor; call the cascade between the
  category delete and the event emit -- membership is already verified above it, so the cascade inherits NFR-L2.
- [x] `bp_back/.../plugins/GQL.kt:90` -- pass `itemService` into `CategoryService`.
- [x] `bp_front/src/routes/ListDetailPage.tsx` -- delete the `:449-450` item loop, keep `deleteCategory` + `refetch`,
  rewrite the `:442-448` comment to describe the server cascade.
- [x] `bp_front/src/routes/ListShoppingPage.tsx` -- on category `DELETED`, prune that category's items from the cached
  `ItemsQuery{listId}` result as well as the category from `getCategories` -- the subscription is this screen's only
  notice that the children are gone.
- [x] `bp_front/src/components/AddItemDialog.tsx` -- map the catch through `itemSaveErrorMessage` so a stale category
  surfaces friendly copy in `add-item-error`, matching `EditItemDialog`.
- [x] `bp_front/e2e/lists.spec.ts` -- add one untagged two-member test on the `lists.spec.ts:1007` template: B watches
  `/list/:id`, A deletes a category holding ≥5 items from `/lists/:id`; assert the group and every item vanish on B
  without a reload, and that A's handler sends **one** `deleteCategory` and **zero** `deleteItem` requests
  (`countGraphqlRequests`).
- [x] `bp_front/playwright.config.ts` -- append a dated counts-ledger row from a fresh measurement.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- close the Story 8.5 orphan CAUSE entry (`:70`,
  `:576-606`) in place; leave the Story 8.6 entry open.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` -- rewrite `:322-331`, adjust `:315-317` and
  §10 `:668-700` -- UX-DR-E9-12 requires the contract to describe the shipped app in the same commit.

**Acceptance Criteria:**

- Given member B watching `/list/:id` and member A on `/lists/:id`, when A confirms removal of a category holding ≥5
  items, then B's screen loses that group and all of its items without a reload, and A's screen loses them too.
- Given the same removal, when the requests are counted, then exactly one `deleteCategory` and zero `deleteItem`
  requests are sent.
- Given items that predate this change and have no category, when `/lists/:id` renders, then they still appear in the
  `Uncategorized` group with working edit and remove controls.

## Implementation Notes

**Red runs, recorded.**

- *Kotest.* The five new `ItemLifecycleTest` cases plus the new `SubscriptionScopingTest` case were written first and
  run against the UNCHANGED `bp_back/src/main` (stashed): `36 tests: 32 passed, 4 failed`. The four reds were
  `9.3 a CREATE carrying a category that is not on the list is rejected`, `9.3 a CREATE carrying a category that
  belongs to another list is rejected`, `9.3 deleting a category deletes every item in it, soft-deleted rows included`
  and `9.3 uncheckItem refuses to resurrect an item whose category is gone`. Three of the new cases pass pre-change by
  design and are labelled as guards, not regressions: the non-member rejection (NFR-L2 — it would only fail if the
  cascade were moved above `verifyMembership`), the empty-category case and the unknown-category case. The
  subscription case was STRENGTHENED after that run: it now also asserts the items are actually gone, so it fails
  pre-change too rather than only on a future per-item emit.
- *E2E, half one (the request count).* The new `lists.spec.ts` test run against a production image built from the
  pre-story `bp_back/src/main` + `bp_front/src`: RED on **both** viewport projects, with
  `Received: ["DeleteItem" x5, "DeleteCategory"]`.
- *E2E, half two (the client prune).* The prune must be proven separately, because the pre-story build passes the
  watcher assertions for the wrong reason — its five `deleteItem` mutations each emit an item `DELETED` event, so the
  rows disappear over the item subscription. With everything else in place and ONLY the `queueMicrotask` prune removed,
  the image was rebuilt and the test was RED on **both** projects at
  `expect(getByTestId('shopping-item-Doomed 1 …')).toHaveCount(0)` — the group had gone while its rows stayed,
  resurfacing
  under the synthetic `Uncategorized` bucket. Restored and rebuilt afterwards.

**A second E2E was added during verification: the matrix's "Stale add" row.** The task list named only the cascade
test, but the I/O matrix's last row (an `AddItemDialog` left open on a category a co-member has since removed) had no
covering test — the `AddItemDialog` change shipped unasserted. `lists.spec.ts` now carries
`FR46 — submitting an add into a category removed meanwhile keeps the dialog open with mapped copy`: the dialog is
opened and the category picked, the category is then removed out of band through the API (on `/lists/:id`, which is
refetch-driven with no subscription, a co-member's removal is indistinguishable from this one to the open dialog), and
the submit is asserted to leave the dialog open, the typed name intact, no row created, and the MAPPED copy in
`add-item-error`. *Red run:* with only the `itemSaveErrorMessage` mapping reverted to `graphqlErrorMessage` and the
image rebuilt, RED on **both** viewport projects at the copy assertion, showing the raw
`Category <uuid> does not belong to list <uuid>` — which is also the create-branch guard firing end to end. Restored
and rebuilt; green on both projects.

**Full-suite re-measurement after that addition.** `mise run back:test`: 135 tests, 135 passed, 0 failed.
`npm run lint` and `npm run build`: exit 0. `npm run test:e2e` on the rebuilt production image: 215 passed, 23 skipped,
0 failed. `npx playwright test --list`: **238 = 117 / 117 / 2 / 2**, and the counts-ledger row in
`playwright.config.ts` was rewritten to that measurement (the earlier row recorded 236, taken before this test
existed).

**A spec task that could not be executed as written: the Story 8.5 `FR62` orphan E2E spec is RETIRED.** Its fixture was
the stale-client-set race produced by the client-side delete loop; with the loop gone and `saveItem` rejecting an
out-of-list category on the CREATE branch, no successful call on the item surface can leave an item under a category
that is not on its list — which is exactly what this story guarantees. (Narrowed from "no API-reachable way to create
an orphan" at review, 2026-09-17: `saveCategory` can still RELOCATE a category between lists, `saveItem`'s check is a
TOCTOU read of a cache the cascade mutates, and the cascade is not transactional. None of the three is a fixture a
UI-driven E2E can build, so the retirement stands; all three are recorded in `deferred-work.md`.) Every assertion in
that spec depended on the orphan existing, so it could not be reduced,
only removed; a comment block stands in its place explaining what survives and where. The `Uncategorized` bucket itself
is untouched in the product (AC3), and its ordering/placement rules stay covered without a browser by
`e2e/order.spec.ts`. The residual gap — no end-to-end coverage of a LEGACY orphan RENDERING on `/lists/:id` — is
recorded in `deferred-work.md` as its OWN open entry (it was first filed inside the now-closed Story 8.5 block, where
an OPEN scan would have missed it — review finding, 2026-09-17).

**Existing Kotest fixtures had to be seeded.** The `:44-47` comment's "guarding creates too would fail 29 existing test
sites" was accurate. Twenty-odd `saveItem` call sites across `ItemLifecycleTest`, `ItemApiTest`,
`ItemCategoryStorageTest`, `ListAuthorizationTest`, `ListSharingTest` and `SubscriptionScopingTest` invented a category
UUID that was never saved; each now saves the category first. Two sites deliberately did NOT change: the AC12
`saveItem` by a stranger (rejected at `verifyMembership`, before any category check) and the `7.4 AC3` relocation case
(the `findById` check is checked before the category guard on the create branch on purpose, so the more specific
"belongs to a different list" diagnosis survives).

**The `uncheckItem` orphan test needs two app instances.** `CategoryStorage` is an in-memory cache, so a category
deleted straight out of Mongo is still "present" to the process that wrote it. The test therefore creates the pair
legitimately, deletes the category document directly, and then opens a SECOND `testApplication` whose fresh caches sync
the orphan off disk — which is the legacy shape the guard exists for.

### Review pass, 2026-09-17

Eight entries survived triage: six patched, four deferred (two entries carry both a patched and a deferred half).
Nothing routed `intent_gap` or `bad_spec`, so the code was not re-derived and `review_loop_iteration` stays 0.

**Patched:**

1. `ListShoppingPage.tsx` now maps the toggle failure through `itemSaveErrorMessage`, not `graphqlErrorMessage`.
   Story 9.3 gave `uncheckItem` an orphan guard throwing the same message the two item dialogs already map, and the
   shopping row was the one screen that showed it raw. Pinned by a new `shopping.spec.ts` case that intercepts the
   mutation and returns the backend's exact wording — observed RED on both viewport projects, green after.
2. `CategoryService.deleteCategory` emits the category `DELETED` event in a `finally`. A throw from the cascade
   previously skipped the emit entirely, leaving every watching `/list/:id` with a phantom group on top of the
   already-documented item residue.
3. The absolute claim "there is no API-reachable way to create an orphan" is narrowed to "no successful call on the
   ITEM surface" in all four places it appeared (`ItemService.kt`, `EXPERIENCE.md`, the retired-spec comment in
   `lists.spec.ts`, and these notes), each naming the three residual windows. The claim was load-bearing — it is the
   stated justification for retiring the FR62 E2E — and the `saveCategory` relocation path falsifies it outright.
4. The six fire-and-forget `saveCategory` seeds added by this story (`ItemApiTest`, `ItemCategoryStorageTest`,
   `ListAuthorizationTest`, `ListSharingTest`) now assert `shouldNotContain "errors"`, the rule `ItemApiTest`'s own
   older seed documents: a silent seed failure makes the following `saveItem` fail for the CATEGORY reason, so a
   rejection-shaped test passes while covering nothing.
5. Two Kotest cases added for coverage the review found missing: `9.3 the cascade is scoped by listId, not by category
   id alone` (the filter's `listId` clause was untested — removing it left the whole suite green) and `9.3 a shared
   member can cascade a category delete, like the owner` (the cascade had only ever been driven by an owner). Each
   was observed RED alone, for its own reason, before being accepted.
6. `SubscriptionScopingTest`'s cascade case no longer sleeps to wait for its subscriptions. graphql-ws has no
   per-subscription ack, so `delay(400)` was all that stood between subscribing and the delete; on a slow box the
   streams would attach after the delete and "no item events" would pass for the wrong reason, on the one test
   guarding this story's event contract. A probe category and item now prove both streams live, and double as a
   control that must survive the cascade. `ItemStorage.deleteAllInCategory` was also made `internal` (it was public
   with the same signature as the `internal` wrapper whose guarantee it undermined) and its unused `Int` dropped.

**Deferred** (four entries under "Deferred from: Story 9.3" in `deferred-work.md`): the `saveCategory` relocation
hole and its stale-entry delete path; the `Uncategorized` rendering gap left by retiring the FR62 spec, now its own
OPEN entry rather than a paragraph inside the CLOSED Story 8.5 block, together with the undecided disposition of the
legacy rows on disk; the non-transactional cascade's concurrency windows and the scheduler abort that rides with
them; and the eight-fold duplication of the category-seeding fixture.

**Rejected:** three findings. One was refuted outright (the retired-spec comment's pointers both resolve correctly).
Two were `low` with fixes that add guards rather than correct something: a scheduler guard that would strand a legacy
orphan checked forever, and stale-PWA-client staleness whose `/lists/:id` half does not happen at all, because the
removed loop ran BEFORE `deleteCategory`.

**Verification after patching:** `mise run back:test` 137 passed / 0 failed (was 135 — the two new cases);
`npm run lint` and `npm run build` exit 0; `npm run test:e2e` 217 passed, 23 skipped, 0 failed (240 total, +2), with
the ledger row in `playwright.config.ts` re-measured.

## Spec Change Log

## Review Triage Log

Review Pass 1 (2026-09-17), three layers: `blind-hunter` (13), `edge-case-hunter` (11), `verification-gap`
(2 gaps + 2 other). The first two reported in an earlier session that hit its usage limit before triage and were
recorded verbatim in `spec-9-3-review-findings-pending.md`; `verification-gap` died there and was re-run against the
same tree (HEAD still `ee92b17`, same working set), so all three layers reported before any verdict was rendered.
Every finding below carries its own verdict; findings marked `carried` are none (first triage).

| # | Layer | Finding | Verdict | Evidence |
|---|-------|---------|---------|----------|
| 1 | bh-1 / ech-6 / ech-8 / vg-G1 | `uncheckItem`'s new orphan rejection reaches the user as raw developer copy | `medium` | Confirmed at `ListShoppingPage.tsx:407`: `setActionError(graphqlErrorMessage(err))`, untouched by this diff, while the sibling `AddItemDialog.tsx:125` was switched to `itemSaveErrorMessage` in the same diff and `EditItemDialog.tsx:149` already used it. `adminErrors.ts:49`'s regex matches the backend string verbatim, so the contract is shared. Reachable today for a legacy orphan that is `checked` with a `null` cadence — `deleted` stays false, `getByListId` returns it, the shopping row toggles it. The spec's own I/O matrix row "Uncheck an orphan" records it as mapped. |
| 2 | bh-2 | A checked ONE_TIME orphan becomes permanently unrecoverable | `low` | The bad outcome is real but unreachable from the product: `checkItem` sets `deleted = true` for `ONE_TIME` (`ItemService.kt:89`), `ItemStorage.getByListId:35` filters those out, and `ListShoppingPage.tsx:277` drops the row from the cache on the same event. So the row renders nowhere and `uncheckItem` cannot be invoked on it from any screen — the guard narrows an API-only path. What is wrong is the comment: `ItemService.kt:104` asserts the recovery is `EditItemDialog`, which is also unreachable for a soft-deleted row. |
| 3 | bh-3 / ech-1 | A cascade failure suppresses the `DELETED` event entirely | `medium` | Confirmed at `CategoryService.kt:61-63`: `storage.delete` → `itemService.deleteAllInCategory` → `emit`, all unguarded. A throw from the cascade leaves the category deleted from Mongo and cache with no event emitted, so every watching `/list/:id` keeps rendering a phantom group until something refetches. The KDoc at `:54-57` names the residue ("some items still present") and never mentions the lost event. |
| 4 | bh-4 / ech-9 / vg-other-1 | "No API-reachable way to create an orphan" is stated absolutely and is not true | `medium` | Three independent residual windows confirmed. (a) `CategoryService.saveCategory:35-40` verifies membership only against the INCOMING `category.listId`, and `CategoryRepository.save:35-43` upserts by `_id` alone while `Updates.set`-ting `listId` — so re-saving an existing category id under another list relocates the document and strands the old list's items. `saveItem` has exactly this guard (`ItemService.kt:63`); categories have none. In-process the effect is masked because `CategoryStorage.save:28` adds under the new list without removing the stale entry; it surfaces after a restart, when caches sync from Mongo. (b) `requireCategoryOnList:133` reads the in-memory `CategoryStorage`, so a `saveItem` create concurrent with a cascade is a TOCTOU window. (c) The cascade is non-transactional by its own KDoc, and its failure residue IS an orphan. The absolute claim appears in `ItemService.kt` comments, `EXPERIENCE.md`, the retired-spec comment in `lists.spec.ts:520-523`, and this spec's Implementation Notes — and it is load-bearing, being the stated justification for retiring the FR62 E2E. |
| 5 | bh-5 | The encapsulation claim does not hold; the cascade's count is discarded | `low` | Confirmed: `ItemService.deleteAllInCategory:129` is `internal` with the rationale that nothing outside the module can wipe a category's items, but `ItemStorage.deleteAllInCategory:60` is public with the same signature — the guarantee is one call away. Developer harm named: the next caller reaching for the storage method bypasses the membership check `deleteCategory` performs. The `Int` return is read by nobody along the whole chain (`CategoryService.kt:62` discards it). |
| 6 | bh-6 | The new seeding posts never assert they succeeded | `medium` | Confirmed fire-and-forget at `ItemApiTest.kt:72`, `:112`, `:199`, `ItemCategoryStorageTest.kt:70`, `:125`, `:130`, `ListAuthorizationTest.kt:113`, and in `ListSharingTest.kt`. Partially false for `SubscriptionScopingTest.kt:304`, which does assert `shouldNotContain "errors"`. The named harm is the repo's own codified one: `ItemApiTest.kt:153-165` asserts its seed and the comment there records why (a silent seed failure makes the following `saveItem` fail for the CATEGORY reason, so a rejection-shaped test passes green while vacuous) — that comment is itself a prior review finding, so this diff reintroduces what the file documents as fixed. |
| 7 | bh-7 | The seeding snippet is copy-pasted eight times | `low` | Real duplication: six raw `client.post` blocks plus two private `saveCategory` helpers (`ItemLifecycleTest.kt:79`, `SubscriptionScopingTest.kt:65`) express one fixture requirement that is now repo-wide (every `saveItem` needs a real category). Named harm: the next test author copies an unasserted block, reproducing #6. |
| 8 | bh-8 | The new `SubscriptionScopingTest` case is time-based on both ends | `medium` | Confirmed: `delay(400)` at `:323` after the two `subscribe` frames, and `withTimeoutOrNull(2000)` at `:333`. The graphql-ws protocol sends no per-subscription ack, so the sleep is the only thing standing between "subscribed" and the delete; on a slow box the subscriptions register after the delete and the "zero item events" assertion goes green for the wrong reason. The fixed drain window is defensible (the failure being guarded is EXTRA events); the pre-delay is not. Adds ~2.4 s of wall clock to every suite run. |
| 9 | bh-9 | Nothing proves the `listId` half of the Mongo filter | `low` | Confirmed: `ItemRepository.deleteAllInCategory:87` filters on both `listId` and `category` and its KDoc argues for it, but every new Kotest case (`ItemLifecycleTest.kt:984` and the `SubscriptionScopingTest` cascade case) uses ONE list, so deleting the `listId` clause leaves the suite green. Also uncovered: a cascade performed by a shared member rather than the owner. Graded `low` rather than higher because category ids are UUIDs, so a cross-list id collision is not naturally reachable — the clause is defensive — but the untested defence is exactly what finding 4(a) makes reachable. |
| 10 | bh-10 | The retired-spec comment misdirects the next reader | `false` | Checked both pointers. `lists.spec.ts:529-530` says coverage comes from "the FR46 spec above" — `lists.spec.ts:117`, which IS above line 529 — "and, across two members, by the FR46 cascade spec at the end of this file" — `lists.spec.ts:1048`, which IS at the end (the file is 1190 lines). Both pointers resolve correctly as written. |
| 11 | bh-11 | A genuinely open gap is filed under a closed entry | `medium` | Confirmed in `deferred-work.md`: the Story 8.5 entry is marked `✅ CLOSED by Story 9.3` and the new paragraph "A coverage gap this leaves, recorded rather than patched" is nested INSIDE that closed block. Named harm: anything scanning the ledger for OPEN entries — which is how every prior story picked up its follow-ups — misses it. |
| 12 | bh-12 | No disposition for the orphan data already on disk | `low` | The premise is right that no migration is proposed, but a disposition does exist and is deliberate: AC3 keeps legacy orphans rendering in the `Uncategorized` bucket with working edit/remove controls, which IS the decision for that data. What the story does not do is decide whether to clean it up. Real as an open question, not as a defect. |
| 13 | bh-13 | Status bookkeeping is inconsistent | `low` | Confirmed: this spec's frontmatter reads `status: 'in-review'` while `sprint-status.yaml:117` reads `in-progress`, and `sprint-status.yaml:32` carries `last_updated: 09-17-2026 00:00`, a placeholder midnight on a day of real work. |
| 14 | ech-2 / ech-3 | `saveItem` / cache-vs-Mongo interleave can write an item after the cascade | `medium` | Confirmed by reading: `requireCategoryOnList` (`ItemService.kt:133`) reads `CategoryStorage` and `storage.save` (`ItemStorage.kt:26`) runs outside any lock, and `ItemStorage.deleteAllInCategory:60-64` does `repository.deleteAllInCategory` then the cache `removeIf` as two independent writes. Both orderings are reachable: a save that passes the guard before the cascade and lands after it, and a save landing between the two halves (row survives in Mongo, evicted from cache, invisible until restart). Real, and narrow — needs the two operations to interleave within the window. |
| 15 | ech-4 | The scheduler resurrects an orphan that `uncheckItem` now refuses to | `low` | Real inconsistency: `runSchedulerCycle:141-153` restores checked recurring items with no category check, so it does for a legacy orphan what `uncheckItem:107` now refuses. But the outcome is not a harm: a restored legacy orphan renders in the `Uncategorized` bucket with working controls, which is precisely what AC3 promises for that data. The suggested guard would instead strand it checked forever. |
| 16 | ech-5 | A cascade racing `findSoftDeletedToHardDelete` aborts the scheduler cycle | `low` | Confirmed shape: `runSchedulerCycle:156-160` reads `toDelete` from Mongo and then calls `storage.delete`, which throws `IllegalStateException("Item not found")` (`ItemStorage.kt:45`) when the cache entry is already gone; `Scheduler.kt:14-18` catches and logs, so the remaining items wait an hour rather than the process dying. Pre-existing, not caused by this story: `deleteItem` takes the same `storage.delete` path, so any concurrent user-initiated delete — including the client-side loop this story REPLACES — produced the identical race. The cascade only widens the window. |
| 17 | ech-7 | `saveCategory` re-save can migrate a category between lists | `medium` | Confirmed — same defect as finding 4(a), verified at `CategoryService.kt:35-40`, `CategoryRepository.kt:35-43`, `CategoryStorage.kt:26-31`. Pre-existing: `saveCategory` is untouched by this diff. |
| 18 | ech-10 / vg-G2 | Retiring the FR62 spec leaves AC3 with no test | `medium` | Filed pre-verified by the `verification-gap` layer and re-checked: the deleted spec was the only browser-level cover of the `Uncategorized` rendering path on `/lists/:id`. `order.spec.ts:71-83` calls `groupItemsByCategory` as a pure function and asserts only the bucket key and tie-break order; it renders no page, so it observes none of the bucket's placement among real categories, the `category &&` gate at `ListDetailPage.tsx:277-309` that hides category-level controls, the per-item recovery controls, or the "no `Uncategorized` filter option" decision tripwire. Inverting that gate leaves every remaining test green. The only other `Uncategorized` hit in `bp_front/e2e` is a comment in `shopping.spec.ts:980`, in a test that deletes the item first so no orphan appears. |
| 19 | ech-11 | Older cached PWA clients keep rows on screen after their category is gone | `low` | Half false. For `/lists/:id` the claim does not hold: the removed loop ran BEFORE `deleteCategory` (see the `-` lines at `ListDetailPage.tsx:443-451`), so a stale client still deletes the items itself and then the category, and the server cascade finds nothing left — no error, no stale rows. The shopping half is real but transient: a stale `/list/:id` bundle does not implement the category-event fan-out, so its rows persist until the next refetch or reload, which the service worker's own update cycle resolves. |
| 20 | vg-other-2 | A relocated category is deletable through its stale old-list entry | `low` | Confirmed: `CategoryStorage.delete:38-42` removes from the given list's map while `CategoryRepository.delete:45` deletes by `_id` globally, so a category relocated per finding 17 can be deleted via the stale entry — which now also fires `deleteAllInCategory(oldListId, id)`. Pre-existing and reachable only through finding 17, but the cascade widens what that path destroys. |

**Notable positives the layers flagged as worth preserving**, carried forward as KEEP for any later re-derivation: the
soft-deleted-row fixture and its stated rationale in the cascade Kotest case (`ItemLifecycleTest.kt:984`); the
"control row must survive" sibling assertions; the event-contract test that also proves the cascade RAN, rather than
being satisfied by a `deleteCategory` that touched nothing (`SubscriptionScopingTest.kt:291`); the two-instance trick
for producing a legacy orphan; and the `queueMicrotask` deferral in `ListShoppingPage`'s prune with its recorded
reason.

### Grouping and routing

Twenty findings, grouped by shared root cause into eight entries. No entry routed `intent_gap` or `bad_spec`, so no
loopback: `review_loop_iteration` stays at 0.

| Entry | Members | Verdict | Route | Why |
|-------|---------|---------|-------|-----|
| A — the uncheck rejection is unmapped | 1, 2 | `medium` | `patch` | One defect: the new `requireCategoryOnList` in `uncheckItem` acquired no client-side mapping, and its comment describes a recovery the soft-deleted case does not have. Smallest fix is one call swap plus a comment correction; no new public surface. |
| B — the cascade can swallow the `DELETED` event | 3 | `medium` | `patch` | Trivial fix: emit in a `finally`. No new surface, guards no undemonstrated state. |
| C — the "no orphan is reachable" claim is absolute and false | 4, 17, 20 | `medium` | `patch` (claim) + `defer` (guard) | The prose overreach is caused by this change and is load-bearing for a test deletion, so the wording is patched here. The underlying `saveCategory` relocation guard is pre-existing code this diff does not touch, and its fix adds a new guard — deferred. |
| D — test fixtures assert nothing | 6, 9 | `medium` | `patch` | Both are missing assertions in tests this diff added; the fix is adding assertions and one case, which adds no production surface. |
| E — the subscription test is timing-dependent | 8 | `medium` | `patch` | Contained in one test file, no production surface. |
| F — encapsulation and bookkeeping slips | 5, 13 | `low` | `patch` | Both fixes are direct corrections or deletions, not added complexity, so the `low` rejection rule does not apply. |
| G — the `Uncategorized` rendering path has no test | 11, 18, 12 | `medium` | `defer` | Genuinely blocked: closing it needs a seeding seam (a Mongo fixture in the E2E harness or a test-only route) that does not exist, which is why it was recorded rather than patched. The recording itself is the defect (nested in a CLOSED ledger entry), and it is fixed by giving it its own OPEN entry — which is what `defer` does. The legacy-data disposition question rides the same entry. |
| H — concurrency windows around the non-atomic cascade | 14, 16 | `medium` | `defer` | Real but narrow, and every proposed fix (a per-list mutex, a try/catch in the scheduler loop) adds machinery for state this diff did not demonstrate reachable. #16 is pre-existing besides. |
| — rejected | 10, 15, 19 | `false` / `low` | reject | 10 refuted outright (both pointers resolve). 15 and 19 are `low` and unlikely to be met in everyday use, and both proposed fixes add guards or branches rather than correcting something directly. |

## Design Notes

**Why the cascade lives in `CategoryService`, not `ItemService`.** `deleteCategory` is where membership is already
verified and where the single authoritative event is emitted; putting the item removal anywhere else would either
duplicate the membership check or emit the event before the children were gone. `ItemService` exposes the removal as
`internal` so nothing outside the module can delete a category's items without deleting the category.

**Why only the category `DELETED` event.** Both item and category SharedFlows are `extraBufferCapacity = 1` with
`DROP_OLDEST`. Emitting one event per removed item would drop all but the last for any subscriber not consuming
instantly, producing exactly the partial-prune bug this story removes. Making the category event authoritative for its
children moves the fan-out to the client, where it is a local array filter.

**Why the client-side prune is still needed on `/list/:id`.** The category subscription's `updateQuery` can only return
the `getCategories` result, so the items cached under `ItemsQuery{listId}` survive the event untouched. Pruning them is
what makes the rows disappear; the server cascade alone only guarantees they never come back on a refetch.

## Verification

**Commands:**

- `./gradlew :bp_back:cleanTest :bp_back:test` -- expected: BUILD SUCCESSFUL, 0 failures across
  `bp_back/build/test-results/test/TEST-*.xml`. (`cleanTest` is required — bare `:test` is `UP-TO-DATE`-cacheable and
  leaves stale XML.)
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0 (`tsc -b` also type-checks `e2e/`).
- `docker compose up --build -d` then `curl -o /dev/null -w '%{http_code}' http://localhost:2080/api/health` --
  expected: `200` before any E2E run.
- `cd bp_front && npm run test:e2e` -- expected: green on all four projects, including the new two-member test.
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` -- expected: measured before
  and after; the delta is `added untagged tests × 2`, recorded in the ledger row.

**Manual checks (if no CLI):**

- The red runs of the new Kotest cases and of the new E2E test are recorded in Implementation Notes, the E2E one
  observed on both viewport projects.
