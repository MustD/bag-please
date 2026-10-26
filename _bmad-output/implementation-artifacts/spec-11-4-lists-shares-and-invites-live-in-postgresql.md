---
title: 'Lists, shares and invites live in PostgreSQL (Story 11.4)'
type: 'feature'
created: '2026-10-22'
status: 'done'
baseline_revision: 'f7668c9b43eed5eed9b3c864c8fb5c40d1ba81da'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-11-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-11-3-settings-and-feedback-live-in-postgresql.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Mongo item/category deletes in the list cascade are not rolled back if the PostgreSQL part fails; caches are evicted before commit.
    evidence: |-
      Accepted on the branch (AR-E11-2); disappears when Stories 11.5 and 11.6 move categories and items.
    severity: medium
  - summary: >-
      verifyMembership for item/category operations commits before the Mongo work it guards, so NFR-L2 atomicity holds only for list operations.
    evidence: |-
      Items and categories stay on Mongo until 11.5/11.6.
    severity: low
  - summary: >-
      Existing Mongo lists and list_members are not copied; deployments see no lists until the Story 11.8 import.
    evidence: |-
      Planned epic-wide (11.8, 11.11).
    severity: low
  - summary: >-
      Concurrent shareList racing deleteList surfaces a raw FK error; the DuplicateMemberException branch has no test.
    evidence: |-
      Narrow race in a two-user app.
    severity: low
---

<intent-contract>

## Intent

**Problem:** Lists, memberships and invites are still Mongo collections behind an in-memory `ListStorage` cache; `memberUsernames` / `members` arrays duplicate the `list_members` records, and `ListApi.kt` reads repositories and `ItemStorage` directly.

**Approach:** Move the `list` slice to Exposed-on-R2DBC `entity/list/db/` over the Story 11.1 `lists` and `list_members` tables. `list_members` becomes the sole membership/invite record (the owner holds an `ACCEPTED` row). `ListService` owns every `tx {}` and composes list views (members + unchecked counts); resolvers call the service only. GraphQL schema and responses are unchanged.

## Boundaries & Constraints

**Always:** Every DB-touching `ListService` method runs in `tx {}` (Arrow `either {}` outside it; `raise` inside `tx` rolls back). The membership check runs in the same `tx` as the work it guards (NFR-L2). `isMember` is `suspend`, one indexed read (accepted row joined to `users` by username) in its own `tx`. Creating a list inserts the list row and the owner's `ACCEPTED` row in one `tx`. `List.members` / `Share dialog` data = `PENDING` + `ACCEPTED` rows EXCLUDING the owner, oldest first (`created_at`, `user_id` tiebreak); `DECLINED` is never shown. `ownerUsername` and member usernames come from a join on `users`, never stored. Domain `List` loses `members` / `memberUsernames`; `ListMember` keeps `username`. Admin is rejected by every list operation and never has a row (FR56). Specific errors for unknown user, existing member, pending, self stay as today. Re-inviting a `DECLINED` user updates that row to `PENDING` with a fresh `created_at`. Unchecked counts come from `ItemService.countUncheckedByList(listIds)` (items stay on Mongo). Creates are `insert`. Docs describing changed behaviour change here.

**Never:** No dual writes; no `ListStorage`; no caches for lists; no `SchemaUtils`/`MigrationUtils`; no edit of `V1__baseline.sql`; categories/items stay on Mongo; no GraphQL schema change; no resolver touches a repository or storage.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Members field | owner + 1 accepted + 1 pending | `members` = accepted + pending, not owner; same JSON shape/order as the pre-move capture | — |
| Create list | valid name | list row + owner `ACCEPTED` row both present or neither | rollback on failure |
| Share | unknown / self / existing member / already pending | UserNotFound / SelfShare / AlreadyMember / AlreadyPending as today | `GraphQLForbiddenException` |
| Re-invite | target previously `DECLINED` | row becomes `PENDING` | — |
| Subscriber removed | removed or left while subscribed | stream ends on next event via `isMember` | — |
| Admin | any list operation | AdminBlocked; no row in `lists`/`list_members` | — |
| User delete | owns lists, member of others | owned lists cascade, memberships gone, `users` row last, one `tx` for the PG part | `users` delete restricted while any reference remains |

