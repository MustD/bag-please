---
title: 'Only documents something reads are kept'
type: 'chore'
created: '2026-10-20'
status: 'done'
baseline_revision: '6d1cdcb51513382d5feefe48640ed30e5a56f794'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The folded AR-E9-5a dump/rollback procedure in the root CLAUDE.md is not runnable as written.
    evidence: |-
      Carried verbatim from the deleted docs/deployment-guide.md (git show 6d1cdcb5:docs/deployment-guide.md, lines 99-137).
      "bring up the PREVIOUS image tag" has no command, and docker-compose.yaml is build:-only (lines 32, 46).
      The archive is written to the repo root with no *.archive gitignore rule.
      The dump/restore is not scoped to the bag_please database (admin is dropped and recreated).
      user/pass are dev compose credentials and are not flagged as such.
      The migration check greps the epic9-specific log line.
      mongorestore may race the mongo healthcheck after `up -d mongo` (use --wait).
      The fix edits CLAUDE.md (agent-context file), so it is deferred, best handled in Story 10.9's line-by-line pass.
    location: >-
      CLAUDE.md:116-140
    severity: medium
  - summary: >-
      The bp_back/CLAUDE.md per-entity layout omits the shared packages, and its Config note omits -Pdevelopment.
    evidence: |-
      com/bagplease/ also holds config/, features/, mongo/ (AppMigrationsRepository) and plugins/ (GQL.kt, Migration.kt,
      Routing.kt). build.gradle.kts:16-17 sets -Dio.ktor.development=true when run with -Pdevelopment. CLAUDE.md edit, so 10.9.
    location: >-
      bp_back/CLAUDE.md:7-38
    severity: low
  - summary: >-
      bp_front/CLAUDE.md names ApiPlayground/ as if it were under bp_front; it lives at the repo root.
    evidence: |-
      `ls bp_front/ApiPlayground` reports no such file; ApiPlayground/ exists at the repo root. Pre-existing sentence,
      extended by 10.8. CLAUDE.md edit, so 10.9.
    location: >-
      bp_front/CLAUDE.md:53-54
    severity: low
  - summary: >-
      Story 10.9 inherits the same self-conflicting no-product-code gate: the `bp_back` pathspec matches bp_back/CLAUDE.md.
    evidence: |-
      epic-10-context.md:61 and the 10.9 AC in epics.md use `git diff --stat bp_front/src bp_front/e2e bp_back`, while 10.9
      must edit bp_back/CLAUDE.md. 10.8 verified it with ':(exclude)bp_back/CLAUDE.md' (Spec Change Log).
    location: >-
      _bmad-output/implementation-artifacts/epic-10-context.md:61
    severity: low
---

<intent-contract>

## Intent

**Problem:** `docs/` still holds the May 2026 `document-project` scan (nginx, Next.js, `/api/login`, single admin), and the planning root holds superseded readiness reports, UX specs, proposals and one-run review files. `project_knowledge` makes BMAD agents scan `docs/`, so agents can read a stale scan or a superseded spec as truth.

**Approach:** Audit every candidate for live consumers and record a verdict table. Fold still-true facts that no loaded file carries, once, into the `CLAUDE.md` whose tree they describe, each checked against source. Delete the rest. Leave `docs/` holding only `feedback.md`. Keep `project_knowledge` resolving to `docs/`. Mark every live reference to a deleted file in the same commit.

## Boundaries & Constraints

**Always:** use the grep consumer scope from the AC: the four `CLAUDE.md`, `AGENTS.md`, `_bmad/` config, `.claude/skills/`, `prd.md`, `architecture.md`, the Epic 9 spine folder, the `ux-epic-8` pair, `epics.md`, `epics-archive.md`. Also count directory-level consumers (`project_knowledge` → `docs/`; the `bmad-prd` workspace files beside `prd.md`). Each folded fact cites the source file:line it was checked against, and false facts are dropped. Scratch goes under `.tmp/d8bfdde7/`. Reconcile sprint status at close. Use `git rm` so the deletions are tracked.

**Never:** touch `bp_front/src`, `bp_front/e2e` or `bp_back`. Rewrite `_bmad-output/implementation-artifacts/` history (other than this spec, `sprint-status.yaml`, and `epic-10-context.md` if a fact there changes). Rewrite `epics-archive.md`: it declares itself verbatim ("Nothing here was edited — only relocated"). Edit `AGENTS.md`, which is a managed block refreshed by 10.9. Fix pre-existing errors in a `CLAUDE.md` that no folded fact contradicts, because that line-by-line pass is Story 10.9. Delete `prd.md`, `architecture.md`, the spine, the `ux-epic-8` pair, `epics*.md` or `docs/feedback.md`. Add production credentials or TLS-edge wiring (AGENTS.md policy).

## I/O & Edge-Case Matrix

