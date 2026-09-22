---
title: "Story 9.9: A user can send feedback from any screen"
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_revision: '0e69a4562aa9aaa301e69050904ae8c4e63c9d0f'
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

**Problem:** There is no way for a regular user to tell the admin what they want; nothing captures free-text
feedback anywhere in the app.

**Approach:** Add a new `entity/feedback/` backend slice with a single admin-blocked `sendFeedback(text)`
mutation that stores text + submitter username + timestamp, and a "Feedback" entry in the account menu
(hidden for admin) that opens a dialog over the current screen. Only sending is in scope; the admin-side
`feedback` query and `deleteFeedback` are Story 9.10.

## Boundaries & Constraints

**Always:**
- `sendFeedback(text: String!)` rejects the admin caller the same way every other admin-blocked mutation
  does: `ensure(caller.value != adminLogin) { ... }`, mirroring `ListService`'s `AdminBlocked` idiom — NOT the
  JWT-role `requireAdmin()` used by admin-only reads.
- Text is trimmed server-side; blank (after trim) is rejected; length is capped at 2000 UTF-16 chars
  (`text.length`, post-trim) — both are service-layer `IllegalArgumentException`-style validation mapped to
  `GraphQLInvalidInputException` at the GQL layer, following existing validation-error precedent.
- Stored `username` is a plain copied string (the caller's username at send time), never a user-id reference;
  `createdAt` is `Instant.now()` via `InstantBsonSerializer` (same as `RefreshToken.expiresAt`).
- The Feedback dialog is rendered from `AppShell` (mounted once, alongside the menu), not from a route, so the
  underlying screen stays mounted; it closes on success — no toast/snackbar (none exists in this app).
- New GraphQL package `com.bagplease.entity.feedback.gql` is added to `GQL.kt`'s `packages` list; only
  `FeedbackMutations` is added to `mutations` — no query is registered yet.

**Never:**
- Do not implement `feedback` (list) or `deleteFeedback` — Story 9.10 owns them; leave a one-line comment at
  the natural insertion points in `GQL.kt` and a new `FeedbackApi.kt` marking where they land.
- Do not consolidate the two existing duplicated `requireAdmin()` helpers (`config/gql/ApplicationConfigApi.kt`,
  `entity/user/gql/UserAdminApi.kt`) — unrelated cleanup, out of scope.
- Do not add a cache, `SharedFlow`, or subscription for feedback (append-only, admin-read-only later).
- No toast/snackbar layer introduced; no new route.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | regular user, `text: "  Please add dark icons  "` | stored trimmed, `username` = caller, `createdAt` set | No error expected |
| Blank text | `text: "   "` | rejected | `GraphQLInvalidInputException` |
| Over length | `text` > 2000 UTF-16 chars (post-trim) | rejected | `GraphQLInvalidInputException` |
| Exactly 2000 chars | `text.length == 2000` (post-trim) | accepted | No error expected |
| Admin caller | JWT for the `admin` account | rejected | `GraphQLForbiddenException`, `code: FORBIDDEN` |
| Cancel in dialog | user opens dialog, types, clicks Cancel | dialog closes, no mutation sent | No error expected |

</intent-contract>

## Code Map

**Backend** (`bp_back/src/main/kotlin/com/bagplease/`)

- `entity/feedback/Feedback.kt` -- NEW domain model, `data class Feedback(val id: String = UUID.randomUUID().toString(), val text: String, val username: String, val createdAt: Instant)`. UUID-as-string precedent: `features/auth/AuthService.kt:31`.
- `entity/feedback/FeedbackService.kt` -- NEW, no cache (unlike `config/ApplicationConfigService.kt`, which has one). Follows `ListService`'s `Either`/`ensure` shape (not `UserAdminApi`'s try/catch-in-resolver shape, since here the admin-block and the validation are both business rules, not GQL input parsing): a small `sealed class FeedbackError { data object AdminBlocked; data object BlankText; data object TooLong }`, and `suspend fun send(caller: CallerUsername, text: String): Either<FeedbackError, Unit> = either { ensure(caller.value != adminLogin) { FeedbackError.AdminBlocked }; val trimmed = text.trim(); ensure(trimmed.isNotEmpty()) { FeedbackError.BlankText }; ensure(trimmed.length <= 2000) { FeedbackError.TooLong }; repository.insert(Feedback(text = trimmed, username = caller.value, createdAt = Instant.now())) }`. `adminLogin` is a constructor param, injected exactly like `ListService.kt:56,84`. `CallerUsername`: `features/auth/CallerUsername.kt:4`.
- `entity/feedback/mongo/MongoFeedback.kt` -- NEW BSON model, modeled on `config/mongo/MongoApplicationConfig.kt`: `@Serializable data class MongoFeedback(@SerialName("_id") val id: String, val text: String, val username: String, @Serializable(with = InstantBsonSerializer::class) val createdAt: Instant)`. `InstantBsonSerializer` precedent: `entity/item/mongo/MongoItem.kt:30-33`.
- `entity/feedback/mongo/FeedbackRepository.kt` -- NEW, modeled on `config/mongo/ApplicationConfigRepository.kt`: `db.getCollection<MongoFeedback>("feedback")`; `suspend fun insert(feedback: Feedback)`. No index needed for this story (listing/sorting is 9.10's job).
- `entity/feedback/gql/FeedbackApi.kt` -- NEW: `class FeedbackMutations(private val service: FeedbackService) : Mutation { suspend fun sendFeedback(text: String, env: DataFetchingEnvironment): Boolean }`. Extract the caller's username the same way `entity/list/gql/ListApi.kt`'s `caller()` extension does (~lines 140-143: read `GQL_CALL_PRINCIPAL` from `graphQlContext`, `username` claim) — duplicate the small extraction locally since the existing one is file-scoped, consistent with the project's tolerance for this exact duplication (per the two `requireAdmin()` copies). Call `service.send(caller, text)` and map the result with `.fold`, mirroring `ListApi.kt:147`'s `is ListAuthError.AdminBlocked -> GraphQLForbiddenException(...)` style: `AdminBlocked -> GraphQLForbiddenException("Admin cannot send feedback")`, `BlankText -> GraphQLInvalidInputException("Feedback text is required")`, `TooLong -> GraphQLInvalidInputException("Feedback text is too long")`; return `true` on success. No `GqlFeedback`/mapper needed until 9.10 adds the query. Add a `// Story 9.10: FeedbackQueries (feedback query) and deleteFeedback land here, guarded by a third requireAdmin() copy.` comment.
- `plugins/GQL.kt` -- add `"com.bagplease.entity.feedback.gql"` to `packages` (~line 95-101); construct `FeedbackRepository(connection.db)` and `FeedbackService(feedbackRepository, adminLogin)` near the other repository/service wiring (~line 67-91, `adminLogin` is already a `configureGql` parameter); add `FeedbackMutations(feedbackService)` to `mutations` (~line 109-115); leave `queries` untouched with a comment noting 9.10's future entry.
- `src/test/kotlin/com/bagplease/features/feedback/FeedbackTest.kt` -- NEW, modeled on `features/admin/ApplicationConfigTest.kt`: `mongoContainer()`, `setUpMongo`/`setUpJwt` from `utils/TestContainers.kt`, `loginAdmin()`/`loginRegularUser()` copied verbatim from that file's pattern. Raw `/graphql` POST, `shouldContain`/`shouldNotContain` on the response body for `"errors"` / `"code":"FORBIDDEN"`.

**Frontend** (`bp_front/src/`)

- `lib/feedback/feedbackQueries.ts` -- NEW, modeled on `lib/admin/adminQueries.ts:51-59`: `export const SendFeedbackMutation = graphql(\`mutation SendFeedback($text: String!) { sendFeedback(text: $text) }\`)`.
- `components/FeedbackDialog.tsx` -- NEW, modeled on `components/CreateUserDialog.tsx` (single-field variant): props `{open, onClose}`; controlled `text` state, `fieldErrors.text`, `formError`, `useMutation(SendFeedbackMutation)`; `validate()` checks non-blank trim and `text.length <= 2000`; `multiline` `TextField` with a `${text.length}/2000` counter under it; on success `reset(); onClose()` (the close IS the confirmation, per `CreateUserDialog.tsx:87-94`'s idiom — no downstream row to show); on error `setFormError(graphqlErrorMessage(err))` (reuse `lib/admin/adminErrors.ts`, already cross-domain per `lib/lists/listsQueries.ts`'s use of it). Test ids: `feedback-dialog`, `feedback-text`, `feedback-error`, `feedback-cancel`, `feedback-submit`.
- `components/AppShell.tsx` -- add a `feedbackOpen` `useState`; a `openFeedback = () => { closeMenu(); setFeedbackOpen(true) }` handler (no navigation, per `goHome`/`goToLists` shape at lines ~74-82); a new `{role !== 'admin' && (<MenuItem data-testid="menu-feedback" onClick={openFeedback}>...<ListItemText>Feedback</ListItemText></MenuItem>)}` placed after `menu-change-password` (both are `role !== 'admin'`-guarded) and before `menu-logout` (lines ~217-259); render `<FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)}/>` inside the shell; update the "Menu order" doc comment at lines ~30-33 to read `Home, Lists, Change password, Feedback | Admin, Logout`. Icon: `@mui/icons-material/Feedback` (or `RateReview`), imported alongside the other menu icons (lines ~14-18).
- `bp_front` -- rebuild + start backend, then `CODEGEN_TOKEN=… npm run generate` (root `CLAUDE.md`) to produce `SendFeedbackMutation`'s generated types.
- `e2e/feedback.spec.ts` -- NEW, modeled on `e2e/admin.spec.ts`'s `createUserViaUi` dialog pattern (lines ~37-45): open via `menu-feedback`, assert `feedback-dialog` visible, fill `feedback-text`, click `feedback-submit`, assert the dialog closes. Cover: happy path as a regular user; blank text shows the inline field error and does not submit; over-2000-char text is rejected (client-side, before the request); Cancel closes without sending (assert no `sendFeedback` network request via `page.on('request'...)` or route interception is NOT the test's job — assert the dialog closes and, on next open, the field is empty, which is enough to prove `reset()` ran); admin account does not see `menu-feedback` at all. Add a 320px case in `e2e/narrow-viewport.spec.ts` using `expectNotClipped`, `expectNoHorizontalOverflow`, `expectInsideViewport` (`e2e/support/layout.ts`) on the dialog's text field and buttons, following the existing dialog-floor assertions' call shape.

