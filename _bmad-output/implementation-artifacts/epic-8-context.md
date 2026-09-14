# Epic 8 Context: Small UX Fixes From Real Use

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Eight defects reported from actually shopping with the running app, fixed in one epic, plus the two structural changes
that stop them recurring and the design contract the project has been missing since the frontend was rebuilt. On the
shopping screen the whole item row becomes the check target instead of a small checkbox, and the category filter stops
being either/or. On the management screen a long item name wraps instead of vanishing behind an ellipsis, the list
title stops shoving its own buttons off a narrow phone, a category filter and an item search arrive, and a mistyped
category can be renamed instead of deleted — which today destroys every item inside it. Both screens stop disagreeing
about what order the same list is in. Underneath: the project gains a supported narrow-viewport floor that the E2E gate
actually enforces, and the two list surfaces get one filter unit and one ordering comparator so they cannot drift apart
again. This is a fixes epic, not a redesign.

## Reports

The eight defects `md` reported from using the running app, and the story that delivers each. "Report #N" is used as a
cross-reference throughout `epics.md`, the story specs, the E2E specs and the source comments; this is where the
numbering is defined. Sourced from the UX-DRs and each story's `**Delivers:**` line.

1. Checking an item off means aiming at the small checkbox rather than tapping the row (FR60, UX-DR-E8-1) — Story 8.3.
2. A long item name is truncated instead of wrapping on the management screen (UX-DR-E8-2) — Story 8.2.
3. The list title is squeezed to an ellipsis by its two action buttons at narrow widths (UX-DR-E8-3) — Story 8.2.
4. The category filter selects only one category at a time (FR61, UX-DR-E8-4) — Story 8.4.
5. The management screen has no category filter (FR61, UX-DR-E8-5) — Story 8.4.
6. The management screen has no item search (FR61, UX-DR-E8-6) — Story 8.4.
7. The two list screens order categories and items differently (FR62, UX-DR-E8-8) — Story 8.5.
8. A mistyped category name can only be corrected by deleting the category and every item in it (FR63, UX-DR-E8-12) —
   Story 8.6.

Seven stories cover eight reports: #2 and #3 are both Story 8.2, and #4, #5 and #6 are all Story 8.4. Two stories
deliver no report — Story 8.1 delivers the gate that lets #2 and #3 be proven, and Story 8.7 writes down the design the
app actually has.

RESTORED 2026-09-05 (Story 8.2 review): this section was added at Story 8.1's review Pass 2 because "report #N" was the
epic's most-used cross-reference and was defined nowhere. Story 8.2's step-01 recompiled this file from the planning
artifacts and dropped it while ~26 references remained live. If you regenerate this file again, carry this section
across — the compiler does not produce it.

## Stories

- Story 8.1: Move the Mobile Gate to the Width People Actually Use
- Story 8.2: A Long Name and a Full Header Fit on a Narrow Phone
- Story 8.3: Check Off an Item by Tapping Its Row
- Story 8.4: One Filter and Search, on Both List Screens
- Story 8.5: The Same List Reads the Same Way on Both Screens
- Story 8.6: Rename a Category Instead of Destroying It
- Story 8.7: Write Down the Design This App Actually Has

## Requirements & Constraints

- **320px is a supported viewport.** Every screen is usable at a 320px CSS width: nothing overflows horizontally, no
  interactive control is pushed off-screen, and no text is clipped **except where a story has measured the clipping and
  recorded the decision to keep it** — the app-bar username chip is the standing example (Story 8.2 measured it at
  `scrollWidth 369 > clientWidth 140` and filed it; the bar has no second row to give the name). The concrete driver is
  a foldable cover display (~344px); 320px is the floor so the requirement outlives one handset. This supersedes any
  per-component fixed pixel cap that has not been through that audit.
- **The floor is gated, not inspected.** The E2E suite renders at the floor as part of a normal run, so a future fixed
  pixel cap fails the gate instead of reaching a device.
