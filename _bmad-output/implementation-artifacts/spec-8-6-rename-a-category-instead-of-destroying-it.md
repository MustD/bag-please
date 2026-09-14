---
title: 'Story 8.6: Rename a Category Instead of Destroying It'
type: 'feature'
created: '2026-09-08'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: '5015fd1c4303c1020a6e237cdc8c01fdff785094'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      Every dialog in the app renders without an accessible name: MUI's `Dialog` is not wired to its `DialogTitle`,
      so assistive tech announces an unnamed dialog.
    evidence: |-
      `EditCategoryDialog.tsx` sets `data-testid` on the `Dialog` but no `aria-labelledby`, and its `DialogTitle`
      carries no `id`. Verified pre-existing and app-wide: `AddCategoryDialog`, `AddItemDialog`, `EditItemDialog`
      and `ConfirmDialog` all have the same omission, so the new dialog inherited it rather than introducing it.
      The fix is one `id` + one `aria-labelledby` per dialog and wants a single pass over all five, plus an E2E
      assertion on the accessible name.
    location: >-
      bp_front/src/components/*Dialog.tsx (all five)
    severity: low
  - summary: >-
      A failed refetch after a successful save is swallowed, leaving the user looking at the OLD name with no signal
      that the write landed.
    evidence: |-
      `onSaved={() => { void refetch().catch(() => {}) }}` — the same wiring all four dialogs on
      `ListDetailPage.tsx` use, so this is pre-existing and not caused by Story 8.6. It bites harder here than
      elsewhere because the visible name IS this story's whole deliverable: the save succeeded, the dialog closed,
      and the screen still shows the mistyped name. Any fix wants to cover all four call sites at once and needs a
      surface for the failure that is not a toast (AR: no toasts, snackbars or banners).
    location: >-
      bp_front/src/routes/ListDetailPage.tsx (the four dialogs' onSaved/onAdded handlers)
    severity: low
---

<intent-contract>

## Intent

**Problem:** The only way to correct a mistyped category name on `/lists/:id` is the remove-category control, whose
own confirmation reads "Items in this category are removed with it. This cannot be undone." — so going from "Diary"
to "Dairy" destroys the whole aisle (report #8, FR63, UX-DR-E8-12).

**Approach:** Add a rename control beside the category row's existing add-item and remove buttons, opening a dialog
pre-filled with the current name that saves through the **existing** `SaveCategoryMutation` upsert. Frontend only:
no backend change, no schema change, no `npm run generate` (AR-E8-10).

## Boundaries & Constraints

**Always:**
- The save sends a **complete** `CategoryInput` — `id`, `name`, and the `listId` **loaded with the category** —
  matching `AddCategoryDialog`'s payload shape (AC2). `CategoryRepository.kt` `$set`s `listId` unconditionally, so a
  wrong `listId` moves the category to another list and strands its items behind a dangling id.
- The id is the loaded category's id, **never** regenerated. `AddCategoryDialog`'s `crypto.randomUUID()` is the one
  line that must not be copied across.
- Validation mirrors `AddCategoryDialog`: required name, `NAME_MAX = 100`, validate on submit, inline field error,
  `maxLength` on the input, re-entry guard (`if (loading) return`), real `catch` → inline `Alert`, Enter submits via
  a native `<form>` (AC3).
- Seeding follows `EditItemDialog`'s closed→open transition pattern (render-phase state adjustment, `shown`
  snapshot) — project lint forbids setting state in an effect.
- Category-level controls stay inside the existing `{category && (…)}` guard: the synthetic `Uncategorized` bucket
  gets no rename control, exactly as it gets no add/remove (Story 8.5 AC4).
- `/lists/:id` stays **refetch-driven** — the dialog's `onSaved` calls the page's existing `refetch()` and nothing
  else (AR-E8-6).
- Test data is created through the UI/API only, never by writing into MongoDB. Every new spec is observed FAILING
  before it is accepted (NFR-E8-6), runs on `chromium` AND `mobile`, against the production image.

**Never:**
- No backend change: `git diff --stat bp_back/` stays empty. No schema change, no codegen run, no new GraphQL
  document — `SaveCategoryMutation` already exists and already selects `id name listId`.
- No `subscribeToMore` on `ListDetailPage`. AC4 needs **zero** new subscription code: `ListShoppingPage`'s existing
  `CategoryUpdates` handler already maps a known id to the incoming `item`, so a rename lands live for free.
- No client-side existence check guarding the resurrection (AC5), and no coverage asserting the save fails.
- No guard against a rename that collides with an existing category name (AC7) — recorded in `deferred-work.md`,
  not fixed. Category names are not unique and this story does not make them so.
- No change to `EditItemDialog.tsx`, `AddCategoryDialog.tsx`, `ListFilters.tsx`, `lib/lists/order.ts`, or the
  remove-category confirm handler's delete loop.
- No toasts, snackbars, banners. Not a redesign: theme, type scale and visual language unchanged.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ordinary rename | Category `Diary` holding 2 items; new name `Dairy` | Row re-renders as `Dairy`, both items still under it, nothing else changes | No error expected |
| Payload shape | Any rename | Mutation carries `{id: <loaded id>, name: <trimmed>, listId: <category.listId>}` | No error expected |
| Two lists in play | Rename on list A while list B exists | The category stays on list A; list B is unchanged after reload | No error expected |
| Empty name | Name cleared, submit | Inline `Name is required`, dialog stays open, **no** mutation sent | Field error only |
| Over-long name | 101 chars pasted past `maxLength` | Inline `Name must be 100 characters or fewer`, no mutation | Field error only |
| Unchanged name | Submit with the name untouched | Permitted: dialog closes, row unchanged, **not** an error state | No error expected |
| Whitespace-only edit | `" Dairy "` over `Dairy` | Trimmed; the row reads `Dairy` | No error expected |
| Backend rejects | Save returns a GraphQL error | Dialog stays OPEN with the backend message in `edit-category-error` | Inline alert |
| Live propagation | Another member on `/list/:id` | The shopping view shows the new group name without a reload | No error expected |
| Resurrection | Member B deleted the category; stale member A saves a rename | The category is **recreated, empty**; asserted on A's management screen AND on B's shopping surface | No error expected |
| Synthetic bucket | `Uncategorized` group on `/lists/:id` | No rename control (nor add/remove) | No error expected |
| Narrow floor | Long category name at 320px | Three controls inside the viewport, name not clipped, page does not scroll | No error expected |

</intent-contract>

## Code Map

- `bp_front/src/components/EditCategoryDialog.tsx` -- **NEW, and the story's centre.** Structural copy of
  `AddCategoryDialog.tsx` (validation, `NAME_MAX`, re-entry guard, native `<form>`, inline `Alert`) with
  `EditItemDialog.tsx:67-81`'s open-transition seeding grafted on. Props `{category: ListCategory | null; onClose:
  () => void; onSaved: () => void | Promise<unknown>}` — `category === null` keeps it closed, mirroring
  `EditItemDialog`'s `item` prop. **No `listId` prop**: AC2's `listId` is the one on the loaded category
  (`CategoriesQuery` selects it — `listsQueries.ts:143-151`), read from the LIVE prop with the `shown` snapshot as
  fallback, exactly as `EditItemDialog.tsx:131` does. Testids: `edit-category-dialog`, `edit-category-name`,
  `edit-category-cancel`, `edit-category-submit`, `edit-category-error`. Title "Rename category", submit label
  "Save". Uses `SaveCategoryMutation` and `graphqlErrorMessage` — both already imported by the add dialog.
- `bp_front/src/components/AddCategoryDialog.tsx` -- **read-only reference.** `:46-58` validate, `:60-77` submit,
  `:98` `maxLength` slotProps. Copy the conventions; do **not** copy `:68`'s `crypto.randomUUID()`.
- `bp_front/src/components/EditItemDialog.tsx` -- **read-only reference.** `:67-81` the seeding pattern and why it
  keys off the closed→open transition; `:125-131` why carry-forward fields read the live prop, not the snapshot.
- `bp_front/src/routes/ListDetailPage.tsx` -- **change, four small edits.**
  - `:102` add `const [editCategoryTarget, setEditCategoryTarget] = useState<ListCategory | null>(null)`.
  - `:274-296` inside the existing `{category && ( … )}` Box, add a third `Tooltip`+`IconButton` — placed
    **between** add-item and remove-category, so destructive stays last. `aria-label={`Rename category
    ${group.name}`}`, `data-testid="edit-category-button"`, `EditOutlinedIcon` (already imported at `:22` for the
    item row), `onClick={() => setEditCategoryTarget(category)}` using the narrowed `category` binding from `:241`
    — reading `group.category` inside the closure loses the narrowing (the comment at `:237-240` says why).
  - Mount `<EditCategoryDialog category={editCategoryTarget} onClose={() => setEditCategoryTarget(null)}
    onSaved={() => { void refetch().catch(() => {}) }}/>` beside the other dialogs (~`:399`).
  - Import the new component with the other `@/components/*` imports (`:35-39`).
- `bp_front/src/lib/lists/listsQueries.ts` -- **read-only.** `:183-191` `SaveCategoryMutation` (selects `id name
  listId`, so Apollo's by-id normalization refreshes the renamed row); `:27` `ListCategory` type.
- `bp_front/src/routes/ListShoppingPage.tsx` -- **read-only, and this is AC4's whole implementation.** `:289-305`
  the `CategoryUpdates` `updateQuery`: on a non-`DELETED` event for a known id it replaces the entry with the
  incoming `item`, which is exactly a rename. Nothing to add.
- `bp_front/e2e/lists.spec.ts` -- **change.** Home for every FR63 spec (AC1, AC2, AC3, AC4, AC5, AC7). Follows the
  file's idioms: `uniqueUsername('lists', <label>, testInfo.project.name)`, a fresh user per run, assertions only on
  rows it created. Two-actor tests follow `item-editing.spec.ts:322-380`: the OBSERVER sits on the `page` fixture
  (a hand-built `browser.newContext()` does NOT inherit the project's viewport), membership is seeded via
  `shareList` + `acceptInvite` through `gql`/`loginApi` as environment prep.
- `bp_front/e2e/narrow-viewport.spec.ts` -- **change, one existing test.** `:407` `a long category name is fully
  readable at the floor` already asserts `expectInsideViewport` on the add-item and remove controls; add the rename
  control to that list and keep its `expectNotClipped(categoryName(...))` and `expectNoHorizontalOverflow(page)` —
  AC6. Do **not** add a second floor test for the same row: `layout.ts:20-25` names this row as the shape Story 8.6
  is expected to break, and one test owning it is the NFR-E8-5 rule.
- `bp_front/e2e/support/layout.ts` -- **reuse, do not change.** `expectNotClipped`, `expectNoHorizontalOverflow`,
  `expectInsideViewport`, `NARROW_FLOOR_PX`. All three helpers already exist; this story adds none.
- `bp_front/e2e/support/ui.ts` -- **reuse, do not change.** `registerViaUi`, `openListsViaMenu`, `createListAndOpen`,
  `addCategory`, `addItem`, `withCategoryMenu`, `PASSWORD`, `uniqueUsername`.
- `bp_front/e2e/support/api.ts` -- **reuse.** `gql`, `loginApi` for membership seeding only.
- `bp_front/playwright.config.ts` -- **change (comment only).** Append a dated collection row after the Story 8.5
  row (~`:163`). Re-measure with
  `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` — never quote an earlier row's figure.
- `bp_back/src/main/kotlin/**/CategoryRepository.kt`, `CategoryService.kt` -- **read-only, and never edited.** They
  are the evidence for AC2 (`listId` `$set` unconditionally) and AC4 (`categoryUpdateChannel` already emits).
- `_bmad-output/implementation-artifacts/deferred-work.md` -- **change.** Two appended entries: the colliding-name
  rename (AC7, recorded not guarded) and the resurrection ruling (AC5, decided not a bug). Also note that the Story
  8.5 entry about an orphan's `EditItemDialog` closing silently stays OPEN — 8.4 routed it here, no AC covers it.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- **change at close.** `:110`
  `8-6-rename-a-category-instead-of-destroying-it: backlog` → `done`.

## Tasks & Acceptance

**Execution:**
- `bp_front/e2e/lists.spec.ts` -- add the FR63 specs and run them FIRST, red, against the pre-fix production build
  -- NFR-E8-6. Where a spec cannot be red on its own terms, record the exemption in Implementation Notes the way
  Stories 8.3, 8.4 and 8.5 did, rather than claiming a red.
- `bp_front/src/components/EditCategoryDialog.tsx` -- create it: seeding, validation, the full-entity save -- AC1,
  AC2, AC3.
- `bp_front/src/routes/ListDetailPage.tsx` -- add the rename control inside the `category &&` guard and mount the
  dialog on the existing refetch -- AC1, AC4.
- `bp_front/e2e/narrow-viewport.spec.ts` -- extend the floor's category-row test with the third control -- AC6.
- `bp_front/playwright.config.ts` -- append the dated collection row with per-project counts -- AC8.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- the two entries listed in the Code Map -- AC5, AC7.
- spec Implementation Notes -- record the observed pre-fix reds, the post-fix greens, the measured collection
  counts, and the `git diff --stat bp_back/` output -- AC8.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- flip `8-6-…` to `done` at close.

**Acceptance Criteria:**
- Given a category holding items on `/lists/:id`, when its rename control is activated, then a dialog opens
  pre-filled with the current name, and the control sits between the row's existing add-item and remove buttons.
- Given the rename dialog is open, when a new name is submitted, then the row re-renders under the new name with
  the same items still attached, and the change survives a page reload.
- Given a member renaming a category, when the mutation goes out, then its `CategoryInput` carries the loaded
  category's own `id` and `listId` (never a fresh UUID, never the wrong list), and a second list on the same
  account is unaffected.
- Given another member is on `/list/:id` when a rename is saved, when the save completes, then that member sees the
  new group name without reloading, and `ListDetailPage` gained no subscription code.
- Given member B removed a category and stale member A then saves a rename for it, when A's save completes, then
  the category is recreated and empty, and that outcome is asserted on A's management screen and on B's
  subscription-driven shopping surface — no assertion claims the save fails.
- Given the `mobile` project at the 320px floor with a long category name, when the row renders with three
  controls, then all three lie inside the viewport, the category name is not clipped, and the page does not scroll
  horizontally.
- Given a spec that renames a category, when it asserts after the save, then it re-queries by the NEW name rather
  than holding a `category-row-<old name>` locator across the mutation.
- Given the story is complete, when the gates run, then `npm run lint` and `npm run build` exit 0, the full
  Playwright suite is green on `chromium` and `mobile` against the production image, and `git diff --stat bp_back/`
  is empty.

## Spec Change Log

## Review Triage Log

### 2026-09-09 — Review pass
- verdicts: 27 findings — high 0, medium 6, low 19, false 2, maybe-false 0
- findings:
  - `[low]` `[patch]` blind-hunter: `const current = category ?? shown` is documented as reading a "newer" live prop, but `ListDetailPage` passes a click-time `useState` snapshot it never re-derives — verified inert; the value sent is correct either way, so the defect is an inaccurate rationale a future reader would rely on. Grouped with verification-gap Other #2 and intent-alignment (f). Patched: the comment now states what `category ?? shown` actually guarantees (id and `listId` come from the loaded entity, never from `useParams`); code unchanged.
  - `[low]` `[defer]` blind-hunter: the dialog sets no `aria-labelledby`, so assistive tech announces an unnamed dialog — real, and verified pre-existing across `AddCategoryDialog`, `AddItemDialog`, `EditItemDialog` and `ConfirmDialog`; not caused by this story. Deferred.
  - `[low]` `[patch]` blind-hunter: "Enter submits via a native `<form>`" is an explicit convention of this dialog with no test — verified, every rename clicked the submit button, so moving submission to `onClick` would keep the suite green. Grouped with verification-gap gap #2. Patched: `renameCategory` gained a `submit: 'button' | 'enter'` parameter and the whitespace-trim rename now submits with Enter.
  - `[low]` `[reject]` blind-hunter: the reseed-on-reopen block is untested — the REACHABLE half is already covered (the validation spec cancels a dialog holding garbage, reopens, and asserts the field re-seeded to the original), and the `category.id !== shown?.id` clause guards retargeting the dialog without closing it, which the modal backdrop makes unreachable and for which no producer was shown.
  - `[low]` `[reject]` blind-hunter: the `if (loading) return` re-entry guard and cancel-during-save are untested — real, but the guard's absence would cost a second identical upsert, which is inert now that the unchanged-submit short-circuit landed; the fix is a fixture for a path with no user-visible consequence, and the same convention is untested on every sibling dialog.
  - `[medium]` `[patch]` blind-hunter: no FR63 spec asserts what a rename does to ORDER — verified, every fixture held one category, so a regression that stopped re-sorting after a rename would break Story 8.5's cross-surface FR62 contract silently. Patched: the golden spec gained a neighbour the rename sorts THROUGH (`Dairy … < Deli … < Diary …`) and asserts the full `category-name` sequence on `/lists/:id` and the `shopping-group-*` sequence on `/list/:id`.
  - `[medium]` `[patch]` blind-hunter: the red-first record covered 4 tests / 8 runs while 5 tests shipped, so the rejection spec and the second layer of the over-long case were accepted without an observed red — verified against the Implementation Notes and the diff. Grouped with edge-case #4 and intent-alignment (e). Patched by MEASUREMENT rather than by wording: the pre-fix source was restored (`git checkout 5015fd1 -- ListDetailPage.tsx`, `EditCategoryDialog.tsx` removed), the stack rebuilt, and the complete post-patch FR63 body plus the extended floor test run against it — **10 failed / 10, plus the floor test failed at `support/layout.ts:104`**. Notes rewritten with that measurement.
  - `[low]` `[reject]` blind-hunter: spec metadata contradictions — three parts, none actionable. `status` is workflow-managed and is written at finalization. The Code Map's "two appended entries" vs three: rejected because its fix is to edit this build's spec. The `2026-09-09` config row against `2026-09-08` artifacts is not a contradiction — the row was written today and the artifacts yesterday.
  - `[low]` `[reject]` blind-hunter: `captureCategorySaves` lacks a `try`/`catch` around `JSON.parse` and its `toHaveLength(0)` reads do not retry — the parse guard is a branch added for a body shape the app never sends, and every "no mutation" read is preceded by awaited DOM expectations and corroborated by a later exact-sequence assertion (`toEqual([...])`) that would surface any stray send.
  - `[low]` `[reject]` blind-hunter: rename raises the reachability of duplicate names without a pinning test or a note — verified against the ledger and refuted: the appended `deferred-work.md` entry states the collision case, its testid consequence, why it is not guarded and the shape of the real fix, and Story 8.5's `e2e/order.spec.ts` already pins duplicate-name behaviour at the module surface, which is the only surface where it is observable.
  - `[low]` `[reject]` blind-hunter: the rename icon is byte-identical to the item-row edit icon and no minimum touch-target is asserted — the two carry distinct tooltips and distinct `aria-label`s, the measured controls are 36px (above the 24px AA floor), and re-styling is exactly what "not a redesign" excludes.
  - `[low]` `[defer]` blind-hunter: `onSaved={() => { void refetch().catch(() => {}) }}` swallows a failed refetch, leaving the user on the old name after a successful save — real, and verified pre-existing: all four dialogs on this page use the identical wiring. Deferred. Its second part — that `/list/:id` gains no rename affordance — is refuted: AC1 scopes the control to the management screen and the epic records the manage-vs-use boundary as deliberate.
  - `[medium]` `[patch]` edge-case: an unchanged submit upserts the dialog's stale open-time name over a co-member's concurrent rename — verified reachable (A opens the dialog, B renames, A submits without typing) and it is exactly the revert `EditItemDialog`'s `nothingChanged` guard exists to prevent, which this spec's Design Note wrongly argued was "inert" by reasoning only about attribution. Patched: the short-circuit added, comparing `name.trim()` against the open-time `shown.name`; AC3's "permitted and a no-op to the user" is unaffected — the dialog still closes as a successful save does. This supersedes the Design Note, which is left standing as the record.
  - `[false]` `[reject]` edge-case: no duplicate-name validation guard — AC7 states in terms that "a rename that collides with an existing name is out of scope and recorded, not guarded", so the intent itself excludes it; it is recorded in `deferred-work.md`.
  - `[low]` `[reject]` edge-case: no guard against renaming a category to the reserved `Uncategorized` — real but pre-existing (`AddCategoryDialog` has created that collision since Story 5.5) and already on the ledger as a Story 8.5 deferral; the epic rules colliding names are recorded, not guarded.
  - `[medium]` `[patch]` edge-case: the red-first claim covers 4 tests while 5 shipped — same finding as blind-hunter's; grouped, and discharged by the measured pre-fix run recorded there.
  - `[low]` `[patch]` verification-gap (pre-verified): reopening the dialog after a failed submit is unpinned — deleting `setNameError(null)`/`setFormError(null)` leaves a stale validation error or a stale backend alert in a freshly opened dialog and every assertion still passes. Grouped with the layer's Other #1. Patched: the validation spec reopens after a failed submit and asserts the cleared state while the dialog is VISIBLE.
  - `[low]` `[patch]` verification-gap (pre-verified): Enter-to-submit is asserted nowhere — same finding as blind-hunter's; grouped and patched there. The layer filed it `defer` on the grounds that no sibling dialog asserts it; overridden because it is an explicit convention of THIS story and the fix is one keypress in an existing spec.
  - `[low]` `[patch]` verification-gap Other #1: four `edit-category-error` `toHaveCount(0)` checks run after `renameCategory` has already awaited the dialog's disappearance, and MUI unmounts the dialog's children on close, so they observe nothing — verified. Patched: the meaningful assertion moved inside the reopened, visible dialog; the vacuous post-close checks deleted.
  - `[low]` `[patch]` verification-gap Other #2: the `category ?? shown` freshness rationale is inert — same finding as blind-hunter's first; grouped and patched there.
  - `[medium]` `[patch]` intent-alignment (a): AC2 asks that "the `listId` returned by the query is the `listId` sent with the save", but the golden spec compared against the list id `createListAndOpen` parsed out of the URL — verified, so a `useParams`-sourced implementation (the exact failure AC2 exists to prevent) would have passed unchanged. Patched: `captureLoadedCategories` reads the `Categories` query RESPONSE and the spec asserts the sent `listId` equals the one that query returned for the renamed row.
  - `[low]` `[reject]` intent-alignment (b): AC5's "both members" is exercised as two tabs of one account — AC5's own justification grounds "both" in the two RENDERING PATHS (refetch-driven management vs subscription-driven shopping), and both are covered; the membership dimension of `saveCategory` under a second member's token is separately covered by the live-propagation spec, where a non-owner does the renaming.
  - `[low]` `[reject]` intent-alignment (c): "present and empty" on the observer is read off the filter option rather than a group — "empty" is not observable on `/list/:id` at all, because that view hides empty groups always by Story 8.5's design; presence is pinned directly and emptiness is asserted on the saver's screen, which is the only surface that can show it.
  - `[low]` `[reject]` intent-alignment (d): AC6 is discharged by extending an inherited assertion set plus a measured exemption — the exemption is recorded with its geometry, the helpers' falsifiability is established by dedicated controls in `narrow-viewport.spec.ts`, and the newly added `expectInsideViewport` on the rename control was subsequently observed RED against the pre-fix build (`layout.ts:104`), so it is load-bearing for the third control specifically.
  - `[medium]` `[patch]` intent-alignment (e): red-first evidence covers four of five specs — same finding as blind-hunter's; grouped and discharged by the measured pre-fix run.
  - `[low]` `[patch]` intent-alignment (f): the `category ?? shown` freshness argument is inert — same finding as blind-hunter's first; grouped and patched there.
  - `[false]` `[reject]` intent-alignment (g): the change touches files beyond the story's `Files:` line — `narrow-viewport.spec.ts` is required by AC6 and the `playwright.config.ts` collection row by the file's own standing convention, so the `Files:` line is a summary the ACs override, not a boundary they violate.

## Design Notes

**The unchanged-name save SENDS the mutation.** `EditItemDialog`'s `nothingChanged` short-circuit
(`EditItemDialog.tsx:120-124`) exists for a reason that does not transfer: `saveItem` re-attributes `addedBy`
server-side (BUG-E6-1), so a no-op item save has a real cost. `Category` has no such field — `saveCategory` writes
`id`, `name`, `listId` and nothing else — so a resent identical payload is genuinely inert. One code path is
therefore both simpler and truer to AC2's "when the dialog submits, then it sends a complete `CategoryInput`". AC3
is satisfied either way: it asks that the unchanged save be *permitted and a no-op to the user*, which it is — the
dialog closes, the row does not change, no error appears. Do not add a `nothingChanged` guard; if a later story
wants one, that is a decision with its own evidence.

**Why `listId` comes off the category, not the route.** They are the same value today, and that is exactly the
trap: `useParams`'s `id` is a string from the URL, while the category's `listId` is the value the server returned
for *this row*. `CategoryRepository`'s unconditional `$set` means the two diverging even once — a stale row, a
future multi-list surface — silently moves the category and strands its items. Reading it off the loaded entity
makes the payload self-consistent by construction.

**Golden shape of the submit** (the whole delta from `AddCategoryDialog`'s):

    const current = category ?? shown          // live prop first — the page refetches under us
    await saveCategory({
      variables: {category: {id: current.id, name: name.trim(), listId: current.listId}},
    })

**AC5's two paths, and what is observable on each.** The saver is on `/lists/:id`, which refetches after the save,
so the recreated category appears there as an ordinary row with its "No items yet." line — a direct assertion. The
observer is on `/list/:id`, which **hides empty groups always** (Story 8.5 AC5), so the resurrection is *not*
visible as a shopping group. Its observable surface there is the category filter: `ListFilters` renders one
`filter-category-option-<name>` per entry in `categories`, and that array is what the `CategoryUpdates`
subscription just upserted. Assert via `withCategoryMenu` (the menu does not self-close) that the option is
present, and that no `shopping-group-<name>` exists. Do not "fix" the missing group — an empty group is hidden by
design.

**Producing the stale saver, UI-only.** Two pages in one browser context, both accepted members. A opens
`/lists/:id` and stops (refetch-driven, no subscription ⇒ permanently stale until it acts). B opens `/lists/:id`,
removes the category, then navigates to `/list/:id` and parks. A — still holding the deleted category in its cache
— opens the rename dialog and saves. Assert A's staleness premise explicitly (its row is still on screen before
the save), so the fixture fails at its own precondition rather than misreporting if `/lists/:id` ever gains a
subscription.

**AC7 in practice.** Both surfaces key rows by NAME (`category-row-${group.name}`,
`shopping-group-${group.name}`), so `page.getByTestId(...)` keyed on the OLD name is dead the instant the
mutation lands. Re-query with the new name after each save; never hold a locator across it. Assert the old testid
has `toHaveCount(0)` as the other half.

**AC6's red-first honesty.** The floor assertion is a regression gate on a layout that this story is only
*expected* to break, not one it has broken. Add the rename control, then run the extended floor test. If it is
green on the first run, that is the answer — record it in Implementation Notes as a measured exemption with the
observed geometry, in the same form Stories 8.3–8.5 used, rather than manufacturing a red. `layout.ts` already
carries dedicated falsifiability controls for all three helpers, so their capability to fail is established
elsewhere and does not need re-proving here.

## Verification

**Commands:**
- `cd bp_front && npx playwright test --retries=0` -- expected: green on `chromium` and `mobile`, no new skips.
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` -- expected: `chromium`
  and `mobile` equal, exactly one test in each `registration-toggle-*` project; the numbers go in the config row.
