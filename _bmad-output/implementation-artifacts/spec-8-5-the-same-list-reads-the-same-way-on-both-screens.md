---
title: 'Story 8.5: The Same List Reads the Same Way on Both Screens'
type: 'feature'
created: '2026-09-08'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: 'e6a2716fe63d6126a0d2a860d18c5c8278cb83fb'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: ['multiple-goals', 'oversized']
deferred:
  - summary: >-
      The orphan CAUSE is untouched: `ListDetailPage`'s remove-category confirm is a client-side delete loop over the
      items that client happens to hold, so an item added by another client since the last refetch survives its
      category. AC6 forbade the fix (it needs the AR-E8-0 backend freeze lifted, and would do nothing for orphans
      already in the data). Story 8.5 shipped the MITIGATION — orphans are visible and recoverable on /lists/:id —
      not the fix. Filed in deferred-work.md with the cascade shape the real fix takes.
  - summary: >-
      An orphan's `EditItemDialog` opens with a blank category Select (the stored id is out of range). Picking one is
      the recovery and it works; saving WITHOUT touching it hits `nothingChanged` and closes silently, leaving the
      orphan orphaned with no feedback. No AC covers it and `EditItemDialog.tsx` edits are routed elsewhere by a
      standing ledger entry. Recorded on the AC6 ledger entry rather than patched.
  - summary: >-
      The `createdAt` lint guard stays OPEN. Story 8.5 landed the module half its ledger entry asked for
      (`lib/lists/order.ts` now holds every shared comparator) but not the rule that enforces it; that was on this
      story's Never list. No story is named for the guard.
  - summary: >-
      A real category literally named `Uncategorized` collides with the synthetic bucket: two cards with the same
      heading and the same `category-row-Uncategorized` testid, one carrying category controls and one not.
    evidence: |-
      Raised independently by three review layers. `groupItemsByCategory` names the bucket `'Uncategorized'`
      unconditionally and both routes key their testid off `group.name`, so the collision is real on both screens.
      The class is pre-existing — `/list/:id` has produced `shopping-group-Uncategorized` since Story 5.6 — and this
      story extends it to the management screen. Not patched: the cheap fixes (key the testid off `group.key`, or
      reserve the name at category creation) either rename testids shipped specs already use or add a validation
      surface no AC asks for, and Epic 8 rules that colliding category names are recorded, not guarded.
    location: >-
      bp_front/src/lib/lists/order.ts (UNCATEGORIZED_NAME) and both list routes' group testids
    severity: low
  - summary: >-
      The project has no unit-test runner, so `e2e/order.spec.ts` — a pure-function suite — is collected and run
      twice by the browser runner, booting the full docker stack for tests that touch no DOM.
    evidence: |-
      `package.json` has no vitest or equivalent; `playwright.config.ts` `testDir: './e2e'` collects the file into
      both viewport projects. It costs no browser and the config comment records the reasoning, but the underlying
      gap — this is the first story to need function-level coverage — is otherwise unfiled, so the next pure-function
      test lands in `e2e/` by precedent.
    location: >-
      bp_front/package.json, bp_front/e2e/order.spec.ts
    severity: low
  - summary: >-
      The `Uncategorized` group ships with no copy explaining what it is or that editing an item re-homes it, so the
      recovery the story exists to provide is discoverable only by trying the edit button.
    evidence: |-
      The group renders a bare heading and, by design (AC4), no category-level affordance. The E2E encodes the
      recovery path; the UI states it nowhere. A one-line caption inside the group would carry it without touching
      AC5 or AC6. Related and same family: in the orphans-with-no-categories state the widened mount guard renders
      the whole filter row, including a category Select with zero options, where only the search box is meaningful.
    location: >-
      bp_front/src/routes/ListDetailPage.tsx (the synthetic group's header)
    severity: low
---

<intent-contract>

## Intent

**Problem:** `/list/:id` sorts categories and items by name and buckets items whose category id has no local
match into a synthetic `Uncategorized` group; `/lists/:id` sorts **nothing** (raw query order, and
`ListStorage`-style map order is not stable) and has **no** `Uncategorized` group. So the same list reads in two
different sequences (report #7, FR62), and an item orphaned by a category removal is visible while shopping and
invisible on the only screen that can edit or delete it (AR-E8-7) — recoverable today only with database access.

**Approach:** Lift the shopping view's `sortByName` **and** its `Uncategorized` grouping into ONE module in
`bp_front/src/lib/lists/`, beside `byCreatedAtAsc` — which moves into that same module out of `homePath.ts`, so a
pure comparator no longer drags `useQuery` + `useAuth` behind it. Both routes then render groups produced by that
one function. No backend change, no schema change, no codegen.

## Boundaries & Constraints

**Always:**
- **One comparator, one grouping, one definition (AC3, NFR-E8-5).** After this story `grep -rn "localeCompare"
  bp_front/src/` must show the name comparator defined in exactly ONE module. `ListShoppingPage`'s local
  `sortByName` AND `ListFilters.tsx`'s inline `(a, b) => a.name.localeCompare(b.name)` (the menu order) are BOTH
  copies and both must import the shared one.
- Canonical order is by name: categories by name, items by name within a category, on both surfaces. The shopping
  view's current order is canonical (`md`'s ruling, UX-DR-E8-8); the management screen adopts it.
- The synthetic group is appended LAST, is named `Uncategorized`, and exists on a surface only when at least one
  orphan is present there. Its absence with no orphans is asserted, not assumed.
- The management screen keeps its deliberate differences intact (AC5): empty categories render with their
  "No items yet." row while nothing filters, and are dropped while a filter or search is active (Story 8.4 AC4);
  the shopping view hides empty groups always.
- On the management screen the `Uncategorized` group carries NO category-level controls — there is no category to
  add into or remove — but each orphaned item keeps its own working edit and remove controls (AC4).
- Test data is created through the UI/API only, never by writing into MongoDB. The orphan is produced through a
  path a real user can walk (see Design Notes — the stale-client-set race AR-E8-7a describes).
- Every new spec is observed FAILING before it is accepted (NFR-E8-6), runs on `chromium` AND `mobile`, against the
  production image.

**Never:**
- No backend change: `git diff --stat bp_back/` stays empty. No schema change, no `npm run generate`.
- No fix for the orphan CAUSE (AC6): the client-side delete loop in `ListDetailPage`'s remove-category confirm stays
  exactly as it is — making it atomic needs the AR-E8-0 unfreeze nothing else in this epic uses, and would do nothing
  for orphans already in the data. Record the mechanism in `deferred-work.md`; do not implement it.
- No `subscribeToMore` on `ListDetailPage` — it stays refetch-driven (AR-E8-6).
- No `Uncategorized` OPTION in the category filter's Select. The 8.4 deferral asked 8.5 to settle this: settled as
  NO — no AC asks for it, no report asks for it, and adding a synthetic id to `ItemFilterValue.categoryIds` would
  put a value in the selection that `useItemFilter`'s prune (which drops every id not in `categories`) deletes on
  the next render. Record the decision and its mechanism in `deferred-work.md`.
- No change to `EditItemDialog.tsx`, `ListFilters.tsx`'s markup, `AddItemDialog`, or any dialog's behaviour.
- No lint rule guarding `createdAt` sorts (the other half of the deferred item that names this story) — out of AC
  scope; the module split is the half that lands here. Leave the deferred entry open, updated.
- No toasts, snackbars, banners. Not a redesign: theme, type scale and visual language unchanged.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ordinary list, no filter | 3 categories created out of alphabetical order, items likewise | Both surfaces render categories A→Z and items A→Z within each; the two sequences are equal | No error expected |
| Orphan present | An item whose `category` matches no loaded category | An `Uncategorized` group, LAST, on BOTH surfaces, holding that item | No error expected |
| No orphans | Every item's category is loaded | No `Uncategorized` group anywhere | No error expected |
| Management, empty category, no filter | Category with zero items, `filter` inactive | Category rendered with "No items yet." (unchanged, AC5) | No error expected |
| Management, empty category, filter active | Same, `isItemFilterActive` true | Category not rendered (unchanged, AC5) | No error expected |
| Shopping, empty category | Category with zero items, any filter state | Never rendered (unchanged, AC5) | No error expected |
| Management, search matches only an orphan | `search` = the orphan's name | The `Uncategorized` group renders it — NOT `list-detail-no-matches` | No error expected |
| Management, a real category selected, orphan present | `categoryIds = [dairy]` | Orphans hidden — the decided behaviour, no `Uncategorized` filter option exists | No error expected |
| Only orphans, zero categories | `categories = []`, orphaned items present | `Uncategorized` renders; `list-detail-empty` is NOT the branch taken | No error expected |
| Genuinely empty list | No categories, no items | `list-detail-empty` ("No categories yet") unchanged | No error expected |
| Two categories with the same name | Duplicate names on one list | Order is stable by id tiebreak; duplicate `category-row-<name>` testids are pre-existing and out of scope | No error expected |

</intent-contract>

## Code Map

- `bp_front/src/lib/lists/order.ts` -- **NEW. The one definition of ordering AND grouping.** Plain `.ts` (no JSX)
  so `react-refresh/only-export-components` stays satisfied. Exports:
  - `byCreatedAtAsc` — **MOVED verbatim from `homePath.ts:36`**, comment block included. This discharges the
    deferred item "`byCreatedAtAsc` and `useHomePath` share a module, so a pure sort helper drags in `useQuery` +
    `useAuth`", which names this story as the moment to split.
  - `byName(a: {name: string}, b: {name: string})` — `a.name.localeCompare(b.name)`. The comparator AC3 is about.
  - `UNCATEGORIZED_KEY` (`'__uncategorized__'`) and `UNCATEGORIZED_NAME` (`'Uncategorized'`) — moved from
    `ListShoppingPage.tsx:35`.
  - `ItemGroup<C, I>` = `{key: string; name: string; category: C | null; items: readonly I[]}` — `category` is
    `null` for the synthetic bucket, which is how each route decides whether to render category-level controls.
  - `groupItemsByCategory(categories, items, {keepEmpty})` — the lifted body of `ListShoppingPage.tsx:367-397`,
    generic over the category and item shapes, with `keepEmpty` the ONLY difference between the two surfaces.
- `bp_front/src/lib/lists/homePath.ts` -- **change.** Delete the `byCreatedAtAsc` definition and its comment block;
  `import {byCreatedAtAsc} from '@/lib/lists/order'` and re-export nothing. `useHomePath` is otherwise untouched.
- `bp_front/src/routes/ListShoppingPage.tsx` -- **change.**
  - `:30` import `byCreatedAtAsc` from `@/lib/lists/order` instead of `homePath`.
  - `:35` `UNCATEGORIZED` const and `:37-43` the `Group` interface — deleted, imported instead.
  - `:367-397` the `groups` `useMemo` body — replaced by
    `useMemo(() => groupItemsByCategory(categories, filteredItems, {keepEmpty: false}), [categories, filteredItems])`.
    `keepEmpty: false` preserves `.filter(group => group.items.length > 0)` exactly (AC5).
  - `:516` `shopping-group-${group.name}` and the whole render block — **read-only**, unchanged.
  - `ShoppingItemRow` (`:60-240`) — **read-only.** Story 8.3's single-control row is untouched.
- `bp_front/src/routes/ListDetailPage.tsx` -- **change, and this is the story's centre.**
  - `:78-82` `visibleCategories` — DELETED. Replace with
    `const groups = groupItemsByCategory(categories, items.filter(i => matchesItemFilter(i, filter)), {keepEmpty: !filterActive})`.
    (No `useMemo`: this component memoises nothing today; do not add one gratuitously.)
  - `:168` the `ListFilters` mount guard `categories.length > 0` → `(categories.length > 0 || items.length > 0)`,
    so a list holding only orphans still offers the search that reaches them. Everything else about the mount —
    NOT gated on `loading` — stays.
  - `:185`/`:194` the branch chain: `categories.length === 0` → `groups.length === 0 && !filterActive` for
    `list-detail-empty`; `visibleCategories.length === 0` → `groups.length === 0` for `list-detail-no-matches`.
    Keep the `error` and `loading` branches first, in order.
  - `:202` `visibleCategories.map(category => …)` → `groups.map(group => …)`: `key={group.key}`,
    `data-testid={`category-row-${group.name}`}`, `data-testid="category-name"` renders `group.name`, and the
    per-item list renders `group.items` — the inline `items.filter(...)` inside the map is deleted (the grouping
    function already did it). Wrap the add-item + remove-category `Box` in `{group.category && ( … )}` and use
    `group.category` where `category` was used. The item `ListItem` block, its `ListItemText` clamp and both item
    IconButtons are **unchanged**.
  - The remove-category confirm handler's `for (const item of items.filter(...)) await deleteItem(...)` loop
    (`:376`) — **read-only. AC6 forbids touching it.**
- `bp_front/src/components/ListFilters.tsx` -- **change, one line.** `:58` `const sorted = [...categories].sort((a,
  b) => a.name.localeCompare(b.name))` → `.sort(byName)` with the import. This is the third copy AC3's grep will
  otherwise find; the `renderValue` comment that says the summary is built from the same order still holds.
- `bp_front/src/components/StoreField.tsx` -- **read-only, and deliberately.** `:37` sorts a `string[]` of store
  names, not `{name}` objects; `byName` does not fit it, and forcing it to would be a worse definition. Say so
  rather than leaving the grep hit unexplained.
- `bp_front/e2e/lists.spec.ts` -- **change.** Home for both FR62 specs (see Tasks). Follows the file's existing
  idioms: `uniqueUsername('lists', <label>, testInfo.project.name)`, fresh user per run, assert only on rows it
  created. `withCategoryMenu` owns the fact that the multi-select menu does not self-close.
- `bp_front/e2e/support/ui.ts` -- **reuse, do not change.** `registerViaUi`, `openListsViaMenu`, `createListAndOpen`,
  `addCategory`, `addItem`, `withCategoryMenu`, `PASSWORD`, `uniqueUsername`.
- `bp_front/e2e/lists.spec.ts:367` `FR61 — an EMPTY category is kept…` -- **read-only, and it is AC5's coverage.**
  It already asserts all three AC5 clauses on both surfaces; it must stay green unmodified. Do not add a duplicate.
- `bp_front/playwright.config.ts` -- **change (comment only).** Append a dated collection row for this story to the
  count log after `:155`. Re-measure with
  `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` — never quote an earlier row's figure.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- **change.** Four edits, all named above: (1) file the
  AC6 orphan cause; (2) close the `byCreatedAtAsc`-module-split item as delivered; (3) leave the `createdAt` lint
  guard open, noting the split landed and the guard did not; (4) close the Story 8.4 `Uncategorized`-filter-option
  deferral with the NO decision and its mechanism.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- **change at close.** `8-5-…: backlog` → `done`.

## Tasks & Acceptance

**Execution:**
- `bp_front/e2e/lists.spec.ts` -- add both FR62 specs and run them FIRST, red, against the pre-fix production
  build -- NFR-E8-6. Where a test cannot be red on its own terms, record the exemption in Implementation Notes the
  way Stories 8.3 and 8.4 did, rather than claiming a red.
- `bp_front/src/lib/lists/order.ts` -- create it: move `byCreatedAtAsc` in, add `byName`, the two `UNCATEGORIZED`
  constants, `ItemGroup` and `groupItemsByCategory` -- AC1, AC2, AC3, AC4.
- `bp_front/src/lib/lists/homePath.ts` -- drop the moved comparator, import it -- AC3.
- `bp_front/src/components/ListFilters.tsx` -- use `byName` for the menu order -- AC3.
- `bp_front/src/routes/ListShoppingPage.tsx` -- consume `groupItemsByCategory` with `keepEmpty: false`, deleting
  the local `sortByName`, the `Group` interface and the `UNCATEGORIZED` const -- AC1, AC2, AC3, AC5.
- `bp_front/src/routes/ListDetailPage.tsx` -- render `groups` instead of `visibleCategories`, with
  `keepEmpty: !filterActive`; widen the filter mount guard; re-point the empty / no-matches branches; make the
  category-level controls conditional on `group.category` -- AC1, AC2, AC4, AC5.
- `bp_front/playwright.config.ts` -- append the dated collection row with per-project counts -- AC7.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- the four edits listed in the Code Map -- AC6.
- spec Implementation Notes -- record the observed pre-fix reds, the post-fix greens, the measured collection
  counts, and the AC3 grep output -- AC7.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- flip `8-5-…` to `done` at close.

**Acceptance Criteria:**
- Given a list whose categories and items were created out of alphabetical order, when it is opened on `/lists/:id`
  and on `/list/:id`, then the category sequence is identical on both screens and is ascending by name.
- Given the same list, when one category's items are read on each screen, then the item sequence is identical on
  both and is ascending by name.
- Given `grep -rn "localeCompare" bp_front/src/`, when the story is complete, then the name comparator is defined
  in exactly one module — `lib/lists/order.ts` — imported by `ListShoppingPage`, `ListDetailPage` (transitively,
  via the grouping function) and `ListFilters`; the only other hit is `StoreField.tsx`'s `string[]` sort and
  `order.ts`'s own `byCreatedAtAsc` id tiebreak.
- Given a list containing an item whose category no longer exists, when `/lists/:id` renders, then that item
  appears in an `Uncategorized` group, positioned last, with no add-item or remove-category control on the group.
- Given that orphaned item on `/lists/:id`, when its edit control is used to choose a real category and the dialog
  is saved, then the item moves into that category's group and leaves `Uncategorized`.
- Given a second orphaned item on `/lists/:id`, when its remove control is used and confirmed, then it is deleted;
  and once no orphans remain, the `Uncategorized` group is absent from the page entirely.
- Given `/lists/:id` with an orphan present, when a search term matching only that orphan is typed, then the
  `Uncategorized` group renders it and `list-detail-no-matches` is not shown.
- Given the completed story, when the suite runs on `chromium` and `mobile` against the production image, then it
  is green — the pre-existing `FR61 — an EMPTY category is kept…` spec included, unmodified — `npm run lint` and
  `npm run build` pass, and `git diff --stat bp_back/` is empty.

## Spec Change Log

## Review Triage Log

### 2026-09-08 — Review pass

Four layers (blind-hunter, edge-case-hunter, verification-gap, intent-alignment) against the diff since `e6a2716`.
Duplicate claims from different layers keep their own rows and share a route.

- verdicts: 25 findings — high 0, medium 6, low 10, false 2, maybe-false 0 (7 rejected outright)
- findings:
  - `[medium]` `[patch]` Reachable dead end: the filter row unmounts when the last category and its items are removed while a search term is held, leaving `list-detail-no-matches` with nothing on screen to clear it — verified at the mount guard (`categories.length > 0 || items.length > 0`) against `useItemFilter`'s surviving state; the pre-8.5 `categories.length === 0` gate could not reach it. Patched: the guard gained `|| filterActive`.
  - `[medium]` `[patch]` The "`Uncategorized` is appended LAST" rule is asserted only where alphabetical placement gives the same answer (`Keep …` < `Uncategorized`, and the shopping-side `.at(-1)` had a single element) — verified; re-sorting the array instead of appending would keep every assertion green. Patched: the fixture gained a non-empty `Z Last …` category and both `.last()`/`.at(-1)` checks became full-sequence assertions.
  - `[medium]` `[patch]` Same dead end, filed by the edge-case layer with the alternative guard shape — shares the root cause and the fix above.
  - `[medium]` `[patch]` Same dead end, filed by the edge-case layer as a claim against the "genuinely empty list ⇒ `list-detail-empty`" matrix row (an empty list reached with a term held renders no-matches) — shares the root cause and the fix above.
  - `[medium]` `[patch]` Same dead end, noted by the verification-gap layer's Other findings as a branch-shape change beyond the spec — shares the root cause and the fix above.
  - `[medium]` `[patch]` Same LAST-rule gap, filed as the verification-gap layer's primary finding with a demonstration (push-then-resort keeps the suite green) — shares the root cause and the fix above.
  - `[low]` `[patch]` `ListFilters`'s new comment claims menu, summary and list "read in one sequence", but the menu sorts with `byName` while the groups sort with `byNameThenId`, so tied names can disagree — verified. Patched: comment narrowed to the same *name* comparator with the tiebreak deliberately not applied, and the consequence stated.
  - `[low]` `[patch]` `known` is a `Map` whose values are never read; only `.has` is called, and it allocates on every `/lists/:id` render — verified. Patched: it is a `Set` of ids.
  - `[low]` `[patch]` The `{group.category && …}` narrowing is lost inside the handlers, so `group.category?.id` can pass `undefined` and the remove setter accepts `null` — verified as dead paths held up by the JSX guard alone. Patched: `const category = group.category` bound once, both handlers use it.
  - `[low]` `[patch]` `e2e/order.spec.ts` pulls `order.ts` into the e2e TS project, which defines no `paths`, so the first `@/…` import there breaks `tsc -b` in a project nobody inspects — verified against `tsconfig.e2e.json`. Patched: a KEEP-IMPORT-FREE note at the top of the module.
  - `[low]` `[patch]` The orphan fixture's staleness premise is unasserted, so a refetch in tab A would silently produce no orphan and fail later as a false negative — verified (nothing refetches tab A today, but nothing asserts it either). Patched: both stranded rows asserted absent before the remove-category click.
  - `[low]` `[defer]` A real category named `Uncategorized` collides with the synthetic bucket on both screens — real; class pre-existing on `/list/:id` since Story 5.6, and every fix renames shipped testids or adds validation no AC asks for. Deferred with the mechanism.
  - `[low]` `[defer]` Same collision, filed by the edge-case layer — shares the root cause and the route above.
  - `[low]` `[defer]` Same collision, filed by the verification-gap layer's Other findings — shares the root cause and the route above.
  - `[low]` `[defer]` The project has no unit-test runner, so the pure-function spec runs under the browser runner twice — real and unfiled anywhere. Deferred.
  - `[low]` `[defer]` The `Uncategorized` group ships with no copy explaining it or the re-home recovery; related, the orphans-only state renders a zero-option category Select — real. Deferred.
  - `[low]` `[defer]` An orphan's `EditItemDialog` opens blank and saving untouched closes silently, leaving it orphaned — real, already recorded by the implementation; carried into frontmatter `deferred`.
  - `[false]` `[reject]` `deferred-work.md` cites a stale `order.ts:69` for `byName` — refuted: `grep -n "export function byName"` returns line 69 exactly.
  - `[false]` `[reject]` Two categories sharing an id would collide in the grouping map — refuted: Apollo normalises `Category` by id, so the query result cannot carry two rows with one id; no reachable producer was shown.
  - `[low]` `[reject]` `order.spec.ts` omits `keepEmpty` and `byCreatedAtAsc` cases — rejected: `keepEmpty` is pinned end-to-end on both surfaces by the unmodified `FR61 — an EMPTY category is kept…` spec, and `byCreatedAtAsc` is byte-identical moved code already covered by the FR38 specs; adding redundant collection is not worth two more runs per test.
  - `[low]` `[reject]` AC3's grep expectation does not literally enumerate `order.ts:86` (`byNameThenId`) — rejected: the fix is to edit this build's spec, and the Implementation Notes already disclose the hit and why it exists.
  - `[low]` `[reject]` The spec's Verification section still lists the pre-tiebreak grep expectation — rejected on the same rule: the fix edits this build's spec.
  - `[low]` `[reject]` `sprint-status.yaml` reads `done` while the spec is `in-review`, the two `warnings` are undischarged, and the log headings are empty — rejected: all four are workflow-managed and converge at finalisation, which is where this pass ends.
  - `[low]` `[reject]` AC7's literal orphan recipe (single-tab create/delete/observe) was substituted with a two-page stale-cache race — rejected: the literal recipe provably produces no orphan, the substitute is UI-only and honours AC7's actual prohibition, and the Design Notes record the substitution rather than hiding it.
  - `[low]` `[reject]` `order.spec.ts` asserts at the module surface, not against the production image AC7 names — rejected: the duplicate-name case is unobservable through name-keyed testids, the file runs inside the same gate on both projects, and the reasoning is recorded in `playwright.config.ts` and the spec.
  - `[low]` `[reject]` The diff edits files outside the epic's `Files:` line (`ListFilters.tsx`, `homePath.ts`, `ListDetailPage`'s branch conditions) — rejected: each is required by NFR-E8-5's one-definition rule or by AC4's zero-categories corner, both inside the intent.

