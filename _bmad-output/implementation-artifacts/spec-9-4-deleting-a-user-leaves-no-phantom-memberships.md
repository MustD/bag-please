---
title: 'Story 9.4: Deleting a user leaves no phantom memberships'
type: 'bugfix'
created: '2026-09-18'
status: 'done'
baseline_commit: '220c9fbfc7884d85a3dcc18268065b747983201d'
route: 'dispatch'
review_loop_iteration: 0
warnings: [ oversized ]
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `UserService.adminDeleteUser` deletes the user row and nothing else — it holds no
`ListMemberRepository` at all. Every `list_members` row the user held survives with a live `listId`, the user stays in
other lists' `members` / `memberUsernames` (a phantom member row in the Share dialog that `removeMember` can never
clear, because it resolves the username to a user that is gone), and every list they owned becomes ownerless but still
visible to its members. The admin is also never told how much data the delete destroys.

**Approach:** `UserAdminMutations.deleteUser` orchestrates a fixed three-step sequence (AR-E9-8): `adminDeleteUser`,
then a new idempotent `ListService.purgeUser(userId, username)`, then `authService.invalidateUserSessions`. `purgeUser`
deletes every `list_members` row for the user in any status, strips them from lists they do not own, and deletes lists
they own through a private `cascadeDeleteList(list)` that `deleteList` also calls. `User.ownedListCount` is added so
`DeleteUserDialog` can state how many lists the confirm will destroy.

## Boundaries & Constraints

**Always:**

- Only `ListService` writes `list_members`, `List.members` or `List.memberUsernames` (AR-E9-8). `purgeUser` writes
  through `ListStorage.save` / the private cascade and `ListMemberRepository` only — never `ListRepository` directly,
  or the in-memory list cache diverges.
- Order is load-bearing: the user row is gone before the purge runs, so a `createList` or `acceptInvite` racing the
  purge on a still-valid access token fails with `CallerNotFound` instead of re-creating membership. `createList`
  currently throws `IllegalStateException("User not found: …")` on that branch — it raises `ListAuthError.CallerNotFound`
  after this story, like `renameList` already does.
- `purgeUser` is idempotent and caller-less: it takes no `CallerUsername`, skips the `adminLogin` / ownership gates, and
  running it twice changes nothing and raises nothing. It is the single documented exception to NFR-L2.
- The purge emits no subscription event. A member viewing a deleted owner's list is redirected by the existing
  Story 5.6 `FORBIDDEN` guard (`ListShoppingPage.tsx:390-393`) on their next data access.
- `DeleteUserDialog` keeps its bespoke shape and its existing testids (`delete-user-dialog` / `-error` / `-cancel` /
  `-confirm`); only the confirmation copy grows a cascade sentence.
- Every new Kotest case is written and observed failing before the fix; the new E2E case is observed red on both
  viewport projects.

**Never:**

- No migration, backfill or cleanup script for `list_members` rows already stranded in production — the Story 7.6
  standing assumption (`deferred-work.md:199-216`) stays as written, narrowed to "already-stranded rows only".
- No ownership transfer: lists owned by the deleted user are destroyed, not reassigned (md, 2026-09-15).
- Do not migrate `DeleteUserDialog` onto `ConfirmDialog`, and do not unify `ListDetailPage`'s inline error with
  `ListShoppingPage`'s redirect. Both are deliberate and out of scope.
- No new GraphQL exception type, no new `ListAuthError` variant beyond reusing `CallerNotFound`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Confirm copy | U owns 2 lists | Dialog reads `…This also deletes the 2 lists they own, with their items and categories.` | N/A |
| Confirm copy, no owned lists | U owns 0 lists | Cascade sentence omitted; existing copy unchanged | N/A |
| Full purge | U owns 2 lists, ACCEPTED on V's list L, PENDING on M, DECLINED on N | User gone; 0 `list_members` rows for U in any status; U absent from L's `members` and `memberUsernames`; both owned lists gone with their items, categories and member rows; U's refresh tokens gone | N/A |
| Re-run | `purgeUser` called again for the same id/username | No writes, no error, same result | N/A |
| Race after step 1 | U's access token still valid, `createList` between steps | `GraphQLForbiddenException("Authenticated user record not found")` | `ListAuthError.CallerNotFound` |
| Other members untouched | V owns L with W as ACCEPTED member | L, its items, categories and W's row survive; only U's row is removed | N/A |
| Non-admin caller | Regular user calls `deleteUser` | `FORBIDDEN`, nothing deleted | `requireAdmin()` first statement, unchanged |
| Deleted-owner viewer | V sits on `/list/:id` of a list U owned | V's next `getItems`/`getCategories` raises `FORBIDDEN` → `<Navigate to="/lists">` | existing `isForbiddenError` guard |