## Tasks & Acceptance

**Execution:**
- `bp_back/src/test/kotlin/com/bagplease/features/feedback/FeedbackTest.kt` -- write first, run red -- proves the missing mutation/validation/admin-block before implementing.
- `bp_back/src/main/kotlin/com/bagplease/entity/feedback/{Feedback.kt,FeedbackService.kt}` -- add domain model + service with trim/length/admin-block validation -- core rule.
- `bp_back/src/main/kotlin/com/bagplease/entity/feedback/mongo/{MongoFeedback.kt,FeedbackRepository.kt}` -- add persistence -- storage.
- `bp_back/src/main/kotlin/com/bagplease/entity/feedback/gql/FeedbackApi.kt` -- add `FeedbackMutations.sendFeedback` -- GraphQL surface.
- `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt` -- register the new package, service wiring, and mutation -- exposes the field.
- `bp_front/src/lib/feedback/feedbackQueries.ts` -- add `SendFeedbackMutation` -- frontend query surface.
- `bp_front` -- regenerate codegen against the rebuilt backend -- typed mutation hook.
- `bp_front/src/components/FeedbackDialog.tsx` -- add the dialog -- UI.
- `bp_front/src/components/AppShell.tsx` -- add menu entry + mount the dialog -- entry point from any screen.
- `bp_front/e2e/feedback.spec.ts` -- add E2E coverage per the matrix, run red first on both viewport projects -- proves the feature end to end.
- `bp_front/e2e/narrow-viewport.spec.ts` -- add the 320px dialog floor case -- NFR-E8-1 coverage for a new dialog.

