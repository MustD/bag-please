# Epic 8 Context: Small UX Fixes From Real Use

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 8 fixes eight defects reported from actually using the running app on a phone, and closes the gap that let them
ship. Narrow-viewport layouts clip silently, the shopping and management list screens have drifted apart (different
ordering, filtering on only one of them), checking an item off means aiming at a small checkbox one-handed, and a
mistyped category name can only be corrected by deleting the category and every item in it. The epic retargets the E2E
mobile gate to the width real phones have, fixes the layouts it now catches, makes the two list surfaces share one
implementation of ordering and filtering, makes the whole shopping row a check target, adds category rename, and closes
by writing down the design the app actually has. It is a fixes epic, not a redesign: the visual language, dark theme and
type scale are unchanged. Both UX specifications on file are stale — the shipped source is authoritative wherever a
planning document disagrees, and Story 8.7 exists to replace them.

## Stories

- Story 8.1: Move the Mobile Gate to the Width People Actually Use
- Story 8.2: A Long Name and a Full Header Fit on a Narrow Phone
- Story 8.3: Check Off an Item by Tapping Its Row
- Story 8.4: One Filter and Search, on Both List Screens
- Story 8.5: The Same List Reads the Same Way on Both Screens
- Story 8.6: Rename a Category Instead of Destroying It
- Story 8.7: Write Down the Design This App Actually Has

## Requirements & Constraints

- **320px viewport floor.** The app must be usable at a 320px CSS width: nothing overflows horizontally, no control is
  clipped, no interactive element is pushed off-screen. The driver is a foldable cover display (~344px); 320px is chosen
  so the requirement outlives one handset.
- **The floor is gated, not inspected.** The E2E suite renders at 320px as part of a normal run, so a future fixed pixel
  cap fails the gate instead of reaching a phone. Overflow is asserted mechanically, never by eye: two distinct measured
  assertions — element-level clipping (`scrollWidth > clientWidth` on the text element) and document-level horizontal
  overflow. Clipping is silent by design, so the document-level check alone gates nothing.
- **Filtering and search stay client-side and instant.** No new query, refetch or round trip; no loading state while
  typing. Both surfaces already hold the full item and category sets in the client cache.
- **The two list surfaces cannot drift again.** The ordering comparator and the filter predicate each have exactly one
  definition in `src/`, used twice. A second copy is a review failure.
- **Verification bar (carried forward unchanged).** Every change is verified against the production artifact on both
  desktop and the narrow floor, UI-driven, FR-mapped, manually exercised before the test is written, and observed
  failing before it is accepted. Lint and build pass on every story.
- **No notification layer.** No story adds a toast, snackbar or banner; state changes are confirmed by the UI changing.

## Technical Decisions

- **The backend is frozen in practice.** A scoped unfreeze was authorised and is unspent — no story needs it. Every
  story's gate includes: no change under `bp_back/`. Category rename works against the existing id-keyed `saveCategory`
  upsert and the existing generated mutation document, so no schema change and no codegen run.
- **Retarget the existing mobile E2E project to 320px; do not add a third project.** Keep the Pixel 7 device descriptor
  (Chrome-on-Android UA and touch emulation are what it was for) and override only the viewport width. Staying at two
  viewport projects keeps the registration-toggle mutual-exclusion chain complete and a previously fixed race closed.
- **Measure before fixing.** Retargeting will surface defects beyond the two reported. The newly-failing set is measured
  with retries off, recorded, and brought back as a scoping decision before any layout is touched.
- **The clipping is caused by hard-coded pixel caps paired with `noWrap`** — three on the list management screen (list
  title, category name, item name), plus an app-bar username chip that is in the audit but not automatically in scope.
  Caps are removed, not retuned. The header defect is a *squeeze*, not an overflow: `noWrap` sets `overflow: hidden`,
  which already resolves the title's automatic minimum size to zero, so adding `minWidth: 0` is a no-op and must not be
  implemented as the fix, and a document-level assertion cannot see the defect. The fix is to make the buttons yield.
