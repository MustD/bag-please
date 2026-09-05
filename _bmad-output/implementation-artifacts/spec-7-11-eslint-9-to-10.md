---
title: 'Story 7.11 — ESLint 9 → 10'
type: 'chore'
created: '2026-08-16'
status: 'done'
baseline_revision: '42c2f52'
final_revision: '3516961'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md'
warnings: [oversized]
# oversized: ~5.9k tokens (3264 words / 23405 bytes, measured), against the template's 900–1600 target —
#   lean by this epic's standards (7.7–7.10 ran 53k–78k bytes) but over the target, so it is flagged.
#   Two things carry the extra length and neither is padding. (1) AC2 is a
#   *falsification* requirement — the rule must be observed reporting, not observed configured — and the
#   project's own convention (a green check proves nothing until seen red) makes the injection/revert
#   protocol part of the deliverable. (2) The bump's real risk is not the peer graph, which measured clean;
#   it is three newly-recommended core rules and a decoupled @eslint/js. Both are recorded with the
#   measurement that found them, because a later reader who trims them re-derives the probe from scratch.
---

<intent-contract>

## Intent

**Problem:** `eslint` and `@eslint/js` are on 9.39.5 while ESLint 10 is `latest` (10.8.1). The linter is this project's
only static gate over conventions no type check can see — chiefly `react-hooks/set-state-in-effect`, which is what
forbids `useEffect` state-sync and forces the render-phase-adjustment pattern used by all seven dialogs.

**Approach:** Move `eslint` and `@eslint/js` to 10 in one commit, keeping every plugin at its current version, then
prove by falsification that the two load-bearing rule behaviours survived: `react-hooks/set-state-in-effect` still
**reports** in `src/`, and Story 7.1's `react-refresh/only-export-components` split (on in `src/`, off in `e2e/`) still
holds. `eslint.config.mjs` changes only if ESLint 10 requires it.

## Boundaries & Constraints

**Always:**
- **Re-measure the registry in this pass before editing.** `npm view eslint dist-tags`, `npm view @eslint/js dist-tags`,
  and the `eslint` peer of `typescript-eslint`, `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`. This
  spec's numbers were measured 2026-08-16 and the registry moves. Never route on a recalled number.
- **`@eslint/js` is a separate package in v10 and no longer tracks `eslint`'s version.** `eslint@10.8.1` does not
  depend on it at all (`eslint@9.39.5` did), and `@eslint/js`'s own `latest` is **10.0.1**. Bump each to *its own*
  latest; do not "align" them to one number.
