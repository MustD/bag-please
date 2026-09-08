---
title: 'Story 8.4: One Filter and Search, on Both List Screens'
type: 'feature'
created: '2026-09-08'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: 'd5eb675495fb4035442e2d0c8614a01718bc2247'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['multiple-goals', 'oversized']
deferred:
  - summary: >-
      The synthetic `Uncategorized` bucket is outside the new filter on both screens: no menu option selects it, so
      any category selection hides orphaned items, and the management screen has no such group at all.
    evidence: |-
      Raised independently by two review layers. On `/list/:id` the bucket is built in `ListShoppingPage`'s `groups`
      memo from items whose category id has no local match, but `ListFilters` offers options only for real
      categories, so `matchesItemFilter`'s `categoryIds.includes(item.category)` clause can never be satisfied by an
      orphan — selecting any category hides them all, and a live category deletion that leaves orphans hides them
      behind the surviving selection. On `/lists/:id` there is no `Uncategorized` group, so a search term matching
      only an orphan now renders `list-detail-no-matches` rather than the item.
      Not fixed here by design: Story 8.5 AC4 delivers the `Uncategorized` group on the management screen (with edit
      and remove working from it), and this story's Boundaries explicitly exclude that surface. Whether the filter
      should also offer an `Uncategorized` option is the open question 8.5 should settle while it is in that code.
    location: >-
      bp_front/src/components/ListFilters.tsx and bp_front/src/routes/ListDetailPage.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** The shopping view's category filter selects exactly ONE category (`categoryFilter: string`,
