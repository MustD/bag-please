---
title: 'The agent context files match the code'
type: 'chore'
created: '2026-10-21'
status: 'done'
baseline_revision: 'fdecc28121bf0e5be572fc8dd3258e3e32a82ac1'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-10-8-only-documents-something-reads-are-kept.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The `-Pdevelopment` note in bp_back/CLAUDE.md is unmeasured.
    evidence: |-
      Written as "not measured"; run `gradle :bp_back:run -Pdevelopment` and read the ktor development flag to settle it.
      Fix edits an agent-context file, so deferred.
    location: >-
      bp_back/CLAUDE.md:42
    severity: low
  - summary: >-
      The rollback in CLAUDE.md leaves a detached HEAD with no way back, assumes a clean tree and tag, and the migration
      log comment omits the "not needed" line (Migration.kt:77).
    evidence: |-
      `git checkout <tag>` detaches HEAD; add `git switch -` and a clean-tree note. Fix edits CLAUDE.md, so deferred.
    location: >-
      CLAUDE.md:115-140
    severity: low
  - summary: >-
      The AGENTS.md refresh was done by hand, not by the bmad-project-context interview, and the Audit Record lists only
      fixed claims, not claims confirmed true.
    evidence: |-
      The implementer reported loading the skill but editing the block directly under the spec's authority.
    location: >-
      AGENTS.md:1
    severity: low

---

<intent-contract>

## Intent

**Problem:** `AGENTS.md` was verified on 2026-09-07 against `1bb60cb`, and the root, `bp_back/`, `bp_front/` and `routing/` `CLAUDE.md` files have drifted: they cite a `./gradlew` wrapper that no repo file provides, a `GET /api/graphiql` readiness check that `/api/health` replaced, an `ApiPlayground/` path under `bp_front/`, a `./db/data` migration note whose directory is gone, and a rollback procedure that does not run as written (10.8 deferred it here).

**Approach:** Check every claim in the five files against the code (run the command or confirm the target), fix or delete each wrong claim, record each with its evidence in a table, resolve duplicates to the most specific file, and refresh the managed `AGENTS.md` block with `bmad-project-context`.

## Boundaries & Constraints

**Always:** each fixed or deleted claim gets a table row (file, claim, verdict, evidence as `file:line` or command output). Each fact lives once, in the most specific file that loads where it is needed. Versions are copied from `gradle/libs.versions.toml`, `bp_front/package.json` and the Dockerfiles. The `AGENTS.md` "Verified" line names the full HEAD hash and the date; content outside the `bmad:context` markers is kept. Scratch goes under `.tmp/d53af793/`.

**Never:** change `bp_front/src`, `bp_front/e2e`, or any `bp_back` file except `bp_back/CLAUDE.md`. Add production credentials, compose files or TLS edge wiring. Rewrite `implementation-artifacts/` history. Silently drop a time-bound note: each removal is a table row naming the ruling.

## I/O & Edge-Case Matrix

| Scenario | State | Expected |
|---|---|---|
| Claim names a missing target | `./gradlew`, `ApiPlayground/` under `bp_front/`, `/api/graphiql` as readiness | fixed to the real target or deleted, with a table row |
| Time-bound note | `./db/data` copy-in (`ls db` fails: directory is gone) | removed; ruling recorded as "the data it restores no longer exists" (md may restore it from git history) |
| Deferred 10.8 items | rollback `PREVIOUS image tag` has no command, archive not gitignored, dump not scoped to `bag_please`, dev credentials unflagged, migration grep epic9-specific, restore races the healthcheck | fixed in the root `CLAUDE.md` and `.gitignore`, one table row each |
| Fact in two files | e.g. JDK 25 / `/api/health` / ports in `AGENTS.md` and a `CLAUDE.md` | kept in the more specific loaded file, the other drops or points to it |

</intent-contract>

## Code Map

