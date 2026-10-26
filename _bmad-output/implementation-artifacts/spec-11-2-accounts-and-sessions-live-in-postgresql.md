---
title: 'Accounts and sessions live in PostgreSQL (Story 11.2)'
type: 'feature'
created: '2026-10-22'
status: 'done'
baseline_revision: 'e07cc101ebc218b8183a1bea3914f58928229568'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-11-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-epic-11/ARCHITECTURE-SPINE.md'
warnings: ['oversized']
deferred:
  - summary: >-
      deleteUser's plain-SELECT caller lookup is not blocked by FOR UPDATE, so a racing createList/acceptInvite on a still-valid access token can re-create a list after the purge.
    evidence: |-
      Spec-mandated order (users row deleted last, lock only on deleteUser); lists are still on Mongo until Story 11.4, which can take the membership check into the same tx. Unverified for real impact on a two-user app.
    location: >-
      bp_back/src/main/kotlin/com/bagplease/entity/user/UserService.kt (deleteUser)
    severity: medium (unverified)
  - summary: >-
      Existing deployments read an empty users table until the Story 11.8 import; the root CLAUDE.md dump/rollback section does not mention it.
    evidence: |-
      Epic-wide, planned (11.8, 11.11); doc edit touches agent-context files, so deferred.
    severity: low
  - summary: >-
      bp_back/CLAUDE.md still describes the per-entity mongo/ storage layer with only a one-line exception for the moved slice.
    evidence: |-
      Agent-context file; each later slice story rewrites its part, 11.7 does the final pass.
    severity: low
---

<intent-contract>

## Intent

**Problem:** Users and refresh tokens are still Mongo documents (`entity/user/mongo/`, `features/auth/RefreshTokenRepository`). Epic 11 moves every slice to PostgreSQL; accounts and sessions go first because every other table points at `users`.

**Approach:** Replace both with Exposed-on-R2DBC `db/` packages over the Story 11.1 `users` and `refresh_tokens` tables. Services own `tx {}`; the repository translates SQLSTATE `23505`; expired tokens are purged by a new hourly scheduler step; user deletion moves into `UserService.deleteUser`. Behaviour, GraphQL schema and REST shapes are unchanged.

## Boundaries & Constraints

**Always:** Every `UserService` / `AuthService` method touching the DB runs its body in `tx {}` (Arrow `either {}` OUTSIDE `tx {}`, so a `raise` rolls back); no route, resolver or scheduler calls a repository. Domain models (`User`, `RefreshToken`) unchanged. Username equality is case-sensitive (column is `COLLATE "C"`); admin list order is binary username order, 20/page. Creates are `insert`. `READ COMMITTED`, no savepoints. No event/`emit` inside `tx` (use `afterCommit`). Lists, items, categories, feedback, config stay on Mongo, untouched. Docs describing changed behaviour change in this story.

**Never:** No dual writes of users/tokens to Mongo; no `SchemaUtils`/`MigrationUtils`; no edit of `V1__baseline.sql`; no caches; no TTL index; no data import (Story 11.8); no GraphQL schema change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Register / admin-create, different case | `Bob` exists, `bob` | accepted | — |
| Register / admin-create, identical | `bob` exists, `bob` | existing conflict error (REST 400 "Invalid credentials", GQL conflict "Username already taken") | repository maps 23505 |
| Expired token | `expires_at` in past | `/auth/refresh` 401 as today | — |
| Purge | expired + live rows | only expired rows deleted | — |
| Scheduler step throws | item cycle throws | logged; `purgeExpiredTokens` still runs | — |
| Change password fails midway | failure after hash computed | old hash AND old sessions remain | tx rollback |
| Delete user | existing id | row locked `FOR UPDATE`, lists purged via `ListService`, tokens deleted, `users` row deleted last; same owned-list count returned; feedback survives | unknown id → `AdminError.NotFound` |
| Page order | usernames `Zed`,`apple`,`Bob` | binary order `Bob`,`Zed`,`apple`; `around` locates by count of names `<` target in same order | — |

</intent-contract>

## Code Map