- `cd bp_front && grep -rn "randomUUID" src/` -- expected: `AddCategoryDialog.tsx` and any pre-existing hits only;
  **not** `EditCategoryDialog.tsx`.
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0.
- `git diff --stat bp_back/` -- expected: empty.
- `git diff --stat bp_front/src/__generated__/` -- expected: empty (no codegen run).

**Manual checks:**
- `/lists/:id` on desktop and at 320px: the rename control sits between add-item and remove on every real category
  row and is absent from the `Uncategorized` bucket; renaming keeps the items attached; an empty name and a
  101-character name each block the save with an inline error; the same list on `/list/:id` shows the new name.

## Implementation Notes

**Landed 2026-09-08.** Frontend only, against baseline `5015fd1`.

**Red first (NFR-E8-6), MEASURED TWICE against the PRE-FIX production image.** The first pass recorded 8 red runs
for the 4 specs it shipped with. Two further pieces of coverage were added afterwards — the rejected-rename spec and
the second layer of the over-long case, both found by the Verify matrix audit — and four more by review patches, none
of which had been observed red. Rather than record that as an exemption, the pre-fix state was reconstructed and the
COMPLETE final body was run against it: `git checkout 5015fd1 -- bp_front/src/routes/ListDetailPage.tsx`,
`EditCategoryDialog.tsx` removed, `docker compose up -d --build`, then
`npx playwright test --retries=0 -g "FR63"` → **10 failed / 10** (5 specs x `chromium` + `mobile`), each at
`getByTestId('category-row-…').getByTestId('edit-category-button')` — the absent control, not a coincidence. The
extended floor test was run at the same revision and failed at `support/layout.ts:104`
(`expectInsideViewport` → element not found): 1 failed, 1 skipped (chromium, as designed). The source was then
restored, the image rebuilt, and every gate below re-run on it. **No red-first exemption is claimed for this story.**

