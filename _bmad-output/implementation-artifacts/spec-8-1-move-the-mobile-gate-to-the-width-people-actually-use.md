---
title: 'Story 8.1: Move the Mobile Gate to the Width People Actually Use'
type: 'chore'
created: '2026-09-05'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done
route: 'dispatch'
review_loop_iteration: 2
context: []
baseline_commit: '3e6a1294b80982ad26a18c5af5c28321f3bcb4a8'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `mobile` Playwright project renders at 412px (`devices['Pixel 7']`), a width never chosen for a
reason. 66 specs have therefore never run below 412px, so narrow-viewport clipping — reports #2 and #3, both live on
`/lists/:id` today — reaches a phone instead of failing the gate.

**Approach:** Override only the `mobile` project's viewport width to the NFR-E8-1 floor of 320px, keeping the Pixel 7
descriptor; add the two AC4 geometry helpers to the shared support module; measure and report the newly-failing set at
`retries: 0` before any layout is touched. This story fixes no layout — Story 8.2 does.

## Boundaries & Constraints

**Always:**
- Keep exactly two viewport projects. The `@registration-toggle` chain's `dependencies: ['chromium', 'mobile']` must
  still name every project that registers users (Story 7.3's race).
- Retain the `devices['Pixel 7']` spread and override `viewport` only — the Chrome-on-Android UA and touch emulation
  are what the project exists for, and Story 8.3's scroll guard depends on the latter.
- Re-measure the structural invariant, never quote it. The figure in `playwright.config.ts`'s comment (120 = 59/59/1/1,
  dated 2026-08-11) is already stale; correct it in the same pass with today's date.
- Take AC1's measurement with `retries: 0` and record the count **and identity** of every newly-failing test before
  touching any layout.
- `expectNotClipped` must be **observed failing** against the item name and the list title at 320px. That observation
  is AC4's proof; record it, do not retry it away.

**Never:**
- No new Playwright project (AR-E8-2 is explicit that adding one is the wrong shape).
- No change under `bp_back/` — `git diff bp_back/` must be empty (AC5).
- No layout fix in this story. If a test goes red because the layout is wrong, that is the deliverable, not a bug to
  patch here.
- No `@seontechnologies/playwright-utils` import shapes — the package is not a dependency; vanilla `@playwright/test`
  is correct here.
- No toast, snackbar or banner (epic-wide, UX-DR-E8-10).

## Decisions

- **Three `data-testid` attributes are added under `bp_front/src/` in this story** (user decision, 2026-09-05):
  `data-testid="list-detail-title"` on `ListDetailPage.tsx:101`, `"category-name"` on `:158`, `"item-name"` on `:224`.
  Nothing else on those lines changes — the `noWrap` and the `maxWidth` caps stay, because they are AC4's red phase.
  Rejected: reaching the text elements structurally, which Story 8.2 would break.
- **AC3's "the total test count is unchanged" is read as being about projects, not the literal number** (user decision,
  2026-09-05) — its own subordinate clause is "since no project was added". `narrow-viewport.spec.ts` ships in this
  story and the total moves 134 → 148. What AC3 actually gates is the structural split: exactly two viewport projects
  with equal counts and exactly one test in each `registration-toggle-*`.
- **The beyond-AC control `[P1] expectNoHorizontalOverflow is capable of failing` is kept.** A document-level check
  that is green on every screen cannot be told apart from one wired wrong, and this is the only story that examines it.

</frozen-after-approval>


## Code Map

- `bp_front/playwright.config.ts` -- **change.** BOTH Pixel 7 projects (`mobile` and `registration-toggle-mobile`)
  are a bare `{...devices['Pixel 7']}`; give them a shared descriptor overriding `viewport.width` and `screen.width`
  to the floor, imported from `layout.ts` rather than repeated as a literal. The dated invariant figures in the comment block above `projects` (lines ~89-92)
  are stale and get today's re-measured row appended.