- **Whatever `typescript-eslint` this story lands must still declare a `typescript` peer admitting the held `6.0.3`**
  (Story 7.10's inverse constraint). `8.67.0` peers `>=4.8.4 <6.1.0` — it does. If the plugin has to move, re-check
  that bound before accepting the move.
- **Both caret bases are rewritten.** `"^9.39.4"` cannot admit a major; leaving it and relying on the lockfile is the
  half-bump Story 7.9 already ruled out.
- **Every rule outcome is proven by observing a failure, never by reading a config.** `--print-config` shows a rule is
  *configured*; only a deliberate violation shows it is *enforced*. Both AC2 and AC3 are discharged the falsification
  way.
- A held-back dependency **closes** this story `done` under S-AC3. It does not fail it and does not block 7.12.

**Block If:**
- `react-hooks/set-state-in-effect` no longer reports and the plugin ships **no** named replacement. Wiring up a
  documented rename is in scope (AC2 says so); inventing a substitute for a dropped rule is not — HALT.
- A newly-recommended core rule reports on real code and the fix is not mechanical — i.e. it would change runtime
  behaviour, or the honest fix is "this rule does not fit this codebase". Choosing to disable a rule the ESLint team
  put in `recommended` is `md`'s call, not an unattended one. HALT with the verbatim report.
- The full Playwright suite is red for any reason **other** than the filed `createUserViaUi` signature
  (`create-user-dialog Expected 0 / Received 1` at `admin.spec.ts:49`). That one is known, size-driven and re-runnable;
  anything else is unattributable while a dependency moved. HALT.

**Never:**
- **No rule is disabled, downgraded to `warn`, or side-stepped by widening `ignores` to make the bump pass.** That is
  S-AC4's forbidden move, and here it would silently delete the gate this story exists to keep.
- No `--legacy-peer-deps`, `--force`, `overrides` or `resolutions` — not even transiently. If the peer graph refuses,
  that is the S-AC3 blocking symptom, not an obstacle to route around.
- No type-aware linting (`parserOptions.projectService`, `no-floating-promises`). It is real and filed debt from Story
  7.1; enabling it here would make an ESLint major unattributable.
- No **surviving** product-source or test edit, no weakened assertion, no `npm run generate`, no backend or Gradle
  change, and no `typescript` movement (major held at 6 by Story 7.10). The AC2/AC3 probes are throwaway injections
  reverted inside the same task; `git status --short` clean is what certifies that, and the final commit must contain
  no `bp_front/src/` or `bp_front/e2e/` path.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Bump lands clean | `eslint`/`@eslint/js` at 10, plugins unmoved | `npm install` prints no peer warning; `npm run lint` exits 0 over the same file set as baseline | No error expected |
| New recommended rule fires | `no-unassigned-vars` / `no-useless-assignment` / `preserve-caught-error` report | Fix the code, mechanically, in the file that violates | Non-mechanical fix → HALT (Block If) |
| AC2 falsification | a `useEffect` state-sync injected into a real component | `npm run lint` exits non-zero naming `react-hooks/set-state-in-effect` | Rule silent → the gate is gone; HALT unless a documented rename exists |
| AC3 falsification | an exported non-component **function** added to a `src/` component file | `src/` reports `react-refresh/only-export-components`; `e2e/support/ui.ts` stays clean with its six such exports | Either half wrong → the Story 7.1 split broke; fix the config |
| A plugin refuses ESLint 10 | install or config load fails | Revert, record the verbatim symptom in `deferred-work.md`, close `done` (S-AC3) | Never worked around |
| `ignores` semantics shifted | `dist`, `src/__generated__`, report dirs | The linted-file set is byte-identical to baseline | A generated file entering the set is a config regression, not new debt |

</intent-contract>

## Code Map

All registry facts measured 2026-08-16 on a clean tree at `42c2f52` (branch `epic7-maintenance`).

**Files this story may change:**
- `bp_front/package.json` — `:29` `"@eslint/js": "^9.39.4"` → `"^10.0.1"`; `:37` `"eslint": "^9.39.4"` → `"^10.8.1"`.
  Nothing else in the file moves. Lockfile installed today: both `9.39.5`.
- `bp_front/package-lock.json` — the resolution. Expect `espree` 10 → 11, `eslint-scope` → 9, `eslint-visitor-keys`
  → 5, `@eslint/core` → 1.x, `minimatch` → 10, and `@eslint/js` to leave `eslint`'s dependency set entirely.
- `bp_front/eslint.config.mjs` — **only if ESLint 10 requires it.** The expectation is *unchanged*: the flat-config
  shape, `tseslint.config()`, the `ignores` array, `languageOptions.ecmaVersion: 2022` and the last-wins
  `bp/e2e-playwright` override are all still supported. Any edit here must be justified by a captured error, not by
  tidiness.
- `_bmad-output/implementation-artifacts/deferred-work.md` — a new `## Deferred from: Story 7.11 …` section **only if
  this pass produces debt**. Insertion point is **line 1102**, i.e. after the Story 7.10 section's last content line
  (1100) and its trailing blank (1101), and before `## Deferred from: code review of 7-10-typescript-6-to-7`. Story
  sections run in ascending order from line 210; code-review sections start at 1102 and are a separate run. Re-measure
  these numbers before editing.
- `_bmad-output/project-context.md` — Technology Stack only: the `eslint` / `@eslint/js` numbers, and the one directive
  worth an agent's time (the two packages have separate version lines in v10). New debt goes to the ledger, not here
  (NFR-E7-1). Maintain the `_Last Updated` chain and adjudicate `rule_count` (currently **94**).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-11-eslint-9-to-10` `backlog` → `done`,
  `last_updated` refreshed.

**Read-only — the verification targets:**
- `bp_front/eslint.config.mjs:21-33` — the `**/*.{ts,tsx}` block whose `extends` pulls `js.configs.recommended`
  (source of the three new rules), `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended` and
  `reactRefresh.configs.vite`.
- `bp_front/eslint.config.mjs:34-49` — `bp/e2e-playwright`, last object so it wins: this is AC3's subject.
- `bp_front/package.json:12` — `"lint": "eslint ."`. `bp_front/Dockerfile:12` runs `npm run build` only, so **lint is
  not in the image build**; the image nonetheless `npm ci`s eslint 10, and `node:26-alpine` satisfies its
  `engines.node` (`^20.19.0 || ^22.13.0 || >=24`). Local toolchain measured `v26.4.0`.
- The seven render-phase-adjustment dialogs (`ConfirmDialog`, `AddItemDialog`, `EditItemDialog`, `DeleteUserDialog`,
  `ResetPasswordDialog`, `ShareMembersDialog`, plus `ListShoppingPage`) — what AC2's rule protects.

## Tasks & Acceptance

**Execution:**
- [x] **Baseline, before anything moves.** Confirm `git status --short` clean on `epic7-maintenance`. From `bp_front/`
      capture verbatim: `npx eslint --version`; `npm run lint` (exit code); the **linted-file set**
      `npx eslint . -f json | python3 -c "import sys,json;[print(r['filePath']) for r in json.load(sys.stdin)]" | sort`
      (this is the `ignores`-integrity baseline for AC-ignores); `npx eslint --print-config src/routes/ListsPage.tsx`
      and `… e2e/support/ui.ts`, recording `react-hooks/set-state-in-effect` and
      `react-refresh/only-export-components` from each; `rm -rf node_modules/.tmp && npm run build` with the emitted
      chunk name and size. Then `docker compose up -d --build` and the full `npm run test:e2e` at `retries: 0`, plus
      `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`. **If the baseline E2E is red, re-run
      it once** (the `createUserViaUi` defect is filed); if still red for a different reason, HALT.
- [x] **Re-measure the registry and route.** Record `npm view eslint dist-tags --json`,
      `npm view @eslint/js dist-tags --json`, and `peerDependencies` for `typescript-eslint@latest`,
      `eslint-plugin-react-hooks@latest`, `eslint-plugin-react-refresh@latest`. State explicitly whether each admits
      ESLint 10 **and** whether `typescript-eslint`'s `typescript` peer still admits `6.0.3`. Choose LAND or HOLD from
      **this** measurement.
- [x] `bp_front/package.json` + `bp_front/package-lock.json` — rewrite both caret bases and `npm install`. Capture the
      install output verbatim and assert it contains **no** `ERESOLVE` and no peer warning (AC1). Confirm the resolved
      versions with `npm ls eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh`.
- [x] **`npm run lint` on the bumped tree, and prove the ignores held.** Exit 0, and the linted-file set from the same
      command as the baseline is **identical** (diff the two sorted lists). A `dist/` or `src/__generated__/` path
      appearing is a config regression to fix here, not debt to file. If one of the three rules new to
      `js.configs.recommended` — `no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error` — reports, fix
      the code; if the fix is not mechanical, HALT (Block If).
- [x] **AC2, by falsification.** Inject a `useEffect` state-sync into `src/routes/AuthPage.tsx` — immediately after
      `const [mode, setMode] = useState<Mode>('login')`, add `useEffect(() => { setMode('register') }, [])`. This exact
      shape was **verified to fire under ESLint 9.39.5 in this planning pass** (`Avoid calling setState() directly
      within an effect`, `react-hooks/set-state-in-effect`, 1 error), so a silent run under 10 means the rule died, not
      that the probe was weak. Confirm `npm run lint` exits non-zero naming the rule, capture verbatim, then
      `git checkout -- src/routes/AuthPage.tsx` and confirm `git status --short` shows no `src/` path. A
      `--print-config` reading is **not** an acceptable substitute. If ESLint 10 renamed the rule, wire the replacement
      into the config and demonstrate the equivalence the same way.
- [x] **AC3, by falsification — and use a `function`, not a `const`.** The rule runs with
      `allowConstantExport: true`, so `export const bpProbe = 1` is **silent**; that trap was measured in this planning
      pass and a const-shaped probe would have "passed" while proving nothing. Append
      `export function bpProbeFn() { return 1 }` to a `src/` component file (`src/components/ConfirmDialog.tsx` was the
      verified site — 1 error under 9.39.5) and confirm `react-refresh/only-export-components` reports. For the e2e
      half no injection is needed: `e2e/support/ui.ts` already exports six non-component functions and lints clean, so
      its silence *is* the live falsification — but state that reasoning explicitly rather than leaving it implicit.
      Revert the `src/` probe and confirm the tree is clean. Record the two `--print-config` readings as corroboration
      only.
- [x] **S-AC2 and the build gate.** `rm -rf node_modules/.tmp && npm run build` exits 0 and emits a chunk **identical**
      to the baseline (name and size) — eslint is not in the bundle or in `bp_front/Dockerfile`'s build step, so a
      differing artifact would mean something else moved. Then `docker compose build bp_front` exit 0, proving `npm ci`
      resolves eslint 10 under `node:26-alpine`. No screenshot pass is required for a lint-only change; state that
      disposition rather than omitting it.
- [x] **S-AC1 full gate.** `docker compose up -d --build` and the full `npm run test:e2e` at `retries: 0`, with the
      per-project split re-measured. The standing invariant is **exactly 1** test in each `registration-toggle-*`
      project; the total alone proves nothing. Never quote a remembered count.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — insert a Story 7.11 section at line 1102 **only if
      this pass produced debt**. If it produced none, say so explicitly in the record rather than leaving the reader to
      infer it. Verify the three regions (1–1101, the insertion, 1102–end) are otherwise byte-unchanged.
- [x] `_bmad-output/project-context.md` — record the two new version lines and the `@eslint/js`-is-decoupled directive;
      prepend a Story 7.11 entry to the `_Last Updated` chain and adjudicate `rule_count` from 94.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-11-eslint-9-to-10: done` with the measured
      evidence, `last_updated` refreshed. Do **not** touch the open Story 7.10 `action_items` entry; it belongs to a
      TypeScript re-check, not to this story.
- [x] **Commit alone.** One commit for the bump; `git show --stat` must show `bp_front/package.json`,
      `bp_front/package-lock.json` and — only if a captured error forced it — `bp_front/eslint.config.mjs`. No product
      source, no spec/test edit inside `bp_front/`.

**Acceptance Criteria:**
- Given AC1, when the story closes, then `eslint` and `@eslint/js` are each at their own latest 10.x, every plugin
  resolves with **no peer warning in this pass's captured install output**, and `eslint.config.mjs` still loads —
  demonstrated by `npm run lint` completing over a non-zero file set, not by the file merely parsing.
- Given AC2, when the story closes, then the record contains a verbatim `npm run lint` failure naming
  `react-hooks/set-state-in-effect`, produced under ESLint 10 by a deliberate `useEffect` state-sync, plus the clean
  `git status --short` proving the injection was reverted.
- Given AC3, when the story closes, then the record shows `react-refresh/only-export-components` reporting under ESLint
  10 for an exported non-component **function** injected into a `src/` component file (reverted), and silent for
  `e2e/support/ui.ts`, whose six standing non-component exports are named as what makes that silence meaningful.
- Given the `ignores` array is the only exclusion mechanism (flat config ignores `.gitignore`), when the bump lands,
  then the sorted linted-file set is identical before and after, quoted from both measurements.
- Given S-AC1, when the story closes, then `npm run lint`, `npm run build` and the full four-project Playwright suite
  were measured green **in this pass** on the bumped tree, with the per-project split recorded and never quoted. No
  Gradle change means `:bp_back:test` is out of this story's gate — state that rather than omitting it.
- Given S-AC4, when the final diff is reviewed, then it touches only the version files (plus `eslint.config.mjs` if a
  captured error forced it) and the three paperwork files, and contains no disabled rule, no `warn` downgrade, no
  widened `ignores`, and no weakened assertion.
- Given S-AC3, when any plugin or ESLint 10 itself cannot be made green, then the tree is reverted, the verbatim
  blocking symptom and the version attempted are recorded in `deferred-work.md` — not `project-context.md` — and the
  story still closes `done`.

## Spec Change Log

## Review Triage Log

### 2026-08-16 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 1, medium 3, low 3)
- defer: 6: (high 0, medium 1, low 5)
- reject: 3
- addressed_findings:
  - `[high]` `[patch]` **AC3's e2e half was an assertion that could not fail for the reason it was written** — both
    reviewers found it independently and it verified. `react-refresh/only-export-components` never scans `.ts`
    (`eslint-plugin-react-refresh/index.js:36-40`: early return on `.spec.`, then
    `shouldScan = .jsx || .tsx || checkJS && .js`), and all 14 files matched by `bp/e2e-playwright` are `.ts`, so
    `e2e/support/ui.ts` is silent whether the override wins, loses or is deleted. Re-measured with a control: a
    component plus a non-component function in the `.ts` file `src/lib/lists/homePath.ts`, where the rule resolves to
    `[2]`, reports nothing; the same shape in the `.tsx` `src/components/StoreField.tsx` reports. The claim was
    retracted in place in the spec and **in the two documents it had propagated to** — `project-context.md` (the AI
    rules file, the most damaging place for a false rule) and `sprint-status.yaml` — each marked do-not-restore. The
    epic's AC3 as written is still satisfied; the `e2e/` half now rests on `--print-config` alone, stated at that
    strength.
  - `[medium]` `[patch]` **No rule-set regression check existed across a major.** Green lint plus an identical file set
    cannot see a rule v10 removed. Measured directly by installing `@eslint/js` 9.39.5 and 10.0.1 side by side and
    diffing `configs.recommended.rules`: **61 → 64, nothing removed, nothing downgraded**, the three additions being
    exactly those the migration guide names. Recorded as §11(a) with the corroborating engine-level `--print-config`
    diff and an explicit note that the latter is confounded.
  - `[medium]` `[patch]` **The three new recommended rules were cleared on green-only evidence** — the same
    "reading a config" substitution the spec forbids for AC2/AC3. Each is now observed firing on a purpose-built
    violation under v10 (§11(b)), including the detail that `preserve-caught-error` needs a catch *parameter*, which is
    why a parameterless probe reads as a false negative.
  - `[medium]` `[patch]` **"No new debt was produced" was falsified by the review itself.** Withdrawn in the spec,
    `project-context.md` and `sprint-status.yaml`; a Story 7.11 ledger section was inserted at line 1102 (73 lines,
    pure insertion, regions 1–1101 and former 1102–end verified byte-identical by md5).
  - `[low]` `[patch]` **S-AC2 was recorded as "discharged" when it was self-waived.** Reworded to a reasoned waiver
    that names what S-AC2 asks for and that Story 7.7 took twelve screenshots for it, keeping the byte-identical-bundle
    argument on its own merits rather than as a substitute box-tick.
  - `[low]` `[patch]` **AC1's "no peer warning" could not have failed** — §2 had already measured all four plugins at
    `^10.0.0` before the install. Reframed as entailed-and-necessary rather than as independent confirmation (§11(e)).
  - `[low]` `[patch]` **The `ignores` integrity proof is narrower than it reads** — only 2 of 7 entries carry lintable
    content, and no `--max-warnings 0` means a warning-level regression keeps exit 0. Scope stated honestly in the spec
    and `project-context.md`; the script change filed rather than made (S-AC4).
- deferred_findings:
  - `[medium]` No `engines` field in `bp_front/package.json` while ESLint 10 narrows the Node floor to
    `^20.19.0 || ^22.13.0 || >=24` — Node 22.12.x/23.x builds, type-checks and E2E-tests but cannot lint, and npm only
    warns `EBADENGINE`. Both paths in use (mise `26.4.0`, `node:26-alpine` measured `v26.7.0`) are fine, so this is an
    unpinned floor, not a live defect. Adding the field is outside S-AC4.
  - `[low]` `eslint.config.mjs:47`'s react-refresh override is unreachable configuration, and has been since Story 7.1
    — which also makes the epic's own AC3 premise mistaken.
  - `[low]` `npm run lint` has no `--max-warnings 0`, so an ignores regression surfacing as a warning cannot redden the
    gate.
  - `[low]` `eslint.config.mjs` is in the linted set but matches neither `files` block, so it is walked with no rules.
  - `[low]` `eslint` and `@eslint/js` are now independently versioned behind carets with an *optional* peer, so nothing
    keeps them coherent and an `@eslint/js` minor can redden lint with no `eslint` bump.
  - `[low]` `rule_count`'s adjudication is not reproducible — 94 → 95 was counted for one bullet carrying three
    independently trippable facts. `md` to rule on what it counts, or retire it.
- rejected_findings:
  - **"The production-image gate never ran"** (raised `high`). The premise — a changed lockfile must yield a new image
    ID — is false: stage 1 is discarded, the final image is the Caddy base plus `/app/dist`, and `eslint` is a
    devDependency reaching neither, so an identical `dist/` legitimately reproduces the identical image ID and
    `Created` timestamp. Disproved directly by building the stage and reading `v10.8.1` / `10.0.1` / `v26.7.0` out of
    it (§11(c)). The residue worth keeping — containers were never recreated — is recorded there.
  - The record not being strictly chronological (commit `--stat` shown before later `git status` output). Cosmetic;
    ordering is recoverable.
  - Prescriptive harness proposals (a committed `fixtures/lint-probes` directory wired into the gate, a peer-range
    assertion in CI). Reasonable ideas, but scope bleed under S-AC4, and the finding that motivated the first carried
    a rule count (`105 → 108`) that this pass measured as wrong.

## Design Notes

### 1 — The peer graph is clean, and that is the measurement, not the expectation

Measured 2026-08-16. `eslint` latest **10.8.1** (`maintenance` 9.39.5; `next` 10.0.0-rc.2 is *older* than latest and
never a candidate). `@eslint/js` latest **10.0.1**. Peers:

```
typescript-eslint@8.67.0        eslint: ^8.57.0 || ^9.0.0 || ^10.0.0   typescript: >=4.8.4 <6.1.0
eslint-plugin-react-hooks@7.1.1 eslint: ^3 … || ^9.0.0 || ^10.0.0
eslint-plugin-react-refresh@0.5.4 eslint: ^9 || ^10
globals@17.11.0                 (no eslint peer — a data package; already latest)
```

All four already at the versions installed here, so **no plugin needs to move**. Story 7.10's inverse constraint is
satisfied in the same line: `<6.1.0` admits the held `typescript@6.0.3`.

### 2 — The two real risks, and why neither is the peer graph

**(a) `@eslint/js` is decoupled.** `eslint@9.39.5` depends on `@eslint/js@9.39.5`; `eslint@10.8.1` has no `@eslint/js`
dependency at all, and the package's own latest has only reached `10.0.1`. The v9 habit of moving both to the same
number would pin a version that does not exist.

**(b) Three rules are new to `js.configs.recommended` in v10** — `no-unassigned-vars`, `no-useless-assignment`,
`preserve-caught-error` — and `js.configs.recommended` is `extends`ed at `eslint.config.mjs:24`. All three already
exist in 9.39.5, so this pass probed them ahead of the bump:

```
npx eslint . --rule '{"no-unassigned-vars":"error","no-useless-assignment":"error","preserve-caught-error":"error"}'
→ exit 0, no output
```

That probe is only worth anything with a control, which was run: `--rule '{"no-magic-numbers":"error"}'` → **140
errors**, and an invented rule name aborts ESLint. So the flag genuinely applied and the codebase genuinely reports
zero. Treat it as a strong signal, not a proof — v10's implementations may differ, and the authoritative run is
`npm run lint` under 10.

Other v10 changes reviewed and judged non-applicable here, recorded so the next reader does not re-derive them: the new
config-lookup algorithm is now default (only one `eslint.config.*` exists in this repo, at `bp_front/`); `.eslintrc` and
the `FlatESLint`/`LegacyESLint` APIs are removed (never used); `context.get*()` and several `SourceCode` methods are
removed (plugin-author surface — this project authors no rules); JSX references are now tracked, which affects
`no-unused-vars`, but `tseslint` disables the base rule in favour of `@typescript-eslint/no-unused-vars`. Node
`^20.19.0 || ^22.13.0 || >=24` is satisfied by the local `v26.4.0` and by `node:26-alpine`.

### 3 — Why AC2 and AC3 are discharged by breaking things

Baseline `--print-config`, measured today: `react-hooks/set-state-in-effect` is `[2]` in both `src/` and `e2e/`;
`react-refresh/only-export-components` is `[2, {allowConstantExport: true}]` in `src/` and `[0, …]` in `e2e/`. Those
readings prove the *config* survives — they cannot prove the rule still *fires*, which is the whole point of AC2's
"still active and still reports". This is the same convention the Epic 6 retro established for E2E specs, applied to a
lint rule: six of that epic's review patches were assertions that could not fail for the reason they were written.

Both probes were run against the **current** ESLint 9.39.5 tree during planning, precisely so the implementation pass
starts from a probe known to be non-vacuous, and both were reverted (`git status --short` clean):

```
# src/routes/AuthPage.tsx, after `const [mode, setMode] = useState<Mode>('login')`
useEffect(() => { setMode('register') }, [])
→ error  Avoid calling setState() directly within an effect  react-hooks/set-state-in-effect   (1 problem)

# src/components/ConfirmDialog.tsx, appended
export function bpProbeFn() { return 1 }
→ error  Fast refresh only works when a file only exports components …  react-refresh/only-export-components
export const bpProbeConst = 1
→ SILENT — allowConstantExport: true. A const-shaped probe is the vacuous-assertion trap for AC3.
```

## Verification

**Commands** (all from `bp_front/`, all measured in this pass — never quoted):
- `npx eslint --version` — expected: `v10.x` after the bump.
- `npm ls eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh` — expected: no
  `UNMET PEER DEPENDENCY`, no `invalid` marker.
- `npm run lint` — expected: exit 0.
- `npx eslint . -f json | python3 -c "import sys,json;[print(r['filePath']) for r in json.load(sys.stdin)]" | sort` —
  expected: identical to the baseline capture.
- `npm run lint` with the AC2 injection present — expected: **non-zero exit**, output naming
  `react-hooks/set-state-in-effect`.
- `npm run lint` with the AC3 `function` probe present — expected: `react-refresh/only-export-components` on the `src/`
  file, absent for `e2e/support/ui.ts`. (A `const` probe is silent by design — `allowConstantExport: true`.)
- `rm -rf node_modules/.tmp && npm run build` — expected: exit 0, chunk name and size identical to baseline.
- `docker compose build bp_front` — expected: exit 0 (`npm ci` resolves eslint 10 on musl/node 26).
- `docker compose up -d --build && npm run test:e2e` — expected: exit 0 at `retries: 0`.
- `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` — expected: exactly 1 test in each
  `registration-toggle-*` project; the two viewport projects equal to each other.
- `git status --short` after every revert step — expected: empty apart from this spec.
- `git show --stat` on the bump commit — expected: the version files only (plus `eslint.config.mjs` only if a captured
  error forced it).

## Implementation Record

**Status: implemented (LAND).** `eslint` 9.39.5 → **10.8.1**, `@eslint/js` 9.39.5 → **10.0.1**, one commit,
`8078627`, on `epic7-maintenance`. Not pushed, no PR. Every figure below was produced by a command run in this pass on
2026-08-16; nothing is carried from the spec's planning numbers, from the ledger, or from memory.

### 1 — Baseline, before anything moved

Tree clean at `42c2f52` apart from this untracked spec:

```
$ git status --short
?? _bmad-output/implementation-artifacts/spec-7-11-eslint-9-to-10.md
$ git branch --show-current
epic7-maintenance
```

Toolchain and linter:

```
$ node --version   → v26.4.0
$ npm --version    → 11.17.0
$ npx eslint --version
v9.39.5
$ npm run lint
> bp_front@0.16.0 lint
> eslint .
LINT_EXIT=0
```

**Linted-file set (the `ignores`-integrity baseline)** —
`npx eslint . -f json | python3 -c "…filePath…" | sort` → **52 paths**, saved to
`.tmp/d4085cd6-…/linted-baseline.txt`. Head and tail of the sorted list (elided in the middle for length; the full
52-line capture is the artifact that was diffed, not this excerpt):

```
/…/bp_front/codegen.ts
/…/bp_front/e2e/account.spec.ts
…  [46 paths elided — full list in the temp capture]
/…/bp_front/src/theme.ts
/…/bp_front/src/vite-env.d.ts
/…/bp_front/vite.config.ts
```

**`--print-config` baseline** (recorded as corroboration only — it proves the rule is *configured*, never that it
fires):

```
=== src/routes/ListsPage.tsx ===
react-hooks/set-state-in-effect = [2]
react-refresh/only-export-components = [2, {"allowConstantExport": true}]
=== e2e/support/ui.ts ===
react-hooks/set-state-in-effect = [2]
react-refresh/only-export-components = [0, {"allowConstantExport": true}]
```

**Build baseline** — `rm -rf node_modules/.tmp && npm run build`, `BUILD_EXIT=0`:

```
> bp_front@0.16.0 build
> tsc -b && vite build

vite v8.2.1 building client environment for production...
transforming...✓ 1255 modules transformed.
dist/index.html                  0.36 kB │ gzip:   0.26 kB
dist/assets/index-D0HEEKre.js  801.60 kB │ gzip: 240.42 kB

✓ built in 197ms
(!) Some chunks are larger than 500 kB after minification. …
```

**Baseline E2E gate.** `docker compose up -d --build` → `COMPOSE_EXIT=0`. Per-project split, measured with the
`--list` command (never `--list --project=…`, which pulls in dependencies):

```
$ npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c
     59 chromium
     59 mobile
      1 registration-toggle-chromium
      1 registration-toggle-mobile
Total: 120 tests in 10 files
```

```
$ npm run test:e2e
  120 passed (43.2s)
E2E_EXIT=0
```

**Green first try.** The filed `createUserViaUi` size-driven defect did not fire, so the spec's "re-run once" branch
was never entered and its HALT branch never armed.

**Baseline `npm audit`** was not run before the install; it was reconstructed afterwards from the committed HEAD~1
lockfile so the comparison is still a measurement rather than a recollection — see §9.

### 2 — Registry re-measurement and the routing decision

Measured in this pass, 2026-08-16:

```
$ npm view eslint dist-tags --json
{ "es6jsx": "0.11.0-alpha.0", "next": "10.0.0-rc.2", "maintenance": "9.39.5", "latest": "10.8.1" }

$ npm view @eslint/js dist-tags --json
{ "next": "10.0.0-rc.0", "latest": "10.0.1", "maintenance": "9.39.5" }

$ npm view typescript-eslint@latest version peerDependencies --json
{ "version": "8.67.0",
  "peerDependencies": { "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0" } }

$ npm view eslint-plugin-react-hooks@latest version peerDependencies --json
{ "version": "7.1.1",
  "peerDependencies": { "eslint": "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0 || ^10.0.0" } }

$ npm view eslint-plugin-react-refresh@latest version peerDependencies --json
{ "version": "0.5.4", "peerDependencies": { "eslint": "^9 || ^10" } }

$ npm view globals@latest version peerDependencies --json
"17.11.0"            ← version only; the package declares no peerDependencies at all
```

**Does each admit ESLint 10?** `typescript-eslint` **yes** (`^10.0.0` named explicitly).
`eslint-plugin-react-hooks` **yes** (`^10.0.0`). `eslint-plugin-react-refresh` **yes** (`^10`). `globals` **n/a** — a
data package with no `eslint` peer. All four are already installed at exactly those versions, so **no plugin needs to
move.**

**Does `typescript-eslint`'s `typescript` peer still admit the held 6.0.3?** **Yes** — `>=4.8.4 <6.1.0`. Story 7.10's
inverse constraint is satisfied without moving `typescript` at all.

**Decision: LAND.** Reason: both target packages have a stable `latest` in the 10 line, every plugin peer already
admits ESLint 10 at its current installed version, and the one constraint that could have forced a plugin move
(`typescript` ≥ 6.0.3 admitted) is satisfied by the plugin already in the tree. Nothing in the measurement points at a
HOLD. Note also that `eslint`'s `next` tag (`10.0.0-rc.2`) is **older** than `latest` and was never a candidate.

### 3 — What actually changed

`bp_front/package.json`, both caret bases rewritten — the half-bump Story 7.9 ruled out was not available here anyway,
since `"^9.39.4"` cannot admit a major:

```diff
-    "@eslint/js": "^9.39.4",
+    "@eslint/js": "^10.0.1",
...
-    "eslint": "^9.39.4",
+    "eslint": "^10.8.1",
```

`npm install` — **`INSTALL_EXIT=0`**, verbatim and complete:

```
added 1 package, removed 18 packages, changed 14 packages, and audited 421 packages in 2s

99 packages are looking for funding
  run `npm fund` for details

1 high severity vulnerability

To address all issues, run:
  npm audit fix

Run `npm audit` for details.
```

**AC1's assertion holds: no `ERESOLVE`, no peer warning of any kind.** No `--legacy-peer-deps`, `--force`, `overrides`
or `resolutions` was used, transiently or otherwise. The single advisory line is pre-existing and unrelated — §9.

Resolved versions:

```
$ npx eslint --version
v10.8.1

$ npm ls eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals
bp_front@0.16.0 /home/md/projects/personal/bag-please/bp_front
├─┬ @eslint/js@10.0.1
│ └── eslint@10.8.1 deduped
├─┬ eslint-plugin-react-hooks@7.1.1
│ └── eslint@10.8.1 deduped
├─┬ eslint-plugin-react-refresh@0.5.4
│ └── eslint@10.8.1 deduped
├─┬ eslint@10.8.1
│ └─┬ @eslint-community/eslint-utils@4.9.1
│   └── eslint@10.8.1 deduped
├── globals@17.11.0
└─┬ typescript-eslint@8.67.0
  ├─┬ @typescript-eslint/eslint-plugin@8.67.0
  │ ├─┬ @typescript-eslint/type-utils@8.67.0
  │ │ └── eslint@10.8.1 deduped
  │ └── eslint@10.8.1 deduped
  ├─┬ @typescript-eslint/parser@8.67.0
  │ └── eslint@10.8.1 deduped
  ├─┬ @typescript-eslint/utils@8.67.0
  │ └── eslint@10.8.1 deduped
  └── eslint@10.8.1 deduped
```

No `UNMET PEER DEPENDENCY` and no `invalid` marker anywhere in that tree.

**`eslint.config.mjs` was NOT touched.** Nothing in ESLint 10 produced an error against it, so the spec's "only if a
captured error forced it" clause never fired. The flat-config shape, `tseslint.config()`, the `ignores` array,
`languageOptions.ecmaVersion: 2022` and the last-wins `bp/e2e-playwright` override all still work as written.

**The `@eslint/js` decoupling, verified in the lockfile rather than inferred.** `eslint`'s dependency map at HEAD vs
now:

```
HEAD  node_modules/eslint dependencies: { …, "@eslint/eslintrc": "^3.3.6", "@eslint/js": "9.39.5", … }
NEW   node_modules/eslint dependencies: { …  no @eslint/eslintrc, no @eslint/js at all … }

NEW   node_modules/@eslint/js = { "version": "10.0.1", …,
        "peerDependencies": { "eslint": "^10.0.0" },
        "peerDependenciesMeta": { "eslint": { "optional": true } },
        "engines": { "node": "^20.19.0 || ^22.13.0 || >=24" } }
```

**Lockfile deltas** (computed by diffing the two `packages` maps, not read off the patch):

```
ADDED (1):    @types/esrecurse 4.3.1
REMOVED (18): @eslint/eslintrc 3.3.6 · @eslint/eslintrc/node_modules/globals 14.0.0 ·
              eslint/node_modules/chalk 4.1.2 · eslint/node_modules/ansi-styles 4.3.0 ·
              color-convert 2.0.1 · color-name 1.1.4 · has-flag 4.0.0 · supports-color 7.2.0 ·
              concat-map 0.0.1 · lodash.merge 4.6.2 · strip-json-comments 3.1.1 ·
              @typescript-eslint/typescript-estree/node_modules/{minimatch 10.2.6, brace-expansion 5.0.9,
              balanced-match 4.0.4} · @typescript-eslint/visitor-keys/node_modules/eslint-visitor-keys 5.0.1 ·
              graphql-config/node_modules/{minimatch 10.2.5, brace-expansion 5.0.7, balanced-match 4.0.4}
CHANGED (14): eslint 9.39.5→10.8.1 · @eslint/js 9.39.5→10.0.1 · espree 10.4.0→11.2.0 ·
              eslint-scope 8.4.0→9.1.2 · eslint-visitor-keys 4.2.1→5.0.1 · @eslint/core 0.17.0→1.2.1 ·
              @eslint/config-array 0.21.2→0.23.5 · @eslint/config-helpers 0.4.2→0.7.0 ·
              @eslint/object-schema 2.1.7→3.0.5 · @eslint/plugin-kit 0.4.1→0.7.2 · acorn 8.17.0→8.18.0 ·
              minimatch 3.1.5→10.2.6 · brace-expansion 1.1.16→5.0.9 · balanced-match 1.0.2→4.0.4
```

Every resolution the Code Map predicted (`espree` 10→11, `eslint-scope`→9, `eslint-visitor-keys`→5,
`@eslint/core`→1.x, `minimatch`→10, `@eslint/js` leaving `eslint`'s dependency set) is present. The one item the Code
Map did not name and that an agent should know: **`@eslint/eslintrc` — the `.eslintrc` compatibility layer — and the
`globals@14` it bundled are gone from the tree entirely.** This repo never used them.

**The commit:**

```
$ git show --stat 8078627
807862754339cee3322e10c4c699ad9d85842f80
Story 7.11: ESLint 9 → 10 (eslint 10.8.1, @eslint/js 10.0.1)

 bp_front/package-lock.json | 415 ++++++++++++---------------------------------
 bp_front/package.json      |   4 +-
 2 files changed, 106 insertions(+), 313 deletions(-)
```

Two files, both version files. **No `bp_front/src/` path, no `bp_front/e2e/` path, no `eslint.config.mjs`, no backend
or Gradle path.**

### 4 — Lint on the bumped tree, and the `ignores` proof

```
$ npm run lint
> bp_front@0.16.0 lint
> eslint .
LINT_EXIT=0            ← zero output
```

Linted-file set re-measured with the identical command and diffed against the baseline capture:

```
$ wc -l < linted-bumped.txt
52
$ diff linted-baseline.txt linted-bumped.txt
DIFF_EXIT=0            ← no output, byte-identical
```

**AC-ignores discharged.** The `ignores` array still holds; no `dist/` or `src/__generated__/` path entered the set,
so there is no config regression to fix and no debt to file.

**The three rules new to `js.configs.recommended` in v10**, measured on the bumped tree rather than assumed from the
planning probe:

```
$ npx eslint --print-config src/routes/ListsPage.tsx  (extract)
no-unassigned-vars      = [2]
no-useless-assignment   = [2]
preserve-caught-error   = [2, {"requireCatchParameter": false, "errorClassNames": []}]
```

All three are live errors under the real v10 implementations, and `npm run lint` still exits 0 — so **none of them
reports on this codebase, no code was touched, and the "non-mechanical fix" Block If never fired.** This supersedes
the planning-pass `--rule` probe, which could only speak for the 9.39.5 implementations.

### 5 — AC2, by falsification

Injected into `src/routes/AuthPage.tsx`, immediately after `const [mode, setMode] = useState<Mode>('login')`:

```ts
useEffect(() => { setMode('register') }, [])
```

`npm run lint` → **`LINT_EXIT=1`**, verbatim:

```
> bp_front@0.16.0 lint
> eslint .


/home/md/projects/personal/bag-please/bp_front/src/routes/AuthPage.tsx
  46:21  error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/md/projects/personal/bag-please/bp_front/src/routes/AuthPage.tsx:46:21
  44 |
  45 |   const [mode, setMode] = useState<Mode>('login')
> 46 |   useEffect(() => { setMode('register') }, [])
     |                     ^^^^^^^ Avoid calling setState() directly within an effect
  47 |   const [username, setUsername] = useState('')
  48 |   const [password, setPassword] = useState('')
  49 |   const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({})  react-hooks/set-state-in-effect

✖ 1 problem (1 error, 0 warnings)
```

**`react-hooks/set-state-in-effect` still exists, still fires, and was not renamed.** The rename branch and the HALT
branch both stayed closed. Reverted with `git checkout -- bp_front/src/routes/AuthPage.tsx`:

```
$ git status --short
 M bp_front/package-lock.json
 M bp_front/package.json
?? _bmad-output/implementation-artifacts/spec-7-11-eslint-9-to-10.md
$ git status --short | grep 'bp_front/src/'
(none)
```

### 6 — AC3, by falsification, with the `function` shape

**src/ half.** `export function bpProbeFn() { return 1 }` appended to `src/components/ConfirmDialog.tsx` →
**`LINT_EXIT=1`**, verbatim:

```
> bp_front@0.16.0 lint
> eslint .


/home/md/projects/personal/bag-please/bp_front/src/components/ConfirmDialog.tsx
  113:17  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

✖ 1 problem (1 error, 0 warnings)
```

**The const trap, re-measured under v10 rather than quoted from planning.** The same file, same position, const shape:

```
$ # export const bpProbeConst = 1   appended to src/components/ConfirmDialog.tsx
$ npm run lint
> bp_front@0.16.0 lint
> eslint .
CONST_PROBE_LINT_EXIT=0     ← SILENT
```

So a `const`-shaped probe would have "passed" while asserting nothing — `allowConstantExport: true` is still in force
under ESLint 10. The `function` shape is what makes this a real falsification, and this measurement is what proves it,
in this pass, on this version.

**e2e half — why no injection is needed, stated explicitly rather than left implicit.** `e2e/support/ui.ts` already
carries exactly the export shape that just failed in `src/`: six exported non-component **functions**, plus a const —

```
$ grep -n "^export " e2e/support/ui.ts
20:export const PASSWORD = 'e2e-password-123'
22:export function uniqueUsername(prefix: string, label: string, projectName: string): string {
28:export async function registerViaUi(page: Page, username: string, password: string): Promise<void> {
51:export async function openListsViaMenu(page: Page): Promise<void> {
61:export async function createListAndOpen(page: Page, name: string): Promise<string> {
73:export async function addCategory(page: Page, name: string): Promise<void> {
84:export async function addItem(page: Page, categoryName: string, itemName: string, store?: string): Promise<void> {
```

— and it lints clean in the same run that failed on `ConfirmDialog.tsx`.

> **RETRACTED AT REVIEW (2026-08-16) — do not restore the earlier wording.** This section originally read: *"That
> silence is not an absence of evidence; it is the live falsification … If the `bp/e2e-playwright` override had stopped
> winning, those six exports would have produced six errors. They produced none."* **That claim is false, and it is the
> exact defect class this project's convention exists to catch: an assertion that cannot fail for the reason it was
> written.** `react-refresh/only-export-components` never scans `.ts` at all —
> `node_modules/eslint-plugin-react-refresh/index.js:36-40` returns `{}` immediately for any filename containing
> `.spec.`, and then gates on `shouldScan = filename.endsWith(".jsx") || filename.endsWith(".tsx") || checkJS &&
> filename.endsWith(".js")`. Every one of the 14 files matched by `bp/e2e-playwright` is `.ts`. `ui.ts` would be silent
> whether the override wins, loses, or is deleted outright.
>
> **Measured at review, with a control, on the bumped tree** — a component *and* a non-component function appended to
> `src/lib/lists/homePath.ts`, a `.ts` file where the rule resolves to `[2]`, i.e. **on**:
>
> ```
> $ npx eslint src/lib/lists/homePath.ts        # rule = error here
> (no output, exit 0)                            ← SILENT despite a real violation
>
> $ npx eslint src/components/StoreField.tsx     # .tsx control, same rule, same shape
>   92:17  error  Fast refresh only works when a file only exports components …  react-refresh/only-export-components
> ✖ 1 problem (1 error, 0 warnings)
> ```
>
> **What AC3 actually establishes, stated at the strength the evidence supports:** the epic's AC3 asks that the
> exclusion "still holds and the support module lints clean" and that "the rule still applies to `src/`". Both are
> true and both were measured — the `src/` half by genuine falsification above, the `e2e/` half by the
> `--print-config` reading `[0, …]` below. The `e2e/` half is therefore discharged by configuration inspection **only**,
> which is weaker than this spec's own standard demands, and no stronger evidence is obtainable while `e2e/` contains
> no `.tsx` and no component export. That structural fact — `eslint.config.mjs:47` has been unreachable since Story
> 7.1, so the epic's premise for AC3 is itself mistaken — is filed in `deferred-work.md`, not swept.

Corroborating `--print-config` on the bumped tree, recorded as corroboration only:

```
=== src/routes/ListsPage.tsx ===
react-hooks/set-state-in-effect = [2]
react-refresh/only-export-components = [2, {"allowConstantExport": true}]
=== e2e/support/ui.ts ===
react-hooks/set-state-in-effect = [2]
react-refresh/only-export-components = [0, {"allowConstantExport": true}]
```

Identical to the pre-bump reading. Both probes reverted; tree clean:

```
$ git status --short
 M bp_front/package-lock.json
 M bp_front/package.json
?? _bmad-output/implementation-artifacts/spec-7-11-eslint-9-to-10.md
$ git status --short | grep -E 'bp_front/(src|e2e)/'
(none)
```

### 7 — Gates

| Gate | Command | Exit | Headline |
|---|---|---|---|
| Lint | `npm run lint` | **0** | zero output, 52 files, set byte-identical to baseline |
| Build | `rm -rf node_modules/.tmp && npm run build` | **0** | `dist/assets/index-D0HEEKre.js` **801.60 kB** / gzip **240.42 kB**, 1255 modules, vite 8.2.1 |
| Image | `docker compose build bp_front` | **0** | `npm ci` → `added 420 packages, and audited 421 packages in 7s` under `node:26-alpine` |
| Stack | `docker compose up -d --build` | **0** | mongo healthy, all three containers running |
| E2E | `npm run test:e2e` | **0** | **`120 passed (43.6s)`** at `retries: 0`, green first try |

**Build artifact is identical to baseline** — same filename hash `index-D0HEEKre.js`, same 801.60 kB, same 240.42 kB
gzip. Since the hash is content-derived, this is byte-identity, not merely a size coincidence. That is exactly what a
lint-only change must produce: `eslint` is in neither the bundle nor `bp_front/Dockerfile:12`'s build step (which runs
`npm run build`, not `npm run lint`).

**Image build detail.** `npm ci` inside `node:26-alpine` resolved eslint 10 with no `ERESOLVE`; the only warning in
the whole build is the pre-existing `npm warn deprecated node-domexception@1.0.0`. ESLint 10's
`engines.node` is `^20.19.0 || ^22.13.0 || >=24`, satisfied by both the image and the local `v26.4.0`.

**Per-project split, re-measured on the bumped tree** (never `--list --project=…`):

```
$ npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c
     59 chromium
     59 mobile
      1 registration-toggle-chromium
      1 registration-toggle-mobile
Total: 120 tests in 10 files
```

**The standing invariant — exactly 1 test in each `registration-toggle-*` project — holds**, and the two viewport
projects are equal to each other at 59. The total (120) was not treated as evidence on its own; the split is what was
checked, before and after, and it is unchanged.

**Neither E2E run needed a retry.** Baseline `120 passed (43.2s)`, bumped `120 passed (43.6s)`, both exit 0 at
`retries: 0`. The filed `createUserViaUi` defect (`admin.spec.ts:49`) did not fire at either end, so the spec's HALT
condition on an unattributable failure never came into play.

### 8 — S-AC2 and `:bp_back:test`, stated rather than omitted

**S-AC2 disposition: a reasoned waiver, not a discharge — the distinction was sharpened at review.** S-AC2 as written
(`epics.md:3345-3347`) asks for a real-browser pass at ~360px and desktop; Story 7.7 took twelve screenshots for it.
None was taken here, so this is the implementer declining a standing criterion on the merits, and it is recorded as
such rather than as a box ticked. The merits, for the record: a linter is a
build-time static analyser that emits no code, it appears nowhere in `vite.config.ts`, nowhere in the bundle, and
nowhere in `bp_front/Dockerfile`'s build step. The positive evidence is stronger than a screenshot pair would be —
the built chunk is **byte-identical to the pre-bump baseline by content hash**, so the artifact served at `:2080` is
literally the same file, and 120 Playwright assertions across desktop and mobile viewports passed against it. A
screenshot pass compares renderings of a bundle; here the bundle itself is proven unchanged.

**`:bp_back:test` is out of this story's gate.** S-AC1 requires it only "for any story touching the Gradle catalog".
This story touched no Gradle file: `git diff` over `bp_back/` and `gradle/` is empty, `gradle/libs.versions.toml` is
unchanged, and the commit contains no backend path. Stating this rather than silently omitting it is the point.

### 9 — Residual risks, new debt, and one incidental finding

> **OVERTURNED AT REVIEW (2026-08-16) — do not restore.** This section originally read *"No new debt was produced by
> this pass, and `deferred-work.md` is therefore UNCHANGED."* The review surfaced six deferrable items and a Story 7.11
> section **was** inserted at line 1102, 73 lines, pure insertion — regions 1–1101 and the former 1102–end verified
> byte-identical by md5 against `HEAD`. The two that matter: `eslint.config.mjs:47`'s react-refresh override is
> unreachable configuration (and has been since Story 7.1, which also makes the epic's AC3 premise mistaken), and
> `bp_front/package.json` declares no `engines` field while ESLint 10 narrows the Node floor to
> `^20.19.0 || ^22.13.0 || >=24` — so Node 22.12.x/23.x builds, type-checks and E2E-tests this project but cannot lint
> it, with npm only warning `EBADENGINE`.

What does still hold, and is unaffected by the above: nothing was held back, nothing was worked around, no rule was
disabled or downgraded to `warn`, no `ignores` entry was widened, no assertion was weakened, and no configuration file
needed an edit. The insertion point named in the Code Map was re-measured and confirmed correct — line 1100 is the
Story 7.10 section's last content line, 1101 its trailing blank, and 1102 was
`## Deferred from: code review of 7-10-typescript-6-to-7 (2026-08-15)`.

**One incidental finding, measured on both sides.** `npm audit --package-lock-only` was run against the HEAD~1
lockfile reconstructed into a temp directory, so the comparison is a measurement rather than a recollection:

```
BEFORE (HEAD~1 lockfile):  2 high severity vulnerabilities
  brace-expansion  <=1.1.17 || 4.0.0 - 5.0.8   (GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895)
    node_modules/brace-expansion, node_modules/graphql-config/node_modules/brace-expansion
  js-yaml  4.0.0 - 4.3.0                       (GHSA-5p4m-2wfm-xmqj)

AFTER (bumped lockfile):   1 high severity vulnerability
  js-yaml  4.0.0 - 4.3.0                       (GHSA-5p4m-2wfm-xmqj)
```

The bump **incidentally closed the `brace-expansion` advisory** by carrying that package 1.1.16 → 5.0.9 (past the
`<=5.0.8` range) as a transitive of eslint 10's `minimatch` 3.1.5 → 10.2.6. The surviving `js-yaml` 4.3.0 high is
**pre-existing and unrelated to eslint** — `npm ls js-yaml --all` puts it under `@graphql-codegen/cli@7.2.0` via
`cosmiconfig@9.0.2` and `graphql-config@5.1.6 → cosmiconfig@8.3.6`, and the HEAD lockfile already carried 4.3.0. It is
already filed in `deferred-work.md` (Story 7.9's npm-advisories entry).

**Residual risk / a note for the next reader, not debt:** that same ledger entry still reads "4 npm advisories (1
moderate, 3 high)", a figure dated 2026-08-13. Today the tree measures 1. The entry was **not** edited — reconciling
another story's ledger record is scope bleed under S-AC4, and the drift is in the safe direction (the ledger overstates
the exposure). Flagged here so a reviewer can decide whether to reconcile it in a pass that owns that file.

**Residual risk, carried not created:** type-aware linting is still off (`tseslint.configs.recommended`, no
`parserOptions.projectService`), so `@typescript-eslint/no-floating-promises` still does not run and an un-awaited
web-first matcher in a spec still ships undetected. That is Story 7.1's filed debt, deliberately untouched here — the
spec's `Never` list forbids enabling it inside an ESLint major, because doing so would make the major unattributable.

### 10 — Deviations from the spec

Two, both small, both declared rather than absorbed:

1. **`project-context.md` — one edit beyond the two version lines and the `@eslint/js` directive.** The Technology
   Stack's TypeScript-hold bullet carried a forward-looking clause written by Story 7.10: *"This hold does not block
   Story 7.11 on the TypeScript axis … 7.11 must still check `eslint-plugin-react-hooks`,
   `eslint-plugin-react-refresh`, `@eslint/js` and `globals` against ESLint 10 itself."* That prediction is now
   discharged, and leaving it in the present tense would have told the next agent to perform work that this pass
   already did. It was rewritten into a measurement, keeping the half that survives (any future `typescript-eslint`
   must still admit the held 6.x). The edit is inside the Technology Stack section the spec authorises, and it neither
   adds nor removes a rule.
2. **`rule_count` adjudicated 94 → 95, not held at 94.** The spec says "adjudicate", not "hold". One genuinely new
   directive was added — the two packages are separate version lines in v10, so each is bumped to its own latest and
   never aligned — which is a thing an agent can get wrong (it would try to install `@eslint/js@10.8.1`, which does not
   exist). The two supporting facts recorded alongside it (`@eslint/eslintrc` is gone; the three new `recommended`
   rules) are stated as consequences within that same bullet, not counted as separate rules.

Everything else followed the plan exactly. In particular: the AC2/AC3 injection-and-revert protocol was executed as
written including the `function`-shaped AC3 probe; no `Block If` condition triggered; nothing on the `Never` list was
done; the commit contains only the two version files; `deferred-work.md` was left untouched because no debt exists; and
Story 7.10's open `action_items` entry in `sprint-status.yaml` was not touched, since it belongs to a TypeScript
re-check rather than to this story.

### 11 — Measurements added at review (2026-08-16)

Four checks the implementation pass either skipped or answered with green-only evidence. All were run against the
bumped tree; every probe was reverted and `git status --short` shows no `bp_front/` path.

**(a) The rule-set regression check — the one most worth having, and it was missing.** `npm run lint` exit 0 and an
identical linted-file set are both blind to a rule that v10 *removed* or downgraded. Measured directly, by installing
both versions of `@eslint/js` side by side in a scratch directory and diffing `configs.recommended.rules`:

```
@eslint/js recommended: 9.39.5 = 61 rules, 10.0.1 = 64 rules
--- REMOVED or DOWNGRADED in 10.0.1 ---
(none)
--- ADDED in 10.0.1 ---
no-unassigned-vars   "error"
no-useless-assignment "error"
preserve-caught-error "error"
```

**Nothing removed, nothing downgraded, exactly three added** — and they are exactly the three the migration guide
names. A second reading, `--print-config` on `src/routes/ListsPage.tsx` and `e2e/support/ui.ts` under both the v9 and
v10 *engines*, shows 108 resolved rules on each side with no severity change anywhere; the only deltas are four
option payloads (`no-shadow-restricted-names` `reportGlobalThis` **false → true**, a genuine tightening, plus default
materialisations on `no-constant-binary-expression`, `no-unused-vars` and `preserve-caught-error`). Note that second
reading is confounded — the v9 *engine* was run against the already-upgraded `@eslint/js` 10 — which is precisely why
the side-by-side package diff above is the authoritative measurement and this one is corroboration.

**(b) The three new rules were cleared on green-only evidence; each is now observed firing.** The record originally
concluded they "are live errors and report NOTHING" from `--print-config` severities plus a clean exit — the exact
"reading a config" substitution this spec forbids for AC2/AC3. Probed individually under v10, in
`src/lib/lists/storeValue.ts`:

```
let u: number; return typeof u        → 19:34 error 'u' is always 'undefined' because it's never assigned   no-unassigned-vars
let x = 1; x = 2; return x            → 19:34 error The value assigned to 'x' is not used in subsequent statements  no-useless-assignment
try {…} catch (e) { throw new Error() } → 21:59 error There is no `cause` attached to the symptom error being thrown  preserve-caught-error
```

All three enforce. `preserve-caught-error` needs a catch **parameter** to fire (`requireCatchParameter: false`), which
is why a parameterless `catch { throw … }` probe reads as a false negative.

**(c) The musl `npm ci` claim, proven rather than inferred.** A review finding alleged the image gate never ran,
reasoning that a changed lockfile must yield a new image ID — and every `bag-please-*` image is still dated
2026-08-13. **That inference is wrong and the finding is rejected**: stage 1 is discarded, the final image contains
only the Caddy base plus `/app/dist`, and `eslint` is a devDependency that reaches neither. An identical `dist/` is
therefore *expected* to reproduce the identical image ID and retain its original `Created` timestamp — which is the
same fact the record's byte-identical chunk hash already asserts. Corroborating it, `docker compose build bp_front`
re-run at review reports every layer `CACHED` **against today's lockfile**, which is only possible if a build already
consumed exactly this lockfile. Settled by reading the answer straight out of the build stage:

```
$ docker build --target build -f bp_front/Dockerfile -t bp-verify-build .
$ docker run --rm bp-verify-build sh -c 'npx eslint --version; node -p "require(\"/app/node_modules/@eslint/js/package.json\").version"; node --version'
v10.8.1
10.0.1
v26.7.0
```

So `npm ci` under `node:26-alpine` does resolve eslint 10.8.1 and `@eslint/js` 10.0.1 on musl. What the finding *did*
get right, and is worth keeping: containers were never recreated, so the suite ran against the pre-existing stack —
harmless here only because the artifact is provably identical.

**(d) The `ignores` proof is narrower than it reads.** The before/after set comparison is real (52 files, `diff` exit
0), but only `dist` and `src/__generated__` of the array's seven entries carry lintable content — three of the others
do not exist on disk. And `package.json:12` has no `--max-warnings 0`, so a regression surfacing as a warning would
leave exit 0. Filed; not fixed here, as widening the lint script is outside S-AC4.

**(e) AC1's "no peer warning" was entailed, not independently established.** §2 had already measured, *before* the
install, that all four plugins named `^10.0.0` at their installed versions. Given that, a clean `npm install` could not
have gone otherwise. It is still a true and necessary check — it just is not the independent confirmation the record's
framing implied.

## Auto Run Result

Status: **done** — landed bump, not a hold.

### Implemented change

`eslint` `^9.39.4` → `^10.8.1` (resolved **10.8.1**) and `@eslint/js` `^9.39.4` → `^10.0.1` (resolved **10.0.1**) in
`bp_front/`, in one commit, with no plugin moved and `eslint.config.mjs` untouched. All four plugins already declared
an ESLint 10 peer at their installed versions, so the peer graph needed no work; Story 7.10's inverse constraint
(`typescript-eslint`'s `typescript` peer must still admit the held `6.0.3`) was re-checked and holds at `<6.1.0`.

### Files changed

**Committed in `8078627` (the bump):**
- `bp_front/package.json` — the two caret bases rewritten (+2/−2). A major cannot ride a `^9` range.
- `bp_front/package-lock.json` — the resolution (106 insertions / 313 deletions; 1 package added, 18 removed, 14
  changed). `@eslint/eslintrc` and its bundled `globals@14` leave the tree with the `.eslintrc` compat layer.

**Committed in the review commit (paperwork and corrections):**
- `_bmad-output/implementation-artifacts/spec-7-11-eslint-9-to-10.md` — plan, implementation record, review triage log,
  and §11's four review-added measurements.
- `_bmad-output/implementation-artifacts/deferred-work.md` — new Story 7.11 section, 73 lines, pure insertion at line
  1102; regions 1–1101 and the former 1102–end verified byte-identical by md5.
- `_bmad-output/project-context.md` — eslint/`@eslint/js` version lines, the decoupling directive, the retracted AC3
  inference, the rule-set regression measurement, `rule_count` 94 → 95.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-11-eslint-9-to-10: done`, `last_updated` refreshed,
  three corrected claims. Story 7.10's open `action_items` entry untouched.

### Review findings breakdown

7 patches applied (1 high, 3 medium, 3 low), 6 items deferred (1 medium, 5 low), 3 rejected, 0 intent gaps, 0 spec
loopbacks. The high patch is the retraction of AC3's e2e-half falsification claim — an assertion that could not fail
for the reason it was written — from the spec and from the two documents it had propagated into. The rejected high
finding ("the production-image gate never ran") was disproved by direct measurement.

### Verification performed

All measured in this pass, none quoted. `npm run lint` exit 0 over 52 files with the sorted linted-file set identical
to baseline; `npm run build` exit 0 emitting `dist/assets/index-D0HEEKre.js` at 801.60 kB / 240.42 kB gzip, byte-identical
to baseline by content hash; `docker compose build bp_front` exit 0, and the build stage inspected directly to read
`eslint 10.8.1` / `@eslint/js 10.0.1` / `node v26.7.0` out of the musl image; full Playwright suite `120 passed` at
`retries: 0`, green first try, split re-measured 59 / 59 / 1 / 1 with the standing invariant of exactly one test in
each `registration-toggle-*` project intact. AC2 proven by falsification (injected `useEffect` state-sync → exit 1
naming `react-hooks/set-state-in-effect`); AC3's `src/` half likewise, with the `const`-shaped trap re-measured as
silent under v10. Added at review: `@eslint/js` recommended 61 → 64 rules with nothing removed or downgraded, and each
of the three additions observed firing individually. `:bp_back:test` is out of gate — no Gradle path moved.

### Residual risks

- **AC3's `e2e/` half cannot be proven while `e2e/` holds no `.tsx` and no component export.** It rests on
  `--print-config` alone, and `eslint.config.mjs:47` is unreachable configuration. Filed; the fix is `md`'s call
  between deleting the override and making it load-bearing.
- **The Node floor is narrower than anything declares.** ESLint 10 requires `^20.19.0 || ^22.13.0 || >=24` while vite 8
  admits `>=22.12.0`, and `bp_front/package.json` has no `engines` field, so npm only warns. Both paths in use are
  fine.
- **`eslint` and `@eslint/js` are now decoupled behind carets with an optional peer**, so an `@eslint/js` minor can add
  a recommended rule and redden lint with no `eslint` bump.
- **The `ignores` array is only partially exercised** by the set comparison, and no `--max-warnings 0` means a
  warning-level regression keeps exit 0.
- Carried, not created: type-aware linting is still off, so `no-floating-promises` still does not run (Story 7.1's
  filed debt). The surviving `js-yaml` high advisory is pre-existing via `@graphql-codegen/cli`; the bump took
  `bp_front` from 2 high to 1 by clearing `brace-expansion`. `deferred-work.md`'s Story 7.9 entry still says
  "4 npm advisories" and is now stale in the safe direction — deliberately not edited, as reconciling another story's
  record is scope bleed under S-AC4.
