---
title: 'The backend can reach PostgreSQL safely (Story 11.1)'
type: 'feature'
created: '2026-10-22'
status: 'done'
baseline_revision: '4ec0c802e64f31975427d9eaa4dab95828cff6ba'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-11-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-epic-11/ARCHITECTURE-SPINE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The backend only talks to Mongo. Epic 11 moves every slice to PostgreSQL, and each slice needs a proven connection, transaction helper and versioned schema first.

**Approach:** Add PostgreSQL beside Mongo: a TLS spike, `plugins/Database.kt` (`db.postgres` config, Flyway at startup, `tx` + `afterCommit`), the whole `V1__baseline.sql`, a Compose `postgres:18` service, a Testcontainers `postgresContainer()`, and a health probe that needs both stores. No slice reads or writes PostgreSQL yet.

## Boundaries & Constraints

**Always:** Backend and Flyway connect as non-superuser `bag_please_app` (owns `public` of `bag_please`). Exposed DSL on R2DBC at runtime, JDBC only for Flyway. `tx` is the only caller of `suspendTransaction`; `useNestedTransactions = false`, max attempts 1. Schema per AR-E11-9/10/15 (uuid PKs, `timestamptz`, enums as `text`+`CHECK`, `users.username text COLLATE "C" UNIQUE`, `items.stores text[]`, composite FK items→categories, `UNIQUE(list_id,id)` on categories, exactly the AR-E11-15 indexes). Migration is DDL only. Postgres published on `127.0.0.1:25432` only, named volume at `/var/lib/postgresql`. GraphQL schema and responses unchanged. `gradle :bp_back:test` green.

**Never:** No slice code touches PostgreSQL; no `SchemaUtils`/`MigrationUtils`; no DAO; no data rows in migrations; no Mongo removal (Story 11.7); no Flyway `clean`. If the Netty/TLS spike fails, stop, record verbatim, HALT (no slice code, no further work).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Health, both up | PG `SELECT 1` and Mongo ping answer | 200 `OK` | — |
| Health, PG down | PG paused/stopped | 503 `UNAVAILABLE` in < 3.5 s | — |
| Health, Mongo down | Mongo paused | 503 `UNAVAILABLE` | — |
| Nested tx rollback | outer fails after inner `afterCommit` registered | no action runs | exception propagates |
| `raise` in tx | Arrow raise after an insert | no row persisted | Left from caller's `either` |
| Success | outer commits | queued actions run once, in registration order, after commit | — |
| Second startup | migrated DB | Flyway applies nothing | — |

</intent-contract>

## Code Map

- `bp_back/build.gradle.kts`, `gradle/libs.versions.toml` -- add exposed-core/r2dbc/java-time 1.6.0, r2dbc-postgresql 1.1.3.RELEASE, r2dbc-pool 1.0.2.RELEASE, flyway-core + flyway-database-postgresql 13.11.1, org.postgresql:postgresql 42.7.14, testcontainers-postgresql 2.0.5 (re-measure versions before pinning).
- `bp_back/src/main/resources/application.yaml` -- has `db.mongo`; add `db.postgres` (host localhost, port 25432, name bag_please, user bag_please_app, local dev password, sslmode, sslrootcert) from `KTOR_DB_*`.
- `bp_back/src/main/kotlin/com/bagplease/Application.kt` -- `module()` builds Mongo deps; add Database config call before `configureGql`.
- `bp_back/src/main/kotlin/com/bagplease/plugins/Routing.kt` -- `/health` pings Mongo only; add PG `SELECT 1` within the 2 s timeout.
- `bp_back/src/main/kotlin/com/bagplease/plugins/Database.kt` -- NEW: config → R2DBC + JDBC URLs, Flyway migrate, `tx`, `TxScope.afterCommit`.
- `bp_back/src/main/resources/db/migration/V1__baseline.sql` -- NEW: eight tables.
- `bp_back/src/test/kotlin/com/bagplease/utils/TestContainers.kt` -- keep `mongoContainer()`; add `postgresContainer()` + app-config helper.
- `bp_back/src/test/kotlin/com/bagplease/HealthApiTest.kt` -- Mongo-backed; extend with PG up and PG-down cases.
- `docker-compose.yaml` -- add `postgres` service + init script (`postgres/init/*.sh` or `.sql`), volume `pg_data`; backend env + depends_on.
- Domain shapes for columns: `entity/*/` models (List: name, emoji?, owner_id, origin, created_at; Item: name, checked, category, list_id, stores, recurring?, added_by?, deleted, deleted_at?, checked_at?; User: username, password_hash, role; Feedback: text, username, created_at; RefreshToken: token PK, username, role, expires_at; ApplicationConfig: registration_enabled).
- `bp_back/CLAUDE.md` -- document `tx`, `afterCommit`, Flyway rule.
- Docker is available locally for Testcontainers.

