---
title: 'Story 9.8 — The category filter menu can be closed on a phone'
type: 'feature'
created: '2026-09-22'
baseline_revision: 'c94670fd8e0ba2532e5219f40b50c87b3823df69'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md'
warnings: ['oversized']
deferred:
  - summary: >-
      A real category literally named "Uncategorized" and the synthetic orphan bucket still render the identical
      visible heading text, so a sighted or screen-reader user cannot tell the two groups apart on screen even though
      F5's fix makes their testids distinct.
    evidence: |-
      Story 9.8 (F5, AR-E9-14 in epics.md) de-keyed only the synthetic bucket's row *testid*
      (`category-row-__uncategorized__` / `shopping-group-__uncategorized__`) so automated locators no longer
      collide; the rendered `<Typography>` heading for both the real category and the synthetic bucket still reads
      literally "Uncategorized" (`ListDetailPage.tsx`'s `{group.name}`, `ListShoppingPage.tsx` equivalent). AR-E9-14
      scopes F5 to de-keying alone ("saveCategory gains no name rule"), so a visible-label fix (e.g. a reserved name,
      or a distinguishing icon/subtitle on the synthetic bucket) was explicitly out of this story's intent. The
      general name-keyed-testid collision class this belongs to is already tracked as an open, unassigned story in
      deferred-work.md (referenced from EXPERIENCE.md's "known defect, decided and re-filed" note); this entry is the
      narrower visible-label sibling of that same defect class, specific to the "Uncategorized" literal.
    location: >-
      bp_front/src/routes/ListDetailPage.tsx, bp_front/src/routes/ListShoppingPage.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The shared category filter's `multiple` `Select` menu (`ListFilters.tsx`) never self-closes, and at the
320px floor it covers most of the screen with no visible way to dismiss it short of Escape or an outside tap — neither
of which is discoverable. Separately, filtering `/lists/:id` to an explicitly selected EMPTY category drops that
category's card (F2), and a real category literally named "Uncategorized" collides, by testid, with the synthetic
orphan bucket of the same name (F5).

**Approach:** Add a sticky "Done" confirm control (`filter-category-confirm`) inside the menu, reachable without
scrolling at 320px with 30 categories, that closes the menu without reverting selections; outside-tap and Escape keep
working. Make `groupItemsByCategory`'s empty-category retention selection-aware on `/lists/:id` (AR-E9-14) so a
category explicitly filtered to stays rendered even when empty. De-key the synthetic bucket's row testid to its
sentinel key instead of its display name, so a same-named real category can never collide with it.

## Boundaries & Constraints

**Always:**
- The confirm control is defined once in `ListFilters.tsx` (NFR-E8-5); both `/list/:id` and `/lists/:id` get it for
  free through the shared component.
- Selections apply live as each category is toggled — the confirm control only closes the menu, it commits nothing
  extra and reverts nothing.
- Outside tap and Escape still close the menu with the same live-selection semantics as today; do not replace or gate
  that behaviour behind the new control.
- The shopping view (`/list/:id`, `keepEmpty: false`) keeps hiding every empty category regardless of selection — F2
  is a `/lists/:id`-only fix (AR-E9-14).
- Only the synthetic "Uncategorized" bucket's row testid changes (to its sentinel key); every real category's row
  testid keeps using its name — the ~60 existing name-keyed E2E assertions across the suite must keep passing
  unmodified.
- `saveCategory` gains no reserved-name rule; F5 is resolved purely by de-keying the rendered testid.
- Proven UI-driven on `chromium` and `mobile`; the 320px case is mobile-only, seeded with 30 categories created via
  the GraphQL API (`gql`/`saveCategory`, `node:crypto` `randomUUID`) — the same SETUP-ONLY idiom `seedItems` in
  `shopping.spec.ts` already uses — never through 30 add-category dialogs.

**Never:**
- Do not turn the category control into anything but the existing `multiple` `Select` (no chip row — UX-DR-E8-4
  stands).
- Do not touch `filter-checked*` or `filter-search`, or the checked-status toggle's absence on `/lists/:id`.
- Do not add a reserved-name rule to `saveCategory`/`EditCategoryDialog`.
- No toast/snackbar, no new dependency, no schema/backend change, no version bump (frontend-only).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Confirm at the floor | Menu open at 320px, 30 categories, on either list screen | `filter-category-confirm` fully visible with no menu scroll | No error expected |
| Confirm commits | Two categories toggled, `filter-category-confirm` activated | Menu closes, both stay selected, focus returns to `filter-category` | No error expected |
| Outside tap / Escape unchanged | Menu open, user taps outside or presses Escape | Menu closes, selections unchanged (unaffected by this story) | No error expected |
| Selected empty category, `/lists/:id` | "Zzz Empty" (0 items) + "Bakery" (stocked); filter to "Zzz Empty" only | "Zzz Empty" card and its add-item affordance render; other unselected empty categories stay hidden | No error expected |
| Selected empty category, `/list/:id` | Same filter, shopping view | The empty group stays hidden (unchanged shopping-view rule) | No error expected |
| Name collision | Real category "Uncategorized" + one orphaned item, either screen | Both groups render; the synthetic bucket's row testid is key-derived, so no locator matches two elements | No error expected |

</intent-contract>

## Code Map

- `bp_front/src/components/ListFilters.tsx:84-134` -- the `multiple` `Select`; today uncontrolled (no `open` prop).
  Make `open` controlled (local `useState`) so a footer button inside the menu can call `setOpen(false)` directly —
  `MenuItem`-cloned onClick handlers only fire for children carrying a `value` prop, so the confirm control must be a
  non-`MenuItem` child (e.g. `Divider` + `Box`/`Button`) closing via the controlled `open` state, not via selection.
  Position it `sx={{position: 'sticky', bottom: 0, bgcolor: 'background.paper'}}` as the LAST child so it stays
  reachable without scrolling the menu (UX-DR-E9-10). `data-testid="filter-category-confirm"`, visible label "Done".
- `bp_front/src/lib/lists/order.ts:132-174` -- `groupItemsByCategory`'s `keepEmpty: boolean` param is uniform across
  every category. Extend it so a caller can also keep specific empty categories (AR-E9-14 formula:
  `keepEmpty || <this category's id is in the caller's explicit selection>`). Keep the synthetic bucket's own `key`
  (`UNCATEGORIZED_KEY`, already sentinel-based, line 97/167) as the one thing the F5 fix hangs off — it never needs
  the selection check since it is never subject to `keepEmpty` (line 129-131 comment).
- `bp_front/src/routes/ListDetailPage.tsx:73-96,245` -- call site: pass `filter.categoryIds` into the extended
  `groupItemsByCategory` call so a selected-but-empty category survives even while `filterActive` (F2). Line 245's
  `data-testid={\`category-row-${group.name}\`}` must key off `group.key` instead of `group.name` ONLY when
  `group.category === null` (the synthetic bucket) — real categories keep the name-based testid unchanged (F5).
- `bp_front/src/routes/ListShoppingPage.tsx:398-403,530` -- `keepEmpty: false` call site is unaffected by F2 (shopping
  always hides empty groups); line 530's `data-testid={\`shopping-group-${group.name}\`}` needs the identical
  key-vs-name conditional as `ListDetailPage.tsx:245` (F5 applies to both surfaces).
- `bp_front/e2e/support/ui.ts:183-189` -- `withCategoryMenu` dismisses via `Escape` only; add a sibling
  `confirmCategoryMenu(page, body)` following the identical shape but activating `filter-category-confirm` instead,
  asserting the menu closed and (new) that focus landed back on `filter-category`. Do not change `withCategoryMenu`
  itself — Escape/outside-tap dismissal is still exercised by every existing caller.
- `bp_front/e2e/lists.spec.ts:368-434` -- the existing `FR61 — an EMPTY category is kept on /lists/:id…` test already
  builds the exact "stocked" + "empty" category fixture BRANCH 2a needs inverted: add a new branch that selects the
  EMPTY category itself (not the stocked one) and asserts its card and `add-item-in-category-button` still render —
  this is the AR-E9-14 case BRANCH 2a does not cover today.
- `bp_front/e2e/order.spec.ts:9-13` -- the header comment says re-keying the synthetic-bucket testid is out of the
  epic's scope; that is now stale for THIS story and must be corrected (the pure-function tests below it stay valid
  and need no change — they assert on `group.key`, already sentinel-based).
- `bp_front/e2e/narrow-viewport.spec.ts:944-991` -- the existing floor test for the category filter; add a 30-category
  case (new local `seedCategories` SETUP-ONLY helper via `gql`/`saveCategory`/`randomUUID`, same idiom as
  `seedItems`/`categoryIdOf` in `shopping.spec.ts:275-302`) asserting `filter-category-confirm` is inside the viewport
  with no menu scroll, and a confirm-then-focus-return case using the new `confirmCategoryMenu` helper.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` -- correct the category-filter description
  (menu now has a confirm control) if it names the menu's dismissal behaviour.
- `_bmad-output/implementation-artifacts/deferred-work.md:63-67` -- close both F2 and F5 in place with the
  `✅ CLOSED by Story 9.8 (2026-09-22): … Was: …` idiom (see Story 9.7's entries for the exact shape).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `9-8-…: backlog` → `review` at story close.

## Tasks & Acceptance

**Execution:**
- `bp_front/e2e/lists.spec.ts`, `bp_front/e2e/narrow-viewport.spec.ts` -- new/extended cases **written FIRST, run
  red**: confirm closes + commits + returns focus; the selected-empty-category branch; the 320px 30-category no-scroll
  case; the same-named-"Uncategorized" collision case (either screen). -- discharges FR61, AR-E9-14 through the UI.
- `bp_front/e2e/support/ui.ts` -- add `confirmCategoryMenu`. -- shared dismissal helper, mirrors `withCategoryMenu`.
- `bp_front/src/components/ListFilters.tsx` -- controlled `open` state + sticky `filter-category-confirm`. -- the
  confirm-control feature.
- `bp_front/src/lib/lists/order.ts` -- selection-aware empty-category retention. -- F2.
- `bp_front/src/routes/ListDetailPage.tsx`, `ListShoppingPage.tsx` -- pass selection into the call site (management
  screen only); key-vs-name testid conditional on both. -- F2 call site + F5.
- `bp_front/e2e/order.spec.ts` -- correct the stale out-of-scope comment. -- doc hygiene.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` -- same-commit doc correction if it describes
  the menu's dismissal.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- close F2 and F5 in place.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `9-8-…: review` at story close.

**Acceptance Criteria:**
- Given the category filter menu open on `/list/:id` or `/lists/:id` at 320px with 30 categories, when it renders,
  then `filter-category-confirm` is fully visible with no menu scroll.
- Given the open menu with categories toggled, when `filter-category-confirm` is activated, then the menu closes,
  every toggle remains applied, and focus returns to `filter-category`.
- Given the open menu, when the user taps outside it or presses Escape, then it closes and nothing reverts (unchanged
  from today).
- Given `/lists/:id` with an empty and a stocked category, when the user filters to the empty one only, then its card
  and its add-item affordance render, while other unselected empty categories stay hidden and `/list/:id` still hides
  every empty group regardless of selection.
- Given a real category named "Uncategorized" and an orphaned item on the same list, when either screen renders, then
  both groups render as two distinct, unambiguous testids.
- Given `npm run lint && npm run build`, then both are clean.

## Spec Change Log

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 15 findings — high 0, medium 1, low 9, false 5, maybe-false 0
- findings:
  - `[false]` `[reject]` Intent alignment: `epic-9-context.md` was rewritten epic-wide, beyond the 9.8 spec's own Code Map surface — refuted: step-01 of this workflow run regenerated the cached epic context because a planning artifact was newer, before any implementation began; it is a compiled cache, not authoritative documentation, and this exact class of finding was already raised and rejected on Story 9.7's review pass.
  - `[low]` `[patch]` Intent alignment: `EXPERIENCE.md` was never corrected, though the spec's own Code Map conditioned that only on it naming the menu's *dismissal* behaviour — it also states (§"Entity rows are keyed by NAME on both surfaces") that `category-row-<name>`/`shopping-group-<name>` are always name-keyed, which is now false for the synthetic bucket; added a one-sentence exception noting the F5 de-keying.
  - `[false]` `[reject]` Intent alignment: the F5 test reaches its precondition via `page.route()` interception rather than a "real" orphan — not a defect: the test's own comment already discloses and justifies this (Story 9.3 closed every reachable path to a real orphan; the one remaining path is a documented, out-of-scope backend storage bug), and it follows the same sanctioned technique `shopping.spec.ts`'s "rejected uncheck" test already uses.
  - `[false]` `[reject]` Intent alignment: the focus-return mechanism (`onExited` + `selectRef.current?.focus()`) is an empirically-derived workaround the spec's Design Notes didn't anticipate — not a defect, purely observational; the acceptance criterion (focus returns) holds, and the mechanism was independently verified correct against MUI's source by the edge-case layer.
  - `[low]` `[patch]` Blind: the new 320px/30-category confirm-visibility test only opens `/lists/:id`, never `/list/:id`, despite the spec's "either list screen" claim — extended the test to also check the confirm control at the floor on `/list/:id` with the same seeded categories.
  - `[low]` `[reject]` Blind: no test drives F2's selection-retention and AC4's search-narrowing together on two different categories in one pass — the two clauses are independent, already-tested `||` terms with no shared state, so the combined case is very unlikely to diverge from the two proven separately; the fix would need a new three-category, two-filter fixture for negligible risk reduction.
  - `[low]` `[patch]` Blind: `EXPERIENCE.md` not corrected (same root cause as the Intent-alignment row above) — same fix.
  - `[low]` `[reject]` Blind: no test drives the "Done" control by keyboard only — it is a plain MUI `Button`, natively Tab-reachable and Enter/Space-activatable by construction; the fix would add a new test for a near-zero-risk native-element path.
  - `[false]` `[reject]` Blind: `seedCategories` "ignores errors" and risks unescaped input — refuted on the error claim: it calls the shared `gql()` helper (`support/api.ts:34-45`), which already throws on a non-ok response or a `body.errors` payload, so a failed seed cannot silently proceed. The unescaped-interpolation shape matches the pre-existing `seedItems`/`categoryIdOf` idiom this story's own Code Map named as the pattern to follow, so it introduces no new risk.
  - `[low]` `[patch]` Blind: `groupItemsByCategory`'s new `selectedCategoryIds?.includes(...)` is an array scan inside a `.filter()` callback, inconsistent with the function's own "a Set, not a Map" convention a few lines above — converted to a `Set` built once before the `.filter()`.
  - `[low]` `[patch]` Blind: the F5 test hardcodes two literal UUIDs instead of `randomUUID()`, the idiom this story's other new fixtures (`seedCategories`) use — swapped for `randomUUID()` calls; harmless either way since the ids are only ever read from a client-side mocked response, never sent to the backend.
  - `[low]` `[reject]` Blind: no test confirms "Done" closes cleanly with zero categories toggled — there is no code path conditioned on selection count, so this is fully covered by construction by the existing zero-and-two-selection cases; the fix would add a test for no behavioural gain.
  - `[medium]` `[defer]` Blind: closing F5 only by testid still leaves a real category named "Uncategorized" and the synthetic orphan bucket rendering the identical visible heading text, so a sighted or screen-reader user still cannot tell the two groups apart — real, but out of this story's scope: AR-E9-14 (epics.md), the architecture decision this spec is built from, explicitly scopes F5 to de-keying alone ("resolved by de-keying... `saveCategory` gains no name rule"), and the visible-label collision predates this story.
  - `[false]` `[reject]` Blind: the spec's Code Map line-number citations (e.g. `ListFilters.tsx:84-134`) no longer match the diff's actual hunk locations — not a defect: the Code Map is a point-in-time planning aid for the implementer, not living documentation; no convention in this codebase re-derives a spec's citations after implementation shifts line numbers (e.g. Story 9.7's spec was left the same way).
  - `[low]` `[patch]` Edge: the new confirm control's `<Divider component="li"/>` and `<Box component="li">` are children of the Select menu's `role="listbox"` `<ul>` without `role="option"`, an invalid ARIA listbox child that some assistive tech may skip during virtual-cursor/arrow-key navigation — mitigated by Escape remaining a fully accessible, unaffected fallback (unchanged by this story), so graded `low` rather than `medium`; added `role="presentation"` to both wrapper elements so the nested `Button`'s own semantics are exposed correctly instead of being read as a malformed option.