**Acceptance Criteria:**
- Given a logged-in regular user on any authenticated screen, when they open the account menu, then a "Feedback" entry is visible and, when clicked, opens a dialog without navigating away from the current screen.
- Given the admin account, when the account menu is opened, then no "Feedback" entry is present.
- Given the Feedback dialog is open with valid text, when the user submits, then the dialog closes, the underlying screen is unchanged, and the backend stores the trimmed text with the caller's username and a timestamp.
- Given the Feedback dialog is open, when the user clicks Cancel, then the dialog closes and no feedback is stored.
- Given `git diff`, when inspected, then `bp_front/src/__generated__/` changed only via `npm run generate` and no `feedback`/`deleteFeedback` query or admin-review UI was added.

## Spec Change Log

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 19 findings — high 0, medium 3, low 7, false 9, maybe-false 0
- findings:
  - `[false]` `[reject]` blind-hunter: diff bundles a wholesale rewrite of `epic-9-context.md` alongside the story-9.9 code — the file was regenerated in this same workflow run's step-01 because a planning-artifact postdated the cached context (a mandated cache-validity check, not implementer scope creep); the code/test surface stays feedback-only.
  - `[low]` `[patch]` blind-hunter: `FeedbackDialog.tsx`'s character counter renders `text.length` (untrimmed) while `validate()`/the backend check `text.trim().length` — real, a whitespace-padded entry can show over-limit while it would actually submit successfully. Fixed: counter now reads `text.trim().length`.
  - `[low]` `[reject]` blind-hunter: no test exercises the `feedback-error` Alert rendering with real content (the server/network-error path) — confirmed zero `create-user-error` assertions anywhere in `e2e/` either, so this is an existing suite-wide convention, not a regression; the fix needs request mocking, more than a direct correction.
  - `[low]` `[patch]` blind-hunter: `FeedbackTest.kt`'s blank/over-length cases only assert `"errors":` is present, not a specific code, unlike the admin-blocked case which pins `FORBIDDEN` — real, a vacuous check. Fixed: both now also assert `"code":"BAD_USER_INPUT"`.
  - `[medium]` `[patch]` blind-hunter: no backend test verifies the actually-persisted document (trimmed text, caller's username, `createdAt`) — real; the happy-path case only checks `"sendFeedback":true"`, so a swapped-field or skipped-insert regression would still pass every existing test. Fixed: the happy-path test now reads the `feedback` Mongo collection directly via the existing `mongoContainer()` fixture and asserts the stored `text`/`username`/`createdAt`.
  - `[false]` `[reject]` blind-hunter: `caller()`'s bare `IllegalStateException("Unauthenticated")` — matches the exact existing precedent at `ItemApi.kt:110` and `CategoryApi.kt:86`; established project convention, not a defect.
  - `[low]` `[reject]` blind-hunter: no `maxLength` on the textarea and the counter doesn't change appearance past 2000 — cosmetic; adding a hard `maxLength` would break the existing "over-2000 chars rejected client-side" test's premise (it needs to type past the limit), so the fix is more than a direct correction and isn't required by the intent.
  - `[false]` `[reject]` blind-hunter: no version bump for "backend and frontend version numbers stay in lockstep" — checked git history: neither Story 9.7 (`c94670f`) nor 9.8 (`0e69a45`) bumped `package.json`/`build.gradle.kts`/`gradle.properties` either, so a per-story bump is not the actual practice; that rule concerns schema-changing releases, not this scope.
  - `[low]` `[reject]` blind-hunter: no test proves the same-tick re-entry (`loading`) guard stops a double-submit — confirmed no double-click test exists anywhere in `e2e/`, including for `CreateUserDialog`'s identical guard; existing convention, fix needs a race simulation, more than a direct correction.
  - `[low]` `[reject]` blind-hunter: all feedback E2E scenarios open the dialog from `/lists` only, not proving reachability from "any screen" — `AppShell` is the single shared shell mounted via `<Outlet/>` on every authenticated route and `menu-feedback`'s visibility is gated only by `role`, not by route, so there is no route-conditional path a per-screen test could catch that isn't already implied by the shell's architecture; no other menu item gets a per-screen re-test either.
  - `[false]` `[reject]` blind-hunter: reusing `lib/admin/adminErrors`'s `graphqlErrorMessage` from a non-admin dialog is a module-boundary smell — already the established pattern (`lib/lists/listsQueries.ts` does the same), not new.
  - `[false]` `[reject]` blind-hunter: the `feedback` collection has no index/read path beyond an inline comment — explicitly and correctly deferred per the spec's own "Never" boundary (9.10's scope); the landing-point comment is exactly what the spec asked for.
  - `[low]` `[patch]` edge-case-hunter: same root cause as the untrimmed-counter finding above — grouped, same fix.
  - `[medium]` `[patch]` verification-gap: same root cause as the unverified-persistence finding above — grouped, same fix; pre-verified per this layer's evidence rules (traced `FeedbackTest.kt`, confirmed no Mongo read exists anywhere in the test tree).
  - `[false]` `[reject]` intent-alignment: epic-doc rewrite is epic-wide while the code/test surface is feedback-only — same root cause as the first blind-hunter finding above; grouped, same refutation.
  - `[medium]` `[patch]` intent-alignment: persisted-data correctness (trim/username/createdAt) is asserted by the spec's own AC but not verified by any test — same root cause as the unverified-persistence finding above; grouped, same fix.
  - `[false]` `[reject]` intent-alignment: "confirms success" (epic doc) vs "close is the confirmation" (spec) wording divergence — this exact interpretation is reasoned and documented in the spec's own Design Notes, consistent with the app having no toast/snackbar layer anywhere; not a code defect.
  - `[false]` `[reject]` intent-alignment: client (2000, trimmed) and server (2000, trimmed) length boundaries aren't reconciled by one shared test — both sides use the identical formula against the same constant, independently verified on both surfaces (Kotest server-side, Playwright client-side); no divergence demonstrated.
  - `[false]` `[reject]` intent-alignment: the spec's cited precedent line numbers (`ListApi.kt`, `ItemApi.kt`) are unverifiable from the diff alone since those files aren't part of it — independently checked against the current on-disk files during triage (`ItemApi.kt:110`, `CategoryApi.kt:86`, `ListService.kt:56,84`, `ListApi.kt:147`); all precedent claims the spec makes are accurate. A limitation of the auditor's diff-only view, not a defect in the change.

