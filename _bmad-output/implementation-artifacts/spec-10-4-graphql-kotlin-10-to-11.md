---
title: 'graphql-kotlin 10 -> 11'
type: 'chore'
created: '2026-10-20'
status: 'done'
baseline_revision: '6280263a6b0091ead789e4fd538ac9f0ee99465e'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
  - '{project-root}/bp_back/CLAUDE.md'
warnings: ['oversized']
deferred:
  - summary: >-
      SubscriptionScopingTest "9.3 category cascade" and "Point 2 takeWhile revocation" have subscription-liveness races (probe sent once; delay(200) with no liveness proof).
    evidence: |-
      9.3 failed once on the first 11.0.0 full run (SubscriptionScopingTest.kt:359, probesArrived null), then 4/4 isolated and 3/3 full runs green; Point 2 can pass vacuously if the subscription attaches after the trigger. Pre-existing test design; 10.2.1 flake-rate control not run. Ledger: deferred-work.md "code review of 10-4-graphql-kotlin-10-11".
    location: >-
      bp_back/src/test/kotlin/com/bagplease/SubscriptionScopingTest.kt:250
    severity: medium
  - summary: >-
      Root CLAUDE.md and mise docs say ./gradlew, but the wrapper script was deleted in 9127b88 (Epic 8).
    evidence: |-
      `ls gradlew*` at repo root finds nothing; builds run with mise's Gradle 9.8.1. Agent-context file fix, natural home Story 10.9.
    location: >-
      CLAUDE.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** The GraphQL server runs on graphql-kotlin 10.2.1 while 11.0.0 (stable, 2026-10-07) is out; the major moves graphql-java 25.0 -> 26.1 underneath it, which could change what clients see.

**Approach:** Capture the client-visible contract against the running stack, bump `graphql-kotlin` alone to 11.0.0, make only the `bp_back/` edits a captured compile/test error forces, then prove the contract byte-identical. If it cannot land under AR-E10-3, take the HOLD branch.

## Boundaries & Constraints

**Always:** graphql-kotlin is the only version that moves (target 11.0.0 — the latest stable, re-measured 2026-10-20; 11.0.0-alpha.* excluded); md5 before/after per captured body; `errors[0].message` keeps the prefix `Exception while fetching data (/saveItem) : `; `cleanTest test` totals from JUnit XML; full E2E gate on every Playwright project; `npm run generate` byte-check; docs naming the graphql-kotlin version updated in the same commit; sprint status reconciled at close.

**Never:** `force`/`strictly`, `-Xskip-metadata-version-check`, added `@Suppress`, Gradle `resolutionStrategy`, any other catalogue entry moving, hand-edited codegen, a capture script or probe left in the tree (scratch lives in `.tmp/<session>/`).

**HOLD branch:** if the bump fails under those rules, restore `gradle/libs.versions.toml` and every touched source to byte-identical (`git diff` empty), record the blocking error verbatim in a new `## Deferred from: Story 10.4` section of `deferred-work.md`, and close `done`.

## I/O & Edge-Case Matrix

Baseline captured at planning against the 10.2.1 stack on :2080 (admin token, fixed ids, so bodies are deterministic):

| Scenario | Input | Expected body / status (must not change) | md5 |
|---|---|---|---|
| failing `saveItem`, FORBIDDEN | admin, all ids `1111…1111` | `{"errors":[{"message":"Exception while fetching data (/saveItem) : Admin cannot access list resources",…,"extensions":{"code":"FORBIDDEN"}}]}` | `17f6d28ddd841d0ca539890430c7ab38` |
| failing `saveItem`, no code | `id`/`listId` `not-a-uuid` | prefixed `Invalid UUID string: not-a-uuid`, no `extensions` | `b70c78e214be5d8f04689f0caa184e36` |
| BAD_USER_INPUT | `deleteUser(id:"bad")` | `extensions.code` `BAD_USER_INPUT` | `2b2c8782ada4e76ae099097d022010f5` |
| NOT_FOUND | `deleteUser(id: 0000…0000)` | `NOT_FOUND` | `c28bb8f65924c8912de3b217f51f044e` |
| CONFLICT | `createUser("baseline104")` twice | `CONFLICT` | `a17afaf0b79b2281f10910cb874bec38` |
| validation error | `{ nope }` | `Validation error (FieldUndefined@[nope]) …`, `"extensions":{}` | `2ad38101f10e53dd9ddf5a648369d1c3` |
| GraphiQL | `GET /api/graphiql` with / without token | `200` / `401` | — |
| 10.2 discriminator | `Accept: application/xml` | `406 Not Acceptable` | — |

