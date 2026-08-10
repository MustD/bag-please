---
title: 'Story 7.4 — An item edit merges the stored item instead of reconstructing it'
type: 'bugfix'
created: '2026-08-10'
status: 'done'
baseline_revision: '73db447'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/7-4-item-edit-merges-stored-item.md'
warnings: [oversized] # ~2.9k tokens. The story file's prescriptions were re-measured here and 12 of its
# figures/line numbers are wrong; the corrections table is load-bearing because the story file is loaded as
# context alongside this spec and its wrong numbers would otherwise be followed.
---

<intent-contract>

## Intent

**Problem:** `ItemService.saveItem` (`ItemService.kt:37-42`) does no read-before-write: it hands the freshly
mapped `Item` straight to `storage.save`, and `ItemRepository.save` `Updates.set`s **all 11 fields** under
`upsert(true)`. The four fields `ItemInput` does not carry are therefore reconstructed from `Item`'s defaults on
every edit — `addedBy` becomes whoever last edited (BUG-E6-1), `checkedAt` becomes `null` so the recurring
scheduler silently drops the item (BUG-E6-2, and `runSchedulerCycle` `continue`s on a null `checkedAt` at
`ItemService.kt:90`), and `deleted`/`deletedAt` reset (BUG-E6-3).

**Approach:** Make the save a **merge**: load the stored row with `storage.getByIdCached(item.id, item.listId)`
and `copy()` onto it only the five fields the GraphQL input carries. Server-owned fields come from storage.
Add the two capabilities the merge needs and `ItemService` lacks — a global `ItemRepository.findById` (to detect
an id living on another list) and a `CategoryStorage` dependency (to reject a category outside the list).
Frontend, GraphQL schema and codegen are untouched.

## Boundaries & Constraints

**Always:**
- Create-vs-update is discriminated by **existence in storage**, never by presence of an id. `GqlItemInput.id`
  is non-nullable and the client calls `crypto.randomUUID()` for new items too, so Epic 6 action item **C1**'s
  literal wording ("reject an upsert for a non-existent id") is **wrong and would reject every new item**.
  Record that correction; do not implement C1 as written.
- Merge direction is `stored.copy(name, checked, category, store, recurring)` — copy **onto the stored row**, so
  a field added to `Item` later is preserved by default. The inverse (`item.copy(addedBy = stored.addedBy, …)`)
  is denylist-shaped and the next server-owned field regresses silently.
- Both rejections `throw` **before** `itemUpdateChannel.emit(...)`. `ItemSubscriptions` broadcasts whatever is
  emitted, so emitting on a rejected save pushes a `SAVED` event for a write that did not happen.
- Error idiom is `throw IllegalArgumentException(...)` from the service.
- AC4's category check applies to the **update branch only** (`md`'s ruling A, 2026-08-10).
- Every new Kotest test is observed **red for the right reason** before being accepted, with verbatim output in
  the record (NFR-E7-4).
- Max **two** `registerAndLogin` calls per `testApplication` block — each costs two `/auth/login` requests and
  the `auth` rate limiter is 5 per 60 s.

**Block If:**
- A backend need appears outside the five files named in the Code Map (AR-E7-0's standing rule — it stops the
  story rather than widening it).
- The merge cannot be made to satisfy AC3/AC4 without changing `saveItem`'s `Either<ListAuthError, Item>` Left
  type, `ItemApi.kt`, or `GqlItemInput.kt`.

**Never:**
- No `GqlItemInput` change, no GraphQL schema change, **no `npm run generate` anywhere in this epic**. If codegen
  seems necessary, the change has left the story.
- No change under `bp_front/src/` **at all** — only the new file under `bp_front/e2e/`. No edit or delete
  affordance is added to the shopping view (UX-DR-E6-2a: `/lists/:id` manages, `/list/:id` uses).
- Do not "fix" `uncheckItem` clearing `checkedAt` — that is the scheduler contract, not this bug.
- Do not throw a `GraphQL*Exception` from the service: those four classes live in
  `bp_back/src/main/java/com/bagplease/plugins/` and are imported **only** by `*/gql` files (verified). A service
  import would be a service→plugins layering violation.
- Do not switch the merge lookup to `getByListId` — it filters `deleted`, and preserving a soft delete is AC1
  working, not a bug.
- No mocking framework (MockK/Mockito are absent by policy). No new backend test-helper module.
- Do not weaken any existing assertion to make a test pass.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create (new id) | id absent from storage for that list, and absent globally | Item created; `addedBy` = caller, exactly as today | No error expected |
| Edit by another member | id exists on the target list; `addedBy`=A, `checkedAt` non-null, caller is B | `name`/`checked`/`category`/`store`/`recurring` from input; `addedBy`, `checkedAt`, `deleted`, `deletedAt` from storage | No error expected |
| Cross-list id | id exists, but on list X while input says list Y | Nothing written; item still on X, not relocated | `IllegalArgumentException`, thrown before `emit` |
| Category outside list, on update | id exists on the list; `category` belongs to another list or to none | Nothing written; stored row keeps its old category | `IllegalArgumentException`, thrown before `emit` |
| Category outside list, on create | id absent from storage; unknown `category` | **Accepted** — deliberately unguarded (ruling A); pinned by a test so a later "tightening" is caught | No error expected; filed to the ledger |
| Edit of a checked recurring item | WEEKLY item, `checked`=true, `checkedAt` backdated past cadence, name edited | `checkedAt` survives the edit; `runSchedulerCycle` restores it (`checked`=false, `checkedAt`=null) | No error expected |
| Edit of a soft-deleted item | id exists with `deleted`=true (`getByIdCached` does not filter `deleted`) | Stays soft-deleted and invisible in `getItems` | No error expected |

</intent-contract>

## Code Map

All line numbers **re-measured at `73db447`**; where the story file disagrees, the story file is wrong (see the
corrections table in Design Notes).

**Change (5 files, and only these):**
- `bp_back/src/main/kotlin/com/bagplease/entity/item/ItemService.kt:16-20` — ctor is
  `(private val storage: ItemStorage, private val listService: ListService, private val repository: ItemRepository)`;
  gains a 4th param `private val categoryStorage: CategoryStorage`. `:37-42` — `saveItem`, the whole bug. `:90` —
  the scheduler's `continue` on null `checkedAt` (read-only reference; do not edit).
- `bp_back/.../entity/item/mongo/ItemRepository.kt` — add `findById`. `idCol = "_id"` at `:23`, collection `col`
  at `:24`; `save` at `:41-57` (filter `Filters.eq(idCol, item.id.toString())` — `_id` only, **no `listId`
  clause**, which is why an unguarded create silently relocates the item). Existing reads: `getAll`,
  `findCheckedRecurringItems` (`:69-75`), `findSoftDeletedToHardDelete` (`:77-85`). **No `findById` today.**
- `bp_back/.../plugins/GQL.kt:88` — `val itemService = ItemService(itemStorage, listService, itemRepository)`;
  one positional argument added. `categoryStorage` is already in scope at `:73`. **Deviation from the epic's
  `Files:` line — record it.**
- `bp_back/src/test/kotlin/com/bagplease/ItemLifecycleTest.kt:145` —
  `return ItemService(itemStorage, listService, itemRepository)` inside `buildItemService` (`:125`);
  `categoryStorage` already built at `:131`. New AC1–AC5 tests land here.
- `bp_back/src/test/kotlin/com/bagplease/ItemApiTest.kt:118-149` — `test("updates existing item")`, the **only**
  test in the suite that reuses an item id across two `saveItem` calls (`:133`, `:139`, id declared `:120`).
  Exhaustively verified: every other site creates a fresh id, so the update-branch category check reaches this
  one site and no other.

