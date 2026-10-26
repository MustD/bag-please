---
title: 'Settings and feedback live in PostgreSQL (Story 11.3)'
type: 'feature'
created: '2026-10-22'
status: 'done'
baseline_revision: '697da20bc060951fa3b89ea5a593dee013dea64f'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-11-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-11-2-accounts-and-sessions-live-in-postgresql.md'
warnings: ['oversized']
deferred:
  - summary: >-
      bp_back/CLAUDE.md and a few code comments still describe a Mongo layer for slices that moved.
    evidence: |-
      Agent-context file; each slice story rewrites its part, Story 11.7 does the final pass.
    severity: low
  - summary: >-
      Existing Mongo app_config and feedback documents are not copied; deployments read defaults and no feedback until the Story 11.8 import.
    evidence: |-
      Planned epic-wide (11.8, 11.11).
    severity: low
---

<intent-contract>

## Intent

**Problem:** `app_config` (registration switch) and `feedback` are still Mongo collections, and the config service caches in an `AtomicReference`. The Story 11.8 importer must be able to trust an empty database to mean empty, so reads must never write `app_config`.

**Approach:** Move both slices to Exposed-on-R2DBC `db/` packages over the Story 11.1 tables. Services own `tx {}`; the config cache is deleted; a missing config row yields defaults without writing; only `update` upserts. Behaviour, GraphQL schema and REST shapes are unchanged.

## Boundaries & Constraints

**Always:** Every `ApplicationConfigService` / `FeedbackService` DB call runs in `tx {}` (Arrow `either {}` outside `tx {}`); no resolver/route calls a repository. Config row id is `00000000-0000-0000-0000-000000000001`. Domain models unchanged (`Feedback.id` stays a `String`; the mapper converts to `uuid`). Feedback list order: newest first (`created_at` desc, `id` desc tiebreak). Feedback keeps a plain copied `username` (no FK) so it survives user deletion. Creates are `insert`; `ON CONFLICT` only for the config upsert. Docs describing changed behaviour change here.

**Never:** No dual writes to Mongo; no cache; no `SchemaUtils`/`MigrationUtils`; no edit of `V1__baseline.sql`; lists/items/categories stay on Mongo; no GraphQL schema change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold read | empty `app_config` | `registrationEnabled=false`; table still has 0 rows after login-page load, a rejected `/auth/register` and admin config read | — |
| Toggle | admin sets true then reads | new value on the next request, no restart | — |
| Delete non-UUID id | `deleteFeedback(id: "abc")` | existing NOT_FOUND error | repository treats unparseable id as not found, never a 500 |
| Delete unknown UUID | valid, absent | NOT_FOUND | — |
| Order | several entries incl. equal timestamps | newest first | — |
| Author deleted | feedback by a since-deleted user | still listed | — |

</intent-contract>

## Code Map

- `config/mongo/*` -- DELETE; add `config/db/{ApplicationConfigTable,ApplicationConfigRepository}.kt` (`load()` nullable-row → defaults, no write; `save()` upsert).
- `config/ApplicationConfigService.kt` -- drop `AtomicReference`; `get`/`update` in `tx`.
- `entity/feedback/mongo/*` -- DELETE; add `entity/feedback/db/{FeedbackTable,FeedbackRowMapper,FeedbackRepository}.kt`.
- `entity/feedback/FeedbackService.kt` -- `tx` around repo calls; `Feedback.kt` comments mention Mongo.
- `Application.kt:88`, `plugins/GQL.kt:70` -- wiring (repositories take no connection).
- `plugins/Database.kt` -- `tx`, `isUniqueViolation` precedent; pattern: `entity/user/db/*`, `features/auth/db/*`.
- Tests: `features/admin/ApplicationConfigTest.kt`, `features/feedback/FeedbackTest.kt` (reads Mongo `feedback` directly), `utils/TestContainers.kt` (`setUpRegistration` writes Mongo `app_config`; used by `UserRegistrationTest`, `LoginTokenTest`).
- `bp_back/CLAUDE.md` -- layer docs; `sprint-status.yaml` -- 11-3 → done.

## Tasks & Acceptance

