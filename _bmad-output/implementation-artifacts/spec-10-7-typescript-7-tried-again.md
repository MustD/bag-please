---
title: 'TypeScript 7, tried again'
type: 'chore'
created: '2026-10-20'
status: 'done'
baseline_revision: '0b7a89685edbf7f0d9e404e41ed97222375af722'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
  - '{project-root}/bp_front/CLAUDE.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The TypeScript 7 re-check has no scheduled owner; only the ledger section carries it.
    evidence: |-
      The epic-7 action_items row in sprint-status.yaml was closed by md's decision on 2026-09-15 and stays closed;
      Story 10.7 closes done as a HOLD, so nothing in the workflow re-reads the "Deferred from: Story 7.10" section
      unless a future epic schedules it. Reopening the row reverses an md ruling, so it is md's call.
    location: >-
      _bmad-output/implementation-artifacts/sprint-status.yaml:141-147
    severity: low
---

<intent-contract>

## Intent

**Problem:** `typescript` is pinned at `6.0.3` while `7.0.2` is latest. The reason for the hold (`typescript-eslint` refuses TS 7) was measured on 2026-08-15 and then archived on 2026-09-15. Nobody has checked it since.

**Approach:** Re-measure the registry and the `typescript-eslint` peer range. If 7.x is admitted, LAND with a plain install. Otherwise (expected; the planning measurement on 2026-10-20 found `typescript-eslint` 8.72.0 at peer `>=4.8.4 <6.1.0`) run a throwaway in-tree TS 7 install, capture the install, lint and `tsc -b --force` evidence verbatim, restore the tree byte-identical, and record the refreshed hold as the single live Story 7.10 ledger section.

## Boundaries & Constraints

**Always:** record every count, version and exit code measured in this pass. Check the support signal as a disjunction (`typescript-eslint` `latest`/`canary` peer ranges, dist-tags, a dropped or optional `typescript` peer, a native-compiler peer). The behavioural check decides: does `npm run lint` lint a non-zero number of files? Scratch goes under `.tmp/30eb32d5/`. Reconcile sprint status at close.

**Never:** leave `--legacy-peer-deps`, `--force`, `overrides`/`resolutions` or an `.npmrc` change in the tree. Swap or alias the lint stack (no dual-TypeScript `npm:@typescript/typescript6` alias, AR-E10-4). Edit `src/`, `e2e/`, any `tsconfig*.json` or `routing/` on the HOLD branch. Rewrite bytes of `deferred-work-archive.md` (frozen history). Move any other dependency.

**HOLD restore:** `git checkout -- bp_front/package.json bp_front/package-lock.json`, `npm ci`, then `git status --short` is empty apart from this story's planned doc edits, and `npx tsc --version` prints `Version 6.0.3`.

## I/O & Edge-Case Matrix

| Scenario | State | Expected |
|---|---|---|
| Peer admits 7.x (LAND) | a `typescript-eslint` stable whose peer or runtime accepts 7.x | bump `typescript` (exact pin) plus the enabling `typescript-eslint` if needed; lint/build/full E2E pass; tsconfig edits only where a quoted diagnostic forces them; `src/__generated__` stays excluded |
| Peer excludes 7.x (HOLD) | `<6.1.0` on latest and canary | throwaway install, evidence captured, tree restored |
| Plain `npm install typescript@7.0.2` exits 0 with an ERESOLVE warning (7.10 shape) | npm treats an explicit target as authoritative | record the warning verbatim with exit 0. `--legacy-peer-deps` is used only if the plain install fails, and that is recorded |
| `tsc -b --force` under TS 7 exits non-zero | new diagnostic | record verbatim; ledger says the code is no longer TS-7-clean |

</intent-contract>

## Code Map

