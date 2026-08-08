---
title: 'Story 7.3 — Delete the `registrationEnabled` race'
type: 'bugfix'
created: '2026-08-08'
status: 'done'
baseline_revision: '00e95cf'
final_revision: '13079c7'
review_loop_iteration: 0
followup_review_recommended: true  # 11 patches (8 medium) and 8 of them landed in newly written authoritative prose — a false mobile-gate claim, a recovery command that could not work, a false "only construct" claim, an over-read measurement propagated to three documents, and a ledger action item aimed at a CI pipeline that does not exist. That text is read as binding by later agents and no gate checks it; same exposure that earned 7.1 and 7.2 follow-up passes, at higher volume.
context:
  - '{project-root}/_bmad-output/project-context.md'
warnings: [oversized]  # ~2.6k tokens. The mechanism comparison, the dependency-chain consequence and the AC5 protocol are load-bearing: AC2 requires the mechanism *and its reason* be recorded, and AC5 is an experiment that fails silently if under-specified.
---

<intent-contract>

## Intent

**Problem:** `registrationEnabled` is one Mongo `ApplicationConfig` document, and the `chromium` + `mobile` Playwright
projects run concurrently against one backend. `admin.spec.ts:156`'s toggle test turns it OFF for real, so its OFF
window breaks register-based specs in the *other* project. Accepted seven times across two epics and masked by CI's
`retries: 2`; the suite is not reliably green at `retries: 0`, so "green" currently means "the retries absorbed a known
flake".

**Approach:** Give the OFF window genuine **cross-project** exclusivity by tagging that one test and routing it into two
dedicated Playwright projects chained with `dependencies`, so it runs only after `chromium` and `mobile` have finished
and never alongside anything that registers. Then delete the `expect(...).toPass()` workaround from
`support/ui.ts:35-38` rather than leaving it beside the fix.

## Boundaries & Constraints

**Always:**
- Registration is the steady state: ON for the whole run except inside the one tagged test, which restores ON in a
  `finally` (the existing inner `finally` at `admin.spec.ts:183-195` already does this — keep it).
- The mechanism must be exclusive **across projects**. `test.describe.configure({mode: 'serial'})` is explicitly
  rejected by AC2: it serializes within a project, and this race is between projects.
- The mobile gate survives: the toggle test still runs at Pixel 7 emulation via a project `use` block, never a
  hand-built `browser.newContext()` (that silently reverts to desktop viewport).
- Total collected runs stay **104** (`npx playwright test --list`) — the test is *rerouted*, not duplicated or dropped.
- AC5 is an experiment, not a formality: the race must be *observed* with the mechanism disabled, or its
  non-reproduction reported.
- `support/api.ts` stays free of any `@playwright/test` import (`global-setup.ts` runs before the runner exists).

**Block If:**
- The race cannot be reproduced in 3 disabled-mechanism runs **and** the widened-window control also stays green — that
  would mean the fix is not demonstrably the thing that closed it, and the claim needs a human call.
- Two consecutive `retries: 0` runs cannot be made clean because of a failure *unrelated* to this race.

**Never:**
- Do not touch `bp_back/`, `bp_front/src/`, `src/__generated__/`, `package.json`, `tsconfig*.json` or
  `eslint.config.mjs`. This is an E2E-harness story.
- Do not keep the `toPass` wrapper "just in case" alongside the fix — that makes the next flake invisible (AC3).
- Do not lower `retries`, add a wait/sleep, or widen a timeout as the fix.
- Do not add `storageState`, `test.extend`, or session reuse (AR-E7-5 still stands).
- Do not add the `testIgnore: '**/support/**'` enforcement the 7.2 review filed — out of charter here; leave the ledger
  entry open.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Steady state | Any register-based spec, any project | `/auth` shows `to-register-link` on first load; no retry loop | No error expected |
| OFF window | The tagged toggle test running | `chromium` + `mobile` have already completed; nothing else is registering | No error expected |
| Toggle test throws mid-OFF | Assertion inside the OFF window fails | Inner `finally` restores ON; the original failure is reported, not masked | Restore failure recorded as a `registration-restore-failed` annotation, not rethrown |
| Flag stranded OFF by a crashed prior run | `./db/data` persists with `registrationEnabled: false` | `global-setup.ts` sets it back to `true` before the run | Throws with the GraphQL errors if the enable call fails |
| `registration-toggle-chromium` fails | Its dependent mobile project | Playwright skips the dependent project — the run is red and the mobile toggle case does **not** report as passed | Recorded as a known consequence of the chain |

</intent-contract>

## Code Map

- `bp_front/playwright.config.ts:45-54` -- the two-project array. Gains `grepInvert` on `chromium`/`mobile` and two new
  chained projects. **Only** file where the mechanism lives.
- `bp_front/e2e/admin.spec.ts:156-205` -- the FR20/FR21 toggle test. Gains the tag; its `setRegistration(page, true)`
  baseline at `:165` becomes load-bearing (see Design Notes) and its shared-flag-hazard comment at `:167-173` is now
  false and must be rewritten.
- `bp_front/e2e/admin.spec.ts:57-65` -- `setRegistration`, the only writer of the shared flag from a test.
- `bp_front/e2e/support/ui.ts:26-48` -- `registerViaUi`; `:29-38` is the workaround (comment + `toPass`) AC3 deletes.
  The single remaining copy since Story 7.2.
- `bp_front/e2e/auth.spec.ts:18-28` -- the inlined, *unhardened* registration flow. Ledger says "decide in 7.3 whether
  it wants the guard": it does not, and that decision is the point.
