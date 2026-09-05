---
baseline_commit: e4c54dc7247d7c83fa05f2e2c232d5988ff766d4
---

# Story 7.2: Extract One Shared E2E Support Module

Status: ready-for-dev

**Delivers:** AR-E7-5. **Prerequisite for Story 7.3** — `registerViaUi` carries the `expect(...).toPass()` race
workaround, so fixing the race first would mean fixing it in five places.

**Files:** new `bp_front/e2e/support/` module; `account.spec.ts`, `admin.spec.ts`, `lists.spec.ts`, `shopping.spec.ts`,
`sharing.spec.ts`, `item-editing.spec.ts`, `navigation.spec.ts` (**seven**, not four — see the scope correction below).

**Reuses:** the existing helper implementations **verbatim**. This is an extraction, not a rewrite. Every line moved
must arrive byte-identical unless this story names the difference explicitly.

**Depends on:** Story 7.1 only (it installed the `react-refresh/only-export-components` override that makes a module of
exported helpers legal under `e2e/`). No other story blocks this one.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

---

## ⚠ Scope correction — read before anything else

**The epic's AC1 says the eight helpers are "re-declared in four spec files". That is factually wrong, and AC1 is
self-contradictory as written.** Measured at `e4c54dc`:

| Helper | Files declaring it | Epic's claim |
|---|---|---|
| `uniqueUsername` | **7** — account, admin, lists, navigation, sharing, shopping, item-editing | 4 |
| `registerViaUi` | **6** — account, lists, navigation, sharing, shopping, item-editing | 4 |
| `openListsViaMenu` | **5** — lists, navigation, sharing, shopping, item-editing | 4 |
| `createListAndOpen` | **4** — navigation, sharing, shopping, item-editing | 4 ✓ |
| `addCategory` | **4** — navigation, sharing, shopping, item-editing | 4 ✓ |
| `addItem` | **4** — navigation, sharing, shopping, item-editing | 4 ✓ |
| `loginApi` | **2** — shopping, item-editing | 4 |
| `gql` | **2** — shopping, item-editing | 4 |

Verify yourself before starting — one command, and it is the story's ground truth:

```bash
cd bp_front/e2e && for f in uniqueUsername registerViaUi openListsViaMenu createListAndOpen \
  addCategory addItem loginApi gql; do printf '%-20s ' "$f"; grep -lc "function $f" *.ts | tr '\n' ' '; echo; done
```

**Why this matters:** AC1's second clause — *"`grep` confirms no spec file re-declares any of them"* — cannot be
satisfied by touching only `lists`, `shopping`, `sharing` and `item-editing`. `account.spec.ts`, `admin.spec.ts` and
`navigation.spec.ts` would each still declare `uniqueUsername`, and two of them would still declare `registerViaUi`.

**Settled reading: the file list is the epic's error, not the AC's intent.** The scope is *every spec that declares one
of the eight helpers* — seven files. The `grep` clause is the binding half of AC1; the file list was written from an
Epic-6-era snapshot and never re-measured. **This deviation from the epic's stated `Files:` line is deliberate and must
be recorded in the story record.** It is also flagged to `md` as an open question at the bottom of this file.

`auth.spec.ts` and `smoke.spec.ts` are **out of scope** — they declare no helper. `auth.spec.ts` inlines a
*differently shaped* username (`mia_e2e_${project}_${ts}`, with **no label segment**) at line 12; do not "unify" it.

---

## Decisions (settled — do not re-open)

Each was resolved empirically against the working tree at `e4c54dc`. Each is a trap that otherwise costs a review cycle.

1. **Two files, not one — and `api.ts` must not import `@playwright/test`.** `global-setup.ts` today has *zero*
   imports and runs in Playwright's globalSetup phase. If the module a spec imports also gets imported by
   `global-setup.ts`, a top-level `@playwright/test` import drags the test runner into that phase. Split:
   - `e2e/support/api.ts` — `BACKEND`, `loginApi`, `gql`. **No `@playwright/test` import.** Pure `fetch`.
   - `e2e/support/ui.ts` — `PASSWORD`, `uniqueUsername`, `registerViaUi`, `openListsViaMenu`, `createListAndOpen`,
     `addCategory`, `addItem`. Imports `{expect, type Page}`.

