---
title: 'Story 7.13 — `graphql` 16 → 17'
type: 'chore'
created: '2026-08-19'
status: 'in-progress'
baseline_revision: '26a441f'
review_loop_iteration: 0
followup_review_recommended: false
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
- [ ] **Baseline, before anything moves.** Confirm `git status --short` clean on `epic7-maintenance`. Create
      `.tmp/08e33719-15e2-4db4-81aa-46a8b89c7cf3/`. Copy `bp_front/package.json` and `package-lock.json` aside and
      record their md5s — they are the HOLD-branch integrity check. Capture `npm run lint`, `npm run build`
      (after `rm -rf bp_front/node_modules/.tmp`, since `tsc -b` caches per project), the built chunk name/size, and
      `npm audit --package-lock-only`. Then `docker compose up -d --build` and the full `npm run test:e2e` at
      `retries: 0`, plus the split via `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`
      (never `--list --project=`). **If the baseline E2E is red, re-run it once** — the size-driven `createUserViaUi`
      defect is filed; if still red for a different reason, HALT.
- [ ] **AC1 — the peer check, at resolution level, before any attempt.** Record `npm view graphql dist-tags`. For
      each of the four named packages record its **locked version** and its `graphql` peer range. Then sweep the
      whole lockfile for `graphql` peers and list every declaring package. **State the finding whichever way it goes**
      — including, explicitly, that all four named peers accept `^17` if that is still true. Any package whose range
      excludes `^17` is quoted verbatim with its version and how it enters the tree.
- [ ] **Route.** If the sweep finds a blocker, still run the *plain* `npm install graphql@<latest 17.x>` **once**, with
      no flags, and capture exit code and output verbatim — Story 7.10 measured that npm *warns* rather than fails for
      an explicitly-versioned target, so "the sweep says no" and "npm says no" are two different facts and the record
      needs both. Then decide:
      **HOLD** if the install hard-fails, **or** if it succeeds but any later gate would need a forbidden workaround.
      **LAND** only if the install resolves cleanly and every gate below is green unaided.
- [ ] **LAND branch — codegen first.** Rebuild the stack, mint a fresh `CODEGEN_TOKEN`, run `npm run generate`, then
      `git status --short bp_front/src/__generated__/`. **Falsify the instrument before trusting it** (Story 7.12's
      pattern): perturb one generated file, confirm `git status` reddens, confirm the next run restores it to its
      exact md5. If the output is byte-identical, **say so outright**; if it moved, commit it and say what moved.
- [ ] **LAND branch — the gates.** `npm run lint` exit 0; `rm -rf node_modules/.tmp && npm run build` exit 0 with the
      chunk name/size compared against the baseline; `docker compose build bp_front` exit 0 (proves v17 resolves under
      `node:26-alpine` on musl and satisfies its `engines`); `docker compose up -d --build && npm run test:e2e` exit 0
      at `retries: 0` with the split re-measured. `:bp_back:test` is **out of this story's gate** — no Gradle change —
      and the record must say so rather than omit it.
- [ ] **LAND branch — S-AC2, which no green suite supplies.** `graphql` ships in the bundle, so take a real-browser
      pass on `:2080` at ~360px and desktop: theme tokens, spacing and type scale unchanged, and one query, one
      mutation and one live subscription exercised by hand. A bundle-size delta is recorded, not treated as a failure.
- [ ] **HOLD branch — revert and record.** `git checkout -- bp_front/package.json bp_front/package-lock.json`, then
      confirm both md5s match the baseline copies. Insert the Story 7.13 ledger section naming the version attempted,
      the blocking package with its **published** peer range, the verbatim npm output, and the re-check trigger.
      State explicitly that no override, `--legacy-peer-deps` or `--force` was used, even transiently.
- [ ] `_bmad-output/project-context.md` — record the outcome. On HOLD, rewrite the `graphql` bullet as a directive
      with the blocker named and "patches inside 16.x remain in scope"; on LAND, record the new version and any
      lockfile consequence. Prepend the `_Last Updated` entry; adjudicate `rule_count` from 98 with the arithmetic
      stated inline.
- [ ] `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-13-…: done` with the measured evidence,
      `:38 last_updated` refreshed. Do not touch other stories' entries or open `action_items`.