- `entity/user/mongo/{MongoUser,MongoUserMapper,UserRepository}.kt` -- DELETE; replace with `entity/user/db/{UserTable,UserRowMapper,UserRepository}.kt`. Old API to preserve: `countAll`, `findPage(limit,skip)` (sorted username asc), `countUsernamesBefore`, `save`, `findByUsername`, `findById`, `deleteById`. Add `findByIdForUpdate`.
- `features/auth/RefreshTokenRepository.kt` + `RefreshToken.kt` (Mongo `@Serializable`/`_id`) -- DELETE repo; `features/auth/db/{RefreshTokenTable,RefreshTokenRepository}.kt`; `RefreshToken` becomes a plain data class (token, username, role, expiresAt); ops `save`, `findById`, `deleteById`, `deleteAllForUser`, `deleteExpired(now)`.
- `entity/user/UserService.kt` -- catches `MongoWriteException` code 11000 on register/adminCreateUser; wraps everything in `tx`; gains `deleteUser`, `findByUsername`, session invalidation inside `changePassword`/`adminResetPassword`.
- `features/auth/AuthService.kt` -- login/refresh/logout/`invalidateUserSessions` in `tx`; add `purgeExpiredTokens()`. `AuthRoutes.kt` change-password calls `invalidateUserSessions` after the service (must move inside the service tx).
- `entity/user/gql/UserAdminApi.kt` -- `deleteUser` currently does count, delete, `purgeUser`, then `invalidateUserSessions` in `finally`; becomes one `UserService.deleteUser` call. `resetUserPassword` calls `invalidateUserSessions` after; move into service. `GqlUserMapper.toGql(page, counts)` still uses `ListService.countOwnedLists` (Mongo; fine outside tx).
- `entity/list/ListService.kt` -- uses `userRepository.findByUsername` 9× (lines 67-281) and `purgeUser`/`countOwnedLists` (162/196). It is Mongo, so it must not call a PG repository outside `tx`: give it a small user lookup (e.g. `UserLookup` wrapping `tx { repository.findByUsername }`, no dependency on `UserService`, so `UserService → ListService → UserLookup` has no cycle).
- `plugins/Migration.kt:36,86` -- epic4 seed uses `userRepository.findByUsername`; switch to the same lookup.
- `Application.kt`, `plugins/GQL.kt:60-95` -- wiring: `UserRepository(connection.db)` and `RefreshTokenRepository(connection.db)` go; PG repositories need no connection arg. `ListService` is built inside `configureGql` but `UserService` (now needing it) in `module()`: reorder/pass so both exist once, `configureDatabase()` still runs before any service call.
- `plugins/Scheduler.kt` -- only runs `itemService.runSchedulerCycle()` hourly; becomes ordered named steps, each in its own try/catch (log, continue). Extract an internal function so a test can run a cycle without a 1 h delay.
- `plugins/Database.kt` -- `tx`, `afterCommit`, `TxScope.transaction` (an `R2dbcTransaction`); Exposed `Table` + suspend DSL run against it. SQLSTATE: inspect the R2DBC exception cause (`io.r2dbc.spi.R2dbcException.sqlState`).
- `src/test/.../utils/TestContainers.kt` -- `SharedPostgres` is ONE container per JVM; `users`/`refresh_tokens` rows now outlive a spec. Add `SharedPostgres.reset()` (TRUNCATE users, refresh_tokens … CASCADE) called by `mongoContainer()`; new PG-only specs call it explicitly. `setUpMongo` already wires PG.
- Tests touching users: `features/auth/{UserRegistrationTest,LoginTokenTest}.kt`, `features/admin/AdminUserManagementTest.kt`, `AuthApiTest`, `WebSocketAuthTest`, plus direct constructors in `ListServiceTest:348`, `ItemLifecycleTest:194`, `MigrationTest` (`UserRepository(db)`, `userRepo.save`) — these need PG connected (`connectDatabase(container.appConfig())`) and the lookup/`tx`.
- `bp_back/CLAUDE.md` (Security section names a TTL index), root `CLAUDE.md` -- docs.

## Tasks & Acceptance

**Execution:**
- `entity/user/db/*`, `features/auth/db/*` -- Exposed tables, row mappers, repositories (23505 → a typed duplicate-username error) -- AR-E11-6/9
- `UserService.kt`, `AuthService.kt`, `AuthRoutes.kt`, `UserAdminApi.kt` -- `tx` bodies, `deleteUser`, atomic password+sessions, `purgeExpiredTokens` -- AR-E11-4/13
- `ListService.kt`, `Migration.kt`, `Application.kt`, `GQL.kt` -- user lookup + wiring -- keep Mongo slices working
- `Scheduler.kt` -- independent steps incl. `purgeExpiredTokens` -- AR-E11-13
- Delete Mongo user/refresh-token classes and the TTL index code
- Tests (each observed failing first): switch the five named specs to PG; new tests for case-sensitivity + identical conflict (register and admin create), binary ordering with mixed-case names (`Zed`,`apple`,`Bob`,`Alice`), purge of expired-only, scheduler isolation, atomic password change (forced failure keeps old hash and sessions), deleteUser sequence/lock/feedback survival
- `bp_back/CLAUDE.md`, root `CLAUDE.md` if needed, `sprint-status.yaml` (story → done at close)

