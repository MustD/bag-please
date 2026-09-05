---
title: 'Story 7.2 — Extract one shared E2E support module'
type: 'refactor'
created: '2026-08-08'
status: 'done'
baseline_revision: '5ba0a9e'
final_revision: '34ea998'
review_loop_iteration: 0
followup_review_recommended: true  # the code half is an extraction proved byte-identical by AC7, but ~40% of the diff is ledger/rules prose (two closed entries, a count correction that three prior documents got wrong, 11 new deferred candidates, a new project-context rules block) that no gate checks and that later agents read as authoritative — the same exposure that earned Story 7.1 a follow-up pass
context:
  - '{project-root}/_bmad-output/implementation-artifacts/7-2-shared-e2e-support-module.md'
  - '{project-root}/_bmad-output/project-context.md'
warnings: [oversized]  # ~3k tokens. The 12 settled decisions and the pre-measured divergence table are load-bearing: each was resolved empirically against the tree and each otherwise costs a review cycle.
---

<intent-contract>

## Intent

**Problem:** Eight E2E helpers are re-declared across **seven** spec files (not the four the epic claims — re-measured
at `e4c54dc`: 7/6/5/4/4/4/2/2). `registerViaUi` carries the `registrationEnabled` `toPass()` workaround in **five**
copies, so Story 7.3's race fix would have to land five times, and the copies have already drifted.

**Approach:** Extract the eight helpers verbatim into two new files under `bp_front/e2e/support/` — `api.ts` (no
`@playwright/test` import) and `ui.ts` — and rewire the seven specs to import them. Extraction, not rewrite: every
moved line arrives byte-identical except the four differences named below. No config change, no product change.

## Boundaries & Constraints

**Always:**
- Extract the **superset** copy in each of the four divergent cases: hardened `registerViaUi` (with `toPass`), generic
  `gql<T>`, `addItem` with `store?: string`, and `uniqueUsername` with a new leading `prefix` parameter.
- Preserve all seven `uniqueUsername` prefixes byte-for-byte: `acct`, `admin`, `lists`, `nav`, `sharing`, `shopping`,
  `item_editing`. They are load-bearing — `./db/data` persists and both projects run concurrently.
- `support/api.ts` holds `BACKEND`, `loginApi`, `gql<T>` and **must not import `@playwright/test`** — `global-setup.ts`
  runs before the runner exists.
- Imports are **relative** (`from './support/ui'`). Never `@/` — `tsconfig.e2e.json` has no `paths`, and Playwright
  reads `bp_front/tsconfig.json`, not `tsconfig.e2e.json`.
- Files must be `.ts`, must live under `e2e/support/`, and must **not** match `*.spec.ts` / `*.test.ts` (the default
  `testMatch` would collect them and fail the run).
- Match `e2e/`'s uniform style exactly: no semicolons, single quotes, 2-space indent, no space inside import braces,
  inline `type` modifiers, named specifiers sorted alphabetically.
- Run `npx tsc -b` **before** `npm run test:e2e` — a type error in the support module fails the Docker image build, so
  the suite cannot start and the failure surfaces as a compose build failure.
- Bring the stack up by hand and wait for `:2080` to answer before running the suite (cold start is unreliable;
  Story 7.1 lost a cycle to `webServer exited early`).

**Block If:**
- Any change is needed under `bp_back/` (AR-E7-0 freeze — only 7.4/7.6/7.12 may touch it).
- A byte-diff (AC7) shows a difference this spec does not name, and resolving it requires choosing between two
  behaviours rather than taking a strict superset.
- The suite cannot reach 104/104 for a reason that is not the catalogued `registrationEnabled` race (7.3) or the FR38
  lexicographic sort (7.5).

**Never:**
- No `storageState`, no `test.extend` fixture, no session reuse, no login fixture (AR-E7-5). Every spec still registers
  a fresh user through the UI and logs in through the form.
- No `@ts-ignore`, `@ts-expect-error`, or `eslint-disable` anywhere in the diff.
- Do not edit `tsconfig.e2e.json`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, or `playwright.config.ts` —
  all four Story 7.1 invariants must survive (`"files": []`, no `composite`, `bp/e2e-playwright` stays **last**,
  glob stays `e2e/**/*.ts`). Verified: no config change is needed.
- Do not remove the `toPass` workaround, add a sixth copy, or touch its 1500/20000 ms timeouts — that is 7.3.
- Do not extract, merge, or "improve": `lists.spec.ts`'s `createListViaUi` or its four inline `addCategory`/`addItem`
  blocks; `admin.spec.ts`'s `loginViaUi`/`loginAsAdmin`/`withFreshAuthPage`/`DEFAULT_PW`; `sharing.spec.ts`'s
  `backToLists`/`openShareDialog`/`shareWith`; `item-editing.spec.ts`'s `fetchItem`/`ApiItem`; the 15
  `browser.newContext` sites; `seedMembership`; `uniqueName`; the `ADMIN` const. File them as ledger entries instead.
- Do not touch `global-setup.ts`, the `registrationEnabled` mechanism, `admin.spec.ts:169-206`, `HomeRedirect.tsx`,
  `src/`, `src/__generated__/`, or any dependency version.
- Do not "unify" `auth.spec.ts:12`'s differently-shaped username. `auth.spec.ts` and `smoke.spec.ts` are out of scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Prefix preserved | `uniqueUsername('shopping', 'owner', 'mobile')` | `shopping_e2e_owner_mobile_<ts>` — byte-identical to today | Any prefix collapse = seven namespaces merge; specs collide on foreign data |
| `account` gains hardening | `registerViaUi` on `account.spec.ts` | Now retries `/auth` until the Register link appears | Strengthening; account was the last unprotected register-based spec |
| `gql` failure mode widens | response `{data: null}`, no `errors` | Now **throws** (`|| !body.data`); previously silent for shopping's 2 callers | Both callers are object-returning mutations; should never fire. Accept + record |
| `addItem` arity | 3-arg call from `shopping`/`sharing`/`navigation` | Unchanged — guard is `store !== undefined`, not truthiness | 4-arg calls at `item-editing:277,308,383` keep working |
| Orphaned `BACKEND` | `shopping.spec.ts:19`, `item-editing.spec.ts:27` after `loginApi`/`gql` move | Both **deleted** | `noUnusedLocals` fails the build on an unused module-level const |
| Orphaned `type Page` | `account.spec.ts:1` **and `shopping.spec.ts:1`** | Both shrink to `import {expect, test} from '@playwright/test'` | Only these two: all 5 of shopping's `: Page` sites are movers. `lists`/`sharing`/`navigation`/`item-editing`/`admin` retain local `Page` consumers |
| Non-fixture page | 10 `registerViaUi` call sites pass a `ctx.newPage()` page | Each keeps passing **exactly** the page object it passes today | Substituting the `page` fixture would void the mobile gate (AC4) |
| Support file collected | a file named `support/*.spec.ts` | Must not exist | Playwright would collect it and fail the run with zero tests |

</intent-contract>

## Code Map

- `bp_front/e2e/support/api.ts` -- **NEW.** `BACKEND`, `loginApi`, `gql<T>`. Pure `fetch`; zero `@playwright/test`.
- `bp_front/e2e/support/ui.ts` -- **NEW.** `PASSWORD`, `uniqueUsername`, `registerViaUi`, `openListsViaMenu`,
  `createListAndOpen`, `addCategory`, `addItem`. Imports `{expect, type Page}`. Carries the shared rationale docblock.
- `bp_front/e2e/shopping.spec.ts:14,19,21-109` -- donor of `loginApi`/void `gql`; loses `PASSWORD`, `BACKEND`, all five
  UI helpers **and `type Page`**.
- `bp_front/e2e/item-editing.spec.ts:22,27,29-139` -- donor of the superset `addItem` and generic `gql<T>`; keeps
  `type Page` (`openEditDialog:98`, `saveEditDialog:103`, `setStoreViaEdit:109`) and `fetchItem`/`ApiItem:141-158`.
- `bp_front/e2e/sharing.spec.ts:18,20-80` -- donor of the canonical `registerViaUi`; keeps `Page` (`openShareDialog:84`).
- `bp_front/e2e/navigation.spec.ts:26,28-91` -- keeps `ADMIN:25`, `titleLink:94`, and the unrelated `toPass` at `:164`.
- `bp_front/e2e/lists.spec.ts:14,16-51` -- imports 4 symbols only; keeps `createListViaUi:55` and 4 inline blocks.
- `bp_front/e2e/account.spec.ts:15,17-34` -- the unhardened `registerViaUi`; loses `type Page`.
- `bp_front/e2e/admin.spec.ts:18-20` -- `uniqueUsername` only; `DEFAULT_PW:16`, `Browser` import and the rest stay.
- `_bmad-output/implementation-artifacts/deferred-work.md:120-124`, `:638-645` -- the two entries this story closes.
  `:641-642`, `:688` and `:120` also carry the false "four" count. `:57` (7.3 race) must stay open.
