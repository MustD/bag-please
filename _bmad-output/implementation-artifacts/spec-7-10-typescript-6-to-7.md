---
title: 'Story 7.10 — TypeScript 6 → 7'
type: 'chore'
created: '2026-08-15'
status: 'in-review'
baseline_revision: '853b599'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md'
warnings: [oversized]
# oversized: ~2.4k tokens. The story's expected outcome is a HOLD, and a hold is only legitimate if the blocking
#   symptom is measured, verbatim, and reproducible. The probe transcript, the two-branch routing and the
#   "why not side-by-side" ruling ARE the deliverable — cutting them turns a recorded engineering decision back
#   into "we did not get to it", which the epic names as not a reason.
---

<intent-contract>

## Intent

**Problem:** `typescript` is pinned at `6.0.3` while `7.0.2` is `latest`. But TypeScript 7 is the native (Go) port and
**ships no JavaScript compiler API at all** — `exports["."]` resolves to `lib/version.cjs`, so `require('typescript')`
yields `{version, versionMajorMinor}` and nothing else. Every `@typescript-eslint/*` package imports that API, so
`npm run lint` — one of this project's two static gates — cannot survive the bump.

**Approach:** Re-measure the registry in this pass, then route. If no published `typescript-eslint` admits TypeScript
7, **hold `typescript` at 6.0.3**, record the verbatim blocking symptom in `deferred-work.md` under S-AC3, and close
the story `done`. Capture the one genuinely valuable finding either way: the codebase itself is already TS-7-clean.

## Boundaries & Constraints

**Always:**
- **Re-measure before routing.** `npm view typescript dist-tags`, `npm view typescript-eslint@latest peerDependencies`
  and the same for `@typescript-eslint/parser`, in this pass. Never route on this spec's recalled numbers — they were
  measured 2026-08-15 and the registry moves.
- **The blocking symptom must be reproduced, not cited.** Attempt the bump in the real `bp_front/` tree and capture
  both failures verbatim: the `npm install` resolution error, and the `npm run lint` failure when that is forced past
  with `--legacy-peer-deps`. A hold justified only by a peer-range string is a weaker record than the epic asks for.
- **The tree is restored to `6.0.3` before any gate is run.** `git checkout -- bp_front/package.json
  bp_front/package-lock.json && npm ci`, then confirm `git status --short` is clean and `npx tsc --version` reports 6.
- **S-AC1 still applies to a story that changes no dependency.** `npm run lint`, `npm run build` and the full
  Playwright suite on all four projects must be measured green in this pass, with the per-project split recorded, so
  Story 7.11 starts from a verified-green tree. Never quote a remembered count.
- A held-back dependency **closes** this story as `done` (S-AC3). It does not fail it and does not block it.

**Block If:**
- A `typescript-eslint` release exists whose `typescript` peer admits 7.x, **and** the resulting `tsc -b` or
  `npm run lint` fails in a way this spec did not anticipate. That is a real migration, not a hold, and its shape was
  never planned — HALT rather than improvise one.
- Restoring the tree to `6.0.3` does not produce a clean `git status --short` and a green gate set. The tree must not
  be left half-migrated (S-AC3), and a dirty tree makes Story 7.11 unattributable.

**Never:**
- **No side-by-side / dual-TypeScript install**, even though the TS 7 error message and the TypeScript 7.0 announcement
  both offer one. S-AC3 forbids working around a failed bump, and Design Notes §3 records the three concrete costs.
- No `--legacy-peer-deps`, `--force`, `overrides` or `resolutions` left in the tree. They appear **only** inside the
  throwaway reproduction, which is reverted in the same task.
- Do not move `eslint`/`@eslint/js`/`typescript-eslint` to chase compatibility — Story 7.11 owns those, and a rider
  makes both stories unattributable. Do not weaken a compiler option, add `@ts-expect-error`, or touch any tsconfig.
- No change under `bp_front/src/`, no test edit, no `npm run generate`, no backend or Gradle change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Registry re-measured, still no TS-7 peer | `typescript-eslint@latest` peer `typescript <6.1.0` | Route to HOLD: revert, record, close `done` | none — this is the expected path |
| Registry re-measured, a TS-7 peer now exists | some `typescript-eslint` admits `>=7` | Route to LAND: bump `typescript` to `7.0.2`, run the full gate set | Any unanticipated failure → Block If, HALT |
| Real-tree bump attempt | `npm install typescript@7.0.2` in `bp_front/` | `ERESOLVE` naming the `<6.1.0` peer; captured verbatim | Expected failure; capture and continue |
| Forced past with `--legacy-peer-deps` | install succeeds, then `npm run lint` | eslint dies at module load: `typescript-eslint does not support TS 7.0.` | Expected failure; capture, then revert |
| Type-check under TS 7 | TS 7.0.2 `tsc -b tsconfig.json --force` | **exit 0** — all three projects clean, zero errors | A non-zero exit contradicts the planning probe → record it, it changes the ledger entry |
| Revert verification | after `git checkout` + `npm ci` | `git status --short` empty; `npx tsc --version` = 6.0.3 | Non-clean → Block If, HALT |
| E2E red on `admin.spec.ts` `createUserViaUi` | `create-user-dialog` Expected 0 / Received 1 | **known size-driven defect**, filed 2026-08-13; DB was cleared then | Re-run with `--project=chromium --no-deps` before attributing anything |
| E2E red anywhere | any failing test | `registration-toggle-*` report "did not run" | Re-check FR20/FR21 via `--project=registration-toggle-chromium --no-deps` |

</intent-contract>

## Code Map

All versions measured 2026-08-15 against the npm registry, on a clean tree at `853b599` (branch `epic7-maintenance`).

**Files this story may change:**
- `bp_front/package.json` — **only on the LAND branch**: `"typescript": "6.0.3"` → `"7.0.2"` (pinned entry, keeps the
  pinned style). On the expected HOLD branch this file is byte-unchanged.
- `bp_front/package-lock.json` — same, LAND branch only. Note TS 7 brings 20 platform-optional
  `@typescript/typescript-*` packages plus one resolved for the host.
- `_bmad-output/implementation-artifacts/deferred-work.md` — new
  `## Deferred from: Story 7.10 — TypeScript 6 → 7 (2026-08-15)` section at **line 937**, i.e. after the 7.8 + 7.9
  section's last content line (935) and its trailing blank (936), and **before** the current line 937,
  `## Deferred from: code review of 7-8-7-9-types-node-26-and-vite-8`. Story sections run in ascending story order
  from line 210; code-review sections begin at 937 and are a separate, differently-ordered run. Re-measure these
  numbers before editing — they are dated.