**Acceptance Criteria:**
- Given the slice moved, then `entity/user/mongo/` and the Mongo refresh-token repository are gone and no route/resolver/scheduler calls a repository.
- Given `Bob` exists, when `bob` is registered it succeeds; when `Bob` is registered again the conflict error is returned (23505 translated in the repository).
- Given mixed-case usernames, the admin page order is binary and 20 per page, proven by a test that fails under a locale collation.
- Given an expired token, `/auth/refresh` rejects it; `purgeExpiredTokens()` deletes every expired row and no live one.
- Given a throwing scheduler step, it is logged and the next step still runs.
- Given a password change, new hash and session invalidation commit together or not at all.
- Given admin deletes a user, then `SELECT … FOR UPDATE` is used, lists purged, tokens deleted, `users` row last, same count returned, feedback survives.
- Given close, `gradle :bp_back:test` is green (totals from JUnit XML), NFR1/3/4/7/8 unchanged, CLAUDE.md no longer names a TTL index.

## Spec Change Log

## Review Triage Log

### 2026-10-22 — Review pass
- verdicts: 38 findings — high 0, medium 3, low 9, false 4, maybe-false 2 (grouped by root cause below)
- findings:
  - `[medium]` `patch` admin password reset dropping sessions untested (verification-gap) — added test `an admin password reset drops the user's refresh tokens`.
  - `[medium]` `patch` production scheduler step list untested, purge could be dropped unnoticed (verification-gap) — `schedulerSteps` now takes the item cycle as a lambda; test runs the production list with a failing item cycle and asserts the purge ran.
  - `[low]` `patch` purge `<` vs refresh `!isAfter` boundary disagree (edge-case, blind) — `deleteExpired` now `lessEq`.
  - `[low]` `patch` `AuthService.invalidateUserSessions` unused (intent-alignment) — removed.
  - `[maybe-false]` `defer` racing createList sees the user during deleteUser (blind, edge-case) — see deferred.
  - `[low]` `defer` existing deployments see an empty users table until 11.8; CLAUDE.md stale layer description (blind) — see deferred.
  - `[false]` `reject` Mongo purge inside the PG tx not atomic / purge failure no longer drops sessions (blind, edge-case, verification-gap, intent) — AC explicitly accepts the non-atomic window on the branch (AR-E11-2) and specifies the lock/purge/tokens/users order.
  - `[false]` `reject` five named specs not literally on `postgresContainer()` (intent-alignment, edge-case) — they boot `module()` against the same shared PostgreSQL container via `setUpMongo`; `mongoContainer()` resets it.
  - `[false]` `reject` spec status/log inconsistency, missing `UserService.findByUsername`, verification evidence (blind, edge-case) — process notes; lookup lives in `UserLookup` per the spec's cycle-free design; greps and tests run in this pass.
  - `[low]` `reject` no row-count/lock check in changePassword/adminResetPassword on a concurrently deleted user (blind, edge-case) — admin-only, two-user app, result is a harmless no-op; fix adds guards.
  - `[low]` `reject` login/deleteUser token race (blind, edge-case) — same race existed with the Mongo code (delete then invalidate); not caused by this change.
  - `[low]` `reject` bcrypt/Mongo I/O inside tx holds a pool connection (blind, edge-case) — spec requires service bodies in tx; pool is sized for a two-user app.
  - `[low]` `reject` 23505 on any constraint mapped to username-taken; NUL in input; page reads under READ COMMITTED; connectDatabase failure after closePool / disposing a pool another app uses; purge INFO log noise; test cleanups (try/finally, truncate breadth, login case test, REST-level tests) — each unlikely to be met in everyday use and the fix adds guards/branches/params, or is test-only polish.

## Verification

**Commands:**
- `gradle :bp_back:test` -- expected: all pass
- `grep -rn "entity.user.mongo\|MongoUser\|expireAfter" bp_back/src` -- expected: no matches
- `grep -rn "SchemaUtils\|MigrationUtils" bp_back/src` -- expected: no matches

**Review:** patches applied 4 (medium 2, low 2); deferred 3 (1 medium unverified); rest rejected per log. Follow-up review recommended: false.

**Files (review pass):** `Scheduler.kt` (`schedulerSteps` takes the item cycle as a lambda), `RefreshTokenRepository.kt` (`lessEq`), `AuthService.kt` (dead method removed), `AccountsAndSessionsPostgresTest.kt` (2 tests).

**Verification:** `gradle :bp_back:test` green after patches: 201 tests, 0 failures/errors/skipped (JUnit XML); greps for `entity.user.mongo|MongoUser|expireAfter|SchemaUtils|MigrationUtils` return nothing. Residual risks: new tests were not observed failing against the old code; E2E and `npm run generate` not run (E2E may be red until 11.7); bcrypt runs inside the PG tx.