</intent-contract>

## Code Map

- `gradle/libs.versions.toml:6` -- `graphql-kotlin = "10.2.1"`; the only line that moves.
- `bp_back/build.gradle.kts:46` -- `implementation(libs.graphql.kotlin.ktor.server)`; sole consumer.
- `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt` -- `install(GraphQL)` (schema packages/queries/mutations/subscriptions, `server { contextFactory; subscriptions { contextFactory } }`), routes `graphQLPostRoute/graphQLSDLRoute/graphiQLRoute/graphQLSubscriptionsRoute`, `CustomGraphQLContextFactory : DefaultKtorGraphQLContextFactory`, `WsGraphQLContextFactory : KtorGraphQLSubscriptionContextFactory`. No schema hooks, no custom `DataFetcherExceptionHandler`.
- `bp_back/src/main/java/com/bagplease/plugins/GraphQL{Forbidden,NotFound,InvalidInput,Conflict}Exception.java` -- implement `graphql.GraphQLError` (`getLocations`, `getErrorType`, `getExtensions` -> `code`); graphql-java 26's JSpecify rollout may touch these signatures.
- Other graphql API surface: `graphql.schema.DataFetchingEnvironment` (7 files), `GraphQLContext`, `generator.scalars.ID`, `@GraphQLName`, `server.operations.{Query,Mutation,Subscription}`, `toGraphQLContext`. No `@Deprecated`/`@GraphQLDeprecated` anywhere in `src/main`.
- `bp_back/src/test/kotlin/com/bagplease/JacksonSerializationTest.kt` -- Story 10.2 pin (GraphQL content-type/406/compact/error body, REST key order, WS `connection_ack`); must stay green.
- `bp_front/src/lib/admin/adminErrors.ts` -- `RESOLVER_WRAPPER` strips the prefix; read-only.
- `AGENTS.md:67` -- "Jackson 3 arrives with graphql-kotlin 10" -> name 11 (re-check the Jackson 3 artifact in `runtimeClasspath`). `bp_back/CLAUDE.md` "Which Jackson writes what" says "Re-check before any … graphql-kotlin major" -> record the re-check. `architecture.md:727`, `docs/*` (9.2.0) are historical / owned by Story 10.8 -- not edited.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- ledger; Story 7.12 kotlin-reflect skew entry (re-check trigger is Ktor, not this story).
- Compatibility evidence (measured 2026-10-20): `graphql-kotlin-ktor-server-11.0.0.pom` floors `ktor-*-jvm 3.4.1`, `kotlin-stdlib/kotlin-reflect 2.3.0`, `ktor-serialization-jackson3-jvm 3.4.1` -- met by Ktor 3.6.0 / Kotlin 2.4.21; identical floors to 10.2.1. Release notes 11.0.0: graphql-java 26 (`graphql-kotlin-schema-generator` 25.0 -> 26.1), `@oneOf`, Federation 2.15, dataloader sync fixes -- none used here except graphql-java. graphql-java 26.0 breaking: query depth 100 / field count 100k validation limits; validation rule-filter predicate type; `DirectiveInfo` removed; code-built schemas validate deprecated-on-non-null; JSpecify nullability.
- Capture script (scratch, not committed): `.tmp/1de1d94c/capture.sh <outdir>` -- logs in as admin on :2080 and writes the matrix bodies + statuses with md5s; baseline in `.tmp/1de1d94c/probe/`.

## Tasks & Acceptance

**Execution:**
- `_bmad-output/implementation-artifacts/spec-10-4-graphql-kotlin-10-to-11.md` -- re-capture the baseline on a fresh `docker compose up --build -d` of HEAD before touching anything; record md5s.
- `gradle/libs.versions.toml` -- `graphql-kotlin = "11.0.0"`; record `runtimeClasspath` deltas (graphql-java, jackson3, kotlin-reflect).
- `bp_back/src/**` -- only edits a captured compile or test error forces; quote each error in the spec.
- `AGENTS.md`, `bp_back/CLAUDE.md` -- version line + Jackson re-check result.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- reconcile 10-4.
- On HOLD only: `deferred-work.md` -- `## Deferred from: Story 10.4` with the verbatim blocking error.

