---
title: 'Remove the Mongo migration tooling'
type: 'chore'
created: '2026-10-26'
status: 'done'
baseline_commit: '32a11d14e4f3a0c08b79412ed7b5c9cecc0895e2'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The PostgreSQL migration (Epic 11) is done and production runs on PostgreSQL, but the one-time Mongo export importer, its tasks, guard tests, fixtures and docs are still in the tree and keep being maintained, documented and loaded for no use.

**Approach:** Delete the importer (source set, test, fixtures), the `db:import` / `db:import:local` tasks and their scripts, every guard, task entry and doc passage that exists only for them, and the stale Mongo-era agent memory files. Keep `migration-export/` in `.gitignore` so an old export can never be committed. Leave `_bmad-output/` history (PRD, epics, retros, specs) untouched.

**Decision (md, 2026-10-26):** `db:bootstrap` goes too (option A): it was one-time and has run. Delete `bootstrap-db.sh`, its task and Zed entry, `load_admin`, every `PG_ADMIN_*` unset and guard case. `deploy/README.md` keeps the three grant SQL lines (`GRANT ALL ON SCHEMA public`, `REVOKE CONNECT ... FROM PUBLIC`, `GRANT CONNECT`) as a manual note for recreating the database; Flyway runs on backend startup.

## Boundaries & Constraints

**Always:** `gradle :bp_back:build` (including tests) and `mise run deploy:test` stay green. Docs describe only what still exists. Keep the remaining secret-handling guarantees in `lib.sh` (unset_deploy before Gradle/mise/java/psql) and their guard tests.

**Never:** touch Flyway migrations, `Database.kt`, runtime code in `src/main`, Terraform resources, or anything under `_bmad-output/` besides this spec. No deploy, no `infra:apply`, no push.

</frozen-after-approval>

## Code Map

- `bp_back/src/import/` (whole tree, `MongoImport.kt`) -- delete.
- `bp_back/src/test/kotlin/com/bagplease/MongoImportTest.kt`, `bp_back/src/test/resources/mongo-export/` -- delete; the test also reads `bootstrap-db.sh` (line ~157).
- `bp_back/build.gradle.kts` -- `importSet` source set (l.28-38) and `importClasspath` task (l.101-106). No dependency is importer-only (Jackson comes via ktor-serialization-jackson).
- `mise/db_import.sh`, `deploy/scripts/import.sh` -- delete.
- `deploy/scripts/lib.sh` -- `run_importer` (l.123-141); `require_clean_tree` comment mentions the importer; scratch comment mentions "empty export"; `load_db_outputs`/`need_out` users: drop `load_db_outputs` if only import + bootstrap call it (check `deploy.sh`, `status.sh`); `make_scratch`/`SCRATCH` likewise.
- `deploy/scripts/test-guards.sh` -- import cases (l.105-114), import happy path (l.141-160), bootstrap happy path's java/export checks (l.163-189), stubs for `gradle`/`java` if then unused, `IMPORT_DB_*` stub (l.59).
- `mise.toml` -- `db:import:local` (l.89-91), `db:bootstrap` (l.105-108), `db:import` (l.110-113).
- `deploy/terraform/main.tf` l.92 -- comment mentions `db:bootstrap`'s grants; reword only.
- `.zed/tasks.json` -- matching entries; sync via the `sync-zed-mise-tasks` skill.
- `CLAUDE.md` -- Mongo note in overview (l.24-25), "Importing the Mongo export" section (l.114-121), `db:import` mentions (l.129, 132), "Backups" first sentence (l.148).
- `bp_back/CLAUDE.md` -- "Mongo export importer" section (l.87-94); l.30 history remark may stay.
- `deploy/README.md` -- `db:import` in reachability, secrets (`IMPORT_DB_*`), tasks, runbook steps 1/5, guard list, "Cutover order" section.
- `.claude/projects/-home-md-projects-bag-please/memory/` -- `feedback_mongo_uuid_filter.md`, and the Mongo lines in `MEMORY.md`, `feedback_testapplication_yaml.md`, `project_epic2_arch_decisions.md`.
- `.gitignore` l.58 `migration-export/` -- keep.

## Tasks & Acceptance

