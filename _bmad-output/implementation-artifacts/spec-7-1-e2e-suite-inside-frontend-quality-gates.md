---
title: 'Story 7.1 — Bring the E2E suite inside the frontend quality gates'
type: 'chore'
created: '2026-08-07'
status: 'done'
baseline_revision: 'ea6ebde'
final_revision: 'cf6fa9e'
review_loop_iteration: 0
followup_review_recommended: true  # 8 patches (4 medium) all landed in the documentation/bookkeeping ~80% of the diff that no gate checks — including two factually false ledger prescriptions and a rules-file correction; that text is read as authoritative by later agents, so an independent pass over the corrected prose is cheap and warranted
context:
  - '{project-root}/_bmad-output/implementation-artifacts/7-1-e2e-suite-inside-frontend-quality-gates.md'
  - '{project-root}/_bmad-output/project-context.md'
warnings: [oversized]  # ~4k tokens vs the template's 900–1600 target; the story's 11 settled decisions and pre-verified configs are load-bearing, not padding
---

<intent-contract>

## Intent

**Problem:** `bp_front/e2e/` (10 files, 2,474 lines — 1,015 of them added by Epic 6) is inside neither frontend static
gate: `lint` is `eslint src/`, and the only tsconfig projects include `src` and `vite.config.ts`. Playwright
type-*strips* rather than type-checks, so "lint and build pass" is a vacuous claim about the suite the project treats as
its hard gate.

**Approach:** Add a third TypeScript project (`tsconfig.e2e.json`) referenced from the solution `tsconfig.json`, widen
the lint script to the whole package, add a Playwright-appropriate flat-config override for `e2e/**`, fix the one
pre-existing error at the source, then prove the new gate can actually fail before accepting it.

## Boundaries & Constraints

**Always:**
- Use the verified `tsconfig.e2e.json` in Design Notes verbatim. `lib` **includes** `DOM` + `DOM.Iterable` (11
  `page.evaluate` callbacks are genuinely browser code); `types: ["node"]` is mandatory on TS 6 (default is now `[]`);
  `include` is `["e2e", "playwright.config.ts"]`; own unique `tsBuildInfoFile`.
- Keep `tsconfig.json`'s `"files": []` exactly as-is and add **no** `composite`. Both existing projects are
  `noEmit` without `composite` and `tsc -b` is green — TS 6.0.3 gates `TS6306`/`TS6310` on the *referencing* project
  having input files, and the root has none. Giving the root `files` makes both fire.
- Append the `e2e/**` ESLint override as the **last** object in `tseslint.config(...)` — flat config concatenates and
  later objects win. Install `react-refresh/only-export-components: 'off'` even though it fires **zero** violations
  today; Story 7.2's exported-helper support module is exactly what it would reject.
- Every error surfaced is fixed at the source. The falsifiability proof (AC5) is mandatory and its verbatim output goes
  in the record.
- Match `eslint.config.mjs`'s existing indentation quirk — no reformatting.

**Block If:**
- Any change is needed under `bp_back/` (AR-E7-0: only Stories 7.4/7.6/7.12 may touch the backend).
- The gates surface an error whose only available fix is weakening a test assertion or bumping a dependency.
- `npm run test:e2e` fails for a reason that is **not** one of the two owned, catalogued flakes.

**Never:**
- No `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or new loosening flag to make the gate pass. (Carrying
  pre-existing `skipLibCheck: true` into the new project for parity is **not** this widening.)
- No dependency version change anywhere (NFR-E7-6 — that is Stories 7.7–7.13).
- No type-aware linting / `no-floating-promises` (Decision 9 — blast radius on `src/`; Story 7.11 owns it).
- No shared support module (7.2), no `registrationEnabled` race fix or 5th `toPass()` copy (7.3), no `HomeRedirect`
  change (7.5). Do not modify `tsconfig.app.json`, `tsconfig.node.json`, or `src/__generated__/`.
- Do not remove the `Browser` import from `e2e/admin.spec.ts` — it is used at `admin.spec.ts:73`.
- Do not manufacture a "genuine test defect". The audit came back empty; report that as the finding.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Gate arrives | `tsconfig.e2e.json` created + referenced | `npx tsc -b --dry` lists **three** projects; `tsc -b` reports `e2e/lists.spec.ts(1,14): error TS6133` | Exit 2 until Task 3 lands |
| Source fix | `type Browser, ` removed from `e2e/lists.spec.ts:1` | `tsc -b` exit **0**; `eslint .` exit **0** | No error expected |
| Lint glob widened | `"lint": "eslint ."` | `e2e/` files appear in the linted set; no file under `src/__generated__` or `dist/` does | Config `ignores` already covers it — verify by enumeration, not assumption |
| Deliberate type error | `const n: number = 'x'` in an `e2e/` spec | `npm run build` **fails**, non-zero exit, verbatim output recorded | Revert after recording |
| Deliberate lint error | unused local in an `e2e/` spec | `npm run lint` **fails**, non-zero exit, verbatim output recorded | Revert after recording |
| `src/` untouched | `eslint --print-config src/App.tsx` before vs after | Byte-identical; `react-hooks/set-state-in-effect` still fires in `src/` | Any diff = the override glob is wrong |
| DOM lib omitted | `lib: ["ES2023"]` copied from `tsconfig.node.json` | 11 spurious `TS2304`/`TS2584` errors | Config artifact — fix the `lib`, never the specs |

</intent-contract>

## Code Map

- `bp_front/tsconfig.e2e.json` -- **NEW.** The third project. Contents are pre-verified — do not improvise.
- `bp_front/tsconfig.json` -- solution file; append one `references` entry. `"files": []` stays.
- `bp_front/package.json:12` -- `"lint": "eslint src/"` → `"eslint ."`. Only line touched in this file.
- `bp_front/eslint.config.mjs` -- append one config object after the existing one.
- `bp_front/e2e/lists.spec.ts:1` -- the one real error: unused `type Browser` import.
- `bp_front/e2e/admin.spec.ts:73` -- why the *other* `Browser` import must survive.
- `bp_front/playwright.config.ts` -- joins the new project's `include`; 4 `process.env` sites → why `types: ["node"]`.
- `_bmad-output/implementation-artifacts/deferred-work.md:103`, `:518`, `:549` -- three entries for this one gap; all
  three get resolved. `:57` (7.3) and `:109` (7.2) must stay open.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:38`, `:200` -- `last_updated`, story key, Epic 6 action B3.