| Scenario | State | Expected |
|---|---|---|
| Fact true and not in a loaded file | e.g. pre-migration `mongodump` / rollback (AR-E9-5a) | folded once into the matching `CLAUDE.md`, with its source citation in the fold ledger |
| Fact true, already in a loaded file or in a file a loaded file links to (`routing/edge-proxy.md`) | e.g. `trusted_proxies private_ranges`, ports 27217/4000 | not folded; ledger says where it already lives |
| Fact false at HEAD | e.g. "no `/health` endpoint", nginx, `/api/login`, `entity` not used | dropped; ledger names the contradicting source |
| Folded fact contradicts an existing `CLAUDE.md` line | e.g. the per-entity `entity/<name>/` slice vs `bp_back/CLAUDE.md`'s `gql/`/`service/`/`storage/` dirs | the contradicted line is corrected in the same edit and recorded; other existing lines are left for 10.9 |
| Live reference to a deleted file | prose (e.g. `architecture.md:575`, spine `:381`, `DESIGN.md:398`, `prd.md:72`) | prose is repointed to the file that now carries the fact, or to `git show 6d1cdcb5…:<path>` |
| Same, in frontmatter provenance (`inputDocuments`, `supersedes`, `editHistory`) | path list | entry kept, with a trailing note `(deleted in Story 10.8; git show 6d1cdcb5:<path>)`. Provenance is preserved, never silently dangling |

</intent-contract>

## Code Map

- `docs/` -- 11 scan files + `docs/.archive/project-scan-report-20260507T154639Z.json` (not on the AC list, but the AC requires `feedback.md` to be the only file left) + `feedback.md` (keep). The scan files are dated 2026-05-07, apart from `index.md`, `architecture-routing.md`, `deployment-guide.md` and `development-guide.md`, which were edited later.
- `_bmad-output/planning-artifacts/` root leftovers -- `implementation-readiness-report-2026-05-{08,22}.md`, `-2026-07-30.md`, `ux-design-directions{,-epic-4}.html`, `ux-design-specification{,-epic-4}.md` (both superseded by the `ux-epic-8` pair per its `supersedes:` frontmatter), `prd-validation.md`, `sprint-change-proposal-2026-0{5-11,6-23}.md`, `review-{rubric,polish}-epic9.md`, `.memlog.md`.
- `.claude/skills/bmad-prd/references/validate.md:33` -- "Read every reviewer file in `{doc_workspace}/review-*.md`". The `-epic9` files sit in `prd.md`'s workspace, so a future Validate would ingest them as current reviews. That makes them a hazard, not a consumer: delete.
- `.claude/skills/bmad-prd/SKILL.md:34,87` -- Update/Finalize read `{doc_workspace}/.memlog.md`. The planning-root `.memlog.md` (topic "bag-please PRD", bootstrapped 2026-09-15) is that file, a live consumer: keep.
- `_bmad/config.toml:24`, `_bmad/bmm/config.yaml:8` -- `project_knowledge = "{project-root}/docs"`. Consumed by the agent skills ("additional context scanning"), `bmad-help:28`, and `bmad-sprint-planning/references/readiness-gate.md:5` (scans for intent artifacts). `docs/feedback.md` is backlog intent, so `docs/` still means something: no config change. `uv run _bmad/scripts/resolve_config.py --project-root .` currently prints `"{project-root}/docs"` under `modules.bmm.project_knowledge`.
- Consumer grep (planning, raw in `.tmp/d8bfdde7/consumers-raw.txt`): no `CLAUDE.md`/`AGENTS.md`/`_bmad` config/skill names any candidate by path. Live-document hits:
  - `prd.md:14,18` -- `editHistory` cites a readiness report and a sprint-change proposal.
  - `prd.md:30-43` -- `inputDocuments` lists `ux-design-specification-epic-4.md` and 8 `docs/` files.
  - `prd.md:72` -- prose cites `sprint-change-proposal-2026-06-23.md`.
  - `architecture.md:7,12-22` -- `inputDocuments`.
  - `architecture.md:575` -- "Agents should read … `docs/source-tree-analysis.md`".
  - `ARCHITECTURE-SPINE.md:381` -- the operational envelope is "owned by `docs/architecture-routing.md` and `docs/deployment-guide.md`".
  - `ux-epic-8/DESIGN.md:7-8,398`, `EXPERIENCE.md:7-8` -- `supersedes:` plus one prose line saying the Epic 4 spec "is retained for history".
  - `epics.md:302,676-680` -- the Epic 10 AR and story text naming the candidates (requirement text, not links; leave).
  - Historical, not rewritten: `epics-archive.md:3260,3267,3617`; `architecture-epic-9/.memlog.md:11-12` and `reviews/*` (run records).
  - Pre-existing dangling `inputDocuments` (`docs/architecture-bp_*.md`, `integration-architecture.md`, `project-context.md`, `architecture-epics-1-2.md`) are not deleted by this story. Leave them.
