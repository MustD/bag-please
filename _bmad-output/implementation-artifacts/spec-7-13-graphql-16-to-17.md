---
title: 'Story 7.13 — `graphql` 16 → 17'
type: 'chore'
created: '2026-08-19'
status: 'done'
baseline_revision: '26a441f'
final_revision: '9190b65'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md'
warnings: [oversized]
# oversized: the epic's AC1 names four peers and planning found the blocker is a FIFTH package that
#   none of the four's peer lines reveal. Encoding the resolution-level check, the two closing
#   branches (LAND / HOLD — both `done`), and the "npm warns rather than fails" precedent from
#   Story 7.10 is what stops an unattended pass from either force-installing or halting.
---

<intent-contract>

## Intent

**Problem:** `graphql` is pinned at `16.14.2` while `17.0.2` is `latest`. It is the epic's last dependency major and
the one most likely to be held back: it is a simultaneous peer of `@apollo/client`, `graphql-ws`,
`@graphql-codegen/cli` and `@graphql-codegen/client-preset`, and — unlike every earlier bump in this chain — it is a
**runtime** dependency that reaches the shipped bundle through Apollo.

**Approach:** Check v17 support at the **resolution** level before attempting anything, then take exactly one of two
closing branches. LAND: `graphql` moves to the latest 17.x, verified by codegen, both static gates, the production
image build and the full Playwright suite. HOLD: nothing moves, the blocking package and its published peer range go
into `deferred-work.md`. **Both branches close the story `done`** (S-AC3 / AC2).

## Boundaries & Constraints

**Always:**
- **Re-measure the registry in this pass.** `npm view graphql dist-tags` and the peer ranges of all four named
  packages, at the versions currently in `bp_front/package-lock.json`. Planning measured (2026-08-19):
  `graphql` `latest` `17.0.2`, `latest-16` `16.14.2` (so the held version is already the head of 16, not a lag).
- **The peer check is a check on the resolved tree, not on four peer lines.** Sweep **every** package in
  `package-lock.json` that declares a `graphql` peer, not only the four AC1 names. Planning found 42 such packages;
  41 admit `^17.0.0` and **one does not** — see Design Notes §1. A named package whose own hard dependency refuses
  v17 does not support v17, whatever its peer line says.
- **Read installed versions from the lockfile, never from `package.json`** (`bp_front/Dockerfile` runs `npm ci`).
- **Every gate is measured in this pass.** No count, size or timing is quoted from an earlier story.

**Block If:**
- Making the bump resolve requires `--legacy-peer-deps`, `--force`, an `overrides` block, a `resolutions` block, or
  a `.npmrc` change. That is AC2's explicit prohibition, and the correct response is the HOLD branch, not a HALT.
- Landing v17 would require editing `bp_front/src/` or `bp_front/e2e/` product or test code. A source change to
  absorb a dependency major is out of S-AC4's "only version numbers and the changes strictly required by the
  upgrade"; take the HOLD branch instead.
- A **peer package** would have to move to unblock `graphql` (e.g. bumping `@graphql-codegen/cli`). AC1 fixes the
  four at "the versions Story 7.7 landed"; record what a peer bump *would* unblock, do not take it.

**Never:**
- No backend change and no `gradle/libs.versions.toml` change — `graphql` here is the npm package; the backend's
  `graphql-java` is a separate line that Story 7.12 already moved.
- No weakened assertion, no widened `ignores`, no `skipLibCheck`, no `@ts-expect-error`, no disabled lint rule.
- No other npm version moves. `@apollo/client` `4.2.12` exists against the locked `4.2.11`; that patch drift is
  **not** this story's and must not be swept in (S-AC4) — note it for the ledger instead.
- No hand-edit of `bp_front/src/__generated__/`. It changes only via `npm run generate`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Peer sweep | `package-lock.json` at `26a441f` | every `graphql` peer range in the tree listed with its declaring package and version | A range excluding `^17` is the blocking finding, recorded verbatim |
| Plain install | `npm install graphql@17.0.2`, no flags, no `.npmrc` | either exit 0 (LAND branch) or a hard `ERESOLVE` (HOLD branch) | Exit code and full stdout/stderr captured verbatim either way |
| Codegen, LAND branch | stack on `:2080`, fresh `CODEGEN_TOKEN`, `npm run generate` | exit 0; `git status --short bp_front/src/__generated__/` either empty (state "byte-identical" outright) or a committed change described in the record | A codegen crash under v17 is a HOLD trigger, captured verbatim |
| Runtime, LAND branch | the built bundle in the production image | queries, mutations and the `/api/subscriptions` socket all behave as before | Any behavioural difference is an upgrade regression → HOLD |
| Hold-back | any blocking finding above | `bp_front/package.json` and `package-lock.json` byte-identical to `26a441f`; ledger section added | Story closes `done`, never `blocked` |

</intent-contract>

## Code Map

All facts measured 2026-08-19 on a clean tree at `26a441f` (branch `epic7-maintenance`).

**Files this story may change:**
- `bp_front/package.json:21` — `"graphql": "16.14.2"` → the latest 17.x, **LAND branch only**.
- `bp_front/package-lock.json` — the resolved tree. LAND branch only.
- `bp_front/src/__generated__/` — LAND branch only, and only if `npm run generate` output actually moves.
- `_bmad-output/implementation-artifacts/deferred-work.md` — a `## Deferred from: Story 7.13 …` section.
  **Required on the HOLD branch** (NFR-E7-1 needs the named blocking symptom); on the LAND branch only if the pass
  produces debt. Insertion point is **line 1257**, i.e. after the Story 7.12 section (1175–1256) and before
  `## Deferred from: code review of 7-12-…`. Re-measure before editing and verify both surrounding regions unchanged.
