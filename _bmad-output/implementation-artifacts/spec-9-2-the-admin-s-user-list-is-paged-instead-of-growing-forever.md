---
title: "Story 9.2: The admin's user list is paged instead of growing forever"
type: 'feature'
created: '2026-09-16'
status: 'done'
baseline_revision: '15ec65b5d90f3fc3e837d6d1a5d4fc16670fcddb'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
warnings: [oversized]
deferred:
  - summary: >-
      The E2E teardown sweep removes the users a run created but not the lists, categories and items
      those users own, so those collections still grow without bound run over run.
    evidence: |-
      global-teardown.ts deletes every user whose username contains `_e2e_`; deleteUser has no cascade,
      and Story 9.4 (owner cascade) is still backlog. Story 9.2's intent forbids touching the store/item
      layers, so the sweep could not clean them here. D4 is closed for the `users` collection only.
    location: >-
      bp_front/e2e/global-teardown.ts
    severity: medium
  - summary: >-
      Nothing pins the Apollo cache eviction after create/delete; removing both evictUsers() calls would
      leave every existing assertion passing.
    evidence: |-
      Under fetchPolicy 'cache-and-network' the network answer always overwrites, so the eviction's only
      effect is on a transient frame. Every assertion in the FR13/FR15 delete test is web-first and
      retries until the settled result lands. Pinning it needs an intermediate-render probe the suite has
      no idiom for. The test's comment was corrected to stop claiming coverage it does not have.
    location: >-
      bp_front/src/routes/AdminPage.tsx (evictUsers), bp_front/e2e/admin.spec.ts
    severity: medium
---

<intent-contract>

## Intent

**Problem:** `/admin` renders every user row in the database (`AdminUsersQuery` is unpaginated), so the page degrades as
accounts accumulate, and the create-user dialog's close is gated behind that full re-render. This is Epic 7 action
**D4**: at 5497 rows a no-load probe measured the dialog closing in 5015 ms against `admin.spec.ts`'s 5000 ms budget.
The E2E suite itself adds ~120 user rows per full run and never removes them, so the margin keeps shrinking — the gate
fails as a "flake" that re-runs appear to heal. Clearing the database restarted the clock but fixed nothing.

**Approach:** Replace the unpaginated `users` field with a server-paged `users(limit, offset, around): UserPage`,
sorted by username ascending, and give `/admin` a 20-per-page pager with a total count. Separately — because
pagination alone does not stop the table growing — add per-run E2E data hygiene that removes the users a run created.

## Boundaries & Constraints

**Always:**
- The server is authoritative for ordering, clamping and page location. `limit` is clamped to 1..100 and `offset` to
  0..last page; the returned `offset` is the page actually served, and the client adopts it.
- Sorting is `username` ascending under Mongo's default binary collation, matching the existing unique index.
- The admin gate stays exactly as it is: `users` calls the private `requireAdmin()` already in `UserAdminApi.kt`.
- Frontend page size is 20. `AdminUsersQuery` uses `cache-and-network`, and every successful `createUser`/`deleteUser`
  runs `cache.evict({fieldName: 'users'})` + `cache.gc()` before the next page query.
- E2E helpers act on a created user only on the page the create landed on. Assert on rows the test created; never on
  an absolute table total.
- A new E2E test is unproven until observed failing on both viewport projects.

**Never:**
- No retry loop, `toPass`, or raised timeout as the answer to D4 — that is the shape Story 7.3 deleted.
- No page-walking in any helper that locates a created user.
- Do not merge the two private `requireAdmin()` copies (Story 9.10 owns that), do not add `User.ownedListCount`
  (Story 9.4), and do not touch the store/item layers.
- Do not hand-edit `bp_front/src/__generated__/`; regenerate.
- No `docker compose down -v` and no database wipe as the hygiene mechanism — the `db_data` volume is always kept.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First page | `limit: 20, offset: null`, 45 users | 20 users sorted asc, `totalCount: 45`, `offset: 0` | No error expected |
| Explicit page | `limit: 20, offset: 40`, 45 users | last 5 users, `totalCount: 45`, `offset: 40` | No error expected |
| Offset past end | `limit: 20, offset: 999`, 45 users | last page (5 users), `offset: 40` — clamped, not empty | No error expected |
| Negative offset | `limit: 20, offset: -5` | first page, `offset: 0` | Clamped, no error |
| Limit clamp | `limit: 0` / `limit: 500` | served as `limit: 1` / `limit: 100` | Clamped, no error |
| `around` hit | `around: <existing username>`, page size 20 | the page containing that user, with that page's `offset`; `offset` argument ignored | No error expected |
| `around` miss | `around: <username not in table>` | the page where that name would sort (count of usernames `<` it) | No error; a total function by design |
| Empty table | no regular users | `users: []`, `totalCount: 0`, `offset: 0` | No error expected |
| Non-admin caller | valid user JWT, not admin | rejected | `GraphQLForbiddenException`, `code: FORBIDDEN` |