- `bp_front/package.json:42-43` -- `"typescript": "6.0.3"` (exact pin), `"typescript-eslint": "^8.72.0"` (ranged). `version` 0.20.0 does not move.
- `bp_front/package-lock.json` -- `node_modules/typescript-eslint` locked `8.72.0`.
- `bp_front/package.json:9,12` -- `build` = `tsc -b && vite build`, `lint` = `eslint .`.
- `bp_front/tsconfig.json` (references app/node/e2e), `bp_front/tsconfig.app.json` (`exclude: ["src/__generated__"]`) -- read-only on HOLD.
- `bp_front/Dockerfile:7-12` -- `node:26-alpine`, `npm ci`, `npm run build` (the musl path; not exercised on HOLD).
- `_bmad-output/implementation-artifacts/deferred-work-archive.md:1026-1175` -- the original 7.10 section (2026-08-15 evidence, re-check trigger, rejected dual-install). `:3670` -- its "Closed by decision (md, 2026-09-15)" copy. Read-only.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- the live ledger. No 7.10 section exists today. Header rule: new entries are appended.
- `AGENTS.md:60-63` -- "TypeScript is held at 6.x … Measurements: `deferred-work.md`, 'Deferred from: Story 7.10'". This pointer is dangling today and resolves once the section exists. No version line changes on HOLD.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:136` -- `10-7-typescript-7-tried-again: backlog`. `:141-147` -- the epic-7 action item (closed by decision).
- Planning measurement (2026-10-20): `npm view typescript version` -> `7.0.2`. Dist-tags: `latest` 7.0.2, `next` `7.1.0-dev.20261020.3`, `rc` `7.0.1-rc`. `typescript-eslint` `latest` 8.72.0 and `canary` 8.72.1-alpha.6 both peer `{"eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0"}`. `rc-v8` `8.0.0-alpha.62`. The step-03 pass re-measures all of these.

## Tasks & Acceptance

**Execution:**
- `.tmp/30eb32d5/` -- re-run `npm view typescript version`, `npm view typescript dist-tags --json`, `npm view typescript-eslint peerDependencies --json`, `npm view typescript-eslint dist-tags --json`, canary peers. Save the outputs verbatim. This picks the branch.
- `bp_front/` (throwaway, HOLD) -- `npm install typescript@<latest 7.x>` and capture stdout/stderr + exit code; `npm run lint` and capture output + exit code; `npx tsc --version`; `rm -rf node_modules/.tmp && npx tsc -b tsconfig.json --force` and capture exit code + diagnostics; the per-project `tsc -p tsconfig.{app,node,e2e}.json --noEmit` exit codes; the exported `require('typescript')` keys. Then restore per the HOLD restore rule.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- append one `## Deferred from: Story 7.10 — TypeScript 6 → 7 (2026-08-15; re-measured by Story 10.7, 2026-10-20)` section. It holds the 10.7 measurements verbatim, the still-standing re-check trigger and the rejected dual-install, and points to the archive for the 2026-08-15 evidence.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `10-7-typescript-7-tried-again` -> `done` at close.
- LAND only: `bp_front/package.json`/lock, version lines in `AGENTS.md:60-63`, `bp_front/CLAUDE.md` if they name 6.x; lint/build/full E2E + `docker compose build bp_front`.

**Acceptance Criteria:**
- Given the re-measurement, when the spec is read, then `npm view typescript version` and `npm view typescript-eslint peerDependencies` appear verbatim, dated 2026-10-20.
- Given HOLD, when the throwaway install runs, then the install output, the `npm run lint` failure and the `tsc -b --force` exit code and diagnostics are recorded verbatim.
- Given HOLD restore, when it completes, then `git diff --quiet bp_front` holds, `npx tsc --version` prints `Version 6.0.3`, and `npm run lint` and `npm run build` exit 0.
- Given the ledger, when `grep -c "^## Deferred from: Story 7.10" deferred-work.md` runs, then it prints `1`, `git diff --quiet deferred-work-archive.md` holds, and the `AGENTS.md` pointer resolves to that section.

## Spec Change Log

## Review Triage Log