- `_bmad-output/project-context.md:148-151` -- the bullet this story makes false; `:346` footer.

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/tsconfig.e2e.json` -- create with the verified contents in Design Notes -- the flag set was validated
  against the real suite; improvising it costs a review cycle.
- [x] `bp_front/tsconfig.json` -- append `{"path": "./tsconfig.e2e.json"}` to `references` -- registers the project.
  Confirm `npx tsc -b --dry` lists three.
- [x] `bp_front/e2e/lists.spec.ts` -- delete `type Browser, ` from line 1 -- the single real error both gates report.
  `tsc -b` must then exit 0.
- [x] `bp_front/package.json` -- `"lint": "eslint ."` -- also pulls `playwright.config.ts`, `vite.config.ts` and
  `codegen.ts` into the lint gate at zero verified cost. Enumerate the linted file set and confirm `__generated__`/
  `dist` absent and `e2e/` present.
- [x] `bp_front/eslint.config.mjs` -- append the `bp/e2e-playwright` block from Design Notes -- Node+browser globals and
  `react-refresh/only-export-components: 'off'`.
- [x] `bp_front/` -- prove `src/` rules unchanged -- diff `eslint --print-config src/App.tsx` before/after (identical);
  temporarily add a `useEffect` calling `setState` in `src/` and confirm `react-hooks/set-state-in-effect` fires, then
  revert; confirm `only-export-components` is still `error` for `src/components/StoreField.tsx`.
- [x] `bp_front/` -- observe the gate FAILING, both halves -- inject a type error, run `npm run build`; inject a lint
  error, run `npm run lint`; record verbatim output + exit codes; revert both.
- [x] `bp_front/` -- run `npm run test:e2e` on both `chromium` and `mobile` against the production image -- baseline
  52 specs / 104 runs. Attribute any flake to Story 7.3 (`registrationEnabled`) or 7.5 (FR38 sort); re-run at
  `--retries=2` and record both outcomes rather than weakening anything.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- resolve **all three** gate entries (`:103`, `:518`,
  `:549`); add three new ones -- (a) type-aware linting not enabled, with Decision 9's rationale, Story 7.11 named, and
  the trap that `parserOptions: {project: ['./tsconfig.json']}` fails on a solution-style root — use
  `{projectService: true, tsconfigRootDir: import.meta.dirname}`; (b) `codegen.ts` still in no tsconfig project;
  (c) how Node ambient globals reach a project on TS 6 (default `types: []`) — they arrive only via what you import, so
  `tsconfig.node.json` gets `process` transitively through `vite`'s own types while `playwright.config.ts` does not.
  **Corrected during review:** the first draft of (c) claimed `tsconfig.node.json` was "one `process.env` reference away
  from a `TS2591`" — probed and **false** (`tsc -b` exit 0 with `process.env` added to `vite.config.ts`). File it as
  informational, not as debt.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `7-1-…` → `done`, Epic 6 action **B3** (`:200`)
  `open` → `done`, refresh `last_updated`.
- [x] `_bmad-output/project-context.md` -- replace the now-false `:148-151` bullet with the new reality; update the
  `_Last Updated_` footer -- rules file, not a debt ledger (NFR-E7-1).

**Acceptance Criteria:**
- Given `tsconfig.e2e.json` exists and is referenced, when `npm run build` runs, then `tsc -b` type-checks `e2e/` **and**
  `playwright.config.ts` and exits 0 (only the pre-existing >500 kB `vite build` chunk advisory is acceptable).
- Given the widened glob, when `npm run lint` runs, then it reports **0 errors, 0 warnings** over `src/` + `e2e/`.
- Given the new override, when `eslint --print-config` is taken for a `src/` file before and after the change, then the
  two are identical and `react-hooks/set-state-in-effect` is demonstrated still firing in `src/`.
- Given a deliberate type error and a deliberate lint error in a spec file, when each gate runs, then each **fails**
  non-zero and the verbatim output is recorded in the spec record.
- Given the story changes tooling only, when the Playwright suite runs, then it passes on both `chromium` and `mobile`
  against the production image, and `git diff` shows no assertion change — the only spec-file edit in the whole story is
  the deleted `type Browser,`.
- Given AC4, when the tree is inspected, then `grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" bp_front/e2e/
  bp_front/tsconfig.e2e.json` returns nothing and `git diff --stat bp_back/` is empty.
- Given the defect audit found no genuine test defect, when the record is written, then it says exactly that — and notes
  that nothing in the current rule set would catch a future un-awaited assertion.

## Spec Change Log

## Review Triage Log

### 2026-08-07 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 0, medium 4, low 4)
- defer: 5: (high 0, medium 1, low 4)
- reject: 10
- addressed_findings:
  - `[medium]` `[patch]` New ledger entry (c) claimed `tsconfig.node.json` was "one `process.env` reference away from a
    `TS2591`". **Disproved by probe** — appending `process.env.NODE_ENV` to `vite.config.ts` and rebuilding from a
    cleared tsbuildinfo gives `tsc -b` exit 0, because `vite`'s own types drag in `@types/node`. Rewrote the entry as
    informational, stating the true rule (Node ambients arrive via what you import), and corrected the same claim where
    the spec's Task 10 had seeded it, so it cannot be re-derived.
  - `[medium]` `[patch]` The same entry's sibling (b) prescribed adding `codegen.ts` to `tsconfig.node.json` "which
    would also require the `types` fix" — also false, verified sufficient on its own. Fixed, along with "~20 lines" →
    44 (actual).
  - `[medium]` `[patch]` `eslint .` walks gitignored Playwright output directories (`test-results/`,
    `playwright-report/`, `blob-report/`, `playwright/.cache/`, `e2e/.auth/`) because flat config does not read
    `.gitignore`, and `ignores` listed only `dist` + `src/__generated__`. Harmless only by accident today (rules are
    `.ts`/`.tsx`-only). Added all five to `ignores`, caused directly by this story's glob widening.
  - `[medium]` `[patch]` `project-context.md` duplicated the type-aware-linting debt item nearly verbatim from
    `deferred-work.md`, the exact rules-file/ledger split NFR-E7-1 exists to prevent. Reduced to the standing *rule*
    ("await every web-first matcher by hand — the gate does not check it") plus a pointer to the ledger.
  - `[low]` `[patch]` The `eslint.config.mjs` globals comment asserted both sets were "wanted" by a rule; no active rule
    reads globals (`no-undef` is off for TS via tseslint's eslint-recommended). Reworded to say what is true — declared
    for accuracy, load-bearing only once `no-undef` or a typed preset is on.
  - `[low]` `[patch]` `project-context.md` claimed `eslint .` covers "the whole package"; only `**/*.{ts,tsx}` carries
    rules, so `.mjs`/`.js` files appear in the linted set while being checked by nothing. Corrected.
  - `[low]` `[patch]` `docs/development-guide.md:100` still documented `npm run lint # eslint src/`. Updated.
  - `[low]` `[patch]` Closure note said `tsc -b` type-checks "all 10 spec files"; there are 9 `*.spec.ts` plus
    `global-setup.ts`. Corrected.

## Design Notes

**`bp_front/tsconfig.e2e.json` — verified, do not improvise:**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.e2e.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true
  },
  "include": ["e2e", "playwright.config.ts"]
}
```

No `jsx` (specs are not React). No `paths` (nothing in `e2e/` imports from `src/`; adding `@/*` would invite that
coupling). No `verbatimModuleSyntax` / `erasableSyntaxOnly` — unrequested scope. Keep `target`/`module`/`strict`
explicit: TS 6.0 changed all three defaults. `@playwright/test` needs **no** `types` entry — it resolves via its
`exports` map's `types` condition under `moduleResolution: bundler`.

**ESLint override — append as the final object inside `tseslint.config(...)`:**

```js
  {
      name: 'bp/e2e-playwright',
      files: ['e2e/**/*.ts', 'playwright.config.ts'],
      languageOptions: {
          // globals MERGE key-by-key rather than replacing: spec bodies are Node,
          // page.evaluate() callbacks are DOM. Both sets are wanted.
          globals: {...globals.node, ...globals.browser},
      },
      rules: {
          'react-refresh/only-export-components': 'off',
      },
  },
