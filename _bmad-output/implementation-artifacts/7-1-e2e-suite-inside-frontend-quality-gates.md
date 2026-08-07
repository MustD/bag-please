---
baseline_commit: 575a4d96aac6655a69d161d298db5813d7253cad
---

# Story 7.1: Bring the E2E Suite Inside the Frontend Quality Gates

Status: ready-for-dev

**Delivers:** NFR-E7-3 (AR-E7-4). First story of Epic 7. **No prerequisites** — the implementation-readiness review
(2026-07-30) rates it `| 7.1 | none | ✓ |` and closes with "✅ READY to begin Story 7.1".

**Why it is first:** it is the cheapest story in the epic and it makes everything after it statically verifiable. Story
7.2 (shared support module) needs the `react-refresh` override this story installs; Story 7.10 (TypeScript 6→7) needs
this project to exist so the major type-checks the whole codebase "rather than 80% of it"; Story 7.11 (ESLint 9→10)
needs the flat-config override in place.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Decisions (settled — do not re-open)

These were resolved empirically against the working tree at `575a4d9` before this story was written. Each one is a trap
that would otherwise cost you a review cycle.

1. **`lib` MUST include `"DOM"` and `"DOM.Iterable"`.** AC1 says the project "targets a Node/Playwright environment, not
   `DOM` + `react-jsx`". Read that as **no `jsx: react-jsx`, and add Node types** — it does **not** mean omit the DOM
   lib. Eleven call sites pass callbacks to `page.evaluate()` / `locator.evaluate()`, which genuinely execute in the
   browser context and legitimately reference `document`, `getComputedStyle` and `HTMLAnchorElement`. Copying
   `tsconfig.node.json`'s `"lib": ["ES2023"]` naively produces **11 spurious errors** (verbatim list in Dev Notes).
   Those are a config artifact, **not** code defects. **Do not "fix" them** by deleting, casting, or `@ts-ignore`-ing
   real assertions — AC4 forbids the suppression and AC6 forbids the weakening. Include the DOM lib and the errors do
   not exist.
2. **Do not add `composite: true` — and do not "fix" `tsconfig.json` by giving it `files`.** The handbook says a
   referenced project "must have `composite: true`" and TypeScript still ships `TS6306` (*Referenced project must have
   setting "composite": true*) and `TS6310` (*Referenced project may not disable emit*). Both existing projects
   nonetheless set `noEmit: true` with no `composite`, and `tsc -b` is green. That is not luck: in TypeScript 6.0.3's
   `verifyProjectReferences`, **both diagnostics are gated on the *referencing* project having input files.** The root
   `tsconfig.json` is `{"files": [], "references": [...]}` with no `include`, so the root's `rootNames` is empty and
   neither error can fire. Verified both directions — adding `"files": ["playwright.config.ts"]` to the root makes
   `TS6306` **and** `TS6310` fire immediately. **So: keep `"files": []` exactly as it is** (this is also the handbook's
   prescribed "solution tsconfig" pattern, which avoids double-compilation), and mirror `tsconfig.node.json` —
   `noEmit: true` plus its own `tsBuildInfoFile`. `composite: true` + `noEmit: true` *is* also accepted on 6.0.3, but it
   buys nothing here and diverges from the two siblings.
    - **The `tsBuildInfoFile` is load-bearing, not decorative.** With `noEmit`, the `.tsbuildinfo` is `tsc -b`'s only
      staleness marker, and it records that the program reported errors — so the error re-reports on every run instead
      of being swallowed by an "up to date" check. It **must** be a unique path: TypeScript has a dedicated diagnostic
      for overwriting a referenced project's buildinfo.
    - Relatedly, `tsc -b` implies `noEmitOnError` across all projects. Consequence: the one pre-existing `TS6133`
      (Decision 3) fails `npm run build` on **every** invocation until fixed — there is no silent-second-run trap, but
      it does mean Task 3 must land in the same change as Tasks 1–2.
3. **There is exactly ONE real error in the entire suite, and it is a one-line fix.**
   `e2e/lists.spec.ts:1` imports `type Browser` and never uses it. Both gates report it (`TS6133` and
   `@typescript-eslint/no-unused-vars`). Removing `type Browser, ` from line 1 takes both gates to **green, exit 0** —
   verified end to end. There are **zero** other type errors and **zero** other lint errors across all 2,474 lines.
4. **This story must NOT claim it "found broken tests".** It did not. A genuine-test-defect audit came back empty (see
   Dev Notes § "Defect audit"): every web-first assertion in the suite is awaited, and there are no floating action
   promises. AC4's clause "if an error reveals a genuine test defect … it is called out in the story record" is
   satisfied by recording **that the audit found none** — not by inventing a finding. The deliverable is the *gate*, not
   a defect count. Say so plainly in the completion notes.
5. **Install the `react-refresh/only-export-components` override even though it currently fires ZERO violations.**
   Verified: the rule *is* active on `e2e/` today (`eslint --print-config e2e/global-setup.ts` resolves it to
   `[2, {"allowConstantExport": true}]`); it simply does not fire because no `e2e/` file exports a React component. **Do
   not conclude "no violations, skip the override."** AC3 mandates it, and Story 7.2 — a support module of exported
   helper functions — is exactly what the rule would reject. This is the rule that forced `normalizeStore` out of
   `StoreField.tsx` in Epic 6. The override is forward-looking, and omitting it hands 7.2 a blocked start.
6. **`globals.node` is correctness hygiene, not an error fix.** Verified: `no-undef` is **off** for TS files (bundled
   `eslintRecommended` inside `tseslint.configs.recommended` disables it, since TypeScript does that job), so the
   currently-wrong browser-only globals produce no error today. AC3 still requires spec files to "resolve … Node
   globals", and it becomes load-bearing the moment anyone enables a typed preset or `no-undef`. Declare **both** Node
   and browser globals for `e2e/**` — browser because the `page.evaluate` callbacks genuinely are browser code.
7. **Include `playwright.config.ts` in the new project.** It is E2E infrastructure, it is currently inside **no**
   tsconfig project at all (`tsconfig.node.json` includes only `vite.config.ts`), and it uses `process.env` at four
   sites. Verified: including it adds **zero** errors and is what makes `"types": ["node"]` necessary. This is a small
   deliberate scope addition beyond AC1's literal "covering `e2e`" — it closes the same hole in the same change.