- `_bmad-output/project-context.md` — the `graphql 16.14.2 + graphql-ws 6.2.1` bullet (`:116`). On HOLD this becomes
  a **directive** ("the major is held at 16; patches inside 16.x stay in scope"), exactly as Story 7.10 did for
  TypeScript at `:91-112`. Prepend a Story 7.13 entry to the `_Last Updated` chain and adjudicate `rule_count`
  (currently **98**). Detail goes to the ledger, not here.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `:123` `7-13-graphql-16-to-17` `backlog` → `done`
  with the measured evidence; `:38` `last_updated` refreshed.

**Read-only — the verification targets:**
- `bp_front/src/__generated__/fragment-masking.ts:3` — `import { FragmentDefinitionNode } from 'graphql'`, the
  project's **only** source-side import of the package. Everything else reaches `graphql` through Apollo.
- `@apollo/client` 4.2.11 — **23 non-CJS files import from `'graphql'`** (`Kind`, `visit`, `BREAK`,
  `OperationTypeNode`, `print`), including `core/QueryManager.js`, `cache/inmemory/writeToStore.js` and
  `utilities/graphql/print.js`. This is why `graphql` is in the shipped chunk and why S-AC2 is not vacuous here.
- `bp_front/codegen.ts` — client preset, `fragmentMasking: true`, schema introspected live from `:2080`.
- `bp_front/playwright.config.ts:25` — `retries: process.env.CI ? 2 : 0`; `CI` must stay unset.

## Tasks & Acceptance

**Execution:**
- [x] **Baseline, before anything moves.** Confirm `git status --short` clean on `epic7-maintenance`. Create
      `.tmp/08e33719-15e2-4db4-81aa-46a8b89c7cf3/`. Copy `bp_front/package.json` and `package-lock.json` aside and
      record their md5s — they are the HOLD-branch integrity check. Capture `npm run lint`, `npm run build`
      (after `rm -rf bp_front/node_modules/.tmp`, since `tsc -b` caches per project), the built chunk name/size, and
      `npm audit --package-lock-only`. Then `docker compose up -d --build` and the full `npm run test:e2e` at
      `retries: 0`, plus the split via `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`
      (never `--list --project=`). **If the baseline E2E is red, re-run it once** — the size-driven `createUserViaUi`
      defect is filed; if still red for a different reason, HALT.
- [x] **AC1 — the peer check, at resolution level, before any attempt.** Record `npm view graphql dist-tags`. For
      each of the four named packages record its **locked version** and its `graphql` peer range. Then sweep the
      whole lockfile for `graphql` peers and list every declaring package. **State the finding whichever way it goes**
      — including, explicitly, that all four named peers accept `^17` if that is still true. Any package whose range
      excludes `^17` is quoted verbatim with its version and how it enters the tree.
- [x] **Route.** If the sweep finds a blocker, still run the *plain* `npm install graphql@<latest 17.x>` **once**, with
      no flags, and capture exit code and output verbatim — Story 7.10 measured that npm *warns* rather than fails for
      an explicitly-versioned target, so "the sweep says no" and "npm says no" are two different facts and the record
      needs both. Then decide:
      **HOLD** if the install hard-fails, **or** if it succeeds but any later gate would need a forbidden workaround.
      **LAND** only if the install resolves cleanly and every gate below is green unaided.
- [x] **LAND branch — codegen first.** Rebuild the stack, mint a fresh `CODEGEN_TOKEN`, run `npm run generate`, then
      `git status --short bp_front/src/__generated__/`. **Falsify the instrument before trusting it** (Story 7.12's
      pattern): perturb one generated file, confirm `git status` reddens, confirm the next run restores it to its
      exact md5. If the output is byte-identical, **say so outright**; if it moved, commit it and say what moved.
- [x] **LAND branch — the gates.** `npm run lint` exit 0; `rm -rf node_modules/.tmp && npm run build` exit 0 with the
      chunk name/size compared against the baseline; `docker compose build bp_front` exit 0 (proves v17 resolves under
      `node:26-alpine` on musl and satisfies its `engines`); `docker compose up -d --build && npm run test:e2e` exit 0
      at `retries: 0` with the split re-measured. `:bp_back:test` is **out of this story's gate** — no Gradle change —
      and the record must say so rather than omit it.
- [x] **LAND branch — S-AC2, which no green suite supplies.** `graphql` ships in the bundle, so take a real-browser
      pass on `:2080` at ~360px and desktop: theme tokens, spacing and type scale unchanged, and one query, one
      mutation and one live subscription exercised by hand. A bundle-size delta is recorded, not treated as a failure.
- [ ] **HOLD branch — revert and record.** *(NOT APPLICABLE — the LAND branch was taken. Deliberately left unchecked: a checked box means performed, and this revert/md5-confirm never ran.)* `git checkout -- bp_front/package.json bp_front/package-lock.json`, then
      confirm both md5s match the baseline copies. Insert the Story 7.13 ledger section naming the version attempted,
      the blocking package with its **published** peer range, the verbatim npm output, and the re-check trigger.
      State explicitly that no override, `--legacy-peer-deps` or `--force` was used, even transiently.