**Green after (post-fix image), re-measured independently at Verify after the matrix-audit additions below.**
`-g "FR63"`: **10 passed**. Full suite `npx playwright test --retries=0`: **205 passed, 19 skipped, 0 failed,
0 flaky** in 1.4m.

**Collection counts, re-measured on the post-fix build** — `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' |
sort | uniq -c`:

    111 chromium
    111 mobile
      1 registration-toggle-chromium
      1 registration-toggle-mobile

224 total = 214 (Story 8.5) + 10, i.e. 5 untagged tests x 2 runs. The skip SPLIT was read off a `--reporter=json` run,
not inferred: **18 chromium / 1 mobile**, unchanged from the Story 8.5 row — none of the five new tests carries a
project guard, and AC6 EXTENDED the existing mobile-only category-row floor test instead of adding a second one. The
config's dated row records exactly this.

**Gates.** `npm run lint` exit 0; `npm run build` exit 0. `git diff --stat -- bp_back/` → EMPTY (no output at all).
`git diff --stat -- bp_front/src/__generated__/` → EMPTY; no `npm run generate` was run and no GraphQL document was
added — `SaveCategoryMutation` already existed and already selects `id name listId`.
`grep -rn "randomUUID" bp_front/src/` → `AddCategoryDialog.tsx:68` and `AddItemDialog.tsx:107` only, both
pre-existing; **no hit in `EditCategoryDialog.tsx`**. (The new file's header does discuss the add dialog's freshly
minted UUID as the one line not to copy, worded without the token so this gate reads clean.)