## Design Notes

**Why `sendFeedback` returns `Boolean`, not a `Feedback`/`GqlFeedback` object.** The mutation is fire-and-forget
from the dialog's perspective — it never reads anything back, and 9.10 is what first needs a `GqlFeedback` GQL
model (for the admin's list). Introducing that type now would be unused code until the next story; `Boolean`
keeps this slice exactly as small as this story needs.

**Why the admin block reuses `ListService`'s `adminLogin` idiom instead of `requireAdmin()`.** `requireAdmin()`
(in `ApplicationConfigApi.kt`/`UserAdminApi.kt`) checks the JWT `role` claim to require the caller IS admin —
the opposite of what `sendFeedback` needs. `ListService`'s `ensure(caller.value != adminLogin)` is the
codebase's one existing "block the admin from doing normal-user things" pattern (backend `CLAUDE.md` names it
explicitly), so `sendFeedback` mirrors it rather than inventing a second admin-detection mechanism.

## Verification

**Commands:**
- `gradle :bp_back:cleanTest :bp_back:test` -- expected: BUILD SUCCESSFUL; `FeedbackTest` green, 0 failures across all JUnit XML.
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0 (also type-checks `e2e/`).
- `curl -o /dev/null -w '%{http_code}' http://localhost:2080/api/health` -- expected: `200` before any E2E run.
- `cd bp_front && npm run test:e2e` -- expected: suite green on all four projects, including the new feedback and narrow-viewport cases.