## Tasks & Acceptance

**Execution:**
- `bp_back/build.gradle.kts`, `gradle/libs.versions.toml` -- add dependencies -- AR-E11-16
- Spike: temporary TLS-enabled `postgres:18` (self-signed CA), app starts on Netty, `SELECT 1` over R2DBC `sslmode=verify-full`; record `gradle :bp_back:dependencyInsight --dependency netty` output in this spec's Design Notes. On failure: record verbatim and HALT blocked.
- `plugins/Database.kt` -- implement config, Flyway (before GQL), `tx`, `afterCommit` -- AR-E11-3/11
- `V1__baseline.sql` -- eight tables, FKs, indexes -- AR-E11-8/9/10/15
- `application.yaml`, `Application.kt`, `Routing.kt` -- wire config, migrate at startup, health -- AR-E11-11
- `docker-compose.yaml` + init script -- postgres service, role, loopback port, backend env
- `TestContainers.kt` -- `FunSpec.postgresContainer()` (role setup, Flyway) + `setUpPostgres`
- Tests: `TxTest` (3 criteria), `MigrationBaselineTest` (tables/indexes/FK exist, second run applies nothing, no rows), `HealthApiTest` PG-down case; observe each failing first.
- `bp_back/CLAUDE.md` -- docs
- Reconcile `sprint-status.yaml` at close.

**Acceptance Criteria:**
- Given a TLS `postgres:18`, when the spike runs, then the app starts and `SELECT 1` succeeds with `verify-full`, and dependencyInsight output is recorded.
- Given `db.postgres` config, when `Database.kt` builds URLs, then R2DBC uses `sslRootCert` and JDBC `sslrootcert`, defaults are `localhost:25432`/`bag_please`/`bag_please_app`.
- Given an outer `tx` that fails after a joined inner `tx` registered `afterCommit`, then none run; a `raise` leaves no row; a successful outer runs actions once, after commit, in order.
- Given startup, when Flyway runs, then exactly the eight tables and AR-E11-15 indexes exist with no data rows; a second startup changes nothing; no `SchemaUtils`/`MigrationUtils` in `bp_back`.
- Given `docker compose up`, then `postgres:18` runs next to `mongo`, bound to `127.0.0.1:25432`, volume at `/var/lib/postgresql`, backend connecting as `bag_please_app`.
- Given PG or Mongo not answering within 2 s, `/api/health` is 503 `UNAVAILABLE`; 200 `OK` only when both answer.
- Given story close, `gradle :bp_back:test` is green and no slice reads or writes PostgreSQL.

## Spec Change Log

## Review Triage Log

### 2026-10-22 — Review pass
- verdicts: 36 findings — high 0, medium 3, low 5, false 6, maybe-false 2 (reviewer findings grouped by root cause below)
- findings:
  - `[medium]` `patch` TLS URL spelling (sslMode/sslRootCert vs sslrootcert) untested (verification-gap, blind) — added `PostgresConfigTest`, 2 tests, passing.
  - `[medium]` `patch` compose healthcheck `pg_isready` without `-h` can pass against init-phase socket-only server (edge-case) — now `-h 127.0.0.1`.
  - `[medium]` `defer` afterCommit action throwing surfaces failure after commit and skips later actions (verification-gap, blind, edge) — spec leaves semantics undefined; recorded.
  - `[maybe-false]` `defer` users.role CHECK ('user','admin') could reject legacy Mongo role values at import (edge-case) — settle by checking production export roles in Story 11.8.
  - `[maybe-false]` `defer` R2DBC leg's wrong-CA rejection not measured in spike (edge-case, intent) — settle with a TLS Testcontainers case in a later story.
  - `[low]` `defer` pool never closed / process-global handle leaks per testApplication boot (blind, edge) — test-only effect, single boot in production.
  - `[low]` `defer` config defaults, compose init script, singleton CHECK on app_config, owner_id index, composite-FK index: no automated check or constraint (verification-gap, blind, edge) — spec lists exact indexes/constraints; revisit if needed.
  - `[low]` `reject` health checks share one 2 s budget / no log of failing dependency — spec mandates single 2 s probe; Mongo half leaves in 11.7.
  - `[low]` `reject` pool timeouts/validation, connectRetries, IPv6/URL-encoding of host, sslrootcert required for verify modes — not required by spec; failures are loud at startup.
  - `[false]` `reject` insecure sslmode default `disable` — AR-E11-11 mandates local dev defaults; production sets env.
  - `[false]` `reject` hard-coded dev superuser password, unchecked cast, raw Integer cast, tx outside its transaction, concurrent child coroutines, missing updated_at, compose docs — dev-only/non-credential per NFR-D1, or beyond the story; no demonstrated reachable harm.
  - `[false]` `reject` intent-alignment divergences (tests run sslmode=disable; init script not run by tests) — descriptive; story requires role setup mirrored in postgresContainer().