**AC6 — now a real red, plus the geometry.** The added `expectInsideViewport` on the rename control was observed
FAILING against the pre-fix build (see above), so the assertion is load-bearing for the third control specifically and
the exemption recorded on the first pass no longer applies. The measured post-fix geometry is kept because it is the
answer to AC6's actual question. At the 320px floor with `LONG_CATEGORY_NAME`, `documentElement.clientWidth` 320 and
`scrollWidth` 320 (no horizontal scroll); the three controls are 36px wide at x=180 (add-item), x=216 (rename),
x=252 (remove) — right edge **288 <= 320**, so the new control cost the name box nothing it could not give:
`category-name` measures `scrollWidth 140 === clientWidth 140` and `scrollHeight 96 === clientHeight 96`, i.e. not
clipped on either axis. The row wraps the name to three lines rather than squeezing the controls, which is what Story
8.2's cap removal made possible.

**Two matrix rows were uncovered by the first implementation pass and are now covered.** Both were caught by the
Verify-step matrix audit, and neither was closed by relaxing the expectation:

- **"Over-long name — 101 chars pasted past `maxLength`."** The premise is not reproducible with a user gesture:
  browsers enforce `maxlength` on PASTE as well as on typing, and Playwright's `fill` honours it too, so the 101st
  character never reaches the form. The spec now asserts the row in TWO layers. Layer one is the cap itself —
  `maxlength="100"` on the input, 101 characters in leaving exactly 100 held, zero mutations. Layer two drives the
  submit-time `Name must be 100 characters or fewer` branch by writing the value through React's own input plumbing
  (the native `HTMLInputElement.value` setter plus a bubbling `input` event, which is what a controlled MUI
  `TextField` listens to) and then submitting: inline error, dialog stays open, zero mutations. That is deliberately
  not dressed up as a user gesture — it is the only way to exercise a branch whose entire job is to hold when the
  attribute does not (autofill, an extension, a future field that drops `maxLength`), and every assertion it makes is
  still about the component's own behaviour.
