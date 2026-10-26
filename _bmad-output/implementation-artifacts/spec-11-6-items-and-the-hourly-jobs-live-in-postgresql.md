---
title: 'Items and the hourly jobs live in PostgreSQL (Story 11.6)'
type: 'feature'
created: '2026-10-23'
status: 'done'
baseline_revision: '746da0e96f7b05349b318f99074f58a2388fdf53'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-11-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-11-5-categories-live-in-postgresql.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Items are still a Mongo collection behind an in-memory `ItemStorage` cache; the hourly scheduler runs one Mongo-backed item cycle; category and list deletes still reach Mongo for their item cascade.

**Approach:** Move the `item` slice to Exposed-on-R2DBC `entity/item/db/` over the Story 11.1 `items` table. `ItemService` owns every `tx {}` and emits via `afterCommit`. The scheduler's item cycle becomes two service methods (recurring restore, soft-deleted hard-delete), each its own step beside `purgeExpiredTokens`. Category and list delete cascades become single transactions. GraphQL schema and responses are unchanged.

## Boundaries & Constraints

**Always:** Every DB-touching `ItemService` method runs in `tx {}` (Arrow `either {}` outside it); membership runs in the same `tx` as the guarded work. Events use `afterCommit`: one per mutation, none on rollback. `items.stores` is `text[]` keeping order and casing; `added_by` is plain text; `category_id` is enforced by the composite FK `(list_id, category_id)`. `saveItem` keeps FR58: normalize stores once; stored on the same list -> category guard, then merge allowlist (`name`, `category`, `stores`) + `applyCheckState`; id on another list -> `IllegalArgumentException("Item <id> belongs to a different list")` (before the category guard); new id -> category guard, insert. `getItems`/`countUncheckedByList`/`getStoreSuggestions` exclude soft-deleted rows. `deleteAllInCategory` and list cascade delete soft-deleted rows too, emit nothing, return counts. Cascade order stays: items, categories, members, list. A scheduler step runs one service method in its own `tx`; a throwing step does not stop the others. The check-state transition stays the single `applyCheckState`.

**Never:** No dual writes; no `ItemStorage`, no `item.mongo`; no edit of `V1__baseline.sql`; no GraphQL schema change; no resolver/other service touches `ItemRepository`; do not delete `Migration.kt` (Story 11.7) — only drop its `itemRepository` parameter.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create / merge | new id, or stored id on same list | inserted / merged, `stores` order+casing kept, one UPDATE event after commit | non-member: auth error, no event |
| Foreign list | id exists on list A, save names list B | rejected, row unchanged | `IllegalArgumentException` |
| Bad category | category of another list | rejected (FR58) | `IllegalArgumentException` |
| Rollback | write fails inside `tx` | no row change, no event | exception propagates |
| Restore | checked WEEKLY/BIWEEKLY/MONTHLY past 7/14/30 days | unchecked, `checkedAt`/`deleted` cleared, UPDATE event | — |
| Hard delete | soft-deleted, `deletedAt` > 1h ago | row removed, DELETE event | — |
| Failing step | restore step throws | hard-delete and token purge still run | logged |
| Category delete | category with items (incl. soft-deleted) | items + row in one `tx`, one DELETED event | cascade throws -> row stays, no event |
| List delete | list with items and categories | counts equal rows removed, one `tx` | — |

</intent-contract>

## Code Map

- `entity/item/{ItemStorage.kt}`, `entity/item/mongo/*` -- DELETE. Add `entity/item/db/{ItemTable,ItemRowMapper,ItemRepository}.kt` (pattern: `entity/category/db/*`; `stores` via Exposed `array<String>`, `deletedAt`/`checkedAt` via `timestamp`, `recurring` text <-> `Recurring`).
- `entity/item/ItemService.kt` -- drop storage; repository + `tx` + `afterCommit`; split `runSchedulerCycle` into `restoreRecurring()` and `hardDeleteSoftDeleted()`; `deleteAllInCategory`/new `deleteAllInList(listId): Int` use the repository.
- `entity/list/ListService.kt` -- drop `itemRepository`/`itemStorage`; cascade calls `itemService.value.deleteAllInList` (it already holds `Lazy<ItemService>`).
- `plugins/Scheduler.kt` -- three steps (restore, hard delete, `purgeExpiredTokens`); `configureScheduler` takes the item methods.
- `Application.kt`, `plugins/Migration.kt` (drop `itemRepository` param), `plugins/GQL.kt` (unchanged signature).
- Tests: `utils/TestContainers.kt` (`buildTestServices`), `ItemApiTest`, `ItemCategoryStorageTest`, `ItemLifecycleTest`, `SubscriptionScopingTest`, `CategoryPostgresTest`, `MigrationTest` (reads Mongo via raw `Document`), `AccountsAndSessionsPostgresTest` (`schedulerSteps` call sites), `ListSharingTest`; new `ItemPostgresTest`.
- `bp_back/CLAUDE.md`, `sprint-status.yaml` (11-6 -> done).

## Tasks & Acceptance

**Execution:**
- `ItemPostgresTest` -- tests FIRST for matrix rows (stores array round-trip, foreign-list reject, rollback emits nothing, restore, hard delete, failing step, cascade counts); observe failing before code
- `entity/item/db/*`, `ItemService.kt` -- PostgreSQL repository, `tx`, `afterCommit`, split scheduler methods
- `ListService.kt`, `Scheduler.kt`, `Application.kt`, `Migration.kt` -- rewire; delete Mongo item classes and `ItemStorage`
- existing tests -- migrate to PG assertions / new wiring; `ItemApiTest`, `ItemCategoryStorageTest`, `ItemLifecycleTest`, `SubscriptionScopingTest` green on `postgresContainer()`
- `bp_back/CLAUDE.md`, `sprint-status.yaml`