- **Overflow is asserted mechanically, never by eye.** Truncation is silent by design — an ellipsis is not an error —
  so element-level clipping, document-level horizontal overflow, and per-element viewport containment are three
  separate assertions with three different jobs, and the document-level one alone gates nothing.
- **Filtering and search stay client-side and instant.** No query, no refetch, no round trip, no loading state; both
  surfaces already hold the full item and category sets in the client cache.
- **One definition, used twice.** The filter unit, the filter predicate and the ordering comparator each have exactly
  one definition in `src/`. A second copy is a review failure.
- **Verification discipline, on every story.** E2E against the production artifact, on desktop and at the narrow floor,
  UI-driven, FR-mapped, manually exercised before the test is written, and **every new test observed failing before it
  is accepted**. Test data is created through the API/UI only — never by writing directly into MongoDB. Never quote a
  version, count or line number from a planning document; re-measure it in the pass. Deferrals go into
  `deferred-work.md`; `sprint-status.yaml` is reconciled at story close.
- **No toasts, snackbars or banners.** State changes are confirmed by the UI changing.
- **The backend is frozen.** A scoped unfreeze is authorised but unspent — no story in this epic needs it, and every
  story's gate asserts `git diff` shows no change under `bp_back/`. `npm run lint` and `npm run build` pass on each.
- **Not a redesign.** The dark theme, type scale and visual language are unchanged. Light mode, a design-token
  overhaul and a bottom-tab navigation are known gaps, recorded but not acted on.

## Technical Decisions

- **Retarget the existing `mobile` Playwright project to 320px; do not add a third viewport project.** The device
  descriptor (Chrome-on-Android UA, touch emulation) is retained and only the viewport width is overridden. Keeping
  exactly two viewport projects is what keeps the registration-toggle dependency chain complete and the shared-config
  race closed — a third project registering users during the toggle's OFF window would reopen it.
- **Measure before fixing.** The retarget lands while the layouts are still broken, and the first act is to run the
  suite once at `retries: 0` and record every newly-failing test. A substantially larger count than the two reported
  defects is a scoping decision for the user, taken with the number in hand.
- **Clipping and overflow are different defects.** `noWrap` sets `overflow: hidden`, and a clipped element does not
  widen its ancestors, so a document-level overflow check stays green while the reported defects are on screen. The
  detecting assertion is the same comparison one level down, on the text element. Both helpers ship in the shared E2E
  support module, one definition each.
- **Remove the fixed pixel caps, do not retune them.** Three `noWrap` + `maxWidth` Typography constructs on the
  management screen (list title, item name, category name) are the cause; all three go in the same pass. The app-bar
  username chip is the same family — audited, with the outcome recorded either way, not automatically in scope.
- **The narrow-floor header fix is the buttons yielding, not the title shrinking.** Adding `minWidth: 0` to the title
  is a no-op, because `overflow: hidden` has already resolved its automatic minimum size to zero.
- **The item row becomes a single control.** One accessible name, one checked state, one tab stop, one mutation per
  activation — not a checkbox nested in a clickable row. The toggle handler must take its next state explicitly rather
  than reading it off a DOM event. Existing failure behaviour is unchanged: the cache is untouched on error and the
  control reverts to server state, with the reason in the existing inline error alert. A gesture that starts on a row
  and scrolls must not check the item, and that must be driven as a real pointer gesture, not a synthetic click.
- **Consequence to respect:** with the whole row as one control, the store chip and the avatar inside it are a closed
  extension surface — they cannot become affordances of their own without reopening this decision.
- **The management screen stays refetch-driven.** It deliberately carries no realtime subscription; the shared filter
  component is presentational and must not assume one exists.
- **Stale-filter guards generalise to a set** (prune every selected id that no longer exists) and live once in the
  shared unit. They stay render-phase adjustments — project lint forbids setting state in an effect.
- **Category rename rides the existing id-keyed upsert mutation** — no backend change, no schema change, no codegen
  run. The save must send the complete entity including the category's loaded `listId`: the repository sets `listId`
  unconditionally, so a wrong value moves the category to another list and strands its items.
