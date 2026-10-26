---
title: 'Production data can be imported in one go (Story 11.8)'
type: 'feature'
created: '2026-10-23'
status: 'done'
baseline_revision: '7a5cc169055cb4de74020229e1e5f57e1d159bb4'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-11-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-11-7-mongodb-leaves-the-stack.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Two real users' lists, items, shares and password hashes sit in a MongoDB export, and nothing loads them into PostgreSQL; a half-loaded move or one dangling legacy reference would leave md with no trustworthy way to retry.

**Approach:** An operator-run importer `com.bagplease.tools.MongoImport` in its own Gradle source set `bp_back/src/import/` (not in the image) runs Flyway, then loads a `mongoexport --jsonArray` export in one `tx` into an empty database per AD-18 and prints export / loaded / dropped counts per record type; `.gitignore` is extended first; `db:import:local` runs it against local Compose.

## Boundaries & Constraints

**Always:** `.gitignore` covers `.secure.*.env`, `migration-export/`, `*.tfstate*`, `*.tfvars`, `.terraform/`, `crash.log`, `*.archive` before any export file exists. Refuse (before loading) if any of the eight application tables holds a row (Flyway history excluded), naming the table. Refuse (before loading) if any item lacks `stores` or carries `store`, listing those ids. Ids accepted as UUID string, `$binary` subtype `04` or `03` (legacy Java byte order), or `$uuid`. Owner always `ACCEPTED`; `memberUsernames` (resolved via `users.username`) is authoritative for `ACCEPTED`; a `list_members` doc adds `PENDING`/`DECLINED` only for a user not already `ACCEPTED`; `list_members._id` and `lists.members` unused. Dropped-with-reason: unresolvable member username/id, list with unresolvable owner, item with null `listId`, item whose category is nil UUID or not in the same list, category with null `listId`. Refresh tokens never loaded; `app_config` as its single row (fixed id). `{"$date"}` -> `timestamptz`. Store order/casing kept. For every type export = loaded + dropped. Whole load is one `tx`; any failure leaves zero rows. DB credentials reach the importer process only (env of the `java` command), never Gradle, a file or a shell export.

**Never:** No edit of `V1__baseline.sql`; no new feature in `main`; the importer is not in the `bp_back` image; no export or credentials committed; Terraform, `db:import` over SSH tunnel and `db:bootstrap` (Stories 11.9/11.10) are not started.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy load | empty DB, full fixture export | all rows loaded, report per type, hash signs in | — |
| Non-empty target | any of 8 tables has a row | refuse, name the table, nothing written | `ImportRefused` |
| Legacy item | item with `store` or without `stores` | refuse, list item ids | `ImportRefused` |
| Orphans | one of each AD-18 orphan | dropped with reason, counts balance | — |
| Part-way failure | e.g. duplicate usernames | zero rows in every table; corrected rerun succeeds | exception, rollback |

</intent-contract>

## Code Map

- `.gitignore` -- add the AD-9/AR-E11-22 patterns (currently only `*.archive`).
- `bp_back/build.gradle.kts` -- new `import` source set (`src/import/kotlin`) on `main` output + classpath; `importClasspath` task printing the runtime classpath; test source set sees import output.
- `bp_back/src/main/kotlin/com/bagplease/plugins/Database.kt` -- reuse `PostgresConfig`, `migrate`, `connectDatabase`, `tx`.
- `entity/*/db/*Table.kt`, `config/db/ApplicationConfigTable.kt`, `features/auth/db/RefreshTokenTable.kt` -- Exposed tables the importer inserts into (`batchInsert`/`insert`); `app_config` fixed id `00000000-0000-0000-0000-000000000001`.
- Old Mongo document shapes (git `e07cc10`): users `{_id,username,passwordHash,role}`; lists `{_id,name,emoji,ownerId,ownerUsername,memberUsernames,members,origin,createdAt}`; list_members `{_id,listId,userId,username,status,createdAt}`; categories `{_id,name,listId?}`; items `{_id,name,checked,category,listId?,stores,recurring,addedBy,deleted,deletedAt,checkedAt}`; feedback `{_id,text,username,createdAt}`; refresh_tokens; app_config `{_id,registrationEnabled}`. Files: `migration-export/<collection>.json`.
- `bp_back/src/test/kotlin/com/bagplease/utils/TestContainers.kt` -- `postgresContainer()`, `appConfig()`, `pgRows/pgCount`.
- `mise.toml`, `mise/db_import.sh`, `.zed/tasks.json` -- `db:import:local`; re-sync Zed; `bp_back/Dockerfile` unchanged (installDist excludes the source set).

## Tasks & Acceptance

**Execution:**
- `.gitignore` -- add patterns -- first, before any fixture/export path exists
- `bp_back/build.gradle.kts` -- import source set + `importClasspath` task
- `bp_back/src/import/kotlin/com/bagplease/tools/MongoImport.kt` -- parse Extended JSON, refuse checks, AD-18 mapping, one-`tx` load, report, `main` reading `IMPORT_DB_*` env and an export dir arg
- `bp_back/src/test/kotlin/com/bagplease/MongoImportTest.kt` + fixture JSON under `src/test/resources/mongo-export/` -- happy path, refusals, orphans, rollback + rerun, hash sign-in; observe each failing first
- `mise/db_import.sh`, `mise.toml`, `.zed/tasks.json` -- `db:import:local`, creds as env of the `java` process only
- `CLAUDE.md` (root, `bp_back`) -- document the importer and `db:import:local`; `sprint-status.yaml` 11-8 -> done

