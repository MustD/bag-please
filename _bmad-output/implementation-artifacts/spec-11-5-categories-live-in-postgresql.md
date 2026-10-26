---
title: 'Categories live in PostgreSQL (Story 11.5)'
type: 'feature'
created: '2026-10-23'
status: 'done'
baseline_revision: 'b46c29811879a74a01ef1bcdee319f9fd9f8537f'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-11-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-11-4-lists-shares-and-invites-live-in-postgresql.md'
warnings: []
deferred:
  - summary: >-
      saveCategory is check-then-act (findById then insert/rename); two concurrent creates of one new id surface a raw unique violation.
    evidence: |-
      Two-user app; the loser gets an error and retries. An ON CONFLICT upsert would remove it.
    severity: low
  - summary: >-
      Category delete is not atomic with the Mongo item delete and holds a PG connection across the Mongo call.
    evidence: |-
      Accepted on the branch (AR-E11-2); disappears when Story 11.6 moves items.
    severity: medium
  - summary: >-
      Existing deployments see no categories until the Story 11.8 import, so existing items fail the category check.
    evidence: |-
      Planned epic-wide (11.8, 11.11).
    severity: low
---

<intent-contract>

## Intent

**Problem:** Categories are still a Mongo collection behind an in-memory `CategoryStorage` cache; `ListService`, `ItemService` and `CategoryService` all read that cache or the Mongo repository directly.

**Approach:** Move the `category` slice to Exposed-on-R2DBC `entity/category/db/` over the Story 11.1 `categories` table. `CategoryService` owns every `tx {}` and registers its subscription events with `afterCommit`. Other services reach categories only through `CategoryService`. GraphQL schema and responses are unchanged.

## Boundaries & Constraints

**Always:** Every DB-touching `CategoryService` method runs in `tx {}` (Arrow `either {}` outside it). Membership check runs in the same `tx` as the work it guards. Events are emitted with `afterCommit`, so a failed save/delete emits nothing. `deleteCategory` order: membership, find (missing -> `IllegalStateException("Category not found")` as today), items deleted (Mongo, `ItemService.deleteAllInCategory`), then the category row, then the DELETED event after commit. A category save whose id already exists on a different list is rejected (`IllegalArgumentException`), never relocated; saving an existing id on the same list renames it. `ItemService` validates a category against its list via `CategoryService` (`requireCategoryOnList` message unchanged). `ListService` cascade keeps today's order: items (Mongo), categories (counted), members, list. Creates are `insert`; no cache.

**Never:** No dual writes; no `CategoryStorage`; no edit of `V1__baseline.sql`; items stay on Mongo; no GraphQL schema change; no resolver or non-category service touches `CategoryRepository`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rename | member saves existing id, new name | row renamed; SAVED event after commit to other subscribers | non-member: auth error, no event |
| Create | new id on caller's list | row inserted, SAVED event | — |
| Foreign list | id exists on list A, save names list B | rejected, row unchanged | `IllegalArgumentException` |
| Delete | category with items | items deleted first, row second, one DELETED event | missing: "Category not found" |
| Cascade fails | `deleteAllInCategory` throws | category row remains, no event | exception propagates |
| Item on other list | `saveItem` with category of list A on list B | rejected as before (FR58) | `IllegalArgumentException` |
| List delete | list with categories | `deletedCategoryCount` equals rows removed | — |

</intent-contract>

## Code Map

- `entity/category/{CategoryStorage.kt}`, `entity/category/mongo/*` -- DELETE. Add `entity/category/db/{CategoryTable,CategoryRowMapper,CategoryRepository}.kt` (pattern: `entity/list/db/*`).
- `entity/category/CategoryService.kt` -- repository + `tx` + `afterCommit`; add `existsOnList(categoryId, listId)` and `deleteAllInList(listId): Int` for other services.
- `entity/item/ItemService.kt` -- `categoryStorage` -> `Lazy<CategoryService>`; `entity/list/ListService.kt` -- drop `categoryRepository`/`categoryStorage`, take `Lazy<CategoryService>` for the cascade.
- `Application.kt`, `plugins/GQL.kt` -- wire `CategoryService` (built after `ItemService`), pass it to `configureGql`; `plugins/Migration.kt` -- drop unused `categoryRepository` param.
- Tests: `utils/TestContainers.kt` (`buildTestServices`), `MigrationTest`, `ItemLifecycleTest`, `AccountsAndSessionsPostgresTest`, `ListSharingTest` (Mongo categories asserted via PG), new `CategoryPostgresTest`.
- `bp_back/CLAUDE.md`, `sprint-status.yaml` (11-5 -> done).