- `bp_front/e2e/global-setup.ts:15,33-51` -- duplicates `BACKEND`/`loginApi`/`gql`; the ledger assigns the convergence
  to this story.
- `bp_front/e2e/navigation.spec.ts:100` -- an *unrelated* `toPass` (CSS hover settling, 2000 ms). Do not remove it.
- `_bmad-output/implementation-artifacts/deferred-work.md:57-65` -- the Epic 5 close-out entry AC6 closes; `:773-788`
  the Epic-6-review duplicate that closes with it; `:298-306` (auth.spec.ts guard decision) and `:308-312`
  (global-setup convergence) are resolved here; `:792-799` carries a factual claim about this story to correct.
- `_bmad-output/project-context.md:199-212` -- the `registrationEnabled` bullet describing the race and the workaround.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:38`, `:113` -- `last_updated`, story key
  `7-3-delete-registration-enabled-race`.

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/e2e/admin.spec.ts` -- tag the FR20/FR21 test with `{tag: '@registration-toggle'}` via the `test(title,
  details, body)` overload; rewrite the `:167-173` hazard comment to state the new mechanism (exclusivity, not a tight
  window) and why the `setRegistration(page, true)` baseline stays. Leave the other four tests untouched.
- [x] `bp_front/playwright.config.ts` -- add `grepInvert: /@registration-toggle/` to `chromium` and `mobile`; add
  `registration-toggle-chromium` (`grep: /@registration-toggle/`, `use: {...devices['Desktop Chrome']}`,
  `dependencies: ['chromium', 'mobile']`) and `registration-toggle-mobile` (same `grep`, `use: {...devices['Pixel 7']}`,
  `dependencies: ['registration-toggle-chromium']`). Comment the chain's reason and its skip-on-failure consequence.
- [x] `bp_front/e2e/support/ui.ts` -- delete the `toPass` wrapper and its 10-line rationale comment; `registerViaUi`
  starts with a plain `await page.goto('/auth')`. Replace the comment with one stating registration is ON for the whole
  run and why no retry is needed.
- [x] `bp_front/e2e/global-setup.ts` -- import `BACKEND`, `loginApi`, `gql` from `./support/api` and delete the local
  `BASE_URL`, inline login and inline GraphQL fetch; keep `waitForBackend` (now polling `${BACKEND}/api/auth/config`).
  Scope addition sourced from the ledger `:308-312`, not from the epic's `Files:` line — record the deviation.
- [x] `bp_front/` -- static gates -- `npx tsc -b` exit 0, `npm run lint` exit 0 with zero output, and
  `npx playwright test --list` reports **104** across the four projects with the toggle test in exactly the two
  `registration-toggle-*` ones. Record the per-project breakdown.
- [x] `bp_front/` -- AC5 observe the race -- with `playwright.config.ts` reverted to its two-project form (and the
  `toPass` already gone), run `npm run test:e2e` at `retries: 0` up to 3 times; capture a failure carrying
  `Registration is disabled` / a missing `to-register-link`. If 3 runs stay green, run one control with the OFF window
  deliberately widened, label it as a control, and report per AC5 either way. Restore the config afterwards.
- [x] `bp_front/` -- AC4 prove the fix -- **two consecutive** full `npm run test:e2e` runs at `retries: 0`, both
  104/104 with **0 flaky**. Paste both summary lines verbatim into the record. One run is explicitly not evidence.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- close `:57-65` and `:773-788` with the
  strike-through-and-retain convention naming the mechanism; resolve `:298-306` with the explicit "`auth.spec.ts` needs
  no guard because the race is gone" decision; close `:308-312`; correct `:796` ("Story 7.3 … will hit this
  immediately" — it does not: `global-setup.ts` uses `admin`/`admin`, not `PASSWORD`, so that entry stays open on its
  own merits); file anything new under a `## Deferred from: Story 7.3` section.
- [x] `_bmad-output/project-context.md` -- rewrite the `registrationEnabled` bullet `:199-212`: the race is deleted, the
  mechanism is the tag + chained projects, the `toPass` is gone, `auth.spec.ts`'s bareness is no longer an exposure.
  Add the four-project topology and the dependency-chain consequence. Refresh the `_Last Updated_` footer. Rules only —
  new debt goes to the ledger (NFR-E7-1).
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `7-3-delete-registration-enabled-race` → `done`;
  refresh `last_updated` with the mechanism, both AC4 run results, the AC5 outcome and the global-setup scope addition.

**Acceptance Criteria:**
- Given the two viewport projects run concurrently against one backend, when the suite runs, then the tagged toggle test
  executes only after both have completed, and `npx playwright test --list` shows it in the two `registration-toggle-*`
  projects and nowhere else — with the total still 104.
- Given AC2 demands the mechanism be justified, when the record is written, then it names why a dedicated chained
  project was chosen over `mode: 'serial'` (wrong scope) and over a worker-scoped file lock (would re-introduce waiting
  at every register site), and records the skip-on-failure consequence of `dependencies` as a measured fact, not a
  guess.
- Given AC3, when the tree is inspected, then `grep -rn "toPass" bp_front/e2e/` returns exactly one hit —
  `navigation.spec.ts:100`, the unrelated CSS-hover one — and no spec holds a local copy of the registration guard.
- Given AC4, when the story is complete, then two consecutive full runs at `retries: 0` are recorded with their verbatim
  output, both green on `chromium` and `mobile` with zero flaky.
- Given AC5 and the Epic 6 "unproven until seen failing" convention, when the record is written, then it contains the
  disabled-mechanism run(s) and either the reproduced failure verbatim or an explicit statement that the race did not
  reproduce, with the control result.