**New file:**
- `bp_front/e2e/item-attribution.spec.ts` — one FR45/FR58 test. **Deviation from the epic's `Files:` line is
  nil here** (the epic names "one Playwright spec").

**Read-only context (must not change):**
- `entity/item/Item.kt:6-18` — **11 fields, not 10.** Only `category` (`:10`) and `listId` (`:11`) lack
  defaults, and `category` precedes `listId`, so positional construction is not the story file's order.
- `entity/item/gql/GqlItemMapper.kt:26-41` — populates id, name, checked, category, listId, store, recurring,
  addedBy; leaves `deleted`, `deletedAt`, `checkedAt` to defaults. Already throws `IllegalArgumentException` at
  `:36` — the in-request-path precedent for the error idiom.
- `entity/item/ItemStorage.kt:36-39` `getByIdCached(id, listId)` (scoped by both; **no `deleted` filter**) vs
  `:31-34` `getByListId` (**does** filter `deleted`).
- `entity/category/CategoryStorage.kt:31-34` — `suspend fun getByListId(listId: UUID): List<Category>`;
  `Category` (`Category.kt:6`) has `id`, `name`, `listId` and no `deleted`.
- `entity/item/gql/ItemApi.kt:50-56` — `:52` is the only production caller of `saveItem`; `:53`
  `ifLeft = { throw it.toException() }`. **No try/catch anywhere in the file**, so an
  `IllegalArgumentException` propagates raw as graphql-java's `ExceptionWhileDataFetching`.
- `bp_front/src/components/EditItemDialog.tsx:116-124` — the no-op short-circuit; comparison is against the
  open-time `shown` snapshot (`name.trim() === shown.name`), over **name, category, store** only. `:125-144`
  already carries `checked` and `recurring` forward from the live `item` prop, with a comment saying omitting
  either would reset it server-side. That stays true after the merge — do not remove it (and `bp_front/src/` is
  out of scope anyway).
- `bp_front/src/routes/ListShoppingPage.tsx:440-454` — `data-testid={`shopping-item-addedby-${item.name}`}`;
  the interpolated value is the **item** name and it changes when B renames the item. The Stack holds the avatar
  initial **and** the username, so assert with `toContainText`. Zero E2E coverage today.
- `bp_front/src/routes/ListDetailPage.tsx:200` — `edit-item-button` sits inside `item-row-${item.name}` and is
  therefore **not unique**; scope it as `item-editing.spec.ts:26` does. `:117` — `add-item-button` is disabled
  until a category exists.
- `_bmad-output/implementation-artifacts/deferred-work.md` — BUG-E6-1 (`765-775`), BUG-E6-2 (`777-793`),
  BUG-E6-3 (`795-817`, whose `proposed fix` at `814-815` is known-wrong), FR42/FR43 (`107-109`), error-shape
  debt (`497`), Story 7.3 section (`358-400`) and Story 7.2 section (`270-356`) — the last two **must not be
  disturbed**. `BUG-E6-3a`/`3b` do not exist in this file (grep returns nothing; they live only in `epics.md`),
  so AC9 requires **creating** the 3a record.
- `_bmad-output/project-context.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml:38,:114`.

## Tasks & Acceptance

**Execution:**
- [x] `bp_back/` — **baseline first.** `git status --short` empty at `73db447`. Baseline already measured during
  planning by real execution, not cache: `./gradlew :bp_back:cleanTest :bp_back:test` → `BUILD SUCCESSFUL in
  1m 29s`, and the JUnit XML totals `tests=105 failures=0 errors=0 skipped=0`. **`:test` alone is
  `UP-TO-DATE`-cacheable and reports nothing** — that trap fired once in this run before `cleanTest` was added;
  it is mandatory. Re-measure the `saveItem` grep figures and confirm the single-update-site claim before
  touching code.
- [x] `bp_back/.../entity/item/mongo/ItemRepository.kt` — add
  `suspend fun findById(id: UUID): Item? = col.find(Filters.eq(idCol, id.toString())).mapNotNull(MongoItemMapper::mapItemFromMongo).toList().firstOrNull()`.
  **`id.toString()`, not the raw UUID** — every UUID here persists as a String and a raw-UUID filter matches
  nothing silently (`UserRepository.kt:45` uses a raw UUID; do not copy it). `.toList().firstOrNull()` is the
  house pattern and needs **no new import**; `Flow.firstOrNull` is not imported in this file.
- [x] `bp_back/.../entity/item/ItemService.kt` — add the `categoryStorage: CategoryStorage` ctor param and
  rewrite `saveItem` as the merge in Design Notes. `getItems`, `deleteItem`, `checkItem`, `uncheckItem`,
  `getStoreSuggestions`, `runSchedulerCycle` untouched.
- [x] `bp_back/.../plugins/GQL.kt:88` — add `categoryStorage` as the 4th positional argument. Pure wiring.
- [x] `bp_back/.../ItemLifecycleTest.kt` — add `categoryStorage` at `:145`; add a `checked: Boolean = false`
  parameter to the local `saveItem` helper (`:83`, currently hard-codes `checked: false` at `:97`) and a
  `checkItem` mutation helper (none exists — all seven call sites are inline today). Then add tests for AC1–AC5
  per the recipes in Design Notes. `./gradlew :bp_back:build` must compile between steps.
- [x] `bp_back/.../ItemApiTest.kt:118-149` — add a `saveCategory` mutation for its `catId` before the first
  `saveItem`, modelled on `ListServiceTest.kt:176-180`. This is the **only** existing test that needs a change;
  verify rather than assume — anything else going red is a defect in the merge, not a fixture to update.
- [x] `bp_back/` — **observe every new test red.** Revert the merge to `toSave = item`, confirm the AC1/AC2/AC5
  tests fail for the right reason, capture verbatim output; separately revert the AC3 and AC4 guards and confirm
  those tests fail. Restore and confirm `git diff` is byte-exact to the intended change.
- [x] `bp_front/e2e/item-attribution.spec.ts` — new spec per Design Notes. Manually exercise the flow in a real
  browser at `:2080` first and say so in the record. `docker compose up -d --build` (**a rebuild is mandatory —
  the backend changed**), observe the spec red against the unfixed backend on **both** projects, then green.
  **Provenance split — the manual browser pass and the red observation were done by the first implementation session
  on 2026-08-10 and are carried forward, not re-measured; the green run is this session's.** See
  "Red-observation evidence and its provenance" in the Implementation Record.
- [x] `bp_front/` + `bp_back/` — **gates and the diff boundary**, in this order: `npx tsc -b` (before the suite —
  a spec type error fails the *Docker image* build, not just the gate), `npm run lint` (exit 0, zero output),
  `npx playwright test --list` totals **and** the per-project split, `npm run test:e2e` green on both projects at
  `retries: 0`, `./gradlew :bp_back:cleanTest :bp_back:test` green, then the three `git diff --stat` boundary
  checks and the two `grep` invariants from Verification. Record each result, not just "gates passed".
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — new `## Deferred from: Story 7.4 — an item edit
  merges the stored item (2026-08-10)` section placed immediately after the Story 7.3 section and **before**
  `## Deferred from: code review of 7-3-…` (~`L402`). Close BUG-E6-1 and BUG-E6-2 with the house
  strikethrough + `Retained for history:` convention; mark BUG-E6-3 **partial** ((b) fixed by AC4, (a)
  severity-downgraded) and **correct its known-wrong proposed fix** at `814-815`; create the BUG-E6-3a record;
  note FR42/FR43's prerequisite discharged. File the five new entries listed in Design Notes.