</intent-contract>

## Code Map

**Backend** (`bp_back/src/main/kotlin/com/bagplease/`)

- `entity/user/gql/UserAdminApi.kt:25-31` -- `UserAdminQueries.users(env)` returns `List<GqlUser>`; replace with the
  paged field. `:17-22` is the private `requireAdmin()` — call it, leave it in place (9.10 moves it).
- `entity/user/gql/GqlUser.kt:6-11` -- `@GraphQLName("User")` convention for the new `GqlUserPage`.
- `entity/list/gql/GqlListsResult.kt:5-9` -- **the wrapper-type precedent** (`@GraphQLName("ListsResult")`, returned
  directly from `ListApi.kt:24`). `UserPage` copies this shape.
- `plugins/GQL.kt:94-100` -- `com.bagplease.entity.user.gql` is already in `packages` (`:99`), so a new type in that
  package auto-registers. No new wiring; `UserAdminQueries` stays registered at `:106`.
- `entity/user/UserService.kt:68` -- `getAllRegularUsers()`, a pure passthrough with the GQL field as its only caller.
  This is where clamping belongs (services reject with `IllegalArgumentException`; `GraphQL*Exception` is gql-layer only).
- `entity/user/mongo/UserRepository.kt:17` -- `col = db.getCollection<MongoUser>("users")`; `:19-23` the **unique
  ascending index on `username`** that backs both the sort and the `around` count; `:25` `getAll()` = bare `col.find()`,
  no sort/skip/limit. `:27-36` shows the `MongoUser::username.name` field-name idiom to reuse.
- **No Storage layer exists for users** (unlike item/category/list) — users are read from Mongo per call, so there is
  no cache to invalidate server-side. **No `.sort`/`.skip`/`.limit`/`countDocuments` exists anywhere in
  `bp_back/src/main`** — this story introduces the first; `countDocuments` test-side precedent is `ListSharingTest.kt:666`.
- The `admin` account is config-based (`UserService.kt:47-50`) and never stored in `users`, so "regular users only" is
  already free — do not add a role filter.
- `src/test/kotlin/com/bagplease/features/admin/AdminUserManagementTest.kt` -- `FunSpec`; `loginAdmin():27-33`,
  `loginRegularUser():35-51`, raw-JSON `/graphql` posts (`:66-70`). Assertions on the old field at `:69, :99, :133, :189`
  must move to the new shape. `utils/TestContainers.kt:19/29/64` — `mongoContainer()`, `setUpMongo`, `setUpJwt`.
  **The Mongo container is project-scoped and shared, so user rows leak between tests** — seed unique prefixes and
  assert deltas, never absolute totals.

**Frontend** (`bp_front/src/`)

- `lib/admin/adminQueries.ts:21-29` -- `AdminUsersQuery`, the field's only consumer. `:9`
  `AdminUser = AdminUsersQueryResult['users'][number]` **breaks under `UserPage`** and must become
  `['users']['users'][number]`; consumed by `AdminPage.tsx:68,69`, `DeleteUserDialog.tsx:11,17,39`,
  `ResetPasswordDialog.tsx:13,17,42`.
- `routes/AdminPage.tsx` -- one inline component, no separate table component. `:41` `useQuery(AdminUsersQuery)` with
  **no fetchPolicy** (defaults `cache-first`) + `refetch`; `:42` `usersData?.users ?? []`; branch order error `:167` →
  loading `:173` → empty `:177` → table `:186`; `TableContainer :187`, `Table aria-label="Users" :188`, rows `:198`
  keyed `admin-user-row-${username}`; `:241-255` `onCreated={() => refetch()}` / `onDeleted={() => refetch()}` are the
  hook points. `:200` `<Typography noWrap sx={{maxWidth: {xs: 140, sm: 260}}}>` is the **AR-E9-6b carry-in cap**.
  `:58` `cache.writeQuery` is the only existing cache-writing precedent.
- `components/CreateUserDialog.tsx:16-23` -- `onCreated: () => void | Promise<unknown>` takes **no argument** today;
  it needs the created username for `around`. `:74` mutate, `:85-87` `reset(); onClose(); void onCreated()`
  (deliberately not awaited — see the comment at `:80-84`). Test id `create-user-dialog :91`.
- `components/DeleteUserDialog.tsx:59` mutate, `:67-68` `onClose(); void onDeleted()`.
- `lib/apollo/ApolloProvider.tsx:107-110` -- `new InMemoryCache()` with **no `typePolicies` at all**, so each
  `{limit,offset,around}` argument set caches separately — which is exactly why evict+gc is specified. **No
  `cache.evict`/`gc()` precedent exists in `src`**; `cache-and-network` precedent is `components/StoreField.tsx:33`.