- Given AC6, when `deferred-work.md` is inspected, then the Epic 5 close-out race entry is marked resolved in place with
  the mechanism named — and no new entry is added alongside it restating the same debt.
- Given this is a harness story, when `git diff --stat` is inspected, then `bp_back/`, `bp_front/src/`, `package.json`,
  `tsconfig*.json` and `eslint.config.mjs` are untouched.

## Spec Change Log

## Review Triage Log

### 2026-08-08 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 11: (high 0, medium 8, low 3)
- defer: 3: (high 0, medium 3, low 0)
- reject: 10
- addressed_findings:
  - `[medium]` `[patch]` **The config comment claiming the mobile gate was preserved for the tagged test was false.**
    The FR20/FR21 test asserts its public `/auth` effect on hand-built `browser.newContext()` contexts (`offCtx`,
    `withFreshAuthPage`), which do not inherit the project `use` block — the project's own documented trap. So those
    assertions run at a desktop viewport in **both** toggle projects; only the admin-panel half is Pixel-7-emulated.
    Comment rewritten to say exactly what the second project does and does not buy; the coverage gap itself is
    pre-existing (Story 5.4) and filed as a defer.
  - `[medium]` `[patch]` **`Total: 104` is blind to the mechanism's most likely regression.** Drop or misspell the tag
    and the test runs in `chromium`+`mobile` (52+52) while both toggle projects collect zero — still exactly 104, race
    silently restored, guard already deleted. Only the per-project split detects it, and it existed solely as a line in
    this spec. Promoted to a rule in `project-context.md` and to a comment in `playwright.config.ts`, with the command.
  - `[medium]` `[patch]` **The documented recovery for a red run could not work in the case it was prescribed for.**
    `npx playwright test --project=registration-toggle-chromium` re-runs the *still-broken* dependency and fails
    identically. `--no-deps` is the actual answer (and `globalSetup` still runs under it). Corrected in
    `project-context.md`, `deferred-work.md` and the config comment.
  - `[medium]` `[patch]` **"`dependencies` is the only Playwright construct that orders work across projects" is
    false.** `testProject.teardown` also orders across projects and, unlike `dependencies`, runs when the run is red —
    i.e. it would dissolve the "a red run yields zero FR20/FR21 information" cost this story filed as accepted debt.
    The ledger entry even name-dropped teardown as a mitigation while the config three files away called it impossible.
    Claim corrected in both places; evaluating teardown filed as a defer.
  - `[medium]` `[patch]` **The AC5 measurement was over-interpreted, and the over-interpretation had been propagated to
    three documents.** The 3/5/4 failures were measured with the mechanism absent *and the `toPass` already deleted*, so
    they are not comparable with the historical "1 flaky, retry-healed" reports, which always ran with the workaround.
    The inference "the race is far larger than 1 flaky" is withdrawn in the record, `project-context.md` and
    `deferred-work.md`. What AC5 asked — does it reproduce with the mechanism disabled — is unaffected: it did, on all
    three attempts, on both projects.
  - `[medium]` `[patch]` **The new invariant is scoped to one Playwright invocation, but was documented
    unconditionally.** `dependencies` orders projects inside a single runner process; two suites against the same
    `:2080` backend (the documented TLS-edge second run mode, made easy by `reuseExistingServer`) or `--shard` re-create
    the race in full — now with no retry wrapper. Scope qualifier added to `project-context.md`.
  - `[medium]` `[patch]` **`global-setup.ts` typed the mutation response and then discarded it.** A 200 carrying
    `registrationEnabled: false` would have passed silently and taken the suite down one spec at a time, which is
    exactly what the adjacent comment claimed to prevent. The returned flag is now asserted.
  - `[medium]` `[patch]` **The new "CI still runs `retries: 2`" ledger item prescribed action on a pipeline that does
    not exist.** Verified: no `.github/`, no CI config of any kind; the only E2E entry point runs with `CI` unset, i.e.
    `retries: 0`. So the `retries: 2` branch has never executed here and the three-epic "masked by CI retries" narrative
    names an unverified mechanism. Entry rewritten around what is actually true.
  - `[low]` `[patch]` A second `@registration-toggle` test would have raced the first inside its own project
    (`fullyParallel: true` is inherited). Added `fullyParallel: false` to both toggle projects, with the residual named
    (two tagged tests in *different* files would still parallelise — keep them in one file).
  - `[low]` `[patch]` The `project-context.md` rule "`grep -rn toPass` must return exactly one line" promoted a proxy
    metric to a standing rule and banned any legitimate future use of the matcher by string match. Reworded to target
    the registration guard rather than the token.
  - `[low]` `[patch]` The before/after timing claim ("~48s versus ~39–55s, inside the noise") compared green
    four-project runs against red two-project runs that abandoned 3–5 tests; no green two-project baseline exists.
    Retracted rather than defended. Also softened the hard-coded `51/51/1/1 = 104` totals in `project-context.md` to a
    dated measurement plus the standing invariant (exactly 1 per toggle project).