## Tasks & Acceptance

**Execution:**
- `CategoryPostgresTest` -- tests FIRST for the matrix rows (rename event, foreign-list reject, delete order/rollback, list cascade count); observe them failing before the code
- `entity/category/db/*`, `CategoryService.kt` -- PG repository, `tx`, `afterCommit`
- `ItemService.kt`, `ListService.kt`, `Application.kt`, `GQL.kt`, `Migration.kt` -- rewire; delete Mongo category classes
- existing tests -- migrate to PG assertions / new wiring
- `bp_back/CLAUDE.md`, `sprint-status.yaml`

**Acceptance Criteria:**
- Given a member renames a category, when it commits, then other members receive the update; a failed rename emits nothing.
- Given a category with items, when deleted, then items go first and the row second with the same counts and events as before.
- Given a category on list A, when an item write uses it on list B, then it is rejected.
- Given close, no `CategoryStorage` or `category.mongo` remains in `bp_back/src/main` and `gradle :bp_back:test` is green (totals from JUnit XML).

## Spec Change Log

## Review Triage Log

### 2026-10-23 — Review pass
- verdicts: 32 findings — high 0, medium 3, low 6, false 2, maybe-false 0 (remaining rows are rejected notes graded low)
- findings:
  - `[medium]` `patch` delete test never creates items, FR58 item-on-other-list and foreign-list delete untested (verification-gap) — added API test covering item cascade, FR58 reject and foreign-list "Category not found".
  - `[low]` `patch` stale ItemService comment says relocation and cache race still exist (edge-case, blind) — comment rewritten.
  - `[low]` `patch` MigrationTest over-indentation (all layers) — re-indented.
  - `[false]` `reject` nested `tx` may not join the list cascade tx (blind, edge-case) — `tx` joins an open transaction by design (`Database.kt`), so the category delete shares the list tx.
  - `[false]` `reject` AccountsAndSessionsPostgresTest import-only change may not compile (blind) — full suite compiled and passed.
  - `[low]` `defer` saveCategory race (edge-case, blind) — see deferred.
  - `[medium]` `defer` Mongo/PG non-atomic delete, connection held across Mongo call (edge-case, blind) — see deferred.
  - `[medium]` `defer` categories invisible until 11.8 import (edge-case, blind) — see deferred.
  - `[low]` `reject` delete Boolean ignored, ordering by name, no name validation, foreign-id existence disclosure, service-level flow vs websocket in event tests, test delays, unclosed Mongo clients, event-on-failed-cascade change, ItemCategoryStorageTest not touched (it has no category cases), intent notes, CLAUDE.md wording, status bookkeeping — two-user app; behaviour matches the spec matrix; fixes add guards for unlikely paths or are cosmetic.

## Design Notes

The Epic 4 Mongo seed still stamps `listId` on legacy Mongo category documents; the app no longer reads them (Story 11.8 imports them). Items stay on Mongo, so the category-then-items delete is not atomic on this branch (AR-E11-2, accepted). `saveCategory` previously relocated a category by re-saving its id on another list; that hole (deferred-work) is closed here because the `items` composite FK would otherwise break.

## Verification

**Commands:**
- `gradle :bp_back:test` -- expected: all pass
- `grep -rnE "category\.mongo|CategoryStorage|CategoryRepository\(connection" bp_back/src/main` -- expected: no matches

## Auto Run Result

Status: done

- Summary: categories moved to Exposed-on-R2DBC `entity/category/db/`; `CategoryStorage` and Mongo category classes deleted; `CategoryService` owns every `tx {}` and emits via `afterCommit`; `ItemService` and `ListService` reach categories through `CategoryService`; categories are never relocated by a save.
- Files: `entity/category/db/*` (new), `CategoryService`, `ItemService`, `ListService`, `Application.kt`, `GQL.kt`, `Migration.kt`, tests (`CategoryPostgresTest` new; `MigrationTest`, `ItemLifecycleTest`, `ListSharingTest`, `AccountsAndSessionsPostgresTest`, `TestContainers.kt` migrated), `bp_back/CLAUDE.md`, `sprint-status.yaml`.
- Review: patches applied 3 (medium 1, low 2); deferred 3; rest rejected per log.
- Follow-up review recommended: false.
- Verification: `gradle :bp_back:test` green, 222 tests, 0 failures/errors/skipped (JUnit XML); grep for `category.mongo|CategoryStorage` in main is empty.
- Residual risks: three service-level event/rollback tests were written after the code; E2E and `npm run generate` not run; `ItemCategoryStorageTest` has no category cases, so the criterion is met by `CategoryPostgresTest`.