```

Glob must be `e2e/**/*.ts` (relative to `eslint.config.mjs`), **not** `**/e2e/**`. The existing block's
`files: ['**/*.{ts,tsx}']` already matches specs, so this narrows on top of it — `js.recommended`, `tseslint.recommended`
and the `react-hooks` rules all still apply, which is intended.

*Settled — do NOT add the optional hooks-rule hardening.* `eslint-plugin-react-hooks@7.1.1`'s flat recommended config
carries no `files` key, so all 16 of its rules are live on `e2e/` too. They are clean today and key off
component/hook-shaped names, which Playwright helpers do not have. AC3 requires only `react-refresh` to be switched off,
so turning `rules-of-hooks`/`exhaustive-deps` off for `e2e/` would be unrequested scope on a story whose whole value is
a small, readable diff. Keep the override to the one rule; note the choice in the completion notes.

**Two deliberate variances from AC1's literal wording**, both argued and pre-verified — flag them in the completion
notes so a reviewer reads them as decisions, not drift: the `DOM` lib is included despite AC1's "not `DOM`" phrasing,
and `playwright.config.ts` joins `e2e` in `include`. Both strengthen the gate.

**Playwright will not read this config** — it resolves the closest `tsconfig.json` walking up, honours only five options,
and transpiles via esbuild without type-checking. Harmless today (the sole import specifier anywhere in `e2e/` is
`@playwright/test`); a future story adding `@/` aliases to specs must pin `tsconfig: './tsconfig.e2e.json'` in
`defineConfig`.