- [x] `_bmad-output/project-context.md` — the merge semantics, the two rejections and their scoping, the new
  E2E prefix, and the `cleanTest` trap. Rules only; new debt goes to the ledger (NFR-E7-1).
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-4-item-edit-merges-stored-item: done`,
  refresh `last_updated`, and move Epic 6 action item **C1** `open → done` recording the wording correction.

**Acceptance Criteria:**
- Given an item with `addedBy`=A, non-null `checkedAt` and soft-delete state, when member B saves it with a
  changed name, then `addedBy`, `checkedAt`, `deleted` and `deletedAt` are unchanged and only the five
  `ItemInput` fields reflect the input.
- Given the discriminator is storage existence, when `saveItem` receives an id absent from the target list, then
  the item is created with `addedBy` from the caller as today; and when the id is present, the stored row is
  merged onto — with no frontend change and no rejection of unknown ids.
- Given a recurring item checked off and then renamed, when `runSchedulerCycle` runs after the cadence elapses,
  then it restores the item — proven by a test that **drives the scheduler**, not by asserting `checkedAt` alone.
- Given `checkItem`, `uncheckItem` and `runSchedulerCycle` never route through `saveItem` (they call
  `storage.save` directly at `:59`, `:69`, `:92`), when the suite runs, then their existing tests pass with
  **zero edits** — a red one means the merge changed behaviour it should not have.
- Given NFR-E7-4, when the story is complete, then each AC1–AC5 test has been observed failing for the right
  reason with verbatim output in the record, and the full backend suite passes at the recorded baseline count
  plus the new tests.
- Given FR45, when member A adds an item and member B renames it, then A's parked `/list/:id` still attributes
  it to A — asserted after the live subscription update **and** after a `page.reload()`, green on `chromium` and
  `mobile` against the production image, and observed red against the unfixed backend first.
- Given AC10's diff boundary, when the tree is inspected, then `git diff --stat bp_back/` names only
  `ItemService.kt`, `ItemRepository.kt`, `GQL.kt`, `ItemLifecycleTest.kt`, `ItemApiTest.kt`;
  `git diff --stat bp_front/src/` is **empty**; `GqlItemInput.kt` is unchanged; and the two deviations
  (`GQL.kt`, `ItemRepository.kt`) are recorded in the spec record **and the commit body**.
- Given AC9, when `deferred-work.md` is inspected, then BUG-E6-3a exists as a **severity downgrade** naming
  soft-delete tombstones as the real fix and stating it is outside the scoped unfreeze, BUG-E6-1/E6-2 are
  resolved, and the Story 7.2 and 7.3 sections are byte-unchanged.

## Spec Change Log

### 2026-08-10 — implementation pass

No change was made to `<intent-contract>`. The Code Map, Design Notes and Verification sections held on contact: every
line number, count and file name they prescribed was found correct when the work was executed, and the "Corrections to
the story file" table was followed in every one of its twelve rows (the story file's figures were not used anywhere).

**Recorded deviations — three, all known at planning time and none absorbed silently:**

1. **`bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt` falls outside the epic's `Files:` line.** One positional
   argument added at `:88` (`ItemService(itemStorage, listService, itemRepository, categoryStorage)`). Structurally
   forced: AC4 needs category access, `ItemService`'s constructor had no category dependency, and
   `CategoryStorage.getByListId` is the only accessor. Pure wiring, no behaviour of its own, and it is a compile-time
   consequence of the constructor change rather than a choice — omitting it does not compile.
2. **`bp_back/src/main/kotlin/com/bagplease/entity/item/mongo/ItemRepository.kt` falls outside the epic's `Files:`
   line.** One method added, `findById(id: UUID): Item?`. Structurally forced: AC3 needs a **global** point read, and
   `ItemStorage.getByIdCached` is list-scoped, so an id living on another list misses it, takes the create branch, and
   `ItemRepository.save`'s `_id`-only filter then relocates the row — which is precisely what AC3 forbids and what
   nothing in the existing API can observe. `repository.getAll()` would have been O(n) per write.
   Both deviations are of the same class Story 7.2 found in its own `Files:` line, and both are recorded here and in
   `sprint-status.yaml`. The commit body must carry them too (AC10) — **this session did not commit; that obligation
   passes to whoever does.**
3. **Process deviation against the story file's ruling D — flagged for `md`.** Ruling D
   (`7-4-item-edit-merges-stored-item.md`, Decisions table) states this story runs the story-file flow via `dev-story`
   and that **"no `spec-7-4-*.md` is expected."** The run was invoked as `bmad-dev-auto`, so the spec flow applied and
   this file exists. Nothing was lost by it: ruling D itself records that the bookkeeping obligations are identical
   either way, and all of them (`deferred-work.md`, `project-context.md`, `sprint-status.yaml`) were discharged. Raised
   here because a ruling was contradicted by the invocation, not by a decision anyone took — and because the same
   mismatch will recur on 7.5 unless the orchestrator or the ruling is corrected. Rulings **A, B and C** were honoured
   as written.

**One thing the spec did not anticipate, found during execution and worth carrying into the next backend story:**
`docker compose up -d --build` **rebuilt both images but did not recreate the containers** — `docker compose ps`
reported `bag-please-bp_back-1  Up 5 hours` against a freshly built image. The E2E suite would have run against the
previous backend. `docker compose up -d --build --force-recreate` was required. The spec's prescribed readiness poll
(`/api/graphiql` → 401) does **not** catch this, because a stale container answers 401 exactly like a fresh one. This
is a new instance of the long-standing "Playwright `webServer` gaps" ledger entry, recorded here rather than filed
separately.

## Review Triage Log

### 2026-08-10 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 1, medium 3, low 2)
- defer: 6: (high 0, medium 5, low 1)
- reject: 17
- addressed_findings:
  - `[high]` `[patch]` The ruling-A ledger entry claimed the unguarded create branch has **no UI producer** ("a direct
    GraphQL caller can"). False, and verified false against the tree: `ListDetailPage.tsx:288-296` hard-deletes a
    category's items *before* the category, so a co-member removing a category while another member's edit dialog is
    open sends that member's save down the **create** branch, resurrecting the item with a dangling category —
    BUG-E6-3b's state reached by composing the two holes this story knowingly left open. Entry corrected in place and
    the hole re-priced; ruling A itself is a human decision inside `<intent-contract>` and was not touched.
  - `[medium]` `[patch]` The same entry described the resulting item as rendering "under no group on either screen".
    `/list/:id` in fact renders it under the synthetic `Uncategorized` bucket (`ListShoppingPage.tsx:40`, `:194-221`);
    only `/lists/:id` hides it. Corrected: the state is **visible on the shopping view, unreachable for edit or
    removal on the management view**.
  - `[medium]` `[patch]` The new `checked`/`checkedAt` desync entry had its two halves inverted. `checked = false`
    with a stale `checkedAt` is inert (`false` *is* the restored state; the next `checkItem` overwrites the clock),
    while the mirror — `checked = true` with a **null** `checkedAt` — is the one that reproduces BUG-E6-2's end state,
    because `findCheckedRecurringItems` returns it and `runSchedulerCycle` drops it at its null-`checkedAt` `continue`
    (`ItemService.kt:120`). Corrected, and a third remedy added; the originally-filed remedy does not close the real
    half. Not a regression — the pre-merge reconstruct nulled `checkedAt` on every save.
  - `[medium]` `[patch]` Both AC4 rejection tests resent the **same name** as the stored row (`"Butter"` → `"Butter"`,
    `"Cheese"` → `"Cheese"`), so their re-read could not distinguish "nothing was written" from "the name was written
    and only the category rejected" — a direct miss against this spec's own Kotest recipe ("plus a re-read proving the
    stored row is unchanged, or the test proves only that an error was returned"). Names now differ
    (`Butter`→`Margarine`, `Cheese`→`Gouda`) and both tests assert the stored name survived. **Re-observed red** with
    the AC4 guard removed: exactly 2 failures, payloads carrying `"name":"Margarine"` and `"name":"Gouda"` — the
    partial write the old assertions were blind to, now visible in the failure output. Guard restored, `ItemService.kt`
    md5-identical (`4770c33a2787d050bce0846e3fade26d`), full suite re-run `tests=113 failures=0 errors=0 skipped=0`.
  - `[low]` `[patch]` `ItemApiTest.kt:134-138`'s inserted `saveCategory` POST discarded its response unasserted; a
    failed seed would have surfaced twenty lines later as a category rejection on `saveItem`, reading like a defect in
    the merge. Now `.bodyAsText() shouldNotContain "errors"`.
  - `[low]` `[patch]` `project-context.md` `rule_count` was left at `77` while the same pass added eight rules → `85`.

Deferred findings are filed under `## Deferred from: code review of 7-4-item-edit-merges-stored-item (2026-08-10)` in
[deferred-work.md](deferred-work.md): the untested throw-before-`emit` invariant; AC3's TOCTOU pre-read where an
atomic `_id`+`listId` upsert filter was available; the cache-vs-Mongo split between branch selection and rejection;
the new terminal state where an item already carrying a dangling category can never be renamed (with the raw UUID
message reaching `edit-item-error`); the four now-false `EditItemDialog.tsx` comments that `bp_front/src/` being out
of scope left in place; and `findById`'s `mapNotNull` hiding unmappable documents from the cross-list guard.

