---
title: 'Story 7.6 — Backend safety fixes riding the same unfreeze'
type: 'bugfix'
created: '2026-08-12'
status: 'done'
baseline_revision: '3421eb1'
final_revision: '6e4c38e'
review_loop_iteration: 0
followup_review_recommended: true # 7 patches, 4 of them medium, spanning both permanent rules documents (three
# factually-wrong claims corrected in place) plus two test defects, one of which required a new red observation.
# Breadth across docs + tests, and the corrections change how a future story reads the cascade-ordering and lazy-sync
# rules, so an independent pass is worth it. Production code was not altered by the review.
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md'
warnings: [multiple-goals, oversized] # multiple-goals: the three fixes (volatile flags / typed invite status /
# membership cascade) are independently shippable and share only the scoped backend unfreeze; the epic bundles them
# deliberately as "three catalogued low-risk items". oversized: the measured line numbers, the four ledger entries to
# close, and the three epic-AC premises that were measured WRONG are load-bearing and cannot be compressed.
---

<intent-contract>

## Intent

**Problem:** Three Epic-4 code-review defects have been carried across four retrospectives because the backend was
frozen. (1) `private var synced = false` in the three Storage classes is non-volatile, so a coroutine can read a stale
`false` and re-run the startup load. (2) The list-member invite status is a bare `String` in the domain model, so
`"PENDING"`/`"ACCEPTED"`/`"DECLINED"` are compared as untyped literals in six places and a typo produces broken state
silently. (3) `ListService.deleteList` cascades items and categories but never removes the list's `list_members` rows,
so every list delete leaks membership rows that `getLists` then silently null-maps away.

**Approach:** Three surgical changes under the epic's scoped unfreeze. Add `@Volatile` to the three flags, leaving the
guard body untouched. Introduce a `MemberStatus` enum used by the **domain model only** — persistence stays a `String`,
converted at the mapper on read and via `.name` on write, exactly as `Item.recurring`/`MongoItem.recurring` already do.
Add `ListMemberRepository.deleteAllInList` and call it inside the existing ordered cascade, between the category delete
and the list delete.

## Boundaries & Constraints

**Always:**
- `MongoListMember.status` stays `String` and the persisted values stay `"PENDING"`/`"ACCEPTED"`/`"DECLINED"`
  **byte-identical**, so no data migration is needed. `GqlListMember.status` also stays `String`, so the GraphQL SDL is
  unchanged: `git diff` must show no change to `MongoListMember.kt`, `GqlListMember.kt` or `ListApi.kt`.
- `git diff bp_front/` is **empty** at close, and `npm run generate` is not run.
- Every new test is observed **failing for the right reason** before the fix and green after, with verbatim output in
  the record. Break each fix **separately** — Story 7.5 measured that a wholesale revert can make a test fail on an
  earlier assertion and leave the real behaviour unverified.
- `./gradlew :bp_back:cleanTest :bp_back:test` — `cleanTest` is mandatory; `:bp_back:test` alone is
  `UP-TO-DATE`-cacheable, prints `BUILD SUCCESSFUL`, executes nothing and leaves stale JUnit XML.
- Totals are read from `bp_back/build/test-results/test/TEST-*.xml`, never from the Kotest console (it prints no
  summary line). Re-measure the baseline; do not quote a remembered number.

**Block If:**
- The `@Volatile` change cannot be made without also changing the `if (synced.not()) { … synced = true }` guard body —
  AC1 requires the guard otherwise unchanged. Do **not** substitute a `Mutex`, a double-checked lock, or an
  `AtomicBoolean`: that is a different, larger fix. HALT with the symptom.
- Making `ListMember.status` an enum turns out to require a change to `MongoListMember.kt`, `GqlListMember.kt`, or the
  generated GraphQL schema. HALT rather than accepting a schema change — the epic forbids one anywhere in Epic 7.
- Any file under `bp_front/` turns out to need a change.

**Never:**
- No migration, backfill, or one-off cleanup of already-orphaned `list_members` rows (AC5 — `md`'s ruling, 2026-07-29).
- No new field on `DeleteListResult` / `GqlDeleteListResult` for the deleted-membership count — that is a schema change.
- No enum at the persistence layer. `kotlinx-serialization` throws `SerializationException` on an unknown enum value,
  and `findActiveByListId` is called from `ListApi.kt:30,60,72,92,104,124` — essentially every list query and mutation
  response — so one unexpected row would fail the whole `lists` query for every member of that list.
- No mocking framework, no `DescribeSpec`/`BehaviorSpec`/`StringSpec`, no direct Mongo *writes* for test setup.
- No fix for the adjacent-but-different ledger items listed in Design Notes §5 (cold-cache `isMember`, `rename`
  atomicity, `acceptInvite` TOCTOU, partial-failure eviction window). They stay open and are restated, not closed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Share then read | owner shares list with `u` | persisted `list_members.status` is the BSON **string** `"PENDING"`; GQL response `"status":"PENDING"` unchanged | none expected |
| Accept | `u` accepts | persisted string `"ACCEPTED"`; domain reads back as `MemberStatus.ACCEPTED` | none expected |
| Decline | `u` declines | persisted string `"DECLINED"`; member filtered out of `GqlList.members` | none expected |
| Delete a shared list | list A has an ACCEPTED and a PENDING row; list B has one | **zero** `list_members` rows remain for A; B's row untouched | none expected |
| Delete an unshared list | list has no member rows | delete succeeds, deletes 0 rows | none expected |
| Unknown status in DB | a hand-written row with `status: "BOGUS"` | `findActiveByListId`/`findPendingByUserId` filter it out at the DB level, so the mapper never sees it | `findByListIdAndUserId` (unfiltered on status) would throw — residual, filed in the ledger, not fixed here |

</intent-contract>

## Code Map

All line numbers measured at `3421eb1` (clean tree). Paths under `bp_back/src/main/kotlin/com/bagplease/`.

**New file:**
- `entity/list/MemberStatus.kt` — `enum class MemberStatus { PENDING, ACCEPTED, DECLINED }`. One-line file mirroring
  `entity/item/Recurring.kt:3`. **Outside the epic's `Files:` line — a recorded deviation, structurally forced** (the
  enum must live somewhere; the `Recurring.kt` precedent is its own file in the entity package).

**Change:**
- `entity/item/ItemStorage.kt:12`, `entity/category/CategoryStorage.kt:12`, `entity/list/ListStorage.kt:12` — all three
  are verbatim `    private var synced = false`; `sync()` is at `:14` in each. Add `@Volatile` **only**.