## Design Notes

**Why grouping moves, not just the comparator.** AC3 asks for one comparator, but the epic's `Reuses:` line asks
for the `Uncategorized` grouping to be *lifted, not reimplemented*. Reimplementing the bucket on `ListDetailPage`
would be the exact drift FR62 exists to close — two screens deciding independently what "an item with no category"
means. One function, one `keepEmpty` flag, and the flag IS the deliberate difference AC5 preserves:

    export function groupItemsByCategory<
      C extends {id: string; name: string},
      I extends {name: string; category: string},
    >(categories: readonly C[], items: readonly I[], {keepEmpty}: {keepEmpty: boolean}): ItemGroup<C, I>[] {
      const known = new Map(categories.map(c => [c.id, c]))
      const byCategory = new Map<string, I[]>()
      const orphans: I[] = []
      for (const item of items) {
        if (known.has(item.category)) byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item])
        else orphans.push(item)
      }
      const groups = [...categories].sort(byName).map(c => ({
        key: c.id, name: c.name, category: c, items: [...(byCategory.get(c.id) ?? [])].sort(byName),
      })).filter(g => keepEmpty || g.items.length > 0)
      if (orphans.length > 0) {
        groups.push({key: UNCATEGORIZED_KEY, name: UNCATEGORIZED_NAME, category: null, items: [...orphans].sort(byName)})
      }
      return groups
    }