**Acceptance Criteria:**
- Given the bump and `./gradlew :bp_back:cleanTest :bp_back:test :bp_back:build`, when it runs, then it passes with totals read from `bp_back/build/test-results/test/*.xml` and `JacksonSerializationTest` green.
- Given the bumped stack rebuilt with `docker compose up --build -d`, when `capture.sh` runs, then every md5 in the matrix equals the pre-bump capture and GraphiQL / 406 statuses are unchanged.
- Given the bumped stack, when `npm run generate` runs with a fresh token, then `git status --short bp_front/src/__generated__/` is empty or the change is committed and explained.
- Given the bumped stack, when `npm run test:e2e` runs on every project, then it passes (live subscription and live mutation on desktop and 320px).
- Given the story closes, then `git diff --stat` touches no catalogue line except `graphql-kotlin`, and no capture artifact is tracked.

## Spec Change Log

- 2026-10-20 (implementation): the FORBIDDEN row's md5 was `f6543b1680e13cb2d365ec53ccdd06bc` in the planning table,
  but the planning probe files in `.tmp/1de1d94c/probe/` and the fresh pre-bump capture of HEAD both hash
  `saveItem-forbidden.json` to `17f6d28ddd841d0ca539890430c7ab38` (body text exactly as the Expected column). The
  table value was a transcription slip; the row now carries the measured hash. Every other row matched as planned.

## Implementation Record

**Baseline (pre-bump, fresh `docker compose up --build -d` of `6280263`, `capture.sh .tmp/1de1d94c/before`):**

```
2b2c8782ada4e76ae099097d022010f5  BAD_USER_INPUT.json
a17afaf0b79b2281f10910cb874bec38  CONFLICT.json
c28bb8f65924c8912de3b217f51f044e  NOT_FOUND.json
b70c78e214be5d8f04689f0caa184e36  saveItem-badid.json
17f6d28ddd841d0ca539890430c7ab38  saveItem-forbidden.json
2ad38101f10e53dd9ddf5a648369d1c3  validation.json
fad7f0bbd029dfa99d902aad9ae82779  accept-xml-status.txt      (HTTP/1.1 406 Not Acceptable)
e216f4b5fa1e845be11bd0eb9b35d4f9  graphiql-noauth-status.txt (401)
c1ba58b05f6245f221ad65391fa6690b  graphiql-status.txt        (200)
```

**After (11.0.0 stack rebuilt, `capture.sh .tmp/1de1d94c/after`):** `diff` of the two md5 lists is empty — all nine
identical. The image's `/app/lib` carries `graphql-kotlin-*-11.0.0.jar` and `graphql-java-26.1.jar`.

**`runtimeClasspath` delta (10.2.1 -> 11.0.0), full sorted-node diff:** `com.expediagroup:graphql-kotlin-*`
10.2.1 -> 11.0.0 (ktor-server, server, schema-generator, federation, dataloader, dataloader-instrumentation,
automatic-persisted-queries); `com.graphql-java:graphql-java` 25.0 -> 26.1;
`com.apollographql.federation:federation-graphql-java-support` 6.0.0 -> 7.0.0; `com.google.protobuf:protobuf-java`
3.25.5 -> 3.25.9; one `slf4j-api` request 2.0.16 -> 2.0.18 (still resolves 2.0.19). Unchanged: `java-dataloader`
6.0.0, Jackson 3 (`tools.jackson.*` 3.2.2), Jackson 2 (`jackson-databind` 2.22.2), `kotlin-reflect` 2.3.21 (same
request set `1.8.10/2.1.21/2.3.0 -> 2.3.21`). `ktor-serialization-jackson3:3.4.1 -> 3.6.0` is still requested by
`graphql-kotlin-ktor-server:11.0.0`.

**Source edits forced:** none. `./gradlew :bp_back:cleanTest :bp_back:test :bp_back:build` (run with mise's Gradle
9.8.1; the repo has no `gradlew` script) compiled with zero `w:`/`e:` lines — the `GraphQL*Exception` Java classes
and every `DataFetchingEnvironment` use compile unchanged against graphql-java 26.1.

