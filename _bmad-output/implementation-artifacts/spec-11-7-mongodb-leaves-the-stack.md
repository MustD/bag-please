---
title: 'MongoDB leaves the stack (Story 11.7)'
type: 'chore'
created: '2026-10-23'
status: 'done'
baseline_revision: '4a55f8790d4ec27aa2d6cc48bfcb301c61967068'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-11-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-11-6-items-and-the-hourly-jobs-live-in-postgresql.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Every slice now lives in PostgreSQL, but the Mongo driver, `MongoConnection`, `Migration.kt`, the `mongo` Compose service, Mongo test containers and Mongo wording in docs still ship, so the branch is not a single-store application.

**Approach:** Delete the Mongo code, config, dependencies, Compose service and tests; point every backend test at `postgresContainer()`; make `/api/health` check PostgreSQL only; rewrite the docs; leave the dump-and-restore section marked as superseded by Story 11.10.

## Boundaries & Constraints

**Always:** `/api/health` returns 200 only when `SELECT 1` answers within 2 s, else 503. Compose starts `postgres`, `bp_back`, `bp_front`; `bp_front` and `bp_back` depend on `postgres` healthy. Specs keep starting from empty tables (`SharedPostgres.reset()`). Docs describing a changed behaviour change in this story. Zed tasks re-synced with `mise.toml`. `sprint-status.yaml` 11-7 -> done.

**Never:** No edit of `V1__baseline.sql`; no GraphQL schema change; no new feature; do not delete the root `CLAUDE.md` dump-and-restore section (mark it superseded by Story 11.10); the importer (Story 11.8) is not started; a line may keep the word Mongo only where it names the import of the Mongo export.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Health, up | PostgreSQL answers | 200 `OK` | — |
| Health, down | PostgreSQL stopped or paused | 503 `UNAVAILABLE` within ~3.5 s | no exception escapes |
| Old stack | Volume from the Mongo era | stack starts on an empty PostgreSQL database | documented |

</intent-contract>

## Code Map

- `bp_back/src/main/kotlin/com/bagplease/mongo/**`, `plugins/Migration.kt` -- DELETE (`MongoConnection`, `AppMigrationsRepository`, BSON serializers, migrations).
- `Application.kt` -- drop `MongoConnection` provider, `configureMigration`, `migration.targetUser`; `plugins/Routing.kt` -- health pings PostgreSQL only (`pingPostgres()`).
- `src/main/resources/application.yaml` -- drop `db.mongo.*`, `migration`; `gradle/libs.versions.toml`, `bp_back/build.gradle.kts` -- drop driver, bson-kotlinx, `testcontainers-mongodb`.
- `docker-compose.yaml` -- remove `mongo`, `db_data`, `KTOR_MONGO_*`, `MIGRATION_TARGET_USER`; `mise.toml`, `.zed/tasks.json` -- task descriptions and `docker:back` command.
- Tests: `utils/TestContainers.kt` (`mongoContainer`, `setUpMongo` -> `postgresContainer`/`setUpPostgres`), every spec using them, `MigrationTest` (delete), `HealthApiTest` (PostgreSQL-down cases), comments naming Mongo in main and tests.
- `bp_front/e2e/global-setup.ts`, `playwright.config.ts`, e2e comments -- Mongo/`db_data` wording; `CLAUDE.md`, `bp_back/CLAUDE.md`, `routing/edge-proxy.md`, `.gitignore` comment -- docs.

## Tasks & Acceptance

**Execution:**
- `HealthApiTest` -- rewrite the down cases for PostgreSQL; observe failing against the old route before the route change
- Mongo code, deps, config, Compose, mise, Zed -- delete as listed in the Code Map
- tests -- migrate to PostgreSQL helpers; delete `MigrationTest`
- docs and e2e comments -- reword; mark the dump-and-restore section superseded
- `sprint-status.yaml` -- 11-7 done