2. **Do NOT name any support file `*.spec.ts` or `*.test.ts`.** `playwright.config.ts` sets `testDir: './e2e'` with no
   `testMatch`/`testIgnore`, so the default `**/*.@(spec|test).?(c|m)[jt]s?(x)` applies. `support/api.ts` and
   `support/ui.ts` are not collected — already proven by `global-setup.ts`, which lives inside `testDir` and is never
   collected. A file named `support/helpers.spec.ts` **would** be collected and fail the run with zero tests.

3. **Imports are relative — never `@/`.** `tsconfig.e2e.json` has no `paths` and no `baseUrl`, deliberately (Story 7.1:
   *"No `e2e/` file imports from `src/`; adding the `@/*` alias would invite exactly that coupling"*). Separately,
   Playwright resolves the *closest* `tsconfig.json` walking up, so it reads `bp_front/tsconfig.json`, never
   `tsconfig.e2e.json` — an alias would type-check and then fail at runtime. Use `from './support/ui'`.

4. **No config change is needed, and none is permitted.** Verified: `tsconfig.e2e.json`'s `include: ["e2e", ...]` is a
   bare directory, which TypeScript expands to `e2e/**/*` — `e2e/support/*.ts` is picked up automatically. ESLint's
   `bp/e2e-playwright` override is `files: ['e2e/**/*.ts', ...]`; `**` crosses directory boundaries, so
   `e2e/support/ui.ts` is covered. Confirmed by probe: `npx eslint --print-config e2e/support/ui.ts` returns
   `react-refresh/only-export-components: [0, ...]` (off). **Do not edit `tsconfig.e2e.json`, `tsconfig.json`,
   `eslint.config.mjs` or `package.json`.** Four Story 7.1 invariants must survive untouched: `tsconfig.json` keeps
   `"files": []`; no `composite`; the `bp/e2e-playwright` object stays **last** in `tseslint.config(...)`; the override
   glob stays `e2e/**/*.ts`.

5. **The module must be `.ts`, never `.tsx`.** The override glob is `*.ts` only. A `.tsx` support file falls through to
   the base block and gets `only-export-components: error` — the exact rule this story's premise depends on being off.

6. **Extract the *hardened* `registerViaUi` (the one with `toPass`), and keep the wrapper.** AC2 is explicit: the
   workaround *"stays for now and is removed by Story 7.3, not here"*. Do not delete it, do not add a sixth copy
   elsewhere, do not "improve" the 1500/20000 ms timeouts.