</frozen-after-approval>

## Code Map

**Backend** (`bp_back/src/main/kotlin/com/bagplease/`)

- `entity/list/ListService.kt:110-136` -- `deleteList`: gates at `:111` (`adminBlocked`) / `:113-114` (owner), then the
  inline cascade `:122-130` (items → categories → `list_members` → list, then the three cache evictions) and the
  `DeleteListResult` at `:132-135`. **Extract `:122-135` verbatim into `private suspend fun cascadeDeleteList(list: List): DeleteListResult`**;
  keep the `:116-121` comment (it explains why the ordering is a convention, not a safety property) with the extracted
  body. `:190-205` `removeMember` is the exact member-strip pattern to copy (`list.copy(members = …filter, memberUsernames = …filter)` then `listStorage.save`).
  `:60-79` `createList` — `:64-65` is the `IllegalStateException` to replace with `raise(ListAuthError.CallerNotFound)`
  (needs `either {}` context, which `createList` already has). `:17-29` `ListAuthError`; `CallerNotFound` at `:28`.
  Add `purgeUser` and `countOwnedLists` here.
- `entity/list/ListStorage.kt:9-14` -- full in-memory cache of every list (`storage`, synced at startup), so owned/member
  lookups need no new Mongo query: `getAll() :32`, `save :25`, `delete :51`, `evictFromCache :65`,
  `getByMemberUsername :58`.
- `entity/list/mongo/ListMemberRepository.kt:71-74` -- `deleteAllInList` is the template for a new
  `deleteAllForUser(userId): Int` (`Filters.eq("userId", userId.toString())`, no status clause — the `userId` index
  already exists at `:25`). `:59-64` `findPendingByUserId` is the template for `findAllByUserId` if one is needed;
  rows are keyed `_id = "${listId}_${userId}"` (`:33`).
- `entity/user/gql/UserAdminApi.kt:59-73` -- `deleteUser`: `requireAdmin()` stays the first statement `:60`; the
  `ifRight` branch `:69` already calls `invalidateUserSessions` — insert `listService.purgeUser(...)` **before** it.
  `:35-42` `users` is the paged query that must carry the count; `:17-22` `requireAdmin` helper.
- `entity/user/gql/GqlUser.kt:5-10` -- add `ownedListCount: Int`. `entity/user/gql/GqlUserMapper.kt:8-13` --
  `toGql(user)` gains a required count parameter so no call site can silently report a fake 0;
  `:15-19` `toGql(page)` maps a page and needs a per-user count map.
- `entity/user/UserService.kt:130-134` `adminDeleteUser` (unchanged), `:93-114` `getUserPage` (unchanged — the count is
  joined at the GQL boundary, the domain `User` stays list-agnostic). `entity/user/UserPage.kt` -- `users`/`totalCount`/`offset`.
- `plugins/GQL.kt:76-86` -- `listService` is constructed before `UserAdminQueries(userService) :106` and
  `UserAdminMutations(userService, authService) :114`; pass `listService` into both. No reordering needed.
- `features/auth/AuthService.kt:53-55` -- `invalidateUserSessions` deletes refresh tokens only; access tokens stay valid
  until expiry, which is why step order matters.
- Tests: `src/test/kotlin/com/bagplease/features/admin/AdminUserManagementTest.kt` -- helpers `loginAdmin :32`,
  `loginRegularUser :40`, `usersPage :73`, `seedUsers :102`, `uniquePrefix :116`; existing delete cases at `:422`
  (`AC3`) and `:529` (`AC6`). `src/test/kotlin/com/bagplease/ListSharingTest.kt:656-690` -- **the model for this
  story's assertions**: raw `connectToDb().getCollection<Document>("list_members")` counts (status-filtered helpers
  cannot see `DECLINED`), with a second untouched list as the non-vacuity guard; helpers `registerManyAndLogin :58`,
  `createList :70`, `shareList :81`, `acceptInvite :90`, `rejectInvite :99`, `deleteList :108`, `connectToDb :121`.
  Auth rate limit is 5 logins/min — keep new tests at three users plus admin.
  `ListServiceTest.kt:163` is the `deleteList` cascade test that must stay green after the extraction.