**How the orphan is produced through the UI (AC7).** The remove-category handler deletes the items *it can see*
and then the category, so a single-tab "add a category, add an item, delete the category" leaves nothing behind —
that literal sequence produces no orphan and a test written to it would assert nothing. The real producer is the
stale-client-set race AR-E8-7a describes, and it is reachable with two pages in one browser context: page A opens
`/lists/:id` (its Apollo cache holds one item); page B opens the same list and adds a second item to the same
category; page A — refetch-driven, no subscription, therefore still stale — removes the category, deleting only the
item it knows about. Page B's item survives with a dangling category id. This is UI-only, needs no second user, and
is the mechanism AC6 files rather than fixes. Assert page A's own post-refetch render, no reload needed.

**An orphan's edit dialog opens with an out-of-range category.** `EditItemDialog` seeds `categoryId` from
`item.category`, so for an orphan the `Select` shows blank (MUI's out-of-range warning is dev-only; the E2E runs the
production build). That is the right affordance — "pick a category" — and picking one is exactly AC4's recovery. But
saving *without* touching it hits `nothingChanged` and closes silently, leaving the orphan orphaned. Out of scope
(no AC, and 8.4 already routed `EditItemDialog` changes to Story 8.6); file it as a note on the AC6 ledger entry
rather than patching the dialog here.

