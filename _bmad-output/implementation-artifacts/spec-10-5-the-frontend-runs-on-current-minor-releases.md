---
title: 'The frontend runs on current minor releases'
type: 'chore'
created: '2026-10-20'
status: 'done'
baseline_revision: 'ecb84fc3e5e3d1c005c0ebc5e6140b6ff3e0b8c5'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
  - '{project-root}/bp_front/CLAUDE.md'
warnings: ['oversized']
deferred:
  - summary: >-
      E2E FR60 ONE_TIME-removal test (shopping.spec.ts:549) is flaky on chromium; pre-existing, so a real regression on the subscription-delete path looks like the flake.
    evidence: |-
      toHaveCount(0) received 1 at :575. Control --repeat-each=15 x3: baseline ecb84fc 13/45 failed, bumped tree 3/45; failed in 2 of 3 full-suite runs on the bumped tree. Mechanism inferred (event lost if the click precedes subscription attach), not measured. Ledger: deferred-work.md "code review of 10-5-the-frontend-runs-on-current-minor-releases".
    location: >-
      bp_front/e2e/shopping.spec.ts:549
    severity: medium
  - summary: >-
      playwright.config.ts invariant comment says each toggle project collects "exactly one test per pattern in SERIALIZED"; since Story 9.4 it is 3 tests for 2 patterns.
    evidence: |-
      admin.spec.ts carries 1 @registration-toggle and 2 @serial-users tests; the 9.4 ledger row in the same comment already reads 3 / 3. Stale since 9.4, not touched by this story.
    location: >-
      bp_front/playwright.config.ts:165
    severity: low
  - summary: >-
      npm audit still reports 13 high / 1 critical, all in dev tooling (critical: shell-quote via dev deps).
    evidence: |-
      npm audit --omit=dev: 0 vulnerabilities. Full tree 39 -> 14 after this story's bumps; residue pre-existing.
    location: >-
      bp_front/package-lock.json
    severity: low
---

<intent-contract>

## Intent

**Problem:** Frontend dependencies trail their latest stable minors/patches, so the `vite-plugin-pwa` major (10.6) and the TypeScript 7 retry (10.7) would each land on a stale base instead of being the only variable.

**Approach:** Bump every frontend package below its next major to its latest stable minor/patch in one batch (pinned stay exact, ranged stay ranged with the floor raised to the new version), install with a plain `npm install`, gate on lint/build/codegen/full E2E, and hold (revert + record verbatim) only a package that cannot land cleanly.

## Boundaries & Constraints

**Always:** Re-measure on the day; prereleases (`-canary`, `-rc`, `-alpha`, …) excluded; `typescript` (6.0.3, Story 10.7) and `vite-plugin-pwa` (1.3.0, Story 10.6) explicitly left untouched; counts and versions measured in the pass, never quoted; E2E totals per project; bundle-size delta recorded (not a gate); docs naming a moved pinned version updated in the same commit; sprint status reconciled at close.

**Never:** `--legacy-peer-deps`, `--force`, `overrides`/`resolutions`, `.npmrc` change; hand-edited `src/__generated__/`; app source edits other than those a captured lint/type/test error forces (quote each in the spec); scratch files outside `.tmp/<session>/`.

**HOLD branch (per package):** if one package breaks `npm install`/lint/build/E2E and the break is not a forced-fix-sized change, revert that package's `package.json` line to byte-identical, re-lock, land the rest, and record the verbatim error in a new `## Deferred from: Story 10.5` section of `deferred-work.md`.

## I/O & Edge-Case Matrix

Inventory measured 2026-10-20 (`npm view <pkg> versions`, semver `maxSatisfying("^locked")`, prereleases filtered):