8. **`codegen.ts` stays uncovered — record it, do not fix it.** It is the last remaining unchecked root file and it is
   not E2E infrastructure. Add a `deferred-work.md` entry rather than widening this story.
9. **Type-aware linting is an explicit NON-GOAL for this story.** `@typescript-eslint/no-floating-promises` — the rule
   class that catches a forgotten `await` on `expect(locator).toBeVisible()`, i.e. the canonical "assertion that never
   ran" defect — is **not** configured (the config uses `recommended`, not `recommendedTypeChecked`, and
   `parserOptions` has no `project`/`projectService`). It is the highest-value future addition and it is genuinely
   tempting here. **Do not add it in this story:** it changes the rule set for `src/` too, its blast radius is unknown,
   and Story 7.11 (ESLint 9→10) is where the lint config is next opened deliberately. File it in `deferred-work.md`
   with this rationale.
10. **Do not touch Story 7.2's or 7.3's work.** The helper block stays copy-pasted in all four spec files; all four must
    pass the new gate **as-is**. Do not extract a support module (7.2). Do not touch the `registrationEnabled`
    race or the `expect(...).toPass()` wrappers (7.3), and do not add a fifth copy of that workaround.
11. **`bp_back/` is off-limits.** AR-E7-0: only Stories 7.4, 7.6 and 7.12 may touch the backend. `git diff` under
    `bp_back/` must be empty. A backend need discovered here stops the story and goes to `md`.

## Story

As a developer, I want `bp_front/e2e/` linted and type-checked like the rest of the frontend, so that "lint and build
pass" becomes a true statement about the suite the project treats as its hard gate, instead of saying nothing about it.

## Acceptance Criteria

Verbatim from `epics.md:2906-2957`, with the implementation resolution appended where this story settles an ambiguity.

**AC1 — a third tsconfig project covers the suite (NFR-E7-3)**

**Given** `tsconfig.json` currently references only `tsconfig.app.json` (`include: ["src"]`) and `tsconfig.node.json`
(`include: ["vite.config.ts"]`)
**When** the story is complete **Then** a `tsconfig.e2e.json` covering `e2e` exists and is listed in `tsconfig.json`'s
`references` array **And** `npm run build` (`tsc -b && vite build`) type-checks the spec files as part of the normal
build **And** the new project targets a Node/Playwright environment, not `DOM` + `react-jsx` — the specs are not browser
code

> **Resolution (Decision 1):** "not `DOM` + `react-jsx`" = **no `jsx` option**, `"types": ["node"]`, `target`/`lib`
> baselined on `ES2023` like `tsconfig.node.json`. `"DOM"` and `"DOM.Iterable"` **are** included in `lib`, because
> `page.evaluate` callbacks are browser code. No `composite` (Decision 2). No `paths`/`@/*` alias — no `e2e/` file
> imports from `src/`.

**AC2 — the lint glob covers the suite**

**Given** `package.json` runs `"lint": "eslint src/"`
**When** the story is complete **Then** `npm run lint` lints `e2e/` as well as `src/`
**And** `src/__generated__` and `dist` remain ignored

> **Resolution:** the existing `{ignores: ['dist', 'src/__generated__']}` entry in the flat config already guarantees
> the second clause — do not restate it in the script. Use `"lint": "eslint ."` (recommended, see Dev Notes) or
> `"lint": "eslint src/ e2e/"`; both satisfy this AC and both were verified to yield the same single error.

**AC3 — spec files get rules appropriate to what they are**

**Given** the flat config currently applies `globals.browser` and `reactRefresh.configs.vite` to every `**/*.{ts,tsx}`
**When** the story is complete **Then** spec files resolve `@playwright/test` types and Node globals **And**
`eslint-plugin-react-refresh`'s `only-export-components` rule does **not** apply to `e2e/` — a support module of
exported helper functions is precisely what Story 7.2 requires, and that rule is what forced `normalizeStore` out of
`StoreField.tsx` in Epic 6 **And** the rules applied to `src/` are unchanged — in particular
`react-hooks/set-state-in-effect` still fires there

> **Resolution:** `@playwright/test` ships its own types via its `exports` map `types` condition and resolves under
> `moduleResolution: "bundler"` with **no** `types`-array entry — do not add `"@playwright/test"` to `types`
> (Decision 7 covers why `"node"` is there). The override block goes **after** the existing block (Decision 5, 6).
> Prove the last clause explicitly — see Task 6.

**AC4 — pre-existing errors are fixed, not silenced**

**Given** roughly 1,015 lines of Epic 6 spec code have never been type-checked or linted **When** the gates are switched
on **Then** every error surfaced is fixed at the source **And** no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
or `skipLibCheck`-style widening is introduced to make the gate pass **And** if an error reveals a genuine test defect
rather than a typing nit, it is called out in the story record — a spec that does not compile may never have asserted
what it claimed

> **Resolution:** the surfaced set is exactly one unused-import nit (Decision 3). The last clause is discharged by
> recording that the defect audit found **no** genuine test defects (Decision 4) — do not manufacture one.
> `skipLibCheck: true` is **pre-existing** in both current projects; carrying it into `tsconfig.e2e.json` for parity is
> not the "widening" this AC forbids — the forbidden move is *introducing* a loosening to make an error disappear.

**AC5 — the new gate is observed failing before it is accepted (NFR-E7-4)**

**Given** a gate that cannot fail proves nothing **When** the story is completed **Then** a deliberate type error and a
deliberate lint error have each been introduced into a spec file, `npm run build`
and `npm run lint` confirmed to **fail** on them, and both reverted **And** this is recorded in the story's dev notes

**AC6 — the suite's behaviour is unchanged**

**Given** this story changes tooling configuration, not tests **When** the story is complete **Then** the full
Playwright suite still passes on both `chromium` and `mobile` against the production image **And** no test's assertions
were weakened to satisfy a type error

## Tasks / Subtasks

- [ ] **Task 1 — create `bp_front/tsconfig.e2e.json`** (AC: 1)
    - [ ] Create the file with the verified contents in Dev Notes § "The verified `tsconfig.e2e.json`". Do not improvise
      the flag set — it was validated against the real suite.
    - [ ] `include: ["e2e", "playwright.config.ts"]` (Decision 7).
    - [ ] No `composite`, no `jsx`, no `paths` (Decisions 1, 2).
    - [ ] Give it its own `tsBuildInfoFile`: `./node_modules/.tmp/tsconfig.e2e.tsbuildinfo`. Reusing another project's
      buildinfo path silently corrupts incremental builds.
