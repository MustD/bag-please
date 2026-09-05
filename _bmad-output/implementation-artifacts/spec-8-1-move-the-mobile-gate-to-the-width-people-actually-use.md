---
title: 'Story 8.1: Move the Mobile Gate to the Width People Actually Use'
type: 'chore'
created: '2026-09-05'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done
route: 'dispatch'
review_loop_iteration: 0
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

- `bp_front/playwright.config.ts` -- **change.** `mobile` project at line ~103 is `{...devices['Pixel 7']}`; add a
  `viewport` override to 320px width. The dated invariant figures in the comment block above `projects` (lines ~89-92)
  are stale and get today's re-measured row appended.
- `bp_front/e2e/support/layout.ts` -- **already written, review only.** Exports `NARROW_FLOOR_PX = 320`,
  `expectNotClipped(locator)` (asserts both axes — the vertical half is what survives Story 8.2's two-line clamp) and
  `expectNoHorizontalOverflow(page)`. One definition each, per NFR-E8-5.
- `bp_front/e2e/narrow-viewport.spec.ts` -- **already written, all 7 tests `test.skip()`.** Un-skip per the activation
  order in its header. Locators for the three text elements are isolated in three arrow functions at the top of the file.

- `bp_front/src/routes/ListDetailPage.tsx` -- **change.** Line 101 list title,
  158 category name, 224 item name; each `<Typography noWrap sx={{maxWidth: {xs: N, sm: M}}}>`. Do not remove the caps
  or the `noWrap` — that is Story 8.2's fix and removing it here destroys AC4's red phase.
- `bp_front/e2e/support/ui.ts` -- **reuse, do not change.** `registerViaUi`, `uniqueUsername(prefix, label, project)`,
  `createListAndOpen`, `addCategory`, `addItem`, `PASSWORD`. Suite rule: fresh unique user per scenario, assert only on
  self-created data, never on totals.
- `_bmad-output/test-artifacts/atdd-checklist-8-1-....md` -- the red-phase rationale and the baseline measurement
  (2026-09-05: 134 = 66/66/1/1). Read it once for context; do not re-derive it.

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

### AC2 — the retarget (2026-09-05)

`bp_front/playwright.config.ts`, `mobile` project:

    use: {...devices['Pixel 7'], viewport: {...devices['Pixel 7'].viewport, width: 320}},

The descriptor spread is retained and only `viewport.width` moves; height stays Pixel 7's. Confirmed green
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
         74 chromium
         74 mobile
          1 registration-toggle-chromium
          1 registration-toggle-mobile

**150 = 74 / 74 / 1 / 1**, against a pre-story baseline of **134 = 66 / 66 / 1 / 1** (both figures are recorded
in the config comment, so the +16 is readable without re-deriving it). Exactly two viewport projects with equal
counts; exactly one test in each `registration-toggle-*`; `dependencies: ['chromium', 'mobile']` untouched. The
2026-08-11 row (120 = 59/59/1/1) was stale by 14 as predicted; today's rows are appended rather than replacing
it. The total moved because `narrow-viewport.spec.ts`'s 8 untagged tests ship here (+2 runs each), per the frozen
decision on AC3 — 8 rather than the 7 originally written, because the falsifiability control was split in review
(below).

### `data-testid` attributes added (frozen Decisions, 2026-09-05)

`bp_front/src/routes/ListDetailPage.tsx` — attribute added, nothing else on the line changed. `noWrap` and the
`maxWidth` caps are deliberately left in place: they are AC4's red phase.

| line | element | testid |
| --- | --- | --- |
| 101 | list title `<Typography variant="h4" …>` | `list-detail-title` |
| 158 | category name `<Typography variant="h6" …>` | `category-name` |
| 224 | item name `<Typography …>` | `item-name` |

### AC4 — the observed reds

All tests un-skipped and the assertions run; three fail against the shipped layout, and all three failures were
**observed and recorded before anything was marked**. Recorded, not retried, not patched.

**RED (expected — this is the deliverable):**

1. `[P0] RED — a long item name is not clipped at the floor (report #2)`
   `expectNotClipped` on `item-name` fails at `layout.ts:56`.
2. `[P0] RED — a long list title is not clipped at the floor (report #3)`
   `text is clipped horizontally: "Weekly big shop for the whole household" (scrollWidth 619 > clientWidth 68)`
3. `[P0] RED — even a short list title is not clipped at the floor (report #3, severity)`
   `text is clipped horizontally: "Shop" (scrollWidth 79 > clientWidth 68)` — the story's own finding, see below.

All three carry Playwright's **`test.fail()`**, not `test.skip()`: the assertion still executes and is still
required to fail, so AC4 keeps its evidence, while the run exits zero. That matters for reasons beyond tidiness —
a permanently-red `mobile` project makes any future regression indistinguishable from these planned reds, and it
strands both `registration-toggle-*` projects at "did not run" (they declare `dependencies: ['chromium','mobile']`),
leaving FR20/FR21 unverified on every run. It also hands Story 8.2 a hard signal: fixing the layout makes these
report "expected to fail, but passed" and turns the run red until the marks are removed.

**GREEN:** the two AC2 viewport tests, `[P0] the helper PASSES on short category and item names (falsifiability
control)`, `[P1] CONTROL — the page does not scroll horizontally at the floor` (green while all three defects are
on screen — AR-E8-3a, exactly as predicted), and `[P1] expectNoHorizontalOverflow is capable of failing`.

`npx playwright test --project=mobile e2e/narrow-viewport.spec.ts` → **8 passed** (3 of them as expected
failures).

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

**Consequence for Story 8.2:** its acceptance must include making
`[P0] RED — even a short list title is not clipped at the floor (report #3, severity)` green, i.e. the header must
give the title a usable share of a 320px row — not merely making the two long-name reds green. A fix that only
relaxes the `maxWidth` caps will not do it; the 68px is a flex-distribution result, and `minWidth: 0` is a no-op
here (frozen Design Notes). All three reds are `test.fail()`-marked, so 8.2 will be told by an
"expected to fail, but passed" failure rather than having to remember.

### AC5 — gates

| gate | result |
| --- | --- |
| `cd bp_front && npm run lint` | exit 0 |
| `cd bp_front && npm run build` | exit 0 (`tsc -b` clean, PWA bundle emitted) |
| `git diff --stat bp_back/` | empty |

With the three reds `test.fail()`-marked the suite exits **zero**, so the `registration-toggle-*` projects run
normally instead of reporting "did not run" behind a red dependency (the documented `dependencies` cost from
Story 7.3). `narrow-viewport.spec.ts` contributes 8 skips in the `chromium` project — each test guards on
`testInfo.project.name !== 'mobile'`.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-09-05) — three layers: blind-hunter, edge-case-hunter, verification-gap.

| # | Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- | --- |
| 1 | Suite is permanently red; the three reds are indistinguishable from a regression, and `registration-toggle-*` reports "did not run" every run | high | Confirmed at `playwright.config.ts:67-70` — the config's own comment documents that a failed dependency project makes the dependent one "did not run". `admin.spec.ts:157` confirms the FR20/FR21 case is the only test writing `registrationEnabled`, so it is now unverified in a normal run. `test.fail()` still *observes* the failure and additionally fails the run if it unexpectedly passes. | patch |
| 2 | `expectNotClipped`'s pass side has no committed proof — the falsifiability control aborts on its first (title) assertion and the only pass evidence was a deleted probe | high | Implementation Notes record the control failing at `"Shop"` scrollWidth 79 > clientWidth 68, never reaching the category and item assertions. Grep confirms `expectNotClipped` has no other caller. Inverting the comparison in `layout.ts:56` would produce a byte-identical failure report. | patch |
| 3 | Test-file header announces "two tests are EXPECTED RED" while three are red | medium | Verified in `narrow-viewport.spec.ts:7-15`. The file a developer opens when the suite is red misstates its own expected state. | patch |
| 4 | The appended invariant row omits the pre-story baseline (134 = 66/66/1/1) that its "+14" is measured against | medium | Verified in the config diff. The comment block exists precisely to stop figures being quoted without their measurement; the baseline lives only in the ATDD checklist. | patch |
| 5 | The 320x915 viewport is not a real device and the config never says the height is deliberately Pixel 7's | low | Verified: only `width` is overridden. The epic's driver is a ~344px foldable cover display, which is short, not tall. A later reader could "fix" the aspect ratio. One comment line. | patch |
| 6 | Overflow probe is removed outside a `finally`, so a failing intermediate assertion leaves it in the page | low | Verified at `narrow-viewport.spec.ts:172-192`. Harmless (per-test context) but the cleanup is unconditional in intent and conditional in fact; the fix is a direct correction. | patch |
| 7 | The two edited JSX lines are the only >120-char lines among the file's multi-attribute elements | low | Verified: `ListDetailPage.tsx:101` (131 chars) and `:158` (137) got the attribute appended inline while `:85`, `:109`, `:118`, `:193`, `:200` break one attribute per line. No lint rule enforces it; Story 8.2 rewrites these elements, so the formatting becomes churn in that diff. | patch |
| 8 | `expectNotClipped` has no subpixel tolerance, so fractional text widths could produce 1px false reds | maybe-false (would be medium) | `scrollWidth`/`clientWidth` are integer-rounded, and the Pixel 7 descriptor carries `deviceScaleFactor: 2.625`, so the class is plausible — but no false red was observed in any run of this story. What would settle it: a 320px run showing `expectNotClipped` red at exactly 1px on text that is visibly not truncated. Adding a tolerance now would guard state never demonstrated, and would weaken the epic's only geometry gate. | defer |
| 9 | `data-testid={`item-row-${item.name}`}` matches twice when one list holds two same-named items in different categories — strict-mode violation | medium, pre-existing | Verified at `ListDetailPage.tsx:193`. Real, but introduced by Story 6.1 and not caused or exposed by this change; `narrow-viewport.spec.ts` uses unique names throughout. | defer |
| 10 | The 320px override applies to all 73 mobile-project tests, not only the narrow-viewport spec | false | That is the requirement, not a side effect: NFR-E8-1 states the E2E suite renders at 320px "as part of a normal run", and AR-E8-2 explicitly forbids adding a scoped third project. | rejected |
| 11 | Three existing tests already ran below 412px, so "66 specs have never rendered below 412px" overstates the gap | low | Verified: `item-editing.spec.ts:395`, `navigation.spec.ts:289,481` call `setViewportSize({width: 360})`. But they set an *absolute* 360, so what they assert is unchanged by the retarget — only the direction of the resize flipped. The claim is inherited verbatim from the epic, and the fix would be to edit this build's spec. | rejected |
| 12 | `chromium` collects 7 narrow-viewport tests that always skip, so "equal counts" now counts tests that cannot run | low | Real and will grow as later Epic 8 stories add mobile-only specs, but the invariant's actual job — mutual exclusion for the shared `registrationEnabled` document — still holds. The fix (project-scoped `testMatch`/`testIgnore`) adds config complexity to an AC3 the story was told not to restructure. | rejected |
| 13 | Spec frontmatter says `in-review` while `sprint-status.yaml` says `in-progress` | low | Verified in the diff; both records are mid-workflow snapshots and the sprint file is synced by the workflow's own close-out step. No reader-facing contradiction survives the run. | rejected |
| 14 | `epic-8-context.md` contradicts itself on whether Story 8.7 replaces or marks-superseded the stale UX specs; the "eight defects" have no index to the seven stories | low | Verified in the compiled context file. Inherited from `epics.md` rather than introduced here, and Story 8.7 is where it resolves. | rejected |
| 15 | `sprint-status.yaml` stamps two distinct events at `"09-05-2026 12:00"` in an ambiguous non-ISO format | low | Verified. Pre-existing convention in that file's own history chain; this story added one row in the established shape rather than introducing the format. | rejected |


## Design Notes

Why the red phase is the deliverable: `noWrap` compiles to `overflow: hidden` (MUI `Typography.js:88-90`), so a clipped
element never expands its ancestors and `document.documentElement.scrollWidth <= clientWidth` stays green while both
reported defects are on screen (AR-E8-3a). That is why the document-level check alone would have gated nothing, and why
`expectNotClipped` has to be *seen* failing before anyone relies on it.

Report #3 is a **squeeze, not an overflow**: `noWrap`'s `overflow: hidden` already resolves the title's automatic
minimum size to zero, so it collapses to an ellipsis while the two header buttons take the width. `minWidth: 0` is a
no-op here and must not be written as a fix.

## Verification

**Commands:**
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` -- expected: four rows, two
  viewport projects with equal counts, `1` in each `registration-toggle-*`.
- `cd bp_front && npx playwright test --project=mobile` -- expected: run completes at `retries: 0`; the newly-failing
  set is captured, not suppressed.
- `cd bp_front && npm run lint` -- expected: exit 0.
- `cd bp_front && npm run build` -- expected: exit 0 (`tsconfig.e2e.json` type-checks the `e2e` tree, `noUnusedLocals`
  is on).
- `git diff --stat bp_back/` -- expected: empty.