- **No pagination precedent exists anywhere in the frontend** — no `Pagination`, `TablePagination`, or chevron icon
  imports. Follow the in-repo idioms instead: `IconButton` + `Tooltip` + `aria-label` (`AdminPage.tsx:206-230`),
  `Box` flex + `justifyContent: 'space-between'` (`:130-153`), responsive padding `{xs: 2, sm: 3}`.
- `codegen.ts:15-43` -- schema is **introspected live** from `http://localhost:2080/api/graphql` with an admin Bearer
  token; there is no committed SDL. The rebuilt backend must be running before `npm run generate`.

**E2E** (`bp_front/e2e/`)

- `admin.spec.ts:43-51` `createUserViaUi` -- **the flake site**: `:49`
  `expect(getByTestId('create-user-dialog')).toHaveCount(0)` at the default 5000 ms, then `:50` the row assertion.
  Five tests; four create a user (`:87, :110, :145, :219`); `:219` is the second observed failure and bottoms out at
  `:49`. Row assertions are name-keyed and individual — the header comment `:11-15` already forbids total-count
  assertions. `loginAsAdmin :29-39`.
- `support/ui.ts:22-24` `uniqueUsername(prefix, label, projectName)` → `${prefix}_e2e_${label}_${projectName}_${Date.now()}`
  — **the only existing hygiene is unique naming, never cleanup**, and the `_e2e_` marker is the sweep key. Names run
  ~40 chars, which is where the 42-character narrow-viewport case comes from. `registerViaUi:28-47` is the other
  user-creating path; its deleted retry wrapper is called out at `:31-36` — do not reintroduce it.
- `support/api.ts:15-39` -- `BACKEND`, `loginApi`, `gql<T>(query, token)`. Setup-only by design; imports nothing from
  `@playwright/test`. **No e2e code queries the `users` field**, so the schema change cannot break e2e directly.
- **There is no `globalTeardown` and no `afterEach`/`afterAll` anywhere in `e2e/`**; created users are never deleted
  except the one row in the FR15 delete test. `global-setup.ts:31-42` `waitForBackend()` polls `/api/health`.
- `support/layout.ts:32` `NARROW_FLOOR_PX = 320`; `:62` `expectNotClipped` (asserts **both** axes), `:85`
  `expectNoHorizontalOverflow`, `:131` `expectInsideViewport`. One definition each per NFR-E8-5 — never re-declare.
- `narrow-viewport.spec.ts` -- covers `/auth`, `/lists`, `/list/:id` only; **no `/admin` floor assertion exists**,
  which is the other half of AR-E9-6b.