- [ ] **Task 2 — register the reference** (AC: 1)
    - [ ] Append `{"path": "./tsconfig.e2e.json"}` to `tsconfig.json`'s `references` array. Keep the existing two
      entries and the `"files": []` line untouched.
    - [ ] Confirm `npx tsc -b --dry` now lists three projects.
- [ ] **Task 3 — fix the one real error at the source** (AC: 4)
    - [ ] `bp_front/e2e/lists.spec.ts:1` — change
      `import {type Browser, expect, type Page, test} from '@playwright/test'` to
      `import {expect, type Page, test} from '@playwright/test'`.
    - [ ] Do **not** touch `e2e/admin.spec.ts`'s `Browser` import — it is genuinely used at `admin.spec.ts:73`.
    - [ ] Confirm no other file needs a change: `npx tsc -b` must exit **0**.
- [ ] **Task 4 — widen the lint glob** (AC: 2)
    - [ ] `bp_front/package.json`: `"lint": "eslint src/"` → `"lint": "eslint ."` (recommended; also brings
      `playwright.config.ts`, `vite.config.ts` and `codegen.ts` into the gate at zero verified cost). If you prefer the
      minimal literal reading, `"eslint src/ e2e/"` also satisfies AC2 — record which you chose and why.
    - [ ] Verify `src/__generated__` and `dist` are still skipped (they are, via the config's `ignores`) — assert this
      by observation, not assumption. Enumerate the actual linted file set and confirm neither path appears:
      `npx eslint . --format json | python3 -c 'import json,sys; [print(r["filePath"]) for r in json.load(sys.stdin)]' | grep -E "__generated__|/dist/"`
      → expect **no output**. Confirm the same command without the `grep` does list files under `e2e/`.
- [ ] **Task 5 — add the `e2e/**` flat-config override** (AC: 3)
    - [ ] Append a new config object **after** the existing one in `bp_front/eslint.config.mjs` (later objects win in a
      flat config). Use the block in Dev Notes § "The verified ESLint override".
    - [ ] `files: ['e2e/**/*.ts', 'playwright.config.ts']`.
    - [ ] `languageOptions.globals: {...globals.node, ...globals.browser}` (Decision 6).
    - [ ] `rules: {'react-refresh/only-export-components': 'off'}` (Decision 5).
    - [ ] Do **not** add `recommendedTypeChecked` or `no-floating-promises` (Decision 9).
- [ ] **Task 6 — prove `src/` rules are unchanged** (AC: 3)
    - [ ] Capture `npx eslint --print-config src/App.tsx > before.json` **before** your config edit and again after;
      diff them. They must be identical.
    - [ ] Positively prove `react-hooks/set-state-in-effect` still fires in `src/`: temporarily add a `useEffect` that
      calls a `setState`, confirm `npm run lint` fails on that rule, revert. (This is the same move Story 7.11 AC2 will
      make — do it here for `src/`.)
    - [ ] Confirm `react-refresh/only-export-components` is still `error` for `src/`:
      `npx eslint --print-config src/components/StoreField.tsx | grep -A2 only-export-components`.
- [ ] **Task 7 — observe the new gate FAILING, both halves** (AC: 5) — **this is the story's own falsifiability proof**
    - [ ] **Type error:** introduce a deliberate type error in an `e2e/` spec (e.g. in `e2e/smoke.spec.ts`, add
      `const n: number = 'x'`). Run `npm run build`. Record the **verbatim** failure output and the non-zero exit code.
      Revert.
    - [ ] **Lint error:** introduce a deliberate lint error in an `e2e/` spec (e.g. an unused local `const unused = 1`).
      Run `npm run lint`. Record the **verbatim** failure output and the non-zero exit code. Revert.
    - [ ] Sanity-check the *negative* direction too: confirm that before Task 2 the same deliberate type error was
      **not** caught (or reason it out from the fact that `e2e/` was in no project) — this is what makes the gate's
      arrival, not just its presence, evidenced.
    - [ ] Paste both outputs into Dev Agent Record → Debug Log References. AC5 requires the record, not just the act.
- [ ] **Task 8 — the suite still passes on both projects** (AC: 6)
    - [ ] `cd bp_front && npm run test:e2e` against the production image on `:2080` (`webServer` runs
      `docker compose up -d --build`). Both `chromium` and `mobile`.
    - [ ] Expect **52 specs / 104 runs** as the Epic 6 baseline. Report the actual counts.
    - [ ] **Known flake, not your regression:** the shared `registrationEnabled` race can produce flaky results in
      `lists.spec.ts` / `shopping.spec.ts` / `sharing.spec.ts` / `item-editing.spec.ts`. Story 7.3 fixes it. If you see
      it, re-run with `--retries=2` (the CI setting), record both outcomes, and attribute it correctly. Do **not**
      "fix" it here and do **not** weaken an assertion to get green.
    - [ ] Second known flake: the FR38 oldest-list assertions in `navigation.spec.ts` / `shopping.spec.ts` (~1-in-1000,
      `HomeRedirect` lexicographic sort). Story 7.5 fixes it. Same handling.
    - [ ] Confirm `git diff` shows **no** change to any assertion (the only spec-file change in the whole story should
      be the one deleted `type Browser,`).
- [ ] **Task 9 — gates green end to end** (AC: 1, 2, 4)
    - [ ] `npm run build` → `tsc -b` clean. Only the **pre-existing** >500 kB chunk-size advisory from `vite build` is
      acceptable.
    - [ ] `npm run lint` → **0 errors, 0 warnings**.
    - [ ] `grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" bp_front/e2e/ bp_front/tsconfig.e2e.json` → no hits
      (AC4).
    - [ ] `git diff --stat bp_back/` → empty (AR-E7-0).
- [ ] **Task 10 — ledger and tracking reconciliation** (standing Epic 7 constraints)
    - [ ] `deferred-work.md`: mark **all three** entries for this gap resolved — the rollup at `:103-107` and **both**
      per-review duplicates at `:517-524` (from the 6.1 review) and `:548-555` (from the 6.2 review). Three places, one
      gap; missing one leaves the ledger claiming open debt that no longer exists.
    - [ ] `deferred-work.md`: add **three new** entries — **(a)** type-aware linting /
      `@typescript-eslint/no-floating-promises` not enabled, with Decision 9's rationale and Story 7.11 named as the
      natural home. **Record the implementation trap so the next agent does not lose a cycle to it:** with a
      solution-style root, `parserOptions: {project: ['./tsconfig.json']}` **fails**
      (`Parsing error: The file was not found in any of the provided project(s)`) because typescript-eslint does not
      follow project references; use `parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname}`,
      which typescript-eslint now recommends over `project` and which needs no per-project maintenance as tsconfigs are
      added. Verified on `typescript-eslint` 8.65.0. **(b)** `codegen.ts` is still inside no tsconfig project (Decision
      8). **(c)** `tsconfig.node.json` omits `types` entirely, which on TypeScript 6 (default `types: []`) survives only
      because `vite.config.ts` imports `node:url` as an explicit module rather than touching `process`. It is one
      `process.env` reference away from a `TS2591`. Low severity, forward-looking; note it rather than fixing it here.
    - [ ] Do **not** close the Story 7.2 entry (`deferred-work.md:109-113`, shared fixture module) or the Story 7.3
      entry (`:57-65`, the `registrationEnabled` race).
    - [ ] `sprint-status.yaml`: set `7-1-e2e-suite-inside-frontend-quality-gates` → `done`, flip the Epic 6 **B3**action
      item at `:200-202` from `status: open` to `done`, and refresh `last_updated`. (`epic-7` was already moved to
      `in-progress` when this story was created.)
    - [ ] `project-context.md`: replace the now-false bullet at `:148-151` ("`bp_front/e2e/` is currently outside both
      quality gates … treat a spec-file type error as something only a runtime failure will reveal") with the new
      reality, and update the `_Last Updated_` footer. This file is a **rules file, not a debt ledger** (NFR-E7-1) — put
      the new debt in `deferred-work.md`, not here.

## Dev Notes

### The verified `tsconfig.e2e.json`

This exact file was written to `bp_front/`, built with `npx tsc -b`, confirmed to surface exactly the one known error,
and then reverted. It is not a sketch.

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.e2e.tsbuildinfo",
    "target": "ES2023",
    "lib": [
      "ES2023",
      "DOM",
      "DOM.Iterable"
    ],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": [
      "node"
    ],
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
  "include": [
    "e2e",
    "playwright.config.ts"
  ]
}
```

Flag-by-flag rationale (the set is `tsconfig.node.json`'s, with three deliberate deltas):

| Flag                                    | Value                               | Why                                                                                                                                                                                                                                                                                                                                                                                                                                         |
|-----------------------------------------|-------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lib`                                   | `["ES2023", "DOM", "DOM.Iterable"]` | **Delta.** `page.evaluate` callbacks are browser code — 11 sites. Omitting DOM produces 11 spurious errors (Decision 1).                                                                                                                                                                                                                                                                                                                    |
| `types`                                 | `["node"]`                          | **Delta, and MANDATORY on TS 6.** TypeScript 6.0 changed the `types` default to `[]`, so `@types/node` is no longer auto-discovered. Omitting this yields four `TS2591 Cannot find name 'process'` errors on `playwright.config.ts`. `@playwright/test` needs **no** entry — it resolves via its `exports` map `types` condition. Do **not** use `"types": ["*"]` to restore the old behaviour; the release notes explicitly discourage it. |
| `include`                               | `["e2e", "playwright.config.ts"]`   | **Delta.** Decision 7.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `noEmit`                                | `true`                              | Mirrors both existing projects; no `composite` (Decision 2).                                                                                                                                                                                                                                                                                                                                                                                |
| `noUnusedLocals` / `noUnusedParameters` | `true`                              | Parity with `src/`. These two are what surface the one real error.                                                                                                                                                                                                                                                                                                                                                                          |
| `skipLibCheck`                          | `true`                              | Pre-existing project-wide convention; not an AC4 widening.                                                                                                                                                                                                                                                                                                                                                                                  |
| no `jsx`                                | —                                   | AC1: the specs are not React code.                                                                                                                                                                                                                                                                                                                                                                                                          |
| no `paths`                              | —                                   | No `e2e/` file imports from `src/`; adding the `@/*` alias would invite exactly that coupling.                                                                                                                                                                                                                                                                                                                                              |