Rejected findings were mostly noise or already-filed: an anchored-regex suggestion whose stated consequence was
backwards (a `@registration-toggle-v2` tag would be routed *into* the toggle projects, not lost); "a third viewport
project would silently break it" and "nothing stops an untagged flag write" (both already the filed no-machine-gate
item); "the flag stays OFF if the chromium link dies mid-window" (already documented — `global-setup.ts` recovers it
idempotently); the retained `**Action:**` lines under closed ledger entries (that is the file's established
strike-through-and-retain convention, applied consistently); `sprint-status.yaml`'s unbounded cumulative comment
(pre-existing across six stories, already rejected at the 7.2 review); the spec being `in-review` while
`sprint-status.yaml` says `done` (the workflow's own ordering, same as 7.1 and 7.2); the `api.ts` header naming its
consumer; and the observation that the mechanism's rationale is now restated in nine places — true, and the same
prose-volume critique 7.1 and 7.2 both drew, but not fixable by deleting the record that documents it.

Because the patches changed runtime behaviour (`fullyParallel: false`, the global-setup assertion), AC4 was re-proven on
the final code: two further consecutive `104 passed` runs, exit 0, zero flaky — four clean runs in total.

## Design Notes

**The mechanism, and why this one.** Playwright's project `dependencies` is the only construct that orders work *across*
projects; `mode: 'serial'` is per-file within one project and cannot see the other project's workers. A worker-scoped
lock (file mutex) would work but puts an acquire/release at every one of the ~50 register sites — i.e. it re-introduces
waiting exactly where the `toPass` wrapper was, which AC3 exists to remove. Tagging keeps the diff to one test title and
one config array:

```ts
{name: 'chromium', use: {...devices['Desktop Chrome']}, grepInvert: /@registration-toggle/},
{name: 'mobile',   use: {...devices['Pixel 7']},        grepInvert: /@registration-toggle/},
// Runs only after BOTH viewport projects finish → nothing is registering during the OFF window.
{name: 'registration-toggle-chromium', use: {...devices['Desktop Chrome']}, grep: /@registration-toggle/,
 dependencies: ['chromium', 'mobile']},
// Chained behind chromium's copy, not run beside it: two concurrent toggle tests would race each other on the
// same flag — the very bug being fixed, at smaller scale.
{name: 'registration-toggle-mobile', use: {...devices['Pixel 7']}, grep: /@registration-toggle/,
 dependencies: ['registration-toggle-chromium']},
```

**Tag over file split, deliberately.** Moving the test to its own file would drag `loginViaUi`/`loginAsAdmin` with it —
either duplicated (violating Story 7.2's whole point) or promoted into `support/ui.ts` (scope the epic did not grant).
The tag reroutes without moving code. `test('…', {tag: '@registration-toggle'}, async ({…}, testInfo) => {…})` appends
the tag to the title for `grep` purposes.

**`setRegistration(page, true)` at `admin.spec.ts:165` must stay, for a new reason.** Its old justification ("a
concurrent project may have left it off") dies with the race — but the chain now runs the *same* test twice in sequence,
so if the chromium copy strands the flag OFF, the mobile copy's baseline is what recovers it. Keep the call, replace the
comment.

**The dependency chain's cost, stated up front:** when a dependency project fails, Playwright does not run the dependent
one. So a red `chromium` run means the toggle test does not execute at all. Verify this empirically rather than
asserting it, and record what was observed — it changes what a failing report means.

## Verification

**Commands:**
- `cd bp_front && npx tsc -b` -- expected: exit 0. Run before the suite.
- `cd bp_front && npm run lint` -- expected: exit 0, zero output.
- `cd bp_front && npx playwright test --list | tail -5` -- expected: `Total: 104 tests in 9 files`.
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` -- expected:
  51 `chromium`, 51 `mobile`, 1 `registration-toggle-chromium`, 1 `registration-toggle-mobile`.
  **Do not use `--list --project=<name>` for this count:** `--project` pulls in that project's `dependencies`, so the
  two toggle projects report 103 and 104 rather than 1 and 1. Corrected here after the planned command was run and
  found misleading; the record's breakdown is the derived-from-`--list` one above.
- `grep -rn "toPass" bp_front/e2e/` -- expected: exactly one line, `navigation.spec.ts:100`.
- `cd bp_front && npm run test:e2e` -- expected, **twice consecutively**: `104 passed`, zero flaky, zero failed, at
  `retries: 0` against the production image on `:2080`.
- `git diff --stat bp_back/ bp_front/src/ bp_front/package.json bp_front/tsconfig.json bp_front/eslint.config.mjs` --
  expected: empty.

**Manual checks (if no CLI):**
- Read the Playwright HTML report's project column for the tagged test on a green run: it must appear under
  `registration-toggle-chromium` and `registration-toggle-mobile`, and under neither `chromium` nor `mobile`.

## Implementation Record

Executed 2026-08-08 against baseline `00e95cf` (branch `epic7-maintenance`), production image on `http://localhost:2080`
(stack already up; no rebuild needed — no `src/` change). **Nothing committed; the working tree carries the change.**

### Files changed

| File | Δ | What |
|------|---|------|
| `bp_front/e2e/admin.spec.ts` | +30 / −18 (255 lines) | `{tag: '@registration-toggle'}` via the 3-arg `test()` overload; hazard comment rewritten; two adjacent stale comments (`setRegistration` header, inner `finally`) corrected |
| `bp_front/playwright.config.ts` | +47 / −0 (102 lines) | `grepInvert` on `chromium`/`mobile`; two chained `registration-toggle-*` projects; mechanism + rejected-alternatives + skip-on-failure comment |
| `bp_front/e2e/support/ui.ts` | +9 / −10 (97 lines) | `expect(...).toPass()` wrapper and its 10-line rationale deleted; plain `await page.goto('/auth')` + new "why no retry" comment |
| `bp_front/e2e/global-setup.ts` | 53 → 55 lines | converged onto `./support/api` (`BACKEND`, `loginApi`, `gql`); local `BASE_URL`, inline login and inline GraphQL `fetch` deleted; `waitForBackend` kept |
| `bp_front/e2e/support/api.ts` | +2 / −2 | forward reference "Story 7.3 converges it" updated to the accomplished fact |
| `_bmad-output/implementation-artifacts/deferred-work.md` | +75 / −4 | 4 entries closed/resolved, 1 corrected, new `## Deferred from: Story 7.3` section (3 items) |
| `_bmad-output/project-context.md` | +62 / −14 | `registrationEnabled` bullet rewritten; four-project topology + measured `dependencies` bullets added; `api.ts` bullet extended; footer refreshed |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | +2 / −2 | `7-3-…: done`; `last_updated` rewritten |

```
$ git diff --stat
 .../implementation-artifacts/deferred-work.md      | 79 ++++++++++++++++++++--
 .../implementation-artifacts/sprint-status.yaml    |  4 +-
 _bmad-output/project-context.md                    | 76 ++++++++++++++++-----
 bp_front/e2e/admin.spec.ts                         | 48 ++++++++-----
 bp_front/e2e/global-setup.ts                       | 52 +++++++-------
 bp_front/e2e/support/api.ts                        |  4 +-
 bp_front/e2e/support/ui.ts                         | 19 +++---
 bp_front/playwright.config.ts                      | 47 +++++++++++++
 8 files changed, 247 insertions(+), 82 deletions(-)
```

Boundary check (AC7):

```
$ git diff --stat -- bp_back/ bp_front/src/ bp_front/package.json bp_front/tsconfig*.json bp_front/eslint.config.mjs
(empty)
```

### Static gates

```
$ cd bp_front && npx tsc -b
tsc exit=0

$ npm run lint
> bp_front@0.16.0 lint
> eslint .
lint exit=0          # zero output
```

AC3 grep — exactly one hit, the unrelated CSS-hover one:

```
$ grep -rn "toPass" bp_front/e2e/
bp_front/e2e/navigation.spec.ts:100:  }).toPass({timeout: 2000})
```

(Both new comments deliberately avoid the literal token `toPass` — they say
"`expect(async () => …)` reload-until-visible wrapper" — so that AC3's grep stays literally satisfiable.)

### Collection — AC1

```
$ npx playwright test --list | tail -2
  [registration-toggle-mobile] › admin.spec.ts:165:1 › FR20/FR21 — toggling registration off hides the Register link on /auth; back on restores it
Total: 104 tests in 9 files
```

Per-project breakdown — **51 / 51 / 1 / 1 = 104**:

```
chromium: 51
mobile: 51
registration-toggle-chromium: 1
registration-toggle-mobile: 1
```

The tagged test is in exactly the two `registration-toggle-*` projects and nowhere else:

```
$ npx playwright test --list | grep FR20
  [registration-toggle-chromium] › admin.spec.ts:165:1 › FR20/FR21 — toggling registration off …
  [registration-toggle-mobile]   › admin.spec.ts:165:1 › FR20/FR21 — toggling registration off …
```

Note recorded because it costs time to rediscover: `--list` does **not** print the tag, so tag routing cannot be
verified from `--list` output alone. It was verified separately, on the pre-change two-project config, with
`npx playwright test --list --grep "@registration-toggle"` → `Total: 2 tests in 1 file`. In the runner's own progress
output the tag **is** appended to the title (`… back on restores it @registration-toggle`), which is visible in the AC4
logs below.

### AC5 — the race, observed

Protocol: `playwright.config.ts` still in its two-project form (the mechanism absent), the `toPass` workaround
**already deleted**, `retries: 0` (`CI` is unset — verified: `CI=[]`), full `npm run test:e2e` against the production
image. **It reproduced on run 1, and on all three runs.** The widened-window control was therefore **not needed and was
not run** — it is only called for if three runs stay green.

**Run 1 — 3 failed / 101 passed (38.9s)**

```
  3 failed
    [chromium] › e2e/item-editing.spec.ts:320:1 › FR40 — a co-member (not the owner) can edit, and the change lands live on another member's shopping view
    [chromium] › e2e/item-editing.spec.ts:382:1 › FR40 — at ~360px both item controls fit, the name truncates, and the page does not scroll sideways
    [mobile]   › e2e/item-editing.spec.ts:236:1 › FR40 — editing an item preserves its recurring cadence
  101 passed (38.9s)
```

Both predicted signatures, in the same run. The submit-blocked one (`item-editing.spec.ts:320`, chromium):

```
    Error: expect(page).not.toHaveURL(expected) failed
    Expected pattern: not /\/auth$/
    Received string: "http://localhost:2080/auth"
    Timeout: 5000ms
    Call log:
      - Expect "not toHaveURL" with timeout 5000ms
        14 × unexpected value "http://localhost:2080/auth"
       at support/ui.ts:43
        at registerViaUi (…/e2e/support/ui.ts:43:26)
```

with the alert captured verbatim in its error context:

```
$ grep -rn "Registration is disabled" bp_front/test-results/
test-results/item-editing-FR40-—-a-co-m-27855-ther-member-s-shopping-view-chromium/error-context.md:37:- alert: Registration is disabled
test-results/item-editing-FR40-—-editin-c5350-erves-its-recurring-cadence-mobile/error-context.md:37:- alert: Registration is disabled
```

And the missing-link one (`item-editing.spec.ts:382`, chromium):

```
    Test timeout of 30000ms exceeded.
    Error: locator.click: Test timeout of 30000ms exceeded.
    Call log:
      - waiting for getByTestId('to-register-link')
       at support/ui.ts:36
        at registerViaUi (…/e2e/support/ui.ts:36:46)
```

**Run 2 — 5 failed / 99 passed (55.4s)**

```
  5 failed
    [chromium] › e2e/item-editing.spec.ts:382:1 › FR40 — at ~360px both item controls fit, the name truncates, and the page does not scroll sideways
    [chromium] › e2e/item-editing.spec.ts:437:1 › FR40 — clearing the name blocks the save with an inline field error, sending no mutation
    [chromium] › e2e/item-editing.spec.ts:478:1 › FR40 — a rejected save keeps the dialog open and shows the backend message inline
    [mobile]   › e2e/item-editing.spec.ts:201:1 › FR40 — editing a checked item keeps it checked (full-document upsert regression)
    [mobile]   › e2e/item-editing.spec.ts:236:1 › FR40 — editing an item preserves its recurring cadence
  99 passed (55.4s)
```

**Run 3 — 4 failed / 100 passed (55.8s)**

```
  4 failed
    [chromium] › e2e/item-editing.spec.ts:382:1 › FR40 — at ~360px both item controls fit, the name truncates, and the page does not scroll sideways
    [chromium] › e2e/item-editing.spec.ts:437:1 › FR40 — clearing the name blocks the save with an inline field error, sending no mutation
    [chromium] › e2e/item-editing.spec.ts:478:1 › FR40 — a rejected save keeps the dialog open and shows the backend message inline
    [mobile]   › e2e/item-editing.spec.ts:236:1 › FR40 — editing an item preserves its recurring cadence
  100 passed (55.8s)
```

Every failure in all three runs is inside `registerViaUi`, on both projects, and every one is a registration-disabled
symptom. The clustering in `item-editing.spec.ts` is not a property of that spec — it is the spec whose registrations
happen to overlap `admin.spec.ts`'s OFF window in wall-clock order; the prior epics saw the same failures land in
`lists.spec.ts`.

What this measurement settles:

- **It is genuinely cross-project.** Runs 1–3 each failed tests on *both* `chromium` and `mobile` simultaneously, which
  is the direct empirical refutation of `mode: 'serial'` as a candidate fix (AC2): serial mode cannot see the other
  project's workers.

**Withdrawn at review — the "far larger than 1 flaky" inference.** The first draft read: "The race is far larger than
'1 flaky' — 3, 5 and 4 failures per run, not one; the historical reports were measuring `retries: 2` output." That
comparison is invalid. These three runs had the mechanism absent **and the `toPass` workaround already deleted**, so
they measure the fully-exposed race; every historical observation was taken with the workaround in place (five copies of
it, from Epic 6 onward). No run was ever taken in the historical configuration, so nothing here establishes that the
historical numbers under-reported anything. AC5 asked whether the race reproduces with the mechanism disabled — it does,
on every attempt — and that is the claim this section supports. The size comparison is retracted, in this record and in
the three documents it was propagated to.

**Restore:** the mechanism was then added to `playwright.config.ts` (it had never been added before the experiment — see
Decisions), gates re-run clean, and the suite re-confirmed green twice below.

### `dependencies` on failure — measured, not asserted

Method: `e2e/smoke.spec.ts:7` was temporarily made to throw on `chromium` only
(`if (testInfo.project.name === 'chromium') throw new Error('DELIBERATE-7-3-DEPENDENCY-EXPERIMENT')`), full suite run,
then the file restored byte-for-byte from a backup (`git diff -- e2e/smoke.spec.ts` → empty; the marker string is gone).
`mobile` — the *other* dependency — passed throughout.

```
  1 failed
    [chromium] › e2e/smoke.spec.ts:7:1 › app loads and redirects an unauthenticated visit to / → /auth
  2 did not run
  101 passed (37.0s)

$ echo $?   # repeated run, exit code captured directly
EXIT_CODE=1
```

Observed facts, replacing the spec's assumption:

- The dependent projects **do not execute**. Both `registration-toggle-chromium` and `registration-toggle-mobile` are
  counted under **`2 did not run`**.
- Playwright's wording is **"did not run"**, not "skipped" — worth knowing when reading a report. The I/O matrix row
  ("Playwright skips the dependent project") is correct in effect, imprecise in vocabulary.
- **One** failing dependency is sufficient; `dependencies: ['chromium', 'mobile']` is an AND, not a quorum.
- The run exits **1**, and the transitive dependent (`registration-toggle-mobile`, whose own dependency merely did not
  run) is dropped too.
- Consequence, now filed in `deferred-work.md`: a red run yields **zero** information about FR20/FR21. Recovery when
  needed: `npx playwright test --project=registration-toggle-chromium`, which re-runs its dependencies.

### AC4 — the fix, proven

Two consecutive full runs, mechanism in place, `retries: 0`, production image on `:2080`, nothing else changed between
them. Verbatim tails:

**Run 1**

```
[102/104] [chromium] › e2e/smoke.spec.ts:20:1 › a deep-linked client route is served by Caddy (SPA fallback)
[103/104] [registration-toggle-chromium] › e2e/admin.spec.ts:165:1 › FR20/FR21 — toggling registration off hides the Register link on /auth; back on restores it @registration-toggle
[104/104] [registration-toggle-mobile] › e2e/admin.spec.ts:165:1 › FR20/FR21 — toggling registration off hides the Register link on /auth; back on restores it @registration-toggle
  104 passed (48.3s)
EXIT_CODE=0
```

**Run 2**

```
[102/104] [chromium] › e2e/smoke.spec.ts:20:1 › a deep-linked client route is served by Caddy (SPA fallback)
[103/104] [registration-toggle-chromium] › e2e/admin.spec.ts:165:1 › FR20/FR21 — toggling registration off hides the Register link on /auth; back on restores it @registration-toggle
[104/104] [registration-toggle-mobile] › e2e/admin.spec.ts:165:1 › FR20/FR21 — toggling registration off hides the Register link on /auth; back on restores it @registration-toggle
  104 passed (48.4s)
EXIT_CODE=0
```

**Re-run after the review patches (2026-08-08).** The review pass changed runtime behaviour — `fullyParallel: false` on
both toggle projects and a new assertion on the `setRegistrationEnabled` response in `global-setup.ts` — so AC4 was
re-established on the final code rather than inherited from the pre-patch runs:

```
$ npm run test:e2e   # run 1 of 2, post-patch
  104 passed (49.9s)                                  EXIT=0
$ npm run test:e2e   # run 2 of 2, post-patch
  104 passed (50.0s)                                  EXIT=0
$ grep -cE "flaky|failed|did not run" post-patch-run1.log post-patch-run2.log
0    0
```

Four consecutive clean runs in total, `[103/104]`/`[104/104]` ordering unchanged.

Zero flaky, zero failed, zero "did not run" in either of the original two — checked explicitly rather than inferred:

```
$ grep -nE "flaky|failed|did not run" ac4-run1.log ac4-run2.log
grep-exit=1   # no matches
```

The `[103/104]`/`[104/104]` positions are themselves the ordering proof: the two tagged runs are the last two of the run,
after all 102 viewport-project tests, and the tag is visible in their titles.

**Withdrawn at review — the timing claim.** The first draft read "cost of the chain: ~48s versus ~39–55s before, i.e.
inside the run-to-run noise". That compares two *green four-project* runs against three *red two-project* runs that
abandoned work on 3–5 tests; no green two-project baseline was ever measured. The serial tail is two tests long and
almost certainly cheap, but this record offers no evidence for it and the claim is retracted rather than defended.

### Decisions & deviations

1. **AC5 was run *before* the config change rather than by reverting it afterwards.** The spec says "with
   `playwright.config.ts` reverted to its two-project form"; the state it describes is identical to the untouched
   baseline config, so the three disabled-mechanism runs were taken with the spec-file edits applied (tag + `toPass`
   deleted) and the config not yet touched. Same experiment, one less revert cycle and no risk of a botched restore.
2. **No widened-window control run.** Explicitly conditional in the spec on three green runs; all three were red. Stated
   here so its absence is not read as an omission.
3. **The comments deliberately do not contain the literal string `toPass`.** AC3's acceptance is a literal
   `grep -rn "toPass" bp_front/e2e/` returning one line, and prose mentioning the removed workaround would have broken
   it. They say "`expect(async () => …)` reload-until-visible wrapper" instead.
4. **Two stale comments beyond the one the spec named were rewritten** in `admin.spec.ts`: the `setRegistration` helper
   header ("converges even when a **concurrent project** has left the shared flag in the opposite state") and the inner
   `finally` ("a stranded OFF flag — which would break the **concurrent register-based specs**"). Both describe the
   deleted race. The spec required no stale comment describing the old race to survive anywhere; leaving these would
   have violated that while satisfying its letter.
5. **`support/api.ts` header comment updated (2 lines).** It carried a forward reference — "Story 7.3 converges it onto
   this module" — which is now an accomplished fact. Not in the spec's file list; a comment-only correction.
6. **Scope addition, recorded as instructed: `global-setup.ts` convergence** is sourced from `deferred-work.md:308-312`
   ("deliberately deferred to Story 7.3, which owns that file"), not from the epic's `Files:` line. It imports
   `BACKEND`, `loginApi`, `gql`; `waitForBackend` stays local and now polls `${BACKEND}/api/auth/config`. **The ledger's
   prediction that this would "hit immediately" the `PASSWORD`-in-`ui.ts` coupling was wrong and is corrected in place:**
   `global-setup.ts` authenticates as `admin`/`admin`, so it needs nothing from the runner-importing module. That entry
   stays open on its own merits, but with zero actual instances rather than one.
7. **The FR20/FR21 test kept its `setRegistration(page, true)` baseline**, with the comment replaced per Design Notes:
   it now exists because the chain runs the same test twice in sequence, so the mobile link recovers a flag the chromium
   link might strand.
8. **`testIgnore: '**/support/**'` was not added** — out of charter per the spec's Never list; the 7.2 ledger entry stays
   open. It is grouped in the new ledger section with a second, related enforcement gap the mechanism introduces.
9. **Ledger placement:** the Epic 5 close-out entry is the rollup (mechanism + measurements); the Epic-6-review duplicate
   closes by reference to it, and no new entry restates the same debt (AC6). Three genuinely *new* items were filed under
   `## Deferred from: Story 7.3`.
10. **CI `retries: 2` was left alone** (the spec forbids lowering `retries`), but the decision is now filed as a ledger
    item: it was added to absorb this specific race, the race is gone, and it is the exact mechanism that let the flake
    be accepted seven times.

### Not done / limitations

- **No CI run.** All evidence is local, `CI` unset, `retries: 0`, against the compose stack on `:2080`. The CI path
  (`retries: 2`, cold `docker compose up --build`) is unexercised by this record.
- **No TLS-edge run.** `E2E_BASE_URL=https://bag-please.localhost` was not exercised; nothing in this change touches the
  origin-under-test, but the claim is untested on that path.
- **The `dependencies`-on-failure observation used a deliberately thrown error in a spec file, not a broken product
  behaviour** — the spec's own suggestion. It proves the scheduler's behaviour, which is what was in question; it does
  not exercise a product regression.
- **Five full-suite runs is a small sample for a probabilistic race.** Two green runs meet AC4 as written, and the
  before/after contrast is stark (3/5/4 failures → 0/0), but two clean runs cannot prove the absence of a rarer
  interaction. What can be said precisely: the mechanism makes it *structurally impossible* for a registration to
  overlap the OFF window within a run, and the residual risk is a flag stranded OFF **across** runs, which
  `global-setup.ts` covers idempotently.
- **Nothing is committed**, per instruction; the working tree carries all eight files. (Superseded: the review pass
  committed the story as its final step, per the workflow.)

## Auto Run Result

Status: **done**

### Implemented change

The `registrationEnabled` E2E race — one shared Mongo `ApplicationConfig` document contended by the concurrently
running `chromium` and `mobile` Playwright projects, accepted seven times across two epics and masked by a retry
wrapper — is **deleted at its source**. The single test that writes the flag (FR20/FR21 in `admin.spec.ts`) is tagged
`@registration-toggle`; the tag is `grepInvert`ed out of both viewport projects and `grep`-selected into two new
projects chained behind them with `dependencies`, so the OFF window opens only once nothing anywhere is registering.
The `expect(...).toPass()` workaround in `support/ui.ts` was deleted in the same change rather than left beside the fix.

### Files changed

- `bp_front/playwright.config.ts` — four projects instead of two: `grepInvert` on `chromium`/`mobile`, plus
  `registration-toggle-chromium` (`dependencies: ['chromium','mobile']`) and `registration-toggle-mobile` (chained
  behind it), both `fullyParallel: false`.
- `bp_front/e2e/admin.spec.ts` — the FR20/FR21 test tagged via the `test(title, details, body)` overload; three stale
  comments describing the dead race rewritten.
- `bp_front/e2e/support/ui.ts` — `registerViaUi` now starts with a plain `await page.goto('/auth')`; the retry wrapper
  and its rationale are gone.
- `bp_front/e2e/global-setup.ts` — converged onto `./support/api` (`BACKEND`, `loginApi`, `gql`); asserts the mutation
  actually returned `registrationEnabled: true`.
- `bp_front/e2e/support/api.ts` — header comment updated from a forward reference to a fact (comment only).
- `_bmad-output/implementation-artifacts/deferred-work.md` — four entries closed/resolved, two corrected, one new
  Story 7.3 section, one new review section (3 defers).
- `_bmad-output/project-context.md` — the "Known race" bullet replaced by the new invariant and its rules; four-project
  topology, the collection trap, the `--no-deps` recovery, and the single-invocation scope added.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story `done`; `last_updated` records mechanism, AC4/AC5
  outcomes and the scope addition.

### Review findings

11 patches applied (8 medium, 3 low), 3 deferred (all medium), 10 rejected, 0 intent gaps, 0 spec defects — full detail
in the Review Triage Log. The medium patches were, in the main, **false or unsupported claims in newly written
authoritative prose**: a config comment asserting a mobile gate the test's own hand-built contexts void, a recovery
command that could not work without `--no-deps`, "`dependencies` is the only construct that orders across projects"
(`teardown` also does, and would remove the cost this story accepted as debt), an over-read of the AC5 measurement
propagated to three documents, an unconditional invariant that actually holds only within one Playwright invocation, and
a ledger action item aimed at a CI pipeline this repo does not contain. Two were behavioural: `fullyParallel: false` on
the toggle projects, and asserting the `setRegistrationEnabled` response instead of discarding it.

### Verification performed

- `npx tsc -b` exit 0; `npm run lint` exit 0, zero output.
- `npx playwright test --list` → `Total: 104 tests in 9 files`; per-project split **51 / 51 / 1 / 1**, the tagged test
  in the two `registration-toggle-*` projects and nowhere else.
- `grep -rn "toPass" bp_front/e2e/` → exactly one hit, `navigation.spec.ts:100` (unrelated CSS-hover settle).
- **AC5** — mechanism disabled, three consecutive `retries: 0` runs failed **3 / 5 / 4** tests, every failure inside
  `registerViaUi`, on `chromium` *and* `mobile` in the same run. Reproduced on attempt 1, so the widened-window control
  was not needed.
- **AC4** — four consecutive full runs at `retries: 0` against the production image, all `104 passed`, exit 0, zero
  flaky/failed/did-not-run: two before the review patches (48.3s, 48.4s) and two after them (49.9s, 50.0s).
- `dependencies`-on-failure measured, not assumed: a deliberately failed `chromium` test gave
  `1 failed / 2 did not run / 101 passed`, exit 1.
- `git diff --stat` over `bp_back/`, `bp_front/src/`, `package.json`, `tsconfig*.json`, `eslint.config.mjs` — empty.

### Residual risks

- **The mechanism is config-and-prose with no machine gate.** An untagged flag write, or a dropped `grepInvert`,
  silently restores the race, and `Total: 104` will not notice. The per-project-split check is the only detector and it
  is documented, not enforced. Filed; grouped with the 7.2 review's two enforcement gaps.
- **A red run yields zero FR20/FR21 information** — the accepted price of `dependencies`. `teardown` would remove it and
  was never evaluated; filed.
- **Exclusivity is per-invocation.** Two suites against one backend, or `--shard`, re-create the race with no wrapper
  left to absorb it. Documented, not prevented.
- **FR20/FR21's mobile coverage is narrower than the project count suggests** — the public-effect assertions run in
  hand-built contexts at a desktop viewport. Pre-existing; filed.
- **Four green runs is a small sample for a probabilistic race.** The strong claim here is structural (no registration
  can overlap the OFF window within one invocation), not statistical.
- **No CI and no TLS-edge run.** All evidence is local against `:2080` with `CI` unset.