- [x] `_bmad-output/project-context.md` — record the outcome. On HOLD, rewrite the `graphql` bullet as a directive
      with the blocker named and "patches inside 16.x remain in scope"; on LAND, record the new version and any
      lockfile consequence. Prepend the `_Last Updated` entry; adjudicate `rule_count` from 98 with the arithmetic
      stated inline.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-13-…: done` with the measured evidence,
      `:38 last_updated` refreshed. Do not touch other stories' entries or open `action_items`.
- [x] **Commit alone.** One commit. On LAND, `git show --stat` shows `bp_front/package.json`,
      `bp_front/package-lock.json`, `bp_front/src/__generated__/` only if codegen moved, and the paperwork. On HOLD it
      shows the paperwork only — and **no `bp_front/` path at all**.

**Acceptance Criteria:**
- Given AC1, when the story closes, then the record names all four peers with their locked versions and `graphql`
  peer ranges measured in this pass, **plus** the full lockfile sweep, and states the finding explicitly whichever way
  it goes.
- Given AC2, when a package in the resolved tree refuses v17 **and that refusal actually blocks the upgrade** — the
  unflagged install hard-fails, or some gate can only be made green by a forbidden workaround — then `graphql` stays
  at the locked `16.14.2`, `bp_front/package.json` and `package-lock.json` are byte-identical to `26a441f`
  (md5-confirmed), `deferred-work.md` carries the blocking package and its published peer range, no override or
  `--legacy-peer-deps` was used, and the story closes **`done`**.
- Given AC2, when a package's `graphql` peer range excludes v17 but the refusal is measured **non-blocking** — the
  unflagged install resolves, and every gate is green unaided — then the LAND branch is permitted, the stale range is
  recorded in `deferred-work.md` with its re-check trigger anyway, and the record must **state the route decision and
  defend it** rather than let the two readings pass silently. This mirrors the epic's own wording, whose precondition
  is "Given any one unsupported peer **blocks** the upgrade" — a range that refuses v17 without blocking it does not
  fire that Given.
- Given AC3, when the bump lands, then `npm run generate` was re-run against the Story 7.12 schema with its output
  committed or stated byte-identical, and `npm run lint`, `npm run build`, `docker compose build bp_front` and the
  full four-project Playwright run at `retries: 0` are all recorded green, with the split showing exactly **1** test
  in each `registration-toggle-*` project.
- Given S-AC2, when the bump lands, then a real-browser pass on `:2080` at ~360px and desktop is recorded, covering a
  query, a mutation and a live subscription — because `graphql` reaches the shipped bundle through Apollo's 23
  importing modules.
- Given S-AC4, when the final diff is reviewed, then it contains no `overrides`/`resolutions` block, no `.npmrc`, no
  weakened assertion, no widened `ignores`, no peer-package version move, and no `bp_back/` or `gradle/` path.

## Spec Change Log

### 2026-08-19 — AC2 restated to match the epic, after the review found it self-contradictory

**Triggering finding (high).** The spec shipped two clauses pointing opposite ways on the only question the story
turns on. The Execution "Route" task authorised LAND when the unflagged install resolves and every gate is green
unaided; the Acceptance Criterion said "when **any** package in the resolved tree refuses v17, then `graphql` stays
at the locked `16.14.2`". `graphql-config@5.1.6` does refuse v17, so the AC as written mandated HOLD while the task
authorised the LAND that was taken — and the Implementation Record substituted the task's wording for the AC's
without ever acknowledging the conflict. Both reviewers found this independently; so did the orchestrator before the
reviewers reported.

**What was amended.** The AC was split into two, restoring the qualifier the epic's own AC2 carries and this spec
dropped in transcription: the epic reads "Given any one unsupported peer **blocks** the upgrade". A stale range that
refuses v17 without blocking it does not fire that Given. The HOLD clause now requires an *actually blocking*
refusal; a second clause makes the LAND-on-a-stale-range route explicit and **requires the record to state and
defend the route decision** rather than glossing it.

**Known-bad state avoided.** A spec whose recorded outcome fails its own AC, with the failure invisible because the
record quietly quoted the more permissive of two contradictory clauses. Note the code was **not** re-derived: the
defect is a document transcription error, the remedy is a document edit, and re-deriving would produce the identical
two-line version bump. That reasoning is recorded here so it can be challenged rather than assumed.

**KEEP.** The two-branch (LAND/HOLD) structure, both closing `done`, is correct and must survive — it is what kept
an unattended run from either force-installing or halting. The resolution-level sweep (rather than reading four peer
lines) is what found the blocker at all, and the instruction to attempt the unflagged install *anyway* is what
distinguished a stale range from a blocking one. Do not collapse these back into a single "check four peers" step.

## Review Triage Log

### 2026-08-19 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 13: (high 3, medium 5, low 5)
- defer: 4: (high 0, medium 2, low 2)
- reject: 2
- addressed_findings:
  - `[high]` `[patch]` **The spec's own AC2 mandated HOLD while the Route task authorised the LAND that was taken,
    and the record substituted one for the other silently.** AC2 split in two, restoring the epic's "**blocks** the
    upgrade" qualifier this spec dropped in transcription; a route-decision defence added to the record; full entry in
    the Spec Change Log. Classified `patch` rather than `bad_spec` deliberately: the root cause is a document
    transcription error, no code would change on re-derivation (the amended AC authorises the identical two-line
    bump), so a revert-and-re-derive could not serve the purpose the `bad_spec` branch exists for. Recorded so the
    call can be challenged.
  - `[high]` `[patch]` **S-AC2's md5 A/B was captured on `/auth`, the one route that executes zero GraphQL.** Verified:
    `src/routes/AuthPage.tsx` and `src/lib/auth/` contain no Apollo hook; all 17 hook sites are elsewhere. The
    rigorous-looking instrument covered the surface where the dependency is least exercised, while the GraphQL screens
    got only an uncompared eyeball pass. **Re-done in this pass** against a seeded fixture on the shopping view
    `/list/:id` (a category, three items, one checked): screenshots **md5-identical** at 1440×900
    (`f26945aad334d30b606e59b1d331e775`) and 360×740 (`a75cb2fbde7792e8be2768af5b1087f4`), 12-selector computed-style
    probe **identical** at both widths with the 2 non-matching selectors named rather than counted as coverage.
  - `[high]` `[patch]` **Only the screenshot half of the render comparator was ever falsified, with a perturbation
    (`#121212 → #111213`) the style probe provably could not see** — `rgb(18,18,18)` appears nowhere in its output —
    and the 360 path was never falsified at all. Re-falsified properly: `h6{letter-spacing:3px}` +
    `.MuiChip-root{border-radius:2px}` reddens **both** instruments at **both** viewports (screenshots
    `54dbc716…` / `35450c57…`; probe `"ls": "normal" → "3px"`, `"radius": "16px" → "2px"`).
  - `[medium]` `[patch]` **The "42 peers / 0 unsatisfied at baseline" claim was reported as measured, but its evidence
    script died with `SyntaxError: Unexpected token ':'` before printing anything** (`require()` on a file not ending
    `.json`). The claim is true — re-measured properly in this pass against `git show 26a441f:…` with the receipt kept
    at `.tmp/…/peer-sweep-both-lockfiles.txt` — but it had no receipt, in an epic whose standing rule is that a number
    is quoted only from a measurement you took and kept.
  - `[medium]` `[patch]` **`.MuiPaper-root` was listed among the probed selectors but matched nothing** (`ABSENT` on
    both sides), and `button`/`.MuiButton-root` plus `input`/`.MuiTextField-root` were the same nodes counted twice —
    an "eight-element probe" that was really five nodes, one non-existent. The replacement probe names its ABSENT
    selectors explicitly.
  - `[medium]` `[patch]` **`deferred-work.md` asserted unhedged what the record retracts three sections later** — that
    `npm ls graphql` "exits 1 where it exited 0 before", while the record admits the baseline `npm ls` was never
    observed. Ledger reworded to say what was actually measured (the sweep), now with a real receipt.
  - `[medium]` `[patch]` **`project-context.md` dropped the load-bearing hedge**, stating "the refusal is stale rather
    than functional" without the record's "*on that path*" qualifier — in the file agents load as rules. Hedge restored.
  - `[medium]` `[patch]` **The ledger's "no fix available today" excluded the remedy the AC itself named** — holding at
    16.14.2, where the same sweep shows 42/42 satisfied. It presented a chosen trade-off as forced by the registry;
    the word HOLD appeared nowhere. Reworded to name the declined alternative.
  - `[medium]` `[patch]` `project-context.md` carried ~15 lines of ledger detail into a Technology Stack list whose
    other entries are one line, against the spec's explicit "detail goes to the ledger, not here". Trimmed.
  - `[low]` `[patch]` **"one permanently-unmet peer" versus the 25 tree positions `npm ls` actually flags** (measured:
    25 `invalid:` lines, exit 1). One *declaring* package, 25 flagged nodes; corrected everywhere so an agent seeing 25
    red lines is not mis-set.
  - `[low]` `[patch]` **"42 packages" is 42 lockfile entries / 41 distinct names** (`@graphql-tools/utils` appears at
    two versions), and one of the "41 admitting `^17`" is `@ardatan/relay-compiler@13.0.2` with peer `*`, which admits
    everything and is no evidence of v17 support. Arithmetic corrected and the wildcard named.
  - `[low]` `[patch]` **"which also shows the build is deterministic" is an absolute from n=1**, and the "byte-for-byte"
    reproduction was inferred from a matching content-hash filename with no `cmp`. Softened to what was observed.
  - `[low]` `[patch]` A `[x]` sat on the HOLD-branch task while its own annotation said not applicable. Returned to
    `[ ]` with the reason, plus the `_Last Updated` double-blank-line fix and the `rule_count` arithmetic the spec
    asked for and the record asserted instead.
  - `[medium]` `[defer]` `npm ci --dry-run --strict-peer-deps` fails `ERESOLVE`; the image build's green result is
    conditional on a default nothing in the repo pins.
  - `[medium]` `[defer]` Codegen's failure branch is unexercised under v17 (`ignoreNoDocuments` + `allowPartialOutputs`
    mean a parse regression could exit 0 with partial output).
  - `[low]` `[defer]` No `engines` field or `.nvmrc` fences graphql 17's narrowed Node floor (`^22 || ^24 || ^25 || >=26`).
  - `[low]` `[defer]` The known-invalid-peer state is recorded only in `_bmad-output/`, nowhere inside `bp_front/`
    where someone hitting `npm ls` exit 1 would look.
  - `[low]` `[reject]` "Story marked `done` in sprint-status while the spec is `in-review`" — that is this workflow's
    normal ordering; the review outcome is appended at finalize, exactly as Story 7.12 did.
  - `[low]` `[reject]` Vite dev-server `development` export condition flagged as an untested risk: **measured, not
    accepted.** graphql 16.14.2 ships no `exports` field; 17.0.2 adds one whose `.` has a `development` branch, and
    Vite does pre-bundle it (`node_modules/.vite/deps/__dev__-K0d2rK4q.js` exists). But `npm run dev` on `:5173` was
    then actually run: the app renders a live list with real backend data through that build, **0 console errors, 0
    warnings**. A real coverage gap, closed by measurement rather than filed.