### 2026-10-20 — Review pass
- verdicts: 23 findings — high 0, medium 0, low 13, false 10, maybe-false 0
- findings:
  - `[low]` `[patch]` (edge) the restored-tree "68 files" lint count has no captured source — re-measured at review (`eslint . --format json` → 68, exit 0); the ledger now names that method.
  - `[false]` `[reject]` (edge) the restore exit codes for `npm ci`/lint/build are asserted but never captured — the orchestrator's step-03 verification re-ran lint and build on the restored tree (exit 0 each), and again after the patches; `npm ci` completed (restore-ci.txt ends at the audit trailer).
  - `[low]` `[patch]` (edge) the install block folds seven ERESOLVE blocks into "(x7 more)" while labelled verbatim — label now says repeated blocks and the trailer are condensed.
  - `[low]` `[patch]` (edge) the re-check's "lints a non-zero number of files" has no defined measurement — same root cause as the 68-count row; the trigger now points to the stated method.
  - `[false]` `[reject]` (blind) spec status `in-review` vs sprint `done` — finalize sets the spec to `done` before the single commit.
  - `[low]` `[reject]` (blind) AC1 says the verbatim outputs appear "when the spec is read", but they live in the ledger — fix edits this build's spec (rejected by rule); the values are also summarized in Auto Run Result.
  - `[low]` `[defer]` (blind) the re-check has no scheduled owner — pre-existing since md closed the epic-7 action row by decision on 2026-09-15; reopening it is md's ruling. Added to frontmatter `deferred`.
  - `[low]` `[patch]` (blind) no recorded method for the 68-file count — same root cause as the edge row; patched there.
  - `[false]` `[reject]` (blind) `npm run build` was never run under TS 7 — `npm run build` is `tsc -b && vite build`; `tsc -b --force` was measured (exit 0) and Vite 8 transforms TS without the `typescript` package, so the TS version does not enter `vite build`.
  - `[low]` `[reject]` (blind) the musl image build under TS 7 was skipped though it could run — not required on the HOLD branch, stated honestly in the ledger as unexercised; closing it means building a throwaway image, not a direct correction.
  - `[low]` `[reject]` (blind) TS 7.1 (beta/next) was not tried — prereleases are never candidates (epic rule); a speculative measurement is extra work, not a correction.
  - `[low]` `[patch]` (blind) the install transcript is not verbatim — same root cause as the edge row; patched there.
  - `[low]` `[reject]` (blind) the new ledger entry exceeds the header's three-key template — it keeps the shape of the original 2026-08-15 Story 7.10 section it continues; restructuring is a rewrite, not a direct correction.
  - `[low]` `[patch]` (blind) `epic-10-context.md` still lists 10.7 as pending and is read by 10.8 — Goal and Stories list updated (10.7 done, HOLD at 6.0.3). The "departure undocumented" half is false: Design Notes record it.
  - `[low]` `[reject]` (blind) AC4's AGENTS.md pointer has no verification command — fix edits this build's spec (rejected by rule); the verification-gap layer confirmed `AGENTS.md:63` resolves.
  - `[low]` `[reject]` (blind) scratch dir uses a truncated session id and has no cleanup note — same convention as 10.6 (`.tmp/bf9ff166/`); it is removed at session end per CLAUDE.md.
  - `[false]` `[reject]` (blind) install package breakdown and the `oversized` warning are unexplained — `oversized` is the workflow's machine warning for specs over 1600 tokens; the platform package that resolved is named, and no AC asks for a full breakdown.
  - `[false]` `[reject]` (intent) appended section instead of in-place update — the entry no longer exists in `deferred-work.md` (archived 2026-09-15); Design Notes record why the single live section is the in-place equivalent.
  - `[false]` `[reject]` (intent) plain install instead of the forced `--legacy-peer-deps` one, so no resolution error captured — the plain install exited 0 with ERESOLVE warnings, recorded verbatim; the flag was not needed, as 7.10 also found.
  - `[false]` `[reject]` (intent) `git diff --quiet bp_front` instead of `git status --short` empty — the only other changes are this story's planned doc edits; `bp_front` is byte-identical.
  - `[false]` `[reject]` (intent) spec/sprint status mismatch — duplicate of the blind row; finalize sets `done`.
  - `[false]` `[reject]` (intent) `typescript-eslint` snapshot 8.71.2 vs measured 8.72.0 — a fact change (10.5 installed 8.72.0), same peer range; the measured value is recorded.
  - `[false]` `[reject]` (intent) scratch dir left on disk — removed at session end per CLAUDE.md.