- `_bmad-output/project-context.md:199-203` -- the `registrationEnabled` bullet naming four `toPass` copies.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:38`, `:112` -- `last_updated`, story key.

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/e2e/` -- re-measure the ground truth before editing anything -- run the declaration-count command from
  the story context; confirm 7/6/5/4/4/4/2/2, the five `toPass` copies (`lists:32`, `navigation:41`, `sharing:32`,
  `shopping:33`, `item-editing:41`) and the sixth unrelated one (`navigation:164`); `diff` each pair of copies and
  confirm exactly four real divergences plus comment-only drift in `registerViaUi`. Record the measured table.
- [x] `bp_front/e2e/support/api.ts` -- create with `BACKEND`, `loginApi` (verbatim from `shopping:88-97`), generic
  `gql<T>` (verbatim from `item-editing:128-139`) -- the generic is a strict superset of shopping's void version.
- [x] `bp_front/e2e/support/ui.ts` -- create with `PASSWORD` and the six UI helpers, superset copies, bodies verbatim;
  `uniqueUsername` gains a leading `prefix: string` parameter -- prefix parameterisation is the only signature change.
- [x] `bp_front/e2e/account.spec.ts` -- import `PASSWORD`, `registerViaUi`, `uniqueUsername`; delete the three local
  declarations; shrink line 1 to `import {expect, test} from '@playwright/test'` -- `Page` has no other consumer here.
- [x] `bp_front/e2e/admin.spec.ts` -- import `uniqueUsername` only; delete `:18-20` -- everything else stays, including
  `DEFAULT_PW` and the `Browser` import.
- [x] `bp_front/e2e/lists.spec.ts` -- import `PASSWORD`, `openListsViaMenu`, `registerViaUi`, `uniqueUsername`; delete
  those four locals -- `createListViaUi` and the four inline blocks stay (divergences 4 and 5).
- [x] `bp_front/e2e/navigation.spec.ts` -- import the six UI helpers + `PASSWORD`; delete `:26,28-91` -- `ADMIN` and
  `titleLink` keep `Page` alive here.
- [x] `bp_front/e2e/sharing.spec.ts` -- import the six UI helpers + `PASSWORD`; delete `:18,20-80`.
- [x] `bp_front/e2e/shopping.spec.ts` -- import all eight + `PASSWORD`; delete `:14,19,21-109` **including the orphaned
  `BACKEND`**; shrink line 1 to `import {expect, test} from '@playwright/test'` -- all five `: Page` sites move out.
- [x] `bp_front/e2e/item-editing.spec.ts` -- import all eight + `PASSWORD`; delete `:22,27,29-139` **including the
  orphaned `BACKEND`**; keep `type Page`, `fetchItem` and `ApiItem`.
- [x] `bp_front/e2e/` -- verify the move mechanically -- for each of the eight helpers, byte-diff the extracted body
  against its original at `e4c54dc` and confirm empty apart from the four named differences; count `await` tokens per
  body before and after. Record every command and its output.
- [x] `bp_front/` -- static gates -- `npx tsc -b` exit 0, then `npm run lint` exit 0 with zero output; `grep` for
  suppression comments returns nothing; `git diff --stat bp_back/` empty.
- [x] `bp_front/` -- run the suite -- `npm run test:e2e` → 104/104 on `chromium` + `mobile` at `retries: 0` against the
  production image; `npx playwright test --list` still reports `Total: 104 tests in 9 files`.
- [x] `bp_front/e2e/support/ui.ts` -- observe the extraction failing -- break one helper (e.g. point
  `openListsViaMenu` at `menu-lists-BROKEN`), rebuild the image, confirm **red on both projects across ≥3 spec files**,
  revert, confirm green. Record the command and verbatim output.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- close `:120-124` and `:638-645` using the file's
  strike-through-and-retain convention; sweep for a third (measured: only two exist — record that); correct the "four
  copies" count to **five** at `:120`, `:641-642` and `:688`; file the Decision-10 candidates as new entries under a
  `## Deferred from: Story 7.2` section, stating they are out of *charter*, not assessed as acceptable.
- [x] `_bmad-output/project-context.md:199-203` -- correct "four" to five and name `navigation.spec.ts:41`; add rules
  only (where shared E2E helpers live, imports are relative, support files must not match `*.spec.ts`); refresh the
  `_Last Updated_` footer -- new *debt* goes to the ledger, not here (NFR-E7-1).
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `7-2-shared-e2e-support-module` → `done`; refresh
  `last_updated` -- record the seven-file scope deviation from the epic's `Files:` line.

**Acceptance Criteria:**
- Given the eight helpers were declared across seven specs, when the story is complete, then each is defined exactly
  once under `bp_front/e2e/support/` and `grep -c "function <helper>" bp_front/e2e/*.spec.ts` returns **0** for all
  eight, while every spec keeps its distinct `uniqueUsername` prefix byte-for-byte.
- Given this is a refactor, when the suite runs, then it passes 104/104 on `chromium` and `mobile` against the
  production image, and every behavioural difference between copies is **reported in the record for `md`**, not
  silently resolved by picking one.
- Given AR-E7-5, when the tree is inspected, then no `storageState`, no `test.extend`, and no session reuse exists;
  every spec still registers a fresh user through the UI; API calls remain environment prep only.
- Given `browser.newContext()` does not inherit the project `use` block, when the ten non-fixture `registerViaUi` call
  sites are inspected, then each passes exactly the page object it passed at `e4c54dc` and no new hand-built context
  was introduced.
- Given AC7 is the load-bearing check because `no-floating-promises` is not enabled until 7.11, when the record is
  written, then it offers **empty byte-diffs — not a green suite** — as the evidence for "behaviourally identical",
  with the diff commands and their output included.
- Given a stale local copy would leave the suite green, when the record is written, then it contains a deliberate
  break of one support helper observed **red on both projects across specs in ≥3 different files**, and the revert.
- Given the story is tooling-only, when `git diff` is inspected, then `bp_back/`, `src/`, `src/__generated__/`,
  `tsconfig*.json`, `eslint.config.mjs`, `package.json` and `playwright.config.ts` are all untouched.

## Spec Change Log

## Review Triage Log

### 2026-08-08 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 4, low 2)
- defer: 7: (high 0, medium 2, low 5)
- reject: 11
- addressed_findings:
  - `[medium]` `[patch]` **`auth.spec.ts` inlines the entire registration flow and was invisible to every measurement in
    this story.** `auth.spec.ts:18-28` is `registerViaUi`'s body verbatim as a test body. The ground truth was measured
    with `grep "function <helper>"`, which by construction cannot see an inlined copy — the same class of undercount
    this story corrected in three prior documents. The code is correct (the spec scoped `auth.spec.ts` out, and
    registration *is* the behaviour it asserts), but no artifact recorded the copy. Added a ledger entry naming it, and
    the consequence: it is the one register-based spec with **no `toPass` hardening at all**.
  - `[medium]` `[patch]` `deferred-work.md`'s `DEFAULT_PW` entry claimed `admin.spec.ts` held "the only surviving alias"
    of `'e2e-password-123'`. **False** — `grep -rn` returns **three** sites (`admin.spec.ts:18`, `auth.spec.ts:13`,
    `support/ui.ts:20`). Corrected, with the third named.
  - `[medium]` `[patch]` `project-context.md`'s new claim that the `toPass` workaround "lives in **exactly one place**"
    reads as full coverage. It is one *place*, not full coverage: `auth.spec.ts` registers bare, and the wrapper guards
    only reaching the register form, **not the submit** — which is the window all observed failures actually land in.
    Both qualifications added.
  - `[medium]` `[patch]` `project-context.md:193` documented the username shape as
    `<prefix>_e2e_${project.name}_${Date.now()}` while the helper this story wrote emits
    `${prefix}_e2e_${label}_${projectName}_${Date.now()}`. The story edited that same section and left the contradiction
    standing four bullets above its own new block. Corrected, and `auth.spec.ts`'s eighth shape noted.
  - `[low]` `[patch]` The new `withSecondActor` ledger row claimed "15 sites across **6 files**" while enumerating five
    and measuring five. Corrected to 5.
  - `[low]` `[patch]` The new `uniqueName` ledger row claimed "~60" inline sites; actual measured count is **79**.
    Corrected. (Both count errors sat in the section whose stated virtue is being re-measured rather than inherited.)
  - `[low]` `[patch]` The record framed all four divergences as resolved by "taking the strict superset". `gql` is not
    one: a superset of *checks* is a **subset of accepted responses**. Reworded, with `gql` singled out as the one
    divergence carrying real exposure.

