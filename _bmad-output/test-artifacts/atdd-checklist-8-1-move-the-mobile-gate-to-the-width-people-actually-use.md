---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-05'
storyId: '8.1'
storyKey: '8-1-move-the-mobile-gate-to-the-width-people-actually-use'
storyFile: '_bmad-output/planning-artifacts/epics.md#story-81-move-the-mobile-gate-to-the-width-people-actually-use'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-1-move-the-mobile-gate-to-the-width-people-actually-use.md'
generatedTestFiles:
  - 'bp_front/e2e/narrow-viewport.spec.ts'
  - 'bp_front/e2e/support/layout.ts'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/implementation-artifacts/sprint-status.yaml'
  - 'bp_front/playwright.config.ts'
  - 'bp_front/e2e/support/ui.ts'
  - 'bp_front/e2e/support/api.ts'
  - 'bp_front/src/routes/ListDetailPage.tsx'
  - 'resources/knowledge/playwright-utils-mandate.md'
  - 'resources/knowledge/confidence-gate.md'
  - 'resources/knowledge/evidence-integrity.md'
  - 'resources/knowledge/test-quality.md'
  - 'resources/knowledge/selector-resilience.md'
  - 'resources/knowledge/test-levels-framework.md'
  - 'resources/knowledge/test-priorities-matrix.md'
---

# ATDD Checklist — Story 8.1: Move the Mobile Gate to the Width People Actually Use

## Step 1 — Preflight & Context

### Stack detection

`test_stack_type: auto`. Frontend indicators (`bp_front/package.json` with React 19, `bp_front/playwright.config.ts`,
`bp_front/vite.config.ts`) and backend indicators (`bp_back/build.gradle.kts`) both present, no mobile indicators
(no `.maestro/`, no `app.json`, no `Podfile`, no `pubspec.yaml`).

**`{detected_stack}` = `fullstack`.**

Scope note: Epic 8's backend is frozen in practice — the AR-E8-0 unfreeze is authorised and unspent, and Story 8.1's
AC5 requires `git diff` to show no change under `bp_back/`. This run is therefore frontend/E2E only in effect.

### Prerequisites

| Requirement | Status | Evidence |
| --- | --- | --- |
| Story approved with clear acceptance criteria | PASS | `epics.md` lines 4375-4447, five ACs (AC1-AC5) |
| Test framework configured | PASS | `bp_front/playwright.config.ts`; 11 specs in `bp_front/e2e/`; shared support module `bp_front/e2e/support/{ui,api,png}.ts` (Story 7.2) |
| Development environment available | PASS | docker compose stack on :2080 is the `webServer` target |

No story markdown file exists for Epic 8 — stories live in `epics.md`. `story_key` taken from the
`sprint-status.yaml` key so checklist and handoff paths stay consistent with sprint tracking.

### TEA config flags

- `tea_use_playwright_utils: true`
- `tea_use_pactjs_utils: false`
- `tea_pact_mcp: none`
- `tea_browser_automation: auto`
- `test_stack_type: auto`
- `risk_threshold: p1`

### Playwright Utils Mandate — gate outcome: DOES NOT APPLY

`playwright-utils-mandate.md` § Scope requires **both** gates. Gate 1 (`tea_use_playwright_utils: true`) holds.
**Gate 2 fails**: `@seontechnologies/playwright-utils` is not a dependency in `bp_front/package.json` (only
`@playwright/test` ^1.60.0) and is absent from `node_modules/`.

Recorded explicitly rather than silently: the mandate's own rule is that a vanilla fallback must never be taken in
silence. Vanilla Playwright is therefore the correct implementation for this story, and it is not a deviation.
Loading profile reduced accordingly — the Playwright Utils fragment set was not loaded.