- `entity/list/ListMember.kt:10` — `val status: String,` → `val status: MemberStatus,`.
- `entity/list/ListService.kt` — six literals: `:151` `existing.status != "DECLINED"`, `:152` the **positional**
  `ListMember(listId, targetUser.id, username, "PENDING", Instant.now())`, `:162` `member.status != "PENDING"`,
  `:163` `member.copy(status = "ACCEPTED")`, `:179` `member.status == "PENDING"`, `:180`
  `member.copy(status = "DECLINED")`. Plus `deleteList` at `:110-130`: the cascade comment at `:116`, and the new call
  between `:118` (`categoryRepository.deleteAllInList(id)`) and `:119` (`listRepository.delete(id)`).
  `listMemberRepository` is **already** the 9th constructor param (`:57`) — no DI or constructor change.
- `entity/list/mongo/ListMemberRepository.kt` — `:39` `Updates.set(MongoListMember::status.name, member.status)` is the
  **domain→Mongo write path, and it is not in any mapper**; it must become `member.status.name` or the driver receives a
  Kotlin enum. This is the single highest-risk site in the story. Also the BSON filter literals at `:49`
  (``Filters.`in`("status", "PENDING", "ACCEPTED")``) and `:62` (`Filters.eq("status", "PENDING")`).
  New `deleteAllInList` after `:68`.
- `entity/list/mongo/MongoListMemberMapper.kt:12` — `status = mongo.status` → `MemberStatus.valueOf(mongo.status)`. The
  only mapper method (there is **no** `mapToMongo`). **Outside the epic's `Files:` line — a recorded deviation,
  structurally forced by AC3's own "conversion happens in the mapper" clause.**
- `entity/list/gql/GqlListMapper.kt:17` `.filter { it.status != "DECLINED" }` → `!= MemberStatus.DECLINED`; `:18`
  `status = it.status` → `it.status.name` (keeps `GqlListMember.status` a `String`).
- `bp_back/src/test/kotlin/com/bagplease/ListSharingTest.kt` — 2 tests added. Helpers to reuse: `loginToken` `:27`,
  `registerManyAndLogin` `:47` (batches to stay inside the 5-auth-calls/min limiter), `createList` `:59`, `shareList`
  `:70`, `acceptInvite` `:79`. Needs a local `deleteList` helper and a direct-Mongo read helper.

**Read-only (must not change):**
- `entity/list/mongo/MongoListMember.kt:14` `val status: String` — the AC3 invariant.
- `entity/list/gql/GqlListMember.kt:9` `val status: String` with `@GraphQLName("ListMember")` `:5` — the GQL model
  holds its **own** String and does not expose the domain object, which is why the SDL cannot change.
- `entity/list/gql/ListApi.kt:30,60,72,92,104,124` — six identical `listMemberRepository.findActiveByListId(list.id)`
  calls; **none touches `.status`**, so this file needs no edit (verified).
- The precedent to copy: `entity/item/Recurring.kt:3` (enum), `entity/item/Item.kt:13` (domain enum),
  `entity/item/mongo/MongoItem.kt:22` (`String?`), `entity/item/mongo/MongoItemMapper.kt:16` (`item.recurring?.name`)
  and `:33` (`Recurring.valueOf(it)`), `entity/item/mongo/ItemRepository.kt:60`
  (`Updates.set("recurring", item.recurring?.name)`) — the exact shape `ListMemberRepository:39` must adopt.
- `entity/list/ListService.kt:81-99` `getLists` — `mapNotNull { … ?: return@mapNotNull null }` at `:86-87` is why an
  orphaned row is **invisible through the API**, which is what forces the cascade test to read Mongo directly.
- `bp_back/src/test/kotlin/com/bagplease/ItemLifecycleTest.kt:158-168` — `connectToDb()`, the in-file pattern for a
  direct `MongoDatabase` against the Testcontainer; `:170-191` `buildItemService`. Copy `connectToDb`'s shape.
- `ListSharingTest.kt:102,107,221` — the three existing wire assertions on `"status":"PENDING"` / `"ACCEPTED"`. They
  must pass with **zero edits**; they are the no-schema-change regression net.
- `_bmad-output/implementation-artifacts/deferred-work.md` — entries to close: `829` (synced flag, 4-1 review),
  `971-972` (its `UserStorage` ancestor, 1-2 review), `811` (untyped status strings, 4-3 review), `813` (orphaned
  `list_members`, 4-3 review). Sections `210-603` (Stories 7.1-7.5) must stay **byte-unchanged**.

## Tasks & Acceptance

**Execution:**
- [x] `bp_back/` — **baseline first.** `git status --short`; `./gradlew :bp_back:cleanTest :bp_back:test`; read
      `tests`/`failures`/`errors`/`skipped` from every `build/test-results/test/TEST-*.xml`. Expected 113 green
      (unchanged since Story 7.4 — 7.5 was frontend-only). **Re-measure, do not quote.** Record the number.
- [x] `entity/item/ItemStorage.kt`, `entity/category/CategoryStorage.kt`, `entity/list/ListStorage.kt` — add
      `@Volatile` to the `:12` flag in each, with `import kotlin.concurrent.Volatile`. Change **nothing** else: the
      guard body, the `sync()` callers, and `evictList`/`evictFromCache` (which deliberately do not reset the flag) are
      untouched. This is the first `@Volatile` in `bp_back` — grep confirms zero existing uses.
- [x] `entity/list/MemberStatus.kt` — new; `enum class MemberStatus { PENDING, ACCEPTED, DECLINED }`. Constant names
      must be identical to the persisted strings; that identity is what makes `.name` and `valueOf` wire-safe.
- [x] `entity/list/ListMember.kt:10` — `status: MemberStatus`. The positional construction at `ListService.kt:152` will
      fail to compile until fixed, which is the intended compile-time net.
- [x] `entity/list/ListService.kt` — replace the six literals at `:151,152,162,163,179,180` with `MemberStatus.*`.
      No behaviour change; the comparisons keep the same operands and direction.
- [x] `entity/list/mongo/MongoListMemberMapper.kt:12` — `status = MemberStatus.valueOf(mongo.status)`. Bare `valueOf`,
      matching `MongoItemMapper.kt:33`; see Design Notes §3 for why the throw is acceptable and what is filed instead.
- [x] `entity/list/mongo/ListMemberRepository.kt` — `:39` → `member.status.name` (**the write path; there is no
      mapper here** — copy `ItemRepository.kt:60`). `:49`/`:62` filter literals → `MemberStatus.PENDING.name` etc.
      Add `suspend fun deleteAllInList(listId: UUID): Int` after `:68`:
      `col.deleteMany(Filters.eq("listId", listId.toString())).deletedCount.toInt()`. The `.toString()` is mandatory —
      `MongoListMember.listId` is persisted as a `String`, so a raw `UUID` filter silently matches zero documents.