Patched: 5 entries (all `low`). Deferred: 1 (`medium`). Rejected as `low`-not-worth-fixing: 3. Rejected on refutation (`false`): 5.

## Design Notes

**Why the confirm control must not be a `MenuItem`.** MUI's `SelectInput` clones each child and attaches its own
selection `onClick` only to children carrying a `value` prop; a plain element without one passes through untouched, so
it is safe to give it its own `onClick` that closes the (now controlled) `open` state — without risking the click also
being read as a category toggle.

**Why F5 only re-keys the synthetic bucket.** Re-keying every category row to `group.key` (the category id) would
touch roughly five dozen existing name-based E2E assertions across the suite for no behavioural gain — real categories
never collide with each other by construction (`byNameThenId`'s id tiebreak is about ORDER, not identity). Only the
synthetic bucket can collide, because its display name is a fixed literal (`UNCATEGORIZED_NAME`) a real category can
also be typed as. De-keying just that one row is the minimal fix AR-E9-14 asks for.

## Verification

**Commands:**
- `cd bp_front && npm run lint && npm run build` -- expected: clean.
- `cd bp_front && npm run test:e2e -- lists.spec.ts narrow-viewport.spec.ts shopping.spec.ts order.spec.ts` --
  expected: new/changed cases red before the change, green after, on `chromium` and `mobile`; every pre-existing case
  (especially the ~60 name-keyed category-row assertions) unmodified and green.
- `cd bp_front && npm run test:e2e` -- expected: full suite green against the rebuilt production image on `:2080`.

## Auto Run Result

Status: done

**Implemented change.** The shared category filter's `multiple` `Select` menu (`ListFilters.tsx`) gained a sticky
"Done" confirm control (`filter-category-confirm`) that closes the menu without reverting selections, reachable
without scrolling at 320px with 30 categories; outside-tap and Escape are unchanged. `groupItemsByCategory` gained
selection-aware empty-category retention so `/lists/:id` no longer drops a card the user explicitly filtered to just
because it is empty (F2), while `/list/:id` keeps hiding every empty group unconditionally. The synthetic
"Uncategorized" orphan bucket's row testid was re-keyed to its sentinel id so a real category literally named
"Uncategorized" can never collide with it by testid (F5); every real category keeps its name-based testid.

**Files changed.**

- `bp_front/src/components/ListFilters.tsx` — controlled `open` state, sticky non-`MenuItem` confirm footer
  (`role="presentation"` on its wrappers), explicit `onExited`-based focus restoration to the combobox.
- `bp_front/src/lib/lists/order.ts` — `groupItemsByCategory` takes an optional `selectedCategoryIds`, checked via a
  `Set` built once, additive to `keepEmpty`.
- `bp_front/src/routes/ListDetailPage.tsx` — passes the subset of `filter.categoryIds` that have no items anywhere on
  the list (computed from unfiltered items) into the extended call; synthetic-bucket-only key-vs-name testid.
- `bp_front/src/routes/ListShoppingPage.tsx` — same key-vs-name testid conditional; `keepEmpty: false` call site
  otherwise unchanged.
- `bp_front/e2e/support/ui.ts` — new `confirmCategoryMenu` helper, sibling of `withCategoryMenu`.
- `bp_front/e2e/lists.spec.ts` — extended the FR61 empty-category test with the selected-empty-category branch (F2);
  new F5 test proving two distinct testids for a real "Uncategorized" category vs. the synthetic bucket, on both
  screens, via `randomUUID()`-keyed fixtures.
- `bp_front/e2e/narrow-viewport.spec.ts` — new `seedCategories` API setup helper; the 320px/30-category no-scroll case
  (checked on both `/lists/:id` and `/list/:id`); the confirm/commit/focus-return case.
- `bp_front/e2e/order.spec.ts` — corrected the now-stale "out of scope" comment about re-keying testids.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` — one-sentence exception for the synthetic
  bucket's key-based testid.
- `_bmad-output/implementation-artifacts/deferred-work.md` — F2 and F5 closed in place.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `9-8-…: review`.
- `_bmad-output/implementation-artifacts/epic-9-context.md` — regenerated by step-01 because a planning artifact was
  newer than the cache (same mechanic as Story 9.7; not part of this story's behavioural surface).

**Review findings.** 15 findings across four layers (blind, edge-case, verification-gap, intent-alignment): 5 patched
(all `low`: `/list/:id` coverage for the 320px/30-category test, `EXPERIENCE.md` correction, a `Set` instead of an
array scan in `groupItemsByCategory`, `randomUUID()` instead of hardcoded literal UUIDs in the F5 test, `role="presentation"`
on the confirm control's non-`MenuItem` menu children for ARIA-valid listbox structure), 1 deferred (`medium`: a real
category named "Uncategorized" and the synthetic bucket still show the identical visible heading text — F5's fix is
testid-only per AR-E9-14's own scoping, not a visible-label fix; pre-existing, out of this story's scope), 3 rejected
as low-value (search+selection combined-filter test, keyboard-only "Done" test, zero-selection confirm test — each a
near-zero-risk path whose fix would add a disproportionate new fixture for negligible risk reduction), 5 rejected on
refutation (the `epic-9-context.md` rewrite is step-01's mandatory cache regeneration, not story scope; the F5 test's
network interception is disclosed and matches an established codebase pattern; the focus-restoration mechanism is a
correct, independently-verified implementation detail, not a defect; `seedCategories` does not ignore errors — the
shared `gql()` helper it calls already throws on any GraphQL error; the spec's Code Map line citations are a
point-in-time planning aid, not living documentation).

**Follow-up review recommended: false.** All five patched entries were `low` (patched counts: high 0, medium 0, low
5) — no `high` and fewer than two `medium` entries were patched.

**Verification.**

- `cd bp_front && npm run lint && npm run build` — clean, re-run after the review patches.
- `cd bp_front && npm run test:e2e -- lists.spec.ts narrow-viewport.spec.ts shopping.spec.ts order.spec.ts` — 108
  passed, 26 skipped (project-gated), 0 failed, re-run after the patches (one patch-introduced defect was caught and
  fixed here: the extended 320px/30-category `/list/:id` case initially asserted a `shopping-group-*` testid as its
  readiness check, but the shopping view never renders an empty category as a group — corrected to check the filter's
  own `filter-category-option-*` instead, which reflects loaded category data independent of item groups).
- `cd bp_front && npm run test:e2e` (full suite) — 254 passed, 26 skipped by design, 0 failed. One unrelated flake
  (`shopping.spec.ts:547`, a ONE_TIME-item subscription test untouched by this diff) failed once under parallel load
  and passed cleanly in isolation on re-run; not attributable to this change.
- Matrix audit: every I/O row has a covering test that ran and passed, on both projects where the row applies.

**Residual risks.** The deferred visible-label collision (a real "Uncategorized" category and the synthetic bucket
render the identical heading text) remains a genuine, if pre-existing and out-of-scope, source of confusion for a
sighted or screen-reader user on a list that happens to have both — recorded in `deferred-work.md`'s still-open
general name-keying ledger item rather than reopened as new work here.