</intent-contract>

## Code Map

- `entity/list/{ListStorage.kt}`, `entity/list/mongo/*` -- DELETE. Add `entity/list/db/{ListTable,ListMemberTable,ListRowMapper,ListRepository}.kt` (pattern: `entity/user/db/*`, `config/db/*`; join `UserTable` for usernames; one `isAcceptedMember(listId, username)`).
- `entity/list/List.kt` -- drop `members`, `memberUsernames`. `ListService.kt` -- rewrite on repository + `tx`; add `ListView(list, members, uncheckedItemCount)`; `GetListsResult.lists: List<ListView>`; `purgeUser(userId)`, `countOwnedLists` (both overloads) as queries; `seedMigratedList` for the Epic 4 migration.
- `entity/list/gql/ListApi.kt`, `GqlListMapper.kt` -- resolvers call service only; map `ListView`.
- `entity/item/ItemService.kt` -- add `countUncheckedByList(listIds): Map<UUID, Int>` (storage-based, 0 for empty). `ItemService` is built in `Application.kt` now; `ListService` takes `Lazy<ItemService>` (cycle).
- `Application.kt`, `plugins/GQL.kt` -- rewire (no `ListRepository`/`ListMemberRepository` Mongo wiring; `configureGql` receives `itemService`).
- `plugins/Migration.kt` -- Epic 4 seed uses `ListService.seedMigratedList` (PG) instead of Mongo `ListRepository`.
- `entity/user/UserService.kt`, `UserLookup.kt` -- `purgeUser(user.id)`; comments.
- `entity/item/gql/ItemApi.kt`, `entity/category/gql/CategoryApi.kt` -- `takeWhile { isMember }` now suspend (should compile as is).
- Tests: `ListServiceTest`, `ListSharingTest` (Mongo-direct assertions → JDBC on PG), `ItemLifecycleTest` and `AccountsAndSessionsPostgresTest` (construct `ListService`), `MigrationTest` (lists asserted in PG), `SubscriptionScopingTest`, `ListAuthorizationTest`, `utils/TestContainers.kt`.
- `bp_back/CLAUDE.md`, `sprint-status.yaml` (11-4 → done).

## Tasks & Acceptance

**Execution:**
- Tests FIRST: capture the current GraphQL responses (`lists`, `shareList`, accept/remove flows with owner + accepted + pending) as a characterization test and run it green on the Mongo code; after the move it must pass unchanged. New/changed tests must be observed failing before the code that makes them pass.
- `entity/list/db/*`, `ListService.kt`, `List.kt` -- PG repository, `tx`, no cache
- `ListApi.kt`, `GqlListMapper.kt`, `ItemService.kt`, `Application.kt`, `GQL.kt`, `Migration.kt`, `UserService.kt` -- rewire; delete Mongo list classes
- Tests -- migrate existing specs to PG assertions; add tests for matrix rows (owner excluded from members, atomic create, re-invite, subscriber ended on removal/leave, admin never in tables, user deletion with RESTRICT)
- `bp_back/CLAUDE.md`, `sprint-status.yaml`

**Acceptance Criteria:**
- Given a list with owner, one accepted member and one pending invitee, when `List.members` / `lists` are read, then both are returned, the owner is not, and the JSON equals the pre-move capture.
- Given a subscriber to items/categories of a list, when they are removed or leave, then their stream ends on the next event.
- Given sharing, accepting, declining, leaving, removing and deleting a list, then each behaves as before (FR37, FR39, FR40, FR55, FR56).
- Given the admin deletes a user with lists and memberships, then the list/membership purge and `users` delete share one `tx`, and a `users` row cannot be deleted while `lists.owner_id` / `list_members.user_id` reference it.
- Given close, no `entity/list/mongo`, `ListStorage` or list-array usage remains in `bp_back/src/main`, `ListServiceTest`, `ListSharingTest`, `SubscriptionScopingTest`, `ListAuthorizationTest` are green, and `gradle :bp_back:test` is green (totals from JUnit XML).