- [x] `entity/list/gql/GqlListMapper.kt:17-18` — `!= MemberStatus.DECLINED` and `status = it.status.name`.
- [x] `entity/list/ListService.kt:110-130` — insert `listMemberRepository.deleteAllInList(id)` between the category
      delete (`:118`) and `listRepository.delete(id)` (`:119`), and update the `:116` comment to
      `items → categories → members → list`. Discard the returned count — do **not** surface it in `DeleteListResult`.
- [x] `bp_back/` — `./gradlew :bp_back:build` green **before** writing tests, to confirm the compile-time net caught
      every call site and nothing outside the named files needed a change.
- [x] `ListSharingTest.kt` — add the two tests in Design Notes §4 (`AC-7.6-persist`, `AC-7.6-cascade`) plus the local
      `deleteList` and `connectToDb` helpers. `FunSpec`, `testApplication`, setup through the GraphQL API only; the
      direct Mongo access is **read-only assertion**, which is the documented exception (the API cannot observe an
      orphan — `getLists` null-maps it away). Identify rows by the UUIDs this test created; the suite is parallel and
      the DB is shared.
- [x] `bp_back/` — **observe each new test red, separately.** (a) revert `ListMemberRepository:39` to `member.status`
      → `AC-7.6-persist` red; (b) remove the `deleteAllInList` call from `deleteList` → `AC-7.6-cascade` red. Capture
      verbatim output for each, restore, and confirm the restored file is byte-identical (md5).
- [x] `bp_back/` — gates, each result recorded: `./gradlew :bp_back:build` exit 0;
      `./gradlew :bp_back:cleanTest :bp_back:test` with totals from the JUnit XML (expected baseline + 2);
      `git diff --stat bp_front/` **empty**; `git diff --stat` names no file outside the Code Map;
      `grep -rn '"PENDING"\|"ACCEPTED"\|"DECLINED"' bp_back/src/main/` returns **zero** hits;
      `grep -rn '@Volatile' bp_back/src/main/` returns exactly 3 hits.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — new `## Deferred from: Story 7.6 — backend safety
      fixes riding the same unfreeze (2026-08-12)` section inserted **at line 604**, immediately after the Story 7.5
      section (ends line 603) and **before** `## Deferred from: code review of 7-5-…`. Close entries `829`, `971-972`,
      `811`, `813` with the house strikethrough + `**RESOLVED 2026-08-12 by Story 7.6 — …**` convention. File the new
      entries from Design Notes §5. Verify sections `210-603` are byte-unchanged (md5 before/after).