Rejected as noise (17), the recurring themes: micro-performance on the new reads (`limit(1)`, the create-branch
round-trip, the category linear scan); pre-existing suite hygiene inherited by the new tests (the unclosed
`connectToDb` client, `runSchedulerCycle`'s global scope — this is its sixth call site); speculative concurrency
windows already subsumed by the TOCTOU defer; scope complaints against decisions the spec records as deliberate (one
E2E test, `bp_front/src/` frozen, ruling A's asymmetry, C1 closed-with-correction); and bookkeeping the workflow owns
(`status: in-review` trailing `sprint-status.yaml`, `last_updated` verbosity).

## Design Notes

### Prescribed `saveItem`

```kotlin
suspend fun saveItem(item: Item, caller: CallerUsername): Either<ListAuthError, Item> = either {
    listService.verifyMembership(caller, item.listId).bind()

    val stored = storage.getByIdCached(item.id, item.listId)
    val toSave = if (stored != null) {
        // AC4 / BUG-E6-3b — UPDATE branch only (md, 2026-08-10). A stale edit dialog can hold a
        // category a co-member has since deleted; writing it strands the item under no group on
        // either screen. Scoped to update because that is the actual shape of the bug, and because
        // guarding creates too would fail 29 existing test sites. The create hole is filed.
        if (categoryStorage.getByListId(item.listId).none { it.id == item.category }) {
            throw IllegalArgumentException("Category ${item.category} does not belong to list ${item.listId}")
        }
        // AC1 / AR-E7-1 — merge, do not reconstruct. addedBy, checkedAt, deleted and deletedAt are
        // server-owned and absent from ItemInput, so the incoming values are meaningless here.
        stored.copy(
            name = item.name,
            checked = item.checked,
            category = item.category,
            store = item.store,
            recurring = item.recurring,
        )
    } else {
        // AC3 — getByIdCached is list-scoped, so an id on another list also misses. Without this,
        // the create branch upserts by _id alone and silently relocates the item.
        if (repository.findById(item.id) != null) {
            throw IllegalArgumentException("Item ${item.id} belongs to a different list")
        }
        item // AC2 — create: addedBy from the caller, exactly as today
    }

    val savedItem = storage.save(toSave)
    itemUpdateChannel.emit(savedItem)
    savedItem
}
```

`stored.copy` keeps `stored.id`/`stored.listId`, which equal the input's by construction —
`getByIdCached(item.id, item.listId)` matched on both. Arrow's `either { }` captures `Raise` shifts, not thrown
exceptions, so the throw escapes the block and `ItemApi`'s `fold` never runs; the AC3/AC4 tests asserting
`errors` **and** an unchanged stored row are what prove this rather than assumption.

### Corrections to the story file — measured at `73db447`

The story file is loaded as context alongside this spec and **12 of its figures are wrong.** Prefer this table.

| Story file says | Measured truth |
|---|---|
| `Item` has 10 fields | **11**; only `category` and `listId` lack defaults, and `category` precedes `listId` |
| 32 `saveItem` **call sites** | 32 *grep hits*, but **30 invocations** — `ItemLifecycleTest:83` is the helper declaration and `:97` its mutation string |
| 31 of 32 invent a category | **29 of 30** invocations; only `ListServiceTest:183` seeds its category (at `:178`) |
| `findById` via `.mapNotNull(…).firstOrNull()` | `Flow.firstOrNull` is **not imported**; house pattern is `.toList().firstOrNull()` — no new import |
| helpers at `registerAndLogin:65`, `createList:75`, `getItems:106`, `buildItemService:130` | **`:64`, `:74`, `:102`, `:125`** (`loginToken:56`, `saveItem:83`, `connectToDb:113` are right) |
| `ListService.kt:53` = categoryStorage, `:55` = categoryRepository | **swapped**: `:53` is `categoryRepository`, `:55` is `categoryStorage` |
| `verifyMembership` at `:132-141` | `:132-136`; `:138-141` is `isMember` |
| `GraphQL*Exception` are `plugins/` Kotlin files | **Java** files under `bp_back/src/main/java/com/bagplease/plugins/`. The claim they hold (no service imports them) is CONFIRMED |
| `ItemStorage.getByListId` at `:38` | `:31-34` |
| `EditItemDialog` short-circuit at `:120-124`, `name.trim() !== shown.name` | `:116-124`; comparison is `===` over **name, category, store** against the `shown` snapshot |
| `uniqueUsername` registry comment at `ui.ts:18` | `:16-18` |
| `ItemLifecycleTest:187-212` | test spans `:187-210` |

Also newly established, and **not** in the story file:
- **`edit-item-button` is not unique** — it is inside `item-row-${item.name}` (`ListDetailPage.tsx:200`). Scope
  it or the E2E spec is ambiguous the moment a list holds two items.
- **`add-item-button` is disabled until a category exists** (`ListDetailPage.tsx:117`) — `addCategory` before
  `addItem` is mandatory, not stylistic.
- **`ItemLifecycleTest`'s `Updates` import (`:22`) is currently dead.** The AC5 backdating step is what makes it
  live; that is fine, but do not claim it was "already used for exactly this".
- **`TestContainers.kt:44` has a fourth helper, `setUpRegistration`**, which writes `app_config` directly and
  consumes no rate-limit slots. Not needed here (`registerAndLogin` goes through the admin `createUser`
  mutation), but the story file's helper inventory omits it.
- **`saveItem`'s helper hard-codes `checked: false`.** AC5's edit must send `checked: true` or the merge writes
  `checked=false` while preserving `checkedAt`, and `findCheckedRecurringItems` (which filters
  `checked == true`) never sees the item — the test would fail for a reason that is not the bug. Hence the new
  `checked` parameter rather than a new inline mutation.

### The new ledger entries (AC9 + ruling fallout)

1. **The create branch still accepts a category belonging to no list** (ruling A). No UI path produces it —
   both dialogs pick from the list's `categories`, and `SaveCategoryMutation`'s only consumer is
   `AddCategoryDialog.tsx:32` — but a direct GraphQL caller can, reaching BUG-E6-3b's unrecoverable state
   through another door. Name the cost of closing it (**29 sites across six files**) and the cheap partial
   (reject a category that exists on *another* list even on create, which no test does).
2. **`Item.category` has no schema-level referential integrity** — the guard is service-layer and update-only.
3. **The declined `BAD_USER_INPUT` shape** (ruling B): AC3/AC4 surface as `ExceptionWhileDataFetching` with no
   `extensions.code`, so the frontend cannot branch on them. Cross-reference `deferred-work.md:497`.
4. **BUG-E6-3a severity downgrade** — `ItemStorage.delete` is a hard delete, so a save against a deleted id
   takes the create branch and the row returns as a genuinely new item (correct `addedBy`, null `checkedAt`,
   UI-removable) rather than silent corruption. Real fix = soft-delete tombstones the scheduler owns, outside
   the scoped unfreeze.
5. **New, found during this planning pass:** `saveItem` can now produce `checked=false` with a non-null
   `checkedAt`, because `checked` comes from input while `checkedAt` is server-owned. The scheduler then ignores
   the item forever (`findCheckedRecurringItems` filters `checked == true`). **No UI path does this** —
   `EditItemDialog.tsx:125-144` carries `checked` forward from the live prop with a comment saying why — so it
   is filed, not fixed: closing it means deciding whether `saveItem` may un-check at all, which is
   `uncheckItem`'s job.

### Kotest recipes

`FunSpec` only; `val container = mongoContainer()` in the spec body; per-test
`testApplication { setUpMongo(container); setUpJwt(); application { module() } }`; data created through GraphQL
mutations; randomised usernames and UUIDs (the container is shared per spec and specs run in parallel); assert
by UUID, never by name; `body shouldNotContain "errors"` on success and `shouldContain "errors"` on AC3/AC4 —
**plus** a re-read proving the stored row is unchanged, or the test proves only that an error was returned.
Canonical shape to copy is `ItemLifecycleTest.kt:150-166`.

**AC5 must drive the scheduler.** Create a WEEKLY item over HTTP → `checkItem` → **edit its name with
`checked = true`** → backdate `checkedAt` 8 days in Mongo (`Updates`, `java.util.Date` already imported) →
`buildItemService(db).runSchedulerCycle()` → re-read and assert `checked == false`, `checkedAt == null`. Build
the scheduler service **after** the HTTP writes: `testApplication` and `buildItemService(db)` hold separate
`ItemStorage` instances that see each other's Mongo writes only via their own first lazy `sync()`.

**AC4 needs three cases:** update with a category on another list → error; update with a category on no list →
error; **create** with an unknown category → still accepted. The third pins ruling A's scoping with a test, so a
later "tightening" trips a tripwire instead of 29 unrelated tests.

### The E2E spec

One test, no `test.describe`, FR tag as a title prefix followed by an em dash, no `{tag: …}` (this test does not
write the registration flag, and `@registration-toggle` would reroute it into the chained pair). New prefix
**`attrib`**, added to the registry comment at `ui.ts:16-18`. Relative imports only (`./support/api` before
`./support/ui`, specifiers sorted case-insensitively); no semicolons, single quotes, 2-space indent, no space
inside import braces. `tsconfig.e2e.json` sets `noUnusedLocals`/`noUnusedParameters`, so an unused import or an
unreferenced `testInfo` is a **build error** — and it fails the *Docker image* build, so run `npx tsc -b` before
the suite. **Await every web-first matcher by hand**: type-aware linting is off, so a forgotten `await` passes
both gates and asserts nothing.

**Member A — the adder, whose `/list/:id` is asserted — goes on the `page` fixture; member B, the editor, goes
in the hand-built context.** `browser.newContext()` does not inherit the project's `use` block, so a hand-built
context silently runs at desktop viewport on the `mobile` project and would void the mandatory mobile gate.
Copy the structure and the explanatory comment from `item-editing.spec.ts:320-383`, including its
`// SETUP ONLY` membership block (`loginApi` ×2 → `shareList` → `acceptInvite`, `:351-354`) and its
`try { … } finally { await ctx.close() }`.

Flow: A registers → `openListsViaMenu` → `createListAndOpen` → `addCategory` → `addItem`; B registers in `ctx`;
seed membership; A goes to `/list/${listId}` and asserts `shopping-item-addedby-${before}` **contains** A
(`toContainText` — the Stack holds the avatar initial *and* the username, so `toHaveText` fails for the wrong
reason); B opens `/lists/${listId}` and renames via the `item-row`-scoped `edit-item-button` → `edit-item-name`
→ `edit-item-submit`; A's parked page updates live (`ItemUpdatesSubscription` selects `addedBy`,
`listsQueries.ts:286`) and `shopping-item-addedby-${after}` **still** contains A; then `page.reload()` and
assert again, so the test proves server truth rather than cache state. **The new name must genuinely differ** —
`EditItemDialog` sends no mutation when nothing changed, and the test would pass while asserting nothing.

### Deviations from the story file's process

The story file's **ruling D** expects the story-file flow with "no `spec-7-4-*.md`". This run was invoked as
`bmad-dev-auto 7.4`, so the spec flow applies and this file exists; ruling D itself records that the bookkeeping
obligations are identical either way. Flag it for `md` at close. Rulings **A, B and C** are honoured as written.

## Verification

**Commands:**
- `./gradlew :bp_back:cleanTest :bp_back:test` — expected: `BUILD SUCCESSFUL`, 0 failures, baseline count plus
  the new tests. **`cleanTest` is not optional**: `:bp_back:test` alone returned `UP-TO-DATE` in this planning
  pass and reported nothing.
- `./gradlew :bp_back:build` — expected: exit 0 after the ctor change (catches a missed positional call site).
- `cd bp_front && npx tsc -b` — expected: exit 0. **Before** the suite.
- `cd bp_front && npm run lint` — expected: exit 0, zero output.
- `cd bp_front && npx playwright test --list | tail -2` — expected: `Total: 106 tests in 10 files` (104 in 9 at
  baseline, +1 test × 2 viewport projects).
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` — expected
  `52 chromium / 52 mobile / 1 registration-toggle-chromium / 1 registration-toggle-mobile`. Do **not** use
  `--list --project=<name>`; `--project` pulls in `dependencies` and misreports.
- `docker compose up -d --build`, then poll
  `curl -s -o /dev/null -w '%{http_code}' http://localhost:2080/api/graphiql` until **401** (Ktor warm and
  enforcing auth = ready), then `npm run test:e2e` — expected: all green at `retries: 0` on both projects. One
  Playwright invocation at a time against a given backend.