7. **Extract the `store?: string` variant of `addItem` (item-editing's).** It is a strict superset: the guard is
   `store !== undefined`, not a truthiness check, so three-argument callers are unaffected. Extracting the 3-param
   version would break `item-editing.spec.ts:277`, `:308` and `:383`, which pass `'Aldi'`.

8. **Extract the *generic* `gql<T>` (item-editing's).** It subsumes shopping's callers, which ignore the return value.
   This does change shopping's failure mode — see the divergence report, item 2.

9. **`BACKEND` stays `'http://localhost:2080'` and must NOT become `baseURL` or `E2E_BASE_URL`.** This is deliberate
   and documented at `global-setup.ts:7-13`, `shopping.spec.ts:16-19` and `item-editing.spec.ts:24-27`: API prep always
   hits the local Caddy entrypoint directly, because `E2E_BASE_URL` only controls the *browser-facing* origin. Swapping
   it breaks the TLS-edge run mode.

10. **Out of scope — do not extract these, however tempting.** `lists.spec.ts`'s `createListViaUi` (a genuinely
    different function — see divergence 4); its two inline `addCategory`/`addItem` blocks (divergence 5);
    `admin.spec.ts`'s `loginViaUi`, `loginAsAdmin`, `withFreshAuthPage`, `DEFAULT_PW`; `sharing.spec.ts`'s
    `backToLists`, `openShareDialog`, `shareWith`; `item-editing.spec.ts`'s `fetchItem`/`ApiItem`; the 15
    `browser.newContext` sites; the `seedMembership` and `uniqueName` candidates. All are recorded in Dev Notes as
    **follow-up ledger entries**, not as work. This story extracts the eight named helpers and stops.

11. **Backend is frozen (AR-E7-0).** Only Stories 7.4, 7.6 and 7.12 may touch `bp_back/`. `git diff --stat bp_back/`
    must be empty at close. A backend need discovered here stops the story and goes to `md`.

12. **Do not touch Story 7.3's or 7.5's work.** No change to the `registrationEnabled` mechanism, `global-setup.ts`'s
    behaviour, `playwright.config.ts`, `admin.spec.ts:169-206`'s toggle window, or `HomeRedirect.tsx`.

---

## Story

As a developer,
I want the E2E helper block to live in exactly one module,
so that a fix to shared test logic lands once instead of being copy-pasted into seven spec files where the copies
silently drift.

---

## Acceptance Criteria

**AC1 — one module, imported by every spec that needs it**

**Given** `uniqueUsername`, `registerViaUi`, `openListsViaMenu`, `createListAndOpen`, `addCategory`, `addItem`,
`loginApi` and `gql` are re-declared across seven spec files
**When** the story is complete
**Then** each helper is defined exactly once under `bp_front/e2e/support/` and imported by every spec that uses it
**And** `grep -c "function <helper>" bp_front/e2e/*.spec.ts` returns 0 for all eight
**And** the per-spec `uniqueUsername` prefix is passed as a parameter, so each of the seven specs keeps its distinct
prefix byte-for-byte

**AC2 — extraction preserves behaviour exactly**

**Given** this is a refactor with no intended behaviour change
**When** the story is complete
**Then** the full suite passes on both `chromium` and `mobile` against the production image, at the 104/104 baseline
**And** the extracted helpers are behaviourally identical to the copies they replace, **including the
`expect(...).toPass()` workaround inside `registerViaUi`** — which stays for now and is removed by Story 7.3
**And** every behavioural difference between copies is **reported to `md`**, not silently resolved by picking one (the
five known ones are pre-identified below; confirm each and report anything further)

**AC3 — it is a support module, not a login fixture (AR-E7-5)**

**Given** the project deliberately has no login fixture and no `storageState`
**When** the story is complete
**Then** every spec still registers its own fresh user through the UI and logs in through the form
**And** no `storageState`, no Playwright `test.extend` fixture, and no session reuse across specs is introduced
**And** API calls remain permitted only for environment preparation, never for behaviour under test

**AC4 — the mobile gate is not quietly voided**

**Given** `browser.newContext()` does not inherit the project's `use` block, which silently ran a desktop viewport on
the `mobile` project in Epic 6
**When** any helper touching multi-actor setup is extracted
**Then** no hand-built context is introduced where the `page` fixture would do
**And** the ten existing call sites that pass a non-fixture page keep passing exactly the page object they pass today

**AC5 — the new module is inside the gates**

**Given** Story 7.1 brought `e2e/` into lint and type-check
**When** the story is complete
**Then** `npm run lint` and `npx tsc -b` both pass with the support module included, **with no suppression comments** —
no `@ts-ignore`, no `@ts-expect-error`, no `eslint-disable`

**AC6 — the extraction is observed to be live (NFR-E7-4 convention)**

**Given** a spec that kept a stale local copy would still pass, making a green suite prove nothing about the extraction
**When** the story is completed
**Then** one helper in the support module has been deliberately broken, a targeted run confirmed **red on both
`chromium` and `mobile`** across specs in at least three different files, and the break reverted
**And** this is recorded in the story record with the command and output

**AC7 — the move is verified mechanically, because the suite cannot verify it**

**Given** `@typescript-eslint/no-floating-promises` is not enabled until Story 7.11, so a dropped `await` during the
move type-checks, lints, **and leaves the suite green while asserting nothing**
**And** AC6 proves only that the specs import the module, not that the bodies arrived intact — they are two different
claims
**When** the story is complete
**Then** every extracted helper body has been byte-diffed against its original at `e4c54dc`, and each diff is empty
apart from the differences AC2 names
**And** the diff commands and their output are recorded in the story record
**And** an empty diff — **not** a green suite — is the evidence offered for AC2's "behaviourally identical" claim
**Rationale:** the story's most dangerous failure mode is invisible to every gate it runs. Leaving the mitigation as
Dev Notes prose is the pattern that lost FR9 for four epics; it is an acceptance criterion for that reason.

---

## The divergence report (AC2 material — pre-measured, must be confirmed)

Five real behavioural differences exist between the copies. **Each is pre-measured, but AC2 requires the dev agent to
confirm each by `diff` before acting on it — do not take this table on faith.** All five need `md`'s sign-off in the
story record.

### 1. `account.spec.ts`'s `registerViaUi` has NO `toPass` wrapper — the only copy without it

`account.spec.ts:26-34` opens with a bare `await page.goto('/auth')`. The other five copies open with:

```ts
await expect(async () => {
  await page.goto('/auth')
  await expect(page.getByTestId('to-register-link')).toBeVisible({timeout: 1500})
}).toPass({timeout: 20000})
```

**Effect of extracting the hardened version:** `account.spec.ts` becomes *more* robust — it currently hard-fails if
`admin.spec.ts` has the shared registration flag transiently OFF, and would start self-healing. **Recommended: accept
it.** It is a strengthening change, it removes the last unprotected register-based spec, and Story 7.3 deletes the
wrapper from all callers anyway. Extracting account's unhardened version instead would silently un-harden five specs
and is not acceptable.

### 2. `gql` — the generic version adds `|| !body.data` to the throw condition

`shopping.spec.ts:99-109` is `Promise<void>` and throws on `!res.ok || body.errors`.
`item-editing.spec.ts:128-139` is `<T> → Promise<T>` and throws on `!res.ok || body.errors || !body.data`.

**Effect:** `shopping.spec.ts:280-281` (`shareList` / `acceptInvite` seeding) would newly throw on a response with
`data: null` and no `errors`. Both mutations return objects, so this should never fire — but it is a real change to a
failure mode, not a no-op. **Recommended: accept**, and state the reasoning in the record.

### 3. `addItem` — item-editing's copy has a 4th optional parameter

`store?: string` plus `if (store !== undefined) await page.getByTestId('add-item-store').fill(store)`.

**Effect: none on existing behaviour.** The superset is safe in the extraction direction. Recorded because AC2 demands
every difference be named, not because it carries risk.

### 4. `lists.spec.ts` declares `createListViaUi`, which is a *different function* from `createListAndOpen`

Both share a byte-identical first six lines, then diverge:

| | `createListViaUi` (lists) | `createListAndOpen` (4 others) |
|---|---|---|
| Returns | `Promise<void>` | `Promise<string>` (the list id) |
| Terminal state | stays on `/lists`, asserts `list-row-<name>` | clicks `list-open-<name>`, asserts `list-detail-page` |

**Recommended: leave `createListViaUi` in `lists.spec.ts` untouched.** Merging them breaks the golden-path test, which
does its own `list-open-${listName}` click at `lists.spec.ts:90` immediately after. Extracting the shared six-line
prefix as a third helper is *not* in scope — it is a rewrite, and AC "Reuses" says verbatim extraction.

### 5. `lists.spec.ts` has four inline copies of `addCategory`/`addItem` bodies, two of them deliberately different

- `lists.spec.ts:98-103` — semantically identical to the helper (`name` → `categoryName`).
- `lists.spec.ts:155-158` — **weaker**: missing both `add-category-dialog` assertions. Replacing it would *add* two
  assertions to the FR46 cascade test.
- `lists.spec.ts:106-116` — **stronger**: asserts the item row *scoped under its category row*, which is the whole
  point of that test. Replacing it would **lose** the nesting check.
- `lists.spec.ts:160-165` — **weaker**: missing both `add-item-dialog` assertions.

**Recommended: leave all four inline.** `lists.spec.ts` therefore imports only `uniqueUsername`, `registerViaUi`,
`openListsViaMenu` and `PASSWORD`. This is consistent with AC1, which binds only the eight named *declared* helpers —
`lists.spec.ts` declares none of `addCategory`/`addItem`.

### Also worth knowing (not a divergence — a planning error)

The `expect(...).toPass()` registration workaround exists in **five** files, not the four named in
`project-context.md` and `deferred-work.md`: `lists:29-32`, `shopping:30-33`, `sharing:29-32`, `item-editing:38-41`,
and **`navigation:41`** — the copy every prior document missed. All five are byte-identical. Story 7.3's AC3 ("no spec
retains a local copy") depends on this count being right, so **correct it in the ledger as part of this story.**
`navigation.spec.ts:161-164` has a sixth, *unrelated* `toPass` (CSS hover settling, 2000 ms) — do not touch it.

---

## Tasks / Subtasks

- [ ] **Task 1 — Re-measure and confirm the ground truth (AC1, AC2)**
  - [ ] Run the declaration-count command from the scope correction; confirm 7/6/5/4/4/4/2/2
  - [ ] `diff` each pair of copies for all eight helpers; confirm the five divergences above and report any sixth
  - [ ] Confirm the five `toPass` copies and the one unrelated sixth
  - [ ] Record the confirmed table in the story record — **measured, not copied from this file**

- [ ] **Task 2 — Create `bp_front/e2e/support/api.ts` (AC1, AC5)**
  - [ ] Export `BACKEND = 'http://localhost:2080'`, `loginApi`, generic `gql<T>` — bodies verbatim from the sources
  - [ ] No `@playwright/test` import (Decision 1); no `@/` import (Decision 3)

- [ ] **Task 3 — Create `bp_front/e2e/support/ui.ts` (AC1, AC3, AC5)**
  - [ ] Export `PASSWORD`, `uniqueUsername(prefix, label, projectName)`, `registerViaUi` (hardened, wrapper intact),
        `openListsViaMenu`, `createListAndOpen`, `addItem` (with `store?`), `addCategory`
  - [ ] Move the shared rationale docblock here (the three facts every spec header repeats: UI-driven only; both
        projects, mobile mandatory; fresh unique user per run because `./db/data` persists)
  - [ ] No fixture, no `test.extend`, no `storageState` (AC3)

- [ ] **Task 4 — Rewire the seven specs (AC1, AC4)**
  - [ ] `account.spec.ts` → `uniqueUsername`, `registerViaUi`, `PASSWORD` (prefix `acct`)
  - [ ] `admin.spec.ts` → `uniqueUsername` only (prefix `admin`); leave `DEFAULT_PW`, `loginViaUi`, `loginAsAdmin`,
        `withFreshAuthPage` in place
  - [ ] `lists.spec.ts` → `uniqueUsername` (`lists`), `registerViaUi`, `openListsViaMenu`, `PASSWORD`; keep
        `createListViaUi` and all four inline blocks
  - [ ] `shopping.spec.ts` → all eight (prefix `shopping`)
  - [ ] `sharing.spec.ts` → six UI helpers + `PASSWORD` (prefix `sharing`)
  - [ ] `item-editing.spec.ts` → all eight (prefix `item_editing`); keep `fetchItem`/`ApiItem` local
  - [ ] `navigation.spec.ts` → six UI helpers + `PASSWORD` (prefix `nav`); keep `ADMIN`
  - [ ] Verify all 46 `registerViaUi` call sites still pass the same page object — ten pass a non-fixture page
        (`lists:204,224`, `shopping:273`, `sharing:118,167,205,254,294`, `item-editing:441,591`) (AC4)
  - [ ] `grep` confirms zero re-declarations (AC1)
  - [ ] **Delete the two orphaned `BACKEND` consts** — `shopping.spec.ts:19` and `item-editing.spec.ts:27`. Their only
        consumers are `loginApi` and `gql` (`shopping:89,100`, `item-editing:118,129`), which both move to
        `support/api.ts`. Left behind they are unused locals and **the build fails** (see below)
  - [ ] **Drop `type Page` from `account.spec.ts:1`** — its only `: Page` annotation is `registerViaUi` at line 26,
        which moves. Verified: `lists`, `sharing`, `navigation` and `admin` all retain local helpers taking `Page`, so
        only `account.spec.ts` is affected
  - [ ] Re-check every remaining spec for any other symbol whose last consumer just moved out

- [ ] **Task 5 — Verify the move mechanically (AC7)**
  - [ ] For each of the eight helpers, byte-diff the extracted body against its original at `e4c54dc`, e.g.
        `git show e4c54dc:bp_front/e2e/sharing.spec.ts | sed -n '41,46p' | diff - <(sed -n '<range>p' bp_front/e2e/support/ui.ts)`
  - [ ] Confirm each diff is **empty** apart from the differences AC2 names (the `toPass` wrapper, `gql`'s
        `|| !body.data`, `addItem`'s `store?`, `uniqueUsername`'s prefix parameter)
  - [ ] Count `await` tokens per body before and after — a dropped `await` is the one defect no gate here can catch
  - [ ] Record the commands and their output in the story record

- [ ] **Task 6 — Static gates (AC5)**
  - [ ] `npx tsc -b` exits 0 — **run this before Task 7**, see the Docker trap in Dev Notes
  - [ ] `npm run lint` exits 0 with zero output
  - [ ] No suppression comment anywhere in the diff
  - [ ] Trim each spec's import list exactly — `noUnusedLocals` fails the build on an unused import **and on an unused
        module-level const**, which is the Task 4 orphan case

- [ ] **Task 7 — Suite green (AC2)**
  - [ ] `npm run test:e2e` → 104/104 on `chromium` + `mobile`, `retries: 0`, against the production image
  - [ ] `npx playwright test --list` still reports `Total: 104 tests in 9 files`

- [ ] **Task 8 — Prove the extraction is live (AC6)**
  - [ ] Break one helper in `support/ui.ts` (e.g. point `openListsViaMenu` at `menu-lists-BROKEN`)
  - [ ] Rebuild the production image; confirm **red on both projects** across specs in ≥3 different files
  - [ ] Revert; confirm green again; record the command and output

- [ ] **Task 9 — Bookkeeping (Epic 7 standing constraints)**
  - [ ] Close **both** ledger entries for this gap: `deferred-work.md:120-124` and `:638-645`. Sweep for a third —
        Story 7.1 found three entries for one gap and had to strike all three
  - [ ] Correct the "four copies" claim to **five** wherever it appears: `deferred-work.md`, and
        `project-context.md`'s `registrationEnabled` bullet (~line 199)
  - [ ] Add `project-context.md` **rules only** — where shared E2E helpers live, that imports are relative, that
        support files must not match `*.spec.ts`. New *debt* goes to `deferred-work.md` (NFR-E7-1 rules/ledger split)
  - [ ] File follow-up ledger entries for the Decision-10 candidates left unextracted
  - [ ] Reconcile `sprint-status.yaml`: `7-2-shared-e2e-support-module` → `done`; update `last_updated`
  - [ ] Record the seven-file scope deviation and `md`'s decisions on the five divergences

---

## Dev Notes

### Module shape (prescriptive — this exact shape was verified against the gates)

```
bp_front/e2e/support/api.ts     — BACKEND, loginApi, gql<T>            (no @playwright/test)
bp_front/e2e/support/ui.ts      — PASSWORD, uniqueUsername, registerViaUi, openListsViaMenu,
                                  createListAndOpen, addCategory, addItem
```

**Two constants move with the helpers, and only two.** `BACKEND` must — `loginApi` and `gql` close over it, so it
cannot stay behind. `PASSWORD` may — six byte-identical `const PASSWORD = 'e2e-password-123'` copies
(`account:15`, `lists:14`, `sharing:18`, `shopping:14`, `item-editing:22`, `navigation:26`), and every
`registerViaUi` call site passes it. Moving it is zero-risk and keeps the seven import lists honest. Every other
duplicated constant stays put — see the deferred table below.

`uniqueUsername` must take the prefix, preserving all seven namespaces exactly:

```ts
export function uniqueUsername(prefix: string, label: string, projectName: string): string {
  return `${prefix}_e2e_${label}_${projectName}_${Date.now()}`
}
```

Prefixes: `acct`, `admin`, `lists`, `nav`, `sharing`, `shopping`, `item_editing`. The prefix is load-bearing —
`./db/data` persists across runs and the two projects run concurrently, so collapsing seven namespaces into one would
make specs collide on data they did not create.

### Four traps, all pre-verified — do not lose a cycle to them

1. **`no-floating-promises` is NOT enabled, so a dropped `await` during the move passes both gates and asserts
   nothing.** This is the single most dangerous failure mode for this story. Story 7.1 deferred type-aware linting to
   Story 7.11 (`deferred-work.md`, "Deferred from: Story 7.1"). The standing rule in `project-context.md` is **"Await
   every web-first matcher by hand."** This is why the byte-diff is **AC7 and Task 5**, not advice — a green suite is
   not evidence here, and neither is AC6.

2. **A type error in the support module fails the *Docker image build*, not just the gate.** `bp_front/Dockerfile:11-12`
   copies `bp_front/` and runs `npm run build`, and `npm run test:e2e`'s `webServer` runs `docker compose up -d --build`.
   So a broken support module means the suite cannot start, and the failure surfaces as a Docker build failure.
   **Always `npx tsc -b` before `npm run test:e2e`.**

3. **`setTimeout` returns `Timeout`, not `number`, under `types: ["node"]`.** The same line type-checks in
   `tsconfig.app.json` and fails in `tsconfig.e2e.json`. If a helper ever holds a timer handle, annotate it
   `ReturnType<typeof setTimeout>`. (Recorded by Story 7.1's review as a gotcha aimed specifically at this story.)

4. **Cold start is unreliable.** `docker compose up -d --build` returns when containers *start*, before Caddy answers
   on `:2080`, so the first `npm run test:e2e` often dies with `Process from config.webServer exited early`. Story 7.1
   hit this. Bring the stack up by hand, wait for `http://localhost:2080/api/graphiql` to answer, then run with
   `reuseExistingServer`.

### Style conventions in `e2e/` — 100% uniform today, keep them

No semicolons; single quotes; 2-space indent; no space inside import braces (`{expect, test}`); inline `type`
modifiers (`type Page`); named specifiers sorted alphabetically (`{expect, type Page, test}`). Every spec currently has
exactly one import; yours will have two or three.

`tsconfig.e2e.json` sets `noUnusedLocals` and `noUnusedParameters` — an import a spec does not call **fails the build**.
`isolatedModules` + `moduleDetection: force` are on, so re-exported types need `export type`.

### Regression baseline (from Story 7.1's close, `cf6fa9e`)

- `npx playwright test --list` → **Total: 104 tests in 9 files** (52 specs × 2 projects)
- Suite: **104 passed / 104**, `chromium` + `mobile`, `retries: 0`, against the production image
- `npm run lint` → exit 0, zero output, 48 files linted (10 under `e2e/`)
- `npx tsc -b` → exit 0

Story 7.1's note applies here too: *"A clean run at `retries: 0` is a favourable draw against the `registrationEnabled`
race, not evidence it is fixed."* If a register-based spec flakes, that is 7.3's bug, not yours — record it, do not fix
it here.

### Deliberately left for later (file as ledger entries, do not extract)

Measured, real duplication that is **out of scope** by Decision 10.

**Read this table as a statement about provenance, not severity.** The selection criterion for what this story extracts
is "the epic named these eight helpers" — it is *not* "these are the worst duplication in the suite." Some rows below
are objectively larger than things that are in scope: `loginApi` has 2 copies and ships here, while `withSecondActor`
has 15 sites across 6 files and does not. Nothing below has been assessed and found acceptable; it has been assessed
and found *out of this story's charter*. File each as a ledger entry so a later story can rank them properly.

| Candidate | Extent |
|---|---|
| `seedMembership(listId, owner, member, pw)` | 4-line `loginApi`×2 + `gql`×2 block, 3 copies (`shopping:278-281`, `item-editing:446-449`, `:594-597`) — missed by planning |
| `withSecondActor(browser, baseURL, fn)` | 15 `browser.newContext({baseURL, ignoreHTTPSErrors: true})` sites across 6 files; must preserve the "does not inherit `use`/viewport" caveat (AC4) |
| `loginViaUi` | already a helper in `admin.spec.ts:22-27`, inlined 4× elsewhere; **must not bake in success assertions** — `admin.spec.ts:133` uses it expecting a *failed* login |
| `backToLists` | helper in `sharing.spec.ts:96-99`, inlined 3×, one asserting URL instead of the `lists-page` testid |
| `logoutViaMenu` | 2 copies, one missing the trailing `auth-page` assertion |
| `uniqueName(label)` | ~60 inline `` `<Label> ${Date.now()}` `` sites, no helper anywhere |
| `ADMIN` const | `{username: 'admin', password: 'admin'}` declared in `admin.spec.ts:15` and `navigation.spec.ts:25`, inlined as bare literals in `account:102-103`, `lists:256-257`, `sharing:316-317` — 5 sites, 3 shapes |
| `DEFAULT_PW` | `admin.spec.ts:16` holds `'e2e-password-123'` under a different name from the six `PASSWORD` copies. Renaming it is an `admin.spec.ts`-wide edit for zero behavioural gain; leave it |
| `global-setup.ts`'s `BASE_URL` | same literal as `BACKEND`, different name. Converging it means `global-setup.ts` importing `support/api.ts` — deliberately deferred to Story 7.3, which owns that file |
| Shopping-checkbox selector split | 9 sites use `shopping-item-<name>` + `getByRole('checkbox')`; `navigation.spec.ts:316` alone uses `shopping-item-checkbox-<name>` |
| `global-setup.ts` API overlap | its inline admin login and `setRegistrationEnabled` call are `loginApi`/`gql` in all but name; converging them is Story 7.3's territory, not this story's |

### Project Structure Notes

- `bp_front/e2e/support/` is new; no existing directory or naming convention governs it. `e2e/.auth` appears in
  `eslint.config.mjs`'s `ignores` but **does not exist** — a leftover from a `storageState` pattern never adopted.
  Do not create it.
- The frontend's own layout rules (`src/routes/`, `src/components/`, `src/lib/<slice>/`, one default export per file)
  are `src/`-only. The support module uses **named exports** — that is what the Story 7.1 override exists to permit.
- No change to `bp_back/`, `src/`, `src/__generated__/`, any dependency version, or any tsconfig/eslint/package.json.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 7.2` (lines 2959-3011)] — the five ACs
- [Source: `_bmad-output/planning-artifacts/epics.md#AR-E7-5` (lines 487-493)] — not a login fixture, not `storageState`
- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 7 standing constraints` (lines 2872-2895)] — AR-E7-0 backend
  freeze, both-projects rule, observed-failing convention, ledger and sprint-status reconciliation
- [Source: `_bmad-output/implementation-artifacts/epic-7-context.md`] — "7.2 must precede 7.3, or the race fix lands in
  four copies"; support module ≠ login fixture
- [Source: `_bmad-output/implementation-artifacts/7-1-e2e-suite-inside-frontend-quality-gates.md#Decisions`] —
  Decisions 5 (the override exists *for* this story), 10 (7.1 was forbidden to do this work), the `"files": []` and
  `tsBuildInfoFile` invariants, and the "7.2's imports will be relative" note
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:120-124, :638-645`] — the two entries this story
  closes
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md#Deferred from: Story 7.1`] — the
  `no-floating-promises` gap, the Docker-image coupling, the `setTimeout` gotcha, cold-start unreliability
- [Source: `_bmad-output/project-context.md#Frontend (Playwright e2e) — the hard gate`] — await every matcher by hand;
  production-image E2E; both projects mandatory; `browser.newContext()` viewport trap
- [Source: `bp_front/tsconfig.e2e.json`, `bp_front/eslint.config.mjs`, `bp_front/playwright.config.ts`] — verified to
  permit `e2e/support/*.ts` with no config change

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