**Frontend** (`bp_front/src/`)

- `lib/admin/adminQueries.ts:28-40` -- `AdminUsersQuery`, selection `users { users { id username role } totalCount offset }`;
  add `ownedListCount`. `:9` derives `AdminUser` from that result type, so the dialog's prop type follows automatically.
  `DeleteUserMutation` selects the mutation payload — add the field there too or the required-argument mapper has no
  observable effect.
- `src/__generated__/**` -- regenerate with `npm run generate` against a **running rebuilt backend** on `:2080`
  (`codegen.ts` introspects the live schema with `CODEGEN_TOKEN`). Never hand-edited.
- `components/DeleteUserDialog.tsx:75-78` -- the `DialogContentText` to extend; `shown` (`:39-47`) is the retained row
  that renders during the close transition, so read the count from `shown`, not `user`. Testids `:72,:80,:86,:94`.
- `routes/AdminPage.tsx:163` `deleteTarget`, `:126-137` `handleDeleted` (cache evict + refetch) -- unchanged.
- `routes/ListShoppingPage.tsx:390-393` -- the `isForbiddenError` → `<Navigate to="/lists" replace/>` guard the E2E
  asserts against. Nothing to change.

**E2E & docs**

- `bp_front/e2e/sharing.spec.ts:130-171` -- **the template** for the new case: second `browser.newContext`, UI-driven
  share + accept, `inviteePage.goto('/list/:id')` then `expect(inviteePage).toHaveURL(/\/lists$/)`, `ctx.close()` in
  `finally`. Local `openShareDialog` / `shareWith` helpers live in that file; there are **no** `shareList`/`acceptInvite`
  helpers in `e2e/support/`.
- `bp_front/e2e/admin.spec.ts:132-143` -- the existing delete-flow case and `createUserViaUi`; `support/ui.ts`
  `loginAsAdmin :70`, `registerViaUi :35`, `uniqueUsername :29`, `createListAndOpen :94`. `support/api.ts` helpers are
  setup/teardown only (AR-E7-5) — never assert through them.
- `bp_front/playwright.config.ts:271-279` -- the counts ledger; latest row `2026-09-17 (Story 9.3 REVIEW): 240 = 118 / 118 / 2 / 2`,
  23 skips. Measure, never quote.
- `_bmad-output/implementation-artifacts/deferred-work.md:73-74` (index bullet) and `:368-377` (the 7.6-review entry) --
  **close in place** with the `✅ CLOSED by Story 9.4 (2026-09-18): … Was: …` idiom used at `:69-72`. Also amend
  `:199-216` so the standing assumption no longer says the user-deletion leak is open.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md:645-647` (`delete-user-confirm` anchor) and
  §5.4 `/admin` (`:401-414`) -- record the new confirm copy and the `ownedListCount` source.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:118` -- `9-4-…: backlog` → reconcile at story close.

## Tasks & Acceptance

**Execution:**

- [x] `bp_back/src/test/kotlin/com/bagplease/ListSharingTest.kt` -- **written FIRST, run red.** Add the purge cascade
  case following `:656-690`: U owns two lists (each with an item and a category) and holds ACCEPTED / PENDING /
  DECLINED rows across V's lists; after `deleteUser`, assert on the raw `list_members` collection that U has zero rows
  in any status, that V's own list and W's row survive, that U is gone from V's list `members`/`memberUsernames`
  (through the API), and that both owned lists and their items/categories are gone. Add an idempotence case (a second
  `purgeUser`-equivalent delete of the same id returns `NOT_FOUND` and changes nothing) and an ordering case asserting
  `createList` on U's still-valid token after deletion fails with `Authenticated user record not found`. Record the red run.
- [x] `bp_back/src/main/kotlin/com/bagplease/entity/list/mongo/ListMemberRepository.kt` -- add
  `deleteAllForUser(userId): Int` (any status) mirroring `deleteAllInList`.
- [x] `bp_back/src/main/kotlin/com/bagplease/entity/list/ListService.kt` -- extract `private cascadeDeleteList(list)`
  from `deleteList`; add `suspend fun purgeUser(userId: UUID, username: String)` (owned lists → cascade; other lists →
  strip both member arrays via `listStorage.save`; then `listMemberRepository.deleteAllForUser`) and
  `suspend fun countOwnedLists(userIds)`/`countOwnedLists(userId)` off the `ListStorage` cache; make `createList` raise
  `CallerNotFound`.