## Design Notes

**Where "update the 7.10 entry in place" lands.** The AC assumes the 7.10 entry is still in `deferred-work.md`. It is not: md archived it by decision on 2026-09-15, and the archive is a frozen record. The ledger rule ("anything deferred must be recorded HERE") and the existing `AGENTS.md` pointer both name `deferred-work.md`. So the refreshed hold becomes the one live `Deferred from: Story 7.10` section there, and the archive copy stays as history. That gives no duplicate in the ledger and no rewrite of history. The new section keeps only the facts that still hold, re-measured, and points to the archive for the August evidence instead of copying it.

**The E2E gate on HOLD is not applicable.** The tree is restored byte-identical, so no product code ships. Restored-tree lint and build are the sanity check.

## Verification

**Commands:**
- `git diff --quiet bp_front && echo clean` -- expected: `clean`
- `cd bp_front && npx tsc --version && npm run lint && npm run build` -- expected: `Version 6.0.3`, exit 0
- `grep -c "^## Deferred from: Story 7.10" _bmad-output/implementation-artifacts/deferred-work.md` -- expected: `1`
- `git diff --quiet _bmad-output/implementation-artifacts/deferred-work-archive.md && echo frozen` -- expected: `frozen`

## Auto Run Result

Status: done (HOLD at `typescript` 6.0.3, no LAND)

- **Change:** re-measured 2026-10-20: `npm view typescript version` → `7.0.2`; `npm view typescript-eslint peerDependencies` → `{"eslint": "^8.57.0 || ^9.0.0 || ^10.0.0", "typescript": ">=4.8.4 <6.1.0"}` (latest 8.72.0; canary 8.72.1-alpha.6 identical). Throwaway in-tree `npm install typescript@7.0.2` exited 0 with ERESOLVE warnings (no `--legacy-peer-deps` needed); `npm run lint` exit 2, "typescript-eslint does not support TS 7.0", zero files linted; `tsc -b tsconfig.json --force` under 7.0.2 exit 0, no diagnostics. Tree restored (`git checkout` + `npm ci`), `tsc` 6.0.3.
- **Files:**
  - `deferred-work.md`: one live `Deferred from: Story 7.10` section with the 10.7 re-measurement (the archive stays byte-identical); resolves the `AGENTS.md:63` pointer.
  - `sprint-status.yaml`: 10-7 → done.
  - `epic-10-context.md`: 10.7 marked done (review patch).
  - this spec.
- **Review:** 23 findings. 3 patch entries (all low): the lint-count method, the condensed-block label, and the epic context. 1 deferred: the re-check has no owner (low). 19 rejected, each with its reason in the Review Triage Log.
- **Follow-up review recommended:** false (patched: high 0, medium 0, low 3).
- **Verification:**
  - `git diff --quiet bp_front` holds.
  - `npx tsc --version` → 6.0.3.
  - `npm run lint` and `npm run build` exit 0.
  - The lint covers 68 files.
  - The Story 7.10 heading count is 1.
  - The archive is unchanged.
  - E2E was not run: on HOLD no product code ships.
- **Residual risks:**
  - The Alpine/musl image has never been built under TS 7.
  - Support is expected at TS >=7.1, which has not been measured.
  - Nothing schedules the re-check (deferred).