**Backend tests (JUnit XML, `bp_back/build/test-results/test/*.xml`, 18 files):** 175 tests, 0 failures, 0 errors,
0 skipped; `JacksonSerializationTest` 5/5. **Flake observed:** the first full run on 11.0.0 failed exactly one test,
`SubscriptionScopingTest` "9.3 a category cascade emits ONE category DELETED event and NO item events", at
`SubscriptionScopingTest.kt:359` (`probesArrived shouldBe true` -> `Expected true but actual was null`). It then
passed 4/4 runs in isolation and 3/3 subsequent full-suite runs (two `cleanTest test`, one `cleanTest test build`).
Mechanism (read from the test, not measured): the probe mutations are posted immediately after the two `subscribe`
frames; graphql-ws sends no per-subscription ack and the service `SharedFlow` has no replay, so if a subscription has
not attached when its probe emits, the probe frame is lost and the 5 s wait times out. That race is in the test and
predates this story; a 10.2.1 control was not run, so "unchanged by graphql-java 26" is inferred, not measured.

**Codegen:** `npm run generate` with a fresh admin token -> `git status --short bp_front/src/__generated__/` empty.

**E2E (`npm run test:e2e`, production image on :2080):** 283 passed, 29 skipped, 0 failed, 0 flaky across all four
projects (`chromium` 153, `mobile` 153, `registration-toggle-chromium` 3, `registration-toggle-mobile` 3). The 29 skips
are the `test.skip(project.name !== 'mobile')` descriptor/320px gates in `narrow-viewport.spec.ts` — the same count as
Story 10.2.

**Docs:** `AGENTS.md` names graphql-kotlin 11 as the Jackson 3 source; `bp_back/CLAUDE.md` "Which Jackson writes what"
records the 11.0.0 re-check. Planning/historical docs naming 10.2.1 left as the spec directs.

## Review Triage Log

### 2026-10-20 — Review pass
- verdicts: 24 findings — high 0, medium 4, low 12, false 8, maybe-false 0
- findings:
  - `[low]` `[patch]` (edge) 10.2 ledger residual "re-check at Story 10.4" left dangling — appended the 10.4 re-check line to the 10.2 closure entry in `deferred-work.md`.
  - `[medium]` `[patch]` (edge) SubscriptionScopingTest flake recorded only in the spec — new `## Deferred from: code review of 10-4-graphql-kotlin-10-11` ledger section with verbatim failure and mechanism.
  - `[false]` `[reject]` (edge) `bp_back/CLAUDE.md` re-check line implies WS frames byte-identical — the line names only "GraphQL error bodies, `406` and GraphiQL statuses"; no WS claim.
  - `[low]` `[defer]` (edge) spec/CLAUDE.md commands use `./gradlew`, which does not exist — `gradlew` deleted in 9127b88 (Epic 8); pre-existing and an agent-context file; the spec half is a spec edit (reject).
  - `[medium]` `[patch]` (blind) flake not recorded durably — same group as the edge flake row; ledger entry added.
  - `[low]` `[defer]` (blind) `./gradlew` conflict — same group as edge gradlew row.
  - `[low]` `[reject]` (blind) capture script in scratch, verification not repeatable — the matrix records every input (queries, ids, headers); making it a committed test adds surface the intent does not ask for.
  - `[low]` `[reject]` (blind) matrix omits SDL / success bodies / WS frames — codegen from live introspection byte-identical covers the schema; E2E (283 passed) exercises success bodies and live subscriptions; extra capture not worth the surface.
  - `[false]` `[reject]` (blind) graphql-java 26 depth/field limits unchecked — every app query ran in E2E and the (deeper) codegen introspection query succeeded; neither tripped `MaxQueryDepthExceeded`.
  - `[low]` `[reject]` (blind) federation 7.0.0 / protobuf 3.25.9 not assessed — both were already on the 10.2.1 classpath (federation 6.0.0) as graphql-kotlin-server dependencies; excluding them would need `resolutionStrategy`, which the spec forbids.
  - `[low]` `[reject]` (blind) FORBIDDEN md5 replaced after the fact — provenance: `f6543b…` was the md5 of the first planning run whose body was `Invalid UUID string: c` (category not a UUID); the corrected probe body hashed `17f6d2…`, as did the independent before capture. Fix would be a spec edit.
  - `[low]` `[reject]` (blind) status-file md5s fragile — literal status codes are compared alongside; cosmetic.
  - `[false]` `[reject]` (blind) triage log empty — review was in progress; this entry fills it.
  - `[low]` `[reject]` (blind) AGENTS.md line omits jackson3 3.4.1->3.6.0 detail — detail lives in `bp_back/CLAUDE.md` re-check line (most specific file).
  - `[medium]` `[defer]` (verification-gap) Point 2 takeWhile test can pass vacuously (`delay(200)`, no liveness proof) — real, pre-existing test design unchanged by this diff; recorded in the 10.4 ledger section with the probe-reuse fix.
  - `[medium]` `[defer]` (verification-gap) 9.3 probe sent once, flake rerun away — same root cause as the Point 2 row's ledger entry; pre-existing; 10.2.1 flake-rate control not run.
  - `[low]` `[defer]` (verification-gap other) `./gradlew` absent — same group as edge gradlew row.
  - `[low]` `[reject]` (intent) 10.2 discrimination baseline is only 406 + test pass — `JacksonSerializationTest` pins content-type, compact body, error body, REST key order and `connection_ack`, and stayed 5/5.
  - `[false]` `[reject]` (intent) live subscription not evidenced — E2E 283 passed on chromium and mobile includes the live check-off subscription specs.
  - `[low]` `[defer]` (intent) subscription-server flake inferred not measured — same group as verification-gap 9.3 row.
  - `[false]` `[reject]` (intent) depth/field limits not checked — same refutation as the blind row.
  - `[false]` `[reject]` (intent) `ARCHITECTURE-SPINE.md:296` still says 10.2.1 — it is a dated snapshot ("Repo pins as of 2026-09-15; Epic 9 upgrades nothing"); Story 10.3 likewise left its Ktor row; kept per epic-10 docs rule.
  - `[false]` `[reject]` (intent) closure state `in-review` — set to `done` at finalize.
  - `[false]` `[reject]` (intent) `./gradlew` vs mise Gradle — duplicate of the gradlew group; no intent divergence.