- [x] `_bmad-output/project-context.md` — add the mapper-boundary rule (domain enum, persisted `String`, `valueOf` on
      read, `.name` on write, GQL model keeps its own `String` so the SDL never moves) generalised from `Recurring` to
      `MemberStatus`, and the `list_members` cascade step. Rules only; new debt goes to the ledger (NFR-E7-1).
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-6-backend-safety-fixes: done`, refresh
      `last_updated`, and record the two `Files:`-line deviations (`MemberStatus.kt`, `MongoListMemberMapper.kt`).

**Acceptance Criteria:**
- Given AC1, when the three Storage classes are inspected, then each `:12` flag carries `@Volatile` and the
  `if (synced.not()) { … synced = true }` body, its callers, and the eviction methods are otherwise byte-unchanged.
- Given AC2, when `ListMember.status` is a `MemberStatus`, then `grep -rn '"PENDING"\|"ACCEPTED"\|"DECLINED"'` over
  `bp_back/src/main/` returns zero hits, and every comparison in `ListService` and `GqlListMapper` is compile-time
  checked against the enum.
- Given AC3, when the story closes, then `MongoListMember.kt`, `GqlListMember.kt` and `ListApi.kt` are unchanged in
  `git diff`, the persisted `status` values are still the strings `"PENDING"`/`"ACCEPTED"`/`"DECLINED"`, and
  `ListSharingTest.kt:102,107,221` pass with **zero edits** — the wire and the stored bytes both prove no migration is
  needed.
- Given AC4, when a list that has an ACCEPTED member row and a PENDING member row is deleted, then zero `list_members`
  documents remain for it, a second list's rows are untouched, and the delete happens after the category delete and
  before the list delete.
- Given AC5, when the story closes, then no migration, backfill, or cleanup script exists anywhere in the diff, and
  `md`'s 2026-07-29 ruling — production is assumed to hold no already-orphaned rows, so a future orphan reads as a new
  finding rather than a regression of this story — is recorded in the ledger section and the implementation record.
- Given AC6, when the story closes, then each of the two behaviourally observable fixes has a Kotest test observed red
  for the right reason with verbatim output recorded, the full backend suite is green at the re-measured baseline + 2,
  the four ledger entries are closed, and `git diff bp_front/` is empty.
- Given AC6's coverage clause and the `@Volatile` change, when the record is written, then it states explicitly that
  the visibility fix is **not** red-observable — a JMM visibility guarantee has no deterministic Kotest expression, and
  a test written to "cover" it would be exactly the Epic-6 anti-pattern of an assertion that cannot fail for the reason
  it was written — and the residual check-then-act window is filed in the ledger rather than silently absorbed.

## Spec Change Log

## Review Triage Log

### 2026-08-12 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 0, medium 4, low 3)
- defer: 7: (high 0, medium 3, low 4)
- reject: 3
- addressed_findings:
  - `[medium]` `[patch]` The new ledger entry justified deferring the real lazy-sync fix with "the double load is
    idempotent … wasted startup I/O, not corruption". False: `sync()` snapshots at the suspending `repository.getAll()`
    and writes afterwards, so a concurrent `save()` can be overwritten by a stale snapshot and never recovers (nothing
    resets `synced`); `configureScheduler` (`GQL.kt:89`) races the first HTTP request on every cold boot. Entry rewritten
    to state the correction, raise the recorded severity, and keep the deferral (AC1 scope) — and the `829` closure was
    amended to match.
  - `[medium]` `[patch]` The cascade-ordering rationale was **backwards** in both `deferred-work.md` and
    `project-context.md`: deleting memberships before `listRepository.delete` is precisely what *can* leave a live list
    with its memberships gone, and "a restart re-syncs" does not apply to `list_members` (no in-memory cache — those
    rows are gone permanently). Both documents corrected to call the ordering a convention, not a mitigation, and to
    name the transaction as the only real fix. Code unchanged: the ordering is what AC4 mandates.
  - `[medium]` `[patch]` AC5's recorded assumption said a future orphan "is a NEW finding — a fresh leak path". Wrong:
    `UserService.adminDeleteUser:84` has no membership cascade (no `ListMemberRepository` injected at all), so user
    deletion still leaks, and because those orphans carry a **live** `listId` the recorded detection query cannot see
    them. Assumption reworded to "list deletion no longer leaks; user deletion still does", with the correct detection
    query, and the leak filed as its own deferred entry.
  - `[medium]` `[patch]` `AC-7.6-cascade`'s comment justified counting on the raw collection because
    `findActiveByListId` "would miss a DECLINED orphan", but the setup created only ACCEPTED + PENDING — the stated
    rationale was never exercised. List A now carries ACCEPTED + **DECLINED** (PENDING moved to the surviving list B;
    three users is the auth-limiter ceiling), the statuses are asserted rather than only the count, and the coverage was
    **proven load-bearing by a second red observation**: narrowing `deleteAllInList` to `status in (PENDING, ACCEPTED)`
    yields `expected:<0L> but was:<1L>`, versus `<2L>` for removing the call outright.
  - `[low]` `[patch]` The persist test's **name** still asserted the premise §5.1 falsified ("is persisted as a BSON
    String, not a Kotlin enum") even after §8 fixed its comment — and the name is what appears in the JUnit XML. Renamed
    to `AC-7.6-persist MemberStatus constant names round-trip as the stored list_members.status strings`.
  - `[low]` `[patch]` `project-context.md` stated "**no test can tell the two forms apart**" as an unconditional rule
    from a single measurement, while in the same breath mandating `.name` — giving a future author both a rule and a
    licence to ignore it. Rescoped to a dated, one-configuration measurement (driver `mongodb 5.5.1`, no `@SerialName`
    overrides) with an instruction to re-measure after Story 7.7's dependency sweep, and `.name` restated as mandatory.
  - `[low]` `[patch]` Every **post-change** line number written into the two permanent documents was stale — the record
    had transcribed the pre-change Code Map numbers (each source file gained an import; `ListService` also gained the
    cascade call). Corrected throughout: `ListService.kt:152,153,163,164,180,181`, `ListMemberRepository.kt:40,50,63`,
    `MongoListMemberMapper.kt:13`, `GqlListMapper.kt:18,19`, `ListSharingTest.kt:617,624` / `:147,152,266` / `:636,666`.

## Design Notes

**§1 — `@Volatile` is a visibility fix, not an atomicity fix, and AC1 knows it.** The guard is check-then-act with a
*suspending* `repository.getAll()` inside it and `synced = true` set after the I/O, so two coroutines can both observe
`false` and both run the load even with `@Volatile`. What `@Volatile` buys is that once one finishes, the others
reliably see `true` — today they may not, indefinitely. Making the load exactly-once needs a
`kotlinx.coroutines.sync.Mutex` (a `suspend` body rules out `synchronized`), which AC1's "guard otherwise unchanged"
clause excludes. Implement the narrow fix; file the rest. Note `@Volatile` resolves without an import on JVM
(`kotlin.jvm.*` is default-imported) — write `import kotlin.concurrent.Volatile` anyway, the platform-agnostic form.

**§2 — two epic premises measured wrong; the fix is unaffected.** AC3's rationale says the status "merely falls through
`!= "DECLINED"`" *in the repository*. It does not: `ListMemberRepository:49` uses a positive whitelist
`Filters.in("status", "PENDING", "ACCEPTED")`; the `!= "DECLINED"` lives at `GqlListMapper.kt:17`. The two are **not
equivalent predicates** — a hypothetical fourth status would be excluded by the repository and included by the mapper.
Not this story's problem, but do not "reconcile" them. Separately, AC2 lists the literal sites as `ListService.kt:151-152,
162-163,179-180`, `ListMemberRepository.kt:49,62` and `GqlListMapper.kt:17` — all correct, but it omits
`ListMemberRepository.kt:39`, the write path, which is the one site that can actually corrupt data.

**§3 — `MemberStatus.valueOf` in the mapper throws on an unknown row, and that is the accepted choice.** It matches
`MongoItemMapper.kt:33` exactly, and AC3 names that precedent as "the codebase already solves this". The protection
AC3 actually asks for is preserved: the two hot paths filter status **at the database**, so `findActiveByListId` and
`findPendingByUserId` can never hand the mapper an unknown value. Only `findByListIdAndUserId` (filtered on `_id`
alone) could, and it is called from three low-traffic service methods. That residual is filed, not fixed — inventing a
fallback semantic (unknown → `DECLINED` hides a member; → `PENDING` invents an invite) needs a ruling this story does
not have.

**§4 — the two tests.** Both in `ListSharingTest.kt`, both `testApplication`, both setting up through the GraphQL API.

- `AC-7.6-persist` — owner + invitee via `registerManyAndLogin`; `createList`, `shareList`, `acceptInvite`; assert no
  `errors`; then read the raw document through a local `connectToDb()` +
  `getCollection<Document>("list_members").find(Filters.eq("_id", "${listId}_${userId}"))` and assert `doc["status"]`
  is the **String** `"ACCEPTED"`. Red when `:39` writes `member.status`. The invitee's `userId` comes from the
  `shareList` response's `members { userId }`, not from a second lookup.
- `AC-7.6-cascade` — owner + two invitees; two lists. List A shared with both (one accepts, one stays PENDING), list B
  shared with invitee 1 (accepts). Delete A through the `deleteList` mutation, assert no `errors`, then
  `countDocuments(Filters.eq("listId", aId))` is **0** and `countDocuments(Filters.eq("listId", bId))` is **1**. Count
  on the raw collection, not via `findActiveByListId` — the latter filters by status and would miss a DECLINED orphan.
  The list-B assertion is the non-vacuity guard: without it the test passes on a `deleteMany` with no `listId` clause.

Three users = 4 auth calls, inside the 5/min limiter; `ListSharingTest.kt:315` already does exactly that.

**§5 — ledger.** Close `829` and `971-972` together: `971-972` names `UserStorage.sync()`, a class deleted by Story 2.0,
so it closes as "the named class is gone; the surviving instances of the pattern are fixed here". Close `811` and `813`
straightforwardly. These are terse single-bullet Epic-4 entries with no body, so the strikethrough alone retains the
original — `Retained for history:` is unnecessary. File as new: (a) the `@Volatile`-does-not-fix-check-then-act residual
from §1, with `Mutex` as the proposed fix; (b) the `findByListIdAndUserId` unknown-status throw from §3; (c) `md`'s
no-backfill ruling as a standing assumption (AC5). **Explicitly restate as still-open, not closed:** `831`/`822`
(`getByIdCached` bypasses `sync()` — the read side of the same lazy-sync bug), `771-776` (`ListStorage.rename`
atomicity), `836` (`ListStorage.delete` dead code), `812` (`acceptInvite` TOCTOU double-accept — its wording references
the bare `"PENDING"` string this story types, so note the wording is now stale while the race is not), `814`
(re-invite overwrites `createdAt`), and `832` (`deleteList` partial-failure leaves stale in-memory data — **this story
lengthens that window by one more Mongo call**, which must be said out loud).

## Implementation Record

_Executed 2026-08-12 on branch `epic7-maintenance`, baseline `3421eb1`, clean tree apart from this untracked spec file.
Docker daemon present (`docker info` → server 29.7.1), so Testcontainers ran. Nothing committed; all work left in the
working tree._

### 1 — Test totals, read from the JUnit XML

Both figures summed from every `<testsuite>` in `bp_back/build/test-results/test/TEST-*.xml`, never from the console.

| | baseline (before any edit) | final |
|---|---|---|
| `tests` | **113** | **115** |
| `failures` / `errors` / `skipped` | 0 / 0 / 0 | 0 / 0 / 0 |
| suites | 15 | 15 |
| `com.bagplease.ListSharingTest` | **16** (0/0/0) | **18** (0/0/0) |

The spec's "expected 113 green" was re-measured, not quoted, and matched. Final = baseline + 2, and the only suite that
changed size is `ListSharingTest` (16 → 18). Per-suite baseline for the record: ApplicationTest 1, AuthApiTest 3,
ItemApiTest 5, ItemCategoryStorageTest 2, ItemLifecycleTest 25, ListAuthorizationTest 4, ListServiceTest 10,
ListSharingTest 16, MigrationTest 5, SubscriptionScopingTest 4, WebSocketAuthTest 3, AdminUserManagementTest 7,
ApplicationConfigTest 7, LoginTokenTest 14, UserRegistrationTest 7.

### 2 — Gate commands and their actual results

Every line below is an outcome observed in this pass. `cleanTest` was prefixed on every test invocation.

| command | result |
|---|---|
| `git status --short` (baseline) | only `?? _bmad-output/implementation-artifacts/spec-7-6-backend-safety-fixes.md` |
| `./gradlew :bp_back:cleanTest :bp_back:test` (baseline) | exit **0**, `BUILD SUCCESSFUL`; XML totals 113/0/0/0 |
| `./gradlew :bp_back:build` (after source edits, before tests were written) | exit **0**, `BUILD SUCCESSFUL in 1m 45s` |
| `./gradlew :bp_back:cleanTest :bp_back:test --tests "com.bagplease.ListSharingTest"` (new tests, green) | exit **0**; `ListSharingTest 18 0 0 0` |
| `./gradlew :bp_back:build` (gate) | exit **0**, `BUILD SUCCESSFUL in 1m 33s`, `14 actionable tasks: 3 executed, 11 up-to-date` |
| `./gradlew :bp_back:cleanTest :bp_back:test` (gate) | exit **0**, `BUILD SUCCESSFUL in 1m 33s`; XML totals **115/0/0/0** |
| `git diff --stat bp_front/` | **empty** — and `npm run generate` was never run |
| `git diff --stat` | exactly the 8 modified files of the Code Map + `ListSharingTest.kt`; untracked: `MemberStatus.kt` and this spec. No file outside the Code Map. |
| `grep -rn '"PENDING"\|"ACCEPTED"\|"DECLINED"' bp_back/src/main/` | **zero hits** (exit 1) |
| `grep -rn '@Volatile' bp_back/src/main/` | exactly **3** hits: `ItemStorage.kt:13`, `CategoryStorage.kt:13`, `ListStorage.kt:13` |
| `git diff --stat` on `MongoListMember.kt` `GqlListMember.kt` `ListApi.kt` | **empty** — all three unchanged |
| `sed -n '210,603p' deferred-work.md \| md5sum` before / after the ledger edit | `fd72e0a411e221cc4234e22384f2f516` both times |
| new ledger section start line | **604**, immediately after the Story 7.5 section and before `## Deferred from: code review of 7-5-…` |
| `python3 -c "yaml.safe_load(...)"` on `sprint-status.yaml` | parses; `last_updated: 2026-08-12`, `7-6-backend-safety-fixes: done` |