- **Row-level check-off changes a handler signature.** The toggle handler derives the next state from the DOM event's
  `target.checked`; a row activation has no such event, so the next state is passed explicitly and the checkbox stops
  owning that decision. Existing failure behaviour (cache untouched on error, control reverts to server state, reason
  surfaced in the existing inline alert) is preserved. The shopping item row becomes a deliberately closed extension
  surface — no further nested controls.
- **Shared units go where the precedent already is.** The ordering comparator lives beside the existing shared
  `createdAt` comparator in the frontend list library; the filter is one shared component. Stale filter selections are
  pruned by render-phase adjustment (set-state-in-effect is lint-forbidden), generalised from one id to a set.
- **The management screen has no realtime subscription, by prior explicit design.** It is refetch-driven; no shared
  component may assume a subscription exists, and none is added to it.
- **Accepted-by-decision, pinned by tests rather than guarded:** saving a rename for a category another member deleted
  recreates it empty (recovery is the existing remove control); category names are not unique and stay that way.

## UX & Interaction Patterns

- **Item names wrap to at most two lines** instead of truncating, with the horizontal gap to the row's controls reduced
  to give the name back space.
- **At the narrow floor the management header's "+ Category" / "+ Item" buttons wrap to their own row** beneath the
  title, which takes the full width. Both keep their text labels; desktop is unchanged.
- **The whole shopping item row is one control**: one accessible name, one checked state, one tab stop, one keyboard
  activation, one mutation per activation. A scroll gesture begun on a row must not check the item — driven as a real
  pointer-down/move/up gesture, asserted on the mobile project.
- **The category filter stays a `Select`, made multiple**, with checkboxes in the menu and a summary in the closed
  control — not a chip row. Selecting nothing means all categories. Both list screens get that filter and the same
  case-insensitive name search, combined by AND; the shopping view's checked-status toggle (All / To buy / Done) stays
  shopping-only, and the shared component accommodates its absence rather than rendering it disabled.
- **Empty categories:** shown on the management screen when no filter or search is active (its "No items yet." row is
  where a first item gets added), hidden while filtering. The shopping view hides empty groups always.
- **Orphaned items** (category deleted out from under them) appear in a synthetic `Uncategorized` group on the
  management screen, where both edit (to re-categorise) and remove work. The group is absent when there are no orphans.
- **Category rename** opens a dialog pre-filled with the current name from an edit control beside the row's existing
  add-item and remove buttons, mirroring the item-edit idiom and the add-dialog's validation (required, 100-char max,
  validated on submit, Enter submits via a native form). Saving an unchanged name is a permitted no-op. The save must
  carry the full entity including the category's loaded `listId` — the backend sets `listId` unconditionally, so an
  omitted or wrong one moves the category to another list.

## Cross-Story Dependencies

- **8.1 → everything.** Story 8.1 delivers the retargeted viewport and both overflow helpers; 8.2 is its first consumer
  and must observe the clipping helper failing against the pre-fix layout. Every later story's gate runs on the
  retargeted project and reuses those helpers.
- **8.2 → 8.6.** Rename adds a third control (~40px) to a category row whose name was already truncating, so 8.6 is
  sequenced after the layout fix and must re-prove the row at 320px with both helpers.
- **8.4 ↔ 8.5.** Both touch the same two route components under the one-definition rule; 8.5's preservation of
  empty-category behaviour depends on 8.4's filter-active branch.
- **8.7 last.** The design spine is written after the implementation stories so it describes verified reality, and it
  cross-references anything 8.1's measurement filed rather than fixed. It also marks (not deletes) the two stale UX
  specs with superseded banners. It ships no code, so the production-artifact E2E bar is deliberately not applicable;
  its analogue is that every factual claim names the file it can be checked against.
- **8.5 files, does not fix, the orphan cause** — the non-cascading category delete with its client-side per-item loop —
  since making it atomic would need the unspent backend unfreeze and would not help existing orphans.