Consequence for this story: `expectNotClipped` and `expectNoHorizontalOverflow` are authored as plain helpers in the
existing Story 7.2 support module (`bp_front/e2e/support/ui.ts` or a sibling), matching the module's established
style, which is what AC4 already prescribes ("both in the Story 7.2 shared support module and each with exactly one
definition", NFR-E8-5).

### Pact / contract testing — not relevant

`tea_use_pactjs_utils: false` and `tea_pact_mcp: none`. No microservices indicators; the app is a single Ktor
GraphQL backend with one SPA consumer. No Pact artifacts, no MCP probe. `contract-testing.md` not loaded.

### Knowledge fragments loaded

Core: `data-factories`, `test-quality`, `test-healing-patterns`, `test-levels-framework`,
`test-priorities-matrix`, `confidence-gate`, `evidence-integrity`.
Frontend/fullstack: `selector-resilience`, `timing-debugging`.
Traditional patterns (utils mandate inactive): `fixture-architecture`, `network-first`.
Browser automation (`auto`): `playwright-cli`.
Extended, loaded for relevance: `component-tdd` (red-green-refactor loop).

### Framework state and existing patterns

- **Origin under test:** production image via Caddy on `:2080`, `E2E_BASE_URL` overridable to the TLS edge domain.
- **Projects (4):** `chromium` (Desktop Chrome) and `mobile` (`devices['Pixel 7']`, 412px), both
  `grepInvert: /@registration-toggle/`; plus `registration-toggle-chromium` (`dependencies: ['chromium','mobile']`)
  and `registration-toggle-mobile` (`dependencies: ['registration-toggle-chromium']`), both `fullyParallel: false`.
- **`retries`:** `process.env.CI ? 2 : 0` — AC1's `retries: 0` measurement is the default local behaviour.
- **Structural invariant, last measured 2026-08-11 (Story 7.5):** 120 = 59 / 59 / 1 / 1. Config comment is explicit
  that these figures must be re-measured, never quoted — AC3 requires exactly that.
- **Support module conventions:** UI-driven assertions only; API access (`support/api.ts`) is environment SETUP only
  (AR-E7-5); every scenario registers a fresh unique user via `uniqueUsername(prefix, label, projectName)`; tests
  assert only on data they created, never on totals; `data-testid` is the established selector strategy.

### Targets the story's red phase must prove failing (AC4)

- `bp_front/src/routes/ListDetailPage.tsx:158` — category name: `<Typography variant="h6" noWrap sx={{maxWidth: {xs: 160, sm: 380}}}>`
- `bp_front/src/routes/ListDetailPage.tsx:224` — item name: `<Typography noWrap sx={{maxWidth: {xs: 150, sm: 400}}}>`
- The list title in the `/lists/:id` header — report #3, a squeeze rather than an overflow (AR-E8-3 corrected)

`noWrap` compiles to `overflow: hidden` (MUI `Typography.js:88-90`), which is why the document-level check stays
green while both defects are on screen (AR-E8-3a) and why `expectNotClipped` is the load-bearing half.

---

## Step 2 — Generation Mode

**Mode chosen: AI generation.** No browser recording session.

Why:

- The acceptance criteria are unusually concrete — AC2 names the exact config line (`playwright.config.ts:103`) and
  the exact target value (320px); AC3 names the exact command that measures the structural invariant; AC4 names the
  exact assertion (`scrollWidth <= clientWidth` on the text element) and the exact two elements it must be seen
  failing against.
- Selectors need no discovery. The suite's strategy is `data-testid` throughout, and every id this story touches
  already exists and is already used by shipped specs: `list-detail-page`, `category-row-${name}`,
  `item-row-${name}`, `add-category-button`, `add-item-button`. Recording would rediscover what
  `bp_front/e2e/support/ui.ts` already encodes.
- `tea_browser_automation: auto` would route a simple selector-snapshot job to `playwright-cli`. There is no such
  job here: the two new helpers are geometry assertions on elements the suite already locates, not a new flow.

What is explicitly **not** replaced by AI generation — the two live measurements the story is built around, both of
which belong to the green phase and must be run, not predicted:

1. **AC1's count.** Retarget the viewport, run the suite once at `retries: 0`, and record the count and identity of
   every newly-failing test *before* any layout is touched. That number cannot be estimated from source; the story
   makes reporting it the binary acceptance condition, and the scoping decision that follows is `md`'s.
2. **AC3's structural invariant.** `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`,
   recorded with its date. The config comment is explicit that the 2026-08-11 figure (120 = 59/59/1/1) is to be
   re-measured, never quoted.

Both are recorded in this checklist as commands to execute with their results captured, per `evidence-integrity.md`
(three-state diagnostics: pass / fail / could-not-measure).

---

## Step 3 — Test Strategy

### Available test levels — a constraint, stated before the mapping

`bp_front` has **no unit or component test runner**. `package.json` devDependencies carry `@playwright/test` and
nothing else testing-related — no vitest, no jest, no `@testing-library/*`. The only scripts are `dev`, `build`,
`preview`, `generate`, `lint`, `icons`, `test:e2e`.

So the level menu for this story is **E2E only**, plus two *measurements* that are not tests at all. Proposing
component tests for `expectNotClipped` would mean scaffolding a whole runner inside a story whose Files list is
`playwright.config.ts` and `e2e/support/*` — out of scope, and the story does not ask for it. Recorded here so the
absence reads as a decision rather than an oversight.

`test-levels-framework.md` would put a pure geometry assertion at component level in a project that had one. This
project does not, and E2E against the production image is where NFR-E8-6 requires the evidence anyway.

### AC → scenario map

| # | AC | Scenario | Level | Priority | Red-phase proof |
| --- | --- | --- | --- | --- | --- |
| S1 | AC2 | The `mobile` project renders at a 320px viewport width | E2E (self-check) | P0 | Fails today: viewport is 412 (`devices['Pixel 7']`) |
| S2 | AC2 | The `mobile` project keeps the Pixel 7 UA and touch emulation after retargeting | E2E (self-check) | P1 | Passes today — a guard against the fix being "replace the descriptor" |
| S3 | AC4 | `expectNotClipped` fails on the `/lists/:id` **item name** at 320px | E2E | P0 | This IS the red phase — the assertion must be seen failing |
| S4 | AC4 | `expectNotClipped` fails on the `/lists/:id` **list title** at 320px | E2E | P0 | Same — report #3's proof |
| S5 | AC4 | `expectNotClipped` **passes** on a short name at 320px | E2E | P0 | Falsifiability: an assertion that only ever fails is as useless as one that only ever passes |
| S6 | AC4 | `expectNoHorizontalOverflow` passes on `/lists/:id` today | E2E | P1 | Passes today — and that is exactly AR-E8-3a's point |
| S7 | AC4 | `expectNoHorizontalOverflow` is provably capable of failing | E2E | P1 | **Beyond the AC — see "Additions" below** |
| S8 | AC3 | Exactly two viewport projects; `dependencies` names both | Measurement | P0 | Re-measured, never quoted |
| S9 | AC3 | Total test count unchanged by this story | Measurement | P0 | Same command, same run |
| S10 | AC1 | Newly-failing tests counted and identified at `retries: 0` | Measurement | P0 | The story's binary acceptance condition |
| S11 | AC5 | `npm run lint`, `npm run build`, `git diff` clean under `bp_back/` | Gate | P1 | Standing epic constraint |

No negative-path scenarios beyond S5/S7: this story changes a viewport number and adds two assertions. Its risk is
not a bad input, it is a **hollow gate** — which is what S5 and S7 exist to rule out.

### Priority rationale (`risk_threshold: p1`)

P0 is everything whose failure would let Epic 8 proceed on a false green:

- **S1** — every later story's mobile evidence is meaningless at the wrong width.
- **S3/S4/S5** — `expectNotClipped` is the load-bearing half of NFR-E8-3. AR-E8-3a records that the story's first
  draft proposed only the document-level check and "it would have gated nothing". S5 guards the mirror-image
  failure: a helper wired so it can never pass.
- **S8/S9** — Story 7.3 deleted a real, measured flake (3, 5 and 4 failing tests across three `retries: 0` runs,
  all inside `registerViaUi`). Silently reopening it is the worst outcome available to this story, and the config's
  own comment warns that the total proves nothing — only the per-project split does.
- **S10** — AC1 makes the measurement itself the acceptance condition; skipping it is the one way to fail this story
  outright.

P1 is real but recoverable: S2, S6, S7, S11.

Nothing is P2/P3. A story this small with no P2 work is the expected shape, not a gap.

### Red-phase confirmation

Every scenario is designed to fail before implementation, or is explicitly labelled as a control that passes today:

- **Genuinely red now:** S1 (viewport is 412), S3, S4 (helpers do not exist; and once they do, they fail against the
  shipped `noWrap` layout — AC4 requires this be *observed*, not assumed), S7 (helper does not exist).
- **Green now, by design:** S2 and S6 are controls. `test-quality.md` calls an assertion that was already true
  before the action a hollow green — these two are declared as controls precisely so they are not mistaken for
  evidence of the fix.
- **Not tests:** S8, S9, S10, S11 are measurements and gates. Per `evidence-integrity.md` they record three states —
  pass / fail / could-not-measure — and "could-not-measure" is a legitimate, reportable result (e.g. S9 cannot be
  read if the stack will not come up).

### Additions beyond the written ACs — flagged, not smuggled in

**S7 — prove `expectNoHorizontalOverflow` can fail.** AC4 requires `expectNotClipped` be observed failing, and is
silent on the other helper. But a document-level check that is green everywhere is indistinguishable from one that
is broken, and this story is the only place it will ever be examined. Cheap proof: assert it fails against a
deliberately over-wide element injected into a scratch page, or assert it against a viewport narrow enough to force
real overflow. One assertion, and the gate stops being an article of faith.

**Three missing selectors — a blocker for S3, S4 and Story 8.2.** `expectNotClipped(locator)` must target the
**text element**, because `scrollWidth <= clientWidth` on the row would measure the wrong box. None of the three
target elements has a `data-testid`:

| Element | Location | Nearest existing testid |
| --- | --- | --- |
| List title | `ListDetailPage.tsx:101` `<Typography variant="h4" noWrap sx={{maxWidth: {xs: 200, sm: 460}}}>` | `list-detail-page` (ancestor) |
| Category name | `ListDetailPage.tsx:158` `<Typography variant="h6" noWrap sx={{maxWidth: {xs: 160, sm: 380}}}>` | `category-row-${name}` (ancestor) |
| Item name | `ListDetailPage.tsx:224` `<Typography noWrap sx={{maxWidth: {xs: 150, sm: 400}}}>` | `item-row-${name}` (ancestor) |

Reaching them structurally — `getByTestId('item-row-X').locator('p')` — is precisely what `selector-resilience.md`
warns against, and it would break under Story 8.2, which rewrites these very elements. The proposal is to add
`data-testid="list-detail-title"`, `data-testid="category-name"` and `data-testid="item-name"` in this story.

That is a change under `bp_front/src/`, which Story 8.1's Files list does not name — though it does say "plus
whatever the measurement in AC1 implicates", and AC5 restricts only `bp_back/`. **This needs `md`'s call**; it is
carried into Step 4 as an open decision rather than assumed either way.

### Confidence

```
Confidence: 8
Rationale: ACs name exact file:line targets (playwright.config.ts:103, ListDetailPage.tsx:101/158/224), all of which
were read and verified in this run; the existing suite's conventions are documented in bp_front/e2e/support/ui.ts and
the config's own comments; the projects, retries and grep/dependencies wiring were read directly rather than inferred.
Unknowns:
  - Whether md accepts adding three data-testid attributes under bp_front/src/ within this story (blocks S3/S4 selector shape)
  - AC1's newly-failing count is unmeasured and unmeasurable without running the suite; the scaffold records the
    command and leaves the number empty rather than predicting it
  - Whether the docker stack is currently up on :2080 (decides whether the green-phase run is a cold ~10min build)
```

Above the ≥7 threshold, so generation proceeds. The first Unknown is surfaced as a decision, per the 5-6 band's
"surface the assumptions so they can be corrected mid-flight" — it changes the shape of the emitted locators, not
whether they are emitted.

---

## Step 4 — Generation, and Step 4C — Aggregation

### Execution mode

| Field | Value |
| --- | --- |
| `tea_execution_mode` | `auto` |
| `tea_capability_probe` | `true` |
| Agent-team capability | not available in this runtime |
| Subagent capability | available |
| Mode by the step's own resolution | `subagent` |
| **Mode actually used** | **`sequential` — a deviation, recorded here rather than taken quietly** |

Two reasons, both specific to this story:

1. **Worker A's scope is provably empty.** Story 8.1 has no API surface at all. Dispatching an agent to return
   `"tests": []` costs a cold start and returns nothing.
2. **Worker B's fidelity depends on context already loaded here.** The scaffold's value is in the details this
   session read directly — `playwright.config.ts`'s project wiring and its dated invariant, `support/ui.ts`'s
   fresh-user and namespace conventions, the exact `ListDetailPage.tsx` line numbers and `sx` caps, the absence of a
   unit runner, and the failed playwright-utils gate. A subagent starts cold and re-derives all of it, with a real
   chance of emitting the `@seontechnologies/playwright-utils` import shapes the mandate's default prescribes and
   this project cannot resolve.

Both worker output contracts were produced in full and in the specified JSON shape:

- `.tmp/8c841741-4575-4497-9896-cfae77919c40/tea-atdd-api-tests-2026-09-05.json`
- `.tmp/8c841741-4575-4497-9896-cfae77919c40/tea-atdd-e2e-tests-2026-09-05.json`

(Under `.tmp/<session-id>/` per the project's own temp-file rule, not `/tmp`.)

### Worker A — API red-phase scaffolds: 0 tests, deliberately

No endpoint is created, changed, or called by this story. AC5 requires `git diff` to show no change under
`bp_back/`, and the epic header records the AR-E8-0 unfreeze as authorised and **unspent**. Inventing an endpoint to
have something to scaffold is what `confidence-gate.md` scores below 5 and forbids. Empty result recorded rather
than omitted.

### Worker B — E2E red-phase scaffolds: 7 tests

### TDD red-phase compliance

| Check | Result |
| --- | --- |
| Every test marked `test.skip()` | PASS — 7/7 |
| No placeholder assertions (`expect(true).toBe(true)`) | PASS |
| All marked `expected_to_fail` | PASS |
| Resilient selectors (`getByTestId`, project convention; no CSS/XPath/`:has-text`) | PASS |
| No hard sleeps | PASS |
| Priority tags present | PASS — 4×P0, 3×P1 |

### Files written

| File | Role |
| --- | --- |
| `bp_front/e2e/support/layout.ts` | The two AC4 helpers, one definition each (NFR-E8-5) |
| `bp_front/e2e/narrow-viewport.spec.ts` | 7 skipped scaffolds |

Verified after writing: `npx tsc -b` exits 0 and `npx eslint` exits 0 on both files. This matters more than usual —
`tsconfig.e2e.json` includes the `e2e` tree and is referenced by `tsconfig.json`, so `npm run build` type-checks
these files, and `noUnusedLocals` is on. A scaffold that does not compile would break AC5's gate on arrival.

### Fixture infrastructure

No `merged-fixtures.ts` was generated. Step 4C makes it non-optional only when `use_playwright_utils` is `true`,
which requires both gates; gate 2 failed (package absent). The specs import `test`/`expect` from `@playwright/test`,
exactly as all 11 existing specs do. Creating a merged-fixtures file here would add an unresolvable import.

The one fixture need is `bp_front/e2e/support/layout.ts`, written above. It is test infrastructure and part of the
story's own deliverable (AC4 puts it in the shared support module), not production code — and without it AC4's
"observed failing" is unobservable.

### Playwright Utils deviations

**None.** The mandate is inactive by its own Scope rule — `@seontechnologies/playwright-utils` is not a dependency
in `bp_front/package.json`. Vanilla `@playwright/test` is therefore correct, not a deviation. Recorded explicitly so
the next reader does not re-litigate it.

---

## Step 5 — Validation & Completion

### AC1 and AC3 measurements

**AC3 — structural invariant, measured 2026-09-05, not quoted:**

```
npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c
```

| When | chromium | mobile | reg-toggle-chromium | reg-toggle-mobile | Total |
| --- | --- | --- | --- | --- | --- |
| 2026-08-11 (Story 7.5, the figure in the config comment) | 59 | 59 | 1 | 1 | 120 |
| 2026-09-05 baseline, before this scaffold | 66 | 66 | 1 | 1 | 134 |
| 2026-09-05 with the scaffold present | 73 | 73 | 1 | 1 | 148 |

Two findings:

1. **The invariant holds.** Exactly two viewport projects, split evenly, exactly one test in each
   `registration-toggle-*` project. Story 7.3's mutual-exclusion chain is intact and `dependencies: ['chromium',
   'mobile']` still names every project that registers users. Adding a spec does not add a project.
2. **The config comment's figure was already stale by 14** — the baseline moved from 120 to 134 during later Epic 7
   work, with nobody updating the comment. The comment's own instruction ("re-measure, never quote") is what caught
   it. Worth correcting in the same pass, since Story 8.1 is the story that touches this file.

**AC1 — the newly-failing count: NOT MEASURED. Three-state result: `could-not-measure`.**

Recording it as unmeasured, per `evidence-integrity.md`, rather than estimating it. Reading it requires retargeting
the viewport and running the full suite against the production image, which is the green phase, not this one. The
command, for the record:

```
# after playwright.config.ts:103 is retargeted to 320px, and with retries: 0
npx playwright test --project=mobile
```

The number this returns is Story 8.1's binary acceptance condition. It is not predictable from source: 59 — now 66 —
specs have never rendered below 412px, so reports #2 and #3 are the two defects `md` happened to hit rather than the
two that exist (AR-E8-2a).

### Two things that need `md`'s decision before green phase

**1. Three missing `data-testid` attributes — blocks the two AC4 red-phase tests.**

`expectNotClipped` must measure the text element. None of the three carries a testid:

| Element | Location | Proposed |
| --- | --- | --- |
| List title | `ListDetailPage.tsx:101` | `data-testid="list-detail-title"` |
| Category name | `ListDetailPage.tsx:158` | `data-testid="category-name"` |
| Item name | `ListDetailPage.tsx:224` | `data-testid="item-name"` |

That is a change under `bp_front/src/`, which the story's Files list does not name (AC5 restricts only `bp_back/`).
The alternative — `getByTestId('item-row-X').locator('p')` — is the structural coupling `selector-resilience.md`
warns against, and Story 8.2 rewrites these exact elements, so it would break one story later. The scaffold assumes
the testids and confines them to three arrow functions at the top of the spec, so reversing the decision costs one
edit.

**2. AC3 says "the total test count is unchanged by this story" — and this scaffold changes it by +14.**

Two honest readings, and they lead to different deliverables:

- **(A) AC3 means "no project was added", so the count does not MULTIPLY.** New tests legitimately add to the total.
  The spec ships in Story 8.1, the total is 148, and AC3's sentence is read as being about projects. This is what the
  clause's own subordinate ("since no project was added") suggests.
- **(B) AC3 means the number literally.** Then Story 8.1 ships `support/layout.ts` with **no committed caller**,
  AC4's "observed failing" is a recorded manual measurement, and `narrow-viewport.spec.ts` lands in Story 8.2 — whose
  AC5 already requires both helpers be applied to `/lists/:id`. The total stays 134 and AC3 is literally true.

Reading (B) has a cost `test-quality.md` names: a helper with zero callers is dead code for the length of a story,
and nothing proves it works until 8.2. Reading (A) has a cost too: AC3 as written goes red. **The scaffold is
written so either reading works** — under (B), move the one spec file to Story 8.2 unchanged.

I would take (A). The clause's stated reason is about projects, and Story 8.1 keeping its own proof is worth more
than the sentence's literal arithmetic.

### One addition beyond the ACs

`[P1] expectNoHorizontalOverflow is capable of failing` — AC4 requires only `expectNotClipped` be seen failing. A
document-level check that is green on every screen cannot be told apart from one wired wrong, and this story is the
only place it will be examined. The test injects an over-wide element, requires the helper to reject, removes it, and
requires the helper to pass again. Flagged here rather than folded in silently; delete it if `md` considers it scope
creep.

### Handoff

| | |
| --- | --- |
| Story | 8.1 — Move the Mobile Gate to the Width People Actually Use |
| Story key | `8-1-move-the-mobile-gate-to-the-width-people-actually-use` |
| Story source | `_bmad-output/planning-artifacts/epics.md` § Story 8.1 (lines 4375-4447) |
| Checklist | `_bmad-output/test-artifacts/atdd-checklist-8-1-move-the-mobile-gate-to-the-width-people-actually-use.md` |
| E2E scaffolds | `bp_front/e2e/narrow-viewport.spec.ts` (7 tests, all skipped) |
| Test infrastructure | `bp_front/e2e/support/layout.ts` |
| API scaffolds | none — no API surface in this story |
| Component scaffolds | none — `bp_front` has no unit/component runner |

No story file exists for Epic 8, so the artifact links could not be written back into a `## Dev Notes` section. They
are recorded here instead, and `bmad-build` should pick them up from this checklist.

### Activation sequence for the developer

1. Retarget `playwright.config.ts:103` to a 320px width, keeping the `devices['Pixel 7']` spread.
2. Un-skip `[P0] the mobile project renders at the 320px floor` and the `[P1] CONTROL` UA/touch test. Both green.
3. Run `npx playwright test --project=mobile` at `retries: 0`. **Record the count and identity of every newly-failing
   test.** That is AC1, and it is the story's acceptance condition. Bring the list to `md` as a scoping decision.
4. Re-measure the structural invariant, record it with its date, and correct the stale figure in the config comment.
5. Add the three `data-testid` attributes (pending decision 1).
6. Un-skip the four remaining tests. Expect the two `RED —` tests to **fail**, and record that: it is AC4's proof.
   The two controls and the falsifiability test must pass.
7. `npm run lint`, `npm run build`, `git diff bp_back/` empty. Name any outstanding reds in the story record — do not
   retry them away.

### Next workflow

`bmad-build` on Story 8.1 (`[BD]` in the BMad menu), in a fresh context window. `bmad-testarch-automate` comes after
implementation, not before.

### Validation against `checklist.md`

Passing, and worth naming: prerequisites met; story ACs extracted and mapped; framework config loaded and existing
patterns reviewed; test levels selected with the unavailable ones explained; P0-P3 assigned; all 7 scaffolds are
`test.skip()` with no placeholder assertions; `data-testid` selectors only; no hard waits; no test
interdependencies (each registers its own user); TypeScript and lint both clean; frontmatter carries `storyId`,
`storyKey`, `storyFile`, `atddChecklistPath` and `generatedTestFiles`; activation guidance documented; `--list`
output captured.

Six items are **not** satisfied. Each is a deliberate divergence from the generic checklist toward this repo's
established conventions, recorded rather than ticked:

| Checklist item | Status | Why |
| --- | --- | --- |
| Given-When-Then comment structure | Not followed | No spec in `bp_front/e2e/` uses GWT. The scaffolds match the house style: a comment block stating what the test proves and why it is expected to fail. Imposing GWT on one file would make it the odd one out. |
| One assertion per test | Not followed | The UA/touch control makes 3 assertions and the falsifiability control 3, because each is one *claim* ("the Pixel 7 descriptor survived", "the helper is honest in both directions") that cannot be split without making the pair meaningless in isolation. |
| Factories using `@faker-js/faker` | N/A | `faker` is not a dependency and adding one for three string constants is not warranted. The project's factory is `uniqueUsername(prefix, label, projectName)` in `support/ui.ts`, and the three long names are named constants per `data-factories.md`'s "name the domain literals a test hardcodes on purpose". |
| Fixtures with auto-cleanup in teardown | N/A by design | This suite has no teardown anywhere. Its isolation model is a fresh unique user per run per project against a persistent Mongo volume, asserting only on self-created data — documented at the top of `support/ui.ts`. Adding cleanup to one spec would break that symmetry, not improve it. |
| Network-first interception | N/A | Every scenario is a DOM-geometry measurement. There is no application API call under test, so there is nothing to intercept ahead of navigation. |
| `tests/e2e/` + `tests/support/` layout | N/A | The project's Playwright `testDir` is `./e2e` with helpers in `e2e/support/`. Files were placed there. |

The Playwright Utils Mandate section of the checklist is skipped in full, per its own instruction: it applies only
when the flag is true *and* the package is installed. It is not.

The Pact.js Utils section is skipped in full: `tea_use_pactjs_utils` is false and the project has no
consumer-provider boundary.

`workflow.on_complete` resolved empty — no completion hook to run.