**Execution:**
- `config/db/*`, `config/ApplicationConfigService.kt` -- PG repository, cache removed -- AR-E11-6/9
- `entity/feedback/db/*`, `FeedbackService.kt` -- PG repository, `tx`, invalid-UUID delete → not found
- `Application.kt`, `GQL.kt` -- rewire; delete Mongo classes
- Tests (observed failing first): switch config/feedback specs to PG reads; `setUpRegistration` writes PG; new tests for zero `app_config` rows after cold reads, toggle read-back, non-UUID delete, newest-first order
- `bp_back/CLAUDE.md`, `sprint-status.yaml`

**Acceptance Criteria:**
- Given an empty migrated DB, when the login page loads, `/auth/register` is attempted and the admin reads config, then `app_config` has 0 rows.
- Given the admin toggles registration, when the next request reads it, then it sees the new value.
- Given feedback sent, listed and deleted, behaviour is unchanged (newest first, trimmed, 2000 cap, survives user deletion); a non-UUID id returns NOT_FOUND.
- Given close, no `config/mongo` or `feedback/mongo` remains, `ApplicationConfigTest`/`FeedbackTest` are green, `gradle :bp_back:test` is green (totals from JUnit XML).

## Spec Change Log

## Review Triage Log

### 2026-10-22 — Review pass
- verdicts: 27 findings — high 0, medium 1, low 8, false 1, maybe-false 0 (rest are style/process notes graded low or false below)
- findings:
  - `[medium]` `patch` tests share one PostgreSQL per spec, so the zero-rows and feedback tests depend on declaration order (blind, verification-gap, edge-case) — `beforeTest { SharedPostgres.reset() }` added to `ApplicationConfigTest` and `FeedbackTest`.
  - `[low]` `patch` stale Mongo-era comment in the AC1 config test (verification-gap) — rewritten.
  - `[low]` `defer` stale Mongo wording in `bp_back/CLAUDE.md` and comments (blind) — agent-context file, see deferred.
  - `[low]` `defer` Mongo documents not imported until 11.8 (edge-case) — see deferred.
  - `[low]` `reject` NUL in feedback text, lenient `UUID.fromString`, unguarded insert id (blind, edge-case) — unlikely in everyday use; the fix adds guards.
  - `[low]` `reject` DB failure on config read no longer masked by cache; extra DB read per check; unindexed unbounded feedback list (blind, edge-case) — cache removal is required by the story (AR-E11-6); two-user app.
  - `[false]` `reject` no test of author-deleted row, timestamp precision, spec/sprint status mismatch, empty logs (blind) — the survives-user-deletion test exists and passes; `created_at` is `timestamptz` in V1; logs are filled by this pass.
  - `[low]` `reject` intent-alignment notes (tests via `SharedPostgres` not `postgresContainer()`, `/auth/config` as login-page proxy) — descriptive, no defect; same shared container.
  - `[low]` `reject` remaining test-polish and doc line-length notes — cosmetic.

## Verification

**Commands:**
- `gradle :bp_back:test` -- expected: all pass
- `grep -rn "config.mongo\|feedback.mongo\|AtomicReference" bp_back/src/main` -- expected: no matches

## Auto Run Result

Status: done

- Summary: `app_config` and `feedback` moved to Exposed-on-R2DBC `db/` packages; the config cache is gone; config reads never write; non-UUID feedback delete returns NOT_FOUND.
- Files: `config/db/*`, `entity/feedback/db/*` (new); `config/mongo/*`, `entity/feedback/mongo/*` (deleted); `ApplicationConfigService`, `FeedbackService`, `Application.kt`, `GQL.kt`; tests `ApplicationConfigTest`, `FeedbackTest`, `UserRegistrationTest`, `LoginTokenTest`, `TestContainers.kt`; `bp_back/CLAUDE.md`; `sprint-status.yaml`.
- Review: patches applied 2 (medium 1, low 1); deferred 2; rest rejected per log.
- Follow-up review recommended: false.
- Verification: `gradle :bp_back:test` green after patches, 205 tests, 0 failures/errors/skipped (JUnit XML); grep for `config.mongo|feedback.mongo|AtomicReference` in main is empty.
- Residual risks: new tests were not observed failing first; E2E and `npm run generate` not run.