**Execution:**
- [x] Delete importer source set, test, fixtures; remove `importSet`/`importClasspath` from `bp_back/build.gradle.kts`.
- [x] Delete `mise/db_import.sh`, `deploy/scripts/import.sh`; remove `run_importer` and dead helpers from `lib.sh`; delete `deploy/scripts/bootstrap-db.sh`, `load_admin` and `PG_ADMIN_*` unsets in `lib.sh`, `infra.sh`, `deploy.sh`, `status.sh`.
- [x] Prune `test-guards.sh` to the remaining scripts.
- [x] Remove tasks from `mise.toml`; sync `.zed/tasks.json`.
- [x] Rewrite the doc passages in `CLAUDE.md`, `bp_back/CLAUDE.md`, `deploy/README.md`.
- [x] Remove or trim the Mongo-era memory files.

**Acceptance Criteria:**
- Given the cleanup, when `git grep -i -E 'mongo|db:import|db:bootstrap|importClasspath|IMPORT_DB|PG_ADMIN'` runs outside `_bmad*`, then it only hits `.gitignore`'s `migration-export/` comment/entry and historical remarks deliberately kept (e.g. "MongoDB left the stack in Story 11.7").
- Given the cleanup, when `mise tasks` runs, then no `db:import*` or `db:bootstrap` task is listed and `.zed/tasks.json` matches `mise.toml`.

## Implementation Notes

- Deleted: `bp_back/src/import/`, `MongoImportTest.kt`, `src/test/resources/mongo-export/`, `mise/db_import.sh`, `deploy/scripts/import.sh`, `deploy/scripts/bootstrap-db.sh`, old memory `feedback_mongo_uuid_filter.md`.
- `lib.sh`: removed `run_importer`, `load_db_outputs`, scratch dir + `cleanup` trap, `load_admin`; `deploy.sh`'s `on_exit` called the now-gone no-op `cleanup` (caught by `deploy:test`), call removed.
- `.zed/tasks.json` regenerated with `mise run zed:sync` (the file is generated).
- README "Live runbook" became "Setting up a new database" with the grants as a manual `psql` step; "Cutover order" removed.
- Review exposed a pre-existing leak: `deploy.sh` ran `require_clean_tree` (git) before unsetting `DIGITALOCEAN_TOKEN` / un-exporting `KTOR_*`; reordered, and a guard now asserts neither reaches terraform or git.
- Verified: `gradle :bp_back:build` (224 tests, 0 failures), `mise run deploy:test` (all pass), `bash -n` clean.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Route / evidence |
|---|---------|---------|------------------|
| 1 | Token-never-reaches-terraform assertion lost with import happy path | medium | patch: added to `deploy <version>` case; it then exposed the pre-existing git leak, fixed |
| 2 | `git.env` logged but never asserted | low | patch: covered by #1 |
| 3 | ssh stub `docker ps` branch dead | low | patch: removed |
| 4 | `.secure.deploy.env.example` header names db tasks | low | patch |
| 5 | README "infra/db tasks" | low | patch |
| 6 | `ApplicationConfigTest` comment cites the importer | low | patch |
| 7 | Runbook step 5 `mise run deploy` refuses an already-published tag | medium | patch: `deploy -- <current version>` |
| 8 | Runbook step 3 lost the concrete psql command | low | patch |
| 9 | Runbook step 4 lost the private-host caveat and AD-14 stop rule | medium | patch: restored |
| 10 | test-guards header overstates coverage | low | patch |
| 11 | `.gitignore` `*.archive` is the mongodump format | false | kept: a local prod mongodump archive is still in the tree; dropping the rule made it committable |
| 12 | Long lines in CLAUDE.md / README | low | patch: reflowed |
| 13 | CLAUDE.md lost the operator-IP requirement | low | patch: restored one sentence |
| 14 | AC grep pattern too narrow | false | fix edits this spec; leftovers it would catch were fixed via #4-#6 |
| 15 | Spec bookkeeping unfinished | false | fix edits this spec; step 5 finalizes |
| 16 | Memory edits target an old project path | false | md explicitly asked to clean those tracked files |

## Verification

**Commands:**
- `gradle :bp_back:build` -- expected: success, tests green.
- `mise run deploy:test` -- expected: all guard cases `ok`.
- `bash -n deploy/scripts/*.sh mise/*.sh` -- expected: no syntax errors.