- **Category resurrection is decided, not a bug.** Saving a rename for a category another member has deleted recreates
  it, empty. That is accepted: it carries no false data, strands nothing, and the user's existing remove control is
  the recovery. Do not add an existence check, and do not write coverage asserting the save fails.
- **Orphaned items:** category deletion does not cascade on the backend, so the client deletes items in an awaited
  loop with no transaction; a mid-loop failure orphans the survivors. This epic surfaces existing orphans (a synthetic
  `Uncategorized` group on the management screen, where edit and remove both work) and records the cause without
  fixing it.

## UX & Interaction Patterns

- **Item names wrap to at most two lines** on the management screen instead of truncating, with the horizontal gap to
  the row's controls reduced to give the name back space. Past two lines they ellipsise; that bound is deliberate, so a
  pathological name cannot outgrow the controls beside it. (Shipped by Story 8.2.)
- **At the narrow floor the management header's "+ Category" / "+ Item" buttons take their own row** beneath the title,
  which takes the full width. Both keep their text labels. Shipped as a breakpoint rule (`xs`), not a fit test, so the
  break point cannot vary with the longest word in the list name; above `sm` the header is one row as before.
  (Shipped by Story 8.2.)
- **The whole shopping item row is one control**: one accessible name, one checked state, one tab stop, one keyboard
  activation, one mutation per activation. A scroll gesture begun on a row must not check the item — driven as a real
  pointer-down/move/up gesture, asserted on the mobile project. (Story 8.3.)
- **The manage-vs-use boundary is deliberate:** `/lists/:id` manages a list, `/list/:id` shops it. The two screens
  differ on purpose in places, and those differences stay.
- **Empty categories:** shown on the management screen when no filter or search is active (its "No items yet." row is
  where a first item gets added), hidden while filtering or searching. The shopping view hides empty groups always.
  This is the one place the two surfaces intentionally differ, so both branches need asserting.
- **The category filter stays a select made multiple**, with checkboxes in the menu and a summary in the closed
  control — not a chip row. Selecting nothing means all categories, preserving today's default.
- **The checked-status toggle (All / To buy / Done) stays shopping-only.** The shared component accommodates its
  absence rather than rendering a disabled control.
- **Canonical order is by name** — categories by name, items by name within a category — on both surfaces.
- **The category rename control** sits beside the row's existing add-item and remove buttons, opening a dialog
  pre-filled with the current name, mirroring the item-edit dialog's form conventions and validation (required name,
  100-character maximum, validate on submit, inline errors, Enter submits via a native form). Saving an unchanged name
  is a permitted no-op.
- **Both list surfaces key rows by name in their test ids**, so any spec covering the rename must re-query after the
  save rather than hold a locator across the mutation. Category names are not unique and this epic does not make them
  so; a colliding rename is out of scope and recorded, not guarded.

## Cross-Story Dependencies

- **8.1 must land first, while the layouts are still broken.** It delivers the 320px gate and the two assertion
  helpers; an assertion written after 8.2 has fixed the defect can never be observed failing. 8.2 and 8.6 both consume
  those helpers and the retargeted project, and add no test infrastructure of their own.
- **8.2 before 8.6.** The rename adds a third control (~40px) to a category row whose name is already truncating on
  the reported device; landing it first would deepen the reported defect on exactly that device.
- **8.5 after 8.4.** Both rewrite the same grouping block on both pages, and 8.4 rewrites it first — doing 8.5 earlier
  means editing it twice.
- **8.4 and 8.5 stay separate stories** on scope-budget grounds, despite touching the same lines. 8.4 is already the
  epic's largest story.
- **8.3 is independent** of the chain and schedulable anywhere; it is placed early so real user value lands soon.
- **8.7 is last and is scheduled, not conditional** — it describes the shipped design rather than prescribing one, so
  it can only be honest after the implementation stories. It also collects anything 8.1's measurement filed rather
  than fixed. The production-artifact E2E constraint is deliberately not applicable to it, since it ships no code.
- Two existing UX specifications on file are stale; the shipped source is authoritative wherever a planning document
  disagrees. 8.7 marks both superseded without deleting them.