- `bp_front/e2e/support/layout.ts` -- **already written, review only.** Exports `NARROW_FLOOR_PX = 320`,
  `expectNotClipped(locator)` (asserts both axes — the vertical half is what survives Story 8.2's two-line clamp),
  `expectNoHorizontalOverflow(page)` and `expectInsideViewport(locator, label)` (NFR-E8-1's third clause, which
  neither of the others can see). One definition each, per NFR-E8-5.
- `bp_front/e2e/narrow-viewport.spec.ts` -- **already written, all tests `test.skip()`.** Un-skip per the activation
  order in its header. 7 as originally drafted; 8 after the falsifiability control was split in review Pass 1, and 14
  after Pass 2 added the config assertion, the two axis controls, the route sweep, the dialog case and the control
  containment case (see AC3). Locators for the three text elements are isolated in three arrow functions at the top of the file.

- `bp_front/src/routes/ListDetailPage.tsx` -- **change.** The list title, category name and item name Typographies;
  each `<Typography noWrap sx={{maxWidth: {xs: N, sm: M}}}>`. Cited by role rather than line number — the numbers moved
  once inside this story already, and Story 8.2 moves them again. Do not remove the caps
  or the `noWrap` — that is Story 8.2's fix and removing it here destroys AC4's red phase.
- `bp_front/e2e/support/ui.ts` -- **reuse, do not change.** `registerViaUi`, `uniqueUsername(prefix, label, project)`,
  `createListAndOpen`, `addCategory`, `addItem`, `PASSWORD`. Suite rule: fresh unique user per scenario, assert only on
  self-created data, never on totals.
- `_bmad-output/test-artifacts/atdd-checklist-8-1-....md` -- the red-phase rationale and the baseline measurement
  (2026-09-05: 134 = 66/66/1/1). Read it once for context; do not re-derive it.

## Design Notes

Why the red phase is the deliverable: `noWrap` compiles to `overflow: hidden` (MUI `Typography.js:88-90`), so a clipped
element never expands its ancestors and `document.documentElement.scrollWidth <= clientWidth` stays green while both
reported defects are on screen (AR-E8-3a). That is why the document-level check alone would have gated nothing, and why
`expectNotClipped` has to be *seen* failing before anyone relies on it.

Report #3 is a **squeeze, not an overflow**: `noWrap`'s `overflow: hidden` already resolves the title's automatic
minimum size to zero, so it collapses to an ellipsis while the two header buttons take the width. `minWidth: 0` is a
no-op here and must not be written as a fix.

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/playwright.config.ts` -- override the `mobile` project's viewport width to `NFR-E8-1`'s 320px while
      spreading `devices['Pixel 7']` -- AC2; keeps UA and touch emulation.
- [x] `bp_front/e2e/narrow-viewport.spec.ts` -- un-skip the two AC2 tests first and confirm both green -- proves the
      retarget landed before anything is measured against it.
- [x] measurement -- run `npx playwright test --project=mobile` with `retries: 0`; record the count and identity of
      every newly-failing test in Implementation Notes -- AC1, the story's binary acceptance condition.
- [x] **HALT and bring that list to the user** as a scoping decision (absorb into Epic 8, or file in
      `deferred-work.md`) -- AC1 makes the decision the user's, explicitly not this story's.
- [x] `bp_front/playwright.config.ts` -- re-measure with
      `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` and append today's dated row to the
      comment block -- AC3; the 2026-08-11 figure is stale by 14 and this is the story that touches the file.
- [x] `bp_front/src/routes/ListDetailPage.tsx` -- add the three `data-testid` attributes -- required by
      `expectNotClipped`, which measures the text element; nothing else on those lines changes.
- [x] `bp_front/e2e/narrow-viewport.spec.ts` -- un-skip the remaining tests; record the two `RED —` tests failing --
      AC4's proof. Do not fix the layout.
- [x] spec Implementation Notes -- record both measurements, the observed reds, and anything filed rather than fixed --
      AC1 and AC5 both require the record.

**Acceptance Criteria:**
- Given the retargeted config, when `page.viewportSize()` is read in the `mobile` project, then width is 320 and the
  UA still contains `Android` and `Chrome` with `maxTouchPoints > 0`.
- Given `--list` output, when the per-project split is counted, then there are exactly two viewport projects and
  exactly one test in each `registration-toggle-*` project.
- Given the shipped `/lists/:id` layout at 320px, when `expectNotClipped` runs against the item name and the list
  title, then both fail — and that failure is recorded, not retried.
- Given a short name at 320px, when `expectNotClipped` runs against title, category and item, then all three pass.
- Given the completed story, when the gates run, then `npm run lint` and `npm run build` pass and `git diff bp_back/`
  is empty.

## Implementation Notes

### HANDOFF — what Story 8.2 must deliver, and why it is more than the reports say

**The `/lists/:id` header title box measures 68px at a 320px viewport, and "Shop" needs 79.** Report #3 is not
"long titles truncate" — it is *every* title truncating, at a magnitude nobody had measured. Story 8.2's
acceptance must therefore include making
`[P0] DEFECT — even a SHORT list title is clipped at the floor (report #3, severity)` pass, that is, the header
must give the title a usable share of a 320px row. Relaxing the `maxWidth` caps will not do it: the 68px is a
flex-distribution result of the two header buttons taking the row, and `minWidth: 0` is a no-op here (frozen
Design Notes). The fix is to make the *buttons* yield.

Story 8.2 is told this mechanically, not by memory: each of the three defect assertions is an inverted
expectation, so a correct fix makes it fail with "expected promise to reject", naming the helper and element that
has started passing. Convert each back to a plain `await expectNotClipped(...)` as it goes green.

Story 8.2 also owes an update to `bp_front/e2e/item-editing.spec.ts` (FR40), which asserts
`whiteSpace === 'nowrap'` and `truncated === true` on the item name — it encodes report #2's defect as a
requirement, so a correct fix turns it red. Filed in `deferred-work.md` and commented at the call site.

The measurement and reasoning behind all of this are in "Finding — report #3 is worse than the spec assumed"
below.

### AC2 — the retarget (2026-09-05)

`bp_front/playwright.config.ts`, `mobile` project:

    const PIXEL_7_AT_FLOOR = {
      ...devices['Pixel 7'],
      viewport: {...devices['Pixel 7'].viewport, width: NARROW_FLOOR_PX},
      screen: {width: NARROW_FLOOR_PX, height: devices['Pixel 7'].viewport.height},
    }

The descriptor spread is retained and only the widths move; heights stay Pixel 7's. Applied to BOTH Pixel 7
projects — `registration-toggle-mobile` was left on the bare 412px descriptor in the first pass, which made
NFR-E8-2 untrue of the admin-panel half of FR20/FR21 (review Pass 2). `screen` is overridden alongside `viewport`
so `window.screen.width` and `max-device-width` queries do not keep reporting 412 while `innerWidth` is 320, and
the floor is imported from `layout.ts` so NFR-E8-5 is not broken by the story that establishes it. Confirmed green
before anything was measured against it:

    npx playwright test --project=mobile -g "320px floor|Chrome-on-Android"  →  2 passed

`[P0] the mobile project renders at the 320px floor` and `[P1] CONTROL — retargeting keeps Chrome-on-Android UA
and touch emulation` both pass, so the width moved and the UA/touch emulation survived.

### AC1 — newly-failing set at `retries: 0`: **ZERO**

Measured on the retargeted config, with the five clipping/overflow tests still `test.skip()` and **before** any
`src/` change:

    npx playwright test --project=mobile      →  68 passed, 5 skipped, 0 failed  (24.7s)

`retries` is `process.env.CI ? 2 : 0`, so a local run is the required `retries: 0` measurement.

**Count of newly-failing tests: 0. Identity: none.** Dropping the mobile gate from 412px to 320px broke no
existing test. There is consequently **nothing to scope** — nothing to absorb into Epic 8 and nothing to file in
`deferred-work.md`. The HALT task is discharged by an empty list, not skipped.

Read honestly, this is a statement about the *suite*, not about the product: the two defects Epic 8 exists for
are on screen at 320px and no shipped spec noticed, which is exactly AR-E8-3a's point and the reason
`expectNotClipped` had to be written.

### AC3 — structural invariant, re-measured 2026-09-05

    npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c
         80 chromium
         80 mobile
          1 registration-toggle-chromium
          1 registration-toggle-mobile

**162 = 80 / 80 / 1 / 1**, against a pre-story baseline of **134 = 66 / 66 / 1 / 1** (both figures are recorded
in the config comment, so the +28 is readable without re-deriving it). Exactly two viewport projects with equal
counts; exactly one test in each `registration-toggle-*`; `dependencies: ['chromium', 'mobile']` untouched. The
2026-08-11 row (120 = 59/59/1/1) was stale by 14 as predicted; today's rows are appended rather than replacing
it. The total moved because `narrow-viewport.spec.ts`'s 14 untagged tests ship here (+2 runs each).

**Reconciling the numbers.** The frozen Decisions block says "the total moves 134 → 148", written when the spec
carried 7 tests. The control split in review Pass 1 made it 8 (150), and Pass 2 added six more (162): the config
assertion, the two `expectNotClipped` axis controls, the route sweep, the dialog case and the control-containment
case. The frozen block cannot be edited, so the arithmetic is reconciled here. What AC3 gates is the structural
split, not the absolute total.

**13 of the 80 chromium tests are skips.** Every narrow-viewport test but the config assertion guards on
`testInfo.project.name !== 'mobile'`. The equal-counts invariant therefore counts tests that never execute, and
will count more as Epic 8 adds mobile-only specs — so the skip count is now recorded on the config's dated row
alongside the totals, rather than having to be re-derived.

### `data-testid` attributes added (frozen Decisions, 2026-09-05)

`bp_front/src/routes/ListDetailPage.tsx` — attribute added, nothing else on the line changed. `noWrap` and the
`maxWidth` caps are deliberately left in place: they are AC4's red phase.

| element | testid |
| --- | --- |
| list title `<Typography variant="h4" …>` in the `/lists/:id` header | `list-detail-title` |
| category name `<Typography variant="h6" …>` | `category-name` |
| item name `<Typography …>` | `item-name` |

Cited by role rather than line number: the attribute additions themselves moved every one of the numbers this
table first carried (101/158/224 → 106/169/236), which is the whole argument against quoting them.

### AC4 — the observed defects

All tests un-skipped and the assertions run; three failures were **observed and recorded before anything was
marked**. Recorded, not retried, not patched.

**THE DEFECTS (this is the deliverable):**

1. `[P0] DEFECT — a long item name is clipped at the floor (report #2)`
   `expectNotClipped` on `item-name` throws `text is clipped horizontally`.
2. `[P0] DEFECT — a long list title is clipped at the floor (report #3)`
   `text is clipped horizontally: "Weekly big shop for the whole household" (scrollWidth 619 > clientWidth 68)`
3. `[P0] DEFECT — even a SHORT list title is clipped at the floor (report #3, severity)`
   `text is clipped horizontally: "Shop" (scrollWidth 79 > clientWidth 68)` — the story's own finding, see below.

All three are **inverted expectations**, not `test.fail()`:

    await expect(expectNotClipped(loc)).rejects.toThrow(/text is clipped horizontally/)

The first pass used `test.fail()`. That was wrong for this job and was replaced in review Pass 2: `test.fail()`
reports a test as PASSING when it fails for ANY reason, so a broken `registerViaUi`, a backend 500 or a locator
timeout is indistinguishable from the clipping the test exists to document — the defect is asserted, but its
CAUSE is not. The inverted form pins both, and still exits zero, which the run needs for the same reasons as
before: a permanently-red `mobile` project makes any future regression indistinguishable from these planned
failures, and it strands both `registration-toggle-*` projects at "did not run" (they declare
`dependencies: ['chromium','mobile']`), leaving FR20/FR21 unverified on every run.

The Story 8.2 handoff survives the change and gets louder: fixing the layout makes each `rejects` assertion fail
with "expected promise to reject", naming the exact helper and element that has started passing.

**GREEN:** the AC2 config and runtime viewport tests, the Chrome-on-Android control, `[P0] the helper PASSES on
short category and item names (falsifiability control)`, the two `expectNotClipped` axis controls, `[P1] CONTROL —
the page does not scroll horizontally at the floor` (green while all three defects are on screen — AR-E8-3a,
exactly as predicted), `[P1] expectNoHorizontalOverflow is capable of failing`, the route sweep, the dialog case
and the control-containment case.

`npx playwright test --project=mobile e2e/narrow-viewport.spec.ts` → **14 passed**.

### Finding — report #3 is worse than the spec assumed, and it swallows AC4's falsifiability control

The `/lists/:id` header title box measures **68px wide at a 320px viewport**. That is not "a long title
truncates"; it is *every* title truncating. A four-character list name ("Shop", intrinsic width 79px) is already
clipped to an ellipsis. The two header buttons (`Category`, `Item`) plus `gap: 2` take essentially the whole row,
and `noWrap`'s `overflow: hidden` resolves the title's automatic minimum size to zero so it absorbs all of the
shortfall — the squeeze the frozen Design Notes describe, at a magnitude nobody had measured.

This broke AC4's falsifiability control, which asserted title → category → item in one test: it aborted on its
first line, so the category and item assertions never ran, `data-testid="category-name"` was exercised by nothing,
and the tree held **no committed proof that `expectNotClipped` can pass at all**. A helper that only ever fails is
exactly as hollow as one that only ever passes.

The control was therefore **split** (this is the +1 in AC3's count):

    [P0] the helper PASSES on short category and item names  → GREEN today, committed proof the helper can pass
    [P0] RED — even a short list title is not clipped         → the third expected red, test.fail()-marked

Measured directly: `category-name` "Veg" and `item-name` "Peas" both pass `expectNotClipped` at 320px, while
`list-detail-title` "Shop" reports `scrollWidth 79, clientWidth 68, offsetWidth 68`. So `expectNotClipped` is
proven to both fail and pass at the floor — a real gate, not a helper wired to reject everything. No layout was
touched and no assertion was weakened: the title half stays red **because the layout is wrong**, which the frozen
Boundaries make the deliverable ("If a test goes red because the layout is wrong, that is the deliverable, not a
bug to patch here").

(The consequence for Story 8.2 is stated at the top of these notes, where a reader meets it first.)

### AC5 — gates

| gate | result |
| --- | --- |
| `cd bp_front && npm run lint` | exit 0 |
| `cd bp_front && npm run build` | exit 0 (`tsc -b` clean, PWA bundle emitted) |
| `git diff --stat bp_back/` | empty |
| `npx playwright test --project=mobile --retries=0` | 80 passed (26.5s) |
| `npx playwright test --retries=0` (full suite) | 149 passed, 13 skipped, 0 failed (59.6s) |
| `npx playwright test --project=mobile --repeat-each=2 --retries=0` | 160 passed (49.6s) |

The whole suite is green, so the `registration-toggle-*` projects run normally instead of reporting "did not run"
behind a red dependency (the documented `dependencies` cost from Story 7.3). `narrow-viewport.spec.ts` contributes
13 skips in the `chromium` project — every test but the config assertion guards on
`testInfo.project.name !== 'mobile'`.

The `--repeat-each=2` row is AC1's measurement repeated (review Pass 2): a single 24.7s run is thin evidence that
a 92px narrower viewport introduced no flake, and CI runs at `retries: 2`, which would absorb exactly the
click-interception and scroll-into-view flake a narrower layout tends to produce. Two consecutive passes over
every mobile test at `retries: 0` is the record that the zero is real.

## Spec Change Log

- 2026-09-05, review Pass 2: no change to the frozen Intent, Boundaries or Decisions. Mutable sections updated to
  match what shipped — AC2 (both Pixel 7 projects, shared descriptor, `screen` override), AC3 (162 = 80/80/1/1,
  and the 148/150/162 reconciliation), AC4 (inverted expectations replace `test.fail()`), AC5 (three run rows
  including the repeat pass), the Code Map and the testid table (cited by role, not by line number), and the
  Handoff section promoted to the top of the Implementation Notes.

## Review Triage Log

Pass 1 (2026-09-05) — three layers: blind-hunter, edge-case-hunter, verification-gap.

| # | Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- | --- |
| 1 | Suite is permanently red; the three reds are indistinguishable from a regression, and `registration-toggle-*` reports "did not run" every run | high | Confirmed at `playwright.config.ts:67-70` — the config's own comment documents that a failed dependency project makes the dependent one "did not run". `admin.spec.ts:157` confirms the FR20/FR21 case is the only test writing `registrationEnabled`, so it is now unverified in a normal run. `test.fail()` still *observes* the failure and additionally fails the run if it unexpectedly passes. | patch |
| 2 | `expectNotClipped`'s pass side has no committed proof — the falsifiability control aborts on its first (title) assertion and the only pass evidence was a deleted probe | high | Implementation Notes record the control failing at `"Shop"` scrollWidth 79 > clientWidth 68, never reaching the category and item assertions. Grep confirms `expectNotClipped` has no other caller. Inverting the comparison in `layout.ts:56` would produce a byte-identical failure report. | patch |
| 3 | Test-file header announces "two tests are EXPECTED RED" while three are red | medium | Verified in `narrow-viewport.spec.ts:7-15`. The file a developer opens when the suite is red misstates its own expected state. | patch |
| 4 | The appended invariant row omits the pre-story baseline (134 = 66/66/1/1) that its "+14" is measured against | medium | Verified in the config diff. The comment block exists precisely to stop figures being quoted without their measurement; the baseline lives only in the ATDD checklist. | patch |
| 5 | The 320x839 viewport is not a real device and the config never says the height is deliberately Pixel 7's | low | Verified: only `width` is overridden. The epic's driver is a ~344px foldable cover display, which is short, not tall. A later reader could "fix" the aspect ratio. One comment line. | patch |
| 6 | Overflow probe is removed outside a `finally`, so a failing intermediate assertion leaves it in the page | low | Verified at `narrow-viewport.spec.ts:172-192`. Harmless (per-test context) but the cleanup is unconditional in intent and conditional in fact; the fix is a direct correction. | patch |
| 7 | The two edited JSX lines are the only >120-char lines among the file's multi-attribute elements | low | Verified: `ListDetailPage.tsx:101` (131 chars) and `:158` (137) got the attribute appended inline while `:85`, `:109`, `:118`, `:193`, `:200` break one attribute per line. No lint rule enforces it; Story 8.2 rewrites these elements, so the formatting becomes churn in that diff. | patch |
| 8 | `expectNotClipped` has no subpixel tolerance, so fractional text widths could produce 1px false reds | maybe-false (would be medium) | `scrollWidth`/`clientWidth` are integer-rounded, and the Pixel 7 descriptor carries `deviceScaleFactor: 2.625`, so the class is plausible — but no false red was observed in any run of this story. What would settle it: a 320px run showing `expectNotClipped` red at exactly 1px on text that is visibly not truncated. Adding a tolerance now would guard state never demonstrated, and would weaken the epic's only geometry gate. | defer |
| 9 | `data-testid={`item-row-${item.name}`}` matches twice when one list holds two same-named items in different categories — strict-mode violation | medium, pre-existing | Verified at `ListDetailPage.tsx:193`. Real, but introduced by Story 6.1 and not caused or exposed by this change; `narrow-viewport.spec.ts` uses unique names throughout. | defer |
| 10 | The 320px override applies to all mobile-project tests, not only the narrow-viewport spec | false | That is the requirement: NFR-E8-1 says the suite renders at 320px in a normal run, and AR-E8-2 forbids a scoped third project. | rejected |
| 11 | Three existing tests already ran below 412px, so "66 specs have never rendered below 412px" overstates the gap | low | Verified at `item-editing.spec.ts:395` and `navigation.spec.ts:289,481`; they set an *absolute* 360, so the assertions are unchanged by the retarget. **Reopened in Pass 2** — the retarget makes those calls WIDEN the viewport, so those surfaces are unmeasured at the floor. | rejected, superseded |
| 12 | `chromium` collects narrow-viewport tests that always skip, so "equal counts" counts tests that cannot run | low | Real and growing, but the invariant's job — mutual exclusion on the shared `registrationEnabled` document — still holds, and `testMatch`/`testIgnore` adds config complexity to an AC3 the story was told not to restructure. **Pass 2 took the cheaper half**: the skip count is now recorded on the config's dated row. | rejected, superseded |
| 13 | Spec frontmatter and `sprint-status.yaml` disagree on the story's state | low | Both were mid-workflow snapshots synced by the workflow's close-out step. **Reopened in Pass 2** — by then the spec said `done` and the file said `review`, and both were committed. | rejected, superseded |
| 14 | `epic-8-context.md` contradicts itself on whether Story 8.7 replaces or marks-superseded the stale UX specs; the "eight defects" have no index to the seven stories | low | Inherited from `epics.md` rather than introduced here, and Story 8.7 is where it resolves. **Reopened in Pass 2** — both were two-line fixes and the report index is the epic's most-used undefined term. | rejected, superseded |
| 15 | `sprint-status.yaml` stamps two distinct events at `"09-05-2026 12:00"` in an ambiguous non-ISO format | low | Pre-existing convention in that file's own history chain; this story added one row in the established shape. **Pass 2 corrected the format going forward** without rewriting the prior rows. | rejected, superseded |

Pass 2 (2026-09-05) — five lenses: adversarial, edge-case-hunter, verification-gap, editorial structure, editorial
prose. 47 findings; the table records what changed.

| # | Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- | --- |
| 1 | `registration-toggle-mobile` was never retargeted — it still spreads a bare `devices['Pixel 7']` at 412px, while the commit, this spec and the config comment all say the mobile gate moved | high | Verified in the config. NFR-E8-2's "the suite renders at the floor in a normal run" was untrue of the FR20/FR21 admin-panel half, and the file held two Pixel 7 projects at two different widths. | patch |
| 2 | `test.fail()` accepts ANY failure, so a broken helper, a backend 500 or a locator timeout is indistinguishable from the clipping the three reds document | high | Three lenses converged. The correct idiom was already in the same file at the overflow control. Replaced with `rejects.toThrow(/text is clipped horizontally/)`, which pins the cause and still exits zero. | patch |
| 3 | `list-detail-title` was observed only by tests required to fail, so deleting the attribute would have left the suite green and silently disarmed both title defects | high | Verified: both call sites sat under `test.fail()`, and `expectNotClipped` throws on its own `toBeVisible()`. A passing `toHaveText('Shop')` was added to the green control. | patch |
| 4 | `expectNotClipped` loses its only can-fail proof when Story 8.2 fixes the layout, and its vertical axis has never been observed doing anything | high | Verified: every target is `noWrap`, which truncates horizontally only. Two injected-probe controls added, one per axis, neither depending on the shipped layout. | patch |
| 5 | The 320px floor was defined twice — `NARROW_FLOOR_PX` and a bare literal in the config — breaking NFR-E8-5 in the story that establishes it, and making the AC2 assertion tautological | medium | Verified. The config now imports the constant. | patch |
| 6 | Only `viewport.width` was overridden, so `window.screen.width` and `max-device-width` kept reporting 412 | medium | Verified. `screen` is now set alongside, and asserted at runtime in AC2. | patch |
| 7 | All eight tests skipped on a project-name string, so renaming or dropping the `mobile` project would make the whole gate vanish into a green run | medium | Verified. A config-level assertion that runs in every project now fails if no mobile project is left, and covers both of them. | patch |
| 8 | Four tests shared the username label `floor` and two shared `fits` under `fullyParallel: true` | medium | `uniqueUsername` leans on `Date.now()`; two workers entering the same helper in the same millisecond collide. Each test now passes its own label. | patch |
| 9 | Helpers called `createListAndOpen` straight after `registerViaUi`, assuming the post-register landing route | low | `openListsViaMenu` is now called explicitly, so an FR38 landing change cannot break six scenarios for an unrelated reason. | patch |
| 10 | NFR-E8-1's third clause — "no interactive element is pushed off-screen" — had no assertion, and only `/lists/:id` was measured at all | medium | Neither shipped helper can see a control clipped inside an `overflow: hidden` ancestor, which is the shape Story 8.6 is predicted to create. `expectInsideViewport` added, plus a route sweep, a dialog case and a control-containment case. All green at 320 (measured, not assumed). | patch |
| 11 | The overflow probe had no guard that the document actually widened | low | A future `overflow-x: hidden` on body would make the control fail for the wrong reason. Non-vacuity assertions added to all three probes. | patch |
| 12 | Three inline copies of the helpers' measurements survived, including `row.locator('p').first()` — the structural path this spec warns against | medium | Verified in `item-editing.spec.ts` and `navigation.spec.ts`. Both now use `expectNoHorizontalOverflow`, and the item name is reached by its testid. | patch |
| 13 | `item-editing.spec.ts` (FR40) asserts `nowrap`/`ellipsis`/`truncated === true` — it encodes report #2's defect as a requirement, so a correct Story 8.2 fix turns it red | medium | Verified. Not fixable here (the replacement assertion depends on 8.2's layout); filed in `deferred-work.md` and commented at the call site. | defer |
| 14 | AC1's "zero newly-failing" rested on one 24.7s local run, and CI's `retries: 2` would absorb exactly the flake a narrower viewport introduces | medium | A `--repeat-each=2` pass over the whole mobile project was run at `retries: 0`: 160/160 green. Recorded in AC5. | patch |
| 15 | `sprint-status.yaml`'s key rename deleted Epic 7's per-story commit-hash evidence and the `STATUS VOCABULARY` block, while two surviving comments still point at that block and five `status: closed` rows use undefined vocabulary | high | Verified against `main`. 13 evidence comments and the vocabulary block reattached; the per-epic section headers restored. | patch |
| 16 | This spec said `status: done` while `sprint-status.yaml` said `review`, with `review_loop_iteration: 0` beside a populated Pass 1 log | medium | Both committed and in disagreement. Reconciled to `done`; iteration set to 2. | patch |
| 17 | Every line reference in the story artifacts was invalidated by the story's own edit (101/158/224 → 106/169/236; `item-row-` 193 → 205) | medium | Verified. All are now cited by testid or role, in this spec, `epics.md` and `deferred-work.md`. | patch |
| 18 | Triage row 5 says `320x915`; `devices['Pixel 7'].viewport` is `{412, 839}` | low | Verified against the config comment the row itself argues for. Corrected to 320x839. | patch |
| 19 | The frozen "134 → 148" and the notes' "150" had no stated relation, and `epics.md` AR-E8-2a said 59 specs where this spec measured 66 | medium | The frozen block cannot be edited; AC3 now carries the reconciliation, and `epics.md` was updated to the re-measured 66. | patch |
| 20 | An Epic 8 requirement (NFR-E8-6) was stamped retroactively onto the closed Story 7.5, contradicting the FR Coverage Map that scopes it to 8.1–8.6 | medium | Verified. Looks like a stray bulk edit; reverted. | patch |
| 21 | NFR-E8-1/NFR-E8-2 never reached `prd.md`, the requirements source of record — the same failure the 2026-07-30 `editHistory` entry records for NFR17/NFR18, in the other direction | medium | Added as NFR64/NFR65 under Responsive Design, with the cross-reference to the epic. | patch |
| 22 | `epics.md` NFR-E8-3 named only document-level overflow and bounding-box containment, omitting the load-bearing element-level clipping check | medium | Verified against AR-E8-3a and the shipped helpers. Rewritten to name all three, and to name the helper that implements each. | patch |
| 23 | Six stale-by-one-revision facts in `epics.md`: "four caps all in `ListDetailPage.tsx`" (three are), AR-E8-0's "FR60–FR62 / all three" (four), UX-DR-E8-9's "seven reports" (eight), AR-E8-7 described as an open ruling when it is settled | medium | Each verified against the document that carries the current value. All corrected. | patch |
| 24 | "Report #N" is the epic's most-used cross-reference and is defined nowhere | medium | Verified: `report #1` appears only as a consumer. An eight-item index now sits under the Epic 8 preamble and in `epic-8-context.md`, sourced from the UX-DRs and each story's `**Delivers:**` line. | patch |
| 25 | `deferred-work.md`'s two Story 8.1 entries were filed under an Epic 7 heading and were the only unwrapped entries in the file | medium | The file's access pattern is its heading index. Moved under their own dated heading, wrapped, and two more entries added. | patch |
| 26 | `epic-8-context.md` said Story 8.7 "replaces" the stale UX specs while its own dependencies section says "marks (not deletes)"; and "eight defects" was followed by seven stories with no mapping | low | Both verified in the compiled file. "Supersedes" now, and the report index carries the mapping. | patch |
| 27 | `prd.md` FR61 lacked the empty-category ruling `epics.md` FR61 carries; FR60–FR63 sit directly beneath FR48/FR49, which describe a design AR-E8-8 records as never shipped | low | The ruling is now summarised with a pointer, and FR48/FR49 carry superseded markers. | patch |
| 28 | Four nested-backtick code spans render broken in `epics.md`, `deferred-work.md` and this spec | low | Verified: the inner backtick closes the span. The correct double-backtick form was already used twice in the same file; the other four now match. | patch |
| 29 | Prose defects: "not the two that exist" (asserts the reported defects do not exist), "an ellipsis where the item is", "the space the cap was protecting", "never chosen for a reason", "items 2 and 3", an either/or followed by "if it is neither", and one US spelling among British ones | low | Each verified in place; all corrected. | patch |
| 30 | The Story 8.2 consequence — the 68px measurement — was buried 200 lines into this spec, and `## Design Notes` sat 200 lines after the ACs it explains | medium | Structural, not factual. Handoff promoted to the top of the Implementation Notes; Design Notes moved above Tasks & Acceptance; `## Spec Change Log` filled; `## Verification` reduced to the reproduction commands AC5 does not already carry. | patch |
| 31 | Losing 412px coverage entirely — a defect appearing only between 320 and 600 is now ungated | low | AR-E8-2's "320 holds ⇒ 412 holds" is the epic's accepted position, and no requirement names 412. Not acted on. | rejected |
| 32 | `expectNotClipped` has no subpixel tolerance | maybe-false | Unchanged from Pass 1 row 8, and the `--repeat-each=2` run produced no false red. Still deferred. | defer |

## Verification

Re-run these to reproduce AC5's table above, which carries the results:

    cd bp_front
    npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c   # 80/80/1/1
    npx playwright test --retries=0                                            # 149 passed, 13 skipped
    npx playwright test --project=mobile --repeat-each=2 --retries=0            # 160 passed
    npm run lint && npm run build                                              # exit 0
    git diff --stat bp_back/                                                   # empty

`retries` is `process.env.CI ? 2 : 0`, so a local run is the required `retries: 0` measurement, and
`tsconfig.e2e.json` type-checks the `e2e` tree under `npm run build` with `noUnusedLocals` on.