| Package | package.json | Locked | Target |
|---|---|---|---|
| `react` / `react-dom` | `19.2.8` pin | 19.2.8 | `19.3.1` |
| `@apollo/client` | `4.2.11` pin | 4.2.11 | `4.3.5` |
| `@mui/material` / `@mui/icons-material` | `9.3.1` pin | 9.3.1 | `9.5.0` |
| `graphql-ws` | `6.2.1` pin | 6.2.1 | `6.4.1` |
| `react-router-dom` | `^7.9.0` | 7.18.2 | `^7.18.4` |
| `@graphql-codegen/cli` | `7.2.0` pin | 7.2.0 | `7.4.6` |
| `@graphql-codegen/client-preset` | `6.1.3` pin | 6.1.3 | `6.2.3` |
| `@playwright/test` | `^1.60.0` | 1.62.1 | `^1.64.1` |
| `@types/node` | `26.2.0` pin | 26.2.0 | `26.6.5` |
| `@types/react` / `@types/react-dom` | `19.2.18` / `19.2.4` pin | same | `19.3.0` / `19.3.0` |
| `@vitejs/plugin-react` | `^6.0.5` | 6.0.5 | `^6.1.2` |
| `eslint` | `^10.8.1` | 10.8.1 | `^10.13.0` |
| `typescript-eslint` | `^8.50.0` | 8.67.0 | `^8.72.0` (peer `typescript >=4.8.4 <6.1.0` admits 6.0.3) |
| `globals` | `^17.7.0` | 17.11.0 | `^17.13.0` |
| `eslint-plugin-react-refresh` | `^0.5.3` | 0.5.4 | `^0.5.7` (no 0.6.x exists) |
| `vite` | `^8.2.1` | 8.2.1 | `^8.3.4` |
| already latest — no change | | | `@emotion/react` 11.14.0, `@emotion/styled` 11.14.1, `graphql` 17.0.2, `rxjs` 7.8.2, `@eslint/js` 10.0.1, `eslint-plugin-react-hooks` 7.1.1 |
| held by scope | | | `typescript` 6.0.3 (latest 7.0.2 → 10.7), `vite-plugin-pwa` 1.3.0 (latest 2.0.0 → 10.6) |
| moving tags (no file change) | `node:26-alpine`, `caddy:2-alpine`, mise `node = "26"` | | record the resolved version on rebuild (mise resolves node 26.12.0, the latest 26.x) |

</intent-contract>

## Code Map