`git diff --stat` in full: `CategoryStorage.kt |2 +`, `ItemStorage.kt |2 +`, `ListMember.kt |2 +-`,
`ListService.kt |15 +--`, `ListStorage.kt |2 +`, `GqlListMapper.kt |5 +-`, `ListMemberRepository.kt |12 ++-`,
`MongoListMemberMapper.kt |3 +-`, `ListSharingTest.kt |105 +++`; 9 files, 134 insertions, 14 deletions.

### 3 — Red observations, verbatim, taken separately

**(b) `AC-7.6-cascade` — clean, exactly as the spec prescribed.**
File+line broken: `bp_back/src/main/kotlin/com/bagplease/entity/list/ListService.kt`, the
`listMemberRepository.deleteAllInList(id)` statement in `deleteList` (between the category delete and
`listRepository.delete(id)`) **deleted**. `./gradlew :bp_back:cleanTest :bp_back:test --tests
"com.bagplease.ListSharingTest"` → exit **1**, `ListSharingTest 18 1 0 0`. Exactly one failure, and it is the new test:

```
--- AC-7.6-cascade deleteList removes the list's list_members rows and leaves another list's rows untouched
org.opentest4j.AssertionFailedError: expected:<0L> but was:<2L>
	at com.bagplease.ListSharingTest$1$18$1.invokeSuspend(ListSharingTest.kt:645)
	at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:34)
	at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:100)
	at kotlinx.coroutines.internal.LimitedDispatcher$Worker.run(LimitedDispatcher.kt:124)
	at kotlinx.coroutines.scheduling.TaskImpl.run(Tasks.kt:89)
	at kotlinx.coroutines.scheduling.CoroutineScheduler.runSafely(CoroutineScheduler.kt:586)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.executeTask(CoroutineScheduler.kt:829)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:717)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:704)
```

`ListSharingTest.kt:645` is `col.countDocuments(Filters.eq("listId", listAId)) shouldBe 0L` — the assertion the fix
exists to satisfy, failing with the pre-fix count of 2 rows (one ACCEPTED, one PENDING). The list-B non-vacuity
assertion and the two pre-delete count assertions all still passed, so the failure is the orphan itself and nothing
else. Restored; `ListService.kt` md5 `dad830080bcc418e0d0dec49c942b094` before the break and after the restore.