**`tsc -b` implies `noEmitOnError` across all projects**, so the pre-existing `TS6133` fails `npm run build` on every
invocation until fixed — the `tsconfig.e2e.json`, the reference, and the import fix must land together.

## Verification

**Commands:**
- `cd bp_front && npx tsc -b --dry` -- expected: lists three projects.
- `cd bp_front && npm run build` -- expected: `tsc -b` clean; only the pre-existing >500 kB chunk advisory from
  `vite build`.
- `cd bp_front && npm run lint` -- expected: exit 0, **0 errors, 0 warnings**.
- `cd bp_front && npx eslint . --format json | python3 -c 'import json,sys; [print(r["filePath"]) for r in json.load(sys.stdin)]' | grep -E "__generated__|/dist/"` -- expected: **no output**; the same command without the grep lists `e2e/` files.
- `cd bp_front && npx eslint --print-config src/App.tsx` (before vs after) -- expected: identical.
- `cd bp_front && npm run test:e2e` -- expected: both `chromium` and `mobile` green; report actual spec/run counts
  against the 52/104 baseline.
- `grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" bp_front/e2e/ bp_front/tsconfig.e2e.json` -- expected: no
  hits.
- `git diff --stat bp_back/` -- expected: empty.

**Manual checks (if no CLI):**
- The AC5 falsifiability proof: both injected failures' verbatim output and non-zero exit codes are pasted into this
  spec's record, and both injections reverted (`git diff` shows no trace).
- All three `deferred-work.md` gate entries are struck; the 7.2 and 7.3 entries are still open.

## Implementation Record

Executed 2026-08-07 against baseline `ea6ebde` on branch `epic7-maintenance`. All eleven Execution items complete;
all seven Acceptance Criteria satisfied. Nothing was deferred out of the story except the three items deliberately
filed in `deferred-work.md`.

### Files Changed

**New (1):**

- `bp_front/tsconfig.e2e.json` — the third TypeScript project. Created **verbatim** from Design Notes; no flag was
  improvised, added, or dropped.

**Modified — product/tooling (4):**

- `bp_front/tsconfig.json` — one `{"path": "./tsconfig.e2e.json"}` entry appended to `references`. `"files": []` is
  untouched; no `composite` added anywhere.
- `bp_front/package.json:12` — `"lint": "eslint src/"` → `"lint": "eslint ."`. The only line touched in the file; no
  dependency version changed.
- `bp_front/eslint.config.mjs` — one config object (`name: 'bp/e2e-playwright'`) appended as the **last** object inside
  `tseslint.config(...)`. The file's existing indentation quirk (2-space object brace, 4-space members) is matched; the
  pre-existing block is byte-identical.
- `bp_front/e2e/lists.spec.ts:1` — `type Browser, ` deleted from the import. **The only spec-file edit in the entire
  story.**

**Modified — artifacts (3):**

- `_bmad-output/implementation-artifacts/deferred-work.md` — all three gate entries struck and retained; one new
  section (`## Deferred from: Story 7.1 …`) with three new entries.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story key → `done`, Epic 6 action **B3** → `done` with
  an inline reason, `last_updated` → `2026-08-07`.
- `_bmad-output/project-context.md` — the false `:148-151` gate bullet replaced; the now-stale
  "`npm run lint` runs `eslint src/`" clause in the frontend code-quality section corrected in the same pass (it was
  made false by the same change); `_Last Updated_` footer refreshed.

**Explicitly NOT touched, verified:** `bp_back/` (`git diff --stat bp_back/` → empty), `tsconfig.app.json`,
`tsconfig.node.json`, `src/__generated__/`, any dependency version, the four duplicated helper blocks (7.2), the
`registrationEnabled` handling or `toPass()` wrappers (7.3), `HomeRedirect.tsx` (7.5), and
`e2e/admin.spec.ts`'s `Browser` import (still present at line 1, still used at line 73).

### Gate Output

**`npx tsc -b --dry` — three projects (AC1):**

```
1:50:07 PM - A non-dry build would build project '/home/md/projects/bag-please/bp_front/tsconfig.app.json'
1:50:07 PM - A non-dry build would build project '/home/md/projects/bag-please/bp_front/tsconfig.node.json'
1:50:07 PM - A non-dry build would build project '/home/md/projects/bag-please/bp_front/tsconfig.e2e.json'
```