- [x] `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/GqlUser.kt` + `GqlUserMapper.kt` -- add
  `ownedListCount: Int!` and thread it through both mappers as a required parameter.
- [x] `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/UserAdminApi.kt` -- inject `listService`; join counts onto
  the `users` page; in `deleteUser` read the owned count before deleting, then run `adminDeleteUser` → `purgeUser` →
  `invalidateUserSessions` in that order.
- [x] `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt` -- pass `listService` into `UserAdminQueries` and
  `UserAdminMutations`.
- [x] `bp_front/src/lib/admin/adminQueries.ts` + `npm run generate` -- select `ownedListCount` in `AdminUsersQuery` and
  `DeleteUserMutation`; regenerate against the rebuilt backend.
- [x] `bp_front/src/components/DeleteUserDialog.tsx` -- append the cascade sentence when `shown.ownedListCount > 0`,
  with singular/plural wording; testids and flow unchanged.
- [x] `bp_front/e2e/sharing.spec.ts` (or `admin.spec.ts`) -- **observed red on both viewport projects.** One case: U
  registers and creates a list, shares it with V who accepts; admin deletes U from `/admin` and the dialog states the
  owned-list count; V's next `/list/:id` load redirects to `/lists` and the list is gone from V's index. Record the red run.
- [x] `bp_front/playwright.config.ts` -- append a dated ledger row in the `:271-279` format with measured counts.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- close the 7.6-review entry in place and narrow the
  standing assumption. `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` -- record the new copy and
  count source. `sprint-status.yaml:118` -- reconcile at close.

**Acceptance Criteria:**

- Given `deleteList` and `purgeUser`, when either removes a list, then both go through the one private
  `cascadeDeleteList`, and `ListServiceTest.kt:163` plus `ListSharingTest.kt:656` stay green unchanged.
- Given a non-admin caller, when `deleteUser` is called, then it fails `FORBIDDEN` and nothing is purged.
- Given the Story 7.6 review entry, when this story closes, then it is marked closed in place and the standing
  assumption reads as "already-stranded rows only".

## Design Notes

**Why the orchestration sits in `UserAdminMutations`, not `UserService`.** `UserService` is constructed outside
`configureGql` and `ListService` already depends on `UserRepository`; injecting `ListService` into `UserService` would
invert that and force a construction reorder. The resolver already owns the post-delete side effect
(`invalidateUserSessions`), so the whole ordered sequence lives in one visible place, and AR-E9-8 names it explicitly.

**Why the count is joined at the GQL boundary.** The domain `User` has no list knowledge, and `ListStorage` already
holds every list in memory — so counting owned lists for a 20-row page is a cache scan, not 20 Mongo round-trips, and
`UserService.getUserPage` stays list-agnostic. Making the mapper's count parameter required is deliberate: a default
of `0` would let a future call site report "no lists will be deleted" about a user who owns five.

## Verification

**Commands:**

- `./gradlew :bp_back:cleanTest :bp_back:test` -- expected: BUILD SUCCESSFUL, 0 failures.
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0 (`tsc -b` also type-checks `e2e/`).
- `docker compose up --build -d` then `curl -o /dev/null -w '%{http_code}' http://localhost:2080/api/health` --
  expected: `200` before any E2E run and before `npm run generate`.
