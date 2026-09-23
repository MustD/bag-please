---
title: 'Story 9.12: Small cleanups'
type: 'chore'
created: '2026-09-23'
status: 'done'
baseline_revision: '8734c0eb2f70eee4de8dde9561078f8f4b8dfd7e'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
warnings: [oversized]
deferred:
  - summary: >-
      deferred-work.md's top-of-file banner ("This file now holds OPEN items only") is stale — the file already
      held many closed entries before this story, and this story's own closures don't square the claim either.
    evidence: |-
      Confirmed pre-existing: grep for "✅ CLOSED" in deferred-work.md returns dozens of hits predating this story
      (Stories 9.1-9.11 closures), so the banner was already false when this story started. This story adds more
      closed entries without correcting it. Not caused by Story 9.12; out of its 7-item scope.
    location: >-
      _bmad-output/implementation-artifacts/deferred-work.md:5
    severity: low
---

<intent-contract>

## Intent

**Problem:** Seven routed hygiene items (`deferred-work.md`, "Own story — small cleanups") carry real traps: a
tracked IDE data-source file, a type-checked file that `tsc -b` never sees, a stale bind-mount path in docs/E2E
comments, a spurious compiler warning, an ungitignored PWA build dir, dead backend code, and unconsumed theme tokens.

**Approach:** Fix each item exactly as scoped below — no refactor beyond the named change — then close every
matching `deferred-work.md` entry (index + detailed dated entries) in place with a `✅ CLOSED by Story 9.12 (date)`
line, and run the full quality gate.

## Boundaries & Constraints

**Always:**
- Each of the 7 items below is fixed to the letter of its AC — nothing more.
- Every `deferred-work.md` entry matching these 7 items is closed in place using the file's own convention: replace
  the entry with `- ✅ CLOSED by Story 9.12 (2026-09-23): <one-line resolution>. Was: <original text>.` (see
  `deferred-work.md:81-84` and `:16-18` for the existing pattern). This applies at every occurrence — the "Routed to
  Epic 9" index (`:105-111`) AND each detailed dated section (see Code Map for line numbers). Do not delete an entry;
  close it in place so the history stays legible.
- `npm run lint`, `npm run build`, backend tests (`mise run back:test`), and the full E2E suite (`npm run test:e2e`)
  all pass after every change.

**Never:**
- No product-behavior change: no new component, no schema change, no new E2E scenario beyond re-running the existing
  gate (this story adds no user-facing feature).
- Do not touch `EXPERIENCE.md` (only `DESIGN.md` §3 and §11.2 are in scope for the token removal).
- Do not adopt `bg2`/`card2`/`sheetBg`/`stripe` as a design decision (out of scope, product call per `DESIGN.md`
  §11.2) — this story only removes what is provably unconsumed today.
- Do not add `viewport-fit=cover` or otherwise touch `index.html`/PWA config — unrelated to this story.

</intent-contract>

## Code Map

1. **Untrack `.idea/dataSources.xml`** (`deferred-work.md:105`, F19b; closed entry now at `deferred-work.md:105-106`)
   - `git ls-files .idea/dataSources.xml` currently returns the path — it IS tracked, and `.gitignore` (root) has no
     rule for it (only `.idea/modules.xml`, `jarRepositories.xml`, `compiler.xml`, `libraries/` at `.gitignore:10-13`).
   - Add `.idea/dataSources.xml` to the root `.gitignore` (same `### IntelliJ IDEA ###` block) and `git rm --cached`
     it. Leave the file on disk untouched.

2. **`codegen.ts` type-checked** (`deferred-work.md:106`, `:148-152`, `:382-388`; closed entries now at
   `deferred-work.md:107-108`, `:159-166`, `:397-404`)
   - `bp_front/tsconfig.node.json` `include` is `["vite.config.ts"]` only; `bp_front/codegen.ts` matches no
     tsconfig project (`tsconfig.app.json` → `src`, `tsconfig.e2e.json` → `e2e` + `playwright.config.ts`).
   - Add `"codegen.ts"` to `tsconfig.node.json`'s `include` array. `deferred-work.md:148-152` already verified this
     fix is sufficient on its own (no `types` change needed) — confirm with `cd bp_front && npx tsc -b`.