Exit 0.

**`npx tsc -b` immediately after registering the reference, before the source fix — the one predicted error, verbatim:**

```
e2e/lists.spec.ts(1,14): error TS6133: 'Browser' is declared but its value is never read.
```

`TSC_EXIT=2`. Exactly the error set the story predicted: one line, no others. The 11-error DOM trap did **not**
materialise, confirming the `lib` decision.

**`npx tsc -b` after deleting `type Browser, ` — `TSC_EXIT=0`.** No second error appeared behind the first.

**`npm run lint` (green state) — 0 errors, 0 warnings (AC2):**

```
> bp_front@0.16.0 lint
> eslint .

```

`LINT_EXIT=0` (no findings, no output).

**`npm run build` (green state) — clean `tsc -b`, only the pre-existing chunk advisory (AC1):**

```
> bp_front@0.16.0 build
> tsc -b && vite build

vite v7.3.6 building client environment for production...
transforming...
✓ 1275 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.36 kB │ gzip:   0.26 kB
dist/assets/index-BS4u-phd.js  800.42 kB │ gzip: 241.61 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.84s
```

`BUILD_EXIT=0`. The >500 kB advisory is byte-identical to the pre-change baseline build captured earlier in the same
session, so it is pre-existing and not introduced here.

**Linted file set, enumerated rather than assumed (AC2).** Forbidden paths:

```
$ npx eslint . --format json | python3 -c 'import json,sys; [print(r["filePath"]) for r in json.load(sys.stdin)]' | grep -E "__generated__|/dist/"
grep_exit=1 (1 = no match = good)
```

No output — `src/__generated__` and `dist` remain ignored via the flat config's `ignores`, unrestated in the script.
The same command without the `grep` yields **48 files**, including all 10 `e2e/` files plus the three previously
unlinted root files:

```
codegen.ts                      e2e/lists.spec.ts               eslint.config.mjs
e2e/account.spec.ts             e2e/navigation.spec.ts          playwright.config.ts
e2e/admin.spec.ts               e2e/sharing.spec.ts             vite.config.ts
e2e/auth.spec.ts                e2e/shopping.spec.ts            + 35 files under src/
e2e/global-setup.ts             e2e/smoke.spec.ts
e2e/item-editing.spec.ts
```

**Suppression audit (AC4 / AC6):**

```
$ grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" bp_front/e2e/ bp_front/tsconfig.e2e.json
grep_exit=1 (1 = no hits = good)

$ git diff --stat bp_back/
(empty)
```

### Falsifiability Proof (AC5)

This is the story's own deliverable-under-test, so it is recorded in three parts: the **before** evidence that the gate
did not previously exist, then each half of the gate observed failing.

**Part 0 — the gate genuinely did not exist before (the "arrival", not merely the "presence").**

`npx tsc -b --dry` on the untouched tree listed only **two** projects (`tsconfig.app.json`, `tsconfig.node.json`).
Positive confirmation that no `e2e/` file was in any program:

```
$ npx tsc -p tsconfig.app.json  --noEmit --listFiles | grep -c "/e2e/"   →  0
$ npx tsc -p tsconfig.node.json --noEmit --listFiles | grep -c "/e2e/"   →  0
```

Then, **before any of this story's changes**, `const n: number = 'x'` was appended to `e2e/smoke.spec.ts` and both
gates were run on the pre-change tree:

```
> bp_front@0.16.0 build
> tsc -b && vite build
… ✓ built in 1.95s
BUILD_EXIT=0

> bp_front@0.16.0 lint
> eslint src/
LINT_EXIT=0
```

**Both gates passed with a hard type error sitting in a spec file.** That is the vacuity the story exists to remove.
The injection was reverted (`git status --porcelain e2e/` → clean) before implementation began.

**Part 1 — the type half fails (verbatim).** With the gate in place, `const n: number = 'x'` appended to
`e2e/smoke.spec.ts`, `npm run build`:

```
> bp_front@0.16.0 build
> tsc -b && vite build

e2e/smoke.spec.ts(29,7): error TS2322: Type 'string' is not assignable to type 'number'.
e2e/smoke.spec.ts(29,7): error TS6133: 'n' is declared but its value is never read.
```

**`BUILD_EXIT=2`** (non-zero). Note `vite build` never ran — `tsc -b &&` short-circuited, which is the intended
fail-fast behaviour.

**Part 2 — the lint half fails (verbatim).** Injection reverted, then `const unused = 1` appended to
`e2e/smoke.spec.ts`, `npm run lint`:

```
> bp_front@0.16.0 lint
> eslint .


/home/md/projects/bag-please/bp_front/e2e/smoke.spec.ts
  29:7  error  'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (1 error, 0 warnings)
```

**`LINT_EXIT=1`** (non-zero).

**Both injections reverted.** After each, `git status --porcelain bp_front/e2e/smoke.spec.ts` returned **no output**,
and the final `git diff --stat bp_front/e2e/` shows a single file with `1 insertion(+), 1 deletion(-)` — the
`type Browser,` import fix and nothing else. No trace of either injection survives.

### `src/` Rules Unchanged (AC3)