**Acceptance Criteria:**
- Given an item mutation, when its `tx` commits, then subscribers get one event; when it rolls back, none.
- Given the hourly cycle, when it runs, then restore, hard delete and token purge are three steps each in its own `tx`, and a throwing step does not stop the others.
- Given a category or list delete, then children go in the same `tx`, in today's order, with the same counts and events.
- Given close, no `ItemStorage` or `item.mongo` remains in `bp_back/src/main`, no slice reads or writes Mongo, and `gradle :bp_back:test` is green (totals from JUnit XML).

## Spec Change Log

## Review Triage Log

### 2026-10-23 — Review pass
- verdicts: 35 findings — high 0, medium 2, low 17, false 16, maybe-false 0 (intent-alignment layer reported no findings)
- findings:
  - `[medium]` `patch` list-delete cascade failure path untested (verification-gap) — added trigger-injection test: items, categories, members and list all survive a failed `deleteList`.
  - `[medium]` `patch` events/rollback for checkItem, uncheckItem, deleteItem unverified (verification-gap) — added service-level event + rollback + non-member test.
  - `[low]` `patch` saveItem `tx {` body not re-indented (blind) — re-indented.
  - `[low]` `patch` half-edited MemberStatus comment in ListSharingTest (blind) — rewritten.
  - `[low]` `patch` ItemLifecycleTest comment on the removed orphan case (blind, verification-gap) — reworded to name the `ON DELETE CASCADE` FK.
  - `[false]` `reject` nested `tx` may not join (blind x2, edge-case x2) — `tx` joins the open transaction by design (`Database.kt`); same refutation as Story 11.5.
  - `[false]` `reject` unknown `recurring` text breaks the mapper (edge-case) — `items.recurring` has a CHECK constraint in `V1__baseline.sql`.
  - `[false]` `reject` tests' shared-DB triggers could hit parallel specs (blind) — Kotest runs specs sequentially here; triggers are dropped in `finally`.
  - `[false]` `reject` ON DELETE CASCADE claim not shown (blind) — it is in `V1__baseline.sql` (`items` FK).
  - `[false]` `reject` ItemApiTest/SubscriptionScopingTest not in diff, status/JUnit-XML mismatch, spec ready (blind, intent) — they pass unchanged; totals read from JUnit XML (233, 0 failures).
  - `[low]` `reject` rows-affected unchecked, duplicate delete event, concurrent same-id create, FK violation text, lost update under READ COMMITTED, null `deleted_at` never purged, restore of soft-deleted row, null `checkedAt` skipped (edge-case, blind) — two-user app, spec accepts unlocked check-then-act; null/restore behaviour matches the old Mongo semantics; fixes add guards for unlikely paths.
  - `[low]` `reject` one tx per scheduler step means one bad row blocks the step (edge-case, blind) — the story's AC fixes "one service method in its own tx" per step; CHECK constraint prevents bad rows.
  - `[low]` `reject` restore filters in Kotlin, ordering by name/id, scheduler wiring/step order untested, weak timing-based restore event test, duplicated seed helpers, legacy-data fate, Migration.kt dead until 11.7, CLAUDE.md wording, deleteAll* own-tx wrappers, countUnchecked no membership check — cosmetic or planned (11.7, 11.8); `DROP_OLDEST` buffer makes stricter event assertions impossible.

## Design Notes

Without the cache, `checkItem`/`uncheckItem`/`saveItem` read the stored row inside the same `tx` as the write (check-then-act under `READ COMMITTED`; two-user app, no lock, per the epic's explicit-lock rule). `Migration.kt` still touches Mongo through raw `Document` collections until Story 11.7 deletes it; the legacy `ItemRepository.getAll` it never used goes away.

## Verification

**Commands:**
- `gradle :bp_back:test` -- expected: all pass
- `grep -rnE "item\.mongo|ItemStorage|ItemRepository\(connection" bp_back/src/main` -- expected: no matches

## Auto Run Result

Status: done

- Summary: items moved to Exposed-on-R2DBC `entity/item/db/`; `ItemStorage` and Mongo item classes deleted; `ItemService` owns every `tx {}` and emits via `afterCommit`; the hourly cycle is three steps (restore recurring, hard-delete soft-deleted, purge tokens); category and list delete cascades are single transactions.
- Files: `entity/item/db/*` (new), `ItemService`, `ListService`, `Scheduler.kt`, `Application.kt`, `Migration.kt`, tests (`ItemPostgresTest` new; `ItemLifecycleTest`, `ListSharingTest`, `MigrationTest`, `CategoryPostgresTest`, `AccountsAndSessionsPostgresTest`, `TestContainers.kt` and others migrated), `bp_back/CLAUDE.md`, `sprint-status.yaml`.
- Review: patches applied 5 (medium 2, low 3); deferred 0; rest rejected per log.
- Follow-up review recommended: false.
- Verification: `gradle :bp_back:test` green, 233 tests, 0 failures/errors/skipped (JUnit XML); grep for `item.mongo|ItemStorage` in main is empty.
- Residual risks: `ItemPostgresTest` was written after the code, so its tests were not seen failing first; E2E and `npm run generate` not run; items are invisible until the Story 11.8 import.