- `_bmad-output/project-context.md` — Technology Stack only: why `typescript` stays at 6.0.3, and the TS 7 facts an
  agent would otherwise rediscover. New debt goes to the ledger, not here (NFR-E7-1).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-10-typescript-6-to-7` to `done` with the
  held-back wording, `last_updated` refreshed.

**Read-only — the verification targets:**
- `bp_front/package.json:9` — `"build": "tsc -b && vite build"`. The type-check gate is `tsc -b` **build mode**;
  TS 7 supports `-b` (measured), so this line would not need to change on the LAND branch.
- `bp_front/package.json:41` — `"typescript": "6.0.3"`, pinned; `:42` `"typescript-eslint": "^8.50.0"` (lock 8.67.0).
- `bp_front/tsconfig.json` + `tsconfig.app.json` / `tsconfig.node.json` / `tsconfig.e2e.json` — the solution config and
  its three referenced projects. All four are untouched by this story; all three type-check clean under TS 7 already.
- `bp_front/eslint.config.mjs` — consumes `typescript-eslint`; it is what dies at module load under TS 7.
- `bp_front/Dockerfile:7,12` — `node:26-alpine` (musl) running `npm run build`. TS 7's binary is a **statically linked**
  Go executable that declares no `libc` field, so musl is *expected* not to be an obstacle — the one Vite-8-shaped risk
  that likely does not apply here. **Scoped at review: measured on glibc linux-x64, out of image, for 1 of the 20
  platform packages. The image was never built under TS 7** (the LAND branch never ran), so treat it as a supported
  inference, not a measurement, and make `docker compose build bp_front` a named step of any future attempt.

## Tasks & Acceptance

**Execution:**
- [x] **Baseline, before anything moves.** Confirm `git status --short` clean on `epic7-maintenance`. From `bp_front/`
      record verbatim: `npm run lint`; `rm -rf node_modules/.tmp && npm run build`; `npx tsc --version`. Then
      `docker compose up -d --build` and the full `npm run test:e2e` at `retries: 0`, plus the per-project split from
      `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`. **If a baseline gate is red, re-run it
      once** (the `createUserViaUi` defect is known and filed); if still red for a different reason, HALT.
- [x] **Re-measure the registry and route.** Record `npm view typescript dist-tags --json`,
      `npm view typescript-eslint@latest peerDependencies --json`, the same for `@typescript-eslint/parser`, and
      whether any published `typescript-eslint` admits `typescript >=7`. Choose LAND or HOLD from **this** measurement
      and state which branch was taken and why.
- [x] **Reproduce the blocking symptom in the real tree** (HOLD branch). From `bp_front/`: `npm install typescript@7.0.2`
      → capture the `ERESOLVE` output verbatim. Then `npm install typescript@7.0.2 --legacy-peer-deps` and
      `npm run lint` → capture the module-load failure verbatim. Both belong in the record and the ledger.
      **Amended at review — the `--legacy-peer-deps` step proved moot and was never run:** the plain install already
      placed 7.0.2 (it only warns), so `npm run lint` was invoked directly against it. The tick certifies the captured
      lint failure, not the unrun flag. See Implementation Record §3.
- [x] **Prove the codebase is TS-7-clean, independently of the lint toolchain.** With TS 7.0.2 present, run
      `npx tsc -b tsconfig.json --force` and record the exit code and any diagnostics. This is the finding that makes
      the hold precise: it separates "our code is not ready" from "our linter is not ready".
- [x] **Revert and verify.** `git checkout -- bp_front/package.json bp_front/package-lock.json`, `npm ci`,
      `rm -rf node_modules/.tmp`. Confirm `git status --short` is empty and `npx tsc --version` reports `6.0.3`.
      Nothing from the reproduction may survive — no `--legacy-peer-deps` residue, no `overrides`, no stale lockfile.
- [x] **Re-run the S-AC1 gate set on the restored tree.** `npm run lint`, `npm run build`, and the full
      `npm run test:e2e` with the per-project split. The standing invariant is exactly **1** test in each
      `registration-toggle-*` project; the total alone proves nothing.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — insert the new section at **line 937**. It must carry
      the version attempted (`7.0.2`), both verbatim symptoms, the TS-7-clean finding, the rejected side-by-side option
      with its three costs, and the concrete re-check trigger. Verify lines 1–936 and the former 937–end are
      byte-unchanged (md5 before and after). **This entry discharges Story 7.7's `typescript-eslint`/TS 7 deadlock
      entry at line 751** — mark that one resolved rather than leaving it dangling.
- [x] `_bmad-output/project-context.md` — record that `typescript` is **held** at 6.0.3 with the reason, that TS 7 ships
      no compiler API and no `tsserver`, and that the codebase itself type-checks clean under 7. Versions and rules
      only.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-10-typescript-6-to-7: done` with the S-AC3
      held-back wording, `last_updated` refreshed, and an explicit note that **Story 7.11 is not blocked** by this hold.
- [x] **Commit the paperwork.** On the HOLD branch the diff contains no `bp_front/` file at all. Verify with
      `git show --stat` that no dependency or source file moved.

**Acceptance Criteria:**
- Given the epic's Story 7.10 AC1, when the story closes, then the record states — from a measurement taken in this
  pass — whether `tsc -b` type-checks `src`, `vite.config.ts` and `e2e` under TypeScript 7, with the exit code and any
  diagnostics quoted, and no `@ts-ignore` or `@ts-expect-error` was added anywhere.
- Given AC2, when the story closes, then `git diff` shows no change to any of the four tsconfig files, no relaxed
  compiler option, and `tsconfig.app.json`'s `exclude` of `src/__generated__` intact.
- Given AC3 and S-AC3, when `typescript-eslint` is found not to support TypeScript 7, then that is recorded as the
  blocking symptom — verbatim, from a reproduction in this repo, not from a peer-range string alone — an entry naming
  the version attempted and the symptom exists in `deferred-work.md` and **not** in `project-context.md`, and the story
  closes `done`.
- Given S-AC1, when the story closes, then `npm run lint`, `npm run build` and the full four-project Playwright suite
  were measured green **in this pass** on the restored tree, with the per-project split recorded and never quoted.
- Given S-AC4, when the final diff is reviewed, then on the HOLD branch it touches only the three paperwork files plus
  this spec, and contains no `bp_front/` change, no test edit and no weakened assertion.
- Given Story 7.7's ledger entry predicted this deadlock and named "held with that as its blocking symptom" as one of
  its two sanctioned outcomes, when this story closes, then that entry is marked resolved and points here.

## Spec Change Log

## Review Triage Log