- `grep -rn "toPass" bp_front/e2e/` — expected: exactly one hit, `navigation.spec.ts:100`.
- `grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" bp_front/e2e/` — expected: no hits.
- `git diff --stat bp_back/` — expected: exactly `ItemService.kt`, `ItemRepository.kt`, `GQL.kt`,
  `ItemLifecycleTest.kt`, `ItemApiTest.kt`. `git diff --stat bp_front/src/` — expected: empty.
  `git diff bp_back/.../gql/GqlItemInput.kt` — expected: empty.
- `cd bp_back/src/test/kotlin/com/bagplease && grep -c "saveItem(" *.kt | grep -v ':0'` — expected: 7 files
  totalling 32 hits at baseline (30 invocations; see the corrections table).

**Manual checks (if no CLI):**
- Exercise the two-member edit in a real browser at `:2080` before writing the spec: A adds an item, B renames
  it, A's `/list/:id` still shows A's avatar and username — and the row stays checked with its clock if it was
  checked. Record that this was done.

## Implementation Record

**Two sessions produced this story.** A first implementation session wrote all of the code and the first pass of the
ledger edits; this session verified that work, re-ran every gate from scratch, re-observed the backend red itself, and
wrote the remaining artifacts (the `## Deferred from: Story 7.4` ledger section, `project-context.md`,
`sprint-status.yaml`, and this record). **Nothing below is quoted from the planning pass.** Where evidence comes from
the first session rather than this one, it is labelled as such and never presented as measured here. Nothing was
committed.