- `cd bp_front && npm run test:e2e` -- expected: green on all four projects.
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` -- expected: measured before
  and after; the delta is `added untagged tests × 2`, recorded in the ledger row.

**Manual checks (if no CLI):**

- The red runs of the new Kotest cases and of the new E2E case are recorded in Implementation Notes, the E2E one
  observed on both viewport projects.

## Implementation Notes

**Red runs, recorded.**

- *Kotest.* The three new `ListSharingTest` cases (`AC-9.4-purge`, `AC-9.4-idempotent`, `AC-9.4-order`) were written
  first and run against the unchanged backend: `21 tests: 18 passed, 3 failed` — all three red, the first two on the
  unknown `ownedListCount` field and the third on the missing `Authenticated user record not found`. After the fix,
  the purge cases were re-verified red FOR THE RIGHT REASON by disabling only `listService.purgeUser(...)` in
  `UserAdminMutations.deleteUser`: `AC-9.4-purge` failed at `countDocuments(userId = U)` `expected 0L but was 3L`
  (the ACCEPTED + PENDING + DECLINED rows it strands) and `AC-9.4-idempotent` at `expected 0L but was 1L`. Green
  after restoring: `21 tests: 21 passed`.
- *E2E.* The new `@serial-users` case in `admin.spec.ts` was observed RED on BOTH chained viewport projects
  (`registration-toggle-chromium` = Desktop Chrome, `registration-toggle-mobile` = Pixel 7 at the 320px floor) against
  a production image built with `purgeUser` disabled: `expect(page).toHaveURL(/\/lists$/)` received
  `http://localhost:2080/list/<uuid>` — the member kept access to the deleted owner's list. An earlier red run of the
  same case, with the cascade sentence also reverted, failed first at
  `toContainText('This also deletes the 1 list they own, with their items and categories.')`. Green on both after the
  fix (3 passed per project, run ONE project at a time).

**Decisions and deviations.**

- *The E2E case is tagged `@serial-users`, not untagged.* The delete confirmation's count has to be read off a row the
  admin panel is actually showing, and `around` — the panel's only row-locating mechanism — is set by a create. Under
  `fullyParallel: true` the suite creates ~4 users/second, so no row's page survives the three-actor flow. The case
  therefore pads the users table to a page boundary exactly as the existing last-page case does and runs in the chained
  projects, which is where this suite already puts tests that need a stable users table. Consequence for the ledger:
  the delta landed in the chained columns (2/2 → 3/3), not the viewport ones.
- *`openShareDialog` / `shareWith` moved from `sharing.spec.ts` to `e2e/support/ui.ts`.* Two specs drive them now, and
  a second copy in a spec is the duplication NFR-E8-5 forbids. `sharing.spec.ts` imports them unchanged.
- *The E2E case asserts the sign-in landed before reloading.* `loginViaUi` only SUBMITS the form; without
  `expect(page).not.toHaveURL(/\/auth$/)` the member's `goto('/lists')` raced the in-flight sign-in and found `/auth`.
  Measured, not theorised — it is what made the first assembled version hang.
- *The E2E case sweeps its own two rows in `finally`.* They carry a `zzzzz_` prefix so they sort past the `zzzz` tail
  the last-page case arranges; leaving them behind pushed that case's "alone on a fresh last page" row into a full page
  and failed it on the SECOND chained project (measured: expected 1 row, received 20). The per-run global sweep is too
  late for a sibling in the same file.
- *`GqlList.members` still omits the owner*, because it is built from `list_members` rows and an owner never has one.
  The backend test asserts the stripped `memberUsernames`/`members` arrays on the raw `lists` document and the API
  `members` list separately, for that reason.
- *No `ListServiceTest` change was needed*: `AC10 deleteList cascade` and `AC-7.6-cascade` both stayed green across the
  `cascadeDeleteList` extraction, which is the acceptance criterion for it.

**Verification.**

- `mise run back:test` (the repo has no `gradlew`; the task wraps `gradle :bp_back:test` and removes the results
  directory first, so it is the `cleanTest` equivalent): `140 tests: 140 passed`. One earlier full run had a single
  `MongoTimeoutException` in `AdminUserManagementTest` — a Testcontainers connection flake; that class re-ran
  `16 tests: 16 passed`.
- `cd bp_front && npm run lint && npm run build` — exit 0.
- `docker compose up --build -d` + `curl -o /dev/null -w '%{http_code}' http://localhost:2080/api/health` → `200`
  before both codegen and every E2E run.
- `npm run test:e2e` — 219 passed, 23 skipped, 0 failed across all four projects.
- `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` → `242 = 118 / 118 / 3 / 3`
  (was 240 = 118 / 118 / 2 / 2).

**Matrix audit (build step 3, after the implementation returned).** Three matrix rows had no covering test and were
closed with test-only changes:

- *Non-admin caller.* `AdminUserManagementTest` had `AC5` cases for `users` and `createUser` but none for `deleteUser`.
  Added `AC5 non-admin JWT on deleteUser mutation returns FORBIDDEN and deletes nothing`, which also asserts the victim
  row survives — the "nothing deleted" half the matrix names. Backend suite: `141 tests: 141 passed`.