**Do not set `verbatimModuleSyntax` or `erasableSyntaxOnly`.** They are not used anywhere in this project today.
(Informational: the suite would pass with them — it already uses inline `import {type X}` qualifiers throughout — but
adding them is unrequested scope.)

**Keep `target`, `module` and `strict` explicit.** TypeScript 6.0 changed all three defaults (`strict` now `true`,
`module` now `esnext`, `target` floats to the newest supported spec). The config above sets them explicitly, which
neutralises that — do not "simplify" by deleting them and inheriting.

**Playwright will not auto-discover this file, and that is fine.** Playwright resolves the *closest* `tsconfig.json` /
`jsconfig.json` walking up from each imported file, so it will keep picking up `bp_front/tsconfig.json` (the solution
file), never `tsconfig.e2e.json`. It also honours only five tsconfig options at all — `allowJs`, `baseUrl`, `paths`,
`references`, `extends` — and transpiles via bundled esbuild, which type- *strips* rather than type-checks. So
`module` / `lib` / `types` / `strict` matter **only** to your `tsc -b` pass. This is harmless today because no spec uses
a path alias (the only import specifier anywhere in `e2e/` is `@playwright/test`). **If a future story adds `@/` aliases
to specs**, it must pin the config explicitly via `tsconfig: './tsconfig.e2e.json'` in `defineConfig` or
`--tsconfig=`. Worth knowing for Story 7.2 — its `e2e/support/` imports will be *relative*, so it stays unaffected.

### The verified ESLint override