**(a) `AC-7.6-persist` — THE PRESCRIBED BREAK IS A NO-OP AND THE TEST STAYED GREEN. See §5.**
File+line broken: `entity/list/mongo/ListMemberRepository.kt:39`, reverted exactly as the spec directs, from
`Updates.set(MongoListMember::status.name, member.status.name)` to `Updates.set(MongoListMember::status.name,
member.status)`. Verbatim result:

```
EXIT=0
com.bagplease.ListSharingTest 18 0 0 0

> Task :bp_back:test

BUILD SUCCESSFUL in 20s
8 actionable tasks: 4 executed, 4 up-to-date
```

Zero failures. `ListMemberRepository.kt` restored; md5 `2af041f0249f080becc97b7dc39ce97c` before the break and after
the restore. Root cause established before proceeding, not guessed: `unzip -l bson-5.5.1.jar | grep -i enum` lists
`org/bson/codecs/EnumCodec.class` and `org/bson/codecs/EnumCodecProvider.class`, and `MongoConnection.kt:29-33` builds
`MongoClientSettings` with only a credential and a `uuidRepresentation` — no custom `CodecRegistry`. So `Updates.set`
encodes a Kotlin enum through `EnumCodec`, which writes `value.name()`: byte-identical to passing `.name` by hand.

**(a′) substitute break, so `AC-7.6-persist` is not accepted unproven.** Because no break of the write path *can* make
that test red (there is no behavioural difference to observe), the test was instead broken on the invariant it actually
guards — that the enum constant names are byte-identical to the persisted strings. `MemberStatus.ACCEPTED` was renamed
to `ACCEPTED_BROKEN` in three places so it still compiles and the DB status filter travels with the constant
(`MemberStatus.kt:3`, `ListService.kt:163`, `ListMemberRepository.kt:49`); the test's expectation of the literal
`"ACCEPTED"` is what then fails. Result: exit **1**, `ListSharingTest 18 2 0 0`:

```
--- AC-7.6-persist list_members.status is persisted as a BSON String, not a Kotlin enum
org.opentest4j.AssertionFailedError: Contents did not match exactly, but found the following partial match(es):
Match[0]: whole slice matched actual[0..7]
Line[0] ="ACCEPTED_BROKEN"
Match[0]= ++++++++-------
expected:<ACCEPTED> but was:<ACCEPTED_BROKEN>
	at com.bagplease.ListSharingTest$1$17$1.invokeSuspend(ListSharingTest.kt:611)
	at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:34)
	at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:100)
	at kotlinx.coroutines.internal.LimitedDispatcher$Worker.run(LimitedDispatcher.kt:124)
	at kotlinx.coroutines.scheduling.TaskImpl.run(Tasks.kt:89)
	at kotlinx.coroutines.scheduling.CoroutineScheduler.runSafely(CoroutineScheduler.kt:586)
	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:717)

--- AC7 acceptInvite adds user to List.members and allows data access
org.opentest4j.AssertionFailedError: Contents did not match exactly, but found the following partial match(es):
Match[0]: whole slice matched actual[0..7]
Line[0] ="ACCEPTED_BROKEN"
Match[0]= ++++++++-------
expected:<ACCEPTED> but was:<ACCEPTED_BROKEN>
	at com.bagplease.ListSharingTest$1$7$1.invokeSuspend(ListSharingTest.kt:256)
```

`:611` is `acceptedDoc["status"] shouldBe "ACCEPTED"` — the raw-BSON read. It failed at its **own final assertion**, not
earlier: the `"PENDING"` stored-document assertion at `:604` and the `members`-response parse both passed first, which
proves the test genuinely reads persisted bytes rather than asserting something vacuous. The second failure is the
pre-existing wire assertion at `:256`, and its presence is itself informative — it confirms stored value and wire value
move together, which is the "no migration needed" argument. All three files restored and confirmed byte-identical by
md5: `MemberStatus.kt` `5bc644f8edb0625d28f2643c72ece27f`, `ListService.kt` `dad830080bcc418e0d0dec49c942b094`,
`ListMemberRepository.kt` `2af041f0249f080becc97b7dc39ce97c`.