### Files changed

Backend — exactly the five the Code Map names, and nothing else:

| File | Change |
|---|---|
| `bp_back/src/main/kotlin/com/bagplease/entity/item/ItemService.kt` | `+32 / -1` — `categoryStorage: CategoryStorage` 4th ctor param; `saveItem` rewritten as the merge, exactly as prescribed in Design Notes |
| `bp_back/src/main/kotlin/com/bagplease/entity/item/mongo/ItemRepository.kt` | `+10` — `findById(id: UUID): Item?` with KDoc; `Filters.eq(idCol, id.toString())` and `.toList().firstOrNull()`, no new import |
| `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt` | `1 line` — 4th positional arg at `:88` |
| `bp_back/src/test/kotlin/com/bagplease/ItemApiTest.kt` | `+10` — a `saveCategory` mutation before the first `saveItem` in `test("updates existing item")`, the suite's only update-branch site |
| `bp_back/src/test/kotlin/com/bagplease/ItemLifecycleTest.kt` | `+305` — `saveCategory`/`checkItem`/`shareList`/`acceptInvite` helpers, a `checked` parameter on the local `saveItem` helper, `categoryStorage` in `buildItemService`, and 8 new Story 7.4 tests |

Frontend — one new file and one comment:

| File | Change |
|---|---|
| `bp_front/e2e/item-attribution.spec.ts` | **new**, 97 lines — the FR45/FR58 test |
| `bp_front/e2e/support/ui.ts` | 2 lines — `attrib` added to the prefix registry comment at `:14-18` |

Artifacts: `_bmad-output/implementation-artifacts/deferred-work.md`,
`_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/project-context.md`, and this file.

**`bp_front/src/` is untouched. `GqlItemInput.kt` is untouched. No GraphQL schema change. `npm run generate` was not
run.**

### Gate results — verbatim

Every command below was run in this session, in this order.

- `./gradlew :bp_back:build` → `BUILD SUCCESSFUL in 1m 55s`, `14 actionable tasks: 14 executed`, exit **0**.
- `./gradlew :bp_back:cleanTest :bp_back:test` → `BUILD SUCCESSFUL in 1m 31s`, exit **0**. JUnit XML totals, summed
  over all 15 `TEST-*.xml` files in `bp_back/build/test-results/test/`:
  **`tests=113 failures=0 errors=0 skipped=0`** — the recorded baseline of 105 plus the 8 new tests. Per suite:
  `ItemLifecycleTest 25` (17 at baseline, `+8`), `ListSharingTest 16`, `LoginTokenTest 14`, `ListServiceTest 10`,
  `AdminUserManagementTest 7`, `ApplicationConfigTest 7`, `UserRegistrationTest 7`, `ItemApiTest 5`, `MigrationTest 5`,
  `ListAuthorizationTest 4`, `SubscriptionScopingTest 4`, `AuthApiTest 3`, `WebSocketAuthTest 3`,
  `ItemCategoryStorageTest 2`, `ApplicationTest 1`. (This is the *second* green full run — the first, before the red
  experiments, gave the identical totals; the file was restored byte-identically between them.)
- `cd bp_front && npx tsc -b` → no output, `TSC_EXIT=0`. Run **before** the Playwright suite, as required.
- `cd bp_front && npm run lint` → `> eslint .` and nothing else, `LINT_EXIT=0`.
- `cd bp_front && npx playwright test --list | tail -2` →
  `[registration-toggle-mobile] › admin.spec.ts:165:1 › FR20/FR21 — toggling registration off hides the Register link on /auth; back on restores it`
  / **`Total: 106 tests in 10 files`**.
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` →
  **`52 chromium`**, **`52 mobile`**, **`1 registration-toggle-chromium`**, **`1 registration-toggle-mobile`**.
  `--project=<name>` was not used.
- `docker compose up -d --build` → exit 0, both images `Built`… **but `docker compose ps` then reported
  `bag-please-bp_back-1  Up 5 hours` and `bag-please-bp_front-1  Up 5 hours`: the containers were NOT recreated.**
  Re-run as `docker compose up -d --build --force-recreate` → `Container bag-please-bp_back-1 Recreated` /
  `Started`, likewise `bp_front` and `mongo`. Readiness poll
  `curl -s -o /dev/null -w '%{http_code}' http://localhost:2080/api/graphiql` → **`401`**.
- **Deployed-image proof, added because the readiness poll cannot distinguish a stale container from a fresh one.**
  Straight against `:2080` over the API: create an item → `{"data":{"saveItem":{…,"addedBy":"verify_2546229611"}}}`;
  update the same id with a category belonging to no list →
  `{"errors":[{"message":"Exception while fetching data (/saveItem) : Category 008354ef-f7b4-4270-bf3a-5f985e1edf68 does not belong to list 1b87e0c3-3918-44ac-be2a-83dc5a54bd08","locations":[{"line":1,"column":12}],"path":["saveItem"]}]}`;
  re-read → the stored row still carries its original category and `addedBy`. The image under test contains the merge.
- `cd bp_front && npm run test:e2e` → **`106 passed (54.5s)`**, exit **0**, at `retries: 0`. Zero failed, zero flaky,
  zero "did not run". The new spec ran in **both** viewport projects:
  `[6/106] [mobile] › e2e/item-attribution.spec.ts:23:1 › FR45/FR58 — a co-member editing an item does not steal the original author's attribution`
  and `[64/106] [chromium] › e2e/item-attribution.spec.ts:23:1 › …`. One Playwright invocation, nothing else running
  against `:2080`.
- `grep -rn "toPass" bp_front/e2e/` → exactly one hit, `bp_front/e2e/navigation.spec.ts:100:  }).toPass({timeout: 2000})`.
- `grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" bp_front/e2e/` → **no hits**.
- `git diff --stat bp_back/` → exactly five files:
  `ItemService.kt | 32 ++-`, `ItemRepository.kt | 10 +`, `GQL.kt | 2 +-`, `ItemApiTest.kt | 10 +`,
  `ItemLifecycleTest.kt | 305 ++++-` — `5 files changed, 354 insertions(+), 5 deletions(-)`.