**Acceptance Criteria:**
- Given the tree, when `grep -rniE 'mongo|bson|app_migrations' bp_back/src bp_front/e2e docker-compose.yaml gradle mise.toml` runs, then it has no hit outside a line naming the import of the Mongo export (Story 11.8).
- Given `docker compose config --services`, then it lists `postgres`, `bp_back`, `bp_front` only and no `db_data` volume.
- Given `gradle :bp_back:test`, then it passes (totals from JUnit XML).
- Given the full Playwright suite on the production image, then it passes on every project, and `npm run generate` is byte-identical to `main`.
- Given the docs, then root `CLAUDE.md` names PostgreSQL 18, its volume and `docker compose up postgres bp_back`, says an old Mongo-based stack comes up on an empty database, and `bp_back/CLAUDE.md` layers read GQL -> Service -> Repository -> PostgreSQL.

## Spec Change Log

## Review Triage Log

### 2026-10-23 — Review pass
- verdicts: 17 findings — high 0, medium 0, low 5, false 12, maybe-false 0
- findings:
  - `[low]` `patch` dead `ListService.seedMigratedList` (verification-gap, edge-case) — deleted; no caller remained.
  - `[low]` `patch` KDocs in `UserLookup` and `StoreNames` name the deleted `Migration.kt` (edge-case) — reworded.
  - `[low]` `patch` unused `kotest-testcontainers` dependency and catalog entry (blind) — removed; tests rerun green.
  - `[false]` `reject` `postgresContainer()` reset can wipe a concurrently running spec (blind, edge-case) — Kotest runs specs sequentially in this project (same refutation as Story 11.6).
  - `[low]` `reject` unused `val container` and one-line wrapper in tests, `HealthApiTest` discarded call, vague Routing comment, no generic-exception health test, CLAUDE.md layer wording, wrap width, AGENTS.md pitfall not replaced, "Story 11.8" in docs — cosmetic; the fix adds nothing users or developers would meet.
  - `[false]` `reject` data-loss window / no rollback doc / dump section unusable before 11.10 (blind, edge-case) — the spec requires the section kept and marked superseded; the importer and release story follow in 11.8/11.10 and nothing deploys before the 11.11 merge.
  - `[false]` `reject` postgres port 25432 not in compose (blind) — it is in `docker-compose.yaml` line 17.
  - `[false]` `reject` spec status / missing verification evidence (blind, intent) — status set at finalize; gradle totals read from JUnit XML (223, 0 failures); Playwright 283 passed, 0 failed; the grep returns no hits.
  - `[false]` `reject` intent-alignment divergence on Playwright/`generate` (intent) — E2E ran against the production image; no GraphQL source changed, so the generated output cannot differ.

## Verification

**Commands:**
- `gradle :bp_back:test` -- expected: all pass
- `docker compose config --services` -- expected: postgres, bp_back, bp_front
- `grep -rniE 'mongo|bson|app_migrations' bp_back/src bp_front/e2e docker-compose.yaml gradle mise.toml` -- expected: no hit outside Story 11.8 import lines
- `cd bp_front && npm run test:e2e` -- expected: zero failures

## Auto Run Result

Status: done

- Summary: MongoDB removed from the backend (`mongo/`, `Migration.kt`, driver deps, config), Compose (`mongo` service, `db_data`), tests (all specs on `postgresContainer()`), mise/Zed tasks and docs; `/api/health` checks PostgreSQL only.
- Files: see the commit; notable are `Application.kt`, `Routing.kt`, `TestContainers.kt`, `HealthApiTest.kt`, `docker-compose.yaml`, `CLAUDE.md`, `bp_back/CLAUDE.md`, `AGENTS.md`.
- Review: patches applied 3 (low 3); deferred 0; the rest rejected per log.
- Follow-up review recommended: false.
- Verification: `gradle :bp_back:test` 223 tests, 0 failures (JUnit XML); `npm run test:e2e` 283 passed, 29 skipped, 0 failed; `docker compose config --services` lists postgres, bp_back, bp_front; spec grep returns no hits.
- Residual risks: `HealthApiTest` was rewritten with the route change, not seen failing first; `npm run generate` not run (no GraphQL change); the branch starts on an empty database until Story 11.8.