**`@Volatile` is not red-observable, and that is stated rather than papered over (AC6's coverage clause).** `@Volatile`
is a Java-Memory-Model *visibility* guarantee. Making it fail requires observing a stale read of `synced` — something
the JMM *permits* but never *requires*, and which no JVM will produce on demand. Any test written to "cover" it would be
precisely the Epic-6 anti-pattern named in `project-context.md`: an assertion that cannot fail for the reason it was
written (6 of that epic's 17 review patches were that shape). The fix is therefore verified by inspection — exactly 3
`@Volatile` hits, one per Storage class, with the `if (synced.not()) { … synced = true }` bodies, every `sync()` caller
and `evictList`/`evictFromCache` byte-unchanged in the diff — and the residual check-then-act window is filed as the
first entry of the new ledger section, with a `Mutex`-shaped proposed fix, rather than silently absorbed.

### 4 — `md`'s 2026-07-29 ruling, recorded as AC5 requires

No migration, backfill or cleanup script exists anywhere in the diff. Production is **assumed** to hold no
already-orphaned `list_members` rows; the cascade prevents new orphans only. The consequence, recorded here and in the
ledger: **an orphaned `list_members` row observed in production later is a NEW finding — a fresh leak path — and must
not be triaged as a regression of this story.** Because `ListService.getLists:86-87` `mapNotNull`s orphans away, they
are invisible through the API, so detecting one needs a direct query (cheapest: compare
`db.list_members.distinct("listId")` against `_id` on `lists`).

### 5 — Where the spec was wrong on contact

1. **`ListMemberRepository.kt:39` is not "the single highest-risk site in the story"; it carries no data risk at all.**
   The spec's premise — "it must become `member.status.name` or the driver receives a Kotlin enum" — is true in its
   first half and harmless in its second. The driver *does* receive a Kotlin enum, and encodes it via
   `org.bson.codecs.EnumCodecProvider` (present in `bson-5.5.1.jar`, part of the **default** registry, and
   `MongoConnection.kt` installs no replacement) to the identical BSON string. Measured: the prescribed break left the
   suite green 18/18. **Consequences that follow, and matter for later stories:** (i) `.name` is an
   explicitness/independence change — worth keeping, matching `ItemRepository.kt:60`, and it stops the wire format
   depending on a driver default — but it is *not* a corruption fix and **no test can distinguish the two forms**;
   (ii) the spec's Design Notes §2, which says AC2 "omits `ListMemberRepository.kt:39`, the write path, which is the one
   site that can actually corrupt data", is wrong for the same reason — AC2's original list of literal sites was
   complete; (iii) the invariant actually worth pinning is not "the write path passes `.name`" but "`MemberStatus`'s
   constant names are byte-identical to the persisted strings", which is what `AC-7.6-persist` now pins and what the
   substitute red observation exercises. This is filed in the ledger so it is not re-raised as a risk in a future story.
2. **The spec's red-observation plan for `AC-7.6-persist` was therefore not usable as written.** The hard rule "if a
   test goes green when you broke its behaviour, the test is worthless — fix the test, do not proceed" was applied by
   *finding a break that is actually behavioural* rather than by accepting the green (see (a′) above). The test was kept
   because its subject is real; only the prescribed break was unusable.
3. **Every line number in the Code Map was accurate at `3421eb1`** — the three `private var synced = false` at `:12`,
   `ListMember.kt:10`, the six `ListService` literal sites at `:151,152,162,163,179,180`, the cascade block `:110-130`
   with the comment at `:116`, `ListMemberRepository.kt:39,49,62,68`, `MongoListMemberMapper.kt:12`,
   `GqlListMapper.kt:17-18`, `ListSharingTest.kt:27,47,59,70,79` and the three wire assertions at `:102,107,221`. The
   `deferred-work.md` anchors (`604` for the insertion point, `210-603` for the frozen span, entries `811`, `813`,
   `829`, `971-972`) were also all correct. Nothing had moved.
4. **The three wire assertions moved line numbers, though their content is untouched.** AC3 says
   `ListSharingTest.kt:102,107,221` must pass "with zero edits". They do — zero *content* edits — but the two new local
   helpers were inserted above them, so they now live at `:137`, `:142` and `:256`. A future reader checking AC3 by line
   number will not find them where AC3 says; that is bookkeeping, not a violation.

### 6 — Deviations from the epic's `Files:` line, as shipped

Both were pre-declared by the spec's Code Map and are restated here as actually shipped:

- **`bp_back/src/main/kotlin/com/bagplease/entity/list/MemberStatus.kt` (NEW)** — `enum class MemberStatus { PENDING,
  ACCEPTED, DECLINED }`. Structurally forced: the enum has to live somewhere, and the `entity/item/Recurring.kt`
  precedent is its own one-line file in the entity package.
- **`bp_back/src/main/kotlin/com/bagplease/entity/list/mongo/MongoListMemberMapper.kt`** — `status =
  MemberStatus.valueOf(mongo.status)`. Structurally forced by AC3's own "conversion happens in the mapper" clause; it is
  the only mapper method (there is no `mapToMongo`).

**No additional file outside the Code Map was touched.** In particular the compile-time net from typing
`ListMember.status` caught every call site inside the named files and nothing else: `:bp_back:build` was green
immediately after the source edits, no test fixture constructs a `ListMember` (`grep "ListMember("` over
`bp_back/src/test/` returns nothing), and `ListApi.kt`'s six `findActiveByListId` calls never touch `.status`, so the
spec's "verified, needs no edit" claim held.

### 7 — Decisions the spec did not cover

- **The substitute red observation for `AC-7.6-persist`** (rename `MemberStatus.ACCEPTED` across its three references
  rather than a one-line break). Chosen because the write path and the DB status filter are the *same constant*: any
  break that changes the stored string also breaks `findActiveByListId`'s whitelist, which empties `members` in the
  `shareList` response and would fail the test earlier, on the response parse — exactly the Story-7.5 failure mode the
  spec warned about. Renaming the constant moves storage, filter and wire together, so the test fails at its own final
  assertion. It touches three files, which is more than a minimal break, and is recorded as a judgement call.
- **`AC-7.6-persist` asserts the stored value twice, not once** — `"PENDING"` after `shareList` and `"ACCEPTED"` after
  `acceptInvite`. The spec asked only for the `"ACCEPTED"` read. The extra assertion costs nothing, covers the insert
  path as well as the update path, and is what makes the substitute red observation land on the second assertion rather
  than the first (proving the first genuinely passed).
- **`AC-7.6-cascade` asserts the row counts *before* the delete as well as after** (A = 2, B = 1). Not in the spec.
  Without it a setup regression — say `shareList` silently failing — would make the post-delete `0L` pass vacuously.
- **`connectToDb()` opens a second `MongoClient` per test** (copied verbatim from `ItemLifecycleTest:158-168`, including
  the hard-coded `test_user`/`test_pass`/`test` credentials). It is never closed, matching the existing precedent. Not
  changed here: unifying the helper into `utils/` is a test-infrastructure refactor outside this story.
- **`registerManyAndLogin(owner, invitee1, invitee2)` is destructured into two names** in the cascade test; the third
  token is unused because invitee 2 must stay PENDING. 4 auth calls total (1 admin + 3 users), inside the 5/min limiter.
- **The `deleteList` helper requests `deletedItemCount deletedCategoryCount`**, matching `ListServiceTest.kt:189`. It
  deliberately does **not** ask for a membership count, since adding one to `DeleteListResult` would be a schema change.
- **`project-context.md` bookkeeping:** `rule_count` bumped 87 → 89 for the two new backend rules, and the backend suite
  size reference was refreshed to "115 after Story 7.6 (`ListSharingTest` 16 → 18)" alongside the existing dated
  figures, since that bullet is the one place the file quotes a suite total.

### 8 — Correction applied during task verification

`AC-7.6-persist`'s header comment (`ListSharingTest.kt:580-583` as first written) still asserted the premise §5.1
falsified: "`ListMemberRepository.save` … is the one site that can hand the driver a Kotlin enum. Red when it writes
`member.status` instead of `member.status.name`." That is measurably untrue — the record's own §3(a) shows the suite
green 18/18 under exactly that break — and it is the overclaiming-comment shape Story 7.5's review had to patch three
times. Rewritten to state what the test actually pins (the constant names are byte-identical to the persisted strings,
red on a constant rename), to record the `EnumCodecProvider` measurement with its date, and to keep `.name` justified on
explicitness rather than corruption grounds. Comment-only; `./gradlew :bp_back:compileTestKotlin --rerun-tasks` exit
**0**. Worth knowing: the un-forced run reported `UP-TO-DATE` for a comment-only edit, so `--rerun-tasks` is what proves
a comment change compiles.

## Verification

**Commands:**
- `./gradlew :bp_back:build` — expected: `BUILD SUCCESSFUL`, exit 0.
- `./gradlew :bp_back:cleanTest :bp_back:test` — expected: `BUILD SUCCESSFUL`; then read every
  `bp_back/build/test-results/test/TEST-*.xml` `<testsuite>` and sum `tests`/`failures`/`errors`/`skipped` —
  expected: re-measured baseline + 2, with `failures=0 errors=0 skipped=0`.
- `./gradlew :bp_back:test --tests "com.bagplease.ListSharingTest"` — the cheap loop for the red observations
  (a whole Kotest class, ~17 s vs ~1 m 35 s). Always prefix `cleanTest`.
- `git diff --stat bp_front/` — expected: empty.
- `git diff --stat` — expected: names only the files in the Code Map's "New file" and "Change" lists (plus the three
  `_bmad-output/` bookkeeping files).
- `grep -rn '"PENDING"\|"ACCEPTED"\|"DECLINED"' bp_back/src/main/` — expected: zero hits.
- `grep -rn '@Volatile' bp_back/src/main/` — expected: exactly 3 hits.
- `git diff --stat bp_back/src/main/kotlin/com/bagplease/entity/list/mongo/MongoListMember.kt bp_back/src/main/kotlin/com/bagplease/entity/list/gql/GqlListMember.kt bp_back/src/main/kotlin/com/bagplease/entity/list/gql/ListApi.kt`
  — expected: empty.

**Manual checks (if no CLI):**
- Both red observations captured verbatim, taken **separately** (write path reverted alone; cascade call removed
  alone), and the restored files confirmed byte-identical by md5.
- `deferred-work.md` lines 210-603 confirmed byte-unchanged by md5 before/after the ledger edit.

## Auto Run Result

Status: **done**. Story 7.6 implemented, reviewed, patched and committed on `epic7-maintenance`. Nothing pushed.

**What shipped.** Three catalogued Epic-4 defects closed under the epic's scoped backend unfreeze. (1) `@Volatile` on
the `synced` flag in `ItemStorage`/`CategoryStorage`/`ListStorage` — the first three uses in `bp_back`; guard bodies,
`sync()` callers and `evictList`/`evictFromCache` byte-unchanged. (2) A `MemberStatus` enum typing `ListMember.status`
in the **domain model only**: `MongoListMember.status` and `GqlListMember.status` stay `String`, converted with
`valueOf` at the mapper on read and `.name` on write, so the GraphQL SDL never moved and no migration is needed
(`grep '"PENDING"\|"ACCEPTED"\|"DECLINED"' bp_back/src/main/` → zero hits). (3) `ListMemberRepository.deleteAllInList`
called from `ListService.deleteList` between the category and list deletes, so a list delete no longer strands
membership rows.

**Files changed** (12 modified + 2 new; `git diff bp_front/` empty, `npm run generate` never run):
- `entity/item/ItemStorage.kt`, `entity/category/CategoryStorage.kt`, `entity/list/ListStorage.kt` — `@Volatile` on the
  lazy-sync flag.
- `entity/list/MemberStatus.kt` **(new)** — `enum class MemberStatus { PENDING, ACCEPTED, DECLINED }`.
- `entity/list/ListMember.kt` — `status` is now `MemberStatus`.
- `entity/list/ListService.kt` — six literals typed; membership delete added to the cascade; comment updated.
- `entity/list/mongo/ListMemberRepository.kt` — `.name` on the mapper-less write path, typed BSON filters, new
  `deleteAllInList`.
- `entity/list/mongo/MongoListMemberMapper.kt` — `MemberStatus.valueOf` on read.
- `entity/list/gql/GqlListMapper.kt` — typed filter, `.name` back out to the GQL `String`.
- `ListSharingTest.kt` — 2 tests (`AC-7.6-persist`, `AC-7.6-cascade`), `rejectInvite`/`deleteList`/`connectToDb` helpers.
- `deferred-work.md`, `project-context.md`, `sprint-status.yaml` — bookkeeping.

**Review findings: 7 patched, 7 deferred, 3 rejected, 0 intent-gap, 0 bad-spec.** The review's most valuable output was
that **three claims this story wrote into the permanent documents were wrong** and are now corrected in place: the
cascade ordering is a convention, not a partial-failure mitigation; the `@Volatile` residual is a correctness gap, not
merely wasted startup I/O; and "a future orphan is a new leak path" was false because `UserService.adminDeleteUser`
still leaks. Two test defects were also fixed — an overclaiming test name, and a cascade test whose DECLINED rationale
its own setup never exercised. Deferred, in a new `## Deferred from: code review of 7-6-backend-safety-fixes` section:
the user-delete leak, the non-transactional four-delete cascade, the share-during-delete window that can re-create an
orphan, AC4's inspection-only ordering, the leaked test `MongoClient`, the frontend's bare status literals, and
`sprint-status.yaml`'s narrative duplication. Rejected: the unused `Int` return on `deleteAllInList` (matches both
sibling repositories), the gate-vs-comment-edit ordering (disclosed, comment-only), and the transient spec/sprint status
mismatch (resolved by this finalize step).