3. **Stale `./db/data` path** (`deferred-work.md:107`, `:391-397`; closed entries now at `deferred-work.md:109-111`,
   `:409-414`)
   - `grep -rn './db/data' docs/ bp_front/e2e/` currently hits: `docs/deployment-guide.md:10` (table cell) and `:151`
     (backup checklist item), plus comments in `bp_front/e2e/{lists,sharing,shopping,item-editing,navigation,
     admin}.spec.ts`, `account.spec.ts`, `item-attribution.spec.ts`, `global-setup.ts`, `support/ui.ts` (11 files,
     13 lines total — re-run the grep for the exact current line numbers, they may have shifted).
   - `docs/deployment-guide.md:22` already correctly says "the named Docker volume `db_data`" — match that wording.
   - Replace every stale occurrence with wording describing the `db_data` named Docker volume (per root `CLAUDE.md`
     and `docker-compose.yaml:5-6`), preserving each comment's surrounding sentence/meaning — do not just delete the
     clause, since most of these comments explain *why* test data persists across runs.

4. **`UserService.changePassword` unused-expression warning** (`deferred-work.md:108`, `:341-347`; closed entries
   now at `deferred-work.md:112-114`, `:350-361`)
   - `bp_back/src/main/kotlin/com/bagplease/entity/user/UserService.kt:73` is a redundant trailing `Unit` inside the
     `either { }` block (the block's type is already inferred from `repository.save(...)`, which itself returns
     `Unit` — `UserRepository.kt:49`). Confirmed via `gradle :bp_back:compileKotlin --rerun`:
     `w: .../UserService.kt:73:9 Expression is unused.`
   - Delete line 73 (the bare `Unit` statement) so the block's last expression is `repository.save(...)`. Matches the
     no-trailing-`Unit` convention already used by `ListService.verifyMembership` and `FeedbackService.send`.

5. **`dev-dist/` gitignored + linted-out** (`deferred-work.md:109`, `:368-374`; closed entries now at
   `deferred-work.md:115-116`, `:384-390`)
   - `vite-plugin-pwa`'s dev-mode debug output directory `dev-dist/` is in neither `bp_front/.gitignore` nor
     `bp_front/eslint.config.mjs`'s `ignores` array (`:11-19`, currently `dist`, `src/__generated__`, `test-results`,
     `playwright-report`, `blob-report`, `playwright/.cache`, `e2e/.auth`).
   - Add `dev-dist` to both: a new line in `bp_front/.gitignore` (alongside `dist`/`dist-ssr`) and a new entry
     `'dev-dist'` in the `eslint.config.mjs` `ignores` array.

6. **`ListStorage.delete()` removed** (`deferred-work.md:110`, `:568-571`; closed entries now at
   `deferred-work.md:117-119`, `:590-593`)
   - `bp_back/src/main/kotlin/com/bagplease/entity/list/ListStorage.kt:51-55` (`suspend fun delete(id: UUID): List`)
     has zero callers — confirmed via `grep -rn "listStorage.delete\|ListStorage.delete" bp_back/src`. The real
     deletion path is `ListService.cascadeDeleteList` (`ListService.kt:130-145`), which calls
     `listRepository.delete(id)` directly and evicts the cache via `listStorage.evictFromCache(id)` — it never
     routes through `ListStorage.delete()`.
   - Delete the `delete(id: UUID)` method from `ListStorage.kt`. Check for a corresponding unused test in
     `bp_back/src/test/kotlin` (search `ListStorage` test files for a `delete` test case) and remove it too if
     present and it exercises only this method.