- `git diff --stat bp_front/src/` → **empty**.
- `git diff bp_back/src/main/kotlin/com/bagplease/entity/item/gql/GqlItemInput.kt` → **empty**.
- `grep -c "saveItem(" *.kt` in `bp_back/src/test/kotlin/com/bagplease/` → at `73db447`: **32 hits across 7 files**
  (`ItemLifecycleTest` 17, `ItemApiTest` 5, `ItemCategoryStorageTest` 3, `ListAuthorizationTest` 2, `ListSharingTest`
  2, `SubscriptionScopingTest` 2, `ListServiceTest` 1) — matching the spec's Verification expectation exactly. In the
  working tree it is now **47 across the same 7 files**, the delta being `ItemLifecycleTest` 17 → 32.

### Red-observation evidence and its provenance

**Measured in this session — the backend.** Five separate breakages, each applied to `ItemService.kt` alone, each
followed by `./gradlew :bp_back:cleanTest :bp_back:test --tests "com.bagplease.ItemLifecycleTest"`. Failure text is
quoted from `bp_back/build/test-results/test/TEST-com.bagplease.ItemLifecycleTest.xml`.

**(A) merge reverted to `val toSave = item`** (the whole `if/else` deleted) → `BUILD FAILED in 17s`, exit 1,
**6 failures of 25**:

- `7.4 AC1 an edit by another member keeps addedBy and the check-off clock` —
  `"{"data":{"saveItem":{…,"addedBy":"mem74_aa0224f6",…,"checkedAt":null}}}" should include substring ""addedBy":"own74_d5b345a7""`.
  The editor's name where the author's belongs, and the clock nulled: BUG-E6-1 and BUG-E6-2 in one payload.