- `bp_front/package.json` -- dependency lines; pinned vs ranged as in the matrix. `version` 0.20.0 must not move (shared app version with `gradle.properties`).
- `bp_front/package-lock.json` -- regenerated by plain `npm install`; no flags.
- `bp_front/Dockerfile` -- `node:26-alpine` build stage, `npm ci`; `caddy:2-alpine` serve stage. No edit; `docker compose up --build` pulls the moved tags.
- `bp_front/playwright.config.ts` -- four projects (`chromium`, `mobile`, `registration-toggle-chromium`, `registration-toggle-mobile`); invariant: each toggle project collects one test per `SERIALIZED` tag, viewport columns equal. Measure with `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`; record totals + per-project skip split in the spec, no config edit needed. `npx playwright install chromium` after the bump.
- E2E coverage for the Apollo/`graphql-ws` AC (already in the suite): login/logout `e2e/auth.spec.ts:8`; silent refresh = any `page.reload()` on an authed page (`e2e/item-editing.spec.ts:111`, `e2e/lists.spec.ts:520`); mutation + live subscription across two members `e2e/shopping.spec.ts:195` (FR52) and `:1140` (FR68); logout socket teardown order is in `src/` auth/apollo code, exercised by the logout flow.
- `bp_front/codegen.ts`, `bp_front/src/__generated__/` -- `npm run generate` with fresh admin token against :2080; output must be byte-identical or committed + explained (client-preset moves a minor).
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md:257` -- names `@mui/icons-material` 9.3.1 (`package.json:20`) -> 9.5.0.
- Not edited (precedent 10.3/10.4, owned by 10.8): `ARCHITECTURE-SPINE.md` dated pin table, `architecture.md:728` historical validation, `docs/*`, `review-currency.md`. `AGENTS.md`, `bp_front/CLAUDE.md`, root `CLAUDE.md` name no moved frontend version (grep-verified).
- `_bmad-output/implementation-artifacts/sprint-status.yaml:134` -- `10-5-the-frontend-runs-on-current-minor-releases`.

## Tasks & Acceptance

**Execution:**
- `bp_front/` -- before bumping, record baseline `npm run build` asset sizes (vite output) into `.tmp/<session>/`.
- `bp_front/package.json`, `bp_front/package-lock.json` -- apply the matrix targets, plain `npm install`; then `npx playwright install chromium`.
- `bp_front/src/**` -- only edits a captured lint/type error forces; quote each error in the spec.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md` -- version line.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- reconcile 10-5.
- On HOLD only: `deferred-work.md` -- `## Deferred from: Story 10.5` with the verbatim error.

**Acceptance Criteria:**
- Given the bumps, when `npm install` runs with no flags, then it exits 0, `package.json` has no `overrides`/`resolutions`, `.npmrc` is untouched, and `npm ls` reports every matrix target installed.
- Given the bumped tree, when `npm run lint` and `npm run build` run, then both exit 0 and the bundle-size delta vs baseline is recorded.
- Given the bumped stack rebuilt (`docker compose up --build -d`), when `npm run generate` runs with a fresh admin token, then `git status --short src/__generated__/` is empty or the diff is committed and explained.
- Given the bumped stack, when `npm run test:e2e` runs, then all four projects pass with 0 failed and the per-project collected counts satisfy the `playwright.config.ts` invariant (toggle projects = one per `SERIALIZED` tag, viewport columns equal), totals measured.
- Given the story closes, then `git diff --stat` shows no `typescript`/`vite-plugin-pwa` line moved and no scratch file tracked.

## Implementation Record

**Inventory re-measured 2026-10-20** (`npm view <pkg>@^<locked> version`, prereleases filtered, plus `dist-tags.latest`):
every matrix target confirmed unchanged; no newer stable appeared. The six "already latest" packages and the two
scope holds (`typescript` 6.0.3 / latest 7.0.2, `vite-plugin-pwa` 1.3.0 / latest 2.0.0) confirmed. Note: a naive
`npm view react@^19.2.8 version` lists `19.2.9` last because it was published 7 minutes after `19.3.1`
(2026-10-14); the semver max is `19.3.1`.

**LAND, all 19 lines, no HOLD.** Plain `npm install` exit 0 (added 30, removed 5, changed 98). `npm ls --depth=0`
shows every matrix target installed; `typescript@6.0.3`, `vite-plugin-pwa@1.3.0` unmoved. No `overrides`/`resolutions`,
no `.npmrc`. `npx playwright install chromium` fetched Chrome Headless Shell 156.0.8078.4 (playwright build v1248).
`npm audit` (not a gate): 39 vulnerabilities (38 high, 1 critical) before -> 14 (13 high, 1 critical) after.

**No `src/` edits forced:** `npm run lint` and `npm run build` (`tsc -b && vite build`) both exit 0 on the first run.

**Bundle size (vite output, not a gate):**

| Asset | Before (vite 8.2.1) | After (vite 8.3.4) | Delta |
|---|---|---|---|
| `assets/index-*.js` | 826.38 kB / gzip 246.32 kB | 875.91 kB / gzip 260.91 kB | +49.53 kB (+6.0%) / gzip +14.59 kB (+5.9%) |
| `assets/workbox-window.prod.es5-*.js` | 5.65 kB / gzip 2.20 kB | 5.65 kB / gzip 2.20 kB | 0 |
| `index.html` | 0.76 kB / gzip 0.48 kB | 0.76 kB / gzip 0.49 kB | +0.01 gzip |
| PWA precache | 8 entries (813.29 KiB) | 8 entries (861.66 KiB) | +48.37 KiB |

**Moving tags (rebuilt with `docker compose build --pull bp_front`):** `node:26-alpine` resolved v26.7.0 locally
before the pull -> v26.12.0 after; `caddy:2-alpine` v2.11.4 -> v2.11.7; mise `node = "26"` resolves v26.12.0.
No file change.

**Codegen** (`npm run generate`, fresh admin token, rebuilt stack): one-line diff, kept (not reverted):
`src/__generated__/index.ts` gains a leading `/* eslint-disable */`. `@graphql-codegen/client-preset` 6.2.x now
adds that header to the barrel file too; `fragment-masking.ts`, `gql.ts` and `graphql.ts` already had it. No type or
document change; lint still exits 0 afterwards.

**E2E** (`npm run test:e2e` against the rebuilt :2080 stack): collection 312 = 153 / 153 / 3 / 3
(`chromium` / `mobile` / `registration-toggle-chromium` / `registration-toggle-mobile`). Viewport columns are equal.
Each toggle project collects the 1 `@registration-toggle` and 2 `@serial-users` tests (one test per tag occurrence
across the two `SERIALIZED` patterns). Results: 283 passed, 29 skipped, 0 failed, 0 flaky. Per project: `chromium`
125 passed / 28 skipped; `mobile` 152 passed / 1 skipped; each toggle project 3 passed / 0 skipped.

**Orchestrator re-verification (pre-existing E2E flake found):** `npm ci`, `npm run lint`, `npm run build` (same
875.91 kB / 861.66 KiB) and `npm run generate` (same one-line `index.ts` diff) reproduced. A full `npm run test:e2e`
re-run failed 2: `[chromium] shopping.spec.ts:549` "FR60 — activating the row of a ONE_TIME item removes it via the
SAVED+deleted subscription" (`toHaveCount(0)` received 1 at `:575`) and `[mobile] shopping.spec.ts:476` "FR60 — a touch
that becomes a scroll never checks an item…" (6 toggle runs "did not run" as a consequence of the chain). `:476` then
passed 5/5 isolated. Control for `:549`, chromium, `--repeat-each=15` three times each, image rebuilt per tree:
**baseline `ecb84fc` (pre-bump, Playwright 1.62.1): 9 + 2 + 2 = 13/45 failed; bumped tree (1.64.1): 2 + 1 + 0 = 3/45
failed.** The flake predates this story and the bumps do not worsen it. Mechanism not measured; recorded in the ledger.
A second full re-run failed `:549` once more; a third full run was green: **283 passed, 29 skipped, 0 failed, 0 flaky**
(312 collected), and each toggle project alone (`--no-deps`, one at a time) 3/3.

## Review Triage Log

### 2026-10-20 — Review pass
- verdicts: 25 findings — high 0, medium 1, low 9, false 15, maybe-false 0
- findings:
  - `[medium]` `[defer]` (verification-gap) FR60 `:549` flaky; the only check on the subscription-delete path the Apollo/graphql-ws bumps touch — pre-existing (baseline 13/45 vs bumped 3/45); fixing needs a mechanism investigation outside a bump story; ledger entry + frontmatter `deferred`.
  - `[low]` `[patch]` (verification-gap other) spec says the flake is "recorded in the ledger" but `deferred-work.md` was unchanged — added `## Deferred from: code review of 10-5-…` (applied by the orchestrator directly: docs-only, no code re-verification needed).
  - `[low]` `[patch]` (verification-gap other) `[mobile] :476` single failure untracked — recorded in the same ledger entry as a single observation.
  - `[false]` `[reject]` (intent) behavioural ACs evidenced only by prose, no test edits — a bump story changes no behaviour; the existing E2E suite is the gate and ran green (283/29/0); the orchestrator re-ran it independently.
  - `[medium]` `[defer]` (intent) E2E gate green only on a third run — same root cause as the `:549` flake row.
  - `[false]` `[reject]` (intent) image-tag inventory not in diff — moving tags by design (`node:26-alpine`, `caddy:2-alpine`, mise `26`); resolved versions recorded.
  - `[false]` `[reject]` (intent) floor raising not uniform (`eslint-plugin-react-hooks`, `@eslint/js`) — the rule applies to packages that move; both are already latest and listed "no change" in the matrix.
  - `[false]` `[reject]` (intent) codegen change could be hand-edited — the orchestrator re-ran `npm run generate` independently and got the identical one-line diff.
  - `[low]` `[reject]` (intent) dated docs (ARCHITECTURE-SPINE, architecture.md, docs/*) not updated — dated snapshots / historical records, owned by Story 10.8; same call as 10.3/10.4.
  - `[false]` `[reject]` (intent) sprint status `review` not `done` — set to `done` at finalize.
  - `[low]` `[patch]` (blind) flake has no ledger entry — same as the verification-gap other row; patched.
  - `[medium]` `[defer]` (blind) E2E AC passed on re-run with no stated policy — same root cause as the `:549` row.
  - `[false]` `[reject]` (blind) `eslint-plugin-react-hooks` floor not raised — same refutation as the intent floor row.
  - `[low]` `[reject]` (blind) lockfile root `version` 0.16.0 -> 0.20.0 unrecorded — true (lock had drifted from `package.json`; npm re-synced it), harmless correction; `package.json` `version` did not move.
  - `[low]` `[reject]` (blind) lockfile not deduplicated (`@whatwg-node/promise-helpers` nested copies) — dev-only codegen tree, npm's own resolution; `npm dedupe` is extra churn with no named harm.
  - `[low]` `[reject]` (blind) +6% bundle not attributed to a package — not a gate per the epic; 10.6 compares against this story's recorded post-bump numbers, which exist.
  - `[false]` `[reject]` (blind) no changelog/deprecation review — lint, `tsc -b` and 283 E2E runs pass; no named deprecation; reviewer cites none.
  - `[false]` `[reject]` (blind) skip counts unexplained / not compared to baseline — 29 skipped equals Stories 10.2/10.3/10.4 (the mobile-only narrow-viewport guards + 1 above-breakpoint test, documented in `playwright.config.ts`).
  - `[low]` `[defer]` (blind) audit residue 13 high / 1 critical — `npm audit --omit=dev` = 0; dev-only (critical `shell-quote`), pre-existing, reduced 39 -> 14 by this story.
  - `[false]` `[reject]` (blind) Verification section incomplete — fix is a spec edit; every listed step was in fact performed and recorded.
  - `[false]` `[reject]` (blind) new transitive `engines: node >=22.15.0` unrecorded — all three runtimes (mise, Docker build, local) are Node 26; no reachable failure.
  - `[false]` `[reject]` (blind) rolldown android optional binding unreviewed — optional platform binary, never installed on linux-x64/alpine.
  - `[false]` `[reject]` (blind) generated `index.ts` lacks trailing newline — codegen output, must not be hand-edited; no formatter runs on `src/__generated__/`.
  - `[false]` `[reject]` (blind) spec/sprint status won't flip at close — finalize sets both to `done`.
  - `[low]` `[defer]` (blind + edge) toggle invariant "one per SERIALIZED tag" vs 3 tests — the spec Code Map wording is a spec edit (reject), but the same stale wording lives in `playwright.config.ts:165` since Story 9.4 (pre-existing) — deferred.

## Verification

**Commands:**
- `cd bp_front && npm install && npm ls --depth=0` -- expected: exit 0, targets installed
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0
- `cd bp_front && npm run generate && git status --short src/__generated__/` -- expected: empty (or explained)
- `cd bp_front && npm run test:e2e` -- expected: 0 failed on all four projects

## Auto Run Result

Status: done (LAND, no HOLD)

- **Change:** every frontend dependency below its next major moved to its latest stable minor/patch, re-measured 2026-10-20 (19 `package.json` lines: React/React DOM 19.3.1, `@apollo/client` 4.3.5, MUI 9.5.0, `graphql-ws` 6.4.1, codegen cli 7.4.6 / client-preset 6.2.3, Playwright ^1.64.1, Vite ^8.3.4, eslint ^10.13.0, `typescript-eslint` ^8.72.0, `@types/*`, react-router-dom, globals, react-refresh, plugin-react). `typescript` 6.0.3 and `vite-plugin-pwa` 1.3.0 untouched (10.7 / 10.6). No `src/` edits forced.
- **Files:** `bp_front/package.json`, `bp_front/package-lock.json` (bumps); `bp_front/src/__generated__/index.ts` (codegen header `/* eslint-disable */` from client-preset 6.2.x); `ux-epic-8/DESIGN.md` (`@mui/icons-material` 9.5.0); `deferred-work.md` (10.5 review section: FR60 flake); `sprint-status.yaml` (10-5 done); this spec.
- **Review:** 25 findings — 3 patch rows (one ledger entry: low x3), 3 deferred groups (FR60 flake, medium; stale toggle-invariant comment, low; dev-only audit residue, low), 4 low rejected with reasons, 15 false. See the triage log.
- **Follow-up review recommended:** false — patched 0 high, 0 medium, 3 low (docs-only ledger entry).
- **Verification:** `npm ci` exit 0; `npm ls` all targets; `npm run lint` / `npm run build` exit 0; bundle 826.38 -> 875.91 kB (gzip 246.32 -> 260.91), precache 813.29 -> 861.66 KiB; `npm run generate` -> one-line `index.ts` diff, reproduced independently; images rebuilt with `--pull` (node v26.12.0, caddy v2.11.7); full E2E on the final tree 283 passed, 29 skipped, 0 failed (312 = 153/153/3/3) after two runs that each failed the pre-existing `:549` flake; toggle projects 3/3 each alone.
- **Residual risk:** the subscription-delete path's only E2E check is flaky (pre-existing, ledgered); a regression there would currently look like the flake.