7. **Unconsumed `custom.bp.*` theme tokens removed** (`deferred-work.md:111`, `:710-722`; closed entries now at
   `deferred-work.md:120-123`, `:733-750`)
   - `bp_front/src/theme.ts`: of six declared tokens, `bg2` (`:74`), `card2` (`:75`), `sheetBg` (`:77`), `stripe`
     (`:79`) have zero consumers (`grep -rn 'custom\.bp' bp_front/src | grep -v src/theme.ts` — only 2 hits:
     `AppShell.tsx` uses `navBg`, `WelcomeBanner.tsx` uses `accentSoft`). Keep `navBg` and `accentSoft`.
   - Remove the four dead keys from both the value object (`theme.ts:72-81`) and the module-augmentation type
     (`theme.ts:7-16` `Theme['custom']['bp']` interface) — the `ThemeOptions` partial type at `:19-23` needs no
     structural change, it derives from `Theme['custom']['bp']`.
   - Update `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md`:
     - §3 (`:78-101`): retitle "six declared tokens, two consumed" → "two declared tokens, both consumed"; the table
       (`:84-91`) keeps only the `navBg` and `accentSoft` rows; drop the "RE-MEASURED, contradicts planning text"
       callout and the `sheetBg`/`bg2`/`card2`/`stripe` closing paragraph (`:93-101`) — replace with a short note
       that the four unconsumed tokens were removed by Story 9.12 (cite `deferred-work.md`'s closed entry).
     - §11.2 (`:396-403`, "A design-token overhaul — including the four dead tokens"): the four dead tokens no
       longer exist, so the "what a future overhaul inherits" framing is stale. Rewrite to note the tokens were
       removed (not "adopt or delete" anymore — deleted), while keeping the section as a placeholder for a *future*
       token/overhaul discussion if one arises (retitle without "including the four dead tokens").

## Tasks & Acceptance

**Execution:**
- `.gitignore` -- add `.idea/dataSources.xml`; `git rm --cached .idea/dataSources.xml` -- F19b.
- `bp_front/tsconfig.node.json` -- add `codegen.ts` to `include` -- closes the tsconfig-project gap.
- `docs/deployment-guide.md`, `bp_front/e2e/*.ts` -- sweep every stale `./db/data` mention to describe the `db_data`
  named volume -- closes the stale-path entry.
- `bp_back/.../UserService.kt` -- delete the redundant trailing `Unit` at line 73 -- silences the compiler warning.
- `bp_front/.gitignore`, `bp_front/eslint.config.mjs` -- add `dev-dist` to both -- closes the ungitignored-output entry.
- `bp_back/.../ListStorage.kt` -- delete the dead `delete(id: UUID)` method (and its test, if one exists) -- dead code removal.
- `bp_front/src/theme.ts` -- remove `bg2`/`card2`/`sheetBg`/`stripe` from the value object and the module-augmentation type -- unconsumed tokens.
- `.../ux-epic-8/DESIGN.md` §3, §11.2 -- correct the token census and the overhaul section to match the post-removal state.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- close all 7 index entries (`:105-111`) plus every
  matching detailed dated entry (see Code Map items 1-7 for line references) with the `✅ CLOSED by Story 9.12`
  convention.
- Run `npm run lint`, `npm run build` (`bp_front/`), `mise run back:test`, and `npm run test:e2e` -- confirm the
  full gate is green after all seven changes.

**Acceptance Criteria:**
- Given the repository, when `git ls-files .idea/dataSources.xml` runs, then it returns nothing, and the file
  (still present on disk) is covered by a `.gitignore` rule.
- Given `tsconfig.node.json`, when `cd bp_front && npx tsc -b` runs, then `codegen.ts` is included and type-checks
  with no new error.
- Given `docs/` and `bp_front/e2e/`, when searched for `./db/data`, then no stale path remains — every mention
  describes the `db_data` named volume instead.
- Given a forced backend compile (`gradle :bp_back:compileKotlin --rerun`), when it runs, then no
  `Expression is unused` warning is emitted for `UserService.changePassword`.
- Given `bp_front/.gitignore` and `bp_front/eslint.config.mjs`'s `ignores` array, when read, then both list
  `dev-dist`.
- Given the backend, when searched (`grep -rn "fun delete" .../ListStorage.kt`), then `ListStorage.delete()` no
  longer exists, and `mise run back:test` / `gradle :bp_back:build` still pass.
- Given `bp_front/src/theme.ts` after Story 9.12, when `custom.bp.*` consumers are counted, then every token with no
  consumer has been removed together with its module-augmentation type, and `DESIGN.md` §3 and §11.2 read
  consistently with the resulting two-token state.
- Given `npm run lint`, `npm run build`, `mise run back:test`, and `npm run test:e2e`, when run after all changes,
  then all pass.
- Given `deferred-work.md`, when the 7 routed entries and their detailed dated counterparts are inspected, then each
  is marked closed in place, in the file's existing `✅ CLOSED by Story X.Y (date): ...` convention.

## Spec Change Log

## Review Triage Log

### 2026-09-23 — Review pass
- verdicts: 12 findings — high 0, medium 0, low 7, false 5, maybe-false 0
- findings:
  - `[low]` `[patch]` blind-hunter: `deferred-work.md`'s Story 8.7 (`custom.bp.*`) closure kept the original inline `status: **OPEN — four \`custom.bp.*\` tokens...**` field sitting right below the new `✅ CLOSED` banner — self-contradictory. Fixed to match the file's own established convention for entries with an inline `status:` field (`deferred-work.md:655,707`): the `status:` value itself now reads `**✅ CLOSED by Story 9.12 (2026-09-23).**` with a `closed_by:` pointer, rather than a separate closure line left above a stale `OPEN`.
  - `[low]` `[patch]` blind-hunter (grouped with the DESIGN.md §11.2/§7 row below, same root cause): removing 4+4 lines from `theme.ts` shifted every line number below the edited regions, but the diff only corrected the `theme.ts:NN` anchors it directly touched (§3), leaving ~15 stale anchors elsewhere in `DESIGN.md` (§1, §2, §4, §5, §6, §10, §11.1). Fixed: every `theme.ts:NN` anchor in the document re-derived against the current file and corrected.
  - `[false]` `[reject]` blind-hunter: the spec's own `## Spec Change Log` / `## Review Triage Log` sections were empty at review time — this is the expected state for a spec's first review pass (both sections are explicitly append-only, populated starting with this pass), not a defect.
  - `[low]` `[defer]` blind-hunter: `deferred-work.md`'s top-of-file banner ("This file now holds OPEN items only") was already stale before this diff (the file already held many `✅ CLOSED` entries) and this story adds more closed entries without touching that banner. Pre-existing, not caused by Story 9.12 — deferred rather than fixed here.
  - `[low]` `[patch]` blind-hunter: the spec's own Code Map cited pre-edit `deferred-work.md` line numbers for each of the 7 items, which drifted once the closures were written. Fixed: each Code Map item now also cites the closed entries' current line numbers.
  - `[false]` `[reject]` blind-hunter: claimed the `tsconfig.node.json` fix's "verified sufficient on its own" claim (from the cited pre-existing deferred-work.md note) was not independently re-verified. Refuted — it was independently re-run three times in this session: `npx tsc -b` (twice, by two different actors) and the edge-case-hunter's own trace, all exit 0 with `codegen.ts` included and no new error.
  - `[low]` `[patch]` blind-hunter: the `ListStorage.delete()` closure noted zero callers but didn't say whether a test existed for the removed method. Fixed: the closure now states no `ListStorage` test file exists either, so nothing else needed removing.
  - (grouped with the theme.ts-anchor row above — see there.)
  - `[low]` `[patch]` blind-hunter: `UserService.kt`'s trailing-`Unit` closure and the original Story 7.12 finding cite different line numbers (`:73` vs `:65`) for the same statement with no explanation. Fixed: the closure now notes the drift is later stories' intervening code, same statement throughout.
  - `[false]` `[reject]` edge-case-hunter: zero findings reported (`[]`) — full trace of every changed hunk, including a deletion check and a claims check against the spec's Intent/Tasks & Acceptance, found no unhandled paths, orphaned references, or falsified claims.
  - `[false]` `[reject]` verification-gap: "No verification gaps found." — every changed part screened as non-behavioral (hygiene/doc/config-only) except the two backend deletions, both independently confirmed non-behavioral (return-type/inferred-type unaffected, zero callers).
  - `[false]` `[reject]` intent-alignment: flagged the diff's rewrite of `_bmad-output/implementation-artifacts/epic-9-context.md` as exceeding the spec's 7-item "nothing more" boundary, with no deferred-work.md entry or Code Map justification. Refuted — this is the workflow's own mandated step-01 epic-context recompilation (`workflow.md` step-01 §"Compile epic context if needed"), triggered because planning artifacts were newer than the cached context, and performed identically at the start of every prior story dispatch in this epic regardless of that story's own scope (confirmed via `git log -- epic-9-context.md`: touched by Stories 9.7, 9.8, 9.9 too). It is workflow-level maintenance that happens before the spec exists, not scope creep introduced by this story's Code Map.
  - `[false]` `[reject]` intent-alignment: noted the diff contains no evidence of the quality gate having been run (no CI log/command output in the diff itself), calling backend-test coverage of the `ListStorage.delete()` removal "unverifiable from the diff alone." Refuted by evidence outside the diff's text but gathered in this same session: the full backend suite (170/170 passed) and the full E2E suite (283 passed, 29 skipped) were both run clean after every change, matching the spec's own `## Verification` section.
  - `[false]` `[reject]` intent-alignment: flagged that `.idea/dataSources.xml`'s diff hunk shows `deleted file mode`, which "could be misread" as violating the AC's "leave the file on disk" requirement. The auditor's own report already clarifies this is the expected `git rm --cached` signature; re-confirmed here — `ls -la .idea/dataSources.xml` shows the file still present on disk, only untracked.

## Design Notes

**Why sweep every `./db/data` comment instead of a blanket find-and-replace.** Most of the E2E comments use the
volume as evidence for *why* a test pattern is safe (e.g. "the ./db/data volume persists across runs, so usernames
must be unique per run") — the persistence claim is still true of the named volume, only the path is stale. Preserve
each comment's reasoning; correct only the path/terminology.

**Why `DESIGN.md` §11.2 is rewritten rather than deleted.** The section is the document's designated "out of scope,
here's why" catalog entry (§11 pattern: 11.1 light mode, 11.3 bottom-tab nav). Deleting it breaks that pattern and
loses the record of the token question having been raised; rewriting it to reflect "removed, not adopted" keeps the
document's own structure intact.

## Verification

**Commands:**
- `cd bp_front && npx tsc -b` -- expected: exit 0, `codegen.ts` included.
- `cd bp_front && npm run lint` -- expected: exit 0.
- `cd bp_front && npm run build` -- expected: exit 0.
- `gradle :bp_back:compileKotlin --rerun` -- expected: exit 0, zero `w: ` lines.
- `mise run back:test` -- expected: all green, count unchanged or reduced by exactly the removed `ListStorage.delete`
  test (if one existed).
- `cd bp_front && npm run test:e2e` -- expected: all projects green, same pass count as the pre-change baseline
  (no behavior change expected).
- `git ls-files .idea/dataSources.xml` -- expected: empty output.
- `grep -rn './db/data' docs/ bp_front/e2e/` -- expected: no matches.
- `grep -rn 'custom\.bp' bp_front/src` -- expected: exactly `theme.ts` (2 declarations) + `AppShell.tsx` (`navBg`) +
  `WelcomeBanner.tsx` (`accentSoft`).

## Auto Run Result

Status: done

### Implemented change

All 7 routed hygiene items closed: `.idea/dataSources.xml` untracked (still on disk); `codegen.ts` added to
`tsconfig.node.json`'s `include` so `tsc -b` type-checks it; every stale `./db/data` mention across
`docs/deployment-guide.md` and 9 `bp_front/e2e/*.ts` files now describes the `db_data` named volume; the redundant
trailing `Unit` in `UserService.changePassword` removed (silences the Kotlin "Expression is unused" warning);
`dev-dist` added to both `bp_front/.gitignore` and the ESLint `ignores` array; the dead `ListStorage.delete()`
removed (zero callers, no test); the four unconsumed `custom.bp.*` theme tokens (`bg2`, `card2`, `sheetBg`,
`stripe`) removed from `theme.ts`'s value object and module-augmentation type, with `DESIGN.md` §3 and §11.2
updated to match. All 7 matching `deferred-work.md` entries (index + detailed dated counterparts) closed in place
with the file's own `✅ CLOSED by Story 9.12 (2026-09-23): ... Was: ...` convention.

### Files changed

- `.gitignore` -- adds `.idea/dataSources.xml`.
- `.idea/dataSources.xml` -- untracked via `git rm --cached` (file remains on disk).
- `bp_front/tsconfig.node.json` -- adds `codegen.ts` to `include`.
- `docs/deployment-guide.md` -- 2 stale `./db/data` mentions corrected.
- `bp_front/e2e/{account,admin,global-setup,item-attribution,item-editing,lists,navigation,sharing,shopping,support/ui}.{ts,spec.ts}` -- 9 files, stale `./db/data` comments corrected.
- `bp_back/.../UserService.kt` -- redundant trailing `Unit` removed.
- `bp_front/.gitignore`, `bp_front/eslint.config.mjs` -- `dev-dist` added to both.
- `bp_back/.../ListStorage.kt` -- dead `delete(id: UUID)` method removed.
- `bp_front/src/theme.ts` -- 4 unconsumed tokens removed from value object and module-augmentation type.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md` -- §3 token census and §11.2 rewritten; every
  `theme.ts:NN` line anchor in the document re-derived and corrected (review patch).
- `_bmad-output/implementation-artifacts/deferred-work.md` -- all 7 items' index + detailed entries closed in
  place; the `custom.bp.*` entry's inline `status:` field corrected in place per the file's own convention (review
  patch); two closures given a one-clause completeness addition (review patch).
- `_bmad-output/implementation-artifacts/epic-9-context.md` -- recompiled (workflow step-01; planning artifacts
  were newer than the cached context).

### Review findings

Four layers reported 12 findings: high 0, medium 0, low 7, false 5, maybe-false 0.

**Patched (5 entries, all low):**
- the `custom.bp.*` `deferred-work.md` closure's stale inline `status: OPEN` field, now matching the file's own
  closed-status convention
- ~15 stale `theme.ts:NN` anchors elsewhere in `DESIGN.md`, left unfixed by the original token-removal edit
- this spec's own Code Map citations into `deferred-work.md`, stale after the closures were written
- the `ListStorage.delete()` closure now notes no test existed either
- the `UserService.kt` trailing-`Unit` closure now explains the `:65` vs `:73` line-number drift

**Deferred (1, low):** `deferred-work.md`'s top-of-file banner ("holds OPEN items only") is stale — pre-existing,
not caused by this story, out of its 7-item scope.

**Rejected (6, all false):**
- the spec's own Change Log/Triage Log being empty at review time (expected for a first pass)
- the `tsconfig.node.json` fix's sufficiency not being independently re-verified (it was, three times)
- edge-case-hunter's own zero findings (nothing to reject; confirms clean)
- verification-gap's own "no gaps" (nothing to reject; confirms clean)
- the `epic-9-context.md` rewrite being flagged as out-of-scope (it's the workflow's own mandated step-01
  recompilation, done for every story in this epic)
- the quality-gate evidence being "unverifiable from the diff alone" (the full backend and E2E suites were both
  run clean in this session)
- the `.idea/dataSources.xml` `deleted file mode` diff header being potentially misread (confirmed expected;
  file still on disk)

### Follow-up review recommendation

`false`. First pass; all 5 patched entries were `low` (0 `high`, 0 `medium`), well under the `true` threshold (a
patched `high`, or two or more patched `medium`).

### Verification performed

- `cd bp_front && npx tsc -b` -- exit 0, `codegen.ts` included, no new error.
- `cd bp_front && npm run lint` -- exit 0.
- `cd bp_front && npm run build` -- exit 0.
- `gradle :bp_back:compileKotlin --rerun` -- exit 0, zero `w: ` lines.
- `mise run back:test` -- 170 tests: 170 passed, 0 failed, 0 skipped. (An earlier run under heavy host memory
  pressure — 9.5GB swapped — produced 15 unrelated `MongoTimeoutException` failures confined to
  `AdminUserManagementTest`'s own Testcontainers instance; re-run of just that class in isolation passed all 17,
  and a clean full re-run after memory pressure eased passed all 170. Not caused by this story.)
- `docker compose up -d --build` then `curl .../api/health` -- 200.
- `cd bp_front && npm run test:e2e` -- 283 passed, 29 skipped, 0 failed (matches the pre-change baseline from
  Story 9.11's own verification).
- `git ls-files .idea/dataSources.xml` -- empty.
- `grep -rn './db/data' docs/ bp_front/e2e/` -- no matches.
- `grep -rn 'custom\.bp' bp_front/src` -- exactly `theme.ts` (2 declarations) + `AppShell.tsx` (`navBg`) +
  `WelcomeBanner.tsx` (`accentSoft`).
- `grep -n "fun delete" bp_back/.../ListStorage.kt` -- empty.
- `grep -c dev-dist bp_front/.gitignore bp_front/eslint.config.mjs` -- 1 each.

### Residual risks

- None identified specific to this story's 7 items. The deferred stale-banner item in `deferred-work.md` is
  pre-existing and cosmetic.