- Fold targets: `CLAUDE.md` (stack, compose, Mongo volume, dev loop), `bp_back/CLAUDE.md` (layers, tests), `bp_front/CLAUDE.md`, `routing/CLAUDE.md`. Already loaded and not to be duplicated: `AGENTS.md` (JDK 25, Testcontainers/Docker, `cleanTest`, `/api/health`, parallel-tests rule) and `routing/edge-proxy.md` (linked from root; ports, trust caveat, X-Forwarded-For overwrite).
- Candidate facts seen in planning (each one is verified or refuted during implementation): the `mongodump`/rollback procedure (`deployment-guide.md:99-136`); the `GLIBC_TUNABLES` kernel ≥ 6.19 note (`docker-compose.yaml:21` carries the setting); `images-build-push.sh` + `project.env`; `application.yaml` not hot-reloaded under `run -t`; `mise install` provisioning; `npm run preview`; the `ApiPlayground/http-client.env.json` env file; no frontend unit-test framework; the backend `FunSpec`/no-mocking/`mongoContainer()` (`utils/TestContainers.kt`) test style; the per-entity `entity/<name>/{gql,mongo}` slice (`bp_back/src/main/kotlin/com/bagplease/entity/item/` = `Item.kt ItemService.kt ItemStorage.kt gql/ mongo/`); Caddy `:80` in-container → `127.0.0.1:2080`. Known false: "no health endpoint" (Story 9.1 added `/api/health`), nginx/Next.js/`/api/login`/7-day JWT/Immutable.js.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:137` -- `10-8-only-documents-something-reads-are-kept: backlog` → `done` at close.

## Tasks & Acceptance

**Execution:**
- `.tmp/d8bfdde7/` -- re-run the consumer grep with a bash array (planning's first zsh pass did not word-split and falsely returned nothing). Build the per-file audit table and the fold ledger: each candidate fact → true/false + source `file:line` → already-loaded location or fold target.
- `CLAUDE.md`, `bp_back/CLAUDE.md`, `bp_front/CLAUDE.md`, `routing/CLAUDE.md` -- add only the ledger's FOLD rows, each once and in the house style. Fix a line only where a folded fact contradicts it.
- `docs/*` (except `feedback.md`), `docs/.archive/`, the planning-root leftovers with a delete verdict -- `git rm`.
- `prd.md`, `architecture.md`, `ARCHITECTURE-SPINE.md`, `ux-epic-8/DESIGN.md`, `EXPERIENCE.md` -- update each live reference to a deleted file, following the matrix rules.
- This spec -- append `## Audit Record` holding the per-file table (file, consumers found, verdict) and the fold ledger, the `project_knowledge` resolver output, and the NFR17 E2E gate recorded as not applicable by decision.
- `sprint-status.yaml` -- `10-8-…` → `done`. `epic-10-context.md` -- mark 10.8 done.

**Acceptance Criteria:**
- Given the audit, when the spec is read, then every candidate (all 11 `docs/` scan files, `docs/.archive/…`, and all 13 planning-root leftovers) has a row with its consumers and a verdict of delete, keep (consumer named) or fold-then-delete.
- Given the reduction, when `git ls-files docs` runs, then it prints only `docs/feedback.md`, and `uv run _bmad/scripts/resolve_config.py --project-root .` resolves `modules.bmm.project_knowledge` to `{project-root}/docs`, which exists.
- Given the deletions, when the consumer grep re-runs over the live documents, then every remaining hit for a deleted path either carries the Story 10.8 marker or is repointed. The only exceptions are hits in `epics-archive.md`, `architecture-epic-9/.memlog.md`, `architecture-epic-9/reviews/` and the Epic 10 requirement text in `epics.md`.
- Given the folds, when the ledger is read, then each FOLD row names the source line that confirms it, and each folded fact appears in exactly one `CLAUDE.md`.
- Given the story ships no product code, when `git diff --stat 6d1cdcb5 -- bp_front/src bp_front/e2e bp_back` runs, then it prints nothing.

## Spec Change Log

- 2026-10-20 (implementation): the "no product code" AC's literal pathspec `bp_back` also matches `bp_back/CLAUDE.md`,
  which this spec's own Code Map and Tasks name as a fold target (and the matrix requires correcting its contradicted
  layer lines). Read as intended ("the story ships no product code"): verified with
  `git diff --stat 6d1cdcb5 -- bp_front/src bp_front/e2e bp_back ':(exclude)bp_back/CLAUDE.md'` → empty. The only
  `bp_back` hit is `bp_back/CLAUDE.md`. Story 10.9's identical gate in `epic-10-context.md` will hit the same overlap.

## Review Triage Log

### 2026-10-20 — Review pass
- verdicts: 35 findings — high 0, medium 2, low 19, false 14, maybe-false 0
- findings:
  - `[false]` `[reject]` (intent) `project_knowledge` not changed through the config path (R4a) — AR-E10-9 says "left pointing at a directory that exists and means something"; "changed through…" constrains how a change is made, not whether one is required. The resolver shows `{project-root}/docs`, and the readiness gate scans it for intent artifacts, which the backlog is.
  - `[false]` `[reject]` (intent) the no-product-code gate prints `bp_back/CLAUDE.md` — that is a doc file the AC itself names as a fold target. No product file changed (the exclude-pathspec run is empty). Recorded in the Spec Change Log.
  - `[false]` `[reject]` (intent) fold rewrites existing `bp_back/CLAUDE.md` lines, overlapping 10.9 — only lines the folded per-entity fact contradicts were changed (the matrix row). Leaving them would have put two conflicting layouts in one file.
  - `[false]` `[reject]` (intent) links annotated instead of removed or retargeted — an annotation with a `git show` recovery pointer is an update. Provenance lists keep their meaning, and prose that tells agents to read a file is repointed.
  - `[false]` `[reject]` (intent) change is uncommitted, so "same commit" is not shown — finalize commits deletions and link edits together in one commit.
  - `[false]` `[reject]` (intent) no automated test; D7 dropped as unverified — this is a docs story, and the E2E gate is N/A by AC. D7 ("category delete does not cascade") is false at HEAD: Story 9.3 shipped "deleting a category deletes its items for everyone" (`spec-9-3-…md`). Dropping it was correct; only the ledger's wording undersells that.
  - `[false]` `[reject]` (intent) spec status `in-progress` vs sprint `done` — the review step sets the status, and finalize writes `done` before the commit.
  - `[medium]` `[defer]` (blind) rollback's "bring up the PREVIOUS image tag" has no command; compose is `build:`-only (`docker-compose.yaml:32,46`) — real, but carried verbatim from the deleted `deployment-guide.md:131` (pre-existing), and the fix edits `CLAUDE.md` → defer.
  - `[low]` `[defer]` (blind) the dump archive is written to the repo root, and `.gitignore` has no `*.archive` — real (pre-existing text). The fix edits `CLAUDE.md`/`.gitignore` → defer, grouped with the rollback entry.
  - `[low]` `[defer]` (blind) dump/restore are not scoped to `bag_please` and include `admin` — pre-existing procedure; same group → defer.
  - `[low]` `[defer]` (blind) hard-coded dev credentials not flagged dev-only — same group → defer.
  - `[low]` `[defer]` (blind) migration-check grep is specific to epic9 — same group → defer.
  - `[false]` `[reject]` (blind) spec frontmatter/Review Triage Log contradict tracking — the review was in progress; finalize sets `done`.
  - `[low]` `[reject]` (blind) the spec's Verification command still uses the literal `bp_back` pathspec, and the 10.9 gate in `epic-10-context.md` has the same overlap — the first half is a fix to this build's spec (rejected by rule). The 10.9 half is deferred under the gate row below.
  - `[low]` `[reject]` (blind) Audit Record counts wrong (`architecture.md` has 8 `docs/` annotations, not 9) — the fix is an edit to this build's spec (rejected by rule). The annotations themselves are complete.
  - `[false]` `[reject]` (blind) D7/N9 break the verify-or-refute rule — D7 is false at HEAD (see above). N9 is not a fact claim but a production checklist, excluded by `AGENTS.md` policy.
  - `[low]` `[reject]` (blind) annotated frontmatter entries are no longer clean paths for tools — no skill parses existing `prd.md`/`architecture.md` `inputDocuments` as paths to open, and pre-existing dangling entries already sit there. The fix would restructure frontmatter, not make a direct correction.
  - `[low]` `[patch]` (blind) nested parentheses in the `prd.md` editHistory annotation — rephrased to a single parenthetical.
  - `[low]` `[defer]` (blind) per-entity layout omits the shared `config/`, `features/`, `mongo/`, `plugins/` packages — real; the fix edits `bp_back/CLAUDE.md` → defer to 10.9.
  - `[low]` `[defer]` (blind) Config section omits that `-Pdevelopment` enables dev mode (`build.gradle.kts:16-17`) — real; the fix edits `bp_back/CLAUDE.md` → defer to 10.9.
  - `[low]` `[patch]` (blind) `epic-10-context.md` Goal says "the still-true facts" were folded — reworded to "the still-true facts no loaded file already carried".
  - `[false]` `[reject]` (edge) mongodump failure leaves an empty archive and deploy proceeds — the commands are separate, documented manual steps, not a script. An operator sees the mongodump error. Pre-existing text in any case.
  - `[false]` `[reject]` (edge) log grep runs before migration finishes — the migration runs during `module()` startup. The doc says to confirm the line, and an empty grep is re-run by hand; it is not an automated gate.
  - `[low]` `[defer]` (edge) epic9-specific migration grep for generic releases — duplicate root cause of the blind row; grouped → defer.
  - `[low]` `[defer]` (edge) restore right after `up -d mongo` may race the healthcheck — plausible (start_period 20s); pre-existing; fix edits `CLAUDE.md` → defer (grouped).
  - `[medium]` `[defer]` (edge) "previous image tag" vs `build:`-only compose — duplicate of the blind medium row; grouped → defer.
  - `[false]` `[reject]` (edge) unbumped version overwrites the previous tag — a release-process concern of `mise/images-build-push.sh`, not caused by this change.
  - `[low]` `[defer]` (edge) hard-coded dev credentials — duplicate; grouped → defer.
  - `[low]` `[defer]` (edge) archive in repo root not gitignored — duplicate; grouped → defer.
  - `[false]` `[reject]` (edge) no quiesce before dump loses writes — the procedure is a pre-migration snapshot for rollback. Writes after it are lost by design of any restore, and this is pre-existing text.
  - `[low]` `[defer]` (edge) `ApiPlayground/` named in `bp_front/CLAUDE.md` but it lives at repo root — real (pre-existing sentence, extended here); the fix edits `CLAUDE.md` → defer to 10.9.
  - `[low]` `[patch]` (edge) the kept, live `.memlog.md` cites the deleted `review-*-epic9.md` at :105/:112 — the memlog is append-only, so one event line was appended via `memlog.py` with the `git show` recovery pointer.
  - `[low]` `[reject]` (edge) Audit Record says 9 `docs/` annotations in `architecture.md` (actual 8) — the fix edits this build's spec (rejected by rule); duplicate of the blind row.
  - `[low]` `[patch]` (edge) AC "every remaining live hit marked" not met for `.memlog.md` — same root cause as the memlog row; patched there.
  - `[false]` `[reject]` (edge) folded F2 omits that `:latest` is also pushed — "tags both images with the version" is true. Omitting `:latest` is a level-of-detail choice, not a false fact; the folded sentence stays accurate.

## Design Notes

**Frontmatter provenance is annotated, not erased.** `inputDocuments` and `supersedes` record what a document was built from or replaces. Removing those entries would falsify that history. Leaving them bare would make them silent dead links. A trailing `(deleted in Story 10.8; git show 6d1cdcb5:<path>)` note does both jobs: it updates the reference and keeps it resolvable. Prose that tells an agent to *read* a deleted file (`architecture.md:575`, spine `:381`) is repointed to the file that now holds the fact.

**`epics-archive.md` counts as history.** It is kept (AR-E10-10), but its header promises verbatim bodies. Editing three citations in it would break that promise, and they describe closed work.

**E2E gate:** not applicable by decision. No product code changes, as the `git diff --stat` AC proves.

## Verification

**Commands:**
- `git ls-files docs` -- expected: `docs/feedback.md` only
- `uv run _bmad/scripts/resolve_config.py --project-root . | python3 -c 'import sys,json;print(json.load(sys.stdin)["modules"]["bmm"]["project_knowledge"])'` -- expected: `{project-root}/docs`
- `git diff --stat 6d1cdcb51513382d5feefe48640ed30e5a56f794 -- bp_front/src bp_front/e2e bp_back` -- expected: empty
- `git diff --quiet 6d1cdcb5 -- _bmad-output/planning-artifacts/epics-archive.md AGENTS.md && echo untouched` -- expected: `untouched`

## Audit Record

Consumer grep: `.tmp/d8bfdde7/grep.sh` (bash array over the AC scope: the four `CLAUDE.md`, `AGENTS.md`,
`_bmad/config.toml`, `_bmad/bmm/config.yaml`, `.claude/skills/`, `prd.md`, `architecture.md`, the Epic 9 spine folder,
the `ux-epic-8` pair, `epics.md`, `epics-archive.md`). Raw before/after output: `consumers-raw.txt` /
`consumers-after.txt` (scratch, not committed). A repo-wide `git grep` outside `_bmad-output/` found no other consumer:
`bmad-correct-course` *writes* `sprint-change-proposal-{date}.md` and `bmad-prd` names `prd-validation-checklist.md`,
neither reads a candidate. Directory-level consumers: `project_knowledge` → `docs/` (agents, `bmad-help`,
`readiness-gate.md:5`) and `readiness-gate.md:5`'s scan of `{planning_artifacts}`, which would read every root leftover
as current intent. Epic 10 requirement text (`epics.md:301-309,676-681`) names candidates but is not a consumer.

### Per-file table

| File | Consumers found | Verdict |
|---|---|---|
| `docs/index.md` | `prd.md` / `architecture.md` `inputDocuments` (provenance); `project_knowledge` dir scan | delete (provenance annotated) |
| `docs/project-overview.md` | `prd.md` `inputDocuments` | delete (provenance annotated); all facts false (nginx, Next.js, `/api/login`, 7-day JWT, single admin, Immutable.js) |
| `docs/source-tree-analysis.md` | `prd.md`/`architecture.md` `inputDocuments`; prose `architecture.md:575` | fold-then-delete (per-entity slice → `bp_back/CLAUDE.md`); prose repointed |
| `docs/api-contracts-bp_back.md` | `prd.md`/`architecture.md` `inputDocuments` | delete; all facts false at HEAD (`/api/login`, `/api/auth-test`, unauthenticated subscriptions, pre-list schema) |
| `docs/data-models-bp_back.md` | `prd.md`/`architecture.md` `inputDocuments` | fold-then-delete (`synced` never reset → `bp_back/CLAUDE.md`); rest stale (UUID-binary item `_id`, Mongo driver 5.5.1, no `listId`) |
| `docs/component-inventory-bp_front.md` | `prd.md`/`architecture.md` `inputDocuments` | delete; Next.js `app/` tree, `localStorage` JWT, Immutable.js — all false |
| `docs/architecture-routing.md` | `inputDocuments`; prose spine `:381` | fold-then-delete (Caddy `:80` → `routing/CLAUDE.md`); prose repointed |
| `docs/deployment-guide.md` | `inputDocuments`; prose spine `:381`; `epics-archive.md:3617` (history) | fold-then-delete (mongodump/rollback, image build → root `CLAUDE.md`); prose repointed |
| `docs/development-guide.md` | `prd.md`/`architecture.md` `inputDocuments` | fold-then-delete (`mise install`, `npm run preview`, `application.yaml` restart, test style, no FE unit tests, ApiPlayground env) |
| `docs/project-parts.json` | none | delete (scan metadata; nginx/Next.js parts) |
| `docs/project-scan-report.json` | none | delete (scan state file) |
| `docs/.archive/project-scan-report-20260507T154639Z.json` | none | delete |
| `implementation-readiness-report-2026-05-08.md` | none | delete |
| `implementation-readiness-report-2026-05-22.md` | none | delete |
| `implementation-readiness-report-2026-07-30.md` | `prd.md:14` `editHistory` (provenance) | delete (provenance annotated) |
| `ux-design-directions.html` | none | delete |
| `ux-design-directions-epic-4.html` | none | delete |
| `ux-design-specification.md` | `architecture.md:7` `inputDocuments`; `DESIGN.md`/`EXPERIENCE.md` `supersedes`; `epics-archive.md` (history) | delete (superseded by the `ux-epic-8` pair; provenance annotated) |
| `ux-design-specification-epic-4.md` | `prd.md:30` `inputDocuments`; pair `supersedes`; prose `DESIGN.md:398`; `epics-archive.md` (history) | delete (provenance annotated; prose repointed) |
| `prd-validation.md` | none (`bmad-prd` Validate writes `validation-report.{html,md}`, not this) | delete |
| `sprint-change-proposal-2026-05-11.md` | none | delete |
| `sprint-change-proposal-2026-06-23.md` | `prd.md:18` `editHistory`; prose `prd.md:72` | delete (provenance annotated; prose repointed to `git show`) |
| `review-rubric-epic9.md` | hazard, not consumer: `bmad-prd/references/validate.md:33` reads every `{doc_workspace}/review-*.md` | delete |
| `review-polish-epic9.md` | same hazard | delete |
| `.memlog.md` (planning root) | `bmad-prd/SKILL.md:14,34,87` + `references/validate.md:7` read `{doc_workspace}/.memlog.md` (topic "bag-please PRD") | **keep** (live consumer) |

Result: `git ls-files docs` → `docs/feedback.md`.

### Fold ledger

| # | Fact (from) | True? Source checked | Where it lives now |
|---|---|---|---|
| F1 | Pre-migration `mongodump` + restore-then-previous-image rollback (`deployment-guide.md:104-136`) | true: `plugins/Migration.kt:23` (declared migrations), `:132-155` (`epic9-multi-store`, `Updates.unset("store")`, log "multi-store migration"), `mongo/AppMigrationsRepository.kt:20` (`app_migrations`), `docker-compose.yaml:18-19` (`user`/`pass`, dev compose only) | **FOLD** → root `CLAUDE.md` (Docker Compose, "Dump before a migration release") |
| F2 | Image build/push via `images-build-push.sh` + `project.env` (`deployment-guide.md:67-68,94-97`) | true with a corrected path: `mise.toml:69-71` (`images:build-push` → `./mise/images-build-push.sh`), script `:6-10` (needs `project.env`), `:16` (tags with `gradle.properties` version), `.gitignore:2`; the dev guide's repo-root `images-build-push.sh` does not exist | **FOLD** → root `CLAUDE.md` (Docker Compose) |
| F3 | `mise install` provisions the toolchain (`development-guide.md:13`) | true with corrected versions: `mise.toml:4-7` (`gradle = "9"`, `java = "temurin-25"`, `node = "26"`; not `26.4`) | **FOLD** → root `CLAUDE.md` (Commands intro) |
| F4 | `npm run preview` (`development-guide.md:99`) | true: `bp_front/package.json:10` (`"preview": "vite preview"`) | **FOLD** → root `CLAUDE.md` (Frontend commands) |
| F5 | Per-entity `entity/<name>/{gql,mongo}` slice (`source-tree-analysis.md:49-69`) | true: `bp_back/src/main/kotlin/com/bagplease/entity/` = `category feedback item list user`; `entity/item/` = `Item.kt ItemService.kt ItemStorage.kt gql/ mongo/` (+ `Recurring.kt StoreNames.kt`); registration `plugins/GQL.kt:60` `configureGql()`; mappers are `object` (`GqlItemMapper.kt:8`, `MongoItemMapper.kt:6`); `UserService.kt:28`/`FeedbackService.kt:27` take a repository, no storage | **FOLD** → `bp_back/CLAUDE.md` "Backend layers". **Contradicted lines corrected in the same edit:** the `gql/`/`service/`/`storage/`/`mongo/` layer-dir labels, the `storage/`/`mongo/model/`/`gql/model/` per-layer list, and "registered in `GqlDefinition`" (no such symbol in `bp_back/src`) |
| F6 | `synced` is never reset; direct Mongo writes bypass the cache (`data-models-bp_back.md:147-150`) | true: `entity/item/ItemStorage.kt:14-23` (set once), `:73` ("DO NOT reset synced") | **FOLD** → `bp_back/CLAUDE.md` "Backend layers" |
| F7 | Backend tests: `FunSpec` only, no mocking, `mongoContainer()` (`development-guide.md:142-143`) | true: all 18 `*Test.kt` under `bp_back/src/test/kotlin` contain `FunSpec`; `utils/TestContainers.kt:19` `fun FunSpec.mongoContainer()`; no mock library in `gradle/libs.versions.toml` / `bp_back/build.gradle.kts` | **FOLD** → `bp_back/CLAUDE.md` "Tests" |
| F8 | `application.yaml` not hot-reloaded under `run -t` (`development-guide.md:58,214`) | true: `application.yaml:2` (`ktor.development: false`), `bp_back/build.gradle.kts:14-17` (`EngineMain`, `-Dio.ktor.development` only with `-Pdevelopment`), `Application.kt:26` | **FOLD** → `bp_back/CLAUDE.md` "Config" |
| F9 | No frontend unit/component test framework (`development-guide.md:161`) | true: `bp_front/package.json:7-15` scripts and devDependencies carry no Vitest/Jest | **FOLD** → `bp_front/CLAUDE.md` "Tests" |
| F10 | ApiPlayground env file (`development-guide.md:198-199`) | true: `ApiPlayground/http-client.env.json:2-6` (`local` → `localhost:2080`) | **FOLD** → `bp_front/CLAUDE.md` (extends the existing ApiPlayground line) |
| F11 | Caddy `:80` in-container → `127.0.0.1:2080` (`architecture-routing.md:8`) | true: `routing/Caddyfile:21` (`:80 {`), `bp_front/Dockerfile:18` (`EXPOSE 80`), `docker-compose.yaml:36` | **FOLD** → `routing/CLAUDE.md` |
| N1 | `trusted_proxies static private_ranges` + trust caveat, X-Forwarded-For overwrite | true (`routing/Caddyfile:15-19`) | not folded: `routing/edge-proxy.md:26-49` |
| N2 | Ports 27217 / 4000 loopback-only; single entrypoint `:2080` | true (`docker-compose.yaml:14,36,52`) | not folded: `routing/edge-proxy.md:11-19`, root `CLAUDE.md` |
| N3 | JDK 25; Testcontainers needs Docker; parallel tests on shared Mongo; `admin`/`admin` | true | not folded: `AGENTS.md:36-38,44,95-97` |
| N4 | `KTOR_RATE_LIMIT_ATTEMPTS: 6000` compose override | true (`docker-compose.yaml:66`) | not folded: `AGENTS.md:14-15` |
| N5 | Route order `/api/subscriptions` before `/api/*`; Vite proxy in dev; codegen flow; 15-min access token | true | not folded: `routing/CLAUDE.md`, root `CLAUDE.md`, `bp_front/CLAUDE.md`, `bp_back/CLAUDE.md` |
| N6 | `db_data` named volume; HTTPS edge at `bag-please.localhost` | true | not folded: root `CLAUDE.md` Project Overview |
| N7 | `GLIBC_TUNABLES` workaround for kernel ≥ 6.19 | true (`docker-compose.yaml:20-21`) | not folded: self-documented by the comment beside the only setting that needs it |
| N8 | `KTOR_*` env-var table, fixed JWT issuer/audience | true (`application.yaml`) | not folded: `application.yaml` is the source and carries the `"$ENV:default"` pairs |
| N9 | Production hardening checklist | not checked | not folded: production config lives on the server (`AGENTS.md:12-15`) |
| D1 | "No backend health endpoint; use `/api/auth/config`" (`deployment-guide.md:91-92`, `development-guide.md:191-192`) | **false**: `plugins/Routing.kt:29-35` (`/api/health`), `e2e/global-setup.ts:27-34` polls it, `AGENTS.md:40` | dropped |
| D2 | "No GraphiQL route" (`development-guide.md:191`) | **false**: `plugins/GQL.kt:148` `graphiQLRoute()` | dropped |
| D3 | `mise run up` / `mise run infra` task names (`deployment-guide.md:20-21`) | **false**: `mise.toml:57-67` names `docker:up` / `docker:back` | dropped |
| D4 | `gradle:9.5.0-jdk25` build stage (`deployment-guide.md:77`) | **false**: `bp_back/Dockerfile:1` is `gradle:9.8.1-jdk25` | dropped |
| D5 | nginx, Next.js, `/api/login`, 7-day JWT, single admin, Immutable.js, unauthenticated subscriptions, `documentation/bag-please.drawio`, `db/` dir | **false**: `bp_front/Dockerfile:15` (Caddy), `package.json` (Vite, no Next/Immutable), `bp_back/CLAUDE.md` Security section, `documentation/` and `db/` absent | dropped |
| D6 | Item `_id` stored as UUID binary (`data-models-bp_back.md:62-63`) | **false**: `AGENTS.md:77-80` (items store a String) | dropped |
| D7 | Category delete does not cascade to items (`data-models-bp_back.md:162`) | not re-verified against the list-scoped model | dropped (unverified, not folded) |

Each FOLD row appears in exactly one `CLAUDE.md`.

### Live references updated

- Frontmatter provenance annotated `(deleted in Story 10.8; git show 6d1cdcb5:<path>)`: `prd.md` `editHistory`
  (readiness report 2026-07-30, sprint-change-proposal 2026-06-23) and `inputDocuments` (Epic 4 UX spec + 9 `docs/`
  files); `architecture.md` `inputDocuments` (UX spec + 9 `docs/` files); `DESIGN.md` / `EXPERIENCE.md` `supersedes`.
  Pre-existing dangling entries (`docs/architecture-bp_*.md`, `integration-architecture.md`, `project-context.md`,
  `architecture-epics-1-2.md`) left as they were.
- Prose repointed: `prd.md:72` → `git show`; `architecture.md:575` → per-directory `CLAUDE.md` files (+ `git show`);
  spine `:381` → root `CLAUDE.md`, `routing/CLAUDE.md`, `routing/edge-proxy.md`; `DESIGN.md:398` → marker + `git show`.
- After-grep: every remaining hit for a deleted path carries the 10.8 marker or is a `git show` repoint, except
  `epics-archive.md`, `architecture-epic-9/.memlog.md`, `architecture-epic-9/reviews/` and the Epic 10 requirement text
  in `epics.md`.

### `project_knowledge` resolver

`uv run _bmad/scripts/resolve_config.py --project-root . | python3 -c '…["modules"]["bmm"]["project_knowledge"]'` →
`{project-root}/docs`; `docs/` exists and holds `feedback.md` (backlog intent). No config change.

### Gates

- `git diff --stat 6d1cdcb5 -- bp_front/src bp_front/e2e bp_back ':(exclude)bp_back/CLAUDE.md'` → empty (see Spec
  Change Log for the `bp_back/CLAUDE.md` overlap).
- `git diff --quiet 6d1cdcb5 -- _bmad-output/planning-artifacts/epics-archive.md AGENTS.md && echo untouched` →
  `untouched`.
- NFR17 E2E gate: **not applicable by decision**. No product code changed.

## Auto Run Result

Status: done

- **Change:** audited 26 candidates (11 `docs/` scan files, `docs/.archive/…`, 13 planning-root leftovers, plus `docs/feedback.md`) for live consumers.
  - Deleted 24 files. `docs/` now holds only `feedback.md`.
  - Kept the planning-root `.memlog.md`, because `bmad-prd` Update/Finalize reads `{doc_workspace}/.memlog.md`.
  - Deleted `review-*-epic9.md` as a hazard: `bmad-prd` Validate globs `review-*.md`.
  - Folded 11 still-true facts, each checked against source, into the four `CLAUDE.md` files.
  - Annotated or repointed every live reference to a deleted file.
  - `project_knowledge` unchanged; it resolves to `{project-root}/docs`.
- **Files:**
  - `CLAUDE.md` -- folds: mise toolchain, `npm run preview`, the `images:build-push` task, the AR-E9-5a dump/rollback procedure.
  - `bp_back/CLAUDE.md` -- per-entity `entity/<name>/` layout (the contradicted layer lines corrected, `GqlDefinition` → `configureGql()`), the `synced` caveat, Tests and Config sections.
  - `bp_front/CLAUDE.md` -- `ApiPlayground` env, no unit-test framework.
  - `routing/CLAUDE.md` -- Caddy `:80` → `127.0.0.1:2080`.
  - `prd.md`, `architecture.md`, `ARCHITECTURE-SPINE.md`, `ux-epic-8/DESIGN.md`, `EXPERIENCE.md` -- 10.8 markers and repointed prose.
  - `planning-artifacts/.memlog.md` -- one appended event recording the review-file deletions.
  - `sprint-status.yaml` -- 10-8 is `done`. `epic-10-context.md` -- 10.8 is done.
  - 24 deletions.
- **Review:** 35 findings (verification-gap 0, intent 7, blind 14, edge 14): high 0, medium 2, low 19, false 14.
  - Patched (3 entries, all low): `.memlog.md` deletion event, `prd.md` nested parentheses, `epic-10-context.md` Goal wording.
  - Deferred (4): rollback-procedure defects (medium, pre-existing text, `CLAUDE.md` edit), `bp_back/CLAUDE.md` shared packages and `-Pdevelopment`, the `ApiPlayground` path, and 10.9's self-conflicting `bp_back` gate.
  - Rejected: the rest, with reasons in the Review Triage Log. Spec-only corrections were rejected by rule, including the Audit Record's 9-vs-8 `architecture.md` annotation count (actual 8) and the Verification section's literal `bp_back` pathspec (the exclude form is the one that holds).
- **Follow-up review recommended:** false (patched: high 0, medium 0, low 3).
- **Verification:**
  - `git ls-files docs` → `docs/feedback.md`.
  - The resolver → `{project-root}/docs`.
  - `git diff --stat 6d1cdcb5 -- bp_front/src bp_front/e2e bp_back ':(exclude)bp_back/CLAUDE.md'` → empty. The literal form lists only `bp_back/CLAUDE.md`; see the Spec Change Log.
  - `epics-archive.md` and `AGENTS.md` are untouched.
  - The edited frontmatter parses as YAML.
  - NFR17 E2E is not applicable by decision.
- **Residual risks:**
  - The folded rollback procedure needs the deferred repair before it is relied on.
  - 10.9 must use the exclude pathspec for its gate.
