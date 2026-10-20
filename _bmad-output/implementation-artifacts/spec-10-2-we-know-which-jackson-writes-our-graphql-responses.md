---
title: 'We know which Jackson writes our GraphQL responses'
type: 'chore'
created: '2026-10-20'
status: 'done'
baseline_revision: '5dc04f3909ec5aeea301fe14005e80c5352be5ab'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
  - '{project-root}/bp_back/CLAUDE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Jackson 2 and 3 are both on the backend runtime classpath and nobody has measured which mapper writes GraphQL HTTP bodies and `graphql-ws` frames (open Story 7.12 ledger entry), so the graphql-kotlin 11 bump could flip serialisation unnoticed.

**Approach:** Record the planning-time measurements as a rule in `bp_back/CLAUDE.md`, pin them with a Kotest `testApplication` test, remove the vestigial websocket converter (shown unused), and close the 7.12 ledger entry. No dependency moves.

## Boundaries & Constraints

**Always:** Probe output quoted verbatim in the ledger closure; the pin test observed failing against a deliberately broken build before it is accepted; `FORBIDDEN` and failing-mutation bodies byte-identical (md5 before/after, baselines `0f14f39530c686ecc53218f28f1b79f4` and `e8f4a49ba280f66c1510a6bfbb0f21ea` from the 7.12 entry, re-captured on the day); `cleanTest test` totals from JUnit XML; full E2E gate (incl. a live subscription reaching a second member).

**Never:** Touch `gradle/libs.versions.toml`; remove or relocate the root `ContentNegotiation` (REST auth DTOs need it); leave `JacksonProbeTest.kt` or any probe code in the tree.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| GraphQL negotiation | POST `/graphql`, `Accept: application/json`, `*/*` or absent | 200, `Content-Type: application/json` (no charset), compact body | — |
| Unacceptable Accept | `Accept: application/xml`, `text/plain` | 406, empty body | — |
| REST mapper | POST `/auth/login` | keys in declaration order `accessToken, username, role` | — |
| Subscription | `connection_init` + subscribe over `/subscriptions` | `connection_ack` and `next` frames still arrive without the converter | — |

</intent-contract>

## Code Map

- `bp_back/src/main/kotlin/com/bagplease/plugins/Routing.kt:24` -- root `install(ContentNegotiation) { jackson() }`; Jackson 2.
- `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt:138-141` -- `install(WebSockets)` with `JacksonWebsocketContentConverter()` (+ import at :45); no `sendSerialized`/`receiveDeserialized` anywhere in `src/main`.
- `bp_back/CLAUDE.md` -- gets the rule.
- `_bmad-output/implementation-artifacts/deferred-work.md:307-` -- 7.12 Jackson entry to close in place (house style: `✅ CLOSED by Story 10.2 (date)` + `Was:`).
- `bp_back/src/test/kotlin/com/bagplease/WebSocketAuthTest.kt`, `HealthApiTest.kt` -- test scaffolding (`mongoContainer`, `setUpMongo`, `setUpJwt`; no `rootPath`; tokens minted with `JWT.create()` audience/issuer `localhost`, secret `secret`, claims `username`/`role`, avoiding login).
- Measured at planning (probe `.tmp/bb0ac2b3/JacksonProbeTest.kt (throwaway, scratch only)`): GraphQL `Accept` matrix as in the matrix above; with root install set to `INDENT_OUTPUT` the GraphQL body stays compact; with the root install deleted GraphQL responses are identical (only REST login breaks). `graphql-kotlin-ktor-server:10.2.1` depends on `ktor-serialization-jackson3`. Conclusion: graphql-kotlin's own route-level ContentNegotiation (Jackson 3) writes GraphQL bodies; root Jackson 2 owns REST. Removing the converter: `SubscriptionScopingTest` (5) and `WebSocketAuthTest` (3) green.

## Tasks & Acceptance

**Execution:**
- `bp_back/src/test/kotlin/com/bagplease/JacksonSerializationTest.kt` -- new Kotest spec pinning the matrix rows (GraphQL content-type/406/compact; REST key order) -- relocating or removing the root install must fail it (REST key order and 406 rows)
- `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt` -- delete `contentConverter` line and the now-unused import -- vestigial
- `bp_back/CLAUDE.md` -- add "Which Jackson writes what" rule: GraphQL HTTP/WS = graphql-kotlin's Jackson 3; REST = root Jackson 2; what moving the root install breaks
- `_bmad-output/implementation-artifacts/deferred-work.md` -- close the 7.12 Jackson entry in place with probe output and pointers to rule and test
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- reconcile 10-2 at close

**Acceptance Criteria:**
- Given the pin test, when the root `ContentNegotiation` is moved to a sub-route (throwaway), then the backend suite fails on it; restored, it passes.
- Given the converter removed, when the E2E gate runs, then live item check-off reaches a second member and the two md5s are unchanged.
- Given the story closes, then `git diff gradle/libs.versions.toml` is empty and no probe file remains.

## Verification

**Commands:**
- `gradle :bp_back:cleanTest :bp_back:test` -- expected: green; totals read from `bp_back/build/test-results/test/*.xml`
- `cd bp_front && npm run test:e2e` -- expected: all projects pass
- `git status --short` -- expected: no probe artifacts

## Review Triage Log

### 2026-10-20 — Review pass
- verdicts: 4 layers reported; grouped — medium 3, low 5
- findings:
  - `[medium]` `[patch]` graphql-ws frame claim stated as measured, no WS test — CLAUDE.md reworded as inferred; added a connection_ack test
  - `[medium]` `[patch]` errors-path body unpinned — added compact error-body test
  - `[medium]` `[patch]` probe output not verbatim in ledger — verbatim probe lines added
  - `[low]` `[defer]` pin does not distinguish Jackson 2 from 3 identity — documented as residual; revisit at Story 10.4
  - `[low]` `[reject]` md5 baselines differ from 7.12 — baselines embed per-run ids; before/after pair documented
  - `[low]` `[reject]` 406 row only fails via login break — spec edit out of scope; rule text accurate
  - `[low]` `[reject]` adminToken NPE / exact Content-Type / `Was:` format / epic-10-context rewrite — cosmetic or house style; recompile required by workflow

## Auto Run Result

Status: done

- Pinned which Jackson writes what: GraphQL HTTP = graphql-kotlin's Jackson 3 (route-level ContentNegotiation); REST = root Jackson 2. Removed vestigial `JacksonWebsocketContentConverter`; rule in `bp_back/CLAUDE.md`; 7.12 ledger entry closed.
- Files: `JacksonSerializationTest.kt` (new, 5 tests), `GQL.kt` (converter removed), `bp_back/CLAUDE.md`, `deferred-work.md`, `sprint-status.yaml`, `epic-10-context.md` (recompiled).
- Review: 3 patches applied, 1 deferred (Jackson identity not pinned), rejects recorded above.
- Follow-up review recommended: false.
- Verification: `gradle :bp_back:cleanTest :bp_back:test` -> 175 tests, 0 skipped/failures/errors (JUnit XML); pin test failed (148/173 failures) with root install moved; E2E 283 passed, 29 skipped (run before the review patches, which touched only tests and docs); md5 before/after matched.
- Residual: graphql-ws mapper inferred, not measured.