Append this as a **new, final** object inside the `tseslint.config(...)` call in `bp_front/eslint.config.mjs`. Flat
config resolves by concatenation: for a file matching several `files` globs, later objects override earlier ones. The
existing block's `files: ['**/*.{ts,tsx}']` already matches `e2e/**/*.ts`, so this narrows on top of it rather than
replacing it — the `js.configs.recommended` + `tseslint.configs.recommended` + `react-hooks` rules all still apply to
specs, which is what you want.

```js
  {
    name: 'bp/e2e-playwright',
        files
:
    ['e2e/**/*.ts', 'playwright.config.ts'],
        languageOptions
:
    {
        // globals MERGE key-by-key rather than replacing, so this is browser + node.
        // Both are wanted: spec bodies are Node, page.evaluate() callbacks are DOM.
        globals: {...
            globals.node,
        ...
            globals.browser
        }
    ,
    }
,
    rules: {
        'react-refresh/only-export-components'
    :
        'off',
    }
,
}
,
```

Glob anchoring matters: use `e2e/**/*.ts` (relative to `eslint.config.mjs`, which is what flat config evaluates
against), **not** `**/e2e/**` — the latter matches at any depth and is not what you want.

Note you *cannot* subtract `globals.browser` in a later object — globals merge, they never replace. That is fine here,
since both sets are wanted.

**Optional hardening, beyond AC3's minimum — your call, but record the choice.**
`eslint-plugin-react-hooks@7.1.1`'s `configs.flat.recommended` also carries **no `files` key**, so all 16 of its rules
(including the React-Compiler-era `react-hooks/purity`, `immutability`, `globals`, and `set-state-in-effect`) are
currently active on `e2e/` too. They are clean today and the practical risk is low — those rules key off
component/hook-shaped names, which Playwright helpers do not have. AC3 requires only the `react-refresh` rule to be
switched off, so disabling the hooks rules for `e2e/` is defensive hygiene rather than a requirement. If you add it, add
it in the same block and say so in the completion notes:

```js
          'react-hooks/rules-of-hooks'
:
'off',
    'react-hooks/exhaustive-deps'
:
'off',
```

Whatever you choose, `src/` must be untouched — Task 6 proves that, and `react-hooks/set-state-in-effect` must still
fire there (AC3, and it is load-bearing for the render-phase-adjustment convention).

Current file, for reference — note `files` is **already** `**/*.{ts,tsx}`, so `e2e/` is in scope of the flat config
today and only the `eslint src/` **script argument** excludes it. Flipping the gate is a script change, not a config
rewrite:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {ignores: ['dist', 'src/__generated__']},
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.browser,
        },
    },
)
```

Match the file's existing indentation quirk (4-space inside the object, 2-space for the object brace) rather than
reformatting it — a reformat would bury the real change in diff noise.

### Current state of the files you are modifying

**`bp_front/tsconfig.json`** — add one entry to `references`, change nothing else:

```json
{
  "files": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.node.json"
    }
  ]
}
```

**`bp_front/package.json:12`** — `"lint": "eslint src/"`. The only line you touch in this file. Do **not** bump any
dependency version here; the whole dependency sweep is Stories 7.7–7.13, and NFR-E7-6 forbids bundling. Story 7.1 runs
on the **pre-bump** baseline: `@playwright/test` 1.61.1 installed (`^1.60.0` declared), `eslint` 9.39.5, `typescript`
6.0.3, `@types/node` 25.6.0, `typescript-eslint` ^8.50.0, `globals` ^17.7.0.