- `CLAUDE.md` (140 lines) -- `./gradlew` used at lines 36-52 (no `gradlew`, no `gradle/wrapper/`: only `gradle/libs.versions.toml`; `mise.toml` and `mise/back_test.sh` call bare `gradle`; wrapper deleted in `9127b88`). Mongo volume note at lines 25-30 (`./db/data` does not exist). Dump/rollback at lines 111-140. `docker-compose.yaml` is `build:`-only (lines 32, 46), mongo on host `127.0.0.1:27217`, db `bag_please`, volume `db_data`.
- `AGENTS.md` -- managed block, "Verified 2026-09-07 against 1bb60cb"; "Gradle wrapper is held at 9.8.1" (stale: `mise.toml` `gradle = "9"` resolves 9.8.1, matching `bp_back/Dockerfile:1`). Refresh with `bmad-project-context`.
- `bp_back/CLAUDE.md` -- layer diagram omits `config/`, `features/auth/`, `mongo/` (`AppMigrationsRepository`, `MongoConnection`) and `plugins/`; the Config note omits `-Pdevelopment` (`build.gradle.kts:16-17`). Verified true: `GQL_CALL_PRINCIPAL` (`GQL.kt:154`), 4401 (`GQL.kt:174`), `refresh_tokens` TTL (`RefreshTokenRepository.kt:19`), `FunSpec.mongoContainer()` (`TestContainers.kt:19`), `ApplicationTest` exists.
- `bp_front/CLAUDE.md:53-54` -- `ApiPlayground/` lives at the repo root; `http-client.env.json` has a `local` env.
- `routing/CLAUDE.md` -- "`GET /api/graphiql` readiness check" is stale (`/api/health`, `Routing.kt:35`; graphiql is inside `authenticate`, `GQL.kt:145-148`).
- `mise.toml` / `.zed/tasks.json` -- read-only evidence: tasks match; no task changes unless a documented command changes.
- `.gitignore` -- needs `*.archive`.

## Tasks & Acceptance

**Execution:**
- `CLAUDE.md` -- replace `./gradlew` with `gradle` (mise-provisioned) throughout; delete the `./db/data` note; rewrite dump/rollback so it is runnable (`up -d --wait mongo`, dump/restore scoped to `bag_please`, archive path ignored, dev-credential flag, generic migration log grep, rollback via checking out the previous release tag then `docker compose up -d --build`) -- stale and deferred claims
- `bp_back/CLAUDE.md` -- add the shared packages to the layout, `-Pdevelopment` to Config -- 10.8 deferred
- `bp_front/CLAUDE.md` -- `ApiPlayground/` at repo root -- 10.8 deferred
- `routing/CLAUDE.md` -- readiness check is `/api/health` -- stale
- `.gitignore` -- add `*.archive`
- `AGENTS.md` -- run `bmad-project-context` refresh; drop the wrapper sentence's wrong claim; drop duplicates of the other files
- this spec -- append `## Audit Record`: the claim table, the dedup list, `mise.toml`/`.zed/tasks.json` verdict, NFR17 not applicable by decision

**Acceptance Criteria:**
- Given the audit, when the table is read, then every fixed or deleted claim has evidence, and the `./db/data` removal names its ruling.
- Given `AGENTS.md`, when the first marker line is read, then it names `git rev-parse HEAD` as of the commit's parent and today's date, and text outside the markers is unchanged.
- Given the five files, when each command is run or its target checked, then none points to a missing file, script or task.
- Given the story ships no product code, when `git diff --stat bp_front/src bp_front/e2e bp_back ':(exclude)bp_back/CLAUDE.md'` runs, then it prints nothing (the literal `bp_back` pathspec also matches `bp_back/CLAUDE.md`, as in 10.8).

## Verification

**Commands:**
- `git diff --stat bp_front/src bp_front/e2e bp_back ':(exclude)bp_back/CLAUDE.md'` -- expected: empty
- `grep -rn "gradlew\|db/data\|ApiPlayground" CLAUDE.md AGENTS.md bp_*/CLAUDE.md routing/CLAUDE.md` -- expected: only intended hits
- `docker compose config -q && mise tasks` -- expected: exit 0

## Audit Record

| File | Claim | Verdict | Evidence |
|---|---|---|---|
| CLAUDE.md | `./gradlew` throughout | fixed to `gradle` | `ls gradlew gradle/wrapper` absent; `mise.toml:13,17` and `mise/back_test.sh` call bare `gradle`; `gradle --version` = 9.8.1 |
| CLAUDE.md | `./db/data` copy-in note | deleted; ruling: the data it restores no longer exists (md may restore it from git history); one line kept that a former bind-mount stack starts empty | `ls db` fails |
| CLAUDE.md | rollback "PREVIOUS image tag" | fixed: `git checkout <previous-release-tag>` then `docker compose up -d --build` | compose is `build:`-only (`docker-compose.yaml:32,46`); `git tag` yields bare versions (0.17.0) |
| CLAUDE.md | archive not ignored | `*.archive` added to `.gitignore` | `.gitignore` |
| CLAUDE.md | dump not scoped | `--db bag_please` / `--nsInclude 'bag_please.*'` | `docker-compose.yaml:61`, `application.yaml:29` |
| CLAUDE.md | dev credentials unflagged | flagged as dev/E2E | `docker-compose.yaml:21-22` |
| CLAUDE.md | migration grep epic9-specific | generic `grep -i migration` | `Migration.kt:63,133,155` log lines |
| CLAUDE.md | restore races healthcheck | `up -d --wait mongo` | healthcheck `docker-compose.yaml:28-32` |
| bp_back/CLAUDE.md | layout omits shared packages | added `config/`, `features/auth/`, `mongo/`, `plugins/` | `ls bp_back/src/main/kotlin/com/bagplease` |
| bp_back/CLAUDE.md | Config omits `-Pdevelopment` | added, with caveat that yaml's explicit `development: false` likely wins (not measured) | `build.gradle.kts:16-17`, `application.yaml:2` |
| bp_front/CLAUDE.md | `ApiPlayground/` implied under bp_front | stated as repo root | `ls ApiPlayground` at root |
| routing/CLAUDE.md | `/api/graphiql` readiness check | `/api/health` | `Routing.kt:35`, `GQL.kt:145-148` |
| AGENTS.md | Verified line 2026-09-07 / 1bb60cb | full HEAD fdecc28... and 2026-10-21 | `git rev-parse HEAD` |
| AGENTS.md | `./gradlew`; "mise run back:test is UP-TO-DATE-cacheable"; "wrapper held at 9.8.1" | fixed: `gradle`; mise script deletes results dir so it re-runs; no wrapper, mise `gradle = "9"` = 9.8.1 = Dockerfile | `mise/back_test.sh` `rm -rf`, `bp_back/Dockerfile:1` |