**Verification.** Baseline `113/0/0/0` and final **`115/0/0/0`** across 15 suites, both summed from
`bp_back/build/test-results/test/TEST-*.xml` after `cleanTest` (`ListSharingTest` 16 → 18). `:bp_back:build` exit 0.
`git diff bp_front/` empty; `MongoListMember.kt`, `GqlListMember.kt`, `ListApi.kt` unchanged; exactly 3 `@Volatile`
hits; zero bare status literals in `bp_back/src/main/`. `deferred-work.md` lines 210-603 md5-identical
(`fd72e0a411e221cc4234e22384f2f516`) to `HEAD`. **Three red observations**, each taken separately and each file restored
md5-identical: cascade call removed → `expected:<0L> but was:<2L>`; `deleteAllInList` narrowed to
`status in (PENDING, ACCEPTED)` → `expected:<0L> but was:<1L>` (the stranded DECLINED row); and the constant rename
`ACCEPTED` → `ACCEPTED_BROKEN` → `expected:<ACCEPTED> but was:<ACCEPTED_BROKEN>` at the persist test's own final
assertion. The `@Volatile` fix ships with **no** test, deliberately and on the record: a JMM visibility guarantee has no
deterministic Kotest expression, and a test for it would be the Epic-6 anti-pattern of an assertion that cannot fail.

**Residual risks.** The `@Volatile` residual is a live correctness gap on cold boot until the `Mutex` story runs. The
delete cascade is still non-transactional and now one call longer. User deletion still orphans membership rows. The
`MemberStatus.valueOf` throw is reachable through `findByListIdAndUserId`, and the constant-name invariant is
cross-repo but pinned only backend-side. All seven are filed with proposed fixes.

**Process trap worth carrying forward:** `git checkout -- <path>` is **not** a safe restore during a red observation
while the story is uncommitted — it restores from `HEAD` and silently discarded every Story 7.6 change in
`ListService.kt`. Recovered via `git apply` of a saved `git diff` and re-verified by md5; subsequent observations used
`/bin/cp -f` to a backup instead.
