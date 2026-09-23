---
title: 'Story 9.11: An item can be added from the shopping screen'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_revision: 'f4c43131766f118c370f4bb95a47f823251f821e'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Adding an item while shopping means leaving `/list/:id` for the management screen `/lists/:id` — the
shopping view is "read + check only" (EXPERIENCE.md §4).

**Approach:** Add a fixed bottom-right MUI `Fab` ("Add item", test id `shopping-add-item-fab`) to
`ListShoppingPage` that opens the EXISTING `AddItemDialog` with the page's `listId` and live `categories`. Teach
`AddItemDialog` a no-categories branch (guidance + link to `/lists/:id`, no form), reserve bottom padding so the FAB
never covers the last row, revise the shopping empty-state copy, and record the md ruling (UX-DR-E9-8) in
`EXPERIENCE.md` §4 / §5.3.

## Boundaries & Constraints

**Always:**
- One add dialog (AR-E9-10 / AD-10): the FAB opens `components/AddItemDialog.tsx`; no second form, no list picker —
  `listId` is the route's id.
- `AddItemDialog` owns the no-categories guidance (UX-DR-E9-9): when `categories.length === 0` it renders a
  message that a category is needed first plus a link to `/lists/<listId>` — NO `<form>`, no name/category/store
  inputs, no submit button. Cancel closes it.
- The new item shows on the adder's shopping view without a reload and without the page flipping to its loading
  branch; other members get it through the existing item subscription (FR52) — no backend change.
- FAB: `aria-label="Add item"`, `AddIcon`, `color="primary"`, `position: fixed`, bottom/right offset of
  `theme.spacing(2)` plus `env(safe-area-inset-bottom|right)`; it is a native button (keyboard reachable) and sits
  after the page content in DOM order. Rendered only once the items+categories queries have data (not while loading,
  not on query error), so a not-yet-loaded category list can never be mistaken for "no categories".
- Page reserves bottom padding ≥ FAB height (56px) + its offset + the safe-area inset, so the last row scrolls fully
  clear of the FAB.
