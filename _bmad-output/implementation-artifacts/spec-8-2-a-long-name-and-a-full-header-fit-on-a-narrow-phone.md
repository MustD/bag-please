---
title: 'Story 8.2: A Long Name and a Full Header Fit on a Narrow Phone'
type: 'bugfix'
created: '2026-09-05'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done
route: 'dispatch'
review_loop_iteration: 1
context: []
baseline_commit: '456500bbfd8acc7144d1715c9d2b9640f1f2e834'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On `/lists/:id` three `noWrap` + fixed-`maxWidth` Typographies clip silently at the narrow floor
(reports #2 and #3). Story 8.1 measured the header title box at **68px at 320px**, so *every* title truncates — "Shop"
needs 79px — and the item name is an ellipsis at `{xs: 150}`.

**Approach:** Delete all three fixed caps rather than retune them. The item and category names wrap to at most two
lines; the header's action buttons yield a row so the title gets the full width. Story 8.1's helpers are the gate —
no new test infrastructure.

## Boundaries & Constraints

**Always:**
- Remove the fixed pixel caps. The names take the room the flex row actually has (AR-E8-3).
- Bound the item name at **two lines**, so a pathological name cannot outgrow the controls beside it.
- Assert with `expectNotClipped` on the text element. A document-level overflow check cannot see this defect and must
  never be its gate (AR-E8-3a).
- Convert `narrow-viewport.spec.ts`'s three inverted `rejects.toThrow` defect assertions back to plain
  `await expectNotClipped(...)`, keeping each test's identity and report-# reference.
- Observe every new/converted assertion failing against the pre-fix layout before accepting it (NFR-E8-6).
- Desktop widths (`sm` and up) render as they do today.
- **Decision (user, 2026-09-05): the header wraps at the `xs` breakpoint**, not on a fit test. Below `sm` the title
  takes its own full-width row and the button `Stack` takes the row beneath it, on every phone width. Chosen over
  natural flex wrap because the break point would otherwise be a function of the list name's longest word, and a
  single long word could widen the row past the viewport.

**Never:**
- No `minWidth: 0` on the title as the header fix — `overflow: hidden` already resolved it to zero, so it is a no-op.
- No change under `bp_back/`; `git diff bp_back/` must be empty.
- No new E2E helper or spec file — Story 8.1 shipped the gate; this story consumes it.
- No toast, snackbar or banner (epic-wide, UX-DR-E8-10).
- Do not remove the app bar's username cap as a side effect (AR-E8-3 keeps it out of automatic scope).

</frozen-after-approval>

## Code Map

- `bp_front/src/routes/ListDetailPage.tsx` -- **the whole fix.** Three elements, cited by testid:
  - `list-detail-title` (`h4 noWrap maxWidth {xs: 200, sm: 460}`) in the header `Box` (`flex`, `space-between`,
    `gap: 2`) whose sibling is the `Stack` of `add-category-button` and `add-item-button`.
  - `category-name` (`h6 noWrap maxWidth {xs: 160, sm: 380}`) beside two IconButtons in a `space-between` `Box`.
  - `item-name` (`noWrap maxWidth {xs: 150, sm: 400}`) in `ListItemText`, in a `ListItem` whose controls come from the
    `secondaryAction` prop — absolutely positioned, so the text box is set by the `ListItem`'s padding, not by the
    controls' real width. "The room the flex row actually has" means name and control `Stack` as flex siblings
    instead. Delete the Story 6.1 comment explaining the 150px cap.
- `bp_front/e2e/support/layout.ts` -- **reuse, do not change.** `expectNotClipped` (both axes),
  `expectNoHorizontalOverflow`, `expectInsideViewport`.
- `bp_front/e2e/narrow-viewport.spec.ts` -- **change.** The three `[P0] DEFECT — …` tests hold inverted expectations
  that fail with "expected promise to reject" once the layout is right; convert them. Leave every `CONTROL` and
  `capable of failing` test alone — they are layout-independent and are what keeps the helpers honest.
- `bp_front/e2e/item-editing.spec.ts` -- **change (owed by this story, filed in `deferred-work.md`).** The FR40
  ~360px case asserts `truncated`/`nowrap`/`ellipsis` on `item-name`, encoding report #2 as a requirement. Its
  `nameBox.x + width <= editBox.x` check must survive the `secondaryAction` change.
- `bp_front/src/components/AppShell.tsx` -- **audit only (AC4).** `user-chip`'s username Typography,
  `noWrap maxWidth {xs: 140, sm: 220}`.

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/e2e/narrow-viewport.spec.ts` -- convert the three defect assertions and run them **first**, red --
      NFR-E8-6 requires each be seen failing against the pre-fix layout.
- [x] `bp_front/src/routes/ListDetailPage.tsx` -- header: remove the title's `noWrap` + cap; below `sm` the button
      `Stack` takes its own row -- AC2; the buttons yield, the title does not shrink.
- [x] `bp_front/src/routes/ListDetailPage.tsx` -- item row: remove the cap and `noWrap`, clamp to two lines, name and
      control `Stack` as flex siblings, reduced gap -- AC1.
- [x] `bp_front/src/routes/ListDetailPage.tsx` -- category row: same treatment -- AC3; the third instance of the
      construct goes with the other two.
- [x] `bp_front/e2e/item-editing.spec.ts` -- replace the truncation assertions with the wrapped-name expectation --
      the defect is no longer the requirement.
- [x] `bp_front/src/components/AppShell.tsx` -- measure the username chip at 320px with a long username; fix,
      confirm-correct, or file in `deferred-work.md` **with the measurement** -- AC4; it does not pass silently.
- [x] spec Implementation Notes -- record the pre-fix reds, post-fix greens, chip measurement and desktop evidence
      -- AC5.

**Acceptance Criteria:**
- Given an item name too long for one line at 320px, when the row renders, then it wraps to at most two lines before
  ellipsising, `expectNotClipped` passes, and it neither overlaps nor displaces the edit/remove controls.
- Given a long list name at 320px, when the header renders, then the title is not clipped, both action buttons keep
  their text labels and sit fully inside the viewport, and the page does not scroll horizontally.
- Given a long category name at 320px, when the row renders, then `expectNotClipped` passes on `category-name` and the
  row's two IconButtons stay inside the viewport.
- Given desktop width, when the header renders, then title and buttons share one row as they do today.
- Given the completed story, when the suite runs on `chromium` and `mobile` against the production image, then it is
  green with no inverted expectation left on `/lists/:id`, lint and build pass, and `git diff bp_back/` is empty.

## Implementation Notes

**Red first (NFR-E8-6).** All four converted assertions were run against the pre-fix layout at `456500b` and each was
seen failing for its own stated cause — no test was accepted on a green it had never earned:

| assertion | pre-fix failure |
| --- | --- |
| `item-name` @320 (report #2) | `text is clipped horizontally: "Semi-skimmed organic milk two litre bottle" (scrollWidth 317 > clientWidth 150)` |
| `list-detail-title` @320, long name (report #3) | `text is clipped horizontally: "Weekly big shop for the whole household" (scrollWidth 619 > clientWidth 68)` |
| `list-detail-title` @320, "Shop" (report #3, severity) | `text is clipped horizontally: "Shop" (scrollWidth 79 > clientWidth 68)` |
| `item-editing.spec.ts` FR40 @360 | `text is clipped horizontally: "Extra long semi skimmed organic milk carton …" (scrollWidth 465 > clientWidth 150)` |

The 68px in rows two and three is the same 68px Story 8.1 measured, reproduced independently here.

**The fix** (`ListDetailPage.tsx`, three elements, all three fixed caps deleted):

- *Header* — `flexDirection: {xs: 'column', sm: 'row'}`, so below `sm` the title takes a full-width row and the button
  `Stack` takes the row beneath it, on every phone width (the user's 2026-09-05 decision, not a fit test). The `Stack`
  carries `flexShrink: 0` so on the shared `sm`+ row the title wraps and the buttons keep their text labels. No
  `minWidth: 0` — as the frozen intent says, `overflow: hidden` had already resolved it to zero.
- *Item row* — the controls moved OFF the `secondaryAction` prop and became flex siblings of `ListItemText` inside the
  `ListItem` (`sx={{gap: 1}}`, `Stack` with `flexShrink: 0`). That is what makes "the room the flex row actually has"
  true: `secondaryAction` positions the controls absolutely, so the text box was set by the `ListItem`'s reserved
  padding and needed a hardcoded cap to stay clear of them. `ListItemText` is `flex: 1 1 auto; min-width: 0`
  (verified in `node_modules/@mui/material/ListItemText/ListItemText.js:50-51`), so it now takes exactly what is left.
  The name is bounded at two lines with the clamp from Design Notes, applied to the `Typography` that directly holds
  the text — so `expectNotClipped`'s height branch measures the real text box.
- *Category row* — cap and `noWrap` gone, icon `Box` given `display: flex; flexShrink: 0`. Deliberately NOT clamped:
  a category heading has no run of controls to outgrow, and a clamp there would trade an ellipsis for a vertical clip.
  The frozen "Always" bounds the ITEM name at two lines and requires only `expectNotClipped` for the category.
- All three text elements carry `overflowWrap: 'anywhere'` so a single unbreakable word cannot widen the row past a
  320px viewport — the failure mode the header decision's rationale names.

**Green after (post-fix, production image rebuilt).** Full suite `npx playwright test --retries=0`: **162 collected,
149 passed, 13 skipped, 0 failed** in 1.0m — the 13 skips are the expected `chromium` skips of the mobile-only
narrow-viewport tests (the count Story 8.1 recorded). No inverted expectation is left on `/lists/:id`; the three
converted tests keep their identity and report numbers and now read as the regression gate. Both falsifiability
controls and every `CONTROL` test were left untouched and stayed green.

**`item-editing.spec.ts` FR40 @360 — what replaced the truncation assertions.** `whiteSpace !== 'nowrap'`,
`-webkit-line-clamp === '2'`, and `1 < lines <= 2`. `expectNotClipped` is deliberately absent there: that test's
`longName` is pathological by construction (an "extra long" phrase plus a 13-digit uniqueness suffix) and wants three
lines at 360px — measured post-fix at `scrollHeight 66 > clientHeight 44`, i.e. the two-line bound doing precisely the
job the frozen intent gives it. Asserting "not clipped" on a name chosen to exceed the bound would assert the bound
away; that claim lives at the 320px floor in `narrow-viewport.spec.ts`, on names that fit. The
`nameBox.x + width <= editBox.x` no-overlap check survived the `secondaryAction` change unchanged and passes.

**Desktop evidence (AC4).** Measured on the production image with the long list/category/item names:

- 1280px: title `x 214, w 619, y 135.1`; `add-category` `x 862, y 137.8`; `add-item` `x 983, y 137.8` — one shared row
  (`|Δy| < title height`), title `scrollWidth === clientWidth === 619` and `scrollHeight === clientHeight === 42`
  (unclipped, one line), item name one line, page `scrollWidth === clientWidth === 1280`.
- 600px (the `sm` edge, the first width that takes the row layout): still one shared row — title wraps to two lines
  (84px) and both buttons keep their labels at `x 372` and `x 493`, fully inside; nothing clipped, no page overflow.

**App-bar username chip (AC4).** Measured at 320px with the 42-char username `averyveryverylongusernameindeed_…`:
chip box `x 120.6, w 180` → right edge 300.6 ≤ clientWidth 320, page `scrollWidth === clientWidth === 320`; the
username `Typography` is `scrollWidth 369 > clientWidth 140`, i.e. still an ellipsis. **Left as shipped and filed in
`deferred-work.md` with the measurement** — the app bar has no second row to give the name, the home link (~120px) and
avatar+gap (40px) leave the 140px cap as nearly the room that exists, and any real fix is a different treatment
needing a UX ruling (AR-E8-3 kept it out of automatic scope).

**Gates.** `npm run lint` exit 0; `npm run build` exit 0; `git diff --stat bp_back/` empty.

**Two clarifications the review asked for, recorded rather than argued.** (1) `overflowWrap: 'anywhere'` removes the
exact failure mode the frozen header decision cited as its reason — a single long word widening the row past the
viewport. The ruling still stands on its other leg: a breakpoint gives a break point that does not vary with the
longest word in the list name. The guard is now gated in its own right (an unbreakable-name case at the floor), which
is what keeps that leg honest. (2) "The buttons yield, the title does not shrink" is true BELOW `sm`, which is where
report #3 lives. Above `sm` the title still shrinks and wraps — the 600px measurement above shows it at two lines —
while `flexShrink: 0` on the button `Stack` is what stops the buttons compressing their own labels instead.

### Acceptance verification pass (2026-09-05, against the staged diff)

Four acceptance clauses were stated in the ACs but carried no assertion. Each now has one, and the two that could be
seen failing were seen failing — against the pre-fix layout, on a rebuilt production image, not by reasoning:

| clause | assertion added | pre-fix |
| --- | --- | --- |
| AC3 — a long CATEGORY name is not clipped at the floor | new `[P0] a long category name is fully readable at the floor`, plus `expectInsideViewport` on the row's two IconButtons | **RED**: `scrollWidth 341 > clientWidth 160` |
| AC4 — desktop keeps title and buttons on one row | new `[P1] above the breakpoint the header keeps title and buttons on one row` (skips on `mobile`, the file's only assertion above `sm`) | **RED on its `expectNotClipped` line**: `scrollWidth 619 > clientWidth 460` at 1280px |
| AC2 — both buttons keep their text labels and stay inside the viewport | four assertions appended to the long-title test | green pre-fix (a guard) |
| AC1 — the name does not run under its controls at the FLOOR | `nameBox.x + width <= editBox.x` appended to the item-row controls test | green pre-fix (the cap did it) |

**Finding — "at desktop widths the header is unchanged" is not literally true, and should not be.** The desktop test
was written expecting a pure control and its geometry half is one; its `expectNotClipped` line was not. At 1280px the
pre-fix title clipped at `619 > 460` — the `sm: 460` cap truncated long list names on a desktop screen with ~800px of
empty row beside them. Report #3 was filed from a phone, but the same construct was truncating titles everywhere.
Removing the caps rather than retuning them (AR-E8-3) fixes both, and the AC's "unchanged" is true of what it was
about — the row structure, which still puts title and buttons side by side above `sm`.

**Structural invariant re-measured** (the practice Story 8.1's config comment asks for, since this story changes the
counts), FINAL, after the review patches: `168 = 83 / 83 / 1 / 1`, against Story 8.1's `162 = 80 / 80 / 1 / 1` —
**+3 untagged tests at +2 runs each = +6 runs**. **16 skips, and for the first time they are not all in one
project**: 15 in `chromium` (the mobile-only narrow-viewport tests) and 1 in `mobile` (the above-the-breakpoint header
test, which inverts the usual guard). Row appended to `playwright.config.ts` with that split. An earlier draft of both
this note and that row said "+4 untagged tests at +2 runs each" — wrong in both terms, caught by two review layers
independently; the check is `tests × 2 = the delta in the total`.

**Independently re-run after the review patches** — `npx playwright test --retries=0`: **152 passed, 16 skipped,
0 failed** (1.1m) against a freshly rebuilt production image; `npm run lint` and `npm run build` exit 0;
`git diff --stat bp_back/` empty.

**One flake observed, unrelated to this story.** The first post-addition full run failed
`[chromium] item-attribution.spec.ts FR45/FR58` on `getByTestId('shopping-item-addedby-<renamed>')` not appearing
within 5s. That testid is on the SHOPPING view (`/list/:id`), which this story does not touch, and the spec passed on
an immediate isolated re-run and in the following full run. Recorded rather than retried away, and filed.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-09-05) — three layers: blind-hunter, edge-case-hunter, verification-gap. 31 findings.

| # | Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- | --- |
| 1 | The header's `xs` row-wrap — the actual fix for report #3 — is pinned by no assertion that can fail; the two converted title tests gate only the re-introduction of `noWrap` | high | Demonstrated, not argued: with the pre-fix single-row header restored at 320px and `noWrap` still gone, the title collapses to the reported 68px column and grows to 504px tall — `scrollWidth 68 === clientWidth 68`, `scrollHeight 504 === clientHeight 504`, page `320 === 320`, both buttons inside with labels intact. Every assertion in both tests is green while report #3's squeeze is back on screen. | patch |
| 2 | Same root cause, reached from the other side: after the fix the title and category name carry no `overflow: hidden`, so both `expectNotClipped` comparisons are equalities by construction — structurally unfalsifiable | high | Grouped with #1: one defect (the converted assertions measure clipping, and the fix removed the mechanism that produces clipping), one fix. | patch |
| 3 | `overflowWrap: 'anywhere'` — the guard the frozen header decision was chosen for — is exercised by no test: every name in the suite is multi-word and wraps on spaces regardless | medium | Measured: a list named `Supercalifragilisticexpialidociousaurusrexinatorium` at 320px renders `288 === 288` as shipped; with `overflowWrap` set back to `normal`, title `scrollWidth 760 > clientWidth 288` and page `776 > 320` — a real NFR-E8-1 violation that ships undetected. | patch |
| 4 | The `noWrap` + fixed-`xs`-cap census stops at four. `ListsPage.tsx:195` (list name, `{xs: 200, sm: 420}`) and `AdminPage.tsx:200` (username cell, `{xs: 140, sm: 260}`) are the same construct and are named nowhere | medium | Verified by grep and by measurement: at 320px the `/lists` row name is `scrollWidth 380 > clientWidth 200` with `white-space: nowrap` — a clipped list name on the first authenticated screen — while the route sweep's document-level check passes over it (AR-E8-3a, exactly). | patch (the census claim) + defer (the fix) |
| 5 | The long-item and long-category floor tests assert `expectNotClipped` on the name and `expectInsideViewport` on the CONTROLS, but never `expectNoHorizontalOverflow(page)` nor containment of the name element itself — the epic's "three assertions, three jobs" rule applied unevenly | medium | Verified in the file; only the long-title test carries all three. With the caps gone, the name element is the box most able to escape the viewport and is the one thing unchecked. | patch |
| 6 | `item-editing.spec.ts` FR40 @360: `lines <= 2` is tautological (derived from `clientHeight`, which the clamp already bounds), `parseFloat(lineHeight)` is `NaN` if the computed value is `normal`, the assertions pin the CSS technique rather than the behaviour, and horizontal clipping is no longer asserted at all | medium | All four verified in the diff; three layers converged on the same block. The measurement the spec quotes (`scrollHeight 66 > clientHeight 44`) is the one that would actually prove the clamp is working, and it is not asserted. | patch |
| 7 | No coverage between 320px and 1280px, so the breakpoint itself is untested — moving `flexDirection` from `sm` to `md` leaves both tests green and puts the two-row header on every tablet. The desktop test also never asserts the width it runs at | medium | Verified: assertions exist only at the two project viewports, and the 600px evidence in the Implementation Notes is a manual measurement. | patch |
| 8 | This session's `epic-8-context.md` recompile deleted the `## Reports` section — by its own text "where the numbering is defined" — while ~26 live `report #N` references remain in specs, tests, source comments and `epics.md` | high | Verified in the diff. The index was added deliberately at Story 8.1 review Pass 2 (its triage row 24: "the epic's most-used cross-reference and is defined nowhere"). The recompile regenerated from planning artifacts and dropped it, re-opening a closed finding. | patch |
| 9 | The same recompile deleted the UX contract bullets for item-name wrapping and the header button row — in the commit that implements them — and for Story 8.3's single-control row | medium | Verified in the diff. Story 8.7 is chartered to describe the shipped design from these documents and now has less to work from than before the story that shipped it. | patch |
| 10 | The recompile tightened the floor constraint to an unqualified "no text is clipped", which the same diff's accepted chip deferral violates | medium | Verified: prior wording was "no control is clipped". The chip is measured in this diff at `scrollWidth 369 > clientWidth 140` and left as shipped, so the epic now carries a constraint a recorded decision breaks. | patch |
| 11 | `playwright.config.ts` and the spec both record "+4 untagged tests, +2 runs each" against 162 → 166 | medium | Arithmetic error, verified: the diff adds exactly TWO tests; 2 × 2 projects = +4 runs. 4 tests would have been 170. Two layers caught it independently. | patch |
| 12 | The new category test's code comment records the pre-fix red as `scrollWidth 322`; the spec's verification table records `341` for the same assertion | low | Verified: the measured value in this session's run was 341. The comment is the copy a future reader trusts. | patch |
| 13 | `edge="end"` on the remove-item `IconButton` is vestigial now that the controls are ordinary flex siblings — it applies `marginRight: -12px`, making the item row's right inset inconsistent with the category row above it | low | Verified: `edge` exists for the `secondaryAction` context the controls left. Direct deletion, no added surface. | patch |
| 14 | The `deferred-work.md` closure entry strikes through `source_spec:` and then re-emits a second `source_spec:` line inside the same record, duplicating the key any reader walking the triples follows | low | Verified against the file's existing closure shape. Direct correction. | patch |
| 15 | `sprint-status.yaml` still reads `in-progress` with a comment saying "implementation started", while the spec is `in-review` with the work done — the exact divergence the file's own 16:00 row was written to complain about | medium | Verified. Reconciled at close, with evidence, rather than left for the next session to find. | patch |
| 16 | The `epic-8-context.md` rewrite is unscoped work inside a story diff — not in the spec's Code Map, Tasks or Change Log | low | True as filed, and the mechanism is worth recording: step-01 recompiles the epic context whenever any planning artifact is newer than it, so a story that touches no planning document can still carry a full context rewrite. Findings 8–10 are its consequences and are patched; the process point is recorded here rather than acted on. | rejected (recorded) |
| 17 | A desktop assertion now lives in `narrow-viewport.spec.ts` under a describe titled "Story 8.1: the narrow viewport gate" | low | Real naming friction, but the frozen Boundaries forbid a new spec file, and renaming the describe would rewrite Story 8.1's identity in the reporter. The cost is one comment block; the alternative is a scope violation. | rejected |
| 18 | An item name needing more than two lines is ellipsised with no way to read it in full (no `title` tooltip / expand) | low | Not a defect: the frozen intent bounds the name at two lines *and* says it ellipsises past that. The fix adds a new affordance the story was not asked for. | rejected |
| 19 | A 100-character single-word category name grows the heading unbounded vertically, pushing items down | low | Verified as behaviour, rejected as a defect: NFR-E8-1 is about horizontal overflow, clipping and off-screen controls. Vertical growth scrolls, which is what a page does. | rejected |
| 20 | A browser without `overflow-wrap: anywhere` support would let an unbreakable word overflow | low | The gate runs Chromium against the production image, and the property is baseline in every engine the app targets. Guarding it adds a second declaration for state never demonstrated. | rejected |
| 21 | AC4 is triple-booked — the chip audit, the desktop criterion, and Story 8.1's unrelated AC4 all carry the label; the chip audit has no criterion of its own | low | Real cross-reference friction, but the only fix is to renumber this build's acceptance criteria, and a finding whose fix is to edit this build's spec is out of bounds by the review's own rule. | rejected |
| 22 | The task line "the buttons yield, the title does not shrink" is imprecise: above `sm` the title still shrinks and wraps | low | Verified against the 600px measurement, and same rejection as #21 — the text is this build's spec. Clarified in the notes above instead. | rejected |
| 23 | `overflowWrap: 'anywhere'` removes the very failure mode the frozen header decision cited as its reason, and nothing records that | medium | Verified and accepted as a fair reading. The decision stands on its other leg (a deterministic break point rather than one that varies with the longest word), and #3's new test is what keeps the guard honest. Recorded in the notes rather than reopened, since the frozen block cannot be edited and the ruling is unchanged. | rejected (recorded) |

### Patch evidence — the seven `patch` entries above, as executed

`review_loop_iteration` is `1`. No loopback occurred: every routed entry was a `patch`, so the code was never reverted
and re-derived. The counter is used here the way Story 8.1 used it — one increment per review pass.

**Review iteration 1 (2026-09-05) — 7 findings, all accepted and fixed.** Each new or changed assertion was observed
red against a build that carries the specific defect it claims to catch, per NFR-E8-6:

1. *The two title tests could not fail on the actual fix.* Confirmed: with the pre-fix SINGLE-ROW header and `noWrap`
   merely left off, `overflowWrap: 'anywhere'` resolves the title's min-content width to one character, so it collapses
   to report #3's column and every assertion stays green. Added floor geometry to the long-title test — the button
   `Stack` sits below the title, both buttons share that row, and the title spans its container to within 1px.
   **Observed red on that build:** `the buttons must take their OWN ROW below the title (title bottom 622.9, button top
   352.75)`, with every preceding assertion green — the defect reproduced exactly as reported.
2. *`overflowWrap: 'anywhere'` was exercised by nothing.* Added `UNBREAKABLE_LIST_NAME` and a `[P0]` floor case
   asserting `expectNotClipped`, `expectInsideViewport` and `expectNoHorizontalOverflow` on the title. **Observed red
   with `overflowWrap` removed from the title:** `scrollWidth 760 > clientWidth 288`, and the page measured at
   `776 > 320` on the same build — both figures verified first-hand, not carried over from the review.
3. *The long-item and long-category floor tests never asserted page overflow or the name's own containment.* Added
   `expectInsideViewport` on the name element and `expectNoHorizontalOverflow(page)` to both — the widened element is
   the one now able to escape, and a clipping check cannot see position.
4. *Wrong number in the long-category comment.* Corrected 322 → 341. **Verified** by restoring that cap:
   `scrollWidth 341 > clientWidth 160`.
5. *The above-the-breakpoint test asserted no width and nothing covered the boundary.* It now asserts its own viewport
   width is `>= SM_BREAKPOINT_PX` and drives the boundary with `setViewportSize`: at 599px the buttons take their own
   row, at 600px they share one. **Observed red with the header's breakpoint moved `sm` → `md`:** `at sm (600px): the
   buttons sit beside the title, not beneath it` — while 320px and the project's 1280px both stayed green, which is the
   blind spot the finding names.
6. *The FR40 @360 replacement pinned CSS rather than behaviour.* Replaced with outcomes: not clipped horizontally
   (`scrollWidth <= clientWidth`), actually wrapped (`> 1` line), actually bounded (`scrollHeight > clientHeight`, the
   66 vs 44 already recorded). `parseFloat(lineHeight)` is now guarded by an explicit `Number.isFinite` assertion, so a
   computed `normal` fails loudly instead of counting `NaN` lines.
7. *`edge="end"` on the remove-item `IconButton` was vestigial* now that the controls are ordinary flex siblings —
   dropped, so the item row's right inset again matches the category row's `px: 2` above it.

**Post-triage run:** `npx playwright test --retries=0 e2e/narrow-viewport.spec.ts e2e/item-editing.spec.ts` — 54
collected, **38 passed, 16 skipped, 0 failed**; `npm run lint` and `tsc -b` exit 0. Wider verification is the
coordinator's.

## Design Notes

The two-line bound replaces `noWrap` with a line clamp, which truncates **vertically** — so `expectNotClipped`'s
height branch, never yet observed against the app, becomes the load-bearing half here:

    sx={{display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden'}}

A name that fits in two lines must satisfy `scrollHeight <= clientHeight`; if the clamp is applied where the element's
box is not the text box, that comparison silently passes on a clipped name.

## Verification

**Commands:**
- `cd bp_front && npx playwright test --retries=0` -- expected: green, no new skips.
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0.
- `git diff --stat bp_back/` -- expected: empty.

**Manual checks:**
- `/lists/:id` at 320px and at desktop width, with a long list, category and item name.