## Design Notes

### 1 — The blocker is a fifth package, and none of AC1's four peer lines reveals it

Measured 2026-08-19 from `bp_front/package-lock.json`: 42 packages declare a `graphql` peer. All four AC1 names
accept v17 — `@apollo/client@4.2.11` `^16.0.0 || ^17.0.0`, `graphql-ws@6.2.1` `^15.10.1 || ^16 || ^17`, and both
`@graphql-codegen/cli@7.2.0` and `@graphql-codegen/client-preset@6.1.3` ending `… || ^17.0.0`. So does every
`@graphql-tools/*`, `graphql-tag` and `@graphql-typed-document-node/core`.

**One does not: `graphql-config@5.1.6`, peer `^0.11.0 || ^0.12.0 || ^0.13.0 || ^14.0.0 || ^15.0.0 || ^16.0.0`.** It
is a **hard dependency** of `@graphql-codegen/cli@7.2.0` (`"graphql-config": "^5.1.6"`), and `5.1.6` is `latest` on
the registry — there is no newer release to take. So `@graphql-codegen/cli` advertises v17 in its own peer line while
shipping a dependency that refuses it. That resolves AC1's apparent ambiguity: the four are checked, and the
codegen CLI **fails** the check at resolution level. Do not spend a pass rediscovering this from an `ERESOLVE` dump —
re-measure it to confirm it still holds, then route.