## Verification

**Commands:**
- `./gradlew :bp_back:cleanTest :bp_back:test :bp_back:build` -- expected: success; JUnit XML totals 0 failures/errors
- `./gradlew :bp_back:dependencies --configuration runtimeClasspath | grep -E "graphql-java|graphql-kotlin|tools.jackson|kotlin-reflect"` -- expected: graphql-kotlin 11.0.0, graphql-java 26.x
- `docker compose up --build -d && bash .tmp/1de1d94c/capture.sh .tmp/1de1d94c/after` -- expected: md5s equal the before capture
- `cd bp_front && npm run generate && git status --short src/__generated__/` -- expected: empty
- `cd bp_front && npm run test:e2e` -- expected: all projects pass

## Auto Run Result

Status: done (LAND)

- **Change:** `graphql-kotlin` 10.2.1 -> 11.0.0 (graphql-java 25.0 -> 26.1); no `bp_back/src` edits were forced. Client-visible contract byte-identical.
- **Files:** `gradle/libs.versions.toml` (version line); `AGENTS.md` (Jackson 3 source names graphql-kotlin 11); `bp_back/CLAUDE.md` (11.0.0 Jackson re-check); `deferred-work.md` (10.2 residual re-check line + new 10.4 review section for the subscription-test races); `sprint-status.yaml` (10-4 done); this spec.
- **Review:** 24 findings — 2 patch entries applied (ledger: flake record, 10.2 residual closure; both medium/low docs), 2 deferred (subscription-liveness races, medium; missing `gradlew` vs docs, low), the rest rejected with reasons in the triage log.
- **Follow-up review recommended:** false — patched: 0 high, 1 medium, 1 low; both docs-only.
- **Verification (orchestrator, re-run after implementation):** `gradle :bp_back:cleanTest :bp_back:test :bp_back:build` -> JUnit XML 175 tests, 0 failures, 0 errors, 0 skipped; independent re-capture against the bumped stack -> all 9 md5s equal the pre-bump `before` capture; image `/app/lib` has `graphql-java-26.1.jar`, `graphql-kotlin-server-11.0.0.jar`; `npm run generate` -> `src/__generated__/` clean; `npm run test:e2e` -> 283 passed, 29 skipped, 0 failed. The review patch touched only `deferred-work.md`, so the code tree verified above is the one committed.
- **Residual risks:** the 9.3 subscription test flaked once on 11.0.0 and the 10.2.1 flake rate was never measured; the graphql-ws frame mapper is still inferred, not black-box measured; local DB holds a `baseline104` user created by the capture script.