**`bp_front/tsconfig.app.json`** and **`tsconfig.node.json`** — **do not modify either.** They are shown here only so
you can derive the new project's flag set correctly. `tsconfig.app.json`: `target ES2022`, `lib [ES2022, DOM,
DOM.Iterable]`, `jsx react-jsx`, `paths {@/*: ./src/*}`, `include ["src"]`, `exclude ["src/__generated__"]`.
`tsconfig.node.json`: `target ES2023`, `lib [ES2023]`, `include ["vite.config.ts"]`. Both: `strict`, `noUnusedLocals`,
`noUnusedParameters`, `noFallthroughCasesInSwitch`, `skipLibCheck`, `esModuleInterop`, `isolatedModules`,
`moduleDetection: force`, `noEmit`, `moduleResolution: bundler`, `module: ESNext`, own `tsBuildInfoFile`.

**The 10 files entering the type checker** (2,474 lines total; Epic 6 contributed `navigation.spec.ts` 390 +
`item-editing.spec.ts` 625 = the 1,015 the epic cites):

```
   144 e2e/account.spec.ts        625 e2e/item-editing.spec.ts     301 e2e/shopping.spec.ts
   245 e2e/admin.spec.ts          272 e2e/lists.spec.ts             27 e2e/smoke.spec.ts
    83 e2e/auth.spec.ts           390 e2e/navigation.spec.ts
    53 e2e/global-setup.ts        334 e2e/sharing.spec.ts
```

There is no `e2e/support/`, `e2e/fixtures/` or `e2e/helpers/` — Story 7.2 creates it.

### Empirical results — what the gates actually report

**With the verified config (`tsc -b`), the complete error set is one line:**

```
e2e/lists.spec.ts(1,14): error TS6133: 'Browser' is declared but its value is never read.
```

Exit code 2. After removing `type Browser, ` from that import: `tsc -b` exit **0**, `eslint e2e/` exit **0**.

**`npx eslint e2e/` today, complete output:**

```
/home/md/projects/bag-please/bp_front/e2e/lists.spec.ts
  1:14  error  'Browser' is defined but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (1 error, 0 warnings)
```

| rule id                                | count                                      |
|----------------------------------------|--------------------------------------------|
| `@typescript-eslint/no-unused-vars`    | 1                                          |
| `react-refresh/only-export-components` | **0** (rule is active; nothing to fire on) |
| everything else                        | 0                                          |

Widening to `eslint .` (whole `bp_front/`, i.e. also `playwright.config.ts`, `vite.config.ts`, `codegen.ts`) yields the
**same single error** — which is why Task 4 recommends it.

**The DOM trap, verbatim** — this is what you get if you copy `tsconfig.node.json`'s `lib: ["ES2023"]`. All 11 are
config artifacts. **Every one of these lines is correct code.**

```
e2e/item-editing.spec.ts(514,17): error TS2304: Cannot find name 'getComputedStyle'.
e2e/item-editing.spec.ts(515,19): error TS2304: Cannot find name 'getComputedStyle'.
e2e/item-editing.spec.ts(523,11): error TS2584: Cannot find name 'document'.
e2e/item-editing.spec.ts(523,50): error TS2584: Cannot find name 'document'.
e2e/navigation.spec.ts(130,26): error TS2304: Cannot find name 'HTMLAnchorElement'.
e2e/navigation.spec.ts(144,15): error TS2304: Cannot find name 'getComputedStyle'.
e2e/navigation.spec.ts(162,47): error TS2304: Cannot find name 'getComputedStyle'.
e2e/navigation.spec.ts(199,21): error TS2304: Cannot find name 'getComputedStyle'.
e2e/navigation.spec.ts(359,18): error TS2584: Cannot find name 'document'.
e2e/navigation.spec.ts(360,18): error TS2584: Cannot find name 'document'.
e2e/navigation.spec.ts(380,32): error TS2584: Cannot find name 'document'.
```

### Defect audit — required by AC4, and it came back empty

AC4 asks you to call out any error that reveals a genuine test defect. An audit for the two defect classes a static gate
is supposed to expose was run against all 2,474 lines:

- **Un-awaited web-first matchers** (`toBeVisible`, `toHaveText`, `toHaveURL`, `toContainText`, `toHaveCount`,
  `toBeHidden`, `toHaveValue`, `toBeEnabled`, `toBeDisabled`, `toBeChecked`, `toHaveAttribute`, `toHaveCSS`,
  `toBeFocused`, `toHaveClass`) missing `await`/`return`: **zero matches.**
- **Floating action promises** (statement-position `.click(`, `.fill(`, `.press(`, `.goto(`, `.waitFor(`, `.check(`,
  `.uncheck(`, `.selectOption(`, `.hover(`, `.type(`) missing `await`/`return`: **zero matches.**
- The 28 bare `expect(...)` calls are all legitimately synchronous — they assert already-resolved values
  (`expect(saveItemRequests).toBe(0)`, `expect(overflows).toBe(false)`, `expect(response?.status()).toBe(200)`, …).

**Report this outcome as the finding.** The honest claim is "the gate now exists and is enforced; no latent test defect
was surfaced" — not a defect count. Note the limitation plainly: nothing in the *current* rule set would catch a future
un-awaited assertion (Decision 9), which is why that entry goes in the ledger.

### Testing standards summary

- **The hard gate is Playwright**, config `bp_front/playwright.config.ts`, tests `bp_front/e2e/`, run
  `npm run test:e2e`. It runs against the **production image** — `webServer` executes `docker compose up -d --build`
  from the repo root and `baseURL` is `http://localhost:2080` (built `dist/` served by Caddy). **Never point E2E at
  `:5173`.**
- **Both projects are mandatory:** `chromium` (Desktop Chrome) and `mobile` (Pixel 7). Epic 4's regression was
  mobile-only. `retries` is `0` locally, `2` under `CI`.
- **Baseline to match:** 52 specs / 104 runs at the end of Epic 6.
- **This story adds no test.** It is tooling configuration. AC6 is a no-regression check, and the falsifiability
  obligation (AC5) applies to the **gate** rather than to a new spec — which is the same move Story 6.1 made when it
  temporarily set `checked: false, recurring: null` to prove its two carry-forward tests were non-vacuous.
- **Do not weaken an assertion to satisfy a type error.** The only legitimate spec-file edit in this story is the one
  deleted `type Browser,`.
- `bp_back/` is untouched, so no Kotest run is required — but `git diff bp_back/` must be empty.

### Previous Story Intelligence (Epic 6 — Stories 6.1 / 6.2)

Epic 6 ran through the `bmad-dev-auto` flow, so its records are `spec-6-1-*.md` / `spec-6-2-*.md` rather than numbered
story files. What matters here:

- **`react-refresh/only-export-components` has already cost this project a source-layout decision.** Story 6.1 planned
  `normalizeStore` as a named export in `StoreField.tsx`; the rule rejects a component file that also exports a plain
  function, and "0 errors / 0 warnings" was an AC — so it moved to `src/lib/lists/storeValue.ts`. A re-export from
  `StoreField` would have re-triggered it. This is the concrete precedent AC3 cites, and it is exactly what Story 7.2's
  support module would hit. [Source: spec-6-1-edit-item-name-category-store.md:304-309]
- **6 of Epic 6's 17 review patches were assertions that could not fail** — an app-bar height bound a two-line wrap fits
  inside; a `browser.newContext()` that silently dropped mobile emulation and voided the mandatory mobile gate;
  `.focus()` standing in for `:focus-visible`; a `toHaveURL` satisfiable by a transient state; the `flexGrow: 1`
  invariant left entirely untested; a suggestion-absence check that fired before its query resolved; and an
  `edit-item-error` testid only ever asserted **absent**, so the `catch` branch never once executed. None was *wrong*;
  each was incapable of detecting its own failure mode. **This is why AC5 exists**: your deliverable is a gate, and an
  unfalsified gate is the same defect class. [Source: epic-6-retro-2026-07-29.md:144-160]
- **The counter-practice is proven and is what AC5 asks you to repeat.** Story 6.1 broke `EditItemDialog`
  (`checked: false, recurring: null`), rebuilt the production image, confirmed both carry-forward regression tests went
  red on **both** projects, and restored. Those two tests are the only ones in the epic known to be non-vacuous.
  [Source: spec-6-1-…:320-324]
- **`browser.newContext()` does not inherit the project's `use` block** — a hand-built context silently runs a desktop
  viewport on the `mobile` project. If type-checking surfaces anything around context construction, do **not** resolve
  it by reaching for a hand-built context. [Source: epic-6-retro-2026-07-29.md:299-300]
- **A commitment not encoded in an artifact is not a commitment.** Epic 5's seven retro action items came back 0/7 while
  its *agreements* largely held — the difference was encoding. The debt-ledger agreement became Story 6.1's AC15 and
  executed perfectly; the table rows did not. Hence Task 10: the gate goes into `package.json` and `tsconfig.json`, and
  the ledger updates are ACs, not intentions. "A gate wired into config outlives a gate written into an
  agreement." [Source: epic-6-retro-2026-07-29.md:78, 254-256, 426]
- **Epic 6 left `sprint-status.yaml` with no `epic-6` block at all**, reconstructed retroactively at the retro (action
  A2). Epic 7's block was created at open specifically to prevent the recurrence. Do not let 7.1 close without Task 10.
  [Source: epic-6-retro-2026-07-29.md:164-166; sprint-status.yaml:103-126]
- **A stale result file is its own action item.** `bmad-dev-auto-result-epic-6.md` still read `status: blocked` after
  the work completed and became action A3. Supersede any result file you generate. [Source: sprint-status.yaml:183-186]
- **`followup_review_recommended`**: Epic 6 shipped `true` on both specs and neither follow-up ran in-epic; both were
  discharged only at the retro. If this story's review changes semantics rather than cosmetics, run the follow-up
  in-story.
- **Known-flaky, already owned, not yours:** the `registrationEnabled` race (Story 7.3) and the FR38 oldest-list
  lexicographic-sort flake (Story 7.5). Bracketing data points from Epic 6 for judging a run: one recorded run had **4
  flaky, all healed on retry 1**; another had **84 passed, 0 flaky**. [Source: deferred-work.md:57-65, 565-574]

### Project Structure Notes

- **New file:** `bp_front/tsconfig.e2e.json`.
- **Modified:** `bp_front/tsconfig.json` (one `references` entry), `bp_front/package.json` (the `lint` script line
  only), `bp_front/eslint.config.mjs` (one appended config object), `bp_front/e2e/lists.spec.ts` (one import).
- **Artifacts modified:** `deferred-work.md` (3 resolved + 2 new), `sprint-status.yaml` (story key + B3 action item),
  `project-context.md` (the now-false gate bullet at `:148-151` + footer).
- **Explicitly NOT modified:** anything under `bp_back/` (AR-E7-0); `tsconfig.app.json`; `tsconfig.node.json`;
  `src/__generated__/` (never hand-edited); any dependency version (NFR-E7-6 — Stories 7.7–7.13); the four spec files'
  duplicated helper blocks (Story 7.2); the `registrationEnabled` handling and the `toPass()` wrappers (Story 7.3);
  `HomeRedirect.tsx` (Story 7.5).
- **Variance from AC1's literal wording, recorded deliberately:** the new project includes `playwright.config.ts` in
  addition to `e2e` (Decision 7), and includes the `DOM` lib despite AC1's "not `DOM`" phrasing (Decision 1). Both are
  argued above; both were verified. Flag them in the completion notes so the reviewer sees them as decisions rather than
  drift.
- **Branch:** AR-E7-12 requires a fresh `epic-7-*` branch. The current branch is **`epic7-maintenance`**, which is fresh
  and Epic-7-named but does not literally match `epic-7-*`. See Open Question — do not rename unilaterally.

### References

- [Source: epics.md:2896-2957] — Story 7.1 statement, Files/Reuses, AC1–AC6 verbatim.
- [Source: epics.md:2873-2894] — Epic 7 standing constraints (scoped unfreeze, both-project E2E, observed-failing
  convention, `deferred-work.md`, `sprint-status.yaml`, fresh branch) and the story-independence map.
- [Source: epics.md:480-486] — **AR-E7-4**, the decision record this story implements (third tsconfig project, widened
  lint glob, Node-side specs, `react-refresh` must not apply, pre-existing errors are in scope).
- [Source: epics.md:442-446] — AR-E7-0, scoped backend unfreeze; only 7.4/7.6/7.12 may touch `bp_back/`.
- [Source: epics.md:487-501] — AR-E7-5 / AR-E7-6, why the support module and the race fix are 7.2 and 7.3, not here.
- [Source: epics.md:555-559, 1119-1122] — AR-E7-9 / ordering: Stories 7.10 and 7.11 depend on this story landing.
- [Source: epics.md:566-569] — AR-E7-10, verification discipline.
- [Source: epics.md:590-591] — AR-E7-12, fresh `epic-7-*` branch.
- [Source: epics.md:273-275] — **NFR-E7-3**, the NFR delivered. Also `epics.md:981` (coverage-map restatement).
- [Source: epics.md:266-271, 277-279] — NFR-E7-2 (`retries: 0`, owned by 7.3) and NFR-E7-4 (observed-failing).
- [Source: epics.md:1074-1077, 1092-1103] — what "lint and build pass" proves today; why one epic; story order.
- [Source: prd.md:724-732] — NFR17 (production-artifact E2E, desktop + mobile, zero failures before done) and NFR18
  (UI-driven, no login fixture, no `storageState`, API only for environment prep).
- [Source: project-context.md:143-192] — the hard-gate section, including the bullet at `:148-151` this story makes
  false, the observed-failing convention at `:165-176`, the `browser.newContext()` trap, and the known
  `registrationEnabled` race at `:185-191`.
- [Source: project-context.md:210-221] — flat-config composition, `npm run lint` = `eslint src/`, file-layout rules.
- [Source: deferred-work.md:103-107, 517-524, 548-555] — the three entries this story resolves.
- [Source: deferred-work.md:57-65, 109-113, 115-122, 565-574] — the entries this story must **not** close (7.3, 7.2,
  7.5) plus flake baselines.
- [Source: deferred-work.md:3-6] — the ledger rule: anything deferred is recorded there, not only in a story file.
- [Source: epic-6-retro-2026-07-29.md:144-160, 331-332, 401-406, 423-429] — the could-not-fail table, action items
  B3/B4, the B3→B4→B5 sequencing, and the closing agreements.
- [Source: spec-6-1-edit-item-name-category-store.md:304-309, 320-324] — the `normalizeStore` precedent and the proven
  break-and-restore practice.
- [Source: spec-6-2-back-to-home-and-lists-navigation.md:140-161] — the seven review patches in detail.
- [Source: implementation-readiness-report-2026-07-30.md:693-694, 869-875, 1033] — 7.1 has no prerequisites;
  falsifiability and anti-perverse-incentive assessment; "READY to begin Story 7.1".
- [Source: bp_front/tsconfig.json, tsconfig.app.json, tsconfig.node.json, package.json, eslint.config.mjs, playwright.config.ts] —
  current state, quoted above.
- [Source: bp_front/e2e/lists.spec.ts:1; e2e/admin.spec.ts:73] — the one real error, and the `Browser` import that must
  **not** be removed.

### Git Intelligence Summary

- `575a4d9 Apply Epic 7 implementation-readiness remediations` — **the baseline commit.** Planning-artifact only
  (`sprint-status.yaml`, `epics.md`, `prd.md`, the readiness report). This is what registered the `epic-7` block and all
  fifteen story keys up front, closing the C2 defect.
- `56b75db Plan Epic 7: correctness, test harness, and dependency currency` — the epic plan itself.
- `4bfcc90 Update sprint-status.yaml and related artifacts for Epic 6 close-out` — Epic 6 retro output.
- `fe31fbf Simplify build context for bp_front Docker image in images-build-push.sh` — Epic 6 action A1; the
  `./bp_front` → `.` build-context fix that existed only in the working tree.
- `d4d94fa Redesign and personal lists (#30)` — the last code-bearing commit (Epics 5 + 6, both on `epic-4-lists`).

Takeaway: **no code has changed since Epic 6 shipped.** The working tree at `575a4d9` is exactly the state the empirical
results above were measured against, so you can trust the single-error finding without re-deriving it — but do re-run
the gates to confirm, since that is Task 9.

Note the dev-auto precondition: a dirty working tree is a hard blocker, and Epic 6 hit it when a planning artifact was
uncommitted. The only uncommitted change at story creation is `sprint-status.yaml`'s `epic-7: in-progress`.

### Latest Tech Information

Installed versions (`bp_front/package.json` + `node_modules`) — this story runs on the **pre-sweep** baseline and must
not bump any of them:

- **`typescript` 6.0.3** (exact). `tsc -b` verified to build referenced projects that set `noEmit: true` **without**
  `composite: true` — so mirror that, do not add `composite` (Decision 2).
- **`@playwright/test`** declared `^1.60.0`, **installed 1.61.1** (with `playwright` / `playwright-core` 1.61.1). It
  **ships its own types** via `index.d.ts` wired through the package `exports` map's `types` condition; under
  `moduleResolution: "bundler"` that resolves with no `types`-array entry. There is no `@types/playwright` and none is
  needed. (AR-E7-9 will move this to 1.62.0 in Story 7.7 — not here.)
- **`@types/node` 25.6.0** (exact) — supplies `process.env` for `playwright.config.ts`. Story 7.8 takes it to 26.1.2.
- **`eslint`** declared `^9.39.4`, **installed 9.39.5**; **`@eslint/js` ^9.39.4**; **`typescript-eslint`** declared
  `^8.50.0`, **installed 8.65.0**; **`eslint-plugin-react-hooks`** declared `^7.1.0`, **installed 7.1.1**; **
  `eslint-plugin-react-refresh` 0.5.3**; **`globals` 17.7.0**; **`vite` 7.3.6**. Story 7.11 takes ESLint to 10.8.0 — not
  here.
- **`typescript-eslint` 8.65.0 officially supports TypeScript 6.0.3** — its internal supported range is
  `>=4.8.4 <6.1.0`, so there is no "unsupported TypeScript version" warning. (Worth knowing for Story 7.10: bumping TS
  to 6.1+ would surface that warning until typescript-eslint catches up.)
- **Flat-config semantics that matter here:** config objects are concatenated and evaluated in order; for a file
  matching multiple `files` globs, **later objects win** on `rules` and `languageOptions`. So appending the `e2e/**`
  block is sufficient and does not require editing the existing block.
- **`no-undef` is OFF for TS files** — `tseslint.configs.recommended` bundles `eslintRecommended`, which disables it
  because TypeScript performs that check. This is why the currently-wrong `globals.browser` on `e2e/` produces no error
  (Decision 6).
- **Typed linting is NOT enabled** — `recommended`, not `recommendedTypeChecked`; `parserOptions` is `{}` with no
  `project` / `projectService`. Consequence: `@typescript-eslint/no-floating-promises` does not run, so an un-awaited
  Playwright assertion would still ship undetected. Non-goal here (Decision 9); goes in the ledger.
- Vite `^7.3.5` / installed 7.x, `@vitejs/plugin-react` `^5.0.0` — untouched. Vite 8 + plugin 6 is Story 7.9's atomic
  pair; bumping either alone breaks the build.

### Project Context Reference

- **Project rules:** `/home/md/projects/bag-please/_bmad-output/project-context.md`. Its frontend/testing sections were
  rewritten at the Epic 6 retro and are **current**. Two bullets are directly relevant: `:148-151` (the
  "`e2e/` is outside both quality gates" statement — **this story makes it false, so Task 10 updates it**) and
  `:165-176` (the observed-failing convention). Remember the NFR-E7-1 distinction: `project-context.md` is a **rules
  file for agents**, `deferred-work.md` is the **debt ledger** — new debt goes in the latter.
- **Repo guidance:** `/home/md/projects/bag-please/CLAUDE.md` (root), `bp_front/CLAUDE.md`. Temp files go in
  `.tmp/<session-id>/` and are cleaned up at session end.
- **Memory notes that apply:** E2E is mandatory per story and enforced in `playwright.config.ts` (production image,
  desktop + mobile), not in an agreement; deferred work goes in `deferred-work.md`, not only a story file; never
  hand-edit `bp_front/src/__generated__/`; a test is unproven until seen failing on **both** projects; `admin` is
  blocked from all list operations and `mia/mia` is not seeded (irrelevant here — this story adds no test).
- **No codegen run is needed.** This story authors no GraphQL operation and changes no schema.

## Story Completion Status

Ultimate context engine analysis completed — comprehensive developer guide created. Status set to `ready-for-dev`.

Every technical claim in this story was verified empirically against the working tree at `575a4d9` and then reverted:
the proposed `tsconfig.e2e.json` was created and built with `tsc -b`, the reference was registered, the resulting error
set was captured, the one-line fix was applied and both gates confirmed green (`tsc -b` exit 0, `eslint e2e/` exit 0),
and all probe changes were removed (`git status` clean apart from the intentional `sprint-status.yaml` epic flip).

**Open question for `md` (does not block dev):** AR-E7-12 requires a fresh **`epic-7-*`** branch, and the retro's
wording is "Start Epic 7 on a fresh `epic-7-*` branch." The current branch is **`epic7-maintenance`** — fresh and
Epic-7-named, but not a literal match for the pattern (no hyphen after `epic`, and "maintenance" rather than a
descriptor of the epic's content). It plainly satisfies the *intent* (the failure being corrected was Epics 5 and 6 both
running on the two-epic-stale `epic-4-lists`). Confirm whether to keep `epic7-maintenance` or rename to something like
`epic-7-consolidation` before the first commit. Renaming later is cheap but not free.

**Second, smaller flag:** two deliberate variances from AC1's literal wording are argued and verified in Decisions 1 and
7 — the `DOM` lib is included, and `playwright.config.ts` joins `e2e` in the new project's `include`. Both make the gate
stronger rather than weaker. Raised here so a reviewer reads them as decisions rather than drift.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