**Manual checks (if no CLI):**
- The red run of `FeedbackTest` and of the new E2E tests is recorded in the story record, observed on both viewport projects for the E2E ones.

## Auto Run Result

Status: done

### Implemented change

Any authenticated non-admin user can now send free-text feedback (max 2000 chars) from a "Feedback" entry
in the account menu, reachable from any authenticated screen. A new backend `entity/feedback/` slice adds a
single `sendFeedback(text)` mutation that rejects the admin caller (mirroring `ListService`'s
`ensure(caller.value != adminLogin)` admin-block idiom), trims and validates the text, and stores it with
the caller's username and a timestamp in a new `feedback` Mongo collection. The dialog is mounted in
`AppShell` (not a route), so the underlying screen stays mounted, and closes on success (no toast layer
exists in this app). The `feedback` (list) query and `deleteFeedback` are deliberately out of scope — Story
9.10's territory — with one-line landing-point comments left at the insertion points.

### Files changed

- `bp_back/.../entity/feedback/Feedback.kt` — NEW domain model (UUID-as-string id, text, username, createdAt).
- `bp_back/.../entity/feedback/FeedbackService.kt` — NEW: `sealed class FeedbackError`, `send(caller, text)` via `Either`/`ensure`, admin-blocked + blank/over-2000 validation.
- `bp_back/.../entity/feedback/mongo/{MongoFeedback.kt,FeedbackRepository.kt}` — NEW BSON model + `insert()` into the `feedback` collection.
- `bp_back/.../entity/feedback/gql/FeedbackApi.kt` — NEW `FeedbackMutations.sendFeedback`, local `caller()` extraction, maps `FeedbackError` to `GraphQLForbiddenException`/`GraphQLInvalidInputException`.
- `bp_back/.../plugins/GQL.kt` — registered the new gql package, wired `FeedbackRepository`/`FeedbackService`, added `FeedbackMutations` to `mutations`; `queries` left untouched with a Story-9.10 comment.
- `bp_back/src/test/.../FeedbackTest.kt` — NEW: happy path (with a direct Mongo read asserting the stored text/username/createdAt), blank, over-2000 (both now also assert `code: BAD_USER_INPUT`), exactly-2000, admin-blocked (`FORBIDDEN`), unauthenticated (401).
- `bp_front/src/lib/feedback/feedbackQueries.ts` — NEW `SendFeedbackMutation`.
- `bp_front/src/components/FeedbackDialog.tsx` — NEW dialog, modeled on `CreateUserDialog.tsx`; character counter uses the trimmed length.
- `bp_front/src/components/AppShell.tsx` — new `menu-feedback` item (hidden for admin) between Change password and Admin/Logout; mounts `FeedbackDialog`; updated the menu-order doc comment.
- `bp_front/src/__generated__/{gql.ts,graphql.ts}` — regenerated codegen (additive only).
- `bp_front/e2e/feedback.spec.ts` — NEW: happy path, blank, over-length (client-side, no request sent), Cancel, admin has no menu entry.
- `bp_front/e2e/narrow-viewport.spec.ts` — added `menu-feedback` to the existing menu-floor case and a new 320px feedback-dialog floor case.
- `bp_front/e2e/navigation.spec.ts` — updated the pre-existing Story 9.7 menu-contents assertion to include "Feedback".

