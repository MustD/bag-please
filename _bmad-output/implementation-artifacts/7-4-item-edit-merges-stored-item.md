---
baseline_commit: 0d34ea9ef5735a24db1c7431ef01e0174e7a29ee
---

# Story 7.4: An Item Edit Modifies the Stored Item Instead of Reconstructing It

Status: ready-for-dev

**Delivers:** FR58; restores FR45, FR54 and FR40 (AR-E7-1, AR-E7-2, AR-E7-2a, AR-E7-3, NFR-E7-4, UX-DR-E7-3).
Discharges Epic 6 retro action item **C1** and the recorded prerequisite for FR42/FR43.

**Files (epic's list):** `bp_back/src/main/kotlin/com/bagplease/entity/item/ItemService.kt`, its Kotest tests, one
Playwright spec. `bp_back/.../gql/GqlItemInput.kt` is **not** modified.

**Files (measured — see the scope section below):** the above **plus** `bp_back/.../plugins/GQL.kt` (one DI line) and
`bp_back/.../entity/item/mongo/ItemRepository.kt` (one new read method). Kotest changes land in `ItemLifecycleTest.kt`
(new tests + the service factory) and `ItemApiTest.kt` (one fixture). **No other test file is touched.**

**Scoped unfreeze:** this is the **first deliberate `bp_back/` change since Epic 4** (AR-E7-0). Measured: `git log -- bp_back/`
last touched at `d4d94fa` (2026-07-28). Epics 5, 6 and Stories 7.1–7.3 all carried an explicit `git diff --stat bp_back/`
→ empty boundary check. That check now inverts: this story is the one that must show a `bp_back/` diff, and must show
**nothing outside the list it names**.

**Depends on:** nothing. 7.4 is independent of the 7.1→7.2→7.3 chain and of 7.5/7.6/7.15. It does, however, *benefit*
from 7.3: after it the suite can actually fail, so this story's E2E result is trustworthy.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

---

## ⚠ Read this first: AC10's diff boundary, and how it was resolved

AC10 says *"`git diff` under `bp_back/` shows changes only to `ItemService.kt` and its tests"*. **AC4 and AC3 each
require a capability `ItemService` does not have**, so two extra files are structurally unavoidable. A third potential
breach — the blast radius of the category check across the existing test suite — was **resolved by `md` on 2026-08-10 by
scoping AC4's check to the update branch**, which reduces it from 31 test sites to 1. All figures measured at `0d34ea9`,
not inferred.

### Breach 1 — AC4 needs category access; `ItemService` has none

`ItemService`'s constructor is `(ItemStorage, ListService, ItemRepository)` (`ItemService.kt:16-20`). Categories are a
**separate entity and collection**, reachable only through `CategoryStorage.getByListId(listId): List<Category>`
(`CategoryStorage.kt:31-34`) or `CategoryRepository.getAll()`. Neither is injected. `CategoryRepository` has **no
`findById` and no `getByListId`** — its whole API is `getAll`, `save`, `delete`, `deleteAllInList`.

`ListService` *does* hold `categoryStorage` and `categoryRepository` (`ListService.kt:53,55`) but exposes no accessor —
using it would mean editing `ListService.kt`, which is equally outside the list and worse layering.

**Prescribed fix:** add a 4th constructor parameter `categoryStorage: CategoryStorage`. That forces exactly **two**
one-line edits, both pure wiring:

| File | Line | Current | Why it breaks otherwise |
|---|---|---|---|
| `bp_back/.../plugins/GQL.kt` | 88 | `val itemService = ItemService(itemStorage, listService, itemRepository)` | positional call; won't compile. `categoryStorage` is already in scope **one line above** (`GQL.kt:73`) |
| `bp_back/.../ItemLifecycleTest.kt` | 145 | `return ItemService(itemStorage, listService, itemRepository)` | the scheduler-test service factory; `categoryStorage` already built at `:131` |

`ItemLifecycleTest.kt` is "its tests", so in scope. **`GQL.kt` is the breach** — one line of DI, no behaviour.

### Breach 2 — AC3 needs a global item lookup; only a list-scoped one exists

`ItemStorage.getByIdCached(id, listId)` is **scoped by `listId`** (`ItemStorage.kt:36-39`). An id living on a *different*
list simply returns `null`, so the save takes the create branch — and `ItemRepository.save`'s filter is `_id` **only**,
with no `listId` clause (`ItemRepository.kt:42`), so the item is **silently relocated to the new list**. That is precisely
the failure AC3 forbids, and nothing in the current API can see it. `ItemRepository` has **no `findById`**; its reads are
`getAll()`, `findCheckedRecurringItems()`, `findSoftDeletedToHardDelete()`.

Two ways to detect it:

- `repository.getAll().any { it.id == item.id }` — **zero new files** (`repository` is already a field), but a
  full-collection scan on every create. Rejected: O(n) per write for a one-document question.
- **Prescribed:** add `suspend fun findById(id: UUID): Item?` to `ItemRepository.kt` — an indexed `_id` point read,
  the natural home, ~4 lines. **`ItemRepository.kt` is the breach.**

### Not a breach — the AC4 category check is scoped to the UPDATE branch (`md`, 2026-08-10)

`Item.category: UUID` is a bare UUID with **no referential integrity** — today `saveItem` accepts any random value, and
the backend tests exploit that universally. Measured:

```
32  saveItem( call sites across 7 Kotest files
     ItemLifecycleTest 17 · ItemApiTest 5 · ItemCategoryStorageTest 3 · ListAuthorizationTest 2
     SubscriptionScopingTest 2 · ListSharingTest 2 · ListServiceTest 1
31  of those 32 pass a `catId = UUID.randomUUID()` for a category that was NEVER created
 1  of them REUSES an item id across two saveItem calls — ItemApiTest.kt:118-149 (:133 then :139)
```

**Checking the category on both branches would turn 31 green tests red across six files that are not `ItemService`'s
own. Checking it on the update branch only turns exactly ONE red.** `md`'s decision: **update branch only.**

That is not a compromise, it is the accurate scope of the bug. The ledger states it outright: BUG-E6-3b is by
construction an *update* defect — *"before Story 6.1, no UI path ever issued `saveItem` for an already existing id"*
(`deferred-work.md:798-799`). A stale edit dialog is the only thing that produces the state AC4 describes.

Reproduce the two numbers before starting — this is the story's ground truth:

```bash
cd bp_back/src/test/kotlin/com/bagplease && grep -c "saveItem(" *.kt | grep -v ':0'      # 32 across 7 files
grep -rn "saveCategory" *.kt          # exactly 2 hits: ListServiceTest:178, SubscriptionScopingTest:186
```

**Only `ItemApiTest.kt:118-149` ("updates existing item") breaks.** Verified by inspection of every site: every other
`saveItem` call creates a fresh id, so all of them stay on the create branch. Three near-misses that do **not** break,
so you are not surprised by them:

- `ItemLifecycleTest.kt:187-212` loops over the `Recurring` enum values but declares `val itemId = UUID.randomUUID()`
  **inside** the loop (`:199`) — a fresh id per iteration.
- `ItemLifecycleTest.kt:470-499` passes `UUID.randomUUID()` inline at each of its four calls.
- `ItemCategoryStorageTest.kt:116,121` uses `itemId1` / `itemId2`.

**`checkItem`, `uncheckItem` and `runSchedulerCycle` call `storage.save(...)` directly and never go through
`saveItem`**, so the category check cannot reach them. AC6 therefore needs **no fixture edits at all** — see the AC6
note.

**Production is unaffected, verified not assumed.** `saveItem` has exactly **two** frontend callers —
`AddItemDialog.tsx:104` and `EditItemDialog.tsx:133` — and **neither ever invents a category**: both take a `categories`
prop sourced from the list (`ListDetailPage.tsx:252,266`) and send a `categoryId` picked from it. No frontend path
creates a category as part of adding an item. (The ledger's `handleAddItem` / `saveCategory`-then-`saveItem` entry at
`deferred-work.md:693` describes the **pre-Epic-5 Next.js** page, which no longer exists — do not reason from it.)

**What this knowingly leaves open, and it must be filed (Task 8):** the create branch still accepts a `category` that
belongs to no list. No UI path produces it, but a direct GraphQL caller can, and the resulting item renders under no
group — the same unrecoverable state as BUG-E6-3b, reached by a different door. That is a deliberate, recorded scope
decision, not an oversight, and it goes in `deferred-work.md` alongside the note that `Item.category` has no schema-level
referential integrity.

### Settled scope

Two files outside the epic's `Files:` line, both structurally forced, both pure enabling changes with no behaviour of
their own: **`GQL.kt`** (one DI argument) and **`ItemRepository.kt`** (one indexed read). Record both in the story record
and the commit body — of the same class Story 7.2 found in its own `Files:` line, and **do not absorb them silently.**
Everything else stays inside `ItemService.kt` and its tests.

---

## Decisions (settled — do not re-open)

**`md`'s rulings, 2026-08-10.** All four questions this context raised are answered; nothing is blocked.

| # | Ruling |
|---|---|
| A | **AC4's category check applies to the UPDATE branch only.** Cost: 1 test site, not 31. The create-branch hole is knowingly open and must be filed. |
| B | **`IllegalArgumentException` is the error idiom.** No `extensions.code`; the `BAD_USER_INPUT` option is declined and filed to the ledger. |
| C | **Epic 7 stays on the current `epic7-maintenance` branch.** AR-E7-12's literal pattern is waived; the intent (not a stale Epic-4 name) is satisfied. Do not rename, and do not re-raise it. |
| D | **This story runs the story-file flow** (`dev-story` against this file), not the dev-auto spec flow. No `spec-7-4-*.md` is expected. The bookkeeping obligations are identical either way. |

1. **Create-vs-update is discriminated by EXISTENCE IN STORAGE, never by presence of the id** (AR-E7-2, `md`'s ruling
   2026-07-29). `GqlItemInput.id` is non-nullable and the frontend calls `crypto.randomUUID()` for **new** items too.
   Epic 6 action item C1's literal wording — *"reject an upsert for a non-existent id"* — **is wrong and would break
   add-item entirely.** Record that correction; do not implement C1 as written.
2. **The frontend is not changed.** No `GqlItemInput` change, no schema change, **no `npm run generate` run anywhere in
   this epic.** If you find yourself needing codegen, you have gone outside the story.
3. **`checkItem`, `uncheckItem` and `runSchedulerCycle` are already correct** — they `copy()` the stored item and are the
   reference pattern (AR-E7-3). Their existing Kotest coverage is the regression net. **`uncheckItem` deliberately
   clears `checkedAt` — that is the scheduler contract, not an instance of this bug.** Do not "fix" it.
4. **BUG-E6-3a (resurrection) is NOT fixed here.** `ItemStorage.delete` is a hard delete, so a save against a deleted id
   correctly takes the create branch. The merge *downgrades* it: the row returns as a genuinely new item (`addedBy` = the
   editor, who did create it; `checkedAt` null, correct for a new item) and is removable through the UI. The real fix is
   soft-delete tombstones the scheduler would own — outside the scoped unfreeze. **AC9: record the downgrade in the
   ledger; never close it silently.**
5. **Error idiom: `throw IllegalArgumentException(...)` from `ItemService.kt`** (ruling B). AC3/AC4 require only "fails with an
   error and writes nothing". Verified: **all four `GraphQL*Exception` classes are imported exclusively by `gql/` layer
   files — no service imports them**, so throwing one from `ItemService` would be a service→plugins layering violation.
   The in-file precedent is `throw IllegalStateException("Item not found")` (`ItemService.kt:53,67`) and the sibling
   precedent is `ListService.createList`'s `IllegalArgumentException` for an over-long name (`ListService.kt:62`).
   Consequence to accept knowingly: a plain throw surfaces as graphql-java's default `ExceptionWhileDataFetching` with
   **no `extensions.code`** — the same shape already logged as debt at `deferred-work.md:497`. Getting `BAD_USER_INPUT`
   would mean editing `ItemApi.kt`; **declined**, and filed as a ledger entry instead.
6. **Do not change `saveItem`'s `Either` Left type.** `ItemApi.kt:53` does `ifLeft = { throw it.toException() }` against
   `ListAuthError`. A new Left case forces edits in `ListService.kt` *and* `ListApi.kt:146`. Stay on
   `Either<ListAuthError, Item>`.
7. **The rejection must throw BEFORE `itemUpdateChannel.emit(...)`.** `ItemSubscriptions.getItemUpdates` broadcasts
   whatever is emitted; emitting on a rejected save would push a `SAVED` event for a write that did not happen to every
   member's shopping view.
8. **`ItemApi.kt` is unchanged.** The GQL→domain mapping stays in `GqlItemMapper.mapItemFromInput`; the merge happens
   *after* it, inside the service. You cannot tell "absent from input" from "defaulted" inside `saveItem`, so treat the
   incoming `Item`'s `addedBy`/`checkedAt`/`deleted`/`deletedAt` as **meaningless on the update branch** — take them from
   storage — and keep the incoming `addedBy` (the caller) on the create branch.

---

## Story

As a **list member**,
I want **editing an item to change only what I edited**,
so that **fixing a co-member's typo does not steal their authorship, and editing a checked item does not silently break
its recurrence**.

---

## Acceptance Criteria

**AC1 — an edit preserves every server-owned field (FR58, BUG-E6-1, BUG-E6-2)**

**Given** an item with a recorded `addedBy`, a non-null `checkedAt`, and `deleted`/`deletedAt` state
**When** a **different** member saves it with a changed name
**Then** `addedBy` is unchanged — the original author keeps authorship
**And** `checkedAt`, `deleted` and `deletedAt` are unchanged
**And** only the fields `ItemInput` carries (`name`, `checked`, `category`, `store`, `recurring`) reflect the input

**AC2 — create still works, and the discriminator is storage existence (AR-E7-2)**

**Given** `GqlItemInput.id` is non-nullable and the frontend generates the UUID client-side with `crypto.randomUUID()`
for **new** items as well as edits
**When** `saveItem` receives an id that does **not** exist on the target list
**Then** the item is created, with `addedBy` set from the caller exactly as today
**And When** the id **does** exist on the target list
**Then** the stored item is loaded and the input merged onto it
**And** the frontend is **not** changed and continues to supply client-generated UUIDs
**And** rejecting unknown ids is explicitly **not** implemented — it would reject every new item

**AC3 — an id belonging to another list is rejected**

**Given** an item id that exists, but on a list other than the `listId` in the input
**When** `saveItem` is called
**Then** it fails with an error and writes nothing
**And** the item is not moved between lists

**AC4 — a category outside the list is rejected (BUG-E6-3b)**

**Given** a save whose `category` does not belong to the target list — the state a stale dialog produces after a
co-member deletes a category
**When** `saveItem` is called
**Then** it fails with an error and writes nothing
**And** no item is left with a dangling `category` rendering under no group

> **Scope of this check (`md`, 2026-08-10): the UPDATE branch only.** BUG-E6-3b is by construction an update defect —
> the ledger records that before Story 6.1 *"no UI path ever issued `saveItem` for an already existing id"*
> (`deferred-work.md:798-799`) — and a stale edit dialog is the only producer of AC4's state. Checking creates as well
> would fail **31** existing tests that invent a `catId`, versus **1** for update-only. The create-branch hole is
> deliberately left open and **must be filed** in `deferred-work.md` (Task 8), together with the fact that
> `Item.category` has no schema-level referential integrity.

**AC5 — the check-off clock survives an edit, so recurrence still works (FR54)**

**Given** a recurring item that was checked off, so `checkedAt` is set
**When** its name is edited and saved
**Then** `checkedAt` is unchanged
**And** `runSchedulerCycle` still restores it once its cadence elapses — it no longer `continue`s on a null `checkedAt`
**And** this is covered by a Kotest test that **drives the scheduler**, not only by asserting the field

**AC6 — the already-correct paths do not regress (AR-E7-3)**

**Given** `checkItem`, `uncheckItem` and `runSchedulerCycle` already `copy()` the stored item
**When** the story is complete
**Then** their existing Kotest coverage still passes unchanged
**And** `uncheckItem` still deliberately clears `checkedAt` — that is the scheduler contract, not an instance of this bug

> **"Unchanged" is literal here, and the update-branch scoping is what makes it so.** The check/uncheck/scheduler
> tests in `ItemLifecycleTest` (`:214`, `:244`, `:275`, `:305`, `:341`, `:367`, `:397`, `:429`) each create their item
> with a **fresh** id, so every one stays on the create branch and the AC4 check cannot reach them. Beyond that,
> `checkItem`, `uncheckItem` and `runSchedulerCycle` call `storage.save(...)` **directly** — they never route through
> `saveItem` at all. **Expect zero edits to any of these tests.** If one of them goes red, the merge has changed
> behaviour it should not have; treat that as a defect in your change, never as a fixture to update.

**AC7 — Kotest coverage exists and was observed failing first (NFR-E7-4)**

**Given** every AC above is a server-side behaviour
**When** the story is completed
**Then** each of AC1–AC5 has Kotest coverage
**And** each new test was proven non-vacuous by **reverting the fix**, confirming the test goes **red**, and restoring
**And** that break-and-restore is recorded in the story's dev notes, with verbatim output
**And** the full backend suite passes (baseline **105 tests, 0 failures** — verified green at `0d34ea9`)

**AC8 — one end-to-end proof that the user-visible symptom is gone (FR45)**

**Given** the shopping view renders `addedBy` as `shopping-item-addedby-<name>`
**When** a list is shared with a second member who accepted, member A adds an item, and member B edits its name
**Then** the shopping row still attributes the item to **A**
**And** this is an FR45/FR58-tagged Playwright spec passing on **both** `chromium` and `mobile` against the production
image
**And** it was manually exercised in a real browser first, and observed failing before being accepted

**AC9 — BUG-E6-3a is recorded, not silently closed (AR-E7-2a)**

**Given** `ItemStorage.delete` is a hard delete, so a save against a deleted id takes the create branch
**When** the story is completed
**Then** `deferred-work.md` records BUG-E6-3a as **severity-downgraded rather than fixed**
**And** the entry names the real fix — making `deleteItem` a soft delete, with the tombstones the scheduler would then
own — and states that it is outside Epic 7's scoped unfreeze
**And** the BUG-E6-1 and BUG-E6-2 entries are marked resolved by this story

**AC10 — the change is scoped, the schema is untouched, and the edit UI gains nothing (AR-E7-0, AR-E7-1, UX-DR-E7-3)**

**Given** the unfreeze is scoped to named files, and FR58 is entirely server-side
**When** the story is completed
**Then** `git diff` under `bp_back/` shows changes **only** to the files this story names — `ItemService.kt`,
`ItemRepository.kt` (one added read), `GQL.kt` (one DI line), `ItemLifecycleTest.kt` and `ItemApiTest.kt` — **and the two
deviations from the epic's file list (`GQL.kt`, `ItemRepository.kt`) are recorded explicitly in the story record and the
commit body**
**And** `GqlItemInput.kt` is unchanged, no GraphQL schema change occurred, and **no `npm run generate` run was needed**
**And** `git diff` shows no change under `bp_front/src/` **at all** — only the new file under `bp_front/e2e/`.
`EditItemDialog.tsx`, `AddItemDialog.tsx` and the shared store field are untouched, and no edit or delete affordance
appears on the shopping view (UX-DR-E6-2a still holds: `/lists/:id` manages, `/list/:id` uses)
**And** the only user-visible change is the correction itself — the `addedBy` avatar stops flipping to whoever last
edited, and a checked item edited by a co-member stays checked with its clock intact

---

## Tasks / Subtasks

- [ ] **Task 0 — establish the baseline before touching anything** (AC7, AC10)
  - [ ] `git status --short` → empty. `git rev-parse HEAD` → `0d34ea9`
  - [ ] `./gradlew :bp_back:test` → **BUILD SUCCESSFUL, 105 tests, 0 failures.** Record the number
  - [ ] `cd bp_front && npx playwright test --list | tail -2` → `Total: 104 tests in 9 files`
  - [ ] `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` → `51/51/1/1`
  - [ ] Re-measure the 32/31 category figure with the two greps in the scope section above
  - [ ] Confirm the single-update-site claim yourself — `grep -n "saveItem(\|test(" ItemApiTest.kt` and check that
        `:133` and `:139` share one `$itemId`, and that no other file reuses an id across two `saveItem` calls

- [ ] **Task 1 — add the two capabilities `ItemService` lacks** (AC3, AC4; the recorded deviations)
  - [ ] `ItemRepository.kt`: add `suspend fun findById(id: UUID): Item?` — `col.find(Filters.eq(idCol, id.toString()))`,
        `.mapNotNull(MongoItemMapper::mapItemFromMongo).firstOrNull()`. **`id.toString()`, not the raw UUID** — every
        UUID in this collection is persisted as a string and a raw-UUID filter silently matches nothing
  - [ ] `ItemService.kt`: add `private val categoryStorage: CategoryStorage` as the 4th constructor parameter
  - [ ] `GQL.kt:88`: `ItemService(itemStorage, listService, itemRepository, categoryStorage)` — `categoryStorage` is
        already in scope at `:73`
  - [ ] `ItemLifecycleTest.kt:145`: same addition in `buildItemService(db)`; `categoryStorage` already built at `:131`
  - [ ] `./gradlew :bp_back:build` compiles

- [ ] **Task 2 — rewrite `saveItem` as a merge** (AC1, AC2, AC3, AC4) — see the prescribed body in Dev Notes
  - [ ] `storage.getByIdCached(item.id, item.listId)` first; found → category check, then `copy()` the five input
        fields; not found → cross-list check via `repository.findById`, then create
  - [ ] The category check goes **inside the update branch** — not before the lookup
  - [ ] Both rejections `throw` **before** `itemUpdateChannel.emit(...)`
  - [ ] `getItems`, `deleteItem`, `checkItem`, `uncheckItem`, `getStoreSuggestions`, `runSchedulerCycle` untouched

- [ ] **Task 3 — repair the one test site the category check invalidates** (AC6, AC7)
  - [ ] `ItemApiTest.kt:118-149` ("updates existing item") is the **only** existing test that reuses an item id across
        two `saveItem` calls (`:133` then `:139`), so it is the only one that reaches the update branch. Add a
        `saveCategory` mutation for its `catId` before the first `saveItem`, modelled on `ListServiceTest.kt:176-180`
  - [ ] **Expect no other test file to need any change.** Verify rather than assume: `./gradlew :bp_back:test` →
        105 + new tests, 0 failures. If anything else goes red, that is a defect in the merge, not a fixture to update
  - [ ] **No test's assertions weakened to make it pass**

- [ ] **Task 4 — Kotest coverage for AC1–AC5** (AC7) — see the test recipes in Dev Notes
  - [ ] AC1: two members, B edits A's item → `addedBy` still A; `checkedAt`/`deleted`/`deletedAt` preserved
  - [ ] AC2: unknown id → creates with caller as `addedBy`; known id → merges
  - [ ] AC3: id on list X, save with `listId` Y → `errors`, and the item is still on X
  - [ ] AC4: **on an existing item** (create it first, then save again) with a category belonging to another list, and a
        second case with a category belonging to no list → `errors`, and the stored row still carries the old category.
        Also assert the **create** branch still accepts an unknown category, so the scoping is pinned by a test rather
        than left as prose — that test is the tripwire if someone later "tightens" it and breaks 31 others
  - [ ] AC5: **drives `runSchedulerCycle`** — checked WEEKLY item, `checkedAt` backdated, name edited, then the cycle
        restores it. Asserting the field alone does not satisfy AC5
  - [ ] **Max two `registerAndLogin` calls per `testApplication` block** — see trap 4

- [ ] **Task 5 — observe every new Kotest test failing** (AC7, NFR-E7-4)
  - [ ] Revert only the merge (`toSave = item` unconditionally), re-run the new tests, confirm **red for the right
        reason**, capture verbatim output, restore
  - [ ] Separately revert the AC3 and AC4 guards and confirm those tests go red
  - [ ] Verify the restore is byte-exact (`git diff` matches the intended change and nothing else)

- [ ] **Task 6 — the E2E spec** (AC8) — new file `bp_front/e2e/item-attribution.spec.ts`
  - [ ] Manually exercise the flow in a real browser at `:2080` **first**, and say so in the record
  - [ ] `test('FR45/FR58 — a co-member editing an item does not steal the original author\'s attribution', …)`
  - [ ] **No `{tag: …}`** — this test must not carry `@registration-toggle`
  - [ ] New `uniqueUsername` prefix (`attrib`) and extend the registry comment at `e2e/support/ui.ts:18`
  - [ ] **Member A — the adder, whose shopping view is asserted — on the `page` fixture.** B in the hand-built context
  - [ ] `docker compose up -d --build` (**a rebuild is mandatory — the backend changed**), then run the spec
  - [ ] Observe it failing against the **unfixed** backend, red on both projects, then with the fix

- [ ] **Task 7 — gates and boundary checks** (AC10)
  - [ ] `./gradlew :bp_back:test` → green
  - [ ] `cd bp_front && npx tsc -b` → exit 0 (**before** the suite — a type error fails the Docker build, not just the gate)
  - [ ] `npm run lint` → exit 0, **zero output**
  - [ ] `npx playwright test --list | tail -2` → `Total: 106 tests in 10 files`
  - [ ] split → `52 chromium / 52 mobile / 1 registration-toggle-chromium / 1 registration-toggle-mobile`
  - [ ] `npm run test:e2e` → all green at `retries: 0`, on both projects
  - [ ] `grep -rn "toPass" bp_front/e2e/` → **exactly one** hit, `navigation.spec.ts:100`
  - [ ] `grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" bp_front/e2e/` → no hits
  - [ ] `git diff --stat bp_back/` → only the named files. `git diff --stat bp_front/src/` → **empty**
  - [ ] `git diff bp_back/src/main/kotlin/com/bagplease/entity/item/gql/GqlItemInput.kt` → empty

- [ ] **Task 8 — reconcile the four bookkeeping artifacts** (AC9; the invariant set every 7.x commit carries)
  - [ ] `deferred-work.md`: new `## Deferred from: Story 7.4 — …` section placed **immediately after the Story 7.3
        section** (before the `## Deferred from: code review of 7-3-…` heading at ~L402); BUG-E6-1 (L765) and BUG-E6-2
        (L777) marked resolved using the house strikethrough + `Retained for history:` convention; BUG-E6-3 (L797)
        annotated with the (a)/(b) split; the FR42/FR43 entry (L107) noted as having its prerequisite discharged; and
        the ledger's known-wrong `proposed fix` at L814-815 corrected
  - [ ] `sprint-status.yaml`: `7-4-item-edit-merges-stored-item: done`, `last_updated`, and Epic 6 action item **C1**
        `open → done` with the C1-wording correction recorded
  - [ ] `project-context.md`: the item-save merge semantics, the category/cross-list rejections, and the new E2E prefix
  - [ ] The story record / spec: every deviation, every measurement, every break-and-restore

---

## Dev Notes

### `saveItem` as it is today (`ItemService.kt:37-42`) — the whole bug

```kotlin
suspend fun saveItem(item: Item, caller: CallerUsername): Either<ListAuthError, Item> = either {
    listService.verifyMembership(caller, item.listId).bind()
    val savedItem = storage.save(item)
    itemUpdateChannel.emit(savedItem)
    savedItem
}
```

No read-before-write. The `Item` it receives was built fresh by `GqlItemMapper.mapItemFromInput` (`GqlItemMapper.kt:26-41`),
so `Item`'s defaults (`Item.kt:6-18`) fill everything `ItemInput` does not carry, and `ItemRepository.save`
(`ItemRepository.kt:41-57`) `Updates.set`s **all ten fields** under `UpdateOptions().upsert(true)`.

| `Item` field | in `ItemInput`? | value on an edit today |
|---|---|---|
| `id`, `listId` | yes | identify the row |
| `name`, `checked`, `category`, `store`, `recurring` | yes | from input — **correct** |
| **`addedBy`** | no | overwritten with the **current caller** → **BUG-E6-1** |
| **`checkedAt`** | no | `null` → **BUG-E6-2** (scheduler `continue`s on null, `ItemService.kt:90`) |
| **`deleted`** / **`deletedAt`** | no | `false` / `null` → **BUG-E6-3** |

So the merge target is exactly `{name, checked, category, store, recurring}`; `{addedBy, checkedAt, deleted, deletedAt}`
must come from storage.

### Prescribed `saveItem` body

```kotlin
suspend fun saveItem(item: Item, caller: CallerUsername): Either<ListAuthError, Item> = either {
    listService.verifyMembership(caller, item.listId).bind()

    val stored = storage.getByIdCached(item.id, item.listId)
    val toSave = if (stored != null) {
        // AC4 / BUG-E6-3b — on the UPDATE branch only (md, 2026-08-10). A stale edit dialog can hold
        // a category a co-member has since deleted; writing it produces an item that renders under no
        // group on either screen, recoverable only via direct DB access. Scoped to update because that
        // is the actual shape of the bug — no UI path issued saveItem for an existing id before
        // Story 6.1 — and because checking creates too would fail 31 existing tests that invent a
        // catId. The create-branch hole is knowingly open and filed in deferred-work.md.
        if (categoryStorage.getByListId(item.listId).none { it.id == item.category }) {
            throw IllegalArgumentException("Category ${item.category} does not belong to list ${item.listId}")
        }
        // AC1 / AR-E7-1 — merge, do not reconstruct. addedBy, checkedAt, deleted and deletedAt
        // are server-owned and are NOT in ItemInput, so the incoming values are meaningless here.
        stored.copy(
            name = item.name,
            checked = item.checked,
            category = item.category,
            store = item.store,
            recurring = item.recurring,
        )
    } else {
        // AC3 — getByIdCached is list-scoped, so an id living on another list also misses. Without this
        // check the create branch upserts by _id alone and silently relocates the item.
        if (repository.findById(item.id) != null) {
            throw IllegalArgumentException("Item ${item.id} belongs to a different list")
        }
        item  // AC2 — create: addedBy comes from the caller, exactly as today
    }

    val savedItem = storage.save(toSave)
    itemUpdateChannel.emit(savedItem)
    savedItem
}
```

Why `stored.copy(...)` and not `item.copy(addedBy = stored.addedBy, …)`: copying **onto the stored row** is
allowlist-shaped — a field added to `Item` later is preserved by default. The inverse is denylist-shaped and the next
server-owned field silently regresses. This is also the shape `checkItem`/`uncheckItem`/`runSchedulerCycle` already use
(AR-E7-3).

`stored.copy` keeps `stored.id` and `stored.listId`, which equal `item`'s by construction — `getByIdCached(item.id, item.listId)`
matched on both.

### Five traps, all pre-verified

1. **Raw UUIDs in Mongo filters match nothing.** Every UUID in this schema is persisted as a **string**
   (`UUIDSerializer` → `value.toString()`). `findById` must use `Filters.eq(idCol, id.toString())`. `idCol = "_id"`.
2. **`getByIdCached` does not filter `deleted`; `getByListId` does** (`ItemStorage.kt:33` vs `:38`). That is *why* the
   merge preserves a soft delete. Do not "fix" it by switching to `getByListId`, and do not be surprised that an edit to
   a checked-off `ONE_TIME` item keeps it invisible — that is AC1 working.
3. **`testApplication` and `buildItemService(db)` build separate `ItemStorage` instances that do not share caches** —
   they see each other's *Mongo writes* only after their own first lazy `sync()`. An AC5 test that mutates over HTTP and
   then calls `runSchedulerCycle()` on a `buildItemService` instance works only because the second instance syncs from
   Mongo at first touch. Build the scheduler service **after** the HTTP writes, never before.
4. **The auth rate limiter will break a three-user test.** `RateLimitName("auth")` wraps all `/auth/*` at
   `rateLimit.attempts: "5"` per 60s (`bp_back/src/test/resources/application.yaml`), and each `registerAndLogin(...)`
   costs **two** `/auth/login` calls (admin + the new user). Two members = 4 requests, fine. A third
   `registerAndLogin` in the same `testApplication` block = 6 → **HTTP 429**, and
   `mapper.readTree(...)["accessToken"]` NPEs with a useless message. The limiter resets between blocks.
5. **HTTP 200 does not mean GraphQL success.** Assert `body shouldNotContain "errors"` on every success path and
   `shouldContain "errors"` on AC3/AC4 — and on the rejection tests **also** assert the stored row is unchanged, or the
   test proves only that an error was returned, not that nothing was written.

### Kotest recipes

Conventions (all verified in-tree, and mandatory per `project-context.md:129-141`): `FunSpec` only; **no mocking
framework — MockK and Mockito are not in the project, do not add them**; `val container = mongoContainer()` in the spec
body; per-test `testApplication { setUpMongo(container); setUpJwt(); application { module() } }`; test data created
through GraphQL mutations, never direct Mongo writes (the three raw-`Document` scheduler tests are the sole precedent,
and only because they need a backdated `checkedAt`); **randomised usernames and UUIDs** because the container is shared
per spec and tests run in parallel against one MongoDB; assert only on what your test created, by UUID never by name.

`ItemLifecycleTest.kt` is the canonical home. It already has, as local `suspend fun ApplicationTestBuilder.…` closures:
`loginToken` (`:56`), `registerAndLogin` (`:65` — via the admin `createUser` mutation, **not** `/auth/register`, which is
gated by `registrationEnabled`), `createList` (`:75`), `saveItem` (`:83`), `getItems` (`:106`), `connectToDb` (`:113`) and
`buildItemService` (`:130`). Reuse them; there is **no shared backend test-helper module** and this story should not
create one.

Representative shape to copy verbatim (`ItemLifecycleTest.kt:150-166`):

```kotlin
test("AC1 addedBy is set from principal, not from input") {
    val username = "user_${UUID.randomUUID().toString().take(8)}"
    val itemId = UUID.randomUUID()
    val catId = UUID.randomUUID()

    testApplication {
        setUpMongo(container)
        setUpJwt()
        application { module() }
        val token = registerAndLogin(username)
        val listId = createList(token)

        val body = saveItem(token, itemId, catId, listId)
        body shouldNotContain "errors"
        body shouldContain """"addedBy":"$username""""
    }
}
```

Note the existing `saveItem` helper hard-codes `checked: false` and takes no `checkedAt`/`deleted` argument. AC1's
"checked item edited by another member" needs `checkItem` in between — add a `checkItem`/`uncheckItem` mutation helper
alongside it rather than widening `saveItem`'s signature past readability.

**AC5 specifically** — the scheduler must be *driven*, and `checkedAt` must be older than the cadence. The two workable
shapes:

- **(a) API then backdate then drive.** Create a WEEKLY item over HTTP → `checkItem` (sets `checkedAt = now`) → **edit
  its name** over HTTP → reach into Mongo to set `checkedAt` 8 days back (`ItemLifecycleTest` already imports
  `com.mongodb.client.model.Updates` and `java.util.Date` for exactly this) → `buildItemService(db).runSchedulerCycle()`
  → re-read and assert `checked == false`, `checkedAt == null`. **This is the shape AC5 wants**: the edit happens
  *before* the cycle, so it proves the edit did not destroy the clock.
- **(b) Raw-seed then drive**, following `ItemLifecycleTest.kt:367-395` verbatim (`_id` as a **String**, timestamps as
  `Date.from(instant)`). Simpler but the edit cannot be an HTTP edit on the same cache, so it proves less. Prefer (a).

Do **not** assert `checkedAt` by reading the collection alone — AC5 says explicitly "a Kotest test that drives the
scheduler, not only by asserting the field".

### The E2E spec (AC8)

New file `bp_front/e2e/item-attribution.spec.ts`. One test.

**The testid trap — read carefully.** `ListShoppingPage.tsx:440-454`:

```tsx
{item.addedBy && (
  <Stack … data-testid={`shopping-item-addedby-${item.name}`}>
    <Avatar …>{item.addedBy.charAt(0).toUpperCase()}</Avatar>
    <Typography …>{item.addedBy}</Typography>
  </Stack>
)}
```

- **`<name>` in the testid is the ITEM name, not the user.** After B renames the item, the locator becomes
  `shopping-item-addedby-${afterName}` — the testid *changes* as part of the scenario.
- The label is the raw **username**, not a display name or initials.
- The Stack holds the avatar initial **and** the username, so use `toContainText(memberA)` — `toHaveText` would see
  `"A" + username` concatenated and fail for the wrong reason.
- `grep -rn "shopping-item-addedby-" bp_front/e2e/` returns **nothing today**. FR45's rendering has zero E2E coverage;
  this is its first assertion.

**Actor placement is load-bearing.** `browser.newContext()` does **not** inherit the project's `use` block, so a
hand-built context silently runs at a **desktop** viewport on the `mobile` project. That exact mistake is one of Epic 6's
six vacuous assertions and it recurred at the 7.3 review. The assertion here is about what the **shopping view
renders**, so:

> **Member A — the adder, whose `/list/:id` is asserted — goes on the `page` fixture. Member B, the editor, goes in the
> hand-built context.** A-on-`page` also gives A the `addItem(page, …)` path, which is what makes `addedBy === A`.

The precedent that already solved this exact question is `item-editing.spec.ts:320-380` (FR40) — copy its structure,
including its explanatory comment. Note it places the **owner** on `page` as observer and the co-member as editor, which
is the same shape this story needs.

Membership prep via API is **permitted** (AR-E7-5: API calls for environment preparation only, never for behaviour under
test). The established 4-line block, with a `// SETUP ONLY` comment naming why:

```ts
const ownerToken = await loginApi(owner, PASSWORD)
const memberToken = await loginApi(member, PASSWORD)
await gql(`mutation { shareList(listId: "${listId}", username: "${member}") { id } }`, ownerToken)
await gql(`mutation { acceptInvite(listId: "${listId}") { id } }`, memberToken)
```

Both users must be registered through the UI first. Sharing UI is Story 5.7's subject, not this story's.

Flow: A registers → `openListsViaMenu` → `createListAndOpen` → `addCategory` → `addItem`; B registers in `ctx`;
seed membership; A parks on `/list/${listId}` and asserts `shopping-item-addedby-${before}` contains A; B goes to
`/lists/${listId}` and edits the name via `edit-item-button` → `edit-item-name` → `edit-item-submit`; A's parked page
updates live (`ItemUpdatesSubscription` selects `addedBy`, `listsQueries.ts:286`) and
`shopping-item-addedby-${after}` **still** contains A; then `page.reload()` and assert again, so the test proves server
truth rather than cache state.

**Two landmines:**

- `EditItemDialog.handleSubmit` (`:120-124`) **short-circuits and sends no mutation when nothing changed** — a comment in
  the file cites BUG-E6-1 as the reason. The new name must genuinely differ (`name.trim() !== shown.name`), or the test
  passes while asserting nothing.
- `/lists/:id` (plural) is **management** and has the edit affordance; `/list/:id` (singular) is **shopping** and is the
  only surface rendering `addedBy`. Navigate with `page.goto()`, as every spec does.

**Spec-file conventions** (all uniform today — keep them):

- Relative imports only: `from './support/ui'`, `from './support/api'`. **Never `@/`** — `tsconfig.e2e.json` has no
  `paths` and Playwright resolves `bp_front/tsconfig.json`, so an alias type-checks and fails at runtime
- No `test.describe` blocks anywhere in the suite; top-level `test(...)` with the FR tag as a **title prefix** followed
  by an em dash
- File header comment stating story + FR scope, "UI-driven only for every asserted behaviour" with each non-UI use
  individually justified, the mandatory-mobile-gate note, and the fresh-user / assert-only-own-data rule
- New `uniqueUsername` prefix. Taken: `acct`, `admin`, `item_editing`, `lists`, `nav`, `sharing`, `shopping`. Use
  **`attrib`** and add it to the registry comment at `e2e/support/ui.ts:18`
- `uniqueUsername(prefix, label, projectName)` — three transposable positional strings; a swap compiles, lints and
  type-checks clean while placing the spec in a foreign namespace. Get the order right
- No semicolons, single quotes, 2-space indent, no space inside import braces, specifiers sorted alphabetically
- **Await every web-first matcher by hand.** `@typescript-eslint/no-floating-promises` is not enabled (type-aware
  linting arrives in 7.11), so a forgotten `await` on `expect(...).toBeVisible()` passes both gates and asserts nothing
- `tsconfig.e2e.json` sets `noUnusedLocals`/`noUnusedParameters` — an unused import or an unreferenced `testInfo`
  parameter is a **build error**
- **Do not add a `toPass` wrapper anywhere.** Story 7.3 deleted the last registration retry deliberately; `grep -rn toPass
  bp_front/e2e/` must stay at exactly one hit
- **Do not add `{tag: '@registration-toggle'}`** — this test does not write the registration flag, and the tag would
  route it out of `chromium`/`mobile` into the chained pair

### E2E run mechanics (post-7.3 — these changed)

- **A rebuild is mandatory.** Stories 7.1–7.3 could skip it (no `src/` change); this story changes `bp_back/`, so the
  spec means nothing until `docker compose up -d --build` has actually rebuilt the backend image.
- **Cold start is unreliable.** `docker compose up -d --build` returns when containers *start*, before Caddy answers.
  Bring the stack up by hand, poll until ready, then run with `reuseExistingServer`:
  `curl -s -o /dev/null -w '%{http_code}' http://localhost:2080/api/graphiql` → **`401` means Ktor is warm and
  enforcing auth = ready.**
- **`npx tsc -b` before the suite.** A type error in `e2e/` fails the **Docker image build** (`bp_front/Dockerfile` runs
  `npm run build`), so the suite cannot even start and the failure surfaces as a Docker error.
- **The `--list` total is blind; check the per-project split.** Drop or misspell a tag and the total is unchanged while
  the routing is silently wrong. Do **not** use `--list --project=<name>` — `--project` pulls in `dependencies` and
  reports 103/104.
- **A red run tells you nothing about FR20/FR21.** One failing test in `chromium` or `mobile` makes both
  `registration-toggle-*` projects "did not run" (measured: `1 failed / 2 did not run / 101 passed`, exit 1). If you need
  that answer while something else is broken: `npx playwright test --project=registration-toggle-chromium --no-deps` —
  **`--no-deps` is not optional**, without it the broken dependency re-runs and fails identically.
- **One Playwright invocation at a time against a given backend.** Two concurrent suites (e.g. a default run plus a
  `E2E_BASE_URL=https://bag-please.localhost` run, which `reuseExistingServer` makes easy) share one Mongo
  `ApplicationConfig` document and re-create the deleted race with no retry wrapper left to absorb it. Same for `--shard`.
- `retries` is `process.env.CI ? 2 : 0` and `CI` is unset locally, so **every local run is already `retries: 0`** — there
  is no CI pipeline in this repo (verified 2026-08-08).

### Ledger edits (AC9) — house conventions, measured

`deferred-work.md` has **no frontmatter, no index and no table of contents** — nothing at the top of the file needs
updating. Three conventions to follow exactly:

- **New section heading:** `## Deferred from: Story 7.4 — an item edit merges the stored item (2026-08-10)`, placed
  immediately after the Story 7.3 section and **before** `## Deferred from: code review of 7-3-…` (~L402), matching the
  7.1/7.2/7.3 cluster.
- **Closure:** strikethrough the entry's lead line, then a bold `**RESOLVED <date> by Story 7.4 — …**` paragraph with
  evidence, then the literal marker `Retained for history:` followed by the original text left **byte-intact**.
- **Partial closure:** append the bold `**RESOLVED …**` paragraph *inside* the entry and state explicitly what stays
  open. **An open entry carries no marker at all** — absence of strikethrough *is* the open state.

Six specific edits:

1. **BUG-E6-1** (L765-775) → resolved by this story.
2. **BUG-E6-2** (L777-793) → resolved by this story; note its FR42/FR43 prerequisite is discharged.
3. **BUG-E6-3** (L797-817) → **partial**: (b) dangling-category is fixed by AC4; (a) resurrection is
   severity-downgraded, not fixed. **Its `proposed fix` at L814-815 ("reject an upsert whose id does not exist") is
   known-wrong** — AR-E7-2 established it would reject every new item. Correct it; do not leave it standing.
4. **BUG-E6-3a** — **does not exist in the ledger.** `grep -n "E6-3a\|E6-3b"` returns nothing; those IDs live only in
   `epics.md`. AC9 requires **creating** the record, in the new 7.4 section, as a severity downgrade naming soft-delete
   tombstones as the real fix and stating it is outside the scoped unfreeze.
5. **FR42/FR43** (L107-109) → note the prerequisite is discharged. The cross-link is currently one-directional.
6. **New 7.4 entries** — at minimum, and each of these is a decision `md` took knowingly, so word them as scope
   decisions rather than discoveries:
   - **`saveItem`'s create branch still accepts a category that belongs to no list** (ruling A). No UI path produces it
     — both dialogs pick from the list's categories — but a direct GraphQL caller can, and the result renders under no
     group: the same unrecoverable state as BUG-E6-3b through a different door. Name the cost of closing it: 31 existing
     test sites across six files that invent a `catId`. Name the cheap partial: reject a category that exists on
     *another* list even on create, which no test does.
   - **`Item.category` has no schema-level referential integrity** — the guard is service-layer only, and only on update.
   - **The declined `BAD_USER_INPUT` error shape** (ruling B): AC3/AC4 surface as graphql-java's default
     `ExceptionWhileDataFetching` with no `extensions.code`, so the frontend cannot branch on them. Cross-reference the
     existing error-shape entry at `deferred-work.md:497`.
   - The **AR-E7-2a** severity downgrade (item 4 above).

**Do not disturb** the three open Story 7.3 entries (L358-400: the `dependencies`-cost / `teardown` action, the missing
machine gate for the tag, the non-existent CI pipeline) or the Story 7.2 section (L270-356).

### Where the reviews have found their findings

Stories 7.1, 7.2 and 7.3 each recorded `intent_gap: 0`, `bad_spec: 0`, and **8 / 6 / 11 patches — nearly all in
documentation, not code.** 7.3's summary: *"the medium patches were, in the main, false or unsupported claims in newly
written authoritative prose"* — a false mobile-gate claim, a recovery command that could not work, a false "only
construct" claim, an over-read measurement propagated into three documents. The artifact diffs are consistently the
larger half of each commit and the reviews consistently land there.

**Consequence for this story:** every quantitative claim in the story record, the ledger and `project-context.md` must be
**measured and quoted**, not inferred — and a claim withdrawn must be withdrawn in *every* document it was propagated to.

### Project Structure Notes

- Backend layering (`bp_back/CLAUDE.md`): GQL → service → in-memory storage → Mongo. **The service layer operates
  exclusively on domain models**; the GQL layer only calls GQL mappers, the Mongo layer only Mongo mappers. Injecting
  `CategoryStorage` into `ItemService` is service→storage — correct direction. Importing a `plugins/GraphQL*Exception`
  would be service→plugins — **wrong**, and no service does it today.
- `ItemService` is `ItemService.kt` directly under `entity/item/`, not a `service/` subpackage. Do not create
  `entity/shared/`.
- Storage lazy-sync is mandatory and already correct in both storages: `sync()` at the start of every read/write, guarded
  by `if (synced.not())`. `evictList` deliberately does **not** reset `synced`.
- Every entity's DI is constructed by hand in `GQL.kt:66-90`, positionally — there is no container to update.
- Frontend tests are E2E only, in `bp_front/e2e/`. **No component or unit test framework exists — do not assume one.**
- Branch: **settled — Epic 7 stays on `epic7-maintenance`** (`md`, 2026-08-10, ruling C). AR-E7-12's literal `epic-7-*`
  pattern is waived; its intent (not running a third epic on the stale `epic-4-lists`) is satisfied. Story 7.1 raised this
  and it went unanswered through 7.2 and 7.3; it is now closed. **Do not rename, and do not re-raise it.**

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 7.4`] — lines 3076-3181 (ACs verbatim)
- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 7`] — lines 2866-2894 (standing constraints, story independence)
- [Source: `_bmad-output/planning-artifacts/epics.md`] — AR-E7-0 (442-446), **AR-E7-1 (447-454)**, **AR-E7-2 (455-466)**,
  **AR-E7-2a (467-475)**, **AR-E7-3 (476-479)**, AR-E7-12 (590-591)