- **"Backend rejects → `edit-category-error`."** Now covered by `FR63 — a rejected rename keeps the dialog open and
  shows the backend message inline`, using the same mechanism `item-editing.spec.ts:534` established: a co-member
  opens the rename dialog, the owner revokes their membership while it sits open, and the submit is rejected
  server-side. Asserts the `role="alert"` inline `Alert` is visible and non-empty, the dialog stays OPEN (never a
  silent close that would read as success), and the owner's copy still carries the ORIGINAL name.

**AC3's id stability is asserted with TWO renames, not one.** A single captured payload cannot distinguish a preserved
id from a freshly minted one — any UUID looks right in isolation. The spec renames twice and asserts the two payloads
carry the SAME `id`, that both carry the `listId` **the `Categories` query returned for that row** (captured off the
response, not compared against the id parsed out of the URL — those two agree today, which is exactly why the URL is
the wrong reference: a dialog that read `listId` off `useParams` would satisfy a URL comparison while carrying a value
with nothing to do with the entity it saves), and that the row count never grows. A `crypto.randomUUID()` copied across from the add dialog would
leave two rows on screen and fail the first rename's own assertions.

**AC4 cost zero implementation.** `ListShoppingPage`'s existing `CategoryUpdates` `updateQuery` already replaces a
known id with the incoming entity, which is precisely a rename; no `subscribeToMore` was added to `ListDetailPage`,
and the spec asserts that positively — `countWebSockets` on the renaming member's `/lists/:id` reads **0** across the
whole rename.