- *Confirm copy, no owned lists.* The existing `FR15/FR17` delete-flow case opened the dialog but asserted nothing about
  its text; it now asserts the cascade sentence is ABSENT for a user who owns nothing.
- *Confirm copy, U owns 2 lists.* The new `@serial-users` case covered ONE owned list, so the matrix's plural row and
  the `=== 1 ? 'list' : 'lists'` branch were both unasserted. The owner now creates two lists, the assertion is the
  matrix's exact plural string, and the second list's destruction is asserted through the member's redirect. Suite
  re-run after the change: `219 passed, 23 skipped, 0 failed`; test total unchanged at 242 (assertions added, no new
  case), so the ledger row above still measures true.

## Spec Change Log

## Review Triage Log

**Round 1 (2026-09-18) — 8 findings, all fixed.**

- `ListService.purgeUser` saved member-array strips built from a snapshot taken before the owned-list cascades' Mongo
  I/O → each shared list is now re-read with `listStorage.getById` immediately before its save, and a list that has
  gone is skipped.
- `GqlUserMapper.toGql(page, counts)` fell back to `0` for a missing id → `getValue`, so a wrong-ids map fails loudly.
- `deleteUser` ran the purge and session invalidation sequentially → the invalidation is in a `finally`, and the
  exception still propagates.
- The "Re-run" matrix row had no covering test (`AC-9.4-idempotent` never reaches the purge on its second call) →
  new `ListServiceTest` case `AC-9.4-rerun` builds a `ListService` over the test database and calls `purgeUser`
  twice directly.
- E2E: the second-list block asserted nothing (that list was never shared, and the pending invite had been accepted)
  → deleted, with its unused `secondListId`.
- E2E: the singular branch of the cascade sentence was unasserted → the case now opens the dialog while the owner
  owns exactly one list, asserts the singular sentence verbatim and cancels; a throwaway create then makes the panel
  re-read the count as 2 for the existing plural assertion. Proven falsifiable: forcing `'lists'` unconditionally
  fails it at "one owned list reads in the singular".
- E2E: the teardown swept every `TAIL_PREFIX` row, not this project's → it now sweeps rows starting with this run's
  `owner` (the member and the trigger derive from it).
- E2E: the two list names were not project-scoped → `Purged ${testInfo.project.name} ${Date.now()}`.

Re-verified after the fixes: `ListServiceTest` 11/11, `ListSharingTest` + `AdminUserManagementTest` 38/38, and the
chained projects 3 passed each (run one project at a time).

Layers: blind-hunter (BH1-13), edge-case-hunter (EC1-10), verification-gap (VG1 + VG-O1/O2). No layer skipped.
No `intent_gap` or `bad_spec` entry, so no loopback.

**Grouped and routed to `patch`**

| # | Finding(s) | Verdict | Evidence |
|---|---|---|---|
| G1 | BH1, EC3, EC4, VG-O2 — `purgeUser` holds one `listStorage.getAll()` snapshot across the owned-list cascades, then saves `copy()`s built from it | medium | Verified: `ListStorage.save` (`ListStorage.kt:25-30`) is a whole-document upsert, and every other mutating path in `ListService` (`:227`, `:255`, `:271`) re-reads with `getById` immediately before saving. A concurrent `acceptInvite`/`removeMember`/`rename` landing during the purge is silently reverted, and a list deleted concurrently is resurrected in cache and Mongo. Narrow window, real. |
| G2 | BH2, VG-O1 — the "Re-run" matrix row is not actually exercised | medium | Verified: the second `deleteUser` in `AC-9.4-idempotent` throws `GraphQLNotFoundException` at `UserAdminApi.kt:79` and never reaches `purgeUser`, so the idempotence claim in the Boundaries and in the `purgeUser` comment has no covering test. Matrix coverage failure. |
| G3 | BH3 — `ownedListCounts[it.id] ?: 0` in `GqlUserMapper.toGql(page, …)` | low | Verified: unreachable today (`countOwnedLists(userIds)` returns an entry per requested id) but it reintroduces exactly the silent zero the Design Notes and the mapper's own comment say the required parameter exists to prevent. Fix is a direct correction. |
| G4 | BH6, EC9 — the new E2E's second-list assertions prove nothing | medium | Verified at `admin.spec.ts:465-467`: the member was never shared `secondListId`, so the `/lists` redirect is unconditional, and `pending-invite-${listName}` could never match because that invite was accepted. Both assertions pass whether or not the second list was destroyed. |
| G5 | BH8 — the teardown sweeps `startsWith(TAIL_PREFIX)` across projects | low | Verified at `admin.spec.ts:477`: rows are created project-scoped through `uniqueUsername`, but the sweep is not, so one chained project's teardown can delete the other's rows. Safe only under a rule stated in a config comment. Fix is a direct scoping correction. |
| G6 | EC1 — a throw in `purgeUser` skips `invalidateUserSessions` | low | Verified at `UserAdminApi.kt:93-94`: the two are sequential in the same `ifRight`, so a purge failure leaves the deleted user's refresh tokens live. Harm is bounded (the user row is already gone, so operations raise `CallerNotFound`), fix is a direct `try`/`finally`. |
| G7 | VG1 — the singular branch of the cascade sentence is unasserted | medium | Pre-verified by the verification-gap layer and re-checked: `admin.spec.ts:152` covers zero, `:451` covers plural; nothing covers `=== 1`. Interpolating `'lists'` unconditionally passes the whole suite, shipping "the 1 lists they own" on the most common case. |
| G8 | BH9 — list names in the new case use bare `Date.now()` | low | Verified: every username in the same test goes through `uniqueUsername(..., testInfo.project.name)` while `Purged ${Date.now()}` does not, so two concurrent projects can collide on a `list-row-<name>` testid. Direct correction. |