- Empty state (`shopping-empty`, items.length === 0): with ≥1 category the hint points at the Add item button;
  with 0 categories it keeps the current list-management copy ("Add categories and items from the list management
  screen.").
- `EXPERIENCE.md` (§4 table + RULING note, §5.3 always-present list, empty-state rows, a short "adding" subsection)
  is corrected in the same commit; `DESIGN.md` gets a one-line mention of the FAB as the only fixed-position surface
  besides the app bar, and any §13 check count this change moves is re-measured.
- New E2E tests are observed RED before the implementation lands (AGENTS.md pitfall).

**Never:**
- No edit/delete of items or categories on the shopping view (still management-only per the ruling).
- No toast/snackbar; no new palette/theme override; no `disabled` form for the no-categories case.
- Do not change row check-off, filters, list switcher, or the realtime merge semantics.
- No backend, schema, or codegen change (the category-validation guard on create already shipped in 9.3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add from shopping | list with categories; FAB → name + category + 2 stores → Add | dialog closes; `shopping-item-<name>` row appears with both store chips; no reload | No error expected |
| Co-member watching | second member on same `/list/:id` | row appears live via subscription | No error expected |
| No categories | list with 0 categories; FAB | dialog shows guidance + `add-item-manage-list` link; no `add-item-name`/`add-item-submit`; link navigates to `/lists/<id>` | No error expected |
| Category removed mid-dialog | co-member deletes chosen category before save | save rejected with the mapped copy in `add-item-error` (existing 9.3 path); dialog stays open | existing `itemSaveErrorMessage` |
| Own echo + cache write | subscription SAVED echo and local cache write for the same id | exactly one row (upsert by id) | No error expected |

</intent-contract>

## Code Map

- `bp_front/src/components/AddItemDialog.tsx` -- change `onAdded` to `(item: ListItem) => void | Promise<unknown>`
  and pass `result.data.saveItem` (SaveItemMutation spreads `ListItemFields`, so it IS a `ListItem`); guard for a
  missing `data`. Add the `categories.length === 0` branch inside the same `<Dialog data-testid="add-item-dialog">`:
  `DialogTitle` "Add item", text (test id `add-item-no-categories`) e.g. "This list has no categories yet. Add a
  category first, then add items to it.", `DialogActions` with `add-item-cancel` and a contained
  `Button component={RouterLink} to={`/lists/${listId}`}` "Manage list" (test id `add-item-manage-list`) whose
  `onClick` calls `onClose`. Update the header comment (FR68 / UX-DR-E9-9).
- `bp_front/src/routes/ListDetailPage.tsx:425-434` -- existing caller; `onAdded={() => {...refetch}}` still
  type-checks (ignores the arg). No behaviour change; its `add-item-button` stays `disabled` at 0 categories.
- `bp_front/src/routes/ListShoppingPage.tsx` -- add `addItemOpen` state; `Fab` after `</Container>` inside the page
  `Box` (gated on `!loading && !queryError`); mount `<AddItemDialog open listId categories onClose onAdded>` where
  `onAdded(item)` upserts into the cached `ItemsQuery{listId}` via `client.cache.updateQuery` (append if the id is
  absent, else leave — same keyed idempotence as the subscription merge at `:284-309`; `client` already exists at
  `:278`). Do NOT `refetch()`: Apollo 4 `notifyOnNetworkStatusChange` flips `loading` and would swap the list for
  the spinner (see `ListDetailPage.tsx:201-204`). Page `Box` (`:438`) gets `pb` = `calc(56px + theme.spacing(4) +
  env(safe-area-inset-bottom))` (keep `pt` as today's `py`). Empty branch (`:512-520`) branches its hint on
  `categories.length`. Update the purpose comment at `:244-250` ("read+check surface only" → add is allowed).
- `bp_front/e2e/support/ui.ts:136-171` -- extract the dialog-filling body of `addItem` into exported
  `fillAddItemDialog(page, categoryName, itemName, stores?)` (fill name, pick category via the dialog-scoped
  combobox, commit stores, click submit, wait for dialog gone); `addItem` = click `add-item-button` +
  `fillAddItemDialog` + its `item-row-` assertion. One definition (NFR-E8-5).
- `bp_front/e2e/shopping.spec.ts` -- new FR68 tests (both projects; mobile is 320px). Reuse the file-local
  `seedItems`/`categoryIdOf` (`:280-310`) and the FR52 two-actor shape (`:193-248`; FAB actor on `page`, watcher on
  a `browser.newContext`).
- `bp_front/e2e/narrow-viewport.spec.ts` -- 320px floor case (mobile only, `test.skip` like `:799`): FAB
  `expectInsideViewport`, `expectNoHorizontalOverflow`, and the no-categories dialog inside the viewport.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` -- §4 table (`:181-192`), §5.3
  (`:359-374`), new §5.3.3; §14 re-measure if touched. `.../DESIGN.md` §6 one-liner; §13 icon count re-measure.

## Tasks & Acceptance

**Execution:**
- `bp_front/e2e/support/ui.ts` -- extract `fillAddItemDialog` -- shared by `addItem` and the FAB tests.
- `bp_front/e2e/shopping.spec.ts` -- add FR68 tests (below), run RED on chromium + mobile against the current image -- proves they can fail.
- `bp_front/e2e/narrow-viewport.spec.ts` -- add the FAB / no-categories-dialog floor case -- NFR-E8-1.
- `bp_front/src/components/AddItemDialog.tsx` -- `onAdded(item)` + no-categories branch -- UX-DR-E9-9.
- `bp_front/src/routes/ListShoppingPage.tsx` -- FAB, dialog mount, cache upsert, bottom padding, empty-state copy -- FR68.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md`, `DESIGN.md` -- record the ruling and new surface -- living docs rule.
- Re-run lint/build/E2E green; for the cover test, break the padding (drop `pb`) once, confirm red on mobile, restore.

**Acceptance Criteria (each is an E2E test unless noted):**
- Given a member on `/list/:id` with categories, when they activate `shopping-add-item-fab`, then `add-item-dialog`
  opens with no list choice, and saving name + category + two stores shows `shopping-item-<name>` with both
  `shopping-item-store-<name>-<store>` chips — with a `window` marker set before the add still present after (no
  reload) — and a second member on the same list sees the row without a reload.
- Given a list with ~25 seeded items, when the page is scrolled to the bottom, then the FAB is
  `expectInsideViewport`, the last row is `expectInsideViewport`, the two bounding boxes do not intersect, and a click
  near the last row's right edge toggles it (`toBeChecked`) — on desktop and 320px.
- Given a list with no categories, when the FAB is activated, then `add-item-no-categories` shows, `add-item-name`
  and `add-item-submit` have count 0, and `add-item-manage-list` navigates to `/lists/<id>`.
- Given a list with categories but no items, then `shopping-empty` contains the add-button hint; given no categories,
  it contains "list management screen".
- Given the FAB, then `getByRole('button', {name: 'Add item', exact: true})` resolves to it; focusing the last
  shopping row and pressing Tab focuses it, and Enter opens `add-item-dialog`; at 320px it is inside the viewport.
- Given the existing shopping/lists/narrow-viewport suites, then they stay green (check-off, filters, switcher
  unchanged); `EXPERIENCE.md` §4 and §5.3 name adding as a shopping-view action with UX-DR-E9-8 (doc inspection).

## Spec Change Log

## Review Triage Log

### 2026-09-23 — Review pass
- verdicts: 23 findings — high 0, medium 1, low 18, false 4, maybe-false 0
- findings:
  - `[low]` `[patch]` blind-hunter: `env(safe-area-inset-*)` terms are inert because `index.html:6` has no `viewport-fit=cover`, so the docs' "sits above the safe-area inset" overstates — confirmed; adding `viewport-fit=cover` changes the whole app's layout, so the fix is documentary: DESIGN.md, EXPERIENCE.md §5.3.3 and the page comment now say the terms are inert until the viewport opts in. `index.html` untouched.
  - `[low]` `[reject]` blind-hunter: an active filter/search/"Done" toggle that excludes the new item hides it after save with no feedback — real, but needs a specific filter combination at add time (the usual "search, find nothing, add it" flow matches its own search), the closed filter control already shows that a filter is active, and the fix is new filter-reset behaviour (a branch plus a product decision), not a direct correction. Recorded under residual risks.
  - `[low]` `[reject]` blind-hunter: the dialog swaps to the no-categories branch mid-edit when the LAST category is deleted live (and back when one is created) — real but rare. Both branches return a `<Dialog>` at the same position, so React reconciles rather than remounts, and the name/stores state survives in the same instance. Other categories remaining keeps the form with the 9.3 mapped error, as the matrix row states. Fixing it would take a new "pinned branch" state.
  - `[low]` `[patch]` blind-hunter: "stays visible throughout" scrolling was only asserted at the bottom — the cover test now also asserts `expectInsideViewport(fab)` at half `scrollHeight`.
  - `[low]` `[patch]` blind-hunter: EXPERIENCE.md §4 rows (check/uncheck, checked-status filter, category filter) and §5.3.2 anchors went stale after this diff — re-anchored to the current `ListShoppingPage.tsx` lines.
  - `[low]` `[patch]` blind-hunter: DESIGN.md's "Page frame" paragraph still claimed `py: {xs: 3, sm: 4}` for all routes with stale lines, and "the only other fixed-position surface" was wrong (the app bar is sticky) — the paragraph now records the shopping page's `pt` plus reserved `pb`, and the wording (also in the code comment) is "the only fixed-position surface (the app bar is sticky)".
  - `[low]` `[reject]` blind-hunter: `sprint-status.yaml:125` is still `backlog` — the project owner updates sprint status in separate commits (`f1ca6cb sprint status update`), so this is not part of the story diff.
  - `[low]` `[patch]` blind-hunter: `dialog.getByText(/list/i)` count-0 was a brittle text proxy (the combobox count of 1 already proves there is no list picker) — assertion deleted.
  - `[low]` `[reject]` blind-hunter: focus return to the FAB after Cancel/Escape is untested — MUI `Dialog`'s default focus restore is unchanged by this story, and the test would add surface for library behaviour.
  - `[false]` `[reject]` blind-hunter: `if (saved) void onAdded(saved)` silently skips the management screen's refetch when `data` is missing — under the default `errorPolicy: 'none'` a resolved mutation always carries `data` (errors throw into the catch), so the skipped branch is unreachable today; the claim needs a hypothetical future policy change.
  - `[low]` `[patch]` blind-hunter: the UX-DR-E9-8 ruling note lacked its date, and the §12 row cited `epic-9-context.md` rather than `epics.md` — now "`md`, 2026-09-15; `epics.md:427-433`".
  - `[low]` `[patch]` edge-case-hunter: a `listId` change while the dialog is open (Android back gesture to a previous `/list/:other`) left the dialog open and retargeted — the existing list-switch callback of `useItemFilter` (fires only when `listId !== prevListId`) now also calls `setAddItemOpen(false)`.
  - `[low]` `[patch]` edge-case-hunter: same root cause as above — on a list switch the open dialog could flash the no-categories guidance while the new list's categories load. Grouped, same fix.
  - `[low]` `[reject]` edge-case-hunter: the no-categories branch's Cancel/backdrop can close the dialog while a save is in flight — needs the last category to vanish during the few hundred ms of a save. The save then fails server-side anyway (category gone), and the late `setFormError` lands on the same still-mounted instance. It would need extra disabled guards for a near-impossible race.
  - `[low]` `[reject]` edge-case-hunter: the form disappears when the last category is deleted while typing — same root cause and refutation as the blind-hunter branch-swap row above.
  - `[low]` `[reject]` edge-case-hunter: a filter excluding the new item hides it with no feedback — same root cause and reason as the blind-hunter filter row above.
  - `[medium]` `[patch]` verification-gap: `handleAdded`'s cache write (the reason the change exists, and the no-spinner guarantee) was masked by the subscription echo — a no-op or a `refetch()` swap would still pass. The FR68 add test now drops `getItemUpdates` `next` frames with `page.routeWebSocket` (and polls that at least one was dropped), and asserts `shopping-loading` count 0 after submit and after the row appears. Observed RED with a no-op `handleAdded` on both projects, then restored.
  - `[low]` `[patch]` verification-gap: the "FAB only once both queries have data" gate was untested — a new test holds the `Categories` operation via `page.route`, asserts the spinner is visible and the FAB count is 0, then releases it and asserts the FAB appears. Observed RED with `!loading` removed on both projects, then restored.
  - `[low]` `[patch]` intent-alignment: "stays visible throughout" only checked at the bottom — same root cause as the blind-hunter row, same fix (mid-scroll assertion).
  - `[false]` `[reject]` intent-alignment: the desktop half of the "not covered" AC cannot fail — at desktop the `md` content column never reaches the FAB's column, so there is no coverable state to regress. The spec's Design Notes and EXPERIENCE §5.3.3 record this; it is a property of the layout, not a defect.
  - `[false]` `[reject]` intent-alignment: the "behaves as before" regression claim rests on suite runs not shown in the diff — the full E2E suite was run in the orchestrator session (281 passed before patches, 283 after), see Auto Run Result.
  - `[false]` `[reject]` intent-alignment: the doc edits go beyond §4/§5.3 (dialog count 10→11, icon re-measure) — EXPERIENCE.md §14 itself requires "A story that finds a claim here false corrects it in the same commit", so correcting the counts this story re-measured is mandated, not scope creep.
  - `[low]` `[patch]` intent-alignment: the co-member check asserted only the Lidl chip — the Aldi chip is now asserted on `memberPage` too.

## Design Notes

**Why a cache write instead of `refetch()` or subscription-only.** The item subscription echoes the caller's own
save, but it is one-slot `DROP_OLDEST` and a just-opened socket can miss it; `refetch()` would flip `loading` and
blank the list. Upserting the mutation's returned `ListItem` into `ItemsQuery{listId}` is deterministic, and the
id-keyed check makes the later echo a no-op:

```ts
client.cache.updateQuery({query: ItemsQuery, variables: {listId}}, data =>
  data && !data.getItems.some(i => i.id === item.id) ? {getItems: [...data.getItems, item]} : data)
```

**Why the FAB waits for data.** `categories` is `[]` until `CategoriesQuery` resolves; an FAB activated in that
window would show the no-categories guidance for a list that has categories.

**Why the cover check is intersection, not "row above FAB".** At desktop the md container never reaches the FAB's
column, so only the 320px project can go red when the padding is removed; that is the honest failure surface, and it
is recorded rather than faked on desktop.

## Verification

**Commands:**
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0 (also type-checks `e2e/`).
- `docker compose up -d --build` then `curl -o /dev/null -w '%{http_code}' http://localhost:2080/api/health` -- expected: `200`.
- `cd bp_front && npm run test:e2e` -- expected: all four projects green, including the new FR68 and floor cases.
- `./gradlew :bp_back:cleanTest :bp_back:test` -- expected: unchanged green (no backend change; sanity only).

## Auto Run Result

Status: done

### Implemented change

The shopping view (`/list/:id`) now has a fixed bottom-right "Add item" FAB (`shopping-add-item-fab`) that opens the
existing `AddItemDialog` with the route's list as the fixed target (FR68, AR-E9-10). With no categories the dialog
shows guidance and a "Manage list" link to `/lists/<id>` instead of a form (UX-DR-E9-9). The saved item is upserted
by id into the cached `ItemsQuery{listId}`, so it appears with no reload and no spinner flash. Co-members get it
through the existing subscription (FR52). The page reserves bottom padding so the FAB never covers the last row. The
FAB renders only once both queries have data, and a list switch closes an open dialog. The empty state points at the
button when the list has categories. `EXPERIENCE.md` §4/§5.3 records the md ruling (UX-DR-E9-8) that adding is now a
shopping-view action.

### Files changed

- `bp_front/src/components/AddItemDialog.tsx` — `onAdded(item)` receives the saved item; new no-categories branch (guidance + `add-item-manage-list`, no form).
- `bp_front/src/routes/ListShoppingPage.tsx` — FAB (data-gated), dialog mount, cache upsert in `handleAdded`, reserved `pb`, empty-state copy branch, close-on-list-switch.
- `bp_front/e2e/support/ui.ts` — `fillAddItemDialog` extracted from `addItem` (one definition, two openers).
- `bp_front/e2e/shopping.spec.ts` — 6 FR68 tests: add with echo cut plus no-spinner and co-member live; cover/scroll at mid and bottom; no-categories dialog; empty-state copies; accessible name and keyboard; FAB waits for categories.
- `bp_front/e2e/narrow-viewport.spec.ts` — 320px floor case for the FAB and the no-categories dialog.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` — §4 table row and ruling, §5.3 re-anchored, new §5.3.3, §12 row, dialog and `maxWidth` counts.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md` — FAB as the only fixed-position surface, page-frame paragraph, icon re-measure (21 distinct from 27 import lines).

### Review findings

Four layers reported 23 findings: high 0, medium 1, low 18, false 4, maybe-false 0.

**Patched (10 entries, 1 medium and 9 low):**
- Medium: the cache write was masked by the subscription echo. The add test now cuts the echo with `routeWebSocket` and asserts no spinner.
- Low:
  - the FAB's data gate is now tested
  - the FAB is checked at a mid-scroll position
  - the brittle `/list/i` proxy is removed
  - the co-member Aldi chip is asserted
  - the dialog closes on a list switch
  - stale EXPERIENCE.md anchors are fixed
  - the ruling date and `epics.md` citation are added
  - the DESIGN.md page frame and sticky-vs-fixed wording are fixed
  - the inert safe-area terms are documented

**Deferred:** none.

**Rejected (13, each with its reason in the Triage Log):**
- the filter-hidden new item (two rows)
- the branch swap when the last category is deleted mid-edit (two rows)
- a close during an in-flight save as categories vanish
- sprint status (owner-managed)
- focus return (MUI default)
- `onAdded` skipped on missing `data` (unreachable under `errorPolicy: 'none'`)
- the desktop cover check that cannot fail (a layout property)
- regression runs not shown in the diff (they were run)
- doc edits beyond §4/§5.3 (required by §14)

### Follow-up review recommendation

`false`. This is a first pass with 0 `high` and 1 `medium` entry patched; `true` needs a patched `high` or two or more patched `medium`. Patched counts: high 0, medium 1, low 9.

### Verification performed

- `npm run lint` and `npm run build` exit 0, before and after the patch pass.
- `docker compose up -d --build`, then `/api/health` returned 200 before each E2E run.
- `npm run test:e2e`:
  - Before the patches: 281 passed, 29 skipped, 0 failed.
  - After the patches: the first full run had 1 failure in `item-attribution.spec.ts` (FR45/FR58), where a co-member's rename missed the author's live subscription. That test and code path are untouched by this story. It then passed 10 of 10 with `--repeat-each=5` on both projects.
  - Clean full re-run after the patches: 283 passed, 29 skipped, 0 failed.
- The new tests were observed RED against the pre-change image. The cover test went RED on mobile with the padding removed. The echo-cut and data-gate tests went RED on both projects with a no-op `handleAdded` or `!loading` removed. Every mutation was restored and rebuilt.
- `mise run back:test`: 170 tests, 0 failures (from the JUnit XML). The backend is unchanged. `./gradlew` does not exist at the repo root, so the documented command fails.
- Matrix audit: each row has a passing test.
  - add from shopping and own echo plus cache write: the FR68 add test
  - co-member watching: the same test, second context
  - no categories: the FR68/UX-DR-E9-9 test and the floor case
  - category removed mid-dialog: the existing `lists.spec.ts` FR46 stale-add test, which exercises the same `AddItemDialog` path

### Residual risks

- An active category, search or "Done" filter that excludes a newly added item hides its row after save, with no confirmation (review-rejected low; changing it would need a filter-reset decision).
- The safe-area insets are inert until `index.html` opts into `viewport-fit=cover` (documented).
- The existing live-update subscription is flaky: one full run lost a co-member rename's live event in `item-attribution.spec.ts`. This is pre-existing and not caused by this story.
- The `./gradlew` command in `CLAUDE.md` and `AGENTS.md` refers to a wrapper that is not at the repo root; `mise run back:test` works.
- EXPERIENCE.md §14 still expects 11 `snackbar|toast` and 23 `role="alert"` lines; the code has 14 and 28 (pre-existing drift, unchanged by this story). `verified_at_commit` in both docs is not bumped.