Dedup: `/api/health` readiness stays in AGENTS.md (command) and routing/CLAUDE.md (routing role only); JDK 25 stays in AGENTS.md (failure-mode note) while CLAUDE.md only names the mise pin. No further duplicates found.

`mise.toml` / `.zed/tasks.json`: tasks match, no documented command changed, no sync needed. NFR17: not applicable by decision (no product code).

## Review Triage Log

### 2026-10-21 — Review pass
- verdicts: 15 findings — high 0, medium 0, low 11, false 4, maybe-false 0
- findings:
  - `[low]` `[patch]` (edge) dump archive lands in the docker build context — `.dockerignore` had no `*.archive`; added.
  - `[low]` `[defer]` (edge) rollback checkout needs a clean tree and a tag — fix edits CLAUDE.md.
  - `[low]` `[defer]` (edge) migration grep comment omits the "not needed" line (`Migration.kt:77`) — fix edits CLAUDE.md.
  - `[false]` `[reject]` (edge) restore into a wiped volume — the procedure restores into the existing `db_data` volume; a fresh volume is the documented empty-database case.
  - `[low]` `[defer]` (edge, blind) `-Pdevelopment` unmeasured — fix edits bp_back/CLAUDE.md.
  - `[false]` `[reject]` (edge) package list omits `security` — `ls` shows config, entity, features, mongo, plugins; the list is correct.
  - `[low]` `[reject]` (blind) `./db/data` ruling self-contradicts — text says data is gone; "restore from git history" is a pointer to the old note, not a claim the data is tracked.
  - `[low]` `[defer]` (blind) detached HEAD after rollback — same group as the rollback deferral.
  - `[low]` `[reject]` (blind) generic migration grep too broad — it is an operator filter, not an assertion; narrower would be wrong for future migrations.
  - `[low]` `[reject]` (blind) `*.archive` too broad — no tracked `.archive` file (`git ls-files '*.archive'` is empty); anchoring adds complexity.
  - `[false]` `[reject]` (blind) dump hard-codes `bag_please` — it matches `KTOR_MONGO_DB_NAME` in `docker-compose.yaml`.
  - `[low]` `[defer]` (blind) Audit Record lists only fixed claims — recorded in the deferred list with the hand-refresh note.
  - `[low]` `[reject]` (blind) over-long line in bp_front/CLAUDE.md — cosmetic.
  - `[low]` `[reject]` (blind) bare `gradle` not explained — `mise tasks` and root CLAUDE.md already say mise provides it.
  - `[false]` `[reject]` (intent/gap) verification set thin — docs-only story; the gap reviewer found nothing, and NFR17 is N/A by decision.

## Auto Run Result

Status: done

- Summary: stale claims fixed across the root, backend, frontend and routing `CLAUDE.md` files and `AGENTS.md` (no Gradle wrapper, `/api/health` readiness, `ApiPlayground/` at repo root, runnable dump/rollback, `./db/data` note shortened to the empty-database fact). The refresh was done by hand.
- Files: `CLAUDE.md`, `AGENTS.md`, `bp_back/CLAUDE.md`, `bp_front/CLAUDE.md`, `routing/CLAUDE.md`, `.gitignore`, `.dockerignore`, this spec.
- Review: 1 patch applied (`.dockerignore`), 4 deferred (see frontmatter), the rest rejected as logged.
- Follow-up review recommended: false (no high or medium patches).
- Verification: product-code diff empty; `docker compose config -q` exit 0; `mise tasks` lists tasks. Dump/restore flags not run against a live Mongo.
- Residual risks: dump/restore commands untested; `-Pdevelopment` note unmeasured.