**Zero categories but orphans present is a real branch.** Deleting a list's only category via the race above leaves
`categories = []` with items, and the old `categories.length === 0` gate would show "No categories yet" over an item
that exists. Branching on `groups.length` instead of `categories.length` is what makes AC4 hold in that corner; the
genuinely empty list still lands on `list-detail-empty` because it has no groups either.

**Sequence assertions read the DOM, not the source.** `page.getByTestId('category-name').allTextContents()` gives
the management order; on the shopping view read the `data-testid` attributes of
`[data-testid^="shopping-group-"]`, and item names from `getByRole('checkbox')`'s `aria-label` (`Toggle <name>`)
scoped to a group. Both surfaces already carry everything needed — add no testids.

## Verification

**Commands:**
- `cd bp_front && npx playwright test --retries=0` -- expected: green on `chromium` and `mobile`, no new skips.
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` -- expected: `chromium`
  and `mobile` equal, exactly one test in each `registration-toggle-*` project.
- `cd bp_front && grep -rn "localeCompare" src/` -- expected: `order.ts` (the definition + the `byCreatedAtAsc` id
  tiebreak) and `StoreField.tsx` only.
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0.
- `git diff --stat bp_back/` -- expected: empty.

**Manual checks:**
- `/lists/:id` and `/list/:id` on desktop and at 320px: categories and items read in the same by-name sequence on
  both; with an orphan present the `Uncategorized` group is last on both screens and its items' edit and remove
  controls work on the management screen; with no orphans the group is absent from both.

## Implementation Notes

### The pre-fix reds (NFR-E8-6)

Both FR62 specs were written first and run against the **pre-fix production image** already serving on `:2080` at the
baseline revision `e6a2716` — no rebuild was needed, the running stack *was* the pre-fix build. Command:
`npx playwright test lists.spec.ts --grep "FR62" --retries=0`.

**4 failed, 0 passed** — both specs, both projects:

- `FR62 — an item orphaned by a category removal is reachable in an Uncategorized group on /lists/:id`
  (`chromium` + `mobile`): `expect(getByTestId('category-row-Uncategorized')).toBeVisible()` — *element(s) not found*.
  The orphan fixture itself worked on the first attempt, i.e. the two-tab race produced real orphans against the
  unmodified build; the screen simply had nowhere to show them.
- `FR62 — categories and items read in the SAME by-name order on /lists/:id and /list/:id` (`chromium` + `mobile`):
  the management sequence did not equal `[A, M, Z]`.

**One honest caveat about the second red, recorded rather than smoothed over.** A `--project=chromium` rerun of the
ordering spec alone came back **green once** before settling. That is not a flaky test — it is the defect. The
pre-fix management screen rendered raw query order, and the backend's map order is *not stable*, so on one run it
happened to hand back a sequence that was already alphabetical. Three consecutive full pre-fix runs of that spec
(both projects, `--retries=0`) were then **2 failed / 2 failed / 2 failed**, and the received sequences differed
between runs — `[M, A, …]` twice and a different single-element mismatch once. The instability is itself evidence for
the problem statement, and it is why the shipped assertion compares the two screens' sequences to each other **and**
to a fixed expected order: an assertion that only compared the screens would have gone green whenever the unstable
order coincided.

**A third red, from the matrix-coverage pass.** `bp_front/e2e/order.spec.ts` (three duplicate-name tests, no `page`
fixture) was written before the id tiebreak landed and run against the module as it then stood:
`npx playwright test order.spec.ts --retries=0` → **6 failed, 0 passed** (3 tests x 2 viewport projects). The
diagnostic was exactly the defect: the two tied `Dairy` categories came out `[cat-b, cat-a, cat-c]` from one input
order and `[cat-b, cat-c, cat-a]` from the reverse. After the tiebreak: **6 passed (855ms)**.

### The post-fix greens

Full suite, post-fix image (`docker compose up -d --build bp_front`), `npx playwright test --retries=0`:

```
19 skipped
195 passed (1.2m)
```

214 collected, **0 failures, 0 flaky**. `FR61 — an EMPTY category is kept on /lists/:id while nothing filters,
dropped while something does, and never shown on /list/:id` is green **unmodified** — that spec is AC5's coverage and
it was not touched.

### Measured collection counts (AC7)

`npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`:

```
    106 chromium
    106 mobile
      1 registration-toggle-chromium
      1 registration-toggle-mobile