Rejected findings were, in the main, properties of code this story copied **byte-identically** by mandate — `api.ts`
having no fetch timeout, `res.json()` before `res.ok`, no `accessToken` presence check, `addItem` not asserting the
`store` it fills, `openListsViaMenu` assuming the user menu is closed — where changing them would have violated AC7's
byte-diff requirement. (The substantive ones were filed as defers rather than dropped.) Also rejected: making `BACKEND`
respect `E2E_BASE_URL` (settled as Decision 9 — it would break the TLS-edge run mode); the ledger's
strike-through-and-retain convention "re-printing the wrong count" (that convention is inherited from Story 7.1 and git
history is not a substitute for an in-file audit trail); `sprint-status.yaml`'s cumulative `last_updated` comment
(pre-existing across five stories, not caused here); and the observation that `gql<T>` infers `unknown` at call sites
that ignore the return value (true, and harmless).

## Design Notes

**Two files, and the split is not cosmetic.** `global-setup.ts` has zero imports today and runs in Playwright's
globalSetup phase. Story 7.3 owns converging it onto `support/api.ts`; a top-level `@playwright/test` import in `api.ts`
would drag the runner into that phase when it does. Keeping `api.ts` runner-free now is what makes 7.3 cheap.

**`uniqueUsername` — the only signature change in the story:**

```ts
export function uniqueUsername(prefix: string, label: string, projectName: string): string {
  return `${prefix}_e2e_${label}_${projectName}_${Date.now()}`
}
```

**The four real divergences, pre-measured — confirm each by `diff` before acting on it:**

1. `account.spec.ts:26-34`'s `registerViaUi` is the **only** copy without the `toPass` wrapper. Extracting the hardened
   version makes account *more* robust and removes the last unprotected register-based spec. Accept.
2. `gql`: `item-editing`'s generic adds `|| !body.data` to the throw. `shopping.spec.ts:280-281`'s two seeding calls
   would newly throw on `{data: null}` with no `errors`. Both are object-returning mutations, so it should never fire —
   but it is a real change to a failure mode. Accept, and say why in the record.
3. `addItem`: `item-editing`'s 4th param `store?: string`, guarded by `store !== undefined`. Zero effect on the three
   3-arg callers. Recorded because AC2 demands every difference be named.
4. `uniqueUsername`: the prefix parameter (above).

Everything else that differs between `registerViaUi` copies is **comments only** (`lists` has a 6-line block plus a
3-line one, `shopping` 2 lines, `navigation` 1) — not a behavioural divergence. Preserve the clearest comment set in
`support/ui.ts`; do not treat comment drift as a fifth divergence.

**Two corrections to the story context, both verified against the tree — do not re-derive the stale version:**

- The context says only `account.spec.ts` loses `type Page`, "verified". **False.** All five of `shopping.spec.ts`'s
  `: Page` sites (`:29,44,54,66,75`) are movers, so `shopping.spec.ts` loses it too. `noUnusedLocals` turns a missed
  one into a build failure — and therefore into a Docker build failure.