- `playwright.config.ts:29-33` `PIXEL_7_AT_FLOOR`; `:57` `retries: 0` locally; `:97-108` the `webServer` block;
  `:224-274` the four projects — `admin.spec.ts` is untagged, so it **already runs at 320px** on `mobile`.
  `:143-223` the **counts ledger**: latest row `:211-221` reads `224 = 111 / 111 / 1 / 1` (19 skips), which Story 9.1
  recorded as already stale — measure, never quote.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- close in place: the index bullets `:35-43`, the Epic 7
  close-out entry `:94-99`, the Stories 7.8+7.9 D4 mechanism entry `:208-243`, and the **`/admin` half only** of the
  Story 8.2 entry `:514-541` (the `/lists` half was closed by md's decision — do not reopen or work it).
- `sprint-status.yaml:116` `9-2-…: backlog`; `:296-304` Epic 7 action **D4**, `status: open`.

## Tasks & Acceptance

**Execution:**

- `bp_back/src/test/kotlin/com/bagplease/features/admin/AdminUserManagementTest.kt` -- **written FIRST**, run red.
  Add paging tests seeded with a per-test unique username prefix so they are immune to leaked rows: ascending order
  within the seeded block; `limit` clamped at both ends (0 → 1, 500 → 100); `offset` clamped past the end to the last
  page and below zero to 0; `around` on a seeded username returns the page containing it with that page's `offset`;
  `around` on an absent name returns the page where it would sort; non-admin → `code: FORBIDDEN`. Then retarget the
  four existing assertions (`:69, :99, :133, :189`) to `users(limit: 20) { users { … } totalCount offset }`. Record the
  red result — it proves the tests observe the missing field.
- `bp_back/src/main/kotlin/com/bagplease/entity/user/UserPage.kt` -- NEW domain type
  `data class UserPage(val users: List<User>, val totalCount: Int, val offset: Int)`.
- `bp_back/src/main/kotlin/com/bagplease/entity/user/mongo/UserRepository.kt` -- add `countAll()`,
  `findPage(limit, skip)` (`.sort(Sorts.ascending(MongoUser::username.name)).skip().limit()`), and
  `countUsernamesBefore(username)` (`Filters.lt(MongoUser::username.name, …)` + `countDocuments`). Keep `getAll()` only
  if something still calls it; otherwise delete it. -- the repository stays query-only, no clamping.
- `bp_back/src/main/kotlin/com/bagplease/entity/user/UserService.kt` -- replace `getAllRegularUsers()` with
  `getUserPage(limit: Int, offset: Int?, around: String?): UserPage`: clamp `limit` to 1..100; when `around` is set,
  derive the page index from `countUsernamesBefore` and ignore `offset`; otherwise clamp `offset` to 0..last page;
  return the served `offset`. -- clamping is a business rule, so it lives here, not in the resolver.
- `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/GqlUserPage.kt` -- NEW
  `@GraphQLName("UserPage") data class GqlUserPage(val users: List<GqlUser>, val totalCount: Int, val offset: Int)`,
  following `GqlListsResult`. -- auto-registers via the already-listed package.
- `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/GqlUserMapper.kt` -- add `toGql(page: UserPage): GqlUserPage`.
- `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/UserAdminApi.kt` -- replace the `users` field with
  `suspend fun users(env: DataFetchingEnvironment, limit: Int, offset: Int? = null, around: String? = null): GqlUserPage`,
  keeping `env.requireAdmin()` as the first statement. -- removes the unpaginated field from the schema.
- `bp_front/src/lib/admin/adminQueries.ts` -- `AdminUsersQuery($limit: Int!, $offset: Int, $around: String)` selecting
  `users(limit:…, offset:…, around:…) { users { id username role } totalCount offset }`; fix the `AdminUser` alias to
  `['users']['users'][number]` so both dialogs keep compiling.
- `bp_front` -- rebuild and start the backend, then `CODEGEN_TOKEN=… npm run generate`. -- `__generated__/` is never
  hand-edited and codegen introspects the live server.
- `bp_front/src/routes/AdminPage.tsx` -- hold `offset` (and a transient `around`) in state; query with
  `{limit: 20, offset, around}` and `fetchPolicy: 'cache-and-network'`; adopt the server's returned `offset` as the new
  current offset. Render a pager row under the table: `admin-users-prev` / `admin-users-next` `IconButton`s with
  `aria-label`s, disabled on the first/last page; `admin-users-page` showing `${page} / ${pageCount}`;
  `admin-users-total` showing `totalCount`. `onCreated(username)` → evict+gc, then query with `around: username`.
  `onDeleted()` → evict+gc, then re-query at the current offset and adopt the clamped `offset` the server returns.
  **Remove the `maxWidth: {xs: 140, sm: 260}` cap on the username cell (`:200`)** and let the cell wrap. -- AR-E9-6b.
- `bp_front/src/components/CreateUserDialog.tsx` -- widen `onCreated` to `(username: string) => void | Promise<unknown>`
  and pass the created username. -- the client cannot ask for `around` without it.
- `bp_front/e2e/support/api.ts` -- add setup/teardown helpers: `createUserApi`, `findUserApi(username)` (one query with
  `around`, never a page-walk), `deleteUserApi(id)`, and `listE2eUsers()` for the sweep. -- keeps `support/api.ts`
  setup-only and keeps helpers out of the UI path.
- `bp_front/e2e/global-teardown.ts` -- NEW, wired in `playwright.config.ts`: log in as admin and delete every user whose
  username contains the `_e2e_` marker, paging with `limit: 100` until exhausted. No retries; failures are logged and
  do not fail the run. -- **this is the D4 mechanism**; it ends the growth and drains the ~3k rows already banked.
- `bp_front/e2e/admin.spec.ts` -- add two tests, run red first: (1) the pager — seed 45 users via the API under one
  run-unique prefix, jump to them with `around`, assert 20 rows per page, ascending order within the page,
  `admin-users-total` equal to the total measured before seeding plus 45, prev disabled on the first page, and
  next/next/prev landing on the expected pages; (2) deleting the only user on the last page moves back one page and
  decreases the total by one. Leave `createUserViaUi` structurally as it is. -- AC-1/2/4/5.
- `bp_front/e2e/narrow-viewport.spec.ts` -- add an `/admin` case at the floor: a seeded 42-character username is
  `expectNotClipped`, the page passes `expectNoHorizontalOverflow`, and both pager controls pass
  `expectInsideViewport`. -- the missing floor assertion from AR-E9-6b.
- `bp_front/playwright.config.ts` -- register `globalTeardown`; append a dated counts-ledger row measured at the final
  state with `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`, showing the
  `untagged tests × 2 = delta` arithmetic against the baseline measured at story start, plus the skip count and its
  per-project split read from a `--reporter=json` run.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md`, `EXPERIENCE.md` -- the mechanical re-verify triggers
  fire (`playwright.config.ts` and a file under `routes/` change): re-run both check blocks at the final code state,
  correct any false claim, and bump `verified_at_commit` to the story-start commit.
- `_bmad-output/implementation-artifacts/deferred-work.md`, `sprint-status.yaml` -- close the four entries in place with
  `✅ CLOSED by Story 9.2 (2026-09-16):` plus a one-line resolution, prefixing retained text with `Was:`; set `9-2-…`
  to `done` and Epic 7 action **D4** to `done`.

**Acceptance Criteria:**

- Given the schema after this story, when it is introspected, then no unpaginated `users` field exists and
  `users(limit: Int!, offset: Int, around: String): UserPage!` is the only user-listing field.
- Given 45 seeded users and a 20-per-page client, when the admin opens `/admin` on that block, then exactly 20 rows
  render in ascending username order, `admin-users-total` shows the seeded total, `admin-users-prev` is disabled and
  `admin-users-next` is enabled; activating next twice then previous shows the following page, then the 5-row tail,
  then the middle page again.
- Given the admin creates a user whose name sorts onto another page, when the create succeeds, then the table shows the
  page containing the new row and the total rises by one — without the client walking pages.
- Given the admin is on the last page holding a single user, when they delete it, then the table moves back one page
  and the total falls by one, with no stale or shifted cached rows.
- Given the 320px `mobile` project and a 42-character username, when `/admin` renders, then the username is not clipped,
  the page does not scroll horizontally, and both pager controls are fully inside the viewport.
- Given a full suite run, when it finishes, then every user it created is gone from the database, so the next run starts
  at the same table size — verified by comparing the user `totalCount` before and after a run.
- Given `git diff`, when inspected, then `bp_front/src/__generated__/` changed only via `npm run generate`, no retry
  loop or raised `expect` timeout was added, and `ListsPage.tsx` is untouched.

## Spec Change Log

## Review Triage Log

### 2026-09-16 — Review pass
- verdicts: 43 findings — high 0, medium 5, low 31, false 6, maybe-false 1
- findings:
  - `[low]` `[patch]` blind-hunter: AC1's admin-exclusion assertion is vacuous on an `around: $username` page — real; `admin` could not appear there whatever the code did. Fixed: a second query at `around: "admin"` now carries the exclusion assertion.
  - `[medium]` `[patch]` blind-hunter: `firstLoad = usersLoading && !page` unmounts the table and pager on every page step, contradicting its own comment — real; changed variables leave `data` undefined until the new page lands. Fixed: `page` falls back to `previousData`.
  - `[low]` `[patch]` blind-hunter: `around` is sticky, so `handleDeleted`'s comment describes a mechanism that is not the one running — comment wrong, behaviour right (the `around` page IS the page being viewed). Fixed: comment states the real mechanism.
  - `[medium]` `[defer]` blind-hunter: the sweep deletes `_e2e_` users but not the lists/categories/items they own, so those collections still grow — real, but cascade delete is Story 9.4 and the intent forbids touching the store/item layers. Deferred.
  - `[low]` `[reject]` blind-hunter: nothing verifies the sweep ran; failures are swallowed — the spec deliberately requires teardown never to fail a green run, and the before/after bracket was measured by hand this pass (2 → 2). Not met in everyday use; a loud-failure fix contradicts a reasoned spec decision.
  - `[low]` `[reject]` blind-hunter: the `_e2e_` sweep key is global, so concurrent suites would delete each other's fixtures, and there is no `globalTimeout` — two concurrent runs already collide on the single shared stack at :2080, so this is not a reachable workflow.
  - `[low]` `[reject]` blind-hunter: `countAll()` and `findPage()` are not atomic, so a concurrent delete can yield an empty page with a non-zero total — real but a narrow race recoverable by reload; the fix adds a branch, so a low finding is not worth the complexity.
  - `[low]` `[reject]` blind-hunter: the empty branch conflates "no users" with "this page is empty", hiding the pager — same root cause as the row above; same rejection.
  - `[low]` `[reject]` blind-hunter: no search, first/last jump or `aria-live` on page change — the intent specifies a prev/next pager with a total and nothing more; this is new scope, not a defect.
  - `[low]` `[reject]` blind-hunter: the new arguments carry no `@GraphQLDescription` and the served `limit` is not echoed — the intent pins the field's exact shape; no repo precedent for descriptions.
  - `[low]` `[reject]` blind-hunter: `countAll`/`countUsernamesBefore` truncate `Long` to `Int` — unreachable below 2^31 users; the fix adds a saturating conversion for a situation never shown reachable.
  - `[low]` `[reject]` blind-hunter: the empty-table case hand-rolls a Mongo container instead of extending `TestContainers.kt` — developer-only tidiness; extracting a second helper is more than a direct correction.
  - `[low]` `[reject]` blind-hunter: E2E API helpers interpolate usernames into query strings — inputs are generated by `uniqueUsername` and contain no quotes; converting three helpers to variables is more than a direct correction.
  - `[low]` `[reject]` blind-hunter: the `/admin` floor fixture truncates to 42 chars and assumes page 1 — the truncation branch never fires for the only project that runs it (`mobile`, base 37 chars, padded), and displacing the `0_`-prefixed row needs ~20 consecutive sweep failures.
  - `[low]` `[patch]` blind-hunter: doc inconsistencies — the `status` mismatch is this workflow's own sequencing (false); new UX prose was never in scope; the DESIGN.md parenthetical genuinely swallowed two unrelated files. Fixed: parenthesis closed after the chevron note.
  - `[low]` `[reject]` edge-case: empty served page with non-zero total hides the pager — grouped with the non-atomic-count entry above; same rejection.
  - `[false]` `[reject]` edge-case: a non-multiple `offset` yields overlapping pages — the matrix specifies "an explicit in-range offset is served exactly", so this is the designed behaviour, and the client only ever sends multiples.
  - `[low]` `[reject]` edge-case: rows deleted between `countAll` and `findPage` return an empty page — grouped with the non-atomic-count entry; same rejection.
  - `[medium]` `[patch]` edge-case: a render between evict and refetch flashes "No users yet" and total 0 — same root cause as the `firstLoad` finding; fixed by the `previousData` fallback.
  - `[low]` `[patch]` edge-case: `handleDeleted` runs with a stale `around` — grouped with the sticky-`around` comment finding; the observable page is correct, the comment was not.
  - `[low]` `[reject]` edge-case: a precached PWA bundle still sending the argument-less `users` query errors on `/admin` — real but self-healing on the next worker update, and a default `limit` would add public surface the intent did not ask for.
  - `[low]` `[reject]` edge-case: the floor fixture may not land on page 1 — grouped with the floor-fixture entry above; same rejection.
  - `[false]` `[reject]` edge-case: truncation collides with an existing name — `mobile` is the only project that runs the case and its base name is 37 chars, so nothing is truncated; the timestamp keeps it unique.
  - `[low]` `[reject]` edge-case: a failed sweep leaves rows that break page-1 placement — same as the floor-fixture entry; same rejection.
  - `[low]` `[reject]` edge-case: the FR13 pager test never passes `around` and asserts on rows it did not seed — real divergence from the task text, but every pager property AC-2 names (page size, in-page ordering, prev disabled, total delta, next/next/prev) is exercised, and jumping to an API-seeded block is impossible through a UI that only sets `around` after a create.
  - `[low]` `[patch]` edge-case: the post-delete re-query is located by name, not the current offset — grouped with the sticky-`around` comment finding.
  - `[low]` `[patch]` edge-case: `findUserApi` has no caller — real dead code. Fixed: deleted.
  - `[medium]` `[patch]` verification-gap: both `around` cases derive the expected offset from `around` itself, so an `lt` → `lte` off-by-one survives — filed pre-verified. Fixed: a new dedicated-container case seeds 105 known names and asserts literal offsets 0/20 at the page boundary.
  - `[low]` `[reject]` verification-gap: the sweep has no check that it removed anything — grouped with the swallowed-failure entry above; same rejection, with this pass's manual 2 → 2 bracket as evidence the mechanism works today.
  - `[medium]` `[defer]` verification-gap: cache eviction is unobservable to the tests that claim to cover it — real; under `cache-and-network` the regression is a transient frame and the suite has no intermediate-render idiom. Deferred; the misleading comment was corrected.
  - `[low]` `[patch]` verification-gap (other): `findUserApi` is dead code — grouped with the deletion above.
  - `[low]` `[reject]` verification-gap (other): the floor case depends on page-1 placement — same as the floor-fixture entry; same rejection.
  - `[false]` `[reject]` verification-gap (other): re-measured doc claims check out — no defect asserted.
  - `[medium]` `[patch]` intent-alignment (a): `limit: 500` asserted as `minOf(100, totalCount)` is vacuous below 100 rows, so an unclamped limit would ship — grouped with the `around` tautology; the new 105-row case asserts exactly 100.
  - `[false]` `[reject]` intent-alignment (b): `around`-miss clamped rather than served as an empty page — the matrix's own "clamped, not empty" rule settles it; the behaviour matches.
  - `[low]` `[reject]` intent-alignment (c): the pager test asserts on rows it did not create — grouped with the same edge-case finding; same rejection.
  - `[maybe-false]` `[reject]` intent-alignment (d): the two retagged/skipped tests may not have been observed red on both viewport projects — unverifiable from the diff; would need the original red-run output. If true it is a process gap worth only `low`.
  - `[low]` `[reject]` intent-alignment (e): extending the serialized project chain changes suite-wide partitioning — not forbidden by the intent, documented in the config, and green across two full runs; no harm named.
  - `[false]` `[reject]` intent-alignment (f): the client never writes the served offset back, so a clamped request keeps re-sending — `goToOffset` derives every subsequent request from `servedOffset`, so no divergence persists past one step.
  - `[low]` `[patch]` intent-alignment (g): `around` is sticky across a delete — grouped with the sticky-`around` comment finding.
  - `[low]` `[patch]` intent-alignment (h): `findUserApi` is unexercised — grouped with the deletion above.
  - `[low]` `[reject]` intent-alignment (i): D4 is closed on the mechanism existing rather than a measurement — the spec's own before/after check was executed this pass (2 users before, 2 after, 278 of 278 swept), so the claim is measured, just not asserted; the automation half is the rejected sweep-guard entry.
  - `[false]` `[reject]` intent-alignment (j): carry-in scope (cap removal, floor case, ledger and artifact closures) is absent from the quoted intent — the spec's task list owns all of it; the auditor saw only the intent block.

## Design Notes

**Why the client adopts the server's returned `offset`.** AD-6 specifies the post-delete query as
`offset: min(current, lastPage)` computed client-side from `totalCount`. Since the server already clamps `offset` to the
last page and returns the page it actually served, sending the current offset and adopting the returned one produces the
identical observable result with one fewer place to get the arithmetic wrong. The behaviour AD-6 asks for is unchanged;
only the arithmetic's home moves.

**Why `around` on an absent username is not an error.** The page index is derived from a count of usernames sorting
before the target, which is total — it answers "the page where that name belongs" whether or not the row exists. Making
it a `NOT_FOUND` would add an error path the client can never usefully handle (it only ever passes a name it just
created, and a concurrent delete would then turn a benign refresh into a failure).

**Why the D4 mechanism is a teardown sweep, not a database reset or a smarter assertion.** The three candidates on
record were: make the helper's assertion independent of the table, paginate, or reset/namespace per run. Pagination
(this story) already bounds the re-render the dialog close waits on, which removes the *mechanism* of the flake. The
sweep addresses the *growth*, which AR-E9-6a says is owed regardless. A sweep beats a volume reset because it keeps
`db_data` (the config the whole suite depends on), it needs no privileged docker step inside `webServer`, and it drains
the rows already banked by earlier runs instead of only stopping new ones. It runs once at teardown, so it cannot add
per-test latency, and it contains no retry loop.

**Why the E2E pager test asserts a measured delta, not the literal 45.** `db_data` persists and the suite runs against
a shared table, so an absolute `admin-users-total` of 45 is not a property any run can guarantee — asserting it would
rebuild the exact "assert on a total you did not create" defect this story exists to remove. Reading the total before
seeding and asserting `before + 45` tests the same behaviour and survives leftovers. Exact ordering, clamping and
`around` semantics are pinned precisely in Kotest, where the data is controlled.

## Verification

**Commands:**
- `gradle :bp_back:cleanTest :bp_back:test` -- expected: BUILD SUCCESSFUL; read totals from
  `bp_back/build/test-results/test/TEST-*.xml`; `AdminUserManagementTest` green with the new paging cases and 0 failures
  across all XML. (`cleanTest` is required — bare `:bp_back:test` is `UP-TO-DATE`-cacheable and leaves stale XML.)
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0 (`tsc -b` also type-checks `e2e/` through
  `tsconfig.e2e.json`, so a spec-file type error fails here).
- `curl -o /dev/null -w '%{http_code}' http://localhost:2080/api/health` -- expected: `200` before any E2E run.
- `cd bp_front && npm run test:e2e` -- expected: suite green on all four projects, including the new pager, delete-last-page
  and `/admin` floor tests.
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` -- expected: measured at story
  start and again at the end; the delta equals `added untagged tests × 2`, and the ledger row records both.
- Query `users(limit: 1) { totalCount }` as admin immediately before and after a full suite run -- expected: the two
  totals are equal, proving the sweep removed everything the run created.

**Manual checks (if no CLI):**
- The red runs of the new Kotest paging cases and of the three new E2E tests are recorded in the story record, observed
  on both viewport projects for the E2E ones.

## Auto Run Result

Status: done

### Implemented change

`/admin` no longer renders every user row in the database. The GraphQL `users` field is now
`users(limit: Int!, offset: Int, around: String): UserPage!` — sorted by `username` ascending, with the
server authoritative for ordering, clamping (`limit` into 1..100, `offset` into 0..last page) and page
location (`around` derives the page from a count of usernames sorting before the target). `/admin` pages
at 20 with a prev/next pager, a page indicator and a total, adopts the offset the server actually served,
and jumps to the page containing a just-created user instead of walking pages. Separately, a Playwright
`globalTeardown` sweeps every user whose name carries the `_e2e_` marker, which ends the per-run growth
that drove Epic 7 action D4 and drains the rows earlier runs banked.

### Files changed

- `bp_back/.../entity/user/UserPage.kt` — NEW domain type: rows, total and the served offset.
- `bp_back/.../entity/user/UserService.kt` — `getAllRegularUsers()` replaced by `getUserPage(limit, offset, around)`; all clamping lives here.
- `bp_back/.../entity/user/mongo/UserRepository.kt` — `countAll`, `findPage` (sorted/skip/limit) and `countUsernamesBefore`; `getAll()` removed.
- `bp_back/.../entity/user/gql/GqlUserPage.kt`, `GqlUserMapper.kt`, `UserAdminApi.kt` — the paged GraphQL field, admin gate unchanged and still first.
- `bp_back/src/test/.../AdminUserManagementTest.kt` — eight paging cases on the shared container, a dedicated-container empty-table case, a dedicated-container 105-row case pinning exact `around` offsets and the upper `limit` clamp, and the four retargeted pre-existing assertions.
- `bp_front/src/lib/admin/adminQueries.ts`, `src/__generated__/` — the paged query and its regenerated types.
- `bp_front/src/routes/AdminPage.tsx` — pager, `cache-and-network`, evict+gc on create/delete, `previousData` fallback, username cell cap removed (AR-E9-6b).
- `bp_front/src/components/CreateUserDialog.tsx` — `onCreated` now carries the created username.
- `bp_front/e2e/support/api.ts`, `support/ui.ts` — setup/teardown helpers and the shared admin login.
- `bp_front/e2e/global-teardown.ts` — NEW: the D4 sweep.
- `bp_front/e2e/admin.spec.ts`, `narrow-viewport.spec.ts`, `playwright.config.ts` — the pager walk, the delete-last-page case, the `/admin` 320px floor case, the `SERIALIZED` project routing and a measured counts-ledger row.
- `deferred-work.md`, `sprint-status.yaml`, `ux-epic-8/DESIGN.md`, `EXPERIENCE.md` — carry-in closures and re-verified doc claims.

### Review findings

Four layers reported 43 findings: high 0, medium 5, low 31, false 6, maybe-false 1.

**Patched (7):** the `around` tests were tautological and the upper `limit` clamp untested (medium, one new
105-row dedicated-container case); `firstLoad` blanked the table and pager on every page step (medium,
`previousData` fallback); AC1's admin-exclusion assertion was vacuous (low); `handleDeleted`'s comment
named the wrong mechanism (low); `findUserApi` was dead code (low, deleted); the delete test's comment
claimed cache-eviction coverage it did not have (low); a DESIGN.md parenthetical swallowed two unrelated
files (low).

**Deferred (2):** the sweep leaves lists/items owned by deleted E2E users (Story 9.4 owns cascade); the
cache eviction is unpinned by any test.

**Rejected:** sweep failures are swallowed (spec's deliberate choice; the before/after bracket was measured
by hand this pass); global sweep key and missing `globalTimeout` (concurrent suites already collide on the
single shared stack); the non-atomic `countAll`/`findPage` race and the empty-page branch that hides the
pager (narrow, reload-recoverable, fix adds branches); no search/first-last/`aria-live` (new scope); no
`@GraphQLDescription` and un-echoed served limit (intent pins the field shape); `Long`→`Int` truncation
(unreachable); hand-rolled test container and string-interpolated E2E queries (tidiness, not direct
corrections); floor-fixture truncation and page-1 placement (truncation never fires on `mobile`; displacing
the row needs ~20 consecutive sweep failures); the pager test asserting on unseeded rows (every AC-2
property is still exercised; `around` is unreachable from the UI for API-seeded rows); stale precached PWA
bundle (self-healing); `around`-miss clamping, the un-written-back offset, the serialized-project change,
D4's structural evidence and the carry-in scope (all refuted or harmless); red-run observation on both
viewports (unverifiable from the diff, `low` if true).

### Verification performed

- `gradle :bp_back:cleanTest :bp_back:test` — BUILD SUCCESSFUL; 128 tests, 0 failures, 0 errors, 0 skipped across all JUnit XML.
- `npm run lint` and `npm run build` — both exit 0 (`tsc -b` also type-checks `e2e/`).
- `curl /api/health` — 200 before each E2E run.
- `npm run test:e2e` — full suite green twice (before and after the patches): 213 passed, 23 skipped, 0 unexpected, 0 flaky, across all four projects.
- Sweep bracket — `users(limit: 1) { totalCount }` read as admin immediately before and after a full run: 2 before, 2 after, with teardown reporting `removed 278 of 278 users matching "_e2e_"`. The `db_data` volume was never wiped.
- `npx playwright test --list | … | uniq -c` — 236 = 116 / 116 / 2 / 2, matching the ledger row written into `playwright.config.ts`.
- Matrix audit — every I/O matrix row is covered by a Kotest case that ran and passed: first page, explicit in-range page, offset past end, negative offset, both limit clamps, `around` hit, `around` miss, empty table, non-admin `FORBIDDEN`.

### Follow-up review recommendation

`true`. Two `medium` entries were patched this pass. The named unverified risk is the `previousData`
fallback in `AdminPage.tsx`: it changes what renders while a page step is in flight, and no test observes
an intermediate render, so the suite would not catch a regression that reintroduced the blank-table
flicker or, conversely, left a stale page visible after an error.

### Residual risks

- The teardown sweep is the only thing holding the users table flat, and its failures are logged, not
  asserted — a silently broken sweep would go unnoticed until the growth returned.
- Lists, categories and items created by E2E users survive the sweep and keep accumulating until Story 9.4.
- `getUserPage` issues its count and its page as two round trips, so a concurrent delete can briefly yield
  an empty page with a non-zero total; the panel then shows its empty state until reloaded.