- [ ] **Commit alone.** One commit. On LAND, `git show --stat` shows `bp_front/package.json`,
      `bp_front/package-lock.json`, `bp_front/src/__generated__/` only if codegen moved, and the paperwork. On HOLD it
      shows the paperwork only — and **no `bp_front/` path at all**.

**Acceptance Criteria:**
- Given AC1, when the story closes, then the record names all four peers with their locked versions and `graphql`
  peer ranges measured in this pass, **plus** the full lockfile sweep, and states the finding explicitly whichever way
  it goes.
- Given AC2, when any package in the resolved tree refuses v17, then `graphql` stays at the locked `16.14.2`,
  `bp_front/package.json` and `package-lock.json` are byte-identical to `26a441f` (md5-confirmed), `deferred-work.md`
  carries the blocking package and its published peer range, no override or `--legacy-peer-deps` was used, and the
  story closes **`done`**.
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

## Review Triage Log

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

AC1 was answered at **resolution** level, over the whole lockfile, not from four peer lines. **42 packages declare a
`graphql` peer; 41 admit `^17.0.0`; exactly one does not.** All four packages AC1 names accept v17, and that is
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

**Newly measured, and not in the spec:** the same sweep over the **baseline** lockfile returns **42 peers, 0
unsatisfied by 16.14.2**. So `npm ls graphql` exiting **1** (`graphql@17.0.2 deduped invalid: "…^16.0.0" from
node_modules/@graphql-codegen/cli/node_modules/graphql-config`) is a **new** state this bump introduces, not a
pre-existing one. It is filed as debt rather than repaired.

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

### Both instruments falsified before being trusted

- **Codegen.** An empty `git status` is also what a run that silently wrote nothing produces. A perturbation line
  appended to `src/__generated__/graphql.ts` reddens `git status` (md5 `c97f34e2a5dda757af2d940898107983`), and the
  next `npm run generate` restores it to exactly `27a530103ba703e857d91eaf55dcbf9d`.
- **The render comparator.** A one-token background change (`#121212` → `#111213`) applied in the live page changes
  the screenshot md5 (`00177dc4…` → `bccb6817…`), so md5-equality is sensitive to precisely the class of difference
  S-AC2 cares about.

### S-AC2 — discharged by A/B against the real baseline bundle, not by assertion

`graphql` is a **runtime** dependency here (Apollo imports `Kind`, `visit`, `BREAK`, `print`, `OperationTypeNode`
across 23 modules), so a green suite proves nothing about rendering. The baseline `dist` was rebuilt from the stashed
lockfile — reproducing `index-D0HEEKre.js` **byte-for-byte**, which also shows the build is deterministic — then
`docker cp`-ed over the running Caddy container's `/srv`, verified served (`curl` shows
`assets/index-D0HEEKre.js`, and `assets/index-dd3zm4T-.js` again after restore, so the A/B was real). The same
`/auth` page was captured under both bundles at **1440×900** and **360×740**:

- screenshots **md5-identical**: `00177dc4e2cf01d0fba0e9bd64a5da70` (desktop), `615a522fc22db1a857ad4957f1f4b39e` (360px);
- a computed-style probe over `body`, `h4`, `p`, `button`, `input`, `.MuiPaper-root`, `.MuiTextField-root`,
  `.MuiButton-root` — colour, background, font-family/size/weight, line-height, letter-spacing, margin, padding,
  border-radius, box-shadow, and bounding rect — **diffs clean at both widths**.

Hand pass on `:2080` under v17: a **query** (list detail and shopping views render), **mutations** (create list,
create category, add item — each round-tripping, with the inline "Choose a category" validation still firing), and a
**live subscription** (checking `Bananas` in one tab flips the checkbox in a second tab with no reload, over
`/api/subscriptions`). The only console error on load is the expected `401` from the silent `POST /api/auth/refresh`
with no cookie.

### What was NOT established

- **That `graphql-config` is v17-safe generally.** Only the path this project walks — `@graphql-codegen/cli` loading
  `codegen.ts` — was exercised. The peer refusal is measured *stale on that path*, not measured wrong in general.
- **That the +42 modules / +0.74 kB come from v17's own module graph** rather than from a Rolldown chunking
  difference. The delta is recorded, not explained, and is not treated as a failure (S-AC2 allows this explicitly).
- **Whether `npm ls graphql` exited 0 at baseline** was derived from the sweep (42 peers, 0 unsatisfied by 16.14.2),
  not observed directly — the baseline `node_modules` was replaced before that check occurred to anyone.

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