**Files changed.** NEW `bp_front/src/components/EditCategoryDialog.tsx`; `bp_front/src/routes/ListDetailPage.tsx`
(import, one `useState`, the third `Tooltip`+`IconButton` inside the existing `{category && (…)}` guard between
add-item and remove, the dialog mounted on the page's existing `refetch()`); `bp_front/e2e/lists.spec.ts` (5 new FR63
tests, the `gql`/`loginApi` setup import, and one added assertion in the Story 8.5 orphan test that the synthetic
`Uncategorized` bucket has no rename control either); `bp_front/e2e/narrow-viewport.spec.ts` (the third control on the
existing floor test); `bp_front/playwright.config.ts` (dated collection row, comment only);
`deferred-work.md` (three entries: the colliding-name rename recorded not guarded, the resurrection ruling, and the
Story 8.5 `EditItemDialog` orphan-save note re-affirmed OPEN); `sprint-status.yaml` (`8-6-…: done`).
`EditItemDialog.tsx`, `AddCategoryDialog.tsx`, `ListFilters.tsx`, `lib/lists/order.ts` and the remove-category delete
loop are untouched.


**Review pass 1 follow-up, verified 2026-09-09.** `npm run lint` and `npm run build` exit 0; the stack was rebuilt and
the two edited spec files re-run — `npx playwright test --retries=0 e2e/lists.spec.ts e2e/narrow-viewport.spec.ts` →
**49 passed, 17 skipped, 0 failed**, both projects. Collection re-measured after the changes: `111 chromium / 111
mobile / 1 / 1` = 224, which is the figure the config's dated row carries. `git diff --stat -- bp_back/` and
`-- bp_front/src/__generated__/` both still EMPTY. The one behavioural change in this pass is the `nothingChanged`
short-circuit (Review Triage Log item 1): an unchanged submit now sends NO mutation, and the spec assertion that used
to pin the opposite is flipped to `'an unchanged submit sends no mutation'`.