**Routed to `defer`**

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| D1 | EC8 — items in surviving shared lists keep `addedBy = <deleted username>` | low | Real but not caused by this story: `addedBy` was already a denormalized username that user deletion never touched, and the intent scopes the purge to memberships and owned lists. Filed to `deferred-work.md`. |

**Rejected**

| # | Finding | Verdict | Refutation |
|---|---|---|---|
| BH4 | `ownedListCount` joined eagerly for every `User`, including `resetUserPassword` | low | The join is an in-memory cache scan, not a query; the proposed fix (a field resolver backed by `ListService`) adds public surface for a cost the Design Notes already weighed. |
| BH5 | `DeleteUserMutation` selects `ownedListCount` but nothing consumes it | false | The Code Map requires the field on the mutation precisely so the required-argument mapper has an observable effect; removing it would edit this build's spec. |
| BH7 | The Share-dialog phantom has no E2E assertion | low | `AC-9.4-purge` asserts it through the API `members` array AND the raw `lists` document; the fix is a whole new multi-context E2E case, not a direct correction. |
| BH10 | No backend assertion of `ownedListCount` on the paged `users` query | false | The `@serial-users` E2E case asserts the rendered count end-to-end through `AdminUsersQuery`, which is the only consumer of that join. |
| BH11 | No subscription event for members viewing a deleted owner's list | false | Excluded by the frozen intent, which states the purge emits no event and names the Story 5.6 `FORBIDDEN` guard as the mechanism. Asserted by the new E2E redirect. |
| BH12 | The missing backfill is narrated, not filed as a work item | false | The frozen Never list excludes a migration or cleanup script; the narrowed assumption is the agreed record of it. |
| BH13 | `purgeUser(userId, username)` takes two keys that must agree | low | The signature is specified verbatim in the frozen Approach; changing it means editing this build's spec. |
| EC2 | A mid-loop Mongo failure strands rows | low | Pre-existing and already filed: the cascade's non-atomicity, and that only a single `ClientSession` transaction would fix it, is recorded in `deferred-work.md` and in the `cascadeDeleteList` comment. |
| EC5 | `ownerUsername` matches but `ownerId` does not (data drift) | maybe-false → low | No code path produces that drift; `ownerId`/`ownerUsername` are written together in `createList`. Would need a demonstrated drift to be more than speculative. |
| EC6 | The count is stale if a list is created after the admin page's last fetch | low | Known and documented in `EXPERIENCE.md` as part of this story; the fix (refetch on dialog open) adds a request and a loading state to a confirm dialog the intent says keeps its shape. |
| EC7 | A list created between `countOwnedLists` and `purgeUser` makes the reported count low | low | Same window as EC6, bounded by the admin's own page; reporting the post-hoc cascade count would change the mutation's contract. |
| EC10 | `createList` no longer raises `IllegalStateException` | false | That is the change the frozen Boundaries require, and `AC-9.4-order` pins the new behavior. |