- [Source: `_bmad-output/planning-artifacts/epics.md`] — FR58 (966), FR45 restored (968), FR54 restored (969),
  FR40 restored (971), NFR-E7-4 (983)
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`] — BUG-E6-1 (765-775), BUG-E6-2 (777-793),
  BUG-E6-3 (795-817), FR42/FR43 (107-109), Story 7.3 entries (358-400), Story 7.2 entries (270-356), error-shape debt (497)
- [Source: `_bmad-output/implementation-artifacts/epic-6-retro-2026-07-29.md`] — action item C1; the `saveItem` defect
  family table; "6 of 17 review patches were assertions that could not fail"
- [Source: `_bmad-output/implementation-artifacts/epic-7-context.md`] — merge-not-reconstruction, the severity-downgrade
  instruction, scoped-unfreeze escalation rule
- [Source: `_bmad-output/project-context.md`] — backend Kotest rules (129-141), E2E four-project topology (170-191),
  `browser.newContext()` viewport trap (215-218), test-unproven-until-red (205-214), shared support module (258-283)
- Code, all read at `0d34ea9`: `ItemService.kt:37-42,51-72,79-102` · `Item.kt:6-18` · `GqlItemMapper.kt:26-41` ·
  `GqlItemInput.kt` · `ItemStorage.kt:24-46` · `ItemRepository.kt:41-85` · `CategoryStorage.kt:31-34` ·
  `ListService.kt:132-141` · `ItemApi.kt:50-56,89-112` · `GQL.kt:66-90` · `ListApi.kt:146-158` ·
  `ItemLifecycleTest.kt:56-146,150-166,367-395` · `ItemApiTest.kt:118-149` · `ListShoppingPage.tsx:440-454` ·
  `EditItemDialog.tsx:120-124` · `e2e/support/{ui,api}.ts` · `e2e/item-editing.spec.ts:320-380` ·
  `playwright.config.ts` · `tsconfig.e2e.json`

---

## No open questions

All four questions this context raised were answered by `md` on 2026-08-10 and are recorded as rulings A–D in the
Decisions block. **Nothing is blocked; start at Task 0.**

Escalate to `md` only if you discover a *new* backend need outside the five files AC10 now names — that is AR-E7-0's
standing rule, and it stops the story rather than widening it.

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