### Review findings

Four layers reported 19 findings: high 0, medium 3 (one root cause, grouped), low 7, false 9, maybe-false 0.

**Patched (3 entries):** the feedback-dialog character counter showed the untrimmed length while validation/submission used the trimmed length (low); the blank/over-length backend tests only checked for the presence of `"errors"` rather than the specific `BAD_USER_INPUT` code (low); no test verified the actually-persisted document's `text`/`username`/`createdAt` (medium — the happy-path test only checked the mutation's boolean return, so a swapped-field or skipped-insert bug would have shipped unnoticed; fixed with a direct Mongo read in the happy-path test).

**Rejected:** no test exercises the server-error inline-alert path (existing suite-wide convention — no `create-user-error` assertion exists anywhere either); no `maxLength` on the textarea (would break the existing over-limit client-side test's premise); no double-submit race test (same untested convention as `CreateUserDialog`'s identical guard); all E2E scenarios open from `/lists` only (the shared `AppShell` mounts via `<Outlet/>` on every route, gated only by role, not route); `caller()`'s bare `IllegalStateException` (exact match to `ItemApi.kt`/`CategoryApi.kt` precedent); no version bump (neither Story 9.7 nor 9.8 bumped versions either); reusing `lib/admin/adminErrors` (already the established cross-domain pattern); no feedback index/read path (explicitly Story 9.10's scope); the epic-context.md rewrite (step-01's mandated cache recompilation, not scope creep); the "confirms success" wording (reasoned in the spec's own Design Notes); the client/server length-boundary reconciliation (both sides use the identical formula, independently verified); the spec's cited precedent line numbers (independently reverified during triage and found accurate).

### Verification performed

- `gradle :bp_back:cleanTest :bp_back:test` — BUILD SUCCESSFUL, 163 tests, 0 failures, 0 errors across all JUnit XML (includes the 6 `FeedbackTest` cases, re-run green after the patches).
- `npm run lint` and `npm run build` — both exit 0.
- `curl /api/health` — 200 before the E2E run.
- `npm run test:e2e` — full suite green: 265 passed, 27 skipped, 0 failed, across all four projects (includes the 10 new `feedback.spec.ts` cases and the 2 new narrow-viewport cases).
- Matrix audit — every I/O matrix row is covered by a test that ran and passed: happy path, blank, over-length, exactly 2000, admin-blocked, and Cancel.
- Docker compose stack was torn down after verification; nothing left running.

### Follow-up review recommendation

`false`. One `medium` entry was patched this pass (the unverified-persistence gap, now closed with a direct Mongo assertion); the rule for a first-pass `true` requires either a patched `high` or two-or-more patched `medium` entries, neither of which applies here.

### Residual risks

- The `feedback` collection has no read path or index yet — by design, deferred to Story 9.10 — so nothing currently confirms in production that submitted feedback is retrievable until that story lands.
- The client-side 2000-char limit and the server-side limit are independently maintained constants (`MAX_LENGTH` in `FeedbackDialog.tsx`, `MAX_TEXT_LENGTH` in `FeedbackService.kt`); a future edit to one without the other would only be caught by the already-passing tests on each side individually, not by a shared assertion.