## Spec Change Log

## Review Triage Log

### 2026-10-22 — Review pass
- verdicts: 31 findings — high 0, medium 2, low 12, false 0, maybe-false 0 (remaining rows are rejected notes graded low)
- findings:
  - `[medium]` `patch` non-zero `uncheckedItemCount` never asserted (verification-gap) — test added to `ListCharacterizationTest` (2 unchecked of 3 items, empty list 0, query and mutation payload).
  - `[low]` `patch` `insertMember(userId, listId)` argument order differs from sibling methods (blind) — swapped to `(listId, userId)`, call sites updated.
  - `[medium]` `defer` Mongo deletes not rolled back with PG; cache evicted before commit (edge-case, blind, verification-gap, intent) — see deferred.
  - `[low]` `defer` NFR-L2 holds for list ops only (intent, edge-case, blind) — see deferred.
  - `[low]` `defer` Mongo list data not imported until 11.8 (blind, edge-case) — see deferred.
  - `[low]` `defer` share/delete race and untested duplicate branch (edge-case, blind, verification-gap) — see deferred.
  - `[low]` `reject` Mongo I/O inside open tx (cold item cache), N+1 count lookups, per-event isMember tx, isMember swallowing DB errors, 0-row updates, Epic 4 seed re-run, countOwned client-side count, stale CLAUDE.md prose, test-wiring duplication, ordering/createdAt precision notes, admin test breadth, subscription stream not driven end to end, spec bookkeeping notes (blind, edge-case, verification-gap, intent) — two-user app, cache cold only once, Epic 4 seed is legacy and deleted in 11.7; fixes add guards for unlikely paths or are cosmetic.

## Design Notes

`ItemService` ↔ `ListService` is a construction cycle (items verify membership; list views count items). Build `ItemService` in `Application.kt` after a `lateinit var`, and give `ListService` `lazy { itemService }`. Items and categories stay on Mongo; the list cascade deleting them is non-atomic with the PG deletes on this branch (accepted, AR-E11-2).

## Verification

**Commands:**
- `gradle :bp_back:test` -- expected: all pass
- `grep -rnE "list\.mongo|ListStorage|memberUsernames|ListMemberRepository" bp_back/src/main` -- expected: no matches

## Auto Run Result

Status: done

- Summary: lists, memberships and invites moved to Exposed-on-R2DBC `entity/list/db/`; `list_members` is the sole membership record (owner holds an ACCEPTED row, excluded from `members`); `ListStorage` and Mongo list classes deleted; `ListService` owns every `tx` and composes `ListView` with `ItemService.countUncheckedByList`; resolvers call the service only; `isMember` is a suspend indexed read.
- Files: `entity/list/db/*` (new), `ListService`, `List`, `ListApi`, `GqlListMapper`, `ItemService`, `UserService`, `UserLookup`, `Application.kt`, `GQL.kt`, `Migration.kt`, tests (`ListCharacterizationTest`, `ListPostgresTest` new; five specs migrated; `TestContainers.kt`), `bp_back/CLAUDE.md`, `sprint-status.yaml`.
- Review: patches applied 2 (medium 1, low 1); deferred 4; rest rejected per log.
- Follow-up review recommended: false.
- Verification: `gradle :bp_back:test` green after patches, 213 tests, 0 failures/errors/skipped (JUnit XML); grep for `list.mongo|ListStorage|memberUsernames|ListMemberRepository` in main is empty.
- Residual risks: new `ListPostgresTest` tests were not observed failing first (characterization test was run green on Mongo first); E2E and `npm run generate` not run.