predicate `item.category !== categoryFilter`), so the chilled aisle and the veg aisle cannot be worked together
(report #4). The management screen `/lists/:id` has no filter and no search at all (reports #5, #6), and the two
surfaces have already drifted apart once — report #7 *is* that drift.

**Approach:** Extract what Story 5.6 shipped on `ListShoppingPage` into ONE filter unit — a presentational component
plus a predicate/state module — widen the category selection from a single id to a set, and mount the same unit on
`ListDetailPage`. Client-side only, against the Apollo cache both screens already hold.

## Boundaries & Constraints

**Always:**
- **One definition, used twice (AC2, NFR-E8-5).** The filter UI, the filter predicate and the stale-selection prune
  each have exactly ONE definition in `src/`. A second copy is a review failure.
- Selecting no category means ALL categories, preserving today's empty default and its "All categories" affordance.
- The category control stays a MUI `Select` made `multiple`, with checkboxes in the menu and a summary in the closed
  control — **not** a chip row (`md`'s ruling, UX-DR-E8-4).
- Category filter AND search AND (on shopping only) checked-status are combined with AND.
- Search is case-insensitive, on the item name.
- Filtering is client-side and instant: no query, no `refetch`, no round trip, no loading state (NFR-E8-4).
- Stale-selection handling stays a **render-phase adjustment**, never a `useEffect` — project lint forbids
  set-state-in-effect (`eslint-plugin-react-hooks` 7.x flat recommended).
- Existing testids that shipped specs depend on are preserved: `filter-category`,
  `filter-category-option-all`, `filter-category-option-<name>`, `filter-search`, `filter-checked*`,
  `shopping-filters`, `shopping-no-matches`.
- Every new spec is observed FAILING before it is accepted (NFR-E8-6), runs on `chromium` and `mobile`, and is
  driven through the UI; test data is created via UI/API only, never by writing to MongoDB.

**Never:**
- No checked-status toggle on the management screen — the shared component accommodates its ABSENCE rather than
  rendering a disabled control (UX-DR-E8-7).
- No `subscribeToMore` on `ListDetailPage`: it stays refetch-driven by Story 6.1's design, and the shared component
  must not assume a subscription exists (AR-E8-6).
- No `Uncategorized` group on the management screen — that is Story 8.5 (AC4 there), not this story.
- No ordering changes on either screen — Story 8.5 owns the shared comparator. Leave `ListDetailPage`'s raw query
  order and `ListShoppingPage`'s local `sortByName` exactly as they are.
- No change under `bp_back/`; no schema change, no codegen run.
- No toasts, snackbars or banners.
- Not a redesign: dark theme, type scale and visual language unchanged.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No selection, no term | `categoryIds = []`, `search = ''` | Every item passes; on `/lists/:id` empty categories are shown with their "No items yet." row | No error expected |
| Two categories selected | `categoryIds = [dairy, produce]` | Items of BOTH categories pass; others are hidden | No error expected |
| Selection + term | `categoryIds = [dairy]`, `search = 'mil'` | Only dairy items whose name contains `mil` (case-insensitive) pass | No error expected |
| Whitespace-only term | `search = '   '` | Treated as no term — trimmed before compare; not a filter-active state | No error expected |
| Selected category deleted live | `categoryIds = [a, b]`, category `b` removed by `CategoryUpdates` | `b` is pruned; `a` SURVIVES — the whole filter is not reset | No error expected |
| Active list switched | `listId` changes in place (switcher chip) | Category selection, search and checked-status all reset | No error expected |
| Filter matches nothing | Term matches no item | `shopping-no-matches` / `list-detail-no-matches` panel; no items rendered | No error expected |
| Filter active on `/lists/:id`, category empty of matches | Any selection or term active | That category's card is NOT rendered | No error expected |

</intent-contract>

## Code Map

- `bp_front/src/lib/lists/itemFilter.ts` -- **NEW. The one definition of the predicate and the state.** Plain `.ts`
  (no JSX) so `react-refresh/only-export-components` — on for `src/` — stays satisfied while the module exports
  non-components. Contents: `ItemFilterValue` (`{categoryIds: readonly string[]; search: string}`),
  `matchesItemFilter(item, value)`, `isItemFilterActive(value)` (trimmed search or non-empty selection), and the
  `useItemFilter(listId, categories)` hook holding both render-phase adjustments (list-switch reset; prune EVERY
  selected id that no longer exists). Sits beside `homePath.ts`'s `byCreatedAtAsc`, the module that exists because of
  the previous instance of this defect class.
- `bp_front/src/components/ListFilters.tsx` -- **NEW. The one definition of the UI.** Presentational: no query, no
  mutation, no subscription. Props: `categories`, `value`, `onChange`, `testId`, and OPTIONAL
  `checkedFilter`/`onCheckedFilter` — omitted on the management screen, and the toggle is then not rendered at all.
  Owns the existing testids listed in Boundaries.
- `bp_front/src/routes/ListShoppingPage.tsx` -- **change.**
  - `:~350` `const [categoryFilter, setCategoryFilter] = useState('')` + `:~360` the list-switch reset block +
    `:~370` the single-id prune (`if (categoryFilter && !categories.some(...)) setCategoryFilter('')`) → all replaced
    by `useItemFilter`. `checkedFilter` state stays on the page (shopping-only).
  - `filteredItems` `useMemo` — its category/search clauses move to `matchesItemFilter`; the checked-status clause
    stays here and is AND-ed with it.
  - The `<Stack data-testid="shopping-filters">` block (category `FormControl`/`Select`, `ToggleButtonGroup`,
    search `TextField`) → replaced by `<ListFilters testId="shopping-filters" …/>`. Drop the now-unused
    `FormControl`/`InputLabel`/`MenuItem`/`Select`/`SelectChangeEvent`/`TextField`/`ToggleButton`/
    `ToggleButtonGroup` imports if nothing else uses them (`Stack`, `Chip`, `Typography` are still used).
  - `groups` `useMemo` — **read-only for this story** except that it keeps `.filter(group => group.items.length > 0)`
    (shopping hides empty groups ALWAYS). Story 8.5 rewrites this block next; do not pre-empt it.
  - `ShoppingItemRow` (`:60-240`) — **read-only.** Story 8.3's single-control row is untouched.
- `bp_front/src/routes/ListDetailPage.tsx` -- **change.** Mount `<ListFilters testId="list-detail-filters" …/>` +
  `useItemFilter` beneath the header `Box` (`:~100-140`). The `categories.map` block (`:~160`) gains: items filtered
  by `matchesItemFilter`, and a `filterActive` guard that drops categories with zero matching items. Add a
  `list-detail-no-matches` panel for "filter active, nothing matches", mirroring `shopping-no-matches`. The existing
  `list-detail-empty` ("No categories yet") branch stays for the genuinely empty list.
- `bp_front/e2e/shopping.spec.ts` -- **change.** `:55-105` `reframe 7.1` and `:129-165` `FR36` both drive
  `filter-category` and then `filter-category-option-…`; a `multiple` MUI Select does NOT close its menu on
  selection, so both need an explicit `Escape` (or backdrop click) before the next interaction. Home for the FR61
  shopping-side specs.
- `bp_front/e2e/lists.spec.ts` -- **change.** Home for the FR61 management-side specs (AC3, AC4 both branches).
- `bp_front/e2e/narrow-viewport.spec.ts` -- **change.** AC7's 320px case for the multi-select: open the menu at the
  floor and assert `expectNoHorizontalOverflow(page)` plus `expectInsideViewport` on the closed control and on the
  summary text. Follow the file's `test.skip(testInfo.project.name !== 'mobile', …)` guard idiom.
- `bp_front/e2e/support/ui.ts` -- **reuse, do not change.** `registerViaUi`, `openListsViaMenu`, `createListAndOpen`,
  `addCategory`, `addItem`, `PASSWORD`, `uniqueUsername`. Namespace prefixes are per-spec (`shopping`, `lists`,
  `narrow`).
- `bp_front/e2e/support/layout.ts` -- **reuse, do not change.** `expectNoHorizontalOverflow`, `expectInsideViewport`,
  `NARROW_FLOOR_PX`.
- `bp_front/playwright.config.ts` -- **change (comment only).** Append a dated collection row for this story to the
  count log, with the per-project skip count. Re-measure with
  `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` — never quote the 2026-09-07 figure.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- **change.** Two ledger items name this story: close the
  ``item-row-${item.name}`` uniqueness question with the decision (KEEP name-keyed testids — the epic's own contract
  says both surfaces key rows by name; re-keying by id is its own story), and re-route the `EditItemDialog.tsx`
  stale-comment item to Story 8.6 with the reason (8.4 does not modify that component).

## Tasks & Acceptance

**Execution:**
- `bp_front/e2e/shopping.spec.ts`, `bp_front/e2e/lists.spec.ts`, `bp_front/e2e/narrow-viewport.spec.ts` -- add the
  FR61 specs and run them FIRST, red, against the pre-fix build -- NFR-E8-6. Where a test cannot be red on its own
  terms (a control that does not exist yet errors for an unrelated reason), record that exemption in the spec's
  Implementation Notes the way Story 8.3 did, rather than claiming a red.
- `bp_front/src/lib/lists/itemFilter.ts` -- create the predicate, the active-check and the `useItemFilter` hook with
  both render-phase adjustments -- AC2, AC5.
- `bp_front/src/components/ListFilters.tsx` -- create the shared presentational control: multi-select category filter
  with menu checkboxes and a summary, optional checked-status toggle, search field -- AC1, AC2, AC3.
- `bp_front/src/routes/ListShoppingPage.tsx` -- consume both, deleting the local filter state, the two adjustment
  blocks and the inline filter markup -- AC1, AC2, AC5, AC6.
- `bp_front/src/routes/ListDetailPage.tsx` -- mount both, filter the rendered items, hide empty categories only while
  a filter or search is active, add `list-detail-no-matches` -- AC3, AC4, AC6.
- `bp_front/e2e/shopping.spec.ts` -- migrate `reframe 7.1` and `FR36` to close the now-persistent menu between
  interactions -- each site visited, not sed'd.
- `bp_front/playwright.config.ts` -- append the dated collection row with per-project skip counts -- AC7.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- close the testid-uniqueness item with the decision and
  re-route the `EditItemDialog` comment item to Story 8.6.
- spec Implementation Notes -- record the observed pre-fix reds, the post-fix greens, the measured collection counts,
  and the network evidence for AC6 -- AC7.

**Acceptance Criteria:**
- Given a list with a Dairy and a Produce category, when both are selected in the shopping view's category filter,
  then items from BOTH are visible and a third category's items are not; and the closed control summarises both
  chosen names rather than showing a chip row.
- Given the category filter with two categories selected, when the selection is cleared via the "All categories"
  affordance, then every item is visible again — the empty selection means all.
- Given `grep -rn` over `bp_front/src/`, when the story is complete, then the multi-select category filter markup,
  the search field markup, the name/category predicate and the stale-selection prune each appear in exactly ONE
  module, imported by both routes.
- Given `/lists/:id`, when it renders, then it offers the same multi-select category filter and the same
  case-insensitive name search, combined by AND, and NO checked-status toggle exists anywhere on the page.
- Given `/lists/:id` with an empty category present, when no filter and no search is active, then that category is
  rendered with its "No items yet." row and its add-item affordance; and when a category filter or a search term is
  active, then it is not rendered at all.
- Given `/list/:id`, when no filter is active, then an empty category is still hidden — the shopping view's
  always-hide behaviour is unchanged, and both branches are asserted because this is where the two surfaces
  deliberately differ.
- Given two categories selected on the shopping view, when a second member deletes ONE of them live, then that id is
  dropped from the selection and the OTHER selection survives — the filter is not reset.
- Given the shopping view with a filter applied to list A, when the switcher chip moves to list B, then the category
  selection, the search term and the checked-status toggle are all reset and B's items are visible.
- Given either screen with GraphQL traffic under observation, when a category is selected or a search term typed,
  then zero GraphQL requests are issued and no loading indicator appears.
- Given the `mobile` project at 320px, when the category menu is opened with several categories present, then the
  page does not scroll horizontally and the closed control and its summary stay inside the viewport.
- Given the completed story, when the suite runs on `chromium` and `mobile` against the production image, then it is
  green, `npm run lint` and `npm run build` pass, and `git diff --stat bp_back/` is empty.

## Spec Change Log

## Review Triage Log

### 2026-09-08 — Review pass

Four layers (blind-hunter, edge-case-hunter, verification-gap, intent-alignment) against the diff since
`d5eb675`. Duplicate claims from different layers keep their own rows and share a route.

- verdicts: 34 findings — high 0, medium 3, low 29, false 2, maybe-false 0
- findings:
  - `[low]` `[reject]` blind-hunter: the stale-selection prune cannot tell "category deleted" from "categories not loaded yet", so a transient empty `categories` wipes the whole selection — Apollo retains `data` across a `refetch` (`useQuery.cjs:136`), and the initial load has an empty selection, so the only real trigger is a query error, where both screens already render an error surface instead of the list; the fix adds a guard for a state whose loss is immaterial.
  - `[low]` `[patch]` blind-hunter: `renderValue` maps the raw `categories` prop while the menu maps `sorted`, so the closed summary and the menu list the same names in different sequences — fixed: the summary is built from `sorted`.
  - `[medium]` `[patch]` blind-hunter: `withCategoryMenu` is defined character-identically in `lists.spec.ts` and `shopping.spec.ts` and open-coded a third time in `narrow-viewport.spec.ts`, all three encoding the same load-bearing fact (the `multiple` menu no longer self-closes) — the next change to menu dismissal would have to be made in three places; fixed: one definition in `e2e/support/ui.ts`, imported by all three.
  - `[medium]` `[patch]` blind-hunter: `countGraphqlRequests` is defined in `shopping.spec.ts` and re-implemented inline with a different shape in `lists.spec.ts` — one AC6 counter, two implementations, across the two screens this story exists to unify; fixed: moved to `e2e/support/ui.ts` (same root cause as the row above).
  - `[low]` `[defer]` blind-hunter: the synthetic `Uncategorized` bucket is unreachable through the new filter — selecting any category always hides orphaned items, and no menu option selects them — deferred: the `Uncategorized` surface is Story 8.5's AC4 and this story's Never list excludes it.
  - `[low]` `[reject]` blind-hunter: the prune is asserted only on the shopping screen, though categories are deleted on the management screen — the pruning unit is shared and already covered; a second test would duplicate coverage of one hook for a different upstream trigger.
  - `[low]` `[patch]` blind-hunter: the management filter row is gated on `!loading`, and `notifyOnNetworkStatusChange` defaults to TRUE in Apollo Client 4 (`QueryManager.cjs:321`), so every post-mutation `refetch()` unmounted the row mid-interaction — fixed: `!loading` dropped from the gate.
  - `[low]` `[reject]` blind-hunter: `ListDetailPage` evaluates `matchesItemFilter` O(categories x items) times per render with no memoization — real but negligible at this data scale, and the fix adds a memo plus a grouping structure rather than being a direct correction.
  - `[low]` `[reject]` blind-hunter: the `Checkbox` inside each `MenuItem` is an interactive control inside `role="option"`, and the "All categories" row shows checked while announcing `aria-selected="false"` — this is MUI's documented multi-select pattern, focus inside an open menu is list-managed, and the fix adds ARIA props for a defect not shown to be met.
  - `[low]` `[reject]` blind-hunter: the search field has no clear affordance, so at the 320px floor the only reset is select-all-and-delete — a feature the intent does not ask for; the fix adds public surface.
  - `[low]` `[patch]` blind-hunter: the new ledger entries drop the `source_spec:` field every sibling entry uses, making both invisible to the grep the file is addressed by — fixed: `source_spec:` restored on both, with an explicit `status:` line.
  - `[low]` `[patch]` blind-hunter: `CheckedFilter` is exported from the `.tsx` component module, contradicting `itemFilter.ts`'s own stated rule (it passes lint only because type-only exports are exempt from `react-refresh/only-export-components`) — fixed: moved to `itemFilter.ts`, both importers updated.
  - `[low]` `[reject]` blind-hunter: two fixed `waitForTimeout(1000)` sleeps bracket each AC6 counter — the failure mode is a false RED, not a false green, and the proposed `networkidle` replacement never settles on a page holding an open `graphql-ws` connection.
  - `[low]` `[patch]` intent-alignment: AC6's "no `subscribeToMore` on the management screen" is discharged by construction — a subscription rides `graphql-ws` and registers zero POSTs, so the HTTP counter is silent on exactly what the AC forbids; fixed: `countWebSockets` asserted 0 on `/lists/:id`.
  - `[low]` `[reject]` intent-alignment: AC2/AC5's structural clauses ("one definition", "render-phase, not an effect") have no test surface — `bp_front` has no unit tier, so grep and lint are the only instruments; adding a test tier is out of this story's intent.
  - `[low]` `[patch]` intent-alignment: AC1 names "checkboxes in the menu" but only the closed control is asserted — replacing each `Checkbox` with a text label kept the suite green; fixed: the multi-select test asserts a chosen option's checkbox is checked and an unchosen one is not.
  - `[medium]` `[patch]` intent-alignment: AC2's one-definition rule is honoured in `src/` and inverted one layer down in `e2e/`, where the drift class the story exists to remove has fresh instances — fixed with the two rows above (same root cause).
  - `[false]` `[reject]` intent-alignment: AC7's "manually exercised first and observed failing before acceptance" leaves no artifact in the diff — it does: the pre-fix reds, their per-spec failure text and the two documented NFR-E8-6 exemptions are recorded in the spec's Implementation Notes.
  - `[low]` `[reject]` intent-alignment: `ListDetailPage` renders no filter row when the list has zero categories, which AC3's "when it renders, then it offers" does not contemplate and no test pins — the behaviour is deliberate (a filter over nothing on the onboarding screen) and recorded under Deviations; pinning it adds a test for a state the intent does not speak to.
  - `[low]` `[patch]` intent-alignment: the change edits the planning ledger that records what this change owes, declining two items previously routed to this story by name — fixed together with the edge-case row below: the `EditItemDialog` item is now unrouted rather than aimed at a story that would decline it too.
  - `[false]` `[reject]` intent-alignment: the spec file is absent from the reviewed diff — deliberate; it is the claims file, handed to the edge-case layer alone by path so the other layers never see the change's own account of itself.
  - `[low]` `[reject]` edge-case: `checkedFilter` passed without `onCheckedFilter` renders a dead toggle — both call sites are correct, and the fix (a discriminated-union prop type) adds type complexity for a caller mistake not shown to be reachable.
  - `[low]` `[reject]` edge-case: the prune wipes the selection when `categories` is empty from a loading/skipped/errored query — same claim as the blind-hunter row above, rejected on the same refutation.
  - `[low]` `[defer]` edge-case: an orphaned item is unreachable while a surviving selection stays active after a live category deletion — deferred with the `Uncategorized` group below; Story 8.5 owns that surface.
  - `[low]` `[reject]` edge-case: adding an item while a filter is active produces nothing visible — the user's own term is in the search field above the list and the `list-detail-no-matches` panel names the cause, and the fix (auto-clearing the filter, or a new hint) adds behaviour the intent does not ask for.
  - `[low]` `[defer]` edge-case: the management screen has no `Uncategorized` group, so a search matching only an orphan reports "No items match" — deferred: Story 8.5 AC4 delivers that group, and this story's Never list excludes it.
  - `[low]` `[patch]` edge-case: `renderValue` joins prop order while the menu lists `localeCompare` order — same finding as the blind-hunter row above; fixed once.
  - `[low]` `[patch]` edge-case: the `testId` comment claims `shopping-filters` is "a testid two shipped specs already depend on", but the name appears in no spec — fixed: the comment now says the name is kept for continuity and nothing asserts it.
  - `[low]` `[patch]` edge-case: the re-route of the `EditItemDialog` comment item to Story 8.6 is unsupported — 8.6's `Files:` line (`epics.md:2058`) lists only a new rename dialog and `ListDetailPage.tsx`, and its `Reuses:` line mirrors rather than edits that component, so 8.6 would decline on the same grounds; fixed: the item is now unrouted, awaiting the first story that actually edits the file.
  - `[low]` `[reject]` edge-case: `/lists/:id`'s filter row is narrower than AC3's "when it renders" because of the render gate — same claim as the intent-alignment row above, rejected on the same reasoning.
  - `[low]` `[patch]` verification-gap: `isItemFilterActive`'s `.trim()` branch is unexercised — the whitespace term is only ever typed while a category is already selected, so dropping `.trim()` keeps every test green while one stray space would hide every empty category and its add-item button; fixed: the empty-category test types `'   '` at idle and asserts the card and its button survive.
  - `[low]` `[patch]` verification-gap: `getByRole('button', {name: /checked status/i})` can never fail — the label sits on the `ToggleButtonGroup`, which MUI renders as `role="group"`, while the buttons are named "All"/"To buy"/"Done"; fixed: the guard queries `role: 'group'`, verified falsifiable by matching 1 on `/list/:id`.
  - `[low]` `[patch]` verification-gap: the `shopping-filters` comment claim is untrue and the testid is asserted nowhere — same finding as the edge-case row above; fixed once.
  - `[low]` `[reject]` verification-gap: no spec covers adding an item under an active filter — same claim as the edge-case row above, rejected on the same reasoning.

## Design Notes

**Why the "All categories" item stays a `MenuItem` with `value=""`.** Two shipped specs click
`filter-category-option-all`, and AC1 requires the affordance survive. In a `multiple` Select MUI hands the change
handler an ARRAY, so the sentinel arrives inside it; normalise on the way in:

    const next = event.target.value as string[]
    onChange({...value, categoryIds: next.includes('') ? [] : next})

**Label and summary with an empty selection.** A `multiple` Select with `value={[]}` renders nothing, so the floating
`InputLabel` will not shrink and would sit on top of the "All categories" summary. Set `displayEmpty` on the Select
and `shrink` on the `InputLabel`, and drive the closed control through `renderValue`:

    renderValue={ids => ids.length === 0
      ? 'All categories'
      : categories.filter(c => ids.includes(c.id)).map(c => c.name).join(', ')}

**Prune as a set, in the shared unit** — the generalisation AC5 asks for, still render-phase:

    if (value.categoryIds.some(id => !categories.some(c => c.id === id))) {
      setValue(v => ({...v, categoryIds: v.categoryIds.filter(id => categories.some(c => c.id === id))}))
    }

The `some(...)` guard is what keeps this from looping: an unconditional `setValue` on every render would re-render
forever. Same shape as the list-switch reset already on the page (`prevListId` sentinel).

**`isItemFilterActive` is what AC4 branches on**, and it deliberately ignores the checked-status toggle: that toggle
does not exist on the management screen, and on the shopping screen empty groups are hidden regardless.

**The menu no longer self-closes.** A single Select closes on selection; `multiple` does not. That is the intended
behaviour (pick several without reopening) and it is why the two existing shopping specs need an explicit dismissal
— treat any spec that "just worked" after the change as suspect and re-read it.

## Verification

**Commands:**
- `cd bp_front && npx playwright test --retries=0` -- expected: green, no new skips beyond the mobile-only ones.
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` -- expected: exactly one
  test in each `registration-toggle-*` project, `chromium` and `mobile` equal.
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0.
- `git diff --stat bp_back/` -- expected: empty.

**Manual checks:**
- `/list/:id` and `/lists/:id` on desktop and at 320px: select two categories, confirm both aisles show; type a term
  and confirm the empty-category behaviour differs between the two screens exactly as AC4 states; with the network
  panel open, confirm no request fires while filtering.

## Implementation Notes

### The pre-fix reds (NFR-E8-6)

All six new specs plus the two migrated ones were written and run FIRST, against the running production image built
from the baseline `d5eb675` (`docker compose ps` confirmed a 7-hour-old `bp_front` container; Playwright's
`reuseExistingServer` leaves it alone locally). Command:

    cd bp_front && npx playwright test --retries=0 --reporter=line \
      -g "FR61|the category filter and its open menu stay inside the floor|reframe 7.1|FR36"

Result: **11 failed, 1 skipped, 4 passed** (8 specs x 2 viewport projects, minus the mobile-only floor case which
skips on `chromium`). Every failure was on the behaviour under test:

| Spec | Pre-fix failure |
|------|-----------------|
| shopping: SEVERAL categories at once | `expect(shopping-item-<bread>).toBeVisible()` — *element(s) not found*. The single Select closes on the first selection, so the second click landed on the backdrop and only Produce was ever selected: report #4, exactly. |
| shopping: live delete prunes one id | same red, at the same step, before the setup mutations are reached |
| shopping: FR36 switcher resets filters | `expect(filter-category).toContainText('All categories')` — *Received: "​Category"*. The pre-fix control renders nothing for an empty value, so there was no "all" summary and no search/checked reset to assert against. |
| lists: same filter, AND-ed, no checked toggle | `expect(list-detail-filters).toBeVisible()` — *element(s) not found*: reports #5/#6, the screen had no filter at all |
| lists: empty category kept / dropped / never on shopping | `locator.click` on `filter-category` timed out at 30s — the control does not exist on `/lists/:id` |
| narrow-viewport: filter at the 320px floor | same, via `expectInsideViewport` on a control that does not exist |

**Two exemptions, recorded rather than claimed as reds** (the practice Story 8.3 established):

* **`FR61 — filtering issues ZERO GraphQL requests and shows no loading state` passed pre-fix (2/2).** AC6 is
  PRESERVED behaviour: Story 5.6 already filtered client-side over the Apollo cache. It is a GUARD, labelled as one
  in the file. It earns its place because widening the filter to a set and sharing it across two screens is exactly
  the change that invites a `refetch` "to be safe", and nothing else in the suite counts requests during filtering.
* **`reframe 7.1` passed both before and after the migration (2/2 each).** That is the intended result of a
  behaviour-preserving migration: pre-fix the single menu self-closes, so `withCategoryMenu`'s explicit `Escape`
  is a no-op and its post-condition (`filter-category-option-all` count 0) already holds. Post-fix the same lines
  are load-bearing. `FR36` in the same file did NOT pass pre-fix, because its migration also added the
  three-control reset assertions AC gates.

### The post-fix greens

Image rebuilt (`docker compose up -d --build bp_front`), same command: **15 passed, 1 skipped, 0 failed.**

One defect was found in the new spec itself and fixed at this point, not in the app: the setup mutations in the
prune test were written as `deleteItem(...)` / `deleteCategory(...)` with no subselection, and the backend
answered *"Validation error (SubselectionRequired@[deleteItem]): Subselection required for type 'Item!'"*. Both now
request `{ id }`. The red recorded above for that spec is unaffected — it fires at the multi-select step, several
lines before the setup call.

### Full-suite verification, and the eight failures that are NOT this story

    cd bp_front && npx playwright test --retries=0

**177 passed, 19 skipped, 8 failed, 2 did not run.** The eight are `admin.spec.ts` FR13/FR14, FR16/FR17, FR15/FR17
and FR30/FR31, in both viewport projects. They are **pre-existing and independent of this story**, verified rather
than assumed: the working tree was stashed (`git stash -u`), the frontend image rebuilt from the clean baseline, and
the full suite re-run — **the same eight failed there**, alongside two additional realtime flakes (FR52, the
ONE_TIME subscription) that the post-fix run did not have. They are the OPEN `AdminUsers is unpaginated` ledger item
(Epic 7 action `D4`) coming due: the users table grows ~120 rows per full run and the create-user dialog assertion
times out against it. Reducing the worker count to 6 did not help (still 8 failed), which rules out contention and
points at the row count, exactly as that entry predicts.

The `2 did not run` are the two `registration-toggle-*` projects — the documented consequence of a red dependency
project, not a silent skip (see `playwright.config.ts`). Run on their own they pass:

    npx playwright test --retries=0 --no-deps \
      --project=registration-toggle-chromium --project=registration-toggle-mobile   # 2 passed

Every FR61 spec, and every previously shipped spec this story touched, is green.

### Measured collection counts

    npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c

**204 = 101 chromium / 101 mobile / 1 / 1**, against Story 8.3's 192 = 95/95/1/1 — +6 untagged tests at +2 runs
each = +12, and 6 x 2 = 12 checks out. Per-project skips, read from a `--reporter=json` run rather than the
line reporter's single total: **18 chromium, 1 mobile** (plus the two toggle projects' "did not run"). The chromium
figure is 8.3's 17 plus this story's mobile-only floor case; the mobile figure is unchanged (the
above-the-breakpoint header test).

### AC3 — one definition each, by grep

    grep -rn "filter-category\|renderValue" bp_front/src/   -> ListFilters.tsx only (5 hits, one module)
    grep -rn "filter-search" bp_front/src/                   -> ListFilters.tsx:145 only
    grep -rn "toLowerCase().includes" bp_front/src/          -> itemFilter.ts:42 only
    grep -rn "categoryIds.filter\|categories.some" bp_front/src/ -> itemFilter.ts:90,93 only

Both routes import them: `ListShoppingPage.tsx` takes `matchesItemFilter` + `useItemFilter` + `ListFilters`;
`ListDetailPage.tsx` takes those plus `isItemFilterActive`. The shopping page's `filteredItems` `useMemo` lost its
category and search clauses to the shared predicate and kept only the checked-status ones; its two render-phase
adjustment blocks and its inline filter markup are gone.

### AC6 — the network evidence

Counted with `page.on('request')` filtered to `POST /api/graphql` — EVERY operation, not a named one, so a refetch
under any name is caught — attached only after a 1000 ms settle so the page's own load is not measured, and read
after a further 1000 ms so a late request cannot land behind the read.

| Screen | Interactions under observation | POST /api/graphql | WebSockets opened |
|--------|-------------------------------|-------------------|-------------------|
| `/list/:id` | open menu, select a category, dismiss, type `ban`, type `zzz-no-match` | **0** | not counted — this screen HAS a subscription by design |
| `/lists/:id` | select two categories, four search terms, clear both | **0** | **0** |

The WebSocket column is AR-E8-6, and it is why the POST count alone is not enough: a `subscribeToMore` slipping onto
the management screen (or into the shared component) rides `graphql-ws` and registers **zero** POSTs, so the request
counter is blind to exactly the regression the rule exists to prevent.

No loading state appeared on either screen (`shopping-loading` / `list-detail-loading` asserted `toHaveCount(0)`).

### Two things worth knowing before changing this

**The checked-status toggle is reset by a callback, not a second sentinel.** `useItemFilter` owns the only
`prevListId` render-phase adjustment, and takes an optional `onListChange` the shopping page uses to reset its own
`checkedFilter`. A second `prevListId` on the page would have been a second definition of "the list switched" — the
exact duplication NFR-E8-5 is about. The callback runs inside the hook, i.e. during the render of the component that
called it, so the `setState` in it is the same legal render-phase update as the hook's own.

**On a list switch both adjustments fire in one render, and the order is safe.** `setValue(EMPTY_ITEM_FILTER)`
queues first; the prune's functional updater then receives that empty value and filters `[]` to `[]`, preserving the
reset rather than reinstating the old ids. The prune's `some(...)` guard is what stops either from looping.

### Deviations from the Code Map

**`ListFilters` is mounted on `/lists/:id` only when the list has at least one category** (`!error &&
categories.length > 0`). The Code Map says "beneath the header `Box`" and does not discuss the zero-state; offering
a category filter with no categories to filter and a search over no items would have put a dead control on the
onboarding screen the FR34 golden-path spec asserts (`list-detail-empty`, "Add a category first"). The genuinely
empty list keeps that branch untouched. Once a category exists the filters are always present, including while a
filter hides everything — which is what makes `list-detail-no-matches` recoverable.

**No change under `bp_back/`:** `git diff --stat bp_back/` is empty. No schema change and no codegen run;
`npm run lint` and `npm run build` (`tsc -b && vite build`) both exit 0.

## Auto Run Result

Status: done

### What was implemented

The shopping view's category filter — a single `string` whose predicate was `item.category !== categoryFilter` — is
now a SET, and the filter unit it lived inside is one definition used by both list surfaces. `ListFilters.tsx` holds
the UI (a `multiple` MUI `Select` with menu checkboxes and a text summary in the closed control, an optional
checked-status toggle, a search field); `itemFilter.ts` holds the value type, the AND-ed predicate, the
filter-active check, and the `useItemFilter` hook carrying both render-phase adjustments — the list-switch reset and
the generalised prune that drops every selected id that no longer exists while KEEPING the rest. `/lists/:id`, which
had no filter or search of any kind, mounts the same unit with no checked-status props, and hides a category with
zero matching items only while a filter or a term is active — the deliberate asymmetry against the shopping view,
which hides empty groups always. Reports #4, #5 and #6.

### Files changed

- `bp_front/src/lib/lists/itemFilter.ts` — NEW. The one definition of the filter value, predicate, active-check and
  state hook; plain `.ts` so `react-refresh/only-export-components` stays satisfied.
- `bp_front/src/components/ListFilters.tsx` — NEW. The one definition of the filter UI; strictly presentational, so
  the refetch-driven management screen can mount it without a subscription.
- `bp_front/src/routes/ListShoppingPage.tsx` — inline filter markup, both adjustment blocks and the single-id state
  deleted; consumes the shared unit, AND-ing its shopping-only checked clause on top.
- `bp_front/src/routes/ListDetailPage.tsx` — mounts the shared unit, filters items through the shared predicate,
  hides zero-match categories only while filtering, adds `list-detail-no-matches`.
- `bp_front/e2e/support/ui.ts` — one definition each of `withCategoryMenu`, `countGraphqlRequests` and
  `countWebSockets`.
- `bp_front/e2e/lists.spec.ts` — two FR61 management-side specs (AND-ed filter + absent checked toggle; the
  empty-category asymmetry from both sides).
- `bp_front/e2e/shopping.spec.ts` — three FR61 shopping-side specs; `reframe 7.1` and `FR36` migrated for the now
  persistent menu, `FR36` extended to assert all three controls reset.
- `bp_front/e2e/narrow-viewport.spec.ts` — the multi-select at the 320px floor, closed and open.
- `bp_front/playwright.config.ts` — dated collection row with per-project skip counts.
- `_bmad-output/implementation-artifacts/deferred-work.md` — the `item-row-<name>` testid question decided (keep
  name-keyed) and the non-uniqueness re-filed OPEN; the `EditItemDialog` comment item unrouted.

### Review findings

Four layers reported 34 findings: high 0, medium 3, low 29, false 2, maybe-false 0. Full rows in the Review Triage
Log above.

**Patched — 10 entries** (1 medium, 9 low): the summary/menu ordering split; two comments that asserted things that
were not true (`shopping-filters` dependency, the Story 8.6 re-route); `CheckedFilter`'s module placement; the
`!loading` gate that unmounted the management filter row on every refetch; the triplicated `withCategoryMenu` and
duplicated request counter; a guard that could never fail (`role: 'button'` for a label on a `role: 'group'`); the
unexercised `.trim()` branch; AC6's no-subscription clause, unobservable to an HTTP-only counter; AC1's menu
checkboxes, unasserted; and the ledger entries' `source_spec:` field.

**Deferred — 1 entry** (3 findings): the `Uncategorized` bucket is outside the filter on both screens. Story 8.5 AC4
owns that surface and this story's Boundaries exclude it. Recorded in frontmatter `deferred`.

**Rejected, with reasons:** the transient-`categories` prune, twice (Apollo retains `data` across a refetch; the only
trigger is a query error, where both screens already render an error surface); duplicate prune coverage on the second
screen (one shared hook, already covered); unmemoized double filtering (negligible at this data scale; the fix is not
a direct correction); the nested-checkbox ARIA nit (MUI's documented pattern, focus is list-managed inside an open
menu); the missing search-clear affordance (not in the intent; adds public surface); the two fixed `waitForTimeout`s
(the failure mode is a false RED, and `networkidle` never settles against this app's open `graphql-ws` connection);
`checkedFilter` without `onCheckedFilter` (both call sites correct; the fix adds type complexity for an unreachable
caller mistake); add-under-active-filter, twice (the user's own term is visible in the field above the list, and the
fix adds unrequested behaviour); the zero-category render gate, twice (deliberate and recorded under Deviations);
and AC2/AC5's structural clauses having no test surface (this repo has no unit tier; adding one is out of intent).
**False, 2:** AC7's process clauses do leave an artifact (the pre-fix reds and both NFR-E8-6 exemptions are in
Implementation Notes), and the spec's absence from the reviewed diff is deliberate — it is the claims file.

### Follow-up review recommended: false

One medium entry patched (the e2e helper duplication, whose three findings share a root cause) and no high entries,
so the first-pass rule is not met. Patched counts by verdict: high 0, medium 1, low 9.

### Verification

Re-run by the parent after the patches, against a rebuilt production image on :2080:

- `npx playwright test --retries=0 --workers=2` — **204 tests: 185 passed, 19 skipped, 0 failed.** Green end to end,
  including `admin.spec.ts` and both `registration-toggle-*` projects.
- `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` — **204 = 101 / 101 / 1 / 1**, matching
  the config's new row.
- `npm run lint` — exit 0. `npm run build` (`tsc -b && vite build`) — exit 0.
- `git diff --stat bp_back/` — empty.

**A correction to the pre-patch record.** The implementation pass reported 8 `admin.spec.ts` failures as pre-existing
and load-driven, and the parent's own 12-worker run reproduced them plus an FR52 realtime flake. At `--workers=2`
the whole suite is green, and `admin.spec.ts` alone passes in 12-18s per test at 12 workers. So the diagnosis holds —
those tests are load-sensitive, not broken by this story — but the stronger claim that the suite cannot be green
was wrong: it is green at a worker count this machine can sustain. The underlying `AdminUsers is unpaginated` ledger
item (Epic 7 action `D4`) stays OPEN and is the reason the margin is thin.

### Residual risks

- **The admin panel's headroom is the suite's real constraint.** Those four tests pass with seconds to spare at high
  concurrency and the users table grows every run, so the next story to add tests may see them go red for reasons
  that have nothing to do with it. `D4` is the fix.
- **`renderValue` summarises without truncating logic of its own** — it relies on MUI's `.MuiSelect-select` overflow
  rules. Asserted inside the viewport at 320px with two over-length category names selected; a selection of many
  long names is bounded by the same CSS but was not measured.
- **The `Uncategorized` interaction is deferred, not absent** — a user who filters after a member deletes a
  non-empty category will not see the orphaned items. Story 8.5 is the next story in that code.