### 2 — Why the install must still be attempted once, unflagged

Story 7.10 measured that `npm install typescript@7.0.2` **succeeded, exit 0**, with only
`npm warn ERESOLVE overriding peer dependency`, because npm treats an explicitly-versioned install target as
authoritative. The conflict shape here is identical (a transitive peer against an explicitly-versioned root
dependency), so the sweep predicting a blocker does **not** predict a failed install. Run it once with no flags and
record what npm actually does. A `warn`-and-succeed is not a force and is not the HOLD trigger by itself — the HOLD
trigger is a hard failure, or a later gate that only a forbidden workaround could make green.

### 3 — This bump is not like the four before it

TypeScript, ESLint, Vite and `@types/node` are build-time. `graphql` is **runtime**: Apollo imports `Kind`, `visit`,
`BREAK`, `print` and `OperationTypeNode` from it across 23 modules, so v17 changes bytes in the shipped chunk. The
generated documents are pre-built AST literals in `src/__generated__/graphql.ts`, so codegen output moving is not the
only exposure — Apollo's own parse/print/visit path over those ASTs is. Hence the real-browser pass on the LAND
branch, and hence `docker compose build bp_front` rather than a host-only build: v17's `engines` is
`^22 || ^24 || ^25 || >=26`, and the image is `node:26-alpine` (musl).

## Verification

**Commands:**
- `node -e` sweep over `bp_front/package-lock.json` for every `peerDependencies.graphql` — expected: the declaring
  package, version and range for each, with any non-`^17` range surfaced.
- `npm view graphql dist-tags --json` — expected: the `latest` and `latest-16` tags, measured in this pass.
- `npm install graphql@<latest 17.x>` with no flags — expected: exit code and full output captured verbatim.
- `npm run generate` then `git status --short bp_front/src/__generated__/` (LAND) — expected: empty, with
  "byte-identical" stated outright, or a committed change described.
- `npm run lint`; `rm -rf bp_front/node_modules/.tmp && npm run build`; `docker compose build bp_front` (LAND) —
  expected: exit 0 each, chunk name and size compared against the baseline.
- `docker compose up -d --build && npm run test:e2e` — expected: exit 0 at `retries: 0`, split re-measured with
  exactly 1 test in each `registration-toggle-*` project.
- `md5sum bp_front/package.json bp_front/package-lock.json` against the baseline copies (HOLD) — expected: identical.

**Manual checks (if no CLI):**
- LAND only: `http://localhost:2080` in a real browser at ~360px and desktop — theme tokens, spacing and type scale
  unchanged; a list query renders, an item save round-trips, and a second session's edit arrives over the
  subscription without a reload.

## Implementation Record

**Status: implemented (LAND).** `graphql` **16.14.2 → 17.0.2** in `bp_front/`, pinned exactly. One commit. Every
number below was measured in this pass on a clean tree at `26a441f` (branch `epic7-maintenance`); nothing is quoted
from an earlier story.

### The route decision, and why the sweep and npm disagreed

`npm view graphql dist-tags`: `latest` **17.0.2**, `latest-16` **16.14.2** — so 16 was already at its head and
`17.0.2` is the newest 17.x. v17 `engines`: `^22.0.0 || ^24.0.0 || ^25.0.0 || >=26.0.0`.

AC1 was answered at **resolution** level, over the whole lockfile, not from four peer lines. **42 lockfile entries
declare a `graphql` peer — 41 distinct package names, since `@graphql-tools/utils` appears at two versions — and
exactly one does not admit `^17.0.0`.** (Corrected at review: the first pass said "42 packages" throughout. One of the
41 admitting entries is `@ardatan/relay-compiler@13.0.2` with peer `*`, which admits everything and is therefore no
evidence of v17 support; it is counted separately for that reason.) All four packages AC1 names accept v17, and that is
**stated explicitly because it is the finding**:

| package | locked version | `graphql` peer range |
|---|---|---|
| `@apollo/client` | 4.2.11 | `^16.0.0 \|\| ^17.0.0` |
| `graphql-ws` | 6.2.1 | `^15.10.1 \|\| ^16 \|\| ^17` |
| `@graphql-codegen/cli` | 7.2.0 | `^0.8.0 \|\| … \|\| ^16.0.0 \|\| ^17.0.0` |
| `@graphql-codegen/client-preset` | 6.1.3 | `^0.8.0 \|\| … \|\| ^16.0.0 \|\| ^17.0.0` |

The one refusal, verbatim: **`graphql-config@5.1.6`, peer
`^0.11.0 || ^0.12.0 || ^0.13.0 || ^14.0.0 || ^15.0.0 || ^16.0.0`.** It enters as a **hard dependency** of
`@graphql-codegen/cli@7.2.0` (`"graphql-config": "^5.1.6"`, confirmed both in the lockfile and from
`npm view @graphql-codegen/cli@7.2.0 dependencies.graphql-config`), and `5.1.6` is registry `latest` — the only newer
publishes are `5.1.6-alpha-*` prereleases and the stale `next` `3.0.0-rc.3` / `guild` `3.0.0-alpha.13` tags. Design
Notes §1 re-measured and **still holds**.

Design Notes §2 also held, and the two facts really are different. `npm install graphql@17.0.2`, **no flags, no
`.npmrc` anywhere in the tree**, exits **0** with only `npm warn ERESOLVE overriding peer dependency`. npm's
resolution is to **nest** `graphql-config` under `node_modules/@graphql-codegen/cli/`, which changes nothing about
the conflict — there is still exactly one `graphql` in the tree and it is 17.0.2. Full warning captured in
`.tmp/…/pin-install.txt`. So the sweep says "no" and npm says "yes, with a warning", and the route was decided by the
gates rather than by either.