## Auto Run Result

Status: done

### Implemented change

`/lists/:id` category rows gained a rename control between the existing add-item and remove-category buttons. It opens
a new `EditCategoryDialog` pre-filled with the current name, which saves through the **existing** `saveCategory`
upsert — no backend change, no schema change, no codegen run. The payload is the complete entity
(`{id, name, listId}`) taken from the **loaded category**, never from `useParams` and never with a fresh UUID, because
`CategoryRepository` `$set`s `listId` unconditionally and a wrong value moves the category to another list. A rename
reaches other members live over the shopping view's existing `CategoryUpdates` subscription with zero new subscription
code, and `/lists/:id` stays refetch-driven. The synthetic `Uncategorized` bucket gets no rename control, and a rename
saved against a category another member removed recreates it, empty — the decided outcome, pinned by a test rather
than guarded against.

### Files changed

- `bp_front/src/components/EditCategoryDialog.tsx` — NEW. `AddCategoryDialog`'s validation and form conventions plus
  `EditItemDialog`'s open-transition seeding and its `nothingChanged` short-circuit.
- `bp_front/src/routes/ListDetailPage.tsx` — one `useState`, the third `Tooltip`+`IconButton` inside the existing
  `{category && (…)}` guard, and the dialog mounted on the page's existing `refetch()`.