```

214 = 106 / 106 / 1 / 1, against Story 8.4's 204 = 101 / 101 / 1 / 1 — +5 untagged tests at +2 runs each = +10
(2 browser specs in `lists.spec.ts`, 3 pure-function tests in the new `order.spec.ts`). Exactly one test in each
`registration-toggle-*` project, both viewport projects equal.

The **skip split is 18 chromium / 1 mobile**, unchanged from the Story 8.4 row because neither new test carries a
project guard — `order.spec.ts` has no `page` fixture and therefore no viewport to guard on. It was read off a
`--reporter=json` run (`results[0].status === 'skipped'` per `projectName`), not
inferred from the total of 19 — `--list` cannot report a runtime `test.skip(...)`, and the config's own comment says
to count skips per project rather than trust the total.

### AC3 — one definition, by grep

`grep -rn "localeCompare" bp_front/src/` after the change:

```
src/lib/lists/order.ts:25:// sub-second `…:05.100Z` under localeCompare ('Z' 0x5A > '.' 0x2E) even though
src/lib/lists/order.ts:49:    if (Number.isNaN(ta) && Number.isNaN(tb)) return a.id.localeCompare(b.id)
src/lib/lists/order.ts:52:  return ta - tb || a.id.localeCompare(b.id)
src/lib/lists/order.ts:57:// `grep -rn "localeCompare" src/` finds it defined once. Deliberately narrow:
src/lib/lists/order.ts:70:  return a.name.localeCompare(b.name)
src/lib/lists/order.ts:86:  return byName(a, b) || a.id.localeCompare(b.id)
src/components/StoreField.tsx:37:  ].sort((a, b) => a.localeCompare(b))
```

`:70` is the one name comparator. `:49`/`:52` are `byCreatedAtAsc`'s id tiebreak, `:86` is the grouping function's
own id tiebreak (module-private `byNameThenId`, which CALLS `byName` rather than restating it), and `:25`/`:57` are
comments.
`StoreField.tsx:37` sorts a bare `string[]` of store names, not `{name}` objects — `byName` does not fit it and
widening `byName` to take strings too would make the shared definition vaguer than the three call sites it serves, so
it stays as it is, deliberately. Both former copies are gone: `ListShoppingPage`'s local `sortByName` and
`ListFilters.tsx`'s inline menu comparator now go through `byName`.

Consumers: `ListFilters.tsx` imports `byName` directly; `ListShoppingPage.tsx` and `ListDetailPage.tsx` import
`groupItemsByCategory`, which sorts with it — so neither route names a comparator at all any more.

### Deviations from the Code Map

- **The matrix's duplicate-name row is IMPLEMENTED, and `byName` still has no tiebreak — the two facts are not in
  tension.** An earlier pass of this story recorded the row as unsatisfiable because the Code Map's
  `byName(a: {name: string}, b: {name: string})` carries no id. That was the wrong conclusion: the fix belongs to the
  function that owns the rendered SEQUENCE, not to the comparator. `groupItemsByCategory` now sorts categories, items
  and orphans with a module-private `byNameThenId` (`byName(a, b) || a.id.localeCompare(b.id)`), and the item
  generic's constraint gained `id: string` — both call sites already pass types carrying it, so no call site changed.
  `byName` is unchanged and stays exported for `ListFilters`, whose menu wants alphabetical order and nothing more;
  the tiebreak is deliberately NOT in the filter. `Array.prototype.sort`'s stability was not enough on its own,
  because it preserves input order and the input is the backend's map order, which this story measured to be
  unstable. Asserted in `bp_front/e2e/order.spec.ts` (categories, items, and the synthetic bucket, which is built on
  a path of its own and could otherwise have missed the tiebreak). AC3's grep expectation still holds in substance —
  `order.ts:86` is a third hit in that file, and it is the tiebreak the matrix row asks for, in the same shape as
  `byCreatedAtAsc`'s.
- **A file the Code Map does not list: `bp_front/e2e/order.spec.ts`.** The Code Map homes both FR62 specs in
  `lists.spec.ts`, and both browser specs went there. The duplicate-name row needed a third home: its subject is
  unobservable through the UI, because `category-row-<name>` and `item-row-<name>` are name-keyed and two same-named
  rows trip Playwright strict mode before any sequence can be read — and re-keying those testids is an OPEN ledger
  item this epic rules out of scope. So it is asserted against the exported function with no `page` fixture. It sits
  in `e2e/` and is untagged, so it runs inside the existing gate on both viewport projects (no new runner, no new
  config) and costs no browser.
- **The `groups.map` callback lost its statement body.** The Code Map's replacement deletes the inline
  `items.filter(...)` that was the only reason for the `{ … return ( … ) }` form, so the callback is now a plain
  expression arrow. Pure shape; the JSX inside is unchanged.

### I/O matrix coverage

Every row of the matrix has a test that ran and passed. Where it lives:

| Matrix row | Covered by |
|---|---|
| Ordinary list, no filter | `lists.spec.ts` — `FR62 — categories and items read in the SAME by-name order…` |
| Orphan present | `lists.spec.ts` — `FR62 — an item orphaned by a category removal…` (both surfaces) |
| No orphans | same spec's closing assertions, after the second orphan is deleted |
| Management, empty category, no filter | `lists.spec.ts` — `FR61 — an EMPTY category is kept…` (pre-existing, unmodified) |
| Management, empty category, filter active | same FR61 spec, branches 2a and 2b |
| Shopping, empty category | same FR61 spec, closing assertion |
| Management, search matches only an orphan | orphan spec — search block |
| Management, a real category selected, orphan present | orphan spec — the tripwire block |
| Only orphans, zero categories | orphan spec — the last real category is removed |
| Genuinely empty list | `lists.spec.ts` — `FR50 — a brand-new user sees the lists zero-state…` and the golden path |
| Two categories with the same name | `order.spec.ts` — all three tests |

**Two of these could not be observed red, and the exemption is recorded here rather than claimed as a red** (the
precedent is Stories 8.3 and 8.4):

- *"A real category selected, orphan present"* is a tripwire for a NO decision — it asserts that no
  `Uncategorized` filter option exists. Pre-fix the management screen never rendered orphans at all, so the assertion
  was vacuously true; it is red only against a hypothetical future build that adds the option. That is what a
  tripwire is for, and it is why the block also clears the filter and asserts the bucket RETURNS — without that
  second half, a screen that had simply stopped rendering the bucket would satisfy it.
- *"Only orphans, zero categories"* would have been red pre-fix, but only for the same reason every orphan
  assertion was (no bucket existed); its own distinguishing claim — that `list-detail-empty` is not the branch taken
  — cannot be isolated on a build where the branch it replaces was the only one. It is asserted post-fix as the
  `groups.length` branch's guard.

`order.spec.ts` was observed red on its own terms, as recorded above.

### Two things worth knowing before changing this

- **`keepEmpty` is a product difference, not a parameter that wants defaulting.** `/list/:id` passes `false`
  unconditionally; `/lists/:id` passes `!filterActive`. Give it a default and the next caller silently picks one
  screen's behaviour for the other's surface — which is the drift FR62 closed.
- **The management screen's two empty branches key off `groups.length`, not `categories.length`.** A list whose only
  category was removed under a stale client has zero categories and live orphans; the old gate would have shown "No
  categories yet" over an item that is right there. `!filterActive` is what still separates onboarding copy from the
  no-matches notice, and the genuinely empty list still lands on `list-detail-empty` because it has no groups either.
- **The filter row's mount guard is `categories.length > 0 || items.length > 0 || filterActive`, and each clause
  earns its place.** `items.length > 0` covers the orphans-and-no-categories corner: without it, the one control that
  can reach those items (search) would not be rendered — asserted by the orphan spec, which removes every real
  category and then checks `list-detail-filters` and `filter-search` are still visible. `filterActive` is a
  DEAD-END guard added at review: the filter VALUE lives in `useItemFilter` state and outlives the content that
  justified the row, so typing a term and then removing the last category drops both counts to zero with the term
  still set — the row would unmount while `!filterActive` keeps the empty branch out of reach, stranding the page on
  `list-detail-no-matches` with nothing on screen able to clear it. The pre-8.5 gate could not reach that state.

### Verification results

| Command | Result |
|---|---|
| `npx playwright test --retries=0` | 195 passed, 19 skipped, 0 failed, 0 flaky |
| `npx playwright test --list \| … \| uniq -c` | 214 = 106 / 106 / 1 / 1 |
| `grep -rn "localeCompare" src/` | `order.ts` + `StoreField.tsx` only (above) |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (`tsc -b` + vite build + PWA worker) |
| `git diff --stat bp_back/` | empty |

## Auto Run Result

Status: done — FR62 delivered, seven review patches applied, six items deferred.

### What was implemented

One shared module, `bp_front/src/lib/lists/order.ts`, now owns how a list is ordered and grouped, and both list
surfaces render what it returns. Categories sort by name and items sort by name within their category on `/list/:id`
and `/lists/:id` alike (AC1, AC2); the name comparator has one definition and the shopping view's synthetic
`Uncategorized` bucket was lifted rather than reimplemented (AC3). `/lists/:id` gains that bucket, so an item
orphaned by a category removal is finally visible on the only screen that can edit or delete it, with its own edit
and remove controls and no category-level controls on the group (AC4). `keepEmpty` is the single parameter carrying
the one deliberate difference between the screens, so AC5's asymmetry survives unchanged. The orphan CAUSE is
recorded and not fixed (AC6). `byCreatedAtAsc` moved into the same module, discharging a standing ledger item that
named this story.

### Files changed

- `bp_front/src/lib/lists/order.ts` — NEW: `byName`, the private `byNameThenId` tiebreak, `byCreatedAtAsc` (moved),
  the `UNCATEGORIZED_*` constants, `ItemGroup` and `groupItemsByCategory`.
- `bp_front/src/lib/lists/homePath.ts` — comparator deleted, imported from `order.ts`; `useHomePath` untouched.
- `bp_front/src/routes/ListShoppingPage.tsx` — local `sortByName`, `Group` and `UNCATEGORIZED` deleted; groups come
  from the shared function with `keepEmpty: false`.
- `bp_front/src/routes/ListDetailPage.tsx` — `visibleCategories` replaced by `groups` with `keepEmpty: !filterActive`;
  filter mount guard widened; both empty branches re-keyed to `groups.length`; category-level controls conditional.
- `bp_front/src/components/ListFilters.tsx` — the menu's inline name sort replaced by `byName`.
- `bp_front/e2e/lists.spec.ts` — two FR62 specs (cross-surface ordering; the orphan bucket and both recoveries).
- `bp_front/e2e/order.spec.ts` — NEW: three duplicate-name determinism cases against the exported function.
- `bp_front/playwright.config.ts` — dated collection row.
- `_bmad-output/implementation-artifacts/deferred-work.md` — four ledger edits; `sprint-status.yaml` — `8-5-…: done`.

### Review findings breakdown

Four layers reported 25 findings: 7 patched, 6 deferred, 2 refuted as false, 10 rejected. Full rows, verdicts and
evidence are in the Review Triage Log above.

**Patched (2 medium, 5 low):** the reachable filter dead end (mount guard gained `|| filterActive`); the vacuous
"`Uncategorized` is last" assertions (fixture gained a non-empty `Z Last …` category, `.last()`/`.at(-1)` became
full-sequence assertions); the overclaiming `ListFilters` comment; `known` Map → Set; the lost `group.category`
narrowing inside the handlers; a KEEP-IMPORT-FREE note recording the `tsconfig.e2e.json` constraint; and the orphan
fixture's unasserted staleness premise.

**Deferred (6, all low):** the orphan cause; an orphan's `EditItemDialog` closing silently on an untouched save; the
`createdAt` lint guard; a real category named `Uncategorized` colliding with the bucket; the missing unit-test
runner; and the bucket's absent explanatory copy.

**Rejected, with reasons:** `deferred-work.md`'s `order.ts:69` reference is correct, not stale (refuted by grep); two
categories cannot share an id (Apollo normalises by id, no producer shown); `order.spec.ts` omitting `keepEmpty` and
`byCreatedAtAsc` cases is redundant collection, both already covered end-to-end; two findings whose fix is to edit
this build's spec (AC3's grep enumeration, the Verification section's pre-tiebreak expectation); the workflow-managed
status metadata; AC7's literal orphan recipe, which provably produces no orphan; `order.spec.ts` asserting at the
module surface, which is the only surface where duplicate names are observable; and the files edited outside the
epic's `Files:` line, each required by NFR-E8-5 or AC4.

### Follow-up review recommended: true

Two `medium` entries were patched on a first pass. The specific unverified risk: the dead-end fix
(`|| filterActive`) keeps the filter row mounted in a state no assertion reaches — reaching it requires deleting the
last category while a term is held, which no spec does — so the guard's third clause is verified by reasoning and by
the surrounding suite staying green, not by a test that observes the state it was added for. Patched counts by
verdict: medium 2, low 5.

### Verification

Re-run independently after the patches, against a freshly rebuilt production image:

- `npx playwright test --retries=0` — **195 passed, 19 skipped, 0 failed** on `chromium` and `mobile`.
- `npx playwright test --list | …| uniq -c` — **106 / 106 / 1 / 1**, matching the `playwright.config.ts` row.
- `npm run lint` and `npm run build` — exit 0.
- `grep -rn "localeCompare" src/` — `order.ts` and `StoreField.tsx:37` only.
- `git diff --stat bp_back/` — empty.

Every row of the I/O & Edge-Case Matrix is covered by a test that ran and passed; two rows carry recorded red-first
exemptions rather than claimed reds, stated in the Implementation Notes.

### Residual risks

- The `|| filterActive` clause is unasserted (see above).
- `Uncategorized` remains a forgeable display name on both screens.
- The orphan fixture depends on `/lists/:id` staying refetch-driven; adding a subscription there would make it
  produce no orphan. The fixture now fails at its own precondition if that changes, rather than misreporting.