**Newly measured, and not in the spec** (and **re-measured at review**, because the first pass's evidence script
crashed before printing — see "What was NOT established"): the same sweep over the **baseline** lockfile returns
**42 entries, 0 unsatisfied by 16.14.2**. So `npm ls graphql` exiting **1** (`graphql@17.0.2 deduped invalid: "…^16.0.0" from
node_modules/@graphql-codegen/cli/node_modules/graphql-config`) is a **new** state this bump introduces, not a
pre-existing one. **Corrected at review:** that is *one declaring package* but **25 flagged tree positions** —
`npm ls graphql` prints 25 `invalid:` lines. An agent told to expect "one unmet peer" and seeing 25 red lines has been
mis-set, so the count is stated both ways everywhere it appears. It is filed as debt rather than repaired.

### The route decision, stated and defended (required by the amended AC2)

**Corrected at review — the first pass took this route without ever naming the conflict.** `graphql-config@5.1.6` is
an unsupported peer in the resolved tree, and the spec as originally written had an AC reading "when **any** package
in the resolved tree refuses v17, then `graphql` stays at the locked `16.14.2`" — which mandated HOLD — beside a Route
task authorising LAND on green gates. The record quoted the task and passed over the AC in silence.

The route taken is still LAND, and the argument is this. The epic's own AC2 reads **"Given any one unsupported peer
*blocks* the upgrade"**; the spec dropped "blocks" in transcription. `graphql-config`'s range refuses v17 but does not
block it: the unflagged install resolves (exit 0), `npm ci` resolves the same way inside `node:26-alpine`, and
`npm run generate` — the *only* path `graphql-config` sits on in this project, where its entire runtime graphql
surface is `buildASTSchema` + `print`, both present in 17 — exits 0 with byte-identical output. Nothing was forced to
achieve that. AC2's own prohibition is on *force-installing, overriding, or `--legacy-peer-deps`-ing past* a peer, and
none of those was used; the epic's stated purpose is "either land the last major or record exactly what is blocking
it", and measurement showed nothing blocking, only a stale range.

**What LAND costs, stated rather than buried:** the tree now carries a permanently-unmet peer and `npm ls graphql`
exits 1, flagging **25** tree positions. The declined alternative — hold at 16.14.2, where the same sweep shows 42/42
satisfied — was a real option, not an impossibility, and it is named as such in the ledger. This is a judgment call
against a literal reading of the spec's original AC; the AC has been amended to match the epic, with the reasoning in
the Spec Change Log so it can be challenged rather than assumed.

### Gates, all green, all measured here

| gate | result |
|---|---|
| baseline `npm run lint` / `npm run build` | exit 0 / exit 0 — chunk `index-D0HEEKre.js` **801.60 kB**, gzip **240.42 kB**, **1255** modules |
| baseline `npm run test:e2e` | **120 passed (46.7s)**, exit 0, `retries: 0`, split **59 / 59 / 1 / 1** — green first try, so the filed `createUserViaUi` flake never fired and the re-run/HALT branch was never entered |
| `npm run generate` under v17 | exit 0; `git status --short bp_front/src/__generated__/` **empty** — the four generated files are **byte-identical**, stated outright (`graphql.ts` `27a530103ba703e857d91eaf55dcbf9d`) |
| `npm run lint` under v17 | exit 0 |
| `npm run build` under v17 (after `rm -rf node_modules/.tmp`) | exit 0 — `index-dd3zm4T-.js` **802.34 kB**, gzip **240.67 kB**, **1297** modules → **+0.74 kB raw, +0.25 kB gzip, +42 modules** |
| `docker compose build bp_front` | exit 0 — `npm ci` inside `node:26-alpine` emits the same `npm warn ERESOLVE` and completes, proving v17 resolves on **musl** and satisfies its `engines` |
| `docker compose up -d --build && npm run test:e2e` | **120 passed (47.0s)**, exit 0, `retries: 0`, split re-measured **59 / 59 / 1 / 1** — exactly **1** test in each `registration-toggle-*` project |
| `npm audit --package-lock-only` | 1 high (`js-yaml` GHSA-5p4m-2wfm-xmqj) **before and after** — pre-existing, not this story's, not swept |
| `./gradlew :bp_back:test` | **not run, and correctly out of gate** — no `gradle/` or `bp_back/` path is touched; the backend's `graphql-java` is a separate line Story 7.12 already moved |

### S-AC2 — A/B on the GraphQL-rendering route (corrected at review)

`graphql` is a **runtime** dependency here (Apollo imports `Kind`, `visit`, `BREAK`, `print`, `OperationTypeNode`
across 23 modules), so a green suite proves nothing about rendering. The baseline `dist` was rebuilt from the stashed
lockfile, reproducing the filename `index-D0HEEKre.js`, then `docker cp`-ed over the running Caddy container's
`/srv`, verified served (`curl` shows `assets/index-D0HEEKre.js`, and `assets/index-dd3zm4T-.js` again after restore,
so the A/B was real).

**Corrected at review — do not restore the earlier wording.** The first pass captured this A/B on **`/auth`**, and
called it "discharged … not by assertion". `/auth` is the one route in the app that executes **zero** GraphQL:
`src/routes/AuthPage.tsx` and `src/lib/auth/` contain no Apollo hook (all 17 hook sites are under `routes/Lists*`,
`routes/ListDetail*`, `routes/ListShopping*`, `routes/AdminPage`, `components/*Dialog`, `lib/*/…Queries.ts`). So the
most rigorous-looking instrument in the pass covered the surface where the dependency is *least* exercised, while the
screens that actually parse, print and visit documents got only an uncompared eyeball pass. The original `/auth`
captures still stand (`00177dc4…` desktop, `615a522f…` at 360) — they are simply near-vacuous for this bump.

**Re-done at review on the shopping view `/list/:id`**, against a purpose-seeded fixture (a fresh registered user, one
list, one category, three items with one checked) so both sides render identical data:

- screenshots **md5-identical**: `f26945aad334d30b606e59b1d331e775` (1440×900),
  `a75cb2fbde7792e8be2768af5b1087f4` (360×740, Pixel 7 UA + `isMobile`);
- a 12-selector computed-style probe (`body`, `h4`, `h6`, `p`, `button`, `input`, `.MuiChip-root`, `.MuiCard-root`,
  `.MuiListItem-root`, `.MuiCheckbox-root`, `.MuiDivider-root`, `.MuiAppBar-root`) over colour, background,
  font-family/size/weight, line-height, letter-spacing, margin, padding, radius, shadow, border and bounding rect —
  **identical at both widths**. **10 of the 12 matched; `.MuiCard-root` and `.MuiListItem-root` are `ABSENT` on this
  route and are named rather than counted as coverage** — the first pass silently counted an `ABSENT`
  `.MuiPaper-root` among its eight, and listed `button`/`.MuiButton-root` and `input`/`.MuiTextField-root`, which are
  the same nodes twice.

Hand pass on `:2080` under v17: a **query** (list detail and shopping views render), **mutations** (create list,
create category, add item — each round-tripping, with the inline "Choose a category" validation still firing), and a
**live subscription** (checking `Bananas` in one tab flips the checkbox in a second tab with no reload, over
`/api/subscriptions`). The only console error on load is the expected `401` from the silent `POST /api/auth/refresh`
with no cookie.

### The Vite dev server runs a different graphql build, and it was measured rather than assumed

Found at review, and new information about the package rather than about this repo: **graphql 16.14.2 ships no
`exports` field at all; 17.0.2 adds one whose `.` entry carries a `development` condition** resolving to a separate
`__dev__/` build. Vite's default client conditions include `development` in serve mode, so `npm run dev` on `:5173` —
the documented daily inner loop — loads a build that **every gate in this pass structurally missed**: `vite build`,
`docker compose build` and Playwright against `:2080` are all production-conditioned. Confirmed present:
`node_modules/.vite/deps/__dev__-K0d2rK4q.js`.

Then actually exercised, because a named gap is not a finding until it is measured: the dev server was started, the
app loaded, and it rendered a real list with live backend data through that `__dev__` build with **0 console errors
and 0 warnings**. Recorded as closed, not filed.

### Both instruments falsified — correctly, at review

- **Codegen.** An empty `git status` is also what a run that silently wrote nothing produces. A perturbation line
  appended to `src/__generated__/graphql.ts` reddens `git status` (md5 `c97f34e2a5dda757af2d940898107983`), and the
  next `npm run generate` restores it to exactly `27a530103ba703e857d91eaf55dcbf9d`.
- **The render comparator — corrected at review.** The first pass claimed "both instruments falsified" while
  falsifying only the **screenshot**, at only the **desktop** viewport, with a perturbation (`#121212 → #111213`) the
  style probe **provably could not see**: `rgb(18, 18, 18)` appears nowhere in its output, whose only backgrounds are
  `rgb(0,0,0)`, `rgb(77,201,187)` and `rgba(0,0,0,0)`. The finer-grained instrument was never shown capable of going
  red. Re-falsified with a change the probe records — `h6{letter-spacing:3px}` + `.MuiChip-root{border-radius:2px}` —
  and **both** instruments redden at **both** viewports: screenshots `54dbc716…` (desktop) / `35450c57…` (360), probe
  `"ls": "normal" → "3px"` and `"radius": "16px" → "2px"`.

### What was NOT established

- **That `graphql-config` is v17-safe generally.** Only the path this project walks — `@graphql-codegen/cli` loading
  `codegen.ts` — was exercised. The peer refusal is measured *stale on that path*, not measured wrong in general.
- **That the +42 modules / +0.74 kB come from v17's own module graph** rather than from a Rolldown chunking
  difference. The delta is recorded, not explained, and is not treated as a failure (S-AC2 allows this explicitly).
- **Whether `npm ls graphql` exited 0 at baseline** — still not observed directly; the baseline `node_modules` was
  replaced before that check occurred to anyone. What *is* now properly measured is the sweep it was inferred from:
  **corrected at review**, the first pass reported "42 peers, 0 unsatisfied by 16.14.2" as measured while its evidence
  script had died with `SyntaxError: Unexpected token ':'` (a `require()` on a copy not ending in `.json`) before
  printing anything. Re-run against `git show 26a441f:bp_front/package-lock.json`, receipt kept at
  `.tmp/…/peer-sweep-both-lockfiles.txt`: baseline **42 entries / 0 unsatisfied by 16.14.2**, head **42 entries / 1
  unsatisfied by 17.0.2**. The conclusion held; the receipt did not exist.
- **That the build is deterministic.** The first pass wrote that the baseline rebuild "shows the build is
  deterministic" — **withdrawn at review**: that is an absolute from n=1, and the "byte-for-byte" reproduction was
  inferred from a matching content-hash filename with no `cmp` or md5 of the chunk contents. What was observed is that
  this build reproduced its chunk *name* once, on one machine, in one session.

### Scope

Nothing was weakened or worked around. No `--legacy-peer-deps`, no `--force`, no `overrides`, no `resolutions`, no
`.npmrc` — not even transiently. No peer package moved: `@apollo/client` 4.2.11, `graphql-ws` 6.2.1,
`@graphql-codegen/cli` 7.2.0, `@graphql-codegen/client-preset` 6.1.3 are all at their locked versions, and the
available `@apollo/client` **4.2.12** patch was deliberately **not** swept in (ledger). No assertion edited, no
`ignores` widened, no `skipLibCheck`, no `@ts-expect-error`, no disabled rule, no `src/` or `e2e/` change, no
`bp_back/` or `gradle/` path, no hand-edit of `src/__generated__/`. `package.json` keeps the project's exact-pin style
(`"graphql": "17.0.2"`, not the `^17.0.2` npm wrote).