- The context directs closing "both ledger entries **and sweeping for a third**". Swept: there are exactly **two**
  (`:120-124`, `:638-645`). `:688` is a *different* entry (7.3's race, stays open) that merely repeats the false
  "four copies" count and needs the count corrected, not the entry closed.

**`BACKEND` stays `'http://localhost:2080'`** and must not become `baseURL`/`E2E_BASE_URL` — API prep always hits the
local Caddy entrypoint directly, or the TLS-edge run mode breaks (`global-setup.ts:7-13`).

**`setTimeout` returns `Timeout`, not `number`, under `types: ["node"]`.** If any helper ever holds a timer handle,
annotate `ReturnType<typeof setTimeout>`.

## Verification

**Commands:**
- `cd bp_front/e2e && for f in uniqueUsername registerViaUi openListsViaMenu createListAndOpen addCategory addItem loginApi gql; do printf '%-20s ' "$f"; grep -lc "function $f" *.spec.ts | tr '\n' ' '; echo; done` -- expected: **no output** for all eight after the move.
- `cd bp_front && npx tsc -b` -- expected: exit 0. Run this **before** the suite.
- `cd bp_front && npm run lint` -- expected: exit 0, zero output. Linted set grows from 48 to 50 files.
- `cd bp_front && npx playwright test --list` -- expected: `Total: 104 tests in 9 files` (support files not collected).
- `cd bp_front && npm run test:e2e` -- expected: `104 passed`, both projects, `retries: 0`, production image.
- `git show e4c54dc:bp_front/e2e/<file> | sed -n '<range>p' | diff - <(sed -n '<range>p' bp_front/e2e/support/ui.ts)` --
  expected: empty for each of the eight, apart from the four named differences.
- `grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" bp_front/e2e/` -- expected: no hits.
- `git diff --stat bp_back/ bp_front/src/ bp_front/tsconfig.json bp_front/tsconfig.e2e.json bp_front/eslint.config.mjs bp_front/package.json bp_front/playwright.config.ts` -- expected: empty.

**Manual checks (if no CLI):**
- The AC6 break-and-observe proof: the deliberate break, the verbatim red output naming ≥3 spec files on both
  `chromium` and `mobile`, and the confirmed revert, are all pasted into this spec's record.
- The ten non-fixture `registerViaUi` call sites (`lists:204,224`, `shopping:273`, `sharing:118,167,205,254,294`,
  `item-editing:441,591`) each read the same page variable as at `e4c54dc`.

## Implementation Record

**Agent:** claude-opus-5[1m] · **Date:** 2026-08-08 · **Baseline:** `5ba0a9e` (e2e tree byte-identical to `e4c54dc` —
verified: `git diff e4c54dc 5ba0a9e --stat -- bp_front/e2e/` is empty, so every AC7 diff below is equally a diff against
the story-context baseline). **Nothing committed; all changes left in the working tree.**

### Files Changed

**New (2):**

| File | Lines | Contents |
|---|---|---|
| `bp_front/e2e/support/api.ts` | 39 | `BACKEND`, `loginApi`, `gql<T>`. **Zero `@playwright/test` imports** — verified by `grep`. |
| `bp_front/e2e/support/ui.ts` | 98 | `PASSWORD`, `uniqueUsername`, `registerViaUi`, `openListsViaMenu`, `createListAndOpen`, `addCategory`, `addItem`. Imports `{expect, type Page}`. Carries the shared rationale docblock. |

**Modified — the seven declaring specs:**

| File | Lines before → after | What left | What stayed |
|---|---|---|---|
| `account.spec.ts` | 144 → 125 | `PASSWORD`, `uniqueUsername`, `registerViaUi`, **`type Page`** | — |
| `admin.spec.ts` | 245 → 243 | `uniqueUsername` only | `ADMIN`, `DEFAULT_PW`, `type Browser`, `type Page`, `loginViaUi`, `loginAsAdmin`, `createUserViaUi`, `setRegistration`, `withFreshAuthPage` |
| `lists.spec.ts` | 272 → 235 | `PASSWORD`, `uniqueUsername`, `registerViaUi`, `openListsViaMenu` | `createListViaUi`, all four inline `addCategory`/`addItem` blocks, `type Page` |
| `navigation.spec.ts` | 390 → 326 | `PASSWORD` + all six UI helpers | `ADMIN`, `titleLink`, `type Page`, the unrelated 2000 ms `toPass` |
| `sharing.spec.ts` | 334 → 272 | `PASSWORD` + all six UI helpers | `openShareDialog`, `shareWith`, `backToLists`, `type Page` |
| `shopping.spec.ts` | 301 → 207 | `PASSWORD`, **`BACKEND`**, all five UI helpers, `loginApi`, `gql`, **`type Page`** | — |
| `item-editing.spec.ts` | 625 → 528 | `PASSWORD`, **`BACKEND`**, six UI helpers, `loginApi`, `gql` | `type Page`, `openEditDialog`, `saveEditDialog`, `setStoreViaEdit`, `ApiItem`, `fetchItem` |

Net: **−513 lines** across the seven specs, **+137** in the support module.

**Modified — bookkeeping (3):** `deferred-work.md`, `project-context.md`, `sprint-status.yaml`.

**Explicitly NOT touched — verified, not asserted:**

```
$ git diff --stat bp_back/ bp_front/src/ bp_front/tsconfig.json bp_front/tsconfig.e2e.json \
    bp_front/tsconfig.app.json bp_front/tsconfig.node.json bp_front/eslint.config.mjs \
    bp_front/package.json bp_front/package-lock.json bp_front/playwright.config.ts \
    bp_front/e2e/global-setup.ts bp_front/e2e/auth.spec.ts bp_front/e2e/smoke.spec.ts
(no output — all untouched)
```

`git status --short` at close lists exactly the 10 modified files and the 2 untracked additions
(`bp_front/e2e/support/`, this spec). No `bp_back/` entry; no `src/__generated__/` entry; no dependency version changed.

```
$ grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable" bp_front/e2e/
(no hits, exit 1)
$ grep -rn "storageState\|test.extend" bp_front/e2e/ bp_front/playwright.config.ts
(no hits — AC3 holds)
```

---

### Ground truth re-measured

Measured by me at the working tree before any edit, **not copied from the story context**.

```
$ cd bp_front/e2e && for f in uniqueUsername registerViaUi openListsViaMenu createListAndOpen \
    addCategory addItem loginApi gql; do printf '%-20s ' "$f"; grep -lc "function $f" *.ts | tr '\n' ' '; echo; done
```

| Helper | Measured | Files | Epic's claim |
|---|---|---|---|
| `uniqueUsername` | **7** | account, admin, lists, navigation, sharing, shopping, item-editing | 4 |
| `registerViaUi` | **6** | account, lists, navigation, sharing, shopping, item-editing | 4 |
| `openListsViaMenu` | **5** | lists, navigation, sharing, shopping, item-editing | 4 |
| `createListAndOpen` | **4** | navigation, sharing, shopping, item-editing | 4 ✓ |
| `addCategory` | **4** | navigation, sharing, shopping, item-editing | 4 ✓ |
| `addItem` | **4** | navigation, sharing, shopping, item-editing | 4 ✓ |
| `loginApi` | **2** | shopping, item-editing | 4 |
| `gql` | **2** | shopping, item-editing | 4 |

**7/6/5/4/4/4/2/2 — confirmed.** The story context's scope correction is right and the epic's `Files:` line is wrong.

**The five `toPass` copies + the unrelated sixth — confirmed:**

```
$ grep -n "toPass" *.ts
sharing.spec.ts:32:  }).toPass({timeout: 20000})
navigation.spec.ts:41:  }).toPass({timeout: 20000})     <- the copy every prior document missed
navigation.spec.ts:164:  }).toPass({timeout: 2000})     <- UNRELATED (CSS hover settling) — untouched
lists.spec.ts:32:  }).toPass({timeout: 20000})
item-editing.spec.ts:41:  }).toPass({timeout: 20000})
shopping.spec.ts:33:  }).toPass({timeout: 20000})
```

All five registration copies are byte-identical (proved by the comment-stripped diffs below). `navigation.spec.ts:164`
is a different construct at a different timeout and was not touched — it is still there, unchanged.

**Constants census:** six byte-identical `const PASSWORD = 'e2e-password-123'` (`account:15`, `lists:14`, `sharing:18`,
`shopping:14`, `item-editing:22`, `navigation:26`) → moved. Two byte-identical `const BACKEND = 'http://localhost:2080'`
(`shopping:19`, `item-editing:27`) → moved, both orphans deleted. `admin.spec.ts:16`'s `DEFAULT_PW` holds the same
literal under a different name → **left alone** (Decision 10; now the only surviving alias — filed in the ledger).

**Pairwise divergence sweep — every pair of every helper diffed.** Result: exactly **four** real divergences plus
comment-only drift in `registerViaUi`. **No fifth divergence found.** Four helpers — `openListsViaMenu`,
`createListAndOpen`, `addCategory`, `loginApi` — are byte-identical across every copy, comments included.

**Confirmed divergence list (the four, and only these four):**

1. `account.spec.ts:26-34`'s `registerViaUi` is the only copy without the `toPass` wrapper.
2. `gql`: `item-editing`'s generic `<T>` adds `|| !body.data` to the throw and `return body.data`.
3. `addItem`: `item-editing`'s 4th parameter `store?: string`, guarded by `store !== undefined`.
4. `uniqueUsername`: the prefix — seven different literals, resolved by parameterisation.

---

### AC7 — byte-diff evidence (the load-bearing evidence, not the green suite)

Every extracted body was diffed against **every** original at `e4c54dc`. The only normalisation applied is
`sed 's/^export //'`, which strips the keyword the extraction adds; nothing else. Full script:
`.tmp/7ac8941f-b388-4f47-8049-fe38103b4904/ac7.sh`; full output: `.../ac7.out`. Verbatim below.

#### 1/8 `uniqueUsername` — 7 originals

```
$ git show e4c54dc:bp_front/e2e/account.spec.ts | sed -n '17,19p' | diff - <(sed -n '22,24p' bp_front/e2e/support/ui.ts | sed 's/^export //')
1,2c1,2
< function uniqueUsername(label: string, projectName: string): string {
<   return `acct_e2e_${label}_${projectName}_${Date.now()}`
---
> function uniqueUsername(prefix: string, label: string, projectName: string): string {
>   return `${prefix}_e2e_${label}_${projectName}_${Date.now()}`
```

The same two-line diff, and **only** that diff, for all seven — `admin.spec.ts:18-20` (`admin_`),
`lists.spec.ts:16-18` (`lists_`), `navigation.spec.ts:28-30` (`nav_`), `sharing.spec.ts:20-22` (`sharing_`),
`shopping.spec.ts:21-23` (`shopping_`), `item-editing.spec.ts:29-31` (`item_editing_`). The closing `}` and the
`_e2e_${label}_${projectName}_${Date.now()}` tail are byte-identical in every case. **This is divergence 4 and nothing
else.**

Prefix preservation confirmed at runtime, not just by inspection — a username from the suite run:
`item_editing_e2e_owner_mobile_1786150427643`.

#### 2/8 `registerViaUi` — 6 originals (extracted copy = `lists.spec.ts`'s, the fullest comment set)

```
$ git show e4c54dc:bp_front/e2e/lists.spec.ts | sed -n '22,42p' | diff - <(sed -n '28,48p' bp_front/e2e/support/ui.ts | sed 's/^export //')
  => IDENTICAL (diff exit 0)
```

**Twenty-one lines, byte-for-byte, comments included, zero difference.** The other four hardened copies differ from the
extracted one in **comments only**. Verbatim for `sharing`:

```
$ git show e4c54dc:bp_front/e2e/sharing.spec.ts | sed -n '28,39p' | diff - <(sed -n '28,48p' bp_front/e2e/support/ui.ts | sed 's/^export //')
1a2,7
>   // Registration is enabled by global-setup, but the admin-panel spec briefly
>   // toggles the SHARED backend registration flag OFF and back ON while the two
>   // projects run concurrently (documented shared-state hazard). AuthPage reads
>   // the flag only on mount, so reload /auth until the Register link appears
>   // rather than failing on that transient window — this preserves the assertion,
>   // it just doesn't race the flag.
9a16,18
>   // `/` is now a redirect (Story 5.6): a brand-new user lands on /lists, not a
>   // home placeholder. Assert route-agnostic authentication (off /auth + the
>   // shared app-bar visible) rather than a specific landing URL/testid.
```

`navigation:37-49`, `shopping:29-42` and `item-editing:37-48` give the same shape — every `>` line begins with `//`.
And `account:26-34`:

```
$ git show e4c54dc:bp_front/e2e/account.spec.ts | sed -n '26,34p' | diff - <(sed -n '28,48p' bp_front/e2e/support/ui.ts | sed 's/^export //')
2c2,11
<   await page.goto('/auth')
---
>   // Registration is enabled by global-setup, but the admin-panel spec briefly
    … (6 comment lines) …
>   await expect(async () => {
>     await page.goto('/auth')
>     await expect(page.getByTestId('to-register-link')).toBeVisible({timeout: 1500})
>   }).toPass({timeout: 20000})
6a16,18
>   // `/` is now a redirect (Story 5.6): a brand-new user lands on /lists, not a
    … (2 comment lines) …
```

**To separate behaviour from comment drift, every `registerViaUi` diff was re-run with `//` lines and blanks stripped:**

```
$ code() { grep -v '^\s*//' | grep -v '^\s*$'; }
$ registerViaUi  lists.spec.ts:22-42         vs support/ui.ts:28-48  =>  IDENTICAL
$ registerViaUi  navigation.spec.ts:37-49    vs support/ui.ts:28-48  =>  IDENTICAL
$ registerViaUi  sharing.spec.ts:28-39       vs support/ui.ts:28-48  =>  IDENTICAL
$ registerViaUi  shopping.spec.ts:29-42      vs support/ui.ts:28-48  =>  IDENTICAL
$ registerViaUi  item-editing.spec.ts:37-48  vs support/ui.ts:28-48  =>  IDENTICAL
$ registerViaUi  account.spec.ts:26-34       vs support/ui.ts:28-48
2c2,5
<   await page.goto('/auth')
---
>   await expect(async () => {
>     await page.goto('/auth')
>     await expect(page.getByTestId('to-register-link')).toBeVisible({timeout: 1500})
>   }).toPass({timeout: 20000})
```

**Five of six copies are behaviourally byte-identical to the extraction; the sixth differs by exactly divergence 1 and
nothing else.** The `toPass` wrapper is present, its `1500` / `20000` ms timeouts untouched, no sixth copy added.

#### 3/8 `openListsViaMenu` — 5 originals

```
$ git show e4c54dc:bp_front/e2e/lists.spec.ts        | sed -n '46,51p' | diff - <(...ui.ts 52,57...)  => IDENTICAL
$ git show e4c54dc:bp_front/e2e/navigation.spec.ts   | sed -n '51,56p' | diff - <(...)               => IDENTICAL
$ git show e4c54dc:bp_front/e2e/sharing.spec.ts      | sed -n '41,46p' | diff - <(...)               => IDENTICAL
$ git show e4c54dc:bp_front/e2e/shopping.spec.ts     | sed -n '44,49p' | diff - <(...)               => IDENTICAL
$ git show e4c54dc:bp_front/e2e/item-editing.spec.ts | sed -n '50,55p' | diff - <(...)               => IDENTICAL
```

**5/5 empty.** Zero divergence.

#### 4/8 `createListAndOpen` — 4 originals

```
navigation.spec.ts:61-71    vs ui.ts:62-72  => IDENTICAL
sharing.spec.ts:50-60       vs ui.ts:62-72  => IDENTICAL
shopping.spec.ts:54-64      vs ui.ts:62-72  => IDENTICAL
item-editing.spec.ts:60-70  vs ui.ts:62-72  => IDENTICAL
```

**4/4 empty.** Note this is the helper `lists.spec.ts`'s `createListViaUi` is *not* — that one was left untouched
(divergence 4 in the story context's numbering; see Completion Notes).

#### 5/8 `addCategory` — 4 originals

```
navigation.spec.ts:73-80    vs ui.ts:74-81  => IDENTICAL
sharing.spec.ts:62-69       vs ui.ts:74-81  => IDENTICAL
shopping.spec.ts:66-73      vs ui.ts:74-81  => IDENTICAL
item-editing.spec.ts:72-79  vs ui.ts:74-81  => IDENTICAL
```

**4/4 empty.**

#### 6/8 `addItem` — 4 originals (extracted copy = `item-editing`'s superset)

```
$ git show e4c54dc:bp_front/e2e/item-editing.spec.ts | sed -n '83,96p' | diff - <(sed -n '85,98p' bp_front/e2e/support/ui.ts | sed 's/^export //')
  => IDENTICAL (diff exit 0)

$ git show e4c54dc:bp_front/e2e/navigation.spec.ts | sed -n '82,91p' | diff - <(sed -n '85,98p' bp_front/e2e/support/ui.ts | sed 's/^export //')
1c1
< async function addItem(page: Page, categoryName: string, itemName: string): Promise<void> {
---
> async function addItem(page: Page, categoryName: string, itemName: string, store?: string): Promise<void> {
4a5,7
>   // Scoped role=combobox: the category Select must stay the ONLY combobox in
>   // this dialog, which is why the store field is a plain input with Chip
>   // suggestions rather than an Autocomplete.
6a10
>   if (store !== undefined) await page.getByTestId('add-item-store').fill(store)
```

Identical output for `sharing.spec.ts:71-80` and `shopping.spec.ts:75-84`. Comment-stripped, the three-way diff reduces
to exactly two lines:

```
1c1
< async function addItem(page: Page, categoryName: string, itemName: string): Promise<void> {
---
> async function addItem(page: Page, categoryName: string, itemName: string, store?: string): Promise<void> {
6a7
>   if (store !== undefined) await page.getByTestId('add-item-store').fill(store)
```

**Divergence 3 and nothing else.** Every other line of the body — including the `add-item-dialog` scoped-combobox click
and both dialog assertions — is byte-identical in all four copies.

#### 7/8 `loginApi` — 2 originals

```
$ git show e4c54dc:bp_front/e2e/shopping.spec.ts     | sed -n '88,97p'   | diff - <(sed -n '17,26p' bp_front/e2e/support/api.ts | sed 's/^export //')  => IDENTICAL
$ git show e4c54dc:bp_front/e2e/item-editing.spec.ts | sed -n '117,126p' | diff - <(sed -n '17,26p' bp_front/e2e/support/api.ts | sed 's/^export //')  => IDENTICAL
```

**2/2 empty.** The two copies were already byte-identical to each other.

#### 8/8 `gql` — 2 originals (extracted copy = `item-editing`'s generic)

```
$ git show e4c54dc:bp_front/e2e/item-editing.spec.ts | sed -n '128,139p' | diff - <(sed -n '28,39p' bp_front/e2e/support/api.ts | sed 's/^export //')
  => IDENTICAL (diff exit 0)

$ git show e4c54dc:bp_front/e2e/shopping.spec.ts | sed -n '99,109p' | diff - <(sed -n '28,39p' bp_front/e2e/support/api.ts | sed 's/^export //')
1c1
< async function gql(query: string, token: string): Promise<void> {
---
> async function gql<T>(query: string, token: string): Promise<T> {
7,8c7,8
<   const body = (await res.json()) as {errors?: unknown}
<   if (!res.ok || body.errors) {
---
>   const body = (await res.json()) as {data?: T; errors?: unknown}
>   if (!res.ok || body.errors || !body.data) {
10a11
>   return body.data
```

**Divergence 2 and nothing else.** The `fetch` call, its method, headers, body and the `throw` message string are
byte-identical.

#### Bonus — the `BACKEND` const

```
$ git show e4c54dc:bp_front/e2e/shopping.spec.ts     | sed -n '19,19p' | diff - <(sed -n '15,15p' bp_front/e2e/support/api.ts | sed 's/^export //')  => IDENTICAL
$ git show e4c54dc:bp_front/e2e/item-editing.spec.ts | sed -n '27,27p' | diff - <(sed -n '15,15p' bp_front/e2e/support/api.ts | sed 's/^export //')  => IDENTICAL
```

Still `'http://localhost:2080'`. Not `baseURL`, not `E2E_BASE_URL`. Both orphaned originals deleted; `grep -n BACKEND`
returns nothing in either spec.

#### `await`-token census — before and after

The one defect no gate in this story can catch is a dropped `await` (`no-floating-promises` is not enabled until 7.11).
Counted with `grep -o '\bawait\b' | wc -l` per body.

| Helper | Origin | before | after |
|---|---|---|---|
| `registerViaUi` | lists.spec.ts | 9 | **9** |
| `registerViaUi` | navigation.spec.ts | 9 | **9** |
| `registerViaUi` | sharing.spec.ts | 9 | **9** |
| `registerViaUi` | shopping.spec.ts | 9 | **9** |
| `registerViaUi` | item-editing.spec.ts | 9 | **9** |
| `registerViaUi` | account.spec.ts | 7 | **9** ← +2, divergence 1 (`toPass` adds `goto` + `toBeVisible`) |
| `openListsViaMenu` | lists.spec.ts | 4 | **4** |
| `createListAndOpen` | navigation.spec.ts | 8 | **8** |
| `addCategory` | navigation.spec.ts | 6 | **6** |
| `addItem` | item-editing.spec.ts | 9 | **9** |
| `addItem` | navigation.spec.ts | 8 | **9** ← +1, divergence 3 (the guarded `store` fill) |
| `loginApi` | shopping.spec.ts | 2 | **2** |
| `gql` | item-editing.spec.ts | 2 | **2** |
| `gql` | shopping.spec.ts | 2 | **2** |
| `uniqueUsername` | account.spec.ts | 0 | **0** |

Whole-module totals, independently computed:

```
support/ui.ts   : 36 awaits
support/api.ts  :  4 awaits
                  --
                  40
Sum of the eight canonical bodies at e4c54dc: 40
```

**40 = 40, exactly.** Every `await` that existed in a canonical copy is present in the support module, and no spurious
one was introduced. The only two per-body increases are the two named divergences, each accounted for line by line.

---

### Gate output

```
$ cd bp_front && npx tsc -b
(no output)
exit=0
```

```
$ cd bp_front && npm run lint
> bp_front@0.16.0 lint
> eslint .
exit=0
```

Zero output, exit 0. Linted set grew **48 → 50** files as the spec predicted (measured with
`npx eslint . --format json`: 50 total, 12 under `e2e/` — the 10 pre-existing plus `support/api.ts` and
`support/ui.ts`). No config change was needed: `tsconfig.e2e.json`'s bare `include: ["e2e"]` and the
`bp/e2e-playwright` override's `e2e/**/*.ts` glob both pick the new directory up automatically, exactly as Decision 4
predicted.

```
$ cd bp_front && npx playwright test --list
… (104 lines) …
Total: 104 tests in 9 files
```

**9 files, not 11** — `support/api.ts` and `support/ui.ts` are correctly *not* collected. `global-setup.ts` proved this
was safe and it holds.

**Stack brought up by hand before the suite, per the spec's cold-start warning:**

```
$ docker compose up -d --build
 Container bag-please-bp_back-1 Running
 Container bag-please-mongo-1 Healthy
 Container bag-please-bp_front-1 Running
$ curl -s -o /dev/null -w '%{http_code}' http://localhost:2080/api/graphiql
401          <- Ktor warm and enforcing auth = ready
```

Then `npm run test:e2e` picked it up via `reuseExistingServer`. No `webServer exited early`.

**Suite run 1 — 103/104.**

```
  1 failed
    [mobile] › e2e/item-editing.spec.ts:320:1 › FR40 — a co-member (not the owner) can edit, and the change lands live on another member's shopping view
  103 passed (37.0s)
```

Diagnosed before re-running, **not** waved through. The error context is unambiguous:

```
Error: expect(page).not.toHaveURL(expected) failed
Expected pattern: not /\/auth$/
Received string: "http://localhost:2080/auth"
  - alert: Registration is disabled
  - textbox "Username": item_editing_e2e_owner_mobile_1786150427643
```

This is the catalogued `registrationEnabled` race — `admin.spec.ts` flipped the shared flag OFF between `registerViaUi`'s
`toPass` link check and the register submit, which is precisely the window the `toPass` wrapper does *not* close. It is
Story 7.3's bug, explicitly excluded by this spec's **Block If**, and it is the same signature the ledger already records
for Story 6.2 (`alert: "Registration is disabled"`, `retries: 0`, register-based spec). Not caused by the extraction:
the failing call site is `registerViaUi(page, owner, PASSWORD)` on the `page` fixture, and the username in the DOM shows
the `item_editing` prefix survived correctly. **Recorded, not fixed** — per Story 7.1's standing note that a clean run at
`retries: 0` is a favourable draw against this race, not evidence it is fixed.

**Suite run 2 — 104/104.**

```
  104 passed (37.0s)
```

Both projects, `retries: 0`, against the production image. Matches the Story 7.1 baseline exactly.

**Independent re-verification by the orchestrating agent (3 further full runs) — the "104/104" claim needs qualifying.**

Runs 1 and 2 above were re-run from a clean checkout of the same working tree:

| Run | Setting | Result | Victim |
|---|---|---|---|
| 3 | `retries: 0` | **103/104** | `[mobile] item-editing.spec.ts:320` |
| 4 | `retries: 0` | **103/104** | `[mobile] item-editing.spec.ts:277` — a **different** test |
| 5 | `--retries=2` (CI) | **104**, 1 flaky healed | `[chromium] item-editing.spec.ts:320` |

Both `retries: 0` failures carry the identical signature — `alert: Registration is disabled`,
`expect(page).not.toHaveURL(/\/auth$/)` inside `registerViaUi`. **That the victim changed between runs is the decisive
evidence**: an extraction defect would fail the same test deterministically, whereas a contended shared flag picks a
random register-based spec on whichever project loses the draw. Confirmed further by running the run-3 victim in
isolation — `npx playwright test item-editing.spec.ts:320` → **2 passed** on both projects.

**The extraction did not widen the race.** `registerViaUi` call sites: **46 now, 46 at `e4c54dc`** (counted per file
against `git show`). Registration pressure is unchanged, so the higher hit rate here versus Story 7.1's clean draw is
sampling, not regression.

**Corrected characterisation, replacing "matches the baseline exactly":** the suite is green at the CI setting
(`retries: 2`) and **not reliably green at `retries: 0`** — 3 of 5 full runs across both agents hit the race. This is
exactly what `project-context.md` already documents ("the suite is not reliably green at `retries: 0`") and exactly what
Story 7.3 exists to delete. AC2's literal "104/104 at `retries: 0`" was met on runs 2 and (with retries) 5; it is a
favourable-draw property of the harness, **not** a stable one, and must not be quoted as though the race were fixed.
The spec's **Block If** does not trigger: this is the catalogued race, which it explicitly excludes.

---

### AC6 — falsifiability proof (break, observe red, revert)

**The break** — `support/ui.ts:54`, `openListsViaMenu`:

```
$ grep -n "menu-lists" e2e/support/ui.ts
54:  await page.getByTestId('menu-lists-BROKEN').click()
$ npx tsc -b
exit=0
```

Worth stating: **the break type-checks and lints clean.** That is exactly why AC7's byte-diff, not this run and not the
green suite, is the evidence for "behaviourally identical".

**The targeted run** — one test from each of the five spec files that consume `openListsViaMenu`:

```
$ npx playwright test e2e/lists.spec.ts:28 e2e/navigation.spec.ts:34 e2e/sharing.spec.ts:39 \
                     e2e/shopping.spec.ts:17 e2e/item-editing.spec.ts:63

  1) [chromium] › e2e/sharing.spec.ts:39:1 › FR39/FR41/FR50 — owner shares; invitee accepts and can write to the shared list
     Error: locator.click: Test timeout of 30000ms exceeded.
       - waiting for getByTestId('menu-lists-BROKEN')
     > 54 |   await page.getByTestId('menu-lists-BROKEN').click()
  2) [mobile]   › e2e/lists.spec.ts:28:1 › FR50 — a brand-new user sees the lists zero-state onboarding prompt
     Error: locator.click: Test timeout of 30000ms exceeded.
       - waiting for getByTestId('menu-lists-BROKEN')
  3) [chromium] › e2e/item-editing.spec.ts:63:1 › FR40 — renaming an item and moving it to another category persists across a reload
       - waiting for getByTestId('menu-lists-BROKEN')
  4) [mobile]   › e2e/sharing.spec.ts:39:1 › FR39/FR41/FR50 — owner shares; invitee accepts and can write to the shared list
       - waiting for getByTestId('menu-lists-BROKEN')
  5) [chromium] › e2e/navigation.spec.ts:34:1 › FR57 — the app-bar title is a link to home on every guarded screen
       - waiting for getByTestId('menu-lists-BROKEN')
  6) [chromium] › e2e/lists.spec.ts:28:1 › FR50 — a brand-new user sees the lists zero-state onboarding prompt
       - waiting for getByTestId('menu-lists-BROKEN')
  7) [mobile]   › e2e/navigation.spec.ts:34:1 › FR57 — the app-bar title is a link to home on every guarded screen
       - waiting for getByTestId('menu-lists-BROKEN')
  8) [mobile]   › e2e/shopping.spec.ts:17:1 › FR40 — checking an item persists across a reload, and it can be unchecked
       - waiting for getByTestId('menu-lists-BROKEN')
  9) [mobile]   › e2e/item-editing.spec.ts:63:1 › FR40 — renaming an item and moving it to another category persists across a reload
       - waiting for getByTestId('menu-lists-BROKEN')
 10) [chromium] › e2e/shopping.spec.ts:17:1 › FR40 — checking an item persists across a reload, and it can be unchecked
       - waiting for getByTestId('menu-lists-BROKEN')
```

**10 of 10 red.** Every failure names `support/ui.ts:54` — proving the specs execute the *shared* body, not a stale
local copy. Coverage: **5 different spec files** (`lists`, `navigation`, `sharing`, `shopping`, `item-editing`) —
requirement was ≥3 — and **both projects for every one of the five**: `chromium` ✓ and `mobile` ✓ for each file. Both
halves of AC6 satisfied with margin.

**The revert:**

```
$ grep -n "menu-lists" e2e/support/ui.ts
54:  await page.getByTestId('menu-lists').click()
$ npx tsc -b
exit=0
$ npx playwright test e2e/lists.spec.ts:28 e2e/navigation.spec.ts:34 e2e/sharing.spec.ts:39 \
                     e2e/shopping.spec.ts:17 e2e/item-editing.spec.ts:63
  10 passed (6.1s)
```

**The revert was verified byte-exact, not eyeballed** — the `openListsViaMenu` AC7 diffs were re-run afterwards against
all five originals at `e4c54dc`:

```
lists.spec.ts:46-51         IDENTICAL
navigation.spec.ts:51-56    IDENTICAL
sharing.spec.ts:41-46       IDENTICAL
shopping.spec.ts:44-49      IDENTICAL
item-editing.spec.ts:50-55  IDENTICAL
```

---

### AC4 — the mobile gate is not quietly voided

46 `registerViaUi` call sites, ten of which pass a non-fixture page. Verified mechanically per file, before vs after:

```
$ diff <(git show e4c54dc:bp_front/e2e/<f>.spec.ts | grep "registerViaUi(" | grep -v "^async function") \
       <(grep "registerViaUi(" bp_front/e2e/<f>.spec.ts)
  lists:        page args unchanged
  sharing:      page args unchanged
  shopping:     page args unchanged
  item-editing: page args unchanged
  navigation:   page args unchanged
  account:      page args unchanged
```

All 46 lines are byte-identical to `e4c54dc`, so the ten non-fixture sites (`lists:204,224`, `shopping:273`,
`sharing:118,167,205,254,294`, `item-editing:441,591` at the old numbering) each still pass exactly the page object they
passed before — `otherPage`, `memberPage`, `inviteePage` as applicable, never substituted for the `page` fixture.

**`browser.newContext` census:** 15 real call sites (+2 mentions inside comments = 17 grep hits, which is why a naive
`grep -c` reads 17; the story context's "15" counts calls and is correct). Verified identical to `e4c54dc` in all nine
spec files. **No hand-built context was introduced, moved, or removed.**

---

### Divergence report for `md` — AC2 requires these be *reported*, not silently resolved

All four were confirmed by `diff` before being acted on, and all four were resolved by **taking the more capable copy** —
never by picking a side between two behaviours. Each needs your sign-off.

**Wording corrected at review:** three of the four are strict supersets in the safe direction (more optional capability,
same accepted inputs). **`gql` is not**, and calling it one flattered it. A superset of *checks* is a **subset of
accepted responses**: adding `|| !body.data` means the shared `gql` rejects a response the old shopping copy accepted.
It is the one divergence carrying real (if small) exposure — see item 2.

**1. `account.spec.ts` gains the `toPass` registration hardening.**
`account.spec.ts:26-34` was the only one of six `registerViaUi` copies opening with a bare `await page.goto('/auth')`.
**Decision: extract the hardened version; `account.spec.ts` becomes more robust.**
*Why:* the alternative — extracting account's unhardened copy — would silently un-harden five specs against a race the
project has documented since Epic 5. This direction removes the last unprotected register-based spec. It is a
strengthening change, and Story 7.3 deletes the wrapper from all callers anyway.
*Observable effect:* `account.spec.ts`'s three tests now retry `/auth` for up to 20 s if `admin.spec.ts` has the shared
flag transiently OFF, instead of hard-failing. `await` count for that body went 7 → 9, both new awaits inside the
wrapper. **This is the only divergence that changes behaviour a test can observe today.**

**2. `gql`'s failure mode widens for `shopping.spec.ts`'s two callers.**
`shopping`'s copy was `Promise<void>` throwing on `!res.ok || body.errors`; `item-editing`'s generic `<T>` also throws on
`!body.data`.
**Decision: extract the generic. Accepted — and this is a real change to a failure mode, not a no-op.**
*Why:* the generic subsumes shopping's callers (both ignore the return value; with `T` uninferred it resolves to
`unknown` and type-checks clean — verified, `tsc -b` exit 0). Extracting the void version instead would break
`item-editing`'s `fetchItem`, which needs the payload.
*Exposure, stated honestly:* `shopping.spec.ts`'s two seeding calls (`shareList` / `acceptInvite`) would **newly throw**
on a `200` response carrying `{data: null}` and no `errors`. Both are object-returning mutations, so a compliant backend
cannot produce that shape and it should never fire. But it is a widened throw condition on a code path that previously
tolerated it, and if it ever does fire it will fire as a *setup* failure in a spec whose subject is something else.
Accepted on the reasoning above; flagging it because "should never fire" is a claim about the backend, not a proof.

**3. `addItem` gains a 4th optional parameter `store?: string`.**
Guarded by `if (store !== undefined)`, **not** a truthiness check — so `addItem(page, cat, item, '')` still fills an
empty store rather than skipping, matching `item-editing`'s current behaviour exactly.
**Decision: extract the superset. Zero effect on the three 3-argument callers** (`shopping`, `sharing`, `navigation`) —
`store` is `undefined` there and the branch is skipped. Extracting the 3-param version instead would break
`item-editing`'s three 4-argument calls, which pass `'Aldi'`. Reported because AC2 demands every difference be named,
not because it carries risk.

**4. `uniqueUsername` gains a leading `prefix: string` parameter.** The only signature change in the story. All seven
prefixes are preserved byte-for-byte and passed at each of the 46+ call sites: `acct`, `admin`, `lists`, `nav`,
`sharing`, `shopping`, `item_editing`. Load-bearing because `./db/data` persists across runs and both projects run
concurrently — collapsing the namespaces would make specs collide on data they did not create. Confirmed at runtime by
a real username from the suite: `item_editing_e2e_owner_mobile_1786150427643`.

**No fifth divergence was found.** The full pairwise sweep confirms `openListsViaMenu`, `createListAndOpen`,
`addCategory` and `loginApi` are byte-identical across every copy including comments, and that all remaining
`registerViaUi` variation is comments only (proved twice: raw diff shows only `//` lines; comment-stripped diff is
empty for 5 of 6). **Nothing arose that the spec did not name, so no Block-If condition was triggered.**

---

### Completion Notes

**1. The seven-file scope deviation from the epic's `Files:` line — deliberate, and recorded as required.**
The epic's AC1 says the helpers are "re-declared in four spec files" and its `Files:` line names four. Both are wrong,
and AC1 is self-contradictory as written: its second clause — *"`grep` confirms no spec file re-declares any of them"* —
is **unsatisfiable** at four files, because `account`, `admin` and `navigation` would each still declare
`uniqueUsername` and two of them `registerViaUi`. I re-measured (7/6/5/4/4/4/2/2) and took the `grep` clause as the
binding half. **Seven spec files were touched, not four:** `account`, `admin`, `lists`, `navigation`, `sharing`,
`shopping`, `item-editing`. The extra three are `account.spec.ts`, `admin.spec.ts` and `navigation.spec.ts`. Recorded
here, in `sprint-status.yaml`'s `last_updated` note, and in both closed ledger entries. `auth.spec.ts` and
`smoke.spec.ts` declare no helper and were left untouched — including `auth.spec.ts:12`'s differently-shaped username
(`mia_e2e_${project}_${ts}`, no label segment), which was deliberately **not** unified.

**2. Both story-context corrections in the spec's Design Notes were verified against the tree and acted on.**

- **`shopping.spec.ts` also loses `type Page`** — the story context says only `account.spec.ts` does, "verified". That
  is false. `grep -n ": Page" *.spec.ts` shows shopping's five `: Page` sites are `:29,44,54,66,75` — `registerViaUi`,
  `openListsViaMenu`, `createListAndOpen`, `addCategory`, `addItem` — **all five are movers**, leaving no consumer. Both
  `account.spec.ts:1` and `shopping.spec.ts:1` were shrunk to `import {expect, test} from '@playwright/test'`. Had I
  followed the context, `noUnusedLocals` would have failed `tsc -b`, and because `tsconfig.e2e.json` is referenced from
  the solution `tsconfig.json` (confirmed) and the Dockerfile runs `npm run build`, that would have surfaced as a
  **Docker image build failure with the suite unable to start** — not as a readable type error. `lists`, `sharing`,
  `navigation`, `item-editing` and `admin` all retain local `Page` consumers and kept the import.
- **There are exactly TWO ledger entries to close, not three.** I swept independently
  (`grep -n -i "shared e2e\|fixture module\|helper block\|support module\|uniqueUsername\|registerViaUi" deferred-work.md`)
  and found hits at only two entries: the Epic 6 close-out bullet and the 6.1-review entry. Both closed with the file's
  strike-through-and-retain convention. The third candidate, the 6.2-review entry near the end of the file, is a
  **different** entry — it is about the `registrationEnabled` race itself, which is Story 7.3's — so it was **left
  open** and only its "this is the fourth spec to copy the `toPass()` workaround" count corrected to **fifth**.

**3. Two orphaned `BACKEND` consts deleted, as the I/O matrix required.** `shopping.spec.ts:19` and
`item-editing.spec.ts:27` lost their only consumers (`loginApi`, `gql`) to `support/api.ts`. Left behind they are unused
module-level consts and `noUnusedLocals` fails the build. `grep -n BACKEND` now returns nothing in either spec. I also
re-checked every remaining spec for any other symbol whose last consumer moved out — there were none beyond these two
and the two `type Page` imports.

**4. Discovered, not predicted by the spec: a prior partial attempt was already in the working tree.**
Despite the session-open snapshot reporting a clean tree, the seven specs were already modified and
`bp_front/e2e/support/` already existed (timestamps 01:54/01:55) when I started. I backed it up to
`.tmp/7ac8941f-b388-4f47-8049-fe38103b4904/prior-attempt/`, then ran `git checkout -- bp_front/e2e/` and
`rm -rf bp_front/e2e/support` to return to the `5ba0a9e` baseline, and redid the extraction from scratch so that every
measurement and byte-diff in this record is against a known baseline rather than against unattributed work. Worth
knowing if a prior run's evidence surfaces elsewhere: **it is not the evidence in this record.**

**5. Also discovered: `npm run test:e2e` reuses a cached Docker image, and that is fine here.**
The `e2e/` tree enters the build context, so a support-module type error would fail the image build (the Story 7.1
ledger entry is accurate). But the extraction changes no `src/` file, so `/app/dist` is bit-identical and the frontend
image layer is `CACHED`. The AC6 break therefore did not need a rebuild to take effect — the specs and the support
module run from the host, not from the image. Recorded so nobody reads "CACHED" as evidence the break was not applied;
the 10 red tests naming `support/ui.ts:54` are that evidence.

**6. Style conventions held with no exceptions.** No semicolons, single quotes, 2-space indent, no space inside import
braces, inline `type` modifiers, named specifiers sorted case-insensitively alphabetically
(`{addCategory, addItem, createListAndOpen, openListsViaMenu, PASSWORD, registerViaUi, uniqueUsername}`). Imports are
relative (`'./support/ui'`, `'./support/api'`) — never `@/`. `support/api.ts` sorts before `support/ui.ts` where a spec
imports both. `grep` confirms **zero** `@playwright/test` references in `api.ts`. No timer handle appears in either
module, so the `ReturnType<typeof setTimeout>` gotcha never arose.

**7. Everything Decision 10 forbade extracting is still in place**, verified by reading each file after the edit:
`lists.spec.ts`'s `createListViaUi` and all four inline `addCategory`/`addItem` blocks (two deliberately weaker, one
deliberately stronger — the one asserting the item row scoped under its category row); `admin.spec.ts`'s `loginViaUi`,
`loginAsAdmin`, `createUserViaUi`, `setRegistration`, `withFreshAuthPage`, `ADMIN`, `DEFAULT_PW` and its `type Browser`
import; `sharing.spec.ts`'s `backToLists`, `openShareDialog`, `shareWith`; `item-editing.spec.ts`'s `openEditDialog`,
`saveEditDialog`, `setStoreViaEdit`, `ApiItem`, `fetchItem`; `navigation.spec.ts`'s `ADMIN` and `titleLink`; the 15
`browser.newContext` sites; `seedMembership`; `uniqueName`. All are filed as ledger entries under
**`## Deferred from: Story 7.2`**, explicitly framed as *out of charter*, not *assessed and found acceptable* — with the
`withSecondActor` mobile-viewport caveat, the `loginViaUi` "must not bake in success assertions" trap, and an explicit
"do NOT clean these up" note on `lists.spec.ts`'s four inline blocks so a future story does not mistake them for
leftovers.

**8. Bookkeeping completed.**
`deferred-work.md`: two entries closed with strike-through-and-retain; the "four" count corrected to **five** in both
closed entries and in the still-open 6.2 race entry; new `## Deferred from: Story 7.2` section with 11 candidates.
`project-context.md`: `registrationEnabled` bullet corrected to five and now names `navigation.spec.ts:41`; new
**rules-only** subsection "Shared E2E helpers live in `bp_front/e2e/support/`" (where they live, `api.ts` stays
runner-free, `BACKEND` is not `baseURL`, imports are relative, support files must not match `*.spec.ts` and must not be
`.tsx`, the prefix parameter, support module ≠ login fixture); `_Last Updated_` refreshed. New *debt* went to the ledger,
not here (NFR-E7-1). `sprint-status.yaml`: `7-2-shared-e2e-support-module` → `done`, `last_updated` refreshed with the
scope deviation.

**9. AR-E7-0 backend freeze respected.** `git diff --stat bp_back/` is empty. No backend need arose.

**10. Open for `md`.** The four divergences above need sign-off (item 2, `gql`'s widened throw, is the only one with any
residual exposure). The epic's AC1 file-count error is still uncorrected *in `epics.md` itself* — I recorded the
deviation in three artifacts but did not edit the epic, which is outside this story's file scope.

## Auto Run Result

Status: **done**

### Implemented change

The eight duplicated E2E helpers now live in exactly one place. `bp_front/e2e/support/api.ts` holds `BACKEND`,
`loginApi` and the generic `gql<T>` and imports nothing from `@playwright/test`; `bp_front/e2e/support/ui.ts` holds
`PASSWORD`, `uniqueUsername`, `registerViaUi`, `openListsViaMenu`, `createListAndOpen`, `addCategory` and `addItem`.
**Seven** spec files were rewired, not the four the epic's `Files:` line names — the count was re-measured at `e4c54dc`
(7/6/5/4/4/4/2/2) and the epic's AC1 is self-contradictory as written, since its `grep` clause is unsatisfiable at four
files. Net −513 spec lines against +137 module lines. No product code, no config, no dependency and no `bp_back/`
change. The `registrationEnabled` `toPass` workaround was preserved intact for Story 7.3 to delete.

### Files changed

- `bp_front/e2e/support/api.ts` — **new.** Pure `fetch`; runner-free by construction so Story 7.3 can converge
  `global-setup.ts` onto it.
- `bp_front/e2e/support/ui.ts` — **new.** The six UI helpers plus the shared rationale docblock the seven spec headers
  used to repeat.
- `bp_front/e2e/{account,admin,lists,navigation,sharing,shopping,item-editing}.spec.ts` — local declarations deleted,
  imports added. Both orphaned `BACKEND` consts removed; `type Page` dropped from `account.spec.ts` **and**
  `shopping.spec.ts`.
- `_bmad-output/implementation-artifacts/deferred-work.md` — two entries closed; the false "four copies" count corrected
  to five in three places; 11 out-of-charter candidates filed; seven review defers appended.
- `_bmad-output/project-context.md` — a rules-only block on where shared helpers live; the username-shape and
  "exactly one place" claims corrected at review.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story → `done`.

### Review findings

One pass, two reviewers (adversarial + edge-case), run blind on the diff. **6 patches applied** (4 medium, 2 low),
**7 items deferred** (2 medium, 5 low), **11 rejected**, **0 intent gaps**, **0 spec loopbacks**. The code half survived
untouched — every patch landed in the documentation half, which is the same distribution Story 7.1 saw. The most
valuable finding: **`auth.spec.ts` inlines the whole registration flow and was invisible to this story's measurement**,
because the ground truth was taken with `grep "function <helper>"` and an inlined copy has no `function` keyword. The
story corrected three prior documents for undercounting and then made a fourth undercount by the same mechanism.
Recorded rather than fixed — registration *is* what `auth.spec.ts` asserts — but its consequence is now on the ledger:
it is the one register-based spec with no `toPass` hardening at all.

### Verification performed

- `npx tsc -b` → exit **0**. `npm run lint` → exit **0**, zero output, linted set 48 → **50** files.
- AC1 grep: **0 re-declarations** of all eight helpers across every `*.spec.ts`, verified independently.
- AC7 byte-diffs: every extracted body diffed against its original at `e4c54dc`. `openListsViaMenu` 5/5,
  `createListAndOpen` 4/4, `addCategory` 4/4, `loginApi` 2/2 — **empty**. `addItem` and `gql` reduce to exactly their
  named divergence. **`await` census: 40 in the support module, 40 across the eight canonical bodies at baseline.**
- AC6 falsifiability: `openListsViaMenu` pointed at `menu-lists-BROKEN` → **10/10 red across 5 spec files on both
  projects**, every failure naming `support/ui.ts:54`; reverted and re-diffed byte-exact.
- AC4: all 46 `registerViaUi` call sites byte-identical to baseline; the 10 non-fixture sites pass the same page objects.
- Playwright: **five full runs.** At `retries: 0` — 104/104 once, **103/104 three times**; at `--retries=2` (CI) —
  green, 1 flaky healed. Every failure carried `alert: "Registration is disabled"`, and **the victim changed between
  runs**, which is the signature of the contended flag rather than an extraction defect; each victim passes 2/2 in
  isolation. Registration pressure is unchanged (46 call sites before and after).
- `grep` for `@ts-ignore`/`@ts-expect-error`/`eslint-disable` under `e2e/` → none. `git diff --stat` empty for
  `bp_back/`, `src/`, every tsconfig, `eslint.config.mjs`, `package.json` and `playwright.config.ts`.

### Residual risks

- **"104/104 at `retries: 0`" is a favourable-draw property, not a stable one.** Three of five full runs hit the
  catalogued `registrationEnabled` race. This is unchanged from baseline and is exactly what Story 7.3 deletes, but the
  number must not be quoted as though the suite were reliably green.
- **`gql` is the one divergence with real exposure.** The shared version adds `|| !body.data`, so `shopping.spec.ts`'s
  two seeding calls now throw on a response the old copy accepted. Both are object-returning mutations, so it should
  never fire — but "should never fire" is a claim about the backend, not a proof, and no run exercised that path.
- **`PASSWORD` sits in `ui.ts`, so a pure-API consumer must import the runner-importing module to get a credential** —
  the coupling the two-file split exists to prevent. Story 7.3 will hit it on the first line of `global-setup.ts`
  convergence. Deferred rather than moved, because the spec assigned it there explicitly.
- **None of the five new invariants has a machine gate.** All are prose in `project-context.md`; a one-line
  `import {expect}` in `api.ts` would pass both gates today. Two cheap enforcements were blocked by this story's own
  no-config-change boundary and are on the ledger.
- **Open question still for `md`, unchanged from Story 7.1:** AR-E7-12 asks for a fresh `epic-7-*` branch; this ran on
  `epic7-maintenance`. Not renamed unilaterally.
- **The four divergences need `md`'s sign-off** — AC2 requires them reported, not silently resolved. They are set out in
  the Divergence report above.