**Print-config diff.** `npx eslint --print-config src/App.tsx` was captured to
`.tmp/<session>/print-config-App-BEFORE.json` (44,951 bytes) **before** the `eslint.config.mjs` edit, and again after:

```
$ diff print-config-App-BEFORE.json print-config-App-AFTER.json
DIFF_EXIT=0
```

**No output — byte-identical.** The `e2e/**` override's glob does not reach `src/`.

**Rule severities, resolved per file:**

| File | Rule | Severity |
|------|------|----------|
| `src/App.tsx` | `react-hooks/set-state-in-effect` | `[2]` — still error |
| `src/components/StoreField.tsx` | `react-refresh/only-export-components` | `[2, {"allowConstantExport": true}]` — still error |
| `e2e/global-setup.ts` | `react-refresh/only-export-components` | `[0, {"allowConstantExport": true}]` — **off**, as required |
| `e2e/global-setup.ts` | `process` in resolved globals | **present** — `globals.node` merged in |

**Positive proof the rule still fires in `src/`** (not merely that it is still configured). A `useEffect` calling a
`setState` was temporarily added to `src/App.tsx`; `npm run lint`:

```
/home/md/projects/bag-please/bp_front/src/App.tsx
  17:5  error  Error: Calling setState synchronously within an effect can trigger cascading renders
…
  15 |   const [probe, setProbe] = useState(0)
  16 |   useEffect(() => {
> 17 |     setProbe(probe + 1)
     |     ^^^^^^^^ Avoid calling setState() directly within an effect
  18 |   }, [probe])
  19 |   return (
  20 |     <Routes>  react-hooks/set-state-in-effect

✖ 1 problem (1 error, 0 warnings)
```

Non-zero exit. Reverted; `git status --porcelain src/` → clean.

### E2E Results (AC6)

`cd bp_front && npm run test:e2e` against the **production image** on `:2080` (`docker compose up -d --build`), both
projects, `retries: 0` (the local setting).

```
  104 passed (41.2s)
E2E_EXIT=0
```

`npx playwright test --list` → `Total: 104 tests in 9 files`.

| Metric | Baseline (end of Epic 6) | This run |
|--------|--------------------------|----------|
| Runs | 104 | **104** ✅ |
| Specs (104 ÷ 2 projects) | 52 | **52** ✅ |
| `chromium` | green | **green** (runs 1–52) |
| `mobile` | green | **green** (runs 53–104) |
| Failed | — | **0** |
| Flaky | — | **0** |

**Flake attribution: none needed.** Neither owned flake occurred, so the `--retries=2` re-run contemplated by the
task was not required and no second outcome exists to record. For completeness, the two flakes that would have been
attributed elsewhere had they fired — both of which stayed green here — are the shared `registrationEnabled` race
(`lists`/`shopping`/`sharing`/`item-editing`, **owned by Story 7.3**) and the FR38 oldest-list lexicographic sort
(`navigation`/`shopping`, **owned by Story 7.5**). A clean run at `retries: 0` is a favourable draw against the
`registrationEnabled` race, not evidence it is fixed — it remains open in the ledger.

**One infrastructure note, not a test result.** The first `test:e2e` invocation aborted during cold start with
`Error: Process from config.webServer exited early.` — `docker compose up -d --build` returned as soon as the
containers were *started*, before Caddy was answering on `:2080`, and Playwright treats an early `webServer` exit as
fatal. This is the **pre-existing** "Playwright `webServer` gaps, carried since Epic 3" ledger entry (no teardown, a
`url` probe that does not prove Ktor is warm, no `stdout`/`stderr` filtering), not a regression from this story and
not in its scope. The images were built by that attempt; the stack was then verified healthy
(`/` → `200`, `/api/graphiql` → `401`, i.e. Ktor warm and enforcing auth) and the suite re-run against that same
freshly built production image via `reuseExistingServer`. The 104/104 result above is therefore a genuine
production-artifact run, not a dev-server run.

**No assertion was weakened.** `git diff bp_front/e2e/` is one file, `1 insertion(+), 1 deletion(-)` — the deleted
`type Browser,`.

### Completion Notes

**The defect audit found no genuine test defects, and that is the recorded finding (AC7).** The gates surfaced exactly
one issue across all 2,474 lines: an unused `type Browser` import in `e2e/lists.spec.ts:1` — a typing nit, not a
behavioural defect. No spec was found to be asserting something other than what it claimed. **The deliverable of this
story is the gate, not a defect count**, and no finding was manufactured to make the audit look productive. The story
predicted this outcome empirically and it held exactly.

**Stated limitation, deliberately not fixed here:** nothing in the current rule set would catch a future *un-awaited*
assertion. `@typescript-eslint/no-floating-promises` — the rule class that catches
`expect(locator).toBeVisible()` without `await`, i.e. the canonical "assertion that never ran" defect — requires
type-aware linting, which is not enabled (`tseslint.configs.recommended`, not `recommendedTypeChecked`; no
`parserOptions.project`/`projectService`). So the gate now proves every spec *compiles and lints*; it does not prove
every assertion is *awaited*. Filed in `deferred-work.md` with Story 7.11 named as its home, together with the
verified implementation trap (`parserOptions: {project: ['./tsconfig.json']}` fails on a solution-style root with
`Parsing error: The file was not found in any of the provided project(s)` because typescript-eslint does not follow
project references — use `{projectService: true, tsconfigRootDir: import.meta.dirname}`).