- `bp_front/e2e/lists.spec.ts` — 5 FR63 specs (golden rename with ordering and the query-sourced `listId`;
  validation, trim, Enter-submit, error clearing on reopen, unchanged-submit no-op; live propagation with a
  WebSocket count of 0; the stale-rename resurrection; the revoked-member rejection) plus one assertion in the Story
  8.5 orphan test that the `Uncategorized` bucket carries no rename control.
- `bp_front/e2e/narrow-viewport.spec.ts` — the third control added to the existing 320px category-row floor test.
- `bp_front/playwright.config.ts` — dated collection row (comment only).
- `_bmad-output/implementation-artifacts/deferred-work.md` — three entries: the colliding-name rename recorded not
  guarded, the resurrection ruling, and the Story 8.5 `EditItemDialog` orphan-save note re-affirmed OPEN.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `8-6-…: done`.

### Review findings breakdown

Four layers reported 27 findings: 0 high, 6 medium, 19 low, 2 false. Seven entries were patched, 2 deferred, and the
rest rejected on their refutations. Full rows and evidence are in the Review Triage Log above.

**Patched (4 medium, 3 low):** the unchanged submit reverting a co-member's concurrent rename (a `nothingChanged`
short-circuit added, superseding this spec's own Design Note); a rename's effect on ORDER being unasserted (a
neighbour category the rename sorts through, both surfaces); AC2's `listId` being pinned against the URL rather than
the query response; the red-first record covering 4 of 5 specs (discharged by reconstructing the pre-fix build and
observing the complete final body red); the undriven Enter-submit path; the unpinned error clearing on reopen plus
four vacuous post-close assertions; and two component comments that argued things the code does not do.

**Deferred (2, both low, both pre-existing):** no dialog in the app carries an accessible name; and a failed refetch
after a successful save is swallowed, leaving the old name on screen.

**Rejected, with reasons:** the duplicate-name guard and the file-set-beyond-`Files:` finding (the intent itself
excludes both — AC7 in terms, AC6 by requirement); the `Uncategorized` reserved-name guard (pre-existing and already
on the ledger); the spec-metadata contradictions (workflow-managed status, a fix that edits this build's spec, and a
date that is simply today's); `captureCategorySaves`'s missing parse guard and non-retrying reads (corroborated by a
later exact-sequence assertion); the untested re-entry guard and the unreachable reseed-on-retarget clause; the
duplicate-name reachability note (already stated on the ledger and pinned at the module surface by Story 8.5); the
icon and touch-target objection (36px, distinct tooltips and labels, and "not a redesign"); the absent rename on
`/list/:id` (AC1 scopes it to the management screen); AC5's "both members" read as two accounts (its own justification
grounds it in the two rendering paths, and the membership dimension is covered by the live-propagation spec); AC5's
"present and empty" on the observer (emptiness is not observable on a surface that hides empty groups by design); and
AC6 as an inherited assertion set (its new assertion was subsequently observed red).

### Follow-up review recommended: true

Four `medium` entries were patched on a first pass. The specific unverified risk: the `nothingChanged` short-circuit
reverses a decision this spec argued for explicitly, and the concurrency scenario that motivated it — member A's
dialog open across member B's rename, then A submitting untouched — is covered by **no test**. The flipped assertion
proves only that a SOLO unchanged submit sends nothing; that B's rename actually survives A's no-op is verified by
reasoning about the guard, not by a two-actor spec. Patched counts by verdict: medium 4, low 3.

### Verification

Re-run independently after the patches, against a freshly rebuilt production image:

- `npx playwright test --retries=0` — **205 passed, 19 skipped, 0 failed, 0 flaky** on `chromium` and `mobile`.
- `npx playwright test --list | … | uniq -c` — **111 / 111 / 1 / 1** (224), matching the `playwright.config.ts` row.
- `npm run lint` and `npm run build` — exit 0.
- `grep -rn "randomUUID" bp_front/src/` — `AddCategoryDialog.tsx:68` and `AddItemDialog.tsx:107` only.
- `git diff --stat -- bp_back/` and `-- bp_front/src/__generated__/` — both empty.
- Red first: the complete final FR63 body run against a reconstructed pre-fix build — **10 failed / 10**, plus the
  floor test red at `support/layout.ts:104`.

Every row of the I/O & Edge-Case Matrix is covered by a test that ran and passed.

### Residual risks

- The co-member-concurrency case behind the `nothingChanged` guard is unasserted (see above).
- Duplicate category names remain unguarded and are now easier to reach; both surfaces still key rows by name, so a
  collision produces two elements sharing one testid. Recorded on the ledger, with the server-side fix's shape.
- The resurrection is decided rather than fixed: a rename saved against a removed category recreates it empty on the
  saver's screen and as a filter option on other members' shopping views.