Paperwork: `deferred-work.md` gains a `## Deferred from: Story 7.13` section (two items: the permanently-unmet
`graphql-config` peer with its re-check trigger, and the un-swept Apollo patch) inserted at the re-measured position
after the Story 7.12 section and before the 7.12 code-review section, verified as a pure 40-line addition;
`project-context.md`'s `graphql` bullet is rewritten with the new version and the one new directive, `rule_count`
98 → **99**, `_Last Updated` prepended; `sprint-status.yaml` `7-13-…: done` with `last_updated` refreshed.

## Auto Run Result

Status: **done** — LAND. `graphql` **16.14.2 → 17.0.2**, the epic's last dependency major.

### Implemented change

The frontend `graphql` package moved to v17 in one commit (`9f9e36c`), with no application source change. The route
was decided at resolution level rather than from peer lines: 42 lockfile entries declare a `graphql` peer, and the one
that refuses v17 — `graphql-config@5.1.6`, a hard dependency of `@graphql-codegen/cli@7.2.0`, already registry
`latest` — was measured **stale rather than blocking**. The unflagged install resolves, `npm ci` resolves the same way
on musl, and `npm run generate` (the only path `graphql-config` sits on here) exits 0 leaving all four generated files
byte-identical. Nothing was forced: no `--legacy-peer-deps`, `--force`, `overrides`, `resolutions` or `.npmrc`, and no
peer package moved. The accepted cost is a permanently-unmet peer: `npm ls graphql` exits 1, flagging 25 tree
positions, filed with an explicit never-override instruction.

### Files changed

- `bp_front/package.json` — `graphql` `16.14.2` → `17.0.2`, keeping the project's exact-pin style.
- `bp_front/package-lock.json` — resolved tree; npm nests `graphql-config` under the codegen CLI.
- `_bmad-output/implementation-artifacts/deferred-work.md` — a Story 7.13 section: the unmet peer with its re-check
  trigger, the un-swept Apollo patch, and the four deferrals this review filed.
- `_bmad-output/project-context.md` — `graphql` bullet rewritten as three directives; `rule_count` 98 → 101 with the
  arithmetic stated; `_Last Updated` prepended and corrected at review.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-13-…: done` with the measured evidence and the
  review outcome.
- `_bmad-output/implementation-artifacts/spec-7-13-graphql-16-to-17.md` — this spec, its record, and the review logs.

### Review findings

**13 patches applied** (3 high, 5 medium, 5 low). The three high ones each changed what the story claims: the spec's
AC2 contradicted its own Route task and mandated HOLD where LAND was taken (AC split, route decision now defended,
Spec Change Log entry); S-AC2's md5 A/B had been captured on `/auth`, the one route executing zero GraphQL (re-done on
the shopping view against a seeded fixture, md5-identical at both viewports); and "both instruments falsified" was
false — only the screenshot was, at one viewport, with a perturbation the style probe provably could not see
(re-falsified, both instruments red at both viewports). The medium and low patches were corrections to overclaimed
arithmetic and dropped hedges: a crashed evidence script behind a figure reported as measured, `.MuiPaper-root`
counted as coverage while matching nothing, "42 packages" vs 42 entries / 41 names, "one unmet peer" vs 25 flagged
positions, a ledger claim stated unhedged that the record retracts, a "stale not functional" hedge dropped in the
rules file, "no fix available" excluding the declined HOLD, and "the build is deterministic" asserted from n=1.

**4 deferrals filed:** `npm ci --dry-run --strict-peer-deps` fails, so the image build's green result rests on an npm
default nothing pins; codegen's failure branch is unexercised under v17 while `ignoreNoDocuments` +
`allowPartialOutputs` permit a silent partial success; no `engines`/`.nvmrc` fences v17's narrowed Node floor; and the
known-invalid-peer state is recorded nowhere inside `bp_front/`.

**2 rejected:** the `done`-before-review ordering (normal for this workflow, appended at finalize as 7.12 did), and
the Vite dev-server `development` condition — flagged as an untested risk but **measured** instead of accepted: v17
adds an `exports` map whose `development` branch Vite's serve mode selects, so `npm run dev` pre-bundles
`graphql/__dev__`, a build every gate here misses. The dev server was then run and the app renders a live list with
real backend data, 0 console errors. A real gap, closed by measurement.

### Verification performed

Re-verified independently by the orchestrator, matching the implementation record: `npm run lint` exit 0;
`npm run build` exit 0 with `index-dd3zm4T-.js` 802.34 kB / 240.67 kB gzip (baseline 801.60 / 240.42, +42 modules);
`npm ls graphql` exit 1 with 25 `invalid:` positions; the peer sweep re-run against both lockfiles with the receipt
kept (baseline 42/0, head 42/1). After the review's own changes and the bundle A/B, the full suite was re-run:
**120 passed (47.2s)** at `retries: 0`, split re-measured **59 / 59 / 1 / 1**, and the served bundle confirmed back on
`index-dd3zm4T-.js`. `docker compose build bp_front` exit 0 and codegen byte-identity stand from the implementation
pass. `:bp_back:test` is correctly out of gate — no `gradle/` or `bp_back/` path is touched.

### Residual risks

- The tree carries a permanently-unmet peer with no upstream fix available while graphql stays at 17; `npm ls` and
  routine installs will keep reporting it, and the standing instruction not to "repair" it lives only in
  `_bmad-output/` (filed).
- `graphql-config` is proven v17-safe only on the config-load path this project walks, not generally.
- The +0.74 kB / +42 modules delta is measured, not explained — v17's module graph versus Rolldown chunking.
- `npm ci` remains green only under npm's current permissive `strict-peer-deps` default (filed).
- Whether `npm ls graphql` exited 0 at baseline was never observed directly; it is inferred from the range sweep.