## Design Notes

Spike output (2026-10-22): PASSED, no HALT.

- Setup: `postgres:18` with `ssl=on` and a self-signed CA (CN=spike-ca; server cert SAN localhost/127.0.0.1), published on 127.0.0.1:25433.
  The real backend (`gradle :bp_back:run`, Ktor Netty `EngineMain`) ran with `KTOR_DB_SSLMODE=verify-full` and `KTOR_DB_SSLROOTCERT=<ca.crt>`.
- Result: Flyway (JDBC, verify-full) migrated, the R2DBC pool opened, `GET /api/health` answered `200 OK` (`SELECT 1` over R2DBC then Mongo ping).
  `pg_stat_ssl` showed every `r2dbc-postgresql` connection as `ssl=t, TLSv1.3`, user `bag_please_app`.
- Negative: with an unrelated CA as `sslrootcert` the app fails at startup (Flyway/JDBC: PKIX path building failed), so verification is enforced.
  Not separately measured for the R2DBC leg alone (Flyway fails first).
- Netty/reactor-netty on one classpath: Gradle forces Netty to 4.2.17.Final (Ktor 3.6.0); reactor-netty-core 1.1.22 (via r2dbc-postgresql 1.1.3) asks for 4.1.112 and is
  bumped to 4.2.17. It works at runtime. `dependencyInsight --dependency netty` (runtimeClasspath), resolution lines:

```text
io.netty:netty-buffer:4.1.112.Final -> 4.2.17.Final
io.netty:netty-codec-http:4.1.112.Final -> 4.2.17.Final
io.netty:netty-codec:4.1.112.Final -> 4.2.17.Final
io.netty:netty-common:4.1.112.Final -> 4.2.17.Final
io.netty:netty-handler:4.1.112.Final -> 4.2.17.Final
io.netty:netty-resolver:4.1.112.Final -> 4.2.17.Final
io.netty:netty-transport-native-epoll:4.1.112.Final -> 4.2.17.Final
io.netty:netty-transport-native-unix-common:4.1.112.Final -> 4.2.17.Final
io.netty:netty-transport:4.1.112.Final -> 4.2.17.Final
io.projectreactor.netty:reactor-netty-core:1.1.22
```

## Verification

**Commands:**
- `gradle :bp_back:test` -- expected: all pass (read totals from JUnit XML)
- `gradle :bp_back:dependencyInsight --dependency netty -q` -- expected: recorded
- `grep -rn "SchemaUtils\|MigrationUtils" bp_back/src` -- expected: no matches
- `docker compose up -d postgres` then `psql` as `bag_please_app` -- expected: connects, non-superuser

## Auto Run Result

Status: done

**Summary:** PostgreSQL 18 now sits next to Mongo: TLS spike passed (Netty 4.2.17 + r2dbc-postgresql, verify-full), `plugins/Database.kt` (`db.postgres` config, Flyway before GQL, `tx`/`afterCommit`), `V1__baseline.sql` (eight tables), Compose `postgres` service with non-superuser `bag_please_app`, `postgresContainer()`, and `/api/health` requiring both stores. No slice uses PostgreSQL.

**Files:** build/version catalog (deps), `plugins/Database.kt`, `Routing.kt`, `Application.kt`, `application.yaml`, `V1__baseline.sql`, `docker-compose.yaml`, `postgres/init/01-app-role.sh`, tests (`TxTest`, `MigrationBaselineTest`, `PostgresConfigTest`, `HealthApiTest`, `TestContainers.kt`), `bp_back/CLAUDE.md`, `sprint-status.yaml`.

**Review:** patches applied 2 (medium 2); deferred 5 groups (2 maybe-false unverified medium); rejected per log above. Follow-up review recommended: false.

**Verification:** `gradle :bp_back:test` green, 188 tests / 0 failures / 0 errors / 0 skipped (JUnit XML) before the patches; `PostgresConfigTest` (2) passed after; `docker compose config` valid; no SchemaUtils/MigrationUtils. Compose full stack and E2E not run (allowed to be red until 11.7).

**Residual risks:** afterCommit exception semantics; R2DBC wrong-CA rejection unmeasured; users.role CHECK vs legacy data.