- `7.4 AC1 an edit preserves a soft delete and the item stays invisible` —
  `"{…"deleted":false,"deletedAt":null…}" should include substring ""deleted":true"` (BUG-E6-3's reset half).
- `7.4 AC3 an id that already lives on another list is rejected, not relocated` —
  `expected:<errors> but was:<{"data":{"saveItem":{…"name":"MovedToY"…}}}>`.
- `7.4 AC4 an update carrying a category from another list is rejected and writes nothing` — `expected:<errors> but was:<{"data":{"saveItem":{…"name":"Butter"…}}}>`.
- `7.4 AC4 an update carrying a category that belongs to no list is rejected` — `expected:<errors> but was:<{"data":{"saveItem":{…"name":"Cheese"…}}}>`.
- `7.4 AC5 an edit keeps the check-off clock, so the scheduler still restores the item` —
  **`expected:<false> but was:<true>`**, i.e. `runSchedulerCycle` skipped the item entirely, which is the *behavioural*
  consequence BUG-E6-2 predicted rather than a `checkedAt` field assertion.

**(B) AC3 guard alone removed** (merge and AC4 guard intact) → `BUILD FAILED in 17s`, **exactly 1 failure**, the AC3
test: `expected:<errors> but was:<{"data":{"saveItem":{"id":"7d812e74-…","name":"MovedToY",…"listId":"e3b2890e-…"}}}>`.
Isolation confirmed: nothing else depends on that guard.

**(C) AC4 guard alone removed** → `BUILD FAILED in 17s`, **exactly 2 failures**, both AC4 update tests, both
`expected:<errors> but was:<{"data":{"saveItem":{…}}}>` carrying the foreign / ghost category in the payload. The
create-branch tripwire stayed green, which is what proves the guard is update-scoped rather than merely present.

**(D) Epic 6 action item C1 implemented as literally worded** — the create branch replaced with
`throw IllegalArgumentException("Item ${item.id} does not exist")` → `BUILD FAILED in 16s`, **16 failures of 25**,
including `7.4 AC2 an unknown id creates with the caller as addedBy, a known id merges in place`:
`"{"errors":[{"message":"Exception while fetching data (/saveItem) : Item bf6ebf33-d5eb-48b3-8914-a89607f71516 does not exist",…}]}" should not include substring "errors"`.
This is the measurement that closes C1 as wrongly worded, and it is also the AC2 test's red observation — AC2 cannot go
red under (A), because with a single actor the reconstruct form still yields the right `addedBy`.

**(E) the category guard hoisted out of the update branch so it covers creates too** → `BUILD FAILED in 16s`,
**10 failures of 25**, including the ruling-A tripwire itself,
`7.4 AC4 a CREATE with an unknown category is still accepted (ruling A tripwire)`:
`"{"errors":[{"message":"Exception while fetching data (/saveItem) : Category b589b08f-… does not belong to list f447a199-…",…}]}" should not include substring "errors"`.
So all eight new tests have now been observed red for the right reason: six under (A), AC2 under (D), the tripwire
under (E) — with (B) and (C) isolating the two guards individually.

**Restoration verified:** `ItemService.kt` was restored from a byte copy taken before the experiments
(`md5 4770c33a2787d050bce0846e3fade26d`, unchanged), `git diff --stat bp_back/` returned to the identical five-file
`354 insertions(+), 5 deletions(-)`, and the full suite was re-run green at `tests=113 failures=0`.

**Carried forward from the first implementation session (2026-08-10) — NOT re-observed in this pass.** Re-observing the
E2E red costs two further full production-image rebuilds, so its evidence is inherited rather than reproduced, and it
is labelled as inherited everywhere it appears (here and in `deferred-work.md`'s BUG-E6-1 entry):

- The FR45/FR58 spec was reported red on **both** `chromium` and `mobile` against the unfixed production image, with
  `Received string: "Aattrib_e2e_editor_mobile_1786370690586"` — the editor's username rendered where the author's
  belongs, and the leading `A` is the avatar initial, which is exactly why the assertion uses `toContainText`.
- The manual browser pass at `:2080` (A adds an item, B renames it, A's `/list/:id` still attributes it to A) was
  performed by that session.

**What this session can state about the E2E spec on its own evidence:** it is green on both projects against a
production image that provably contains the merge (see the deployed-image proof above), it compiles under
`tsconfig.e2e.json`, it passes lint, it contains no `@ts-ignore`/`eslint-disable`, every web-first matcher in it is
`await`ed (checked by reading all 97 lines — type-aware linting would not catch a missing one), and the rename it
performs uses genuinely different before/after names so `EditItemDialog`'s no-op short-circuit cannot make it vacuous.
**A reviewer who wants the red observation first-hand should re-take it; this record does not claim it.**

### Artifacts written

- **`deferred-work.md`** — new section `## Deferred from: Story 7.4 — an item edit merges the stored item
  (2026-08-10)`, placed immediately after the Story 7.3 section and before
  `## Deferred from: code review of 7-3-…`, with five entries: the open create-branch category hole (with the measured
  cost of closing it and the cheap partial named); `Item.category`'s absent referential integrity; the declined
  `BAD_USER_INPUT` shape, cross-referenced to the existing "AC7 error shape" entry under the 4-1 code review **by
  section name rather than by line number**, since the insertion shifted every line below it; the **BUG-E6-3a**
  severity downgrade, *created* here because that ID had never existed in this ledger; and the new
  `checked=false`-with-non-null-`checkedAt` state the merge itself makes possible.
  **AC9 verified by hash, not by eye:** the Story 7.2 section (`md5 ad07ce2e6ed087a9e4ba6fc2e7968e76`) and the Story
  7.3 section (`md5 d83c9c43a4f9b4c7f080cba97a25c596`) are **byte-identical** to `73db447`.
  Two dangling cross-references left by the first session were repaired in the same pass: BUG-E6-3 pointed at "the 7.4
  section **below**" twice, but the new section sits ~500 lines *above* it; both now name the section by heading.
- **`project-context.md`** — four backend rules (merge-not-reconstruct with the allowlist direction; existence-in-
  storage as the discriminator; the two rejections and their deliberate asymmetry, both before `emit`; the
  `IllegalArgumentException` idiom, the layering reason, and the `either { }` caveat that makes an `errors`-only
  assertion insufficient) and four testing rules (mandatory `cleanTest`; read totals from the JUnit XML; the 105 → 113
  suite size, marked as dated; `--tests` filters a whole Kotest class). The prefix registry went seven → **eight**
  (`attrib`) and the four-project split line now carries the measured `52 / 52 / 1 / 1 = 106`. Footer chained per
  convention. **No debt was written into this file** (NFR-E7-1).
- **`sprint-status.yaml`** — `7-4-item-edit-merges-stored-item: done`; `last_updated` refreshed in the file's existing
  verbose style with the prior entry chained behind `Prior:`; Epic 6 action item **C1** moved `open → done` with the
  wording correction recorded in full, including the measurement (16 of 25 red) that establishes it.

### Not done / limitations

- **Nothing was committed** — the working tree carries the whole change. AC10 requires the two `Files:`-line deviations
  (`GQL.kt`, `ItemRepository.kt`) to appear in the **commit body**; that obligation is still outstanding and belongs to
  whoever commits.
- **The E2E red observation and the manual browser pass are inherited, not re-measured** (see above).
- **The ruling-D process mismatch is flagged for `md`, not resolved** — see the Spec Change Log.
- ~~`rule_count: 77` in `project-context.md`'s frontmatter was left untouched.~~ **Bumped to `85` in the review pass**
  (eight rules were added by this story). The number remains nominal — it has not been re-derived from the file.

## Auto Run Result

Status: **done**. Baseline `73db447`. Two implementation sessions plus one review pass; no loopback was needed
(0 intent_gap, 0 bad_spec).

### Implemented change

`ItemService.saveItem` no longer reconstructs the item from `ItemInput`. It loads the stored row with
`storage.getByIdCached(item.id, item.listId)` and, when it exists, `copy()`s onto it only the five fields the GraphQL
input carries (`name`, `checked`, `category`, `store`, `recurring`). The direction is an **allowlist** — copying input
onto storage, so a server-owned field added to `Item` later is preserved by default. That closes **BUG-E6-1** (an edit
re-stamped `addedBy` with whoever last saved) and **BUG-E6-2** (an edit nulled `checkedAt`, so the recurring scheduler
silently dropped the item forever). Two rejections were added, both thrown *before* `itemUpdateChannel.emit(...)` so a
refused write broadcasts no `SAVED` event: an id that already lives on another list (which `ItemRepository.save`'s
`_id`-only upsert would otherwise silently **relocate**), and — on the update branch only, per `md`'s ruling A — a
category that does not belong to the list. Create-vs-update is discriminated by **existence in storage**, never by
presence of an id: Epic 6 action item C1's literal wording would have rejected every new item, and that is now
measured, not argued (16 of 25 tests red).

### Files changed

| File | Description |
|---|---|
| `bp_back/.../entity/item/ItemService.kt` | The merge, the two rejections, and a 4th ctor param `categoryStorage` |
| `bp_back/.../entity/item/mongo/ItemRepository.kt` | New `findById(id)` — the global point read AC3's cross-list guard needs |
| `bp_back/.../plugins/GQL.kt` | One positional argument at `:88` (pure wiring) |
| `bp_back/.../ItemLifecycleTest.kt` | 4 new mutation helpers, a `checked` parameter, and 8 new AC1–AC5 tests |
| `bp_back/.../ItemApiTest.kt` | Category seeded (and asserted) for the suite's only update-branch site |
| `bp_front/e2e/item-attribution.spec.ts` | **New** — the FR45/FR58 two-member attribution test; `/list/:id`'s `addedBy` had zero E2E coverage |
| `bp_front/e2e/support/ui.ts` | `attrib` added to the username-prefix registry comment |
| `_bmad-output/.../deferred-work.md` | BUG-E6-1/E6-2 closed, BUG-E6-3 partial, BUG-E6-3a created, C1's wording corrected, plus the Story 7.4 and code-review sections |
| `_bmad-output/project-context.md` | 8 new rules (merge semantics, the two rejections, the error idiom, the `cleanTest` trap) |
| `_bmad-output/.../sprint-status.yaml` | Story `done`; Epic 6 action item C1 `open → done` with its correction |

`bp_front/src/` is untouched, `GqlItemInput.kt` is untouched, no schema change, `npm run generate` was not run.

### Review findings

6 patches applied (1 high, 3 medium, 2 low), 6 deferred (5 medium, 1 low), 17 rejected. Full breakdown in the Review
Triage Log. The high-severity patch was not a code defect: the ledger this story wrote asserted that the deliberately
unguarded create branch had **no UI producer**, and the review proved otherwise — the remove-category cascade
hard-deletes items first, so a co-member's stale edit dialog reaches it. The claim was corrected and the open hole
re-priced. The one test-quality patch (AC4's two rejection tests could not see a partial write) was re-observed red
before being accepted.

### Verification

- `./gradlew :bp_back:cleanTest :bp_back:test` → `BUILD SUCCESSFUL`, `tests=113 failures=0 errors=0 skipped=0`. Run
  three times: after implementation, after the review patches, and after restoring the guard from the red observation.
- Red observations measured this session: 5 backend breakage variants (merge reverted → 6 red; AC3 guard alone → 1;
  AC4 guard alone → 2; C1-as-worded → 16; category guard hoisted to creates → 10), plus the review pass's own
  2-red re-observation. All 8 new tests have been seen failing for the right reason.
- `npx tsc -b` → 0. `npm run lint` → 0, zero output. `npx playwright test --list` → `Total: 106 tests in 10 files`,
  split `52 chromium / 52 mobile / 1 registration-toggle-chromium / 1 registration-toggle-mobile`.
- `npm run test:e2e` → `106 passed (54.5s)`, exit 0, `retries: 0`, zero flaky, the new spec green on **both** viewport
  projects. Not re-run after the review patches: those touched backend *test* files and markdown only, and
  `ItemService.kt` was restored md5-identical, so the deployed image is unchanged.
- Diff boundary: `git diff --stat bp_back/` names exactly the five Code Map files; `git diff --stat bp_front/src/` is
  empty; `GqlItemInput.kt` is unchanged. `grep toPass bp_front/e2e/` → one hit (`navigation.spec.ts:100`);
  no `@ts-ignore`/`@ts-expect-error`/`eslint-disable` in `e2e/`.
- AC9 verified by md5: the Story 7.2 and 7.3 ledger sections are byte-identical to `73db447`.

### Residual risks

1. **The E2E red observation and the manual browser pass are inherited from the first implementation session and were
   not reproduced.** Everything else here was measured in the sessions that report it. Re-take those two if you want
   NFR-E7-4 first-hand end to end.
2. **`docker compose up -d --build` does not recreate running containers** — the suite would have silently tested a
   stale backend. `--force-recreate` was required, and the `/api/graphiql` → 401 readiness poll cannot detect the
   difference. A direct API probe was used to prove the deployed image contained the merge. This trap is not yet
   recorded in `project-context.md`.
3. **Two holes remain open by decision, and they compose.** The create branch accepts any category (ruling A) and
   BUG-E6-3a's resurrection is downgraded but unfixed; together they are UI-reachable via the remove-category cascade.
   Both are filed with the reachability corrected.
4. **The throw-before-`emit` invariant is stated in two documents and tested nowhere.** Filed.
5. Ruling D expected no `spec-7-4-*.md`; this run was invoked as `bmad-dev-auto`, so one exists. Flagged for `md` in
   the Spec Change Log — bookkeeping obligations were identical either way.
