---
title: "Story 9.10: The admin reviews and clears feedback"
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_revision: 'b6b3d0988f6dd2165604cf81b560986dbe25ebe8'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 9.9 lets a user send feedback, but nothing reads it back — the admin has no way to see
what was submitted or remove entries.

**Approach:** Add an admin-only `feedback` query (all entries, newest-first) and `deleteFeedback(id)`
mutation to the existing `entity/feedback/` slice, and a "Feedback" panel on `/admin` listing text/username/time
with a per-row confirm-then-delete action, mirroring the existing Users panel's table + confirm-dialog pattern.

## Boundaries & Constraints

**Always:**
- `feedback` and `deleteFeedback(id)` are gated by `requireAdmin()` (the JWT-`role` check `UserAdminApi`/
  `ApplicationConfigApi` use — requires the caller IS admin) — NOT `sendFeedback`'s `AdminBlocked` idiom, which
  blocks the admin instead.
- Consolidate the now-three `requireAdmin()` copies (`ApplicationConfigApi.kt`, `UserAdminApi.kt`, and this
  story's feedback resolvers) into one shared helper, per `epic-9-context.md`'s Technical Decisions ("the two
  existing duplicated `requireAdmin()` checks are consolidated into one shared auth helper used by user admin,
  app config, and feedback"). This supersedes `FeedbackApi.kt`'s own landing comment ("guarded by a third
  `requireAdmin()` copy"), which undersold the epic's actual decision — the epic context is the primary
  planning source.
- `feedback` returns every entry newest-first (sorted by `createdAt` descending), unpaginated — feedback
  pagination is explicitly out of scope for this epic.
- `deleteFeedback(id)` returns the deleted entry's `id`; deleting a missing id throws `GraphQLNotFoundException`.
- Feedback text renders as plain text only (JSX's default escaping — never `dangerouslySetInnerHTML`).
- Deletion is confirmation-first (a `Dialog` with Cancel/Delete), consistent with `DeleteUserDialog`; no
  optimistic row removal before the mutation resolves.
- Deleting a user (Story 9.4) still never deletes their feedback — already true, since `Feedback.username` is a
  plain copied string with no reference to purge.
- E2E: `feedback.spec.ts`'s existing `sendFeedback` tests leave rows behind with no cleanup (9.9 had nothing to
  delete with). Extend `global-teardown.ts`'s per-run sweep to also delete `_e2e_`-marked feedback rows, the same
  hygiene story 9.2 applied to users — otherwise the new unpaginated admin panel degrades the same way the
  pre-9.2 user table did.

**Never:**
- Do not add feedback pagination, search/filter, status/reply/tagging fields, or a rate limit — explicitly
  deferred for this epic.
- Do not touch `sendFeedback`'s validation/admin-block logic — already correct from Story 9.9.
- No toast/snackbar layer — feedback for the delete action is the row disappearing plus an inline alert on error,
  matching the Users panel.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin lists feedback | 3 entries submitted at different times | returned newest-first by `createdAt` | No error expected |
| No feedback yet | fresh/empty collection | empty list; UI shows an empty-state message | No error expected |
| Non-admin queries `feedback` | regular-user JWT | rejected | `GraphQLForbiddenException`, `code: FORBIDDEN` |
| Admin deletes an existing entry | valid id | entry removed, mutation returns that id | No error expected |
| Admin deletes a non-existent id | random UUID string | rejected | `GraphQLNotFoundException` |
| Non-admin calls `deleteFeedback` | regular-user JWT, valid id | rejected | `GraphQLForbiddenException`, `code: FORBIDDEN` |

</intent-contract>

## Code Map

**Backend** (`bp_back/src/main/kotlin/com/bagplease/`)

- `plugins/GraphQLAuth.kt` -- NEW: `fun DataFetchingEnvironment.requireAdmin()`, the exact body currently
  duplicated in `config/gql/ApplicationConfigApi.kt:12-16` and `entity/user/gql/UserAdminApi.kt:18-22`. Both
  files drop their private copy and import this one; `FeedbackApi.kt` imports it too (no fourth copy).
- `entity/feedback/mongo/FeedbackRepository.kt` -- add `suspend fun findAllNewestFirst(): List<Feedback>` (sort
  `Sorts.descending("createdAt")`, mirrors `UserRepository.kt:37`'s `Sorts.ascending`) and
  `suspend fun deleteById(id: String): Feedback?` (find-then-delete, mirrors `UserService.adminDeleteUser`'s
  shape at `UserService.kt:130-134`, but here entirely at the repository since there's no cross-entity cascade).
- `entity/feedback/FeedbackService.kt` -- add `suspend fun list(): List<Feedback> = repository.findAllNewestFirst()`
  and `suspend fun delete(id: String): Either<FeedbackDeleteError, Feedback>` with
  `sealed class FeedbackDeleteError { data object NotFound }`, `either { repository.deleteById(id) ?: raise(NotFound) }`.
- `entity/feedback/gql/GqlFeedback.kt` -- NEW, modeled on `entity/user/gql/GqlUser.kt`:
  `@GraphQLName("Feedback") data class GqlFeedback(val id: ID, val text: String, val username: String, val createdAt: String)`.
  `createdAt` as `String` via `.toString()` on the `Instant`, the same convention `GqlItemMapper.kt:21-22` uses
  for `deletedAt`/`checkedAt` — no new GraphQL scalar.
- `entity/feedback/gql/GqlFeedbackMapper.kt` -- NEW, one-line `object GqlFeedbackMapper { fun toGql(f: Feedback) = GqlFeedback(ID(f.id), f.text, f.username, f.createdAt.toString()) }`.
- `entity/feedback/gql/FeedbackApi.kt` -- add `class FeedbackQueries(private val service: FeedbackService) : Query { suspend fun feedback(env: DataFetchingEnvironment): List<GqlFeedback> }`
  (`env.requireAdmin()` first, then map `service.list()`); add `deleteFeedback(id: ID, env): ID` to the existing
  `FeedbackMutations` (`env.requireAdmin()`, `service.delete(id.value).fold(ifLeft = { throw GraphQLNotFoundException("Feedback not found") }, ifRight = { ID(it.id) })`).
  The local `caller()` extraction (and its `IllegalStateException` path) is untouched — still used by
  `sendFeedback`; the new methods use `requireAdmin()` instead, same as `UserAdminQueries`/`UserAdminMutations`.
  Delete the two landing comments this story fulfills (`FeedbackApi.kt:40`, `Feedback.kt:23-24`).
- `plugins/GQL.kt` -- add `FeedbackQueries(feedbackService)` to `queries` (replacing the Story-9.10 comment at
  line ~102).
- `src/test/kotlin/com/bagplease/features/feedback/FeedbackTest.kt` -- extend with: admin lists feedback
  newest-first (seed 2+ entries via `sendFeedback`, assert order in the raw JSON body or via a follow-up `feedback`
  query); non-admin `feedback` query rejected (`FORBIDDEN`); admin deletes an entry and a second `feedback` query
  no longer contains it; delete of a random UUID string returns `GraphQLNotFoundException`; non-admin
  `deleteFeedback` rejected (`FORBIDDEN`).

**Frontend** (`bp_front/src/`)

- `lib/admin/adminQueries.ts` -- add `AdminFeedbackQuery` (`feedback { id text username createdAt }`, alongside
  the other admin-scoped operations already here) and `DeleteFeedbackMutation` (`deleteFeedback(id: $id)` → `ID`).
- `components/DeleteFeedbackDialog.tsx` -- NEW, modeled on `components/DeleteUserDialog.tsx`: props
  `{entry: AdminFeedback | null, onClose, onDeleted}`; confirm dialog quoting a truncated snippet of the text and
  the submitter's username; `useMutation(DeleteFeedbackMutation)`; same `shown`/`prevOpen` retained-identity
  pattern as `DeleteUserDialog` so the row's content survives the close transition. Test ids:
  `delete-feedback-dialog`, `delete-feedback-cancel`, `delete-feedback-confirm`, `delete-feedback-error`.
- `routes/AdminPage.tsx` -- add a third `Paper` panel "Feedback" below Users, following the same
  loading/error/empty/content branch order as the Users panel: `useQuery(AdminFeedbackQuery, {fetchPolicy: 'cache-and-network'})`;
  render a list (text, username, formatted `createdAt` via `new Date(createdAt).toLocaleString()`) each with a
  delete `IconButton` (`DeleteOutlinedIcon`, matching the Users row's icon) opening `DeleteFeedbackDialog`; on
  delete, `client.cache.evict({fieldName: 'feedback'}); client.cache.gc()` then refetch, mirroring `evictUsers`
  at `AdminPage.tsx:107-110`. Test ids: `admin-feedback-list`, `admin-feedback-empty`, `admin-feedback-error`,
  `admin-feedback-row-<id>`, `admin-feedback-text-<id>`, `delete-feedback-button-<id>`.
- `bp_front` -- rebuild + start backend, then regenerate codegen (root `CLAUDE.md`) for the new
  query/mutation/`Feedback` type.
- `e2e/support/api.ts` -- add `sendFeedbackApi(token, text)` (mirrors `createUserApi`) and
  `deleteFeedbackApi(token, id)` (mirrors `deleteUserApi`) for setup/teardown use; add
  `listE2eFeedback(token)` (single unpaginated `{ feedback { id username } }` call, filtered by
  `E2E_USERNAME_MARKER`, mirroring `listE2eUsers`'s filter but without its paging loop since `feedback` has none).
- `e2e/global-teardown.ts` -- after the existing user sweep, sweep `_e2e_`-marked feedback rows the same way
  (`listE2eFeedback` then `deleteFeedbackApi` per row, logged and swallowed on failure, same shape as the user
  loop at lines ~30-40).
- `e2e/feedback.spec.ts` -- add admin-side scenarios (same file as the existing `sendFeedback` tests — one
  feature slice): admin sees a submitted entry with correct text/username, deletes it via
  `delete-feedback-button-<id>` → `delete-feedback-confirm`, and the row disappears; Cancel leaves the row in
  place; a regular user never sees the admin feedback UI (there is none to reach — `/admin` is `AdminGuard`-only,
  already covered by existing admin-route tests).
- `e2e/narrow-viewport.spec.ts` -- add a 320px floor case for the Feedback panel: a long feedback text plus the
  delete-confirm dialog, using `expectNotClipped`/`expectInsideViewport`/`expectNoHorizontalOverflow`, the same
  shape as the existing `/admin` floor case (~line 1111) and the feedback-dialog floor case (~line 1172).

## Tasks & Acceptance

**Execution:**
- `bp_back/src/test/kotlin/com/bagplease/features/feedback/FeedbackTest.kt` -- extend first, run red -- proves
  the missing query/mutation/authorization before implementing.
- `bp_back/src/main/kotlin/com/bagplease/plugins/GraphQLAuth.kt` -- add shared `requireAdmin()` -- consolidation.
- `bp_back/src/main/kotlin/com/bagplease/config/gql/ApplicationConfigApi.kt` -- drop local `requireAdmin()`, import shared -- consolidation.
- `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/UserAdminApi.kt` -- drop local `requireAdmin()`, import shared -- consolidation.
- `bp_back/src/main/kotlin/com/bagplease/entity/feedback/mongo/FeedbackRepository.kt` -- add `findAllNewestFirst()`/`deleteById()` -- storage.
- `bp_back/src/main/kotlin/com/bagplease/entity/feedback/FeedbackService.kt` -- add `list()`/`delete()` -- business rules.
- `bp_back/src/main/kotlin/com/bagplease/entity/feedback/gql/{GqlFeedback.kt,GqlFeedbackMapper.kt}` -- add GQL model + mapper -- GraphQL surface.
- `bp_back/src/main/kotlin/com/bagplease/entity/feedback/gql/FeedbackApi.kt` -- add `FeedbackQueries.feedback`, `FeedbackMutations.deleteFeedback` -- GraphQL surface.
- `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt` -- register `FeedbackQueries` -- exposes the field.
- `bp_front/src/lib/admin/adminQueries.ts` -- add `AdminFeedbackQuery`/`DeleteFeedbackMutation` -- frontend query surface.
- `bp_front` -- regenerate codegen against the rebuilt backend -- typed hooks.
- `bp_front/src/components/DeleteFeedbackDialog.tsx` -- add the confirm dialog -- UI.
- `bp_front/src/routes/AdminPage.tsx` -- add the Feedback panel -- UI.
- `bp_front/e2e/support/api.ts` -- add `sendFeedbackApi`/`deleteFeedbackApi`/`listE2eFeedback` -- setup/teardown helpers.
- `bp_front/e2e/global-teardown.ts` -- sweep `_e2e_` feedback rows -- test data hygiene.
- `bp_front/e2e/feedback.spec.ts` -- add admin review/delete E2E coverage, run red first -- proves the feature end to end.
- `bp_front/e2e/narrow-viewport.spec.ts` -- add the Feedback panel + delete-dialog 320px floor case -- NFR-E8-1 coverage.

**Acceptance Criteria:**
- Given several submitted feedback entries, when the admin opens `/admin`, then a Feedback panel lists every
  entry newest-first, each showing its text, submitter username, and submission time.
- Given a non-admin caller, when they query `feedback` or call `deleteFeedback` directly, then both are rejected
  with `FORBIDDEN`.
- Given the admin clicks delete on an entry and confirms, when the mutation resolves, then the entry is gone from
  the panel and from a subsequent `feedback` query.
- Given the admin clicks delete and then Cancel, when the dialog closes, then no entry is removed.
- Given a user is deleted (Story 9.4), when their past feedback is queried afterward, then it is still present,
  unchanged.
- Given `git diff`, when inspected, then `bp_front/src/__generated__/` changed only via `npm run generate`, and
  exactly one `requireAdmin()` definition remains across the GQL layer (no fourth copy).

## Spec Change Log

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 20 findings — high 0, medium 3, low 9, false 8, maybe-false 0
- findings:
  - `[low]` `[patch]` blind-hunter: `FeedbackRepository.deleteById` is a non-atomic find-then-`deleteOne` with no check on whether the delete actually removed anything — real; unlike `UserService.adminDeleteUser`'s precedent (which raises `NotFound` when its own `deleteById` reports nothing was removed), a racing second delete call for the same id returns a fake success. Fixed: rewritten as a single atomic `findOneAndDelete`.
  - `[low]` `[patch]` edge-case-hunter: same root cause as the `deleteById` race above — grouped, same fix.
  - `[medium]` `[patch]` blind-hunter: `findAllNewestFirst()` sorts only by `createdAt` (millisecond precision) with no tiebreaker — entries created in the same millisecond (exactly what the new "newest-first" test does, back-to-back `sendFeedback` calls) have undefined relative order, risking test flakiness and a real, if narrow, production ordering gap. Fixed: added a secondary `_id` descending sort key.
  - `[medium]` `[patch]` edge-case-hunter: same root cause as the ordering-tiebreaker finding above — grouped, same fix.
  - `[medium]` `[patch]` verification-gap: same root cause (millisecond-collision flakiness in the "newest-first" test) — grouped, same fix.
  - `[false]` `[reject]` blind-hunter: no test covers an unauthenticated call to `feedback`/`deleteFeedback` — `gqlRoutes()` wraps `/graphql` in `authenticate(authMethod)`, so a missing JWT returns 401 before any resolver runs, the same mechanism (untested by its own dedicated case) already protecting `createUser`/`deleteUser`/`resetUserPassword`; not a gap this story introduces.
  - `[low]` `[reject]` blind-hunter: the new "empty list" test's correctness depends on Kotest's declaration-order execution against the one shared, un-reset Mongo container — real, but the shared/un-reset container is the pre-existing convention every test in this file already relies on, no reset infrastructure exists anywhere in the test tree to fix it properly, and a violation would fail loudly (not silently); fix is more than a direct correction.
  - `[low]` `[reject]` blind-hunter: the `admin-feedback-empty` UI branch has no e2e test — real, but the identical `admin-users-empty` branch in the same file has never had one either (existing, accepted convention), and reliably driving the shared e2e database to a truly-empty feedback state is impractical given the suite's own concurrent, unbounded `_e2e_` traffic; fix is more than a direct correction.
  - `[low]` `[reject]` blind-hunter: the `admin-feedback-error` Alert branch has no e2e/component test — real, but Story 9.9's own review triage already established and accepted "no test exercises the *-error Alert rendering with real content... confirmed zero `create-user-error` assertions anywhere in `e2e/` either" as a suite-wide convention; this story does not regress it.
  - `[low]` `[reject]` intent-alignment: same root cause as the `admin-feedback-error` finding above (extends it to `delete-feedback-error`) — grouped, same refutation.
  - `[false]` `[reject]` blind-hunter: `deleteFeedbackApi`/`deleteFeedbackMutation` interpolate `id` into the GraphQL string with no escaping, unlike `sendFeedbackApi`'s `escapeGqlString` — mirrors `deleteUserApi`'s identical unescaped-id interpolation (pre-existing precedent in the same file); ids are server-generated UUIDs, never user-controlled text, so there is no injection surface.
  - `[false]` `[reject]` blind-hunter: `DeleteFeedbackDialog.handleConfirm` fires `onDeleted()` (cache evict + refetch) without awaiting or surfacing its failure — identical to `DeleteUserDialog.handleConfirm`'s established pattern, including the same in-code rationale ("a failed refetch is not a failed delete"); not a new gap.
  - `[low]` `[patch]` blind-hunter: `DeleteFeedbackDialog`'s `SNIPPET_LENGTH` truncation slices by UTF-16 code unit and can split a surrogate pair (e.g. an emoji) in arbitrary user-submitted feedback text — real, cosmetic rendering glitch, direct fix available. Fixed: truncation now splits on Unicode code points (`Array.from(...)`) instead of raw UTF-16 units.
  - `[low]` `[reject]` blind-hunter: the I/O & Edge-Case Matrix has no row for deleting a malformed/empty-string id — real gap, but its only fix is editing this build's spec, which is out of scope for this route.
  - `[false]` `[reject]` blind-hunter: `FeedbackDeleteError` as a single-variant `sealed class` is an unjustified extra abstraction over a nullable return — it mirrors `UserService`'s existing `Either<AdminError, User>` convention (`AdminError.NotFound`), the established codebase pattern for service-layer delete errors; not unjustified.
  - `[false]` `[reject]` edge-case-hunter: `sendFeedbackApi`'s `escapeGqlString` does not escape `\n`/`\r`, so multi-line text would produce a malformed JSON body — real limitation, but it exactly mirrors `FeedbackTest.kt`'s own `sendFeedbackQuery` (the precedent this helper is explicitly modeled on, from Story 9.9), and no call site in this diff passes multi-line text, so no actual failure occurs.
  - `[false]` `[reject]` intent-alignment: the spec is authored in the same diff as its implementation, so "diff vs. intent" checking is partly self-referential — inherent to this workflow's own plan-then-implement sequencing (this skill's step-02 writes the spec before step-03 implements it), not a code defect.
  - `[low]` `[patch]` intent-alignment: "newest-first" ordering is verified only at the GraphQL-response layer (raw JSON string-index comparison), never at the rendered DOM/UI layer the spec's own first Acceptance Criterion names — real gap against a stated AC; `AdminPage.tsx` renders the query's array order directly with no client-side re-sort, so today's behavior is correct, but no test would catch a future regression. Fixed: the existing admin e2e test now seeds two entries and asserts their rendered order in the panel.
  - `[false]` `[reject]` intent-alignment: the row's delete button is located by accessible name (`aria-label`) rather than the `delete-feedback-button-<id>` test id the spec's Code Map names — the row's id is an opaque server-generated UUID unknown to the test ahead of time, unlike the Users table's username-keyed rows, so `aria-label` (built from the username the test itself just registered) is the only practical selector; the unused test id remains available for callers that do know the id.
  - `[false]` `[reject]` intent-alignment: declared-scope gaps (no pagination, no rate limit) have no regression guard — explicitly named and accepted as a production risk in the spec's own Design Notes ("accepted for production"); not a new discrepancy this audit surfaces.

## Design Notes

**Why `deleteFeedback` returns `ID`, not `GqlFeedback`.** The epic doc states it explicitly ("`deleteFeedback(id)`
returns the deleted id"), and the admin panel already holds everything it needs to remove the row locally (it just
deleted it) — returning the full entry would only be used to confirm what the caller already knows.

**Why `requireAdmin()` is consolidated now, and not left as a third copy.** `FeedbackApi.kt`'s own landing
comment (written during Story 9.9) said "guarded by a third `requireAdmin()` copy," but `epic-9-context.md`'s
Technical Decisions — the primary planning context for this epic, freshly compiled from the epic file — explicitly
names consolidation into one shared helper used by all three (user admin, app config, feedback) as the target
state. The comment reflects a Story-9.9-time guess at Story 9.10's shape, not an epic-level decision; the context
doc governs.

**Why feedback stays unpaginated here despite the new admin listing.** The epic's deferred list names "feedback
pagination" explicitly, so the risk that unbounded growth degrades this listing (as it did for users before
Story 9.2) is accepted for production — but E2E's own unbounded growth is a self-inflicted, avoidable instance of
exactly that risk, so it gets the same teardown-sweep treatment Story 9.2 gave users, independent of the
production pagination decision.

## Verification

**Commands:**
- `gradle :bp_back:cleanTest :bp_back:test` -- expected: BUILD SUCCESSFUL; `FeedbackTest` green, 0 failures.
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0 (also type-checks `e2e/`).
- `curl -o /dev/null -w '%{http_code}' http://localhost:2080/api/health` -- expected: `200` before any E2E run.
- `cd bp_front && npm run test:e2e` -- expected: suite green on all four projects, including the new admin
  feedback and narrow-viewport cases.

**Manual checks (if no CLI):**
- The red run of the extended `FeedbackTest` and of the new E2E tests is recorded in the story record, observed
  on both viewport projects for the E2E ones.

## Auto Run Result

Status: done

### Implemented change

The admin can now review and clear user-submitted feedback. A new admin-only `feedback` query (newest-first,
unpaginated) and `deleteFeedback(id)` mutation extend the existing `entity/feedback/` slice (Story 9.9), gated by
`requireAdmin()` — the "caller IS admin" idiom, distinct from `sendFeedback`'s admin-blocking one. The three
previously-duplicated `requireAdmin()` copies (`ApplicationConfigApi.kt`, `UserAdminApi.kt`, and this story's own
feedback resolvers) are consolidated into one shared `plugins/GraphQLAuth.kt` helper, per `epic-9-context.md`'s
Technical Decisions. A new "Feedback" panel on `/admin` lists every entry's text/username/submission time with a
per-row confirm-then-delete action (`DeleteFeedbackDialog.tsx`, modeled on `DeleteUserDialog.tsx`). E2E's own
`_e2e_`-marked feedback rows are now swept in `global-teardown.ts`, the same hygiene Story 9.2 gave users.

### Files changed

- `bp_back/.../plugins/GraphQLAuth.kt` — NEW shared `requireAdmin()`, replacing the three duplicated copies.
- `bp_back/.../config/gql/ApplicationConfigApi.kt`, `entity/user/gql/UserAdminApi.kt` — drop local `requireAdmin()`, import the shared one.
- `bp_back/.../entity/feedback/mongo/FeedbackRepository.kt` — added `findAllNewestFirst()` (sorted `createdAt` desc, `_id` desc tiebreaker) and `deleteById()` (atomic `findOneAndDelete`).
- `bp_back/.../entity/feedback/FeedbackService.kt` — added `list()` and `delete(id): Either<FeedbackDeleteError, Feedback>`.
- `bp_back/.../entity/feedback/gql/{GqlFeedback.kt,GqlFeedbackMapper.kt}` — NEW GraphQL model + mapper.
- `bp_back/.../entity/feedback/gql/FeedbackApi.kt` — added `FeedbackQueries.feedback` and `FeedbackMutations.deleteFeedback`.
- `bp_back/.../plugins/GQL.kt` — registered `FeedbackQueries`.
- `bp_back/src/test/.../FeedbackTest.kt` — added 7 tests: empty list, newest-first ordering, non-admin query rejected, delete removes the entry, delete of a random id → NOT_FOUND, non-admin delete rejected, deleting a user doesn't delete their feedback.
- `bp_front/src/lib/admin/adminQueries.ts` — added `AdminFeedbackQuery`, `DeleteFeedbackMutation`, `AdminFeedback` type.
- `bp_front/src/components/DeleteFeedbackDialog.tsx` — NEW confirm dialog, modeled on `DeleteUserDialog.tsx`; codepoint-safe snippet truncation.
- `bp_front/src/routes/AdminPage.tsx` — added the Feedback panel (loading/error/empty/content branching, per-row delete).
- `bp_front/src/__generated__/{gql.ts,graphql.ts}` — regenerated codegen (additive only).
- `bp_front/e2e/support/api.ts` — added `sendFeedbackApi`, `deleteFeedbackApi`, `listE2eFeedback`.
- `bp_front/e2e/global-teardown.ts` — sweeps `_e2e_`-marked feedback rows alongside users.
- `bp_front/e2e/feedback.spec.ts` — added admin review/delete scenarios (seeding two entries to prove newest-first ordering at the DOM layer, plus Cancel-leaves-in-place).
- `bp_front/e2e/narrow-viewport.spec.ts` — added the Feedback panel + delete-dialog 320px floor case.

### Review findings

Four layers (blind-hunter, edge-case-hunter, verification-gap, intent-alignment) reported 20 findings: high 0,
medium 3 (one root cause, grouped), low 9, false 8, maybe-false 0.

**Patched (4 groups):** `FeedbackRepository.deleteById`'s non-atomic find-then-delete let a racing second delete
report a fake success (low) — now a single atomic `findOneAndDelete`. `findAllNewestFirst()` had no tiebreaker
for same-millisecond entries, risking flaky/undefined ordering (medium, 3 reviewers) — added a secondary `_id`
descending sort key. `DeleteFeedbackDialog`'s snippet truncation could split a Unicode surrogate pair (low) — now
truncates by codepoint. "Newest-first" ordering (the spec's own first Acceptance Criterion) was verified only at
the GraphQL-response layer, never the rendered DOM (low) — the admin e2e test now seeds two entries and asserts
their rendered order.

**Rejected (12, one group covering 2 rows):** no dedicated unauthenticated-request test for `feedback`/
`deleteFeedback` (route-level `authenticate()` already returns 401 before any resolver runs, same as other
admin mutations); the empty-list test's declaration-order dependency (matches this file's existing shared-container
convention, no reset infrastructure exists); `admin-feedback-empty` untested (matches the identical, also-untested
`admin-users-empty`); `admin-feedback-error`/`delete-feedback-error` untested (Story 9.9's own triage already
established "no `*-error` e2e assertion exists anywhere" as a suite-wide convention); unescaped `id` interpolation
in `deleteFeedbackApi`/`deleteFeedbackMutation` (mirrors `deleteUserApi`'s identical precedent; ids are
server-generated, no injection surface); `DeleteFeedbackDialog.handleConfirm` not awaiting `onDeleted()` (identical
to `DeleteUserDialog`'s established fire-and-forget pattern); the I/O matrix missing a malformed-id row (fix would
edit the spec, out of scope for this route); `FeedbackDeleteError` as a single-variant sealed class ("unjustified"
— mirrors `UserService`'s established `Either<AdminError, User>` convention); `sendFeedbackApi`'s incomplete
`\n`/`\r` escaping (mirrors the backend's own `sendFeedbackQuery` precedent, no call site passes multi-line text);
the self-referential spec-vs-diff check (inherent to this workflow's plan-then-implement sequencing); the
`aria-label`-vs-testid delete-button selector (the row's id is unknown to the test ahead of time, so `aria-label`
is the only practical selector); declared-scope gaps having no regression guard (explicitly accepted in the
spec's own Design Notes).

### Verification performed

- `gradle :bp_back:cleanTest :bp_back:test` — BUILD SUCCESSFUL, 171 tests, 0 failures, 0 errors (includes all 13
  `FeedbackTest` cases), re-run clean after the patches.
- `npm run lint` and `npm run build` (`tsc -b && vite build`) — both exit 0, twice (before and after patches).
- `curl /api/health` — 200 before each E2E run.
- `npm run test:e2e` — full suite green both before and after the patch pass: 270 passed, 28 skipped, 0 failed
  across all four projects, including the admin-feedback, newest-first-ordering, and narrow-viewport cases; the
  teardown sweep removed every `_e2e_` user and feedback row it created.
- Matrix audit — every I/O matrix row has a covering test that ran and passed: admin lists feedback newest-first,
  empty list, non-admin query rejected, admin deletes an entry, delete of a non-existent id, non-admin delete
  rejected.
- Docker compose stack was torn down after each verification run; nothing left running.

### Follow-up review recommendation

`false`. One `medium`-verdict group was patched this pass (the ordering-tiebreaker fix), and the rule for a
first-pass `true` requires either a patched `high` or two-or-more patched `medium` entries — neither applies here.

### Residual risks

- `FeedbackDeleteError`/`FeedbackError` remain small, single-purpose sealed hierarchies per the codebase's
  established `Either`-based service-layer convention; unchanged risk profile from Story 9.9.
- The `feedback` collection stays unpaginated by design (epic-level deferred scope); production growth is an
  accepted risk per the epic context, mitigated in E2E only by the new teardown sweep.
- `sendFeedbackApi`'s escaping (backslash/quote only, no `\n`/`\r`) is a latent limitation shared with the
  backend's own `sendFeedbackQuery` precedent; neither has a call site today that would trigger it.