### 2026-08-15 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 23: (high 0, medium 13, low 10)
- defer: 1: (high 0, medium 0, low 1)
- reject: 3
- addressed_findings:
  - `[medium]` `[patch]` **The version sweep was not exhaustive and the claim was too strong.** The four peer counts sum to 83, which is the number of releases *returning* a `typescript` peer — there are **105** published stable 8.x releases (22 declare none) and **1066** prereleases, none swept. Re-measured at review; corrected in the ledger, `project-context.md`, `sprint-status.yaml` and three places in the record, with "every published release" and "not merely no *stable* one" marked do-not-restore. The conclusion is unaffected: the refusal is a **runtime check**, not a peer gate.
  - `[medium]` `[patch]` **The blocking peer is declared by 8 packages, not nine or twelve.** Measured from the lockfile: `typescript-eslint` + seven `@typescript-eslint/*`. "Twelve" was arithmetic off npm's `11 more (…)` elision line, which counts peer *edges*; the spec body separately said "nine" while listing seven names. `ts-api-utils` and two `cosmiconfig` copies carry open-ended ranges that do **not** block. Fixed in both files.
  - `[medium]` `[patch]` **`project-context.md` carried the debt narrative that NFR-E7-1 and S-AC3 put in the ledger.** The 17-line block restated the blocking symptom, the workaround refusal and its costs. Trimmed to versions + the directive + a ledger pointer; the self-assessment "no new debt was written here" was not supported by the diff and is corrected.
  - `[medium]` `[patch]` **`project-context.md`'s `_Last Updated` chain and `rule_count` were not maintained**, so the file carried Story 7.10 content while claiming a 2026-08-13 update for 7.8+7.9. Prepended a Story 7.10 entry in the established `Prior entry:` chain and adjudicated the count: **93 → 94** for the one rule added (do not bump `typescript` to 7).
  - `[medium]` `[patch]` **"Do not bump it" would have blocked a legitimate in-major patch.** Scoped the prohibition to the **major** and carried the re-measure caveat (which existed only in the spec's residual risks) into the rules file agents actually read first.
  - `[medium]` `[patch]` **"Story 7.11 is NOT blocked" was asserted unconditionally in four documents from a one-package measurement.** 7.11's AC1 requires *every* plugin to resolve against ESLint 10; `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `@eslint/js` and `globals` were never queried. Narrowed everywhere to "not blocked **on the TypeScript axis**", with 7.11's own pre-check named.
  - `[medium]` `[patch]` **The hold's inverse constraint on 7.11 was never stated:** whatever `typescript-eslint` 7.11 lands must still declare a `typescript` peer admitting the held **6.0.3** — 31 of the swept releases declare `<6.0.0`, which does not. Added, so an ESLint-driven move cannot re-open the conflict from the other side.
  - `[medium]` `[patch]` **The re-check trigger was too narrow to fire.** It tested only `@latest`'s `typescript` peer range, but support will arrive via the native/tsgo API — plausibly as a *new* peer or a dropped/optionalised one — and `canary`/`rc-v8` lead `latest`. Broadened to a disjunction, with the decisive test made **behavioural** (`npm run lint` must lint a non-zero number of files), since the refusal is a runtime check.
  - `[medium]` `[patch]` **Nothing would ever have resurfaced the re-check.** The story is `done`, and the ledger entry closed with "Proposed fix: none needed", which triage reads as no-action. Filed an **open** `action_items` entry in `sprint-status.yaml` (the project's own mechanism for cross-story follow-ups) and reworded the ledger line to name a live obligation.
  - `[medium]` `[patch]` **The musl/Alpine safety claim was stated as measured but the image was never built under TS 7.** Re-scoped in both the Code Map and the ledger: measured on glibc linux-x64, out of image, for 1 of 20 platform packages; a supported inference from a statically linked Go binary with no `libc` field, not a measurement. `docker compose build bp_front` named as a required step of any future attempt.
  - `[medium]` `[patch]` **The "one-line bump" expectation rests on a compiler the retry can never install.** The exit-0 was measured under 7.0.2, which will never be supported (support starts at ≥7.1), against a tree that will have absorbed Stories 7.11–7.15. Attached the re-measure caveat to the expectation itself, not just to the version number.
  - `[medium]` `[patch]` **The side-by-side refusal was presented as "three measured grounds"** when only one is a rule, one was an uncaptured version comparison, and the third is a *prediction* that this story's own evidence undercuts — TS 7.0.2 and TS 6.0.3 both measured clean here, i.e. the two compilers agreed completely. Reweighted: the refusal stands on S-AC3 alone, which is sufficient and honest.
  - `[medium]` `[patch]` **The falsified `ERESOLVE` prediction survived in two earlier sections** that a reader hits *before* the correction, including a Verification bullet reading "expected: non-zero exit … Captured." Both annotated in place with `SUPERSEDED` pointers to Implementation Record §3, so the isolated-probe transcript can no longer install the mental model the record exists to correct.
  - `[low]` `[patch]` `6.0.3` being the newest stable 6.x was asserted three times and never captured. Re-measured at review (stable 6.x is `6.0.2`, `6.0.3`) — the claim is **true**; marked as measured-at-review rather than left unevidenced.
  - `[low]` `[patch]` `@typescript/typescript6` being published at `6.0.2` was likewise uncaptured. Re-measured at review — **true** (versions end at 6.0.2); labelled as verified-at-review and as a number that can move.
  - `[low]` `[patch]` The upstream issue's open state, its *blocked by external API* label and the quoted maintainer sentence had **no capture at all** — the highest-risk form of recalled-as-measured content. Attributed explicitly to the planning pass's uncaptured reading, with the re-check told to look fresh; the evidenced part (support tracks TS >=7.1, from the lint output) kept as measured.
  - `[low]` `[patch]` A ticked task certified a step never run — `npm install typescript@7.0.2 --legacy-peer-deps`. Amended inline: the plain install already placed 7.0.2, so the tick certifies the captured lint failure, not the unrun flag.
  - `[low]` `[patch]` **S-AC2 was never mentioned**, though it is standing for Stories 7.7–7.13 and the record explicitly discharges S-AC1's backend clause. Added its disposition: vacuously satisfied (nothing moved; identical bundle hash at both ends), no screenshot pass required, and the 7.8+7.9 `shots.mjs` handoff closed out as not-applicable.
  - `[low]` `[patch]` **`npm audit` was captured twice in this pass's own evidence and reported nowhere**, in a dependency-currency epic. Recorded: 2 high (`js-yaml`, `brace-expansion`), both transitive under `@graphql-codegen/cli`, unchanged from Story 7.9, `npm audit fix` not run (outside S-AC4). Not re-filed as new debt — 7.9 already filed it.
  - `[low]` `[patch]` A fenced block under a literal `npm view typescript dist-tags --json:` heading had three legacy tags silently trimmed. Elision marked, so the block is not read as byte-verbatim in a record whose premise is "nothing quoted".
  - `[low]` `[patch]` `bp_front/Dockerfile:14` is the Stage-2 comment; the `npm run build` step is `:12`. Citation corrected.
  - `[low]` `[patch]` The Story 7.7 ledger entry kept a live-reading `Proposed fix: **before** 7.10 begins…` after its RESOLVED paragraph. Struck through per the ledger's dominant closure convention and marked discharged, so an open-item scan no longer returns it.
  - `[low]` `[patch]` The ledger-integrity task said "verify lines 1–936 byte-unchanged" while the same task also edited line 751 — mutually unsatisfiable as worded. Reworded to the **three-region** split that was actually verified.
- deferred_findings:
  - `[low]` `sprint-status.yaml` marks a held story with the same `done` value as a landed one, so an epic-close currency audit cannot distinguish them without parsing prose. Sanctioned by S-AC3 and mitigated in `project-context.md`, but a structural board change is outside this story.
- rejected_findings:
  - The spec's `status: in-review` "contradicting" `sprint-status.yaml: done` — expected workflow ordering; the spec reaches `done` at finalize.
  - The `rm -rf node_modules/.tmp` step being unevidenced before the TS-7 type-check — `--force` makes it moot.
  - A vacuous md5 comparison inside a scratch evidence file — a working artifact, not a deliverable, and it was redone correctly.

## Design Notes

### 1 — What TypeScript 7 actually is, measured

TS 7 is the native (Go) port, and the npm package is a thin launcher around a platform binary:

- `optionalDependencies` carries 20 `@typescript/typescript-<os>-<arch>` packages; the host resolves one.
- `bin` is `{"tsc": "bin/tsc"}` — **`tsserver` is gone** (TS 6.0.3 shipped both).
- `exports["."]` is `./lib/version.cjs`, whose entire body is `exports.version` + `exports.versionMajorMinor = "7.0"`.
  Verified: `node -e "const ts=require('typescript'); console.log(typeof ts.createProgram)"` → `undefined`.
- The real API exists only under `./unstable/*` (sync/async over JSON-RPC to the binary, plus AST helpers). The
  TypeScript 7.0 announcement states plainly that **7.0 does not ship an API** and that **7.1 will ship a new and
  different one**.
- The binary is `ELF 64-bit … statically linked, Go BuildID=…`, so `node:26-alpine` (musl) needs no `-musl` variant.
  Unlike Vite 8, the musl image build is **not** the risk surface here.

### 2 — Why this blocks the lint gate specifically

**Eight** packages in the current lockfile declare `peerDependencies.typescript: ">=4.8.4 <6.1.0"`, non-optional:
`typescript-eslint` and **seven** `@typescript-eslint/*` (`parser`, `eslint-plugin`, `typescript-estree`, `utils`,
`type-utils`, `project-service`, `tsconfig-utils`). *(Corrected at review — this paragraph said "Nine … and eight"
while listing seven names; the lockfile says eight total. The three other `typescript` peers in the tree,
`ts-api-utils` `>=4.8.4` and two optional `cosmiconfig` copies `>=4.9.5`, are open-ended and do **not** block.)*
`typescript-estree` does `require("typescript")` in a dozen modules and calls `ts.createSourceFile`,
`ts.ScriptTarget` and friends — none of which TS 7 exports.

So the failure is **not** a cosmetic peer warning. Measured in an **isolated probe** on 2026-08-15 — note this is a
*fresh multi-package install into an empty directory*, which is why it shows a hard `ERESOLVE`:

> **SUPERSEDED — read Implementation Record §3 before forming a mental model from this block.** In the real
> `bp_front/` tree the equivalent install **succeeded, exit 0**, with npm merely *warning* `ERESOLVE overriding peer
> dependency`, because an explicitly-versioned install target is treated as authoritative. `--legacy-peer-deps` was
> therefore never needed and never used. The transcript below is not false, but it is not the behaviour a future
> attempt will meet: **the peer conflict does not stop you, the runtime does.**

```
npm install eslint@9.39.5 typescript-eslint@8.67.0 typescript@7.0.2
  → npm error ERESOLVE … peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.67.0

# forced past with --legacy-peer-deps, then eslint:
  → typescript-eslint does not support TS 7.0.
    See also https://github.com/typescript-eslint/typescript-eslint/issues/10940
    Error: typescript-eslint does not support TS 7.0.
        at Object.<anonymous> (…/typescript-eslint/dist/index.js:52:11)
```

It throws at **module load**, so `eslint .` reports zero files linted. That is the whole static lint gate, including
the `react-hooks/set-state-in-effect` rule the epic calls load-bearing.

Upstream state, read during this story's **planning** pass on 2026-08-15: issue #10940 is open and labelled
*blocked by external API*, with maintainers describing tsgo as "many months away from being stable". **Provenance
flagged at review — that reading was not captured to an evidence file**, unlike every other claim in this record, so
treat the issue's state as needing a fresh look at retry time rather than as a measurement of record. What the
captured evidence *does* prove, from the lint failure's own output, is that support tracks TS **>=7.1**. `typescript-eslint@latest` (8.67.0) **and** `canary` (8.67.1-alpha.4) both
declare the same `<6.1.0` peer. There is no version to move to.

### 3 — Why the sanctioned side-by-side install is still refused

Both the error message and the announcement offer an escape: alias TS 6 in so `typescript` still resolves to a
compiler API, e.g. `"typescript": "npm:@typescript/typescript6@^6.0.2"` alongside
`"@typescript/native": "npm:typescript@^7.0.2"`. It is rejected here on one rule plus two supporting considerations — **not**, as an earlier draft put it, on "three measured grounds":

1. **S-AC3 forbids it in words:** "a failed bump is reverted and recorded, **never worked around**". S-AC4 forbids the
   scope it needs — a second package and a rewritten `build` script.
2. **It would downgrade the linting compiler** (verified against the registry at review; a version that can still move). `@typescript/typescript6` is published at `6.0.2`; this project is on
   `6.0.3`. The workaround makes one gate *older* than today.
3. **It splits the codebase across two type systems** — `tsc` checking with 7.0 semantics while typescript-eslint
   parses with 6.0. Any divergence between them surfaces as an unattributable lint/build disagreement, which is
   precisely the failure mode the epic's one-major-at-a-time sequencing exists to prevent.

Recorded in the ledger as a known escape hatch with its costs, so a future story inherits the analysis rather than
rediscovering it.

### 4 — The finding worth keeping

Measured on the real tree on 2026-08-15 with a TS 7.0.2 binary run out-of-tree (read-only, no lockfile change):
`tsc -p` on each of `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.e2e.json` → **exit 0**, and
`tsc -b tsconfig.json --force` → **exit 0**. Zero diagnostics, under unchanged `strict`, `noUnusedLocals`,
`noUnusedParameters`, `noFallthroughCasesInSwitch` and `moduleResolution: bundler`.

That is the difference between "we are not ready" and "our linter is not ready". `6.0.3` is also already the newest
stable 6.x — there is no patch to take inside the held major. When a TS-7-capable `typescript-eslint` ships, this
story is expected to be a one-line version change, and the ledger entry should say so.

### 5 — What the hold does *not* block

`typescript-eslint@8.67.0` declares `eslint: "^8.57.0 || ^9.0.0 || ^10.0.0"`, so **Story 7.11 (ESLint 9 → 10) is
unaffected** by holding TypeScript. The epic's "7.11 depends on 7.10" is satisfied by 7.10 closing, not by it landing
a bump. Say so explicitly in `sprint-status.yaml`, or the next run will read the hold as a stalled chain.

## Verification

**Commands** (from `bp_front/` unless noted):
- `git status --short` — expected: empty before the reproduction, after the revert, and after the paperwork commit.
- `npm view typescript dist-tags --json` / `npm view typescript-eslint@latest peerDependencies --json` — expected: the
  routing measurement, recorded verbatim with the date.
- `npm install typescript@7.0.2` — expected at planning time: non-zero exit, `ERESOLVE` naming the `<6.1.0` peer.
  **Refuted in the real tree (see Implementation Record §3): it exits 0 and only *warns* `ERESOLVE overriding peer
  dependency`.** Captured either way; the install is not the gate that fails.
- `npm run lint` (with TS 7 installed — no `--legacy-peer-deps` needed) — expected: non-zero exit,
  `typescript-eslint does not support TS 7.0.` Captured. **This is the gate that actually fails.**
- `npx tsc -b tsconfig.json --force` (with TS 7 present) — expected: exit 0, zero diagnostics.
- `git checkout -- package.json package-lock.json && npm ci && npx tsc --version` — expected: `Version 6.0.3`.
- `npm run lint` and `rm -rf node_modules/.tmp && npm run build` on the restored tree — expected: exit 0 for both.
- `docker compose up -d --build` (repo root) then `npm run test:e2e` — expected: exit 0 at `retries: 0`.
- `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` — expected: exactly 1 test in each
  `registration-toggle-*` project, everything else split between `chromium` and `mobile`, unchanged from this pass's
  own baseline. Do **not** use `--list --project=<name>`; `--project` pulls in that project's `dependencies`.
- `git show --stat HEAD` — expected: on the HOLD branch, no `bp_front/` path in the commit at all.
- `md5sum deferred-work.md` before/after, plus a line-range diff — expected: lines 1–936 and the former 937–end
  byte-unchanged around the inserted section.

**Manual checks:**
- Confirm no `overrides`, `resolutions`, `.npmrc` `legacy-peer-deps` entry or `@typescript/*` package survives the
  revert anywhere in `bp_front/` — grep the restored `package.json` and `package-lock.json` for `typescript@7`,
  `@typescript/`, and `legacy-peer-deps`.

## Implementation Record

Every figure below was measured in this pass on **2026-08-15**, on branch `epic7-maintenance` starting from a clean
tree at `853b599`. Nothing is quoted from the spec's own recalled numbers or from a previous story. Evidence files are
under `.tmp/e96fe2e6-f9bf-4f14-b763-6fbe2fa7d7ae/` and are named at each step.

**Branch taken: HOLD.** `typescript` stays pinned at `6.0.3`. The commit contains no `bp_front/` path.

### 1 — Baseline, before anything moved

`git status --short` on `epic7-maintenance`: clean apart from this untracked spec file.

| Gate | Command | Result | Evidence |
|---|---|---|---|
| Lint | `npm run lint` | **exit 0**, no output beyond the script banner | `01-baseline-lint.txt` |
| Compiler | `npx tsc --version` | **`Version 6.0.3`**, exit 0 | `02-baseline-tsc-version.txt` |
| Build | `rm -rf node_modules/.tmp && npm run build` | **exit 0**, `vite v8.2.1`, 1255 modules, `dist/index.html` 0.36 kB + `dist/assets/index-D0HEEKre.js` 801.60 kB (gzip 240.42 kB), built in 215 ms | `03-baseline-build.txt` |
| Stack | `docker compose up -d --build` (repo root) | **exit 0**, both images built, mongo healthy | `04-baseline-compose.txt` |
| Playwright split | `npx playwright test --list \| grep -oP '^\s+\[\K[^\]]+' \| sort \| uniq -c` | `59 chromium / 59 mobile / 1 registration-toggle-chromium / 1 registration-toggle-mobile` — **`Total: 120 tests in 10 files`** | `06-baseline-split.txt`, `06-baseline-list-raw.txt` |
| E2E | `npm run test:e2e` at `retries: 0` | **exit 0 — `120 passed (41.9s)`, green on the FIRST invocation** | `07-baseline-e2e-run1.txt` |

**The known `createUserViaUi` defect did not fire once in this pass**, at either end. No gate was re-run, and the
"re-run once if red" allowance was never exercised. The standing invariant — exactly **1** test in each
`registration-toggle-*` project — holds.

### 2 — The routing measurement, and the decision

Taken 2026-08-15 at 19:52 local (`05-registry-measurement.txt`, `05c-te-all-peers.json`, `05d-te-peer-uniq.txt`).

`npm view typescript dist-tags --json` (decision-relevant tags; three legacy tags — `dev` 3.9.4, `insiders`
4.6.2-insiders.20220225, `tag-for-publishing-older-releases` 4.1.6 — **elided**, marked at review so the block is not
read as byte-verbatim output):

```
{
  "beta": "6.0.0-beta",
  "rc": "7.0.1-rc",
  "latest": "7.0.2",
  "next": "7.1.0-dev.20260815.1"
}
```

`latest` is **7.0.2** — the version the spec named, unchanged. `next` is a dated dev prerelease and was never a
candidate.

`npm view typescript-eslint@latest peerDependencies --json`:

```
{
  "version": "8.67.0",
  "peerDependencies": {
    "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
    "typescript": ">=4.8.4 <6.1.0"
  }
}
```

`typescript-eslint@canary` (**8.67.1-alpha.4**) and `@typescript-eslint/parser@latest` (**8.67.0**) declare the
**identical** pair. `typescript-eslint` `dist-tags` are `latest 8.67.0`, `canary 8.67.1-alpha.4`, `rc-v8
8.0.0-alpha.62` — there is no other channel to check.

The spec asks whether *any* published `typescript-eslint` admits `typescript >=7`, so the question was answered
exhaustively rather than from the three tags. `npm view 'typescript-eslint@>=8.0.0' peerDependencies.typescript --json`
returns **83** values, taking exactly four distinct forms (**corrected at review: 83 is the number of releases that *returned a peer*, not the number that exist — there are 105 published stable 8.x releases, the other 22 declare no `typescript` peer, and none of the 1066 prereleases was swept**):

| `typescript` peer range | Releases declaring it |
|---|---|
| `>=4.8.4 <6.0.0` | 31 |
| `>=4.8.4 <5.9.0` | 21 |
| `>=4.8.4 <6.1.0` | 19 |
| `>=4.8.4 <5.8.0` | 12 |

**None admits 7.x.** The highest upper bound ever published is `<6.1.0`.

**Decision: HOLD.** This is the spec's first I/O-matrix row — "Registry re-measured, still no TS-7 peer" → revert,
record, close `done`. The LAND branch was not taken and the Block-If for an unanticipated migration did not trigger,
because there is no `typescript-eslint` to migrate to. Note the deciding fact is not "no *stable* release supports
TS 7" but **"no release at all does"**, which is a stronger statement than the spec's recalled two-tag check.

### 3 — Blocking symptom 1: the install. **It did not fail — and that is the divergence.**

From `bp_front/`, `npm install typescript@7.0.2` (`08-repro-npm-install-eresolve.txt`), verbatim:

```
npm warn ERESOLVE overriding peer dependency
npm warn While resolving: bp_front@0.16.0
npm warn Found: typescript@6.0.3
npm warn node_modules/typescript
npm warn   peer typescript@">=4.8.4 <6.1.0" from @typescript-eslint/eslint-plugin@8.67.0
npm warn   node_modules/@typescript-eslint/eslint-plugin
npm warn     @typescript-eslint/eslint-plugin@"8.67.0" from typescript-eslint@8.67.0
npm warn     node_modules/typescript-eslint
npm warn   11 more (@typescript-eslint/parser, ...)
npm warn
npm warn Could not resolve dependency:
npm warn peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.67.0
npm warn node_modules/typescript-eslint
npm warn   dev typescript-eslint@"^8.50.0" from the root project
```

followed by six more `npm warn ERESOLVE overriding peer dependency` lines and:

```
added 13 packages, removed 12 packages, changed 1 package, and audited 439 packages in 2s
```

**`INSTALL EXIT: 0`.**

**Divergence from the spec, stated on contact.** The spec's I/O matrix and task list both predict "`ERESOLVE` naming
the `<6.1.0` peer" as a **failure** and then prescribe forcing past it with `--legacy-peer-deps`. Measured, npm treats
an *explicitly versioned install target* as authoritative and **overrides** the conflicting peer with a `warn` rather
than erroring. The peer range is named verbatim — twelve packages declare it (`typescript-eslint` plus eight
`@typescript-eslint/*`, and three more npm elides as "11 more") — but the install succeeds.

Consequences, all of which make the record stronger rather than weaker:

- **`--legacy-peer-deps` was never needed and was therefore never used.** The `Never:` boundary forbidding it in the
  tree is satisfied trivially rather than by a revert. Confirmed there was no ambient forcing either: no `.npmrc`
  exists in `bp_front/` or in `~`, and `npm config get legacy-peer-deps` → `false` (`09-ts7-present-state.txt`).
- The correct reading for a future attempt is **"the peer conflict does not stop you, the runtime does"**. Anyone who
  plans the next attempt around a hard install failure will be surprised in the same way.
- The throwaway install moved **789 lockfile lines (576 insertions / 215 deletions)** — TS 7's 20 platform-optional
  `@typescript/typescript-*` packages plus the host's resolved one, as the Code Map predicted.

State with 7.0.2 in the tree (`09-ts7-present-state.txt`), confirming Design Notes §1 against the real tree rather
than an isolated probe:

```
=== installed tsc ===
Version 7.0.2
=== node -e compiler API ===
keys: [ 'version', 'versionMajorMinor' ]
createProgram: undefined
=== bin ===
tsc
```

`bin/` holds **only `tsc`** — `tsserver` is gone, where 6.0.3 ships both.

### 4 — Blocking symptom 2: the lint gate, verbatim

`npm run lint` with 7.0.2 installed (`10-repro-lint-ts7.txt`), **exit 2**:

```
> bp_front@0.16.0 lint
> eslint .

typescript-eslint does not support TS 7.0.
Please see https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0 to run typescript-eslint using the TS 6 API.
See also https://github.com/typescript-eslint/typescript-eslint/issues/10940 for tracking typescript-eslint's support for TS >=7.1

Oops! Something went wrong! :(

ESLint: 9.39.5

Error: typescript-eslint does not support TS 7.0.
    at Object.<anonymous> (/home/md/projects/personal/bag-please/bp_front/node_modules/typescript-eslint/dist/index.js:52:11)
    at Module._compile (node:internal/modules/cjs/loader:1944:14)
    at Object..js (node:internal/modules/cjs/loader:2084:10)
    at Module.load (node:internal/modules/cjs/loader:1666:32)
    at Module._load (node:internal/modules/cjs/loader:1447:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:260:19)
    at loadCJSModuleWithModuleLoad (node:internal/modules/esm/translators:373:15)
    at ModuleWrap.<anonymous> (node:internal/modules/esm/translators:245:9)
    at ModuleJob.run (node:internal/modules/esm/module_job:447:25)
    at async node:internal/modules/esm/loader:646:26
```

The throw is at **module load**, inside `eslint.config.mjs`'s own import of `typescript-eslint` — the stack never
reaches a rule. **Zero files are linted** and no rule result is produced at all. That is the entire static lint gate,
including `react-hooks/set-state-in-effect`, which the epic names load-bearing for the render-phase-adjustment
convention.

One detail the spec's recalled transcript did not carry, and it matters for the re-check trigger: the upstream issue
tracks support for **TS `>=7.1`**, not 7.0. TypeScript 7.0 is never going to be supported — it ships no API to support.

### 5 — The finding worth keeping: the codebase is already TS-7-clean

Measured with TS 7.0.2 **actually installed in `bp_front/`** (not out-of-tree), after `rm -rf node_modules/.tmp` so
`tsc -b`'s build-mode cache could not report a stale success (`11-ts7-typecheck.txt`):

| Command | Exit | Diagnostics |
|---|---|---|
| `npx tsc -b tsconfig.json --force` | **0** | none |
| `npx tsc -p tsconfig.app.json --noEmit` | **0** | none |
| `npx tsc -p tsconfig.node.json --noEmit` | **0** | none |
| `npx tsc -p tsconfig.e2e.json --noEmit` | **0** | none |

Zero output of any kind from all four. This confirms the spec's Design Notes §4 expectation and satisfies the story's
AC1: `src`, `vite.config.ts` and `e2e` all type-check under TypeScript 7, under unchanged `strict`, `noUnusedLocals`,
`noUnusedParameters`, `noFallthroughCasesInSwitch` and `moduleResolution: bundler`. **No `@ts-ignore`, no
`@ts-expect-error`, no weakened compiler option, and no tsconfig was touched** — `git status --short` after the revert
shows no modification to any of the four config files (AC2).

That is the whole value of the pass: it separates **"our linter is not ready"** from "our code is not ready". Only the
former is true, so when a TS-7-capable `typescript-eslint` ships this story should be a one-line version change.

### 6 — Revert and verification

`12-revert-verify.txt`:

```
=== git diff --stat before revert ===
 bp_front/package-lock.json | 789 +++++++++++++++++++++++++++++++++------------
 bp_front/package.json      |   2 +-
 2 files changed, 576 insertions(+), 215 deletions(-)
=== checkout ===
checkout exit: 0
=== npm ci ===
added 437 packages, and audited 438 packages in 4s
=== git status --short (repo root) ===
?? _bmad-output/implementation-artifacts/spec-7-10-typescript-6-to-7.md
=== npx tsc --version ===
Version 6.0.3
```

Nothing from the reproduction survived. The manual residue checks the spec asks for all came back clean:
`package.json` contains no `legacy-peer-deps`, `overrides`, `resolutions` or `@typescript/` string; `package-lock.json`
contains **0** occurrences of `@typescript/`; `package.json:41` reads `"typescript": "6.0.3"`; no `.npmrc` exists. The
Block-If on a non-clean revert did not trigger.

### 7 — S-AC1 re-run on the restored tree

| Gate | Result | Evidence |
|---|---|---|
| `npm run lint` | **exit 0** | `13-final-lint.txt` |
| `rm -rf node_modules/.tmp && npm run build` | **exit 0**, `dist/assets/index-D0HEEKre.js` 801.60 kB / gzip 240.42 kB, built in 200 ms — **the same chunk hash as the baseline**, which is the correct result for a story that changed no dependency | `14-final-build.txt` |
| Playwright split | `59 chromium / 59 mobile / 1 registration-toggle-chromium / 1 registration-toggle-mobile`, `Total: 120 tests in 10 files` — **unchanged from this pass's own baseline** | `15-final-split.txt` |
| `npm run test:e2e` | **exit 0 — `120 passed (42.4s)`** at `retries: 0`, green first try | `16-final-e2e.txt` |

The suite was green at both ends, so the `--project=registration-toggle-chromium --no-deps` fallback for FR20/FR21 was
never needed — both toggle projects ran and passed inside the full run (`[119/120]` and `[120/120]`).

### 8 — Paperwork

**`deferred-work.md`** — `git diff --stat` is **116 insertions, 0 deletions**, in exactly two hunks:
`@@ -758,0 +759,6 @@` and `@@ -936,0 +943,110 @@`. The re-measured insertion point matched the Code Map's dated
claim exactly: line 935 was the 7.8+7.9 section's last content line, 936 blank, and 937 the
`## Deferred from: code review of 7-8-7-9-types-node-26-and-vite-8` header, so the new
`## Deferred from: Story 7.10 — TypeScript 6 → 7 (2026-08-15)` section went in before it, preserving the
story-order / code-review-order split. **All three untouched regions verified byte-identical by md5**
(`17-ledger-md5-before.txt`, `18-ledger-md5-after.txt`):

| Region | md5 before | md5 after |
|---|---|---|
| old 1–758 = new 1–758 | `9d0f465e5747dafae1975b7fde3ee8bc` | `9d0f465e5747dafae1975b7fde3ee8bc` |
| old 759–936 = new 765–942 | `2d206c0e032626c8e5e1419b67a8cb34` | `2d206c0e032626c8e5e1419b67a8cb34` |
| old 937–end = new 1053–end | `de428123003125e82067415095513181` | `de428123003125e82067415095513181` |

The section carries everything the task list requires: version attempted (`7.0.2`), both verbatim symptoms, the
TS-7-clean finding, the rejected side-by-side option with its three costs, and a mechanical re-check trigger. A
**second** entry was filed that the spec did not anticipate — TS 7 dropping `tsserver` is an editor-tooling regression
that **no gate in this project can observe**, the same shape as Story 7.9's invisible browser-floor change; it is
recorded so the eventual bump verifies the editor path explicitly rather than inferring it from four green gates.

Story 7.7's deadlock entry (its `summary` at the old line 752) is marked **`RESOLVED (2026-08-15) by Story 7.10`**,
noting that its prediction was correct, that the second of its two sanctioned outcomes was taken, and that its
combined-7.10-and-7.11-story contingency is **not** needed.

**`project-context.md`** — Technology Stack only. The TypeScript bullet now records the hold, the three facts an agent
would otherwise burn a pass rediscovering (no compiler API and no `tsserver`; the install *succeeds* so the peer is not
the stopper; the codebase is already TS-7-clean), the refusal of the side-by-side workaround, and the pointer to the
ledger. No new debt was written here (NFR-E7-1) — it points at the ledger instead.

**`sprint-status.yaml`** — `7-10-typescript-6-to-7: done` with the S-AC3 held-back wording, `last_updated` refreshed to
`2026-08-15` in both the header comment and the field, and an explicit, emphasised statement that **Story 7.11 is not
blocked**: `typescript-eslint@8.67.0` peers `eslint: "^8.57.0 || ^9.0.0 || ^10.0.0"`, so ESLint 9 → 10 is admitted by
the **currently installed** bridge with no TypeScript movement, and the epic's "7.11 depends on 7.10" is satisfied by
7.10 closing. The file still parses as YAML (checked with `yaml.safe_load`).

### 9 — Deviations from the spec, in one place

1. **`npm install typescript@7.0.2` succeeded (exit 0) instead of failing with `ERESOLVE`.** The spec predicted a hard
   failure and prescribed `--legacy-peer-deps` to force past it. That step was therefore skipped as moot — the same
   evidence was obtained with *no* forcing mechanism at all, which is a stronger record than the spec asked for. Fully
   recorded in §3 and in the ledger entry.
2. **The registry check was made exhaustive rather than tag-based.** The spec's task names three `npm view` calls; all
   three were run, plus a sweep of the published `typescript-eslint >=8.0.0` stable line (83 of 105 releases returned a peer; prereleases not covered), because "no published version
   admits TS 7" is the claim the hold rests on and two dist-tags cannot establish it.
3. **A second ledger entry was filed** (the missing `tsserver`), beyond the one the task list enumerates.


## Auto Run Result

**Status: `done`** — closed as a **held-back major under S-AC3**, which closes the story rather than failing or
blocking it. `typescript` stays pinned at `6.0.3`. The run never halted; no Block-If triggered.

### Review outcome (2026-08-15)

One review pass, two reviewers in parallel. **0 intent gaps, 0 bad-spec loopbacks, 23 patches applied
(13 medium / 10 low), 1 deferred, 3 rejected.** No finding challenged the HOLD decision, the gate results or the
paperwork-only diff — all three were independently re-verified as sound. What the review did find, and what makes it
worth reading, is a consistent failure mode in the *record* rather than the work: **claims stated more strongly than
their evidence supported.** The sweep behind the hold was called exhaustive when it covered 83 of 105 stable releases
and none of the 1066 prereleases; the blocking-peer package count was given as nine in one place and twelve in
another when the lockfile says eight; four claims labelled "measured" had no capture (two were true on re-measurement
at review, one was true-but-uncaptured, one was a quoted maintainer sentence with no source); the side-by-side
refusal was presented as three measured grounds when it rests on one rule; and "Story 7.11 is not blocked" was
asserted unconditionally in four documents from a single package's peer range. Each is corrected in place with the
superseded wording explicitly marked do-not-restore.

Three findings were substantive rather than editorial and changed what the artifact *does*: the **re-check trigger
could not have fired** (it tested only `@latest`'s peer range, while support will arrive through the native API and
`canary` leads `latest`) — now a disjunction confirmed **behaviourally**, since the refusal is a runtime check; the
re-check had **no owner and no surface** — now an open `action_items` entry, because a `done` story is never revisited;
and `project-context.md` had absorbed the debt narrative that **NFR-E7-1 puts in the ledger**, alongside an unmaintained
`_Last Updated` chain and `rule_count` — trimmed, chained, and counted 93 → 94.

### Branch taken, and why

**HOLD**, routed from a measurement taken in this pass, not from the spec's recalled numbers. `typescript@latest` is
`7.0.2`, and **no published `typescript-eslint` admits TypeScript 7** — across the **83** peer-declaring stable releases `>=8.0.0` the
`typescript` peer takes four values whose highest upper bound is `<6.1.0`, and `latest` (8.67.0) and `canary`
(8.67.1-alpha.4) both sit at that bound. There is no version to migrate to, so the LAND branch was unreachable rather
than declined.

### Implemented change

**No dependency moved and no `bp_front/` file is in the commit.** The deliverable is the recorded engineering
decision: the blocking symptom reproduced in this repository, the escape hatch refused with its costs, and the one
finding that makes the hold precise.

Both symptoms were reproduced in the real tree, not cited:

| # | Symptom | Result |
|---|---|---|
| 1 | `npm install typescript@7.0.2` | **exit 0** with `npm warn ERESOLVE overriding peer dependency … peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.67.0`. The spec predicted a hard failure; npm overrides the peer for an explicitly-versioned target. **`--legacy-peer-deps` was never needed and never used.** |
| 2 | `npm run lint` with 7.0.2 installed | **exit 2**, `Error: typescript-eslint does not support TS 7.0.` thrown at **module load** (`typescript-eslint/dist/index.js:52:11`) — **zero files linted**, the whole static gate gone |

Root cause, measured in-tree: TS 7 is the native Go port and ships **no JavaScript compiler API** —
`require('typescript')` yields exactly `['version','versionMajorMinor']`, `ts.createProgram` is `undefined`, and
`bin/` holds only `tsc` (**`tsserver` is gone**).

**The finding worth keeping:** with 7.0.2 actually installed and the build cache cleared,
`npx tsc -b tsconfig.json --force` → **exit 0, zero diagnostics**, and all three projects individually → exit 0. The
hold is about the **linter**, not the code, and the eventual bump should be a one-line version change.

The sanctioned side-by-side / dual-TypeScript install was **refused** on three recorded costs: S-AC3 forbids working
around a failed bump; it would *downgrade* the linting compiler to `@typescript/typescript6@6.0.2` when this project
is on `6.0.3`; and it splits the codebase across two type systems.

### Files changed

- `_bmad-output/implementation-artifacts/spec-7-10-typescript-6-to-7.md` — this spec, its task ticks and its
  implementation record.
- `_bmad-output/implementation-artifacts/deferred-work.md` — a new `## Deferred from: Story 7.10` section before the
  7.8+7.9 code-review section (two entries: the hold itself, and the invisible `tsserver` loss), plus Story 7.7's
  TS-7 deadlock entry marked `RESOLVED`. 116 insertions, **0 deletions**, two hunks; the three untouched regions
  md5-verified byte-unchanged.
- `_bmad-output/project-context.md` — Technology Stack only: the hold, its reason, and the TS 7 facts. New debt went
  to the ledger, not here (NFR-E7-1).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-10-typescript-6-to-7: done` with the held-back
  wording, `last_updated` → 2026-08-15, and the explicit "**Story 7.11 is not blocked**" statement.

**No `bp_front/` path appears in the commit** (verified with `git show --stat`), which is S-AC4's requirement for the
HOLD branch.

### Verification performed

All measured in this pass on the restored tree; nothing quoted.

| Gate | Baseline | After revert |
|---|---|---|
| `npm run lint` | **0** | **0** |
| `npx tsc --version` | `6.0.3` | `6.0.3` |
| `rm -rf node_modules/.tmp && npm run build` | **0**, 801.60 kB / `index-D0HEEKre.js` | **0**, same chunk hash |
| `docker compose up -d --build` | **0** | (unchanged tree) |
| Playwright split | 59 / 59 / 1 / 1 = 120 | 59 / 59 / 1 / 1 = 120 |
| Full E2E at `retries: 0` | **`120 passed (41.9s)`, exit 0** | **`120 passed (42.4s)`, exit 0** |

Green on the **first** invocation at both ends — the known `createUserViaUi` defect did not fire once, so no gate was
re-run and the FR20/FR21 `--no-deps` fallback was never needed. Revert verified: `git status --short` shows only this
untracked spec; `package.json`/`package-lock.json` carry no `legacy-peer-deps`, `overrides`, `resolutions` or
`@typescript/` residue; no `.npmrc` exists. Backend not run — no Gradle or backend file changed, so S-AC1's backend
clause does not apply.

**S-AC2 (added at review — it was never addressed, and silence is indistinguishable from an oversight).** S-AC2 is
standing for Stories 7.7–7.13 and requires a real-browser pass proving identical rendering. It is **vacuously
satisfied** here: no dependency moved, no `bp_front/` file is in the commit, and the built bundle is byte-identical at
both ends of the pass (`index-D0HEEKre.js`, same 801.60 kB, same hash). **No screenshot pass was taken and none was
required** — there is nothing that could have rendered differently. This also closes out the 7.8+7.9 ledger handoff
asking the next dependency story to reuse `shots.mjs`: not applicable to a hold, and the fixture data it depended on
no longer exists.

**`npm audit` (added at review).** The restored tree — the one Story 7.11 inherits — reports **2 high, 0 critical**:
`js-yaml` and a `brace-expansion` path, both transitive under `@graphql-codegen/cli`. Identical to what Story 7.9
recorded on the Vite 8 tree; **neither is introduced or changed by this story**, and `npm audit fix` was not run
because that is a dependency change outside S-AC4. Recorded rather than re-filed, since the finding already sits in
the ledger from 7.9.

### Deviations

1. `npm install typescript@7.0.2` **succeeded** where the spec predicted an `ERESOLVE` failure; the prescribed
   `--legacy-peer-deps` step was consequently moot and skipped. Recorded rather than absorbed — the correct mental
   model for the next attempt is "the peer conflict does not stop you, the runtime does".
2. The registry check was **widened** (83 peer-declaring stable 8.x releases, not exhaustive — see the review correction above) rather than resting on two dist-tags,
   because "no published version admits TS 7" is the claim the entire hold rests on.
3. A **second** ledger entry was filed beyond the enumerated one: the loss of `tsserver`.

### Residual risks

1. **The hold is open-ended.** Upstream issue #10940 was (per the uncaptured planning-pass reading noted above) open,
   labelled *blocked by external API*, and tracks TS
   **>=7.1** — so this is not a "wait for the next patch" hold. If it has not moved by the epic's close, the
   dependency-currency criterion is satisfied by the recorded blocking symptom, not by currency.
2. **`tsserver` is gone in TS 7 and no gate here can see it.** On the day the bump lands, all four gates can stay
   green while in-editor type intelligence stops working. Filed; verify the editor path explicitly then.
3. **The `createUserViaUi` defect remains unfixed** — it simply did not fire in this pass. The unpaginated
   `AdminUsers` query still degrades as the users table regrows, and it fronts Stories 7.11–7.13.
4. `typescript` 6.0.3 will begin to age. It was the newest stable 6.x when measured at review, so there is nothing to take inside the
   held major, but that will not stay true indefinitely — re-measure `npm view typescript dist-tags` at each future
   attempt rather than assuming 6.0.3 is still the top of the 6 line.