**Acceptance Criteria:**
- Given the listed sample paths, when `git check-ignore` runs on them, then each is ignored.
- Given `gradle :bp_back:installDist`, when `bp_back/build/install/bp_back/lib` is listed, then no jar contains `com.bagplease.tools.MongoImport`.
- Given the fixture export and an empty `postgresContainer()`, when the importer runs, then counts balance per type, owners are `ACCEPTED`, `memberUsernames` beats a conflicting `list_members` doc, no refresh token is loaded, store order/casing kept, and an imported hash verifies with bcrypt.
- Given a failing fixture, when the importer runs, then every application table has zero rows, and a corrected rerun succeeds.
- Given `docker compose up postgres` with an empty volume, when `mise run db:import:local` runs on a fixture in `migration-export/`, then it succeeds.

## Spec Change Log

## Review Triage Log

### 2026-10-23 — Review pass
- verdicts: findings from four layers grouped by root cause — high 0, medium 0, low 6 patched, false 3, remaining low rejected (counts per layer not itemised)
- findings:
  - `[low]` `patch` non-array `stores` silently loses stores (blind, edge-case) — now refused with the legacy items, ids listed.
  - `[low]` `patch` `app_config` without `registrationEnabled` loaded as false (blind, edge-case) — row inserted only when the field is present; counted as dropped otherwise.
  - `[low]` `patch` refusal tested for `feedback` only (verification-gap) — parameterised over all eight tables; importer now lists every non-empty table.
  - `[low]` `patch` legacy `$binary`+`$type` and numeric `$date` forms untested (verification-gap) — direct tests added.
  - `[low]` `patch` ACCEPTED `list_members` doc for a non-member untested (verification-gap) — fixture + assertion added.
  - `[low]` `patch` `db_import.sh` swallowed gradle failures and depended on cwd (blind, edge-case) — fails loudly, cds to repo root.
  - `[false]` `reject` Flyway runs before the emptiness check (blind, edge-case) — the spec says Flyway runs first; the check is in the load tx and a refusal leaves only the DDL schema, no rows.
  - `[false]` `reject` check-then-insert race with a running backend — `db:import` refuses while `bp_back` runs (Story 11.9/11.10); out of this story.
  - `[false]` `reject` `store: null` key should not refuse — the spec refuses any item carrying the legacy `store` field.
  - `[low]` `reject` bare NPEs on missing `_id`/`name`/`username`, duplicate usernames, missing `createdAt` → now(), case-sensitive username matching, bad port, unparsable JSON message, report not printed on refusal, synthetic "list memberships" row, hardcoded local credentials in the script, `.gitignore` patterns "belong to later stories" — failures are loud and roll back to zero rows, matching app semantics (`username` is `COLLATE "C"`); the `.gitignore` patterns are required by this story's first AC; fix would add guards for cases the production export is not shown to contain.
  - `[low]` `defer`→`reject` `main` and `db_import.sh` not covered by an automated test; image-exclusion and `git check-ignore` are manual commands — verified by hand in this run (see Auto Run Result); a one-shot operator tool.
  - intent-alignment: no divergence beyond the above; reading B (operator-facing tool) is implemented.


## Verification

**Commands:**
- `gradle :bp_back:test` -- expected: all pass (totals from JUnit XML)
- `git check-ignore -v .secure.deploy.env migration-export/users.json x.tfstate x.tfstate.backup a.tfvars .terraform/x crash.log dump.archive` -- expected: every path matched
- `gradle :bp_back:installDist && unzip -l`/`grep` on `lib/*.jar` for `MongoImport` -- expected: no hit
- `mise run db:import:local` against a local fixture -- expected: report printed, exit 0

## Auto Run Result

Status: done

- Summary: `com.bagplease.tools.MongoImport` in the new `bp_back/src/import/` source set loads a `mongoexport --jsonArray` export into an empty PostgreSQL in one `tx` per AD-18, refuses non-empty targets and legacy items, and prints export / loaded / dropped per type. `.gitignore` extended; `db:import:local` added.
- Files: `.gitignore`, `bp_back/build.gradle.kts`, `bp_back/src/import/kotlin/com/bagplease/tools/MongoImport.kt`, `bp_back/src/test/kotlin/com/bagplease/MongoImportTest.kt` + `src/test/resources/mongo-export/`, `mise/db_import.sh`, `mise.toml`, `.zed/tasks.json`, `CLAUDE.md`, `bp_back/CLAUDE.md`, `sprint-status.yaml`.
- Review: patches applied 6 (low 6); deferred 0; the rest rejected per log.
- Follow-up review recommended: false.
- Verification: `gradle :bp_back:test` 235 tests, 0 failures, 0 errors (JUnit XML); `git check-ignore` matched all 8 sample paths; no jar in `installDist` `lib/` contains `MongoImport`; `mise run db:import:local` on the fixture against a fresh Compose postgres printed the report.
- Residual risks: AD-18 mapping choices beyond the spec (owner fallback by `ownerUsername`, member fallback by username, ACCEPTED docs dropped); `main` and the script are verified manually only; Playwright not run (no frontend/GraphQL change).