**The two variances from AC1's literal wording are decisions, not drift.** Both were pre-argued in the story
(Decisions 1 and 7), both were re-verified here, and both make the gate *stronger*:

1. **`lib` includes `"DOM"` and `"DOM.Iterable"`** despite AC1's "not `DOM` + `react-jsx`" phrasing. That clause is
   satisfied by omitting `jsx` and adding `types: ["node"]`. Eleven `page.evaluate` / `locator.evaluate` callbacks are
   genuinely browser code and legitimately reference `document`, `getComputedStyle` and `HTMLAnchorElement`; copying
   `tsconfig.node.json`'s `lib: ["ES2023"]` would have produced 11 spurious errors in correct specs, and the only ways
   to "fix" those are forbidden by AC4 (suppression) and AC6 (weakening). With the DOM lib included those errors do not
   exist — confirmed: the actual `tsc -b` error set was one line, not twelve.
2. **`playwright.config.ts` joins `e2e` in `include`.** It is E2E infrastructure that was previously inside **no**
   tsconfig project at all, and it uses `process.env` at four sites — which is precisely what makes `types: ["node"]`
   load-bearing rather than decorative. Verified to add zero errors. It closes the same hole in the same change.

**Lint glob: `eslint .` was chosen** (over the minimal-literal `eslint src/ e2e/`) and the choice was verified, not
assumed. Reasons: (a) it satisfies AC2 identically — the enumeration above shows `e2e/` present and
`src/__generated__`/`dist` absent, since the flat config's `ignores` does that job and restating it in the script would
duplicate the rule in two places; (b) it costs **zero** additional errors while pulling three previously unlinted root
files — `playwright.config.ts`, `vite.config.ts` and `codegen.ts` — into the gate for free; (c) it is
self-maintaining: a future root-level file is covered on arrival rather than requiring someone to remember to widen a
hand-maintained path list. The trade-off accepted is that the linted set is now defined by the config's `ignores`
rather than by the script, which is why the enumeration was run as evidence rather than reasoned about.

**The optional `react-hooks` hardening was deliberately NOT added.** `eslint-plugin-react-hooks@7.1.1`'s flat
recommended config carries no `files` key, so all 16 of its rules are live on `e2e/` as well. They are clean today and
key off component/hook-shaped names, which Playwright helpers do not have. AC3 requires only `react-refresh` to be
switched off, so disabling `rules-of-hooks`/`exhaustive-deps` for `e2e/` would be unrequested scope on a story whose
entire value is a small, readable, tooling-only diff. The override is therefore exactly one rule.

**Structural decisions honoured as settled.** No `composite: true` anywhere; the root `tsconfig.json` keeps
`"files": []` exactly as it was (giving it `files` would make `TS6306` *and* `TS6310` fire, since both are gated on the
*referencing* project having input files); `tsconfig.e2e.json` carries its own unique
`tsBuildInfoFile` (`./node_modules/.tmp/tsconfig.e2e.tsbuildinfo`); the override is the **last** object in
`tseslint.config(...)`; `skipLibCheck: true` is carried for parity with both sibling projects and is not an AC4
widening. `e2e/admin.spec.ts`'s `Browser` import was left alone — it is used at line 73.

**Bookkeeping.** All three `deferred-work.md` entries for this one gap are struck using the file's
strike-through-and-retain convention: the rollup plus **both** per-review duplicates (the 6.1 review and the 6.2
review). The Story 7.2 entry (shared fixture module) and the Story 7.3 entry (`registrationEnabled` race) were
verified **still open** and untouched. Three new entries were added under a new
`## Deferred from: Story 7.1 …` section — type-aware linting, `codegen.ts` still uncovered by any tsconfig project,
and how Node ambient globals reach a project on TS 6. *(The third entry originally claimed `tsconfig.node.json` was
"one `process.env` reference away from a `TS2591`"; the review disproved that by probe and it was rewritten as
informational — see the Review Triage Log.)* Per NFR-E7-1, all new debt went to `deferred-work.md`;
`project-context.md` received only the corrected rules.

**One correction beyond the literal task list, flagged for the reviewer.** `project-context.md`'s frontend
code-quality section also asserted "`npm run lint` runs `eslint src/`" (separately from the `:148-151` bullet). That
statement was made false by this same change, and leaving a knowingly-false rule in the agent rules file would defeat
its purpose, so it was corrected in the same pass and the flat-config ordering constraint noted alongside it. No debt
was added to that file.

**Open question carried forward, unchanged and still for `md`:** AR-E7-12 asks for a fresh `epic-7-*` branch; the work
was done on **`epic7-maintenance`**, which satisfies the intent but not the literal pattern. Not renamed unilaterally.
Nothing was committed — all changes are left in the working tree.

## Auto Run Result

Status: **done**

### Implemented change

`bp_front/e2e/` is now inside both frontend static gates. A third TypeScript project (`tsconfig.e2e.json`, covering
`e2e` + `playwright.config.ts`) is referenced from the solution `tsconfig.json`, so `npm run build`'s `tsc -b`
type-checks the suite; `npm run lint` widened from `eslint src/` to `eslint .`; a `bp/e2e-playwright` flat-config
override gives specs Node+browser globals and switches off `react-refresh/only-export-components` for `e2e/**`. The one
pre-existing error the gates surfaced — an unused `type Browser` import at `e2e/lists.spec.ts:1` — was fixed at the
source. No suppression, no dependency change, no `bp_back/` change.

### Files changed

- `bp_front/tsconfig.e2e.json` — **new.** The third project; `lib` includes `DOM`/`DOM.Iterable`, `types: ["node"]`,
  no `composite`, no `jsx`, no `paths`, own `tsBuildInfoFile`.
- `bp_front/tsconfig.json` — one appended `references` entry; `"files": []` untouched.
- `bp_front/package.json` — `"lint": "eslint src/"` → `"eslint ."` (one line).
- `bp_front/eslint.config.mjs` — appended the `bp/e2e-playwright` override; `ignores` extended to the five gitignored
  Playwright output directories that `eslint .` now walks (review patch).
- `bp_front/e2e/lists.spec.ts` — deleted `type Browser, `. The only spec-file edit in the story.
- `_bmad-output/implementation-artifacts/deferred-work.md` — three entries for this gap struck; a new
  `Deferred from: Story 7.1` section with the residue plus the five review defers.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story → `done`, Epic 6 action **B3** → `done`,
  `last_updated` refreshed.
- `_bmad-output/project-context.md` — the "outside both quality gates" bullet replaced; the un-awaited-assertion rule
  stated separately; the `eslint src/` claim in the code-quality section corrected.
- `docs/development-guide.md` — the documented lint command (review patch).

### Review findings

One pass, two reviewers (adversarial + edge-case), run blind on the diff. **8 patches applied** (4 medium, 4 low),
**5 items deferred** (1 medium, 4 low), **10 rejected**, **0 intent gaps**, **0 spec loopbacks**. Every patch landed in
the documentation/bookkeeping half of the diff — which the review correctly identified as ~80% of its line count and
the half no gate checks. The two most valuable: a new ledger entry asserted a `TS2591` risk that a probe disproved, and
the widened lint glob had silently taken responsibility for directories the `ignores` list did not cover. Full
breakdown in the Review Triage Log.

Rejected findings were, in the main, objections the story had already settled empirically and recorded as Decisions
(the globals block being inert is Decision 6 and AC3-mandated; the `react-refresh` override is AC3-mandated regardless
of whether it currently fires; the Playwright-vs-`tsc` config divergence is documented with its one-line future fix),
plus one artifact of the two reviewers probing the same working tree concurrently — a transient injected type error one
reviewer observed was the other's probe, and the tree was verified back to its reviewed state.

### Verification performed

- `npx tsc -b --dry` → three projects. `npx tsc -b` → exit **0** from a cleared tsbuildinfo.
- `npm run lint` → exit **0**, no output. `npm run build` → exit **0**, only the pre-existing >500 kB chunk advisory.
- Linted set enumerated: **48 files**, **10** under `e2e/`, **0** under `src/__generated__`, `dist/`, `test-results/`
  or `playwright-report/`.
- Gate observed **failing** both halves before acceptance: injected `TS2322` → `npm run build` exit 2; injected unused
  local → `npm run lint` exit 1; both reverted. Negative direction also evidenced — on the untouched tree the same
  injected error produced exit **0** from both gates.
- `src/` proven unchanged: `eslint --print-config src/App.tsx` byte-identical before/after; a temporary `useEffect`
  + `setState` probe confirmed `react-hooks/set-state-in-effect` still fires in `src/`.
- Playwright: **104 passed / 104**, `chromium` + `mobile`, at `retries: 0` against the production image. Neither owned
  flake fired. Not re-run after the review patches — those touched ESLint config and markdown only, no product or spec
  code.
- `grep` for `@ts-ignore`/`@ts-expect-error`/`eslint-disable` → no hits. `git diff --stat bp_back/` → empty.

### Residual risks

- **The production image build now type-checks the suite.** `bp_front/Dockerfile` runs `npm run build`, and the E2E
  `webServer` builds that image — so a spec type error blocks the shipping artifact and the suite cannot run to reveal
  it. A correct consequence of AC1, but a new coupling; deferred with options rather than decided unilaterally.
- **The 104/104 was obtained via `reuseExistingServer`** after the documented `npm run test:e2e` aborted on
  `webServer exited early` (compose returns before Caddy answers). Same production image, but the cold-start path is
  not proven; deferred.
- **`tsc -b` has no working incremental cache** (`noEmit` without `composite`), so this story made a full re-check 50%
  larger. Low cost today (~2s); deferred with the `composite: true` + `noEmit: true` combination named as the thing to
  test, which contradicts this story's "buys nothing here" rejection of it.
- **Open question still for `md`, not decided here:** AR-E7-12 asks for a fresh `epic-7-*` branch; this ran on
  `epic7-maintenance`, which satisfies the intent but not the literal pattern.
