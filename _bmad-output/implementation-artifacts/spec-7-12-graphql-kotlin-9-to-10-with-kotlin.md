---
title: 'Story 7.12 — `graphql-kotlin` 9 → 10, with Kotlin'
type: 'chore'
created: '2026-08-16'
status: 'done'
baseline_revision: '6d02a8c'
final_revision: '711f071'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md'
warnings: [oversized]
# oversized: ~4.6k tokens, against the template's 900–1600 target. Three things carry the extra length
#   and none is padding. (1) This is the epic's highest-risk bump and `10.0.0` changed THREE things at
#   once (Kotlin 2.3.0, graphql-java 23.1 → 25.0, Jackson 2 → Jackson 3); each needs its own verification
#   or the story lands on "it compiled". (2) The Jackson-3 collision with this project's own Jackson-2
#   `ContentNegotiation` is a real, located, mechanism-level risk — recording where it lives is what
#   stops the next pass rediscovering it from a stack trace. (3) AC2's schema diff needs a decision rule
#   (semantic vs cosmetic) or an unattended run blocks on whitespace.
---

<intent-contract>

## Intent

**Problem:** `graphql-kotlin` is 9.3.0 while 10.2.1 is latest, and `kotlin` is 2.3.21 while 2.4.10 is latest —
deliberately excluded from Story 7.7's sweep (AC2 there) so the language moves *with* the library that may cap it.
`graphql-kotlin` 10.0.0 is the epic's highest-risk change: it owns schema generation, the subscription transport and
the auth wrapper, and it moved Kotlin to 2.3.0, graphql-java 23.1 → 25.0, **and Jackson 2 → Jackson 3** in one release.

**Approach:** One commit moving `graphql-kotlin` 9.3.0 → 10.2.1 and `kotlin` 2.3.21 → the newest stable that stays
green, plus only the `bp_back/` changes a captured error forces. Verify by four independent instruments, not by a
green compile: an SDL diff, a `npm run generate` output diff, the full backend suite, and the full Playwright suite.

## Boundaries & Constraints

**Always:**
- **Re-measure the registry in this pass.** `curl` `maven-metadata.xml` for `graphql-kotlin-ktor-server` and
  `kotlin-stdlib` and route from *that*, never from the numbers below. Planning measured (2026-08-16):
  `graphql-kotlin` latest `10.2.1`, Kotlin newest stable `2.4.10` (`2.4.20-RC` is a prerelease and never a candidate).
- **The compatibility source is cited, not assumed (AC1).** `graphql-kotlin-ktor-server-10.2.1.pom` declares
  `kotlin-stdlib`/`kotlin-reflect` **2.3.0** and `graphql-java` **25.0**; release notes for `10.0.0` say
  "BREAKING CHANGE: Upgrade Kotlin to v2.3.0". It declares **no upper bound** on Kotlin, so the ceiling comes from
  this project's own build, not from the library. Quote the POM lines in the record.
- **Kotlin ladder, in order: `2.4.10` → `2.4.0` → hold at `2.3.21`.** Two rungs, then hold. Whichever rung is green
  is the answer; record the rung and the symptom that rejected each earlier one.
- **Confirm the serialization plugin moves in lockstep** by reading the resolved plugin version, not by reading
  `version.ref = "kotlin"` in the catalog.
- Capture **before and after**: the SDL, the raw `errors[0].message` of a failing mutation, the resolved
  `runtimeClasspath`, and the `src/__generated__/` tree. Every gate measured in this pass; no number quoted.

**Block If:**
- The SDL diff shows a **semantic** difference — a type, field, argument, directive or nullability added, removed or
  renamed. (A purely cosmetic difference — ordering, whitespace, built-in directive printing — is recorded verbatim
  and the story proceeds; `npm run generate` is the sharper instrument and it runs either way.)
- Making the bump green requires changing the Jackson **2** `ContentNegotiation` that serves `/api/auth/*`
  (`Routing.kt:14-16`) — moving the auth REST surface to Jackson 3 is a product decision, not an upgrade detail.
- A fix is needed outside `gradle/libs.versions.toml`, `bp_back/build.gradle.kts`, `bp_back/.../plugins/GQL.kt` and
  `bp_back/.../plugins/Routing.kt` — AR-E7-0 keeps the unfreeze scoped, and a backend need outside the named files
  stops the story.

**Never:**
- No `-Xskip-metadata-version-check`, no `@Suppress` added to make a compile pass, no Gradle `force`/`strictly`
  resolution rule, no weakened or edited test assertion, no changed expected value. A bump that cannot be made green
  is **reverted and recorded** (S-AC3) — and still closes `done`.
- No GraphQL schema change, no product behaviour change, no new endpoint.
- No other catalog version moves (Ktor, Kotest, Arrow, MongoDB, Logback, Testcontainers, bcrypt, Gradle wrapper).
  **One conditional exception:** an explicit `ktor-serialization-jackson3` entry at `version.ref = "ktor"` — added
  *only if* the measured resolution shows that module landing below the project's Ktor `3.5.2` (10.2.1's POM asks for
  `3.4.1`, and `3.5.2` of that module exists).
- No `bp_front/` change except a committed `src/__generated__/` regeneration, and only if its output actually moves.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| GraphQL query over HTTP | `POST /api/graphql` with a valid Bearer token | `200` with `data` populated, `errors` absent; body shape byte-comparable to the pre-bump capture | No error expected |
| Resolver throws | `saveItem` with a category not on the list, valid token | `200`, `data.saveItem: null`, `errors[0].message` still prefixed **`Exception while fetching data (/saveItem) : `** | The prefix is the contract `bp_front/src/lib/admin/adminErrors.ts:7` strips — a changed prefix silently ships the wrapper to users |
| Typed GraphQL error | a `GraphQLForbiddenException` path (non-member list read) | `errors[0].extensions.code == "FORBIDDEN"` | `isForbiddenError` drives the `/lists` graceful redirect; losing the code breaks it silently |
| Subscription | `connection_init` carrying `Authorization: Bearer <valid>` then a mutation on the list | the `SAVED`/`DELETED` event arrives on the socket | Bad/absent token → socket closed with **4401**, unchanged |
| Auth REST | `POST /api/auth/login` | `200` with `accessToken`, `username`, `role`; `Set-Cookie: refresh_token=…; HttpOnly` | Served by the project's **Jackson 2** converter, which must survive graphql-kotlin's Jackson 3 arriving on the classpath |
| Readiness | `GET /api/graphiql` in a browser | the playground page loads | The project's only backend-readiness check (AC3) |

</intent-contract>

## Code Map

All facts measured 2026-08-16 on a clean tree at `6d02a8c` (branch `epic7-maintenance`).

**Files this story may change:**
- `gradle/libs.versions.toml` — `:2` `kotlin = "2.3.21"` → the winning ladder rung; `:6`
  `graphql-kotlin = "9.3.0"` → `"10.2.1"`. `[plugins]` `kotlin-jvm` and `kotlin-serialization` both already carry
  `version.ref = "kotlin"` (`:47-48`) and therefore move automatically — **confirm, don't assume** (AC1).
  A conditional `ktor-serialization-jackson3` library entry only under the rule above.
- `bp_back/build.gradle.kts` — only if a captured error forces it. `jvmToolchain(25)` (`:17`) does **not** move (AC4).
- `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt` — only if a captured error forces it. The API it uses was
  verified present and signature-compatible in the 10.2.1 jars (see Design Notes §1); the expectation is *no edit*.
- `bp_back/src/main/kotlin/com/bagplease/plugins/Routing.kt` — see the Jackson Block If. Expectation: *no edit*.
- `bp_front/src/__generated__/` — only if `npm run generate` output actually moves (AC2).
- `_bmad-output/implementation-artifacts/deferred-work.md` — a `## Deferred from: Story 7.12 …` section **only if
  this pass produces debt**. Insertion point is **line 1175**, i.e. after the Story 7.11 section (1102–1174) and
  before `## Deferred from: code review of 7-10-typescript-6-to-7`. Story sections run ascending from line 210;
  code-review sections start at 1175 and are a separate run. Re-measure before editing.
- `_bmad-output/project-context.md` — Technology Stack only: the `graphql-kotlin`, `kotlin`, `graphql-java` and
  Jackson numbers, and the **split-Kotlin-runtime bullet** (`:20-24`), which this story is expected to *resolve* —
  say so explicitly either way. New debt goes to the ledger, not here (NFR-E7-1). Maintain the `_Last Updated` chain
  and adjudicate `rule_count` (currently **95**).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `:122`
  `7-12-graphql-kotlin-9-to-10-with-kotlin` `backlog` → `done`, `last_updated` refreshed.

**Read-only — the verification targets:**
- `bp_back/.../plugins/GQL.kt:92-131` — the `install(GraphQL) { schema { … }; server { … } }` DSL and
  `install(WebSockets) { contentConverter = JacksonWebsocketContentConverter() }` (Jackson **2**).
- `bp_back/.../plugins/GQL.kt:135-143` — `graphQLPostRoute()` / `graphQLSDLRoute()` / `graphiQLRoute()` inside
  `authenticate(authMethod)`, and `graphQLSubscriptionsRoute()` outside it.
- `bp_back/src/main/java/com/bagplease/plugins/GraphQL{Forbidden,Conflict,NotFound,InvalidInput}Exception.java` —
  four **Java** classes implementing graphql-java's `GraphQLError`. Verified: the interface is identical between
  23.1 and 25.0, so these compile — but they are the `extensions.code` source and belong in the after-check.
- `bp_front/src/lib/admin/adminErrors.ts:7` — `RESOLVER_WRAPPER`, the regex over graphql-java's message format.
- `bp_back/src/test/…` — 15 Kotest classes plus `utils/TestContainers.kt` (suite size was **115 after Story 7.6**; that figure is dated, so
  re-measure it in the baseline rather than carrying it forward). `SubscriptionScopingTest` and `WebSocketAuthTest`
  are what cover the subscription transport and the `4401` close, `ListAuthorizationTest` the auth wrapper.

## Tasks & Acceptance

**Execution:**
- [x] **Baseline, before anything moves.** Confirm `git status --short` clean on `epic7-maintenance`. Create
      `.tmp/a9b13d21-f9c5-476f-863b-3c09a44cb89e/`. Capture verbatim: `./gradlew :bp_back:dependencies
      --configuration runtimeClasspath` (keep the whole tree — it is the split-runtime and Jackson evidence);
      `./gradlew :bp_back:cleanTest :bp_back:test` with the totals read from
      `bp_back/build/test-results/test/TEST-*.xml`, **never from the console**. Then `docker compose up -d --build`,
      mint an admin token, and capture `GET /api/sdl` → `sdl-before.graphql`, one failing-mutation response body
      → `error-before.json`, one `FORBIDDEN` response → `forbidden-before.json`, and `GET /api/graphiql` status.
      Finally the full `npm run test:e2e` at `retries: 0` plus
      `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`. **If the baseline E2E is red,
      re-run it once** (the size-driven `createUserViaUi` defect is filed); if still red for a different reason, HALT.
- [x] **Re-measure the registry and route.** Record `graphql-kotlin-ktor-server` and `kotlin-stdlib`
      `maven-metadata.xml` (`<release>` and the tail), and the chosen `graphql-kotlin` POM's `kotlin-stdlib`,
      `kotlin-reflect`, `graphql-java` and `ktor-serialization-jackson3` lines. State the Kotlin ceiling and cite it.
- [x] `gradle/libs.versions.toml` — move both versions, top rung of the ladder first. Then
      `./gradlew :bp_back:dependencies --configuration runtimeClasspath` again and **diff against the baseline**.
      Assert explicitly: what `kotlin-stdlib` and `kotlin-reflect` resolve to (the split runtime should heal),
      `graphql-java` 23.1 → 25.0, that Jackson 2 **and** Jackson 3 are both present and at what versions, and what
      `ktor-serialization-jackson3` resolved to — if below the project's Ktor, add the catalog entry and re-measure.
- [x] **Compile and the backend suite.** `./gradlew :bp_back:cleanTest :bp_back:test`. Read totals from the JUnit
      XML. On a compile error or a red test, capture it verbatim, then walk the ladder; if no rung is green, revert
      to `9.3.0`/`2.3.21`, record under S-AC3, and close `done` — do not work around it.
- [x] **AC2 — the schema is compared, not trusted.** Rebuild the stack, capture `sdl-after.graphql`, and
      `diff -u sdl-before.graphql sdl-after.graphql`. Quote the diff verbatim even when empty. Then run
      `npm run generate` with a fresh `CODEGEN_TOKEN` and `git status --short bp_front/src/__generated__/`. If the
      output moved, commit it and say what moved; if it is byte-identical, **state that explicitly** rather than
      leaving it inferred. A semantic SDL difference is the Block If.
- [x] **AC3 — the error-shape contract, which no existing test can see.** Re-capture the failing-mutation and
      `FORBIDDEN` responses and diff them against the baseline. Assert the prefix
      `Exception while fetching data (/saveItem) : ` and `extensions.code == "FORBIDDEN"` are **byte-identical**.
      This check exists because the suite cannot supply it: `sharing.spec.ts:109` uses `toContainText`, which is a
      substring match and would still pass with the wrapper left un-stripped. Do not substitute the E2E run for it.
- [x] **AC3 — the whole GraphQL surface.** Full `npm run test:e2e` at `retries: 0` against the production image,
      with the per-project split re-measured; the standing invariant is **exactly 1** test in each
      `registration-toggle-*` project and the total alone proves nothing. Then load `/api/graphiql` in a real browser
      and confirm the playground renders (not merely a `200`).
- [x] **AC4 — the toolchain and the shipped image.** `docker compose build bp_back` exit 0, proving
      `gradle:9.6.1-jdk25` still resolves the toolchain and the Kotlin/graphql-kotlin pair builds in the image that
      ships. Record the Kotlin compiler version the build logs report.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — insert a Story 7.12 section at line 1175 **only if
      this pass produced debt**. If it produced none, say so explicitly in the record. Verify the three regions
      (1–1174, the insertion, 1175–end) are otherwise byte-unchanged.
- [x] `_bmad-output/project-context.md` — record the new versions, adjudicate the split-Kotlin-runtime bullet, note
      the Jackson 2 + Jackson 3 coexistence if it lands, prepend a Story 7.12 entry to the `_Last Updated` chain and
      adjudicate `rule_count` from 95.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-12-…: done` with the measured evidence,
      `last_updated` refreshed. Do not touch other stories' open `action_items`.
- [x] **Commit alone.** One commit. `git show --stat` must show `gradle/libs.versions.toml`, any `bp_back/` file a
      captured error forced, and `bp_front/src/__generated__/` only if codegen actually moved. Nothing else.

**Acceptance Criteria:**
- Given AC1, when the story closes, then `graphql-kotlin` is at the latest 10.x measured **in this pass**, `kotlin`
  is at the highest ladder rung that is green, the record cites `graphql-kotlin-ktor-server-<v>.pom`'s
  `kotlin-stdlib`/`kotlin-reflect` lines as the compatibility source, and the resolved Kotlin serialization plugin
  version is quoted from the build — not inferred from `version.ref`.
- Given AC2, when the story closes, then the record contains the verbatim `diff -u` of the SDL captured before and
  after from the running stack, plus the `git status` of `bp_front/src/__generated__/` after a `npm run generate`
  run in this pass, with "byte-identical" stated outright when that is the result.
- Given AC3, when the story closes, then the record shows the full backend suite totals read from the JUnit XML, the
  full four-project Playwright run at `retries: 0` with its split, a real-browser `/api/graphiql` load, **and** the
  before/after diff of the raw `errors[0].message` and `extensions.code` — the last named as the check the suite
  cannot make, with `toContainText`'s substring semantics given as the reason.
- Given AC4, when the story closes, then `docker compose build bp_back` is recorded exit 0 and `jvmToolchain(25)` is
  unchanged in `bp_back/build.gradle.kts`.
- Given S-AC4, when the final diff is reviewed, then it touches only the catalog, any `bp_back/` file a captured
  error forced, the regenerated codegen output, and the paperwork files — and contains no `@Suppress`, no compiler
  flag added, no resolution rule, and no edited test expectation.
- Given S-AC3, when no ladder rung makes the pair green, then the tree is reverted to `9.3.0`/`2.3.21`, the version
  attempted and the verbatim blocking symptom are recorded in `deferred-work.md` — not `project-context.md` — and
  the story still closes `done`.

## Spec Change Log

## Review Triage Log

### 2026-08-16 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 0, medium 4, low 3)
- defer: 11: (high 1, medium 6, low 4)
- reject: 5
- addressed_findings:
  - `[medium]` `[patch]` `sprint-status.yaml:38`'s `last_updated` annotation still narrated Story 7.11 while the task
    claiming it was refreshed was checked off — the date coincidentally validated because both stories landed on
    2026-08-16. Rewritten to Story 7.12 with the measured evidence.
  - `[medium]` `[patch]` `project-context.md`'s Manual Testing readiness bullet still told agents that
    "`/api/graphiql` loading is the manual readiness check" while the same file's `_Last Updated` block, written in the
    same pass, recorded that it returns **401** to a plain browser navigation. Bullet corrected to the token-bearing
    `curl` form plus an explicit "do not read that 401 as the backend being down".
  - `[medium]` `[patch]` The rules file asserted as established fact that `GQL.kt:130`'s Jackson 2
    `JacksonWebsocketContentConverter()` "is what … uses for WebSocket frames", while the ledger written in the same
    pass recorded it as **possibly vestigial**. The rules file now carries the uncertainty explicitly.
  - `[medium]` `[patch]` The `kotlin-reflect` 2.3.21 / compiler 2.4.10 skew was filed as debt without any argument
    about whether it is dangerous. Refuted with evidence already in hand and now recorded in both the record and the
    rules file: compiled GQL classes carry metadata `mv=[2,4,0]`, the shipped image carries
    `kotlin-reflect-2.3.21.jar` beside `kotlin-stdlib-2.4.10.jar`, and graphql-kotlin's schema generation is entirely
    reflection over those classes — `install(GraphQL)` would throw at boot otherwise, and the 120-test E2E ran against
    that image.
  - `[low]` `[patch]` The new absolute "no `kotlin` bump can **ever** close the skew" was withdrawn, and the omitted
    third remedy (`implementation(kotlin("reflect"))`, which KGP version-aligns to the compiler) added — in the record,
    the ledger and the rules file. Also noted that the spec's Never clause names `force`/`strictly` only, so extending
    it to `constraints { }` was the record's reading rather than the spec's text.
  - `[low]` `[patch]` The Jackson-coexistence directive ("must not be unified") carried no re-check trigger, unlike
    every comparable rule in that file. One added: any Ktor or graphql-kotlin bump, or the day
    `ktor-serialization-jackson` stops being a direct dependency.
  - `[low]` `[patch]` `rule_count` moved 95 → 96 while three new imperative directives were added, and the counter's
    own definition is an open ledger item. Adjudicated to **98** with the arithmetic stated inline. AC4's
    compiler-version citation was also corrected from a host-side jar name to the 2.4-only diagnostic the image build
    itself emitted.

## Design Notes

### 1 — The API surface was verified before the story, so a compile error means something else

Every `com.expediagroup.*` symbol the backend imports was confirmed present in the 10.2.1 jars, and the two
overridden signatures still match: `DefaultKtorGraphQLContextFactory.generateContext(ApplicationRequest, Continuation)`
and `KtorGraphQLSubscriptionContextFactory` extending
`GraphQLSubscriptionContextFactory<WebSocketServerSession>`. `GraphQLConfiguration` still exposes
`schema { packages/queries/mutations/subscriptions }` and `server { contextFactory; subscriptions { contextFactory } }`.
`graphQLPostRoute` / `graphQLSDLRoute` / `graphiQLRoute` / `graphQLSubscriptionsRoute` all still exist with
defaulted parameters, and their default endpoint strings are still `graphql` / `sdl` / `graphiql` / `subscriptions`
— so with `rootPath: "api"` the URLs do not move, and `/api/sdl` still sits inside `authenticate(authMethod)` and
needs a Bearer token to capture. So `GQL.kt` is expected to compile untouched — and if it does not, the cause is the
Kotlin compiler bump or Jackson, not a removed API. Do not start by rewriting `GQL.kt`.

### 2 — Jackson 3 is the real risk, and here is exactly where it lives

`graphql-kotlin` 10 depends on `ktor-serialization-jackson3` and serializes GraphQL responses with a
`tools.jackson.databind.json.JsonMapper`. Decompiled, `graphQLPostRoute` calls `pluginOrNull(ContentNegotiation)` on
its **Route** and installs `io.ktor.serialization.jackson3.jackson()` only when that returns null. This project
installs `ContentNegotiation { jackson() }` — Jackson **2** — inside `routing { }` (`Routing.kt:14-16`), i.e. on the
*root* route, one level above. Whether the child route sees it decides which mapper serializes `data`/`errors`.
Both packages coexist by design (`com.fasterxml.jackson` 2.22.1 vs `tools.jackson` 3.0.3), so this will not fail at
class-load; it will surface, if at all, as a **changed JSON body** — which is precisely why the before/after response
captures are a task and not a nicety. The same split applies to `install(WebSockets) { contentConverter =
JacksonWebsocketContentConverter() }`: graphql-kotlin's subscription server carries its own Jackson 3
`ObjectMapper`, so that converter may already be vestigial for GraphQL frames. Note it; do not delete it — that is
out of scope.

### 3 — The graphql-java wrapper was pre-measured, so the after-check is a confirmation, not a discovery

`bp_front`'s `RESOLVER_WRAPPER` regex depends on graphql-java's message format, and **nothing on either side tests
it**. Decompiled from both jars, `graphql.ExceptionWhileDataFetching`'s format string is byte-identical between
23.1 and 25.0: `Exception while fetching data (%s) : %s`. `GraphQLError`'s interface is also identical between the
two, so the four Java exception classes compile unchanged. That de-risks the contract *before* the bump — but the
after-check still runs, because the format string is only one of the paths that could reach `errors[0].message`
(graphql-kotlin's own error handling sits above it).

### 4 — What the Kotlin bump is expected to fix, and what it might break

`runtimeClasspath` today carries `kotlin-stdlib 2.4.0` (dragged up by `arrow-core` 2.2.3) against
`kotlin-reflect 2.3.21` — the split runtime filed in `project-context.md:20-24`. Moving the compiler to 2.4.x should
pull both to the same number and close it; say so with the measured diff rather than claiming it. The bump's own risk
is the serialization compiler plugin against the resolved `kotlinx-serialization-core` (today `1.11.0`), which is
what every `@Serializable` Mongo model compiles through — a mismatch there fails the build loudly and early, which is
why the backend compile runs before anything else.

## Verification

**Commands:**
- `./gradlew :bp_back:dependencies --configuration runtimeClasspath` — expected: `graphql-java` 25.0,
  `graphql-kotlin-*` at the new version, `kotlin-stdlib` and `kotlin-reflect` at the same version, Jackson 2 and 3
  both present, `ktor-serialization-jackson3` not below the project's Ktor.
- `./gradlew :bp_back:cleanTest :bp_back:test` — expected: exit 0; totals read from
  `bp_back/build/test-results/test/TEST-*.xml`, at or above the 115 measured after Story 7.6 (re-measure, never quote).
- `diff -u .tmp/<session>/sdl-before.graphql .tmp/<session>/sdl-after.graphql` — expected: empty, or cosmetic-only
  and quoted in full.
- `npm run generate` (from `bp_front/`, stack on `:2080`, fresh `CODEGEN_TOKEN`) then
  `git status --short bp_front/src/__generated__/` — expected: empty, or a committed change described in the record.
- `docker compose up -d --build && npm run test:e2e` — expected: exit 0 at `retries: 0`, split re-measured with
  exactly 1 test in each `registration-toggle-*` project.
- `docker compose build bp_back` — expected: exit 0 under `gradle:9.6.1-jdk25`.

**Manual checks (if no CLI):**
- `http://localhost:2080/api/graphiql` in a real browser — the playground UI renders and can run a query against the
  authenticated endpoint; a bare `200` is not sufficient evidence.
- The failing-mutation and `FORBIDDEN` response bodies captured before and after — `errors[0].message` still carries
  the `Exception while fetching data (/field) : ` prefix and `extensions.code` is still `FORBIDDEN`.

## Implementation Record

**Status: implemented (LAND).** `graphql-kotlin` 9.3.0 → **10.2.1** and `kotlin` 2.3.21 → **2.4.10** — the *top*
ladder rung, green on the first attempt — in one commit, on `epic7-maintenance`. **No `bp_back/` source file changed,
no `bp_front/` file changed.** The commit is `gradle/libs.versions.toml` and nothing else. Not pushed, no PR.
Every figure below was produced by a command run in this pass on 2026-08-16; nothing is carried from the spec's
planning numbers, from the ledger, or from memory.

### 1 — Baseline, before anything moved

Tree clean at `6d02a8c` apart from this untracked spec:

```
$ git status --short
?? _bmad-output/implementation-artifacts/spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md
$ git rev-parse --abbrev-ref HEAD
epic7-maintenance
$ git rev-parse HEAD
6d02a8cb8a8c01d947a261d72affc46c97d734a0
$ java -version
openjdk version "25.0.3" 2026-04-21 LTS
OpenJDK Runtime Environment Temurin-25.0.3+9 (build 25.0.3+9-LTS)
$ docker --version
Docker version 29.7.2, build a7dcaa6fdb
```

Scratch directory `.tmp/a9b13d21-f9c5-476f-863b-3c09a44cb89e/` created; every artifact named below lives there.

**Resolved `runtimeClasspath` (the split-runtime and Jackson evidence).**
`./gradlew :bp_back:dependencies --configuration runtimeClasspath` → exit 0, 505 lines, saved as `deps-before.txt`.
Flattened to 153 distinct `group:artifact:resolvedVersion` coordinates (`flat-before.txt`). The modules this story is
about:

```
com.expediagroup:graphql-kotlin-ktor-server:9.3.0        (and 6 sibling graphql-kotlin modules, all 9.3.0)
com.graphql-java:graphql-java:23.1
com.graphql-java:java-dataloader:4.0.0
com.fasterxml.jackson.core:jackson-databind:2.22.1       (Jackson 2 — the only Jackson on the classpath)
org.jetbrains.kotlin:kotlin-stdlib:2.4.0
org.jetbrains.kotlin:kotlin-reflect:2.3.21               ← the split runtime, filed by Story 7.7
org.jetbrains.kotlinx:kotlinx-serialization-core:1.11.0
io.ktor:ktor-serialization-jackson:3.5.2                 (no `-jackson3` module present)
```

**Backend suite.** `./gradlew :bp_back:cleanTest :bp_back:test` → `TEST_EXIT=0`. Totals read from
`bp_back/build/test-results/test/TEST-*.xml`, never from the console:

```
com.bagplease.ApplicationTest 1 0 0 0
com.bagplease.AuthApiTest 3 0 0 0
com.bagplease.ItemApiTest 5 0 0 0
com.bagplease.ItemCategoryStorageTest 2 0 0 0
com.bagplease.ItemLifecycleTest 25 0 0 0
com.bagplease.ListAuthorizationTest 4 0 0 0
com.bagplease.ListServiceTest 10 0 0 0
com.bagplease.ListSharingTest 18 0 0 0
com.bagplease.MigrationTest 5 0 0 0
com.bagplease.SubscriptionScopingTest 4 0 0 0
com.bagplease.WebSocketAuthTest 3 0 0 0
com.bagplease.features.admin.AdminUserManagementTest 7 0 0 0
com.bagplease.features.admin.ApplicationConfigTest 7 0 0 0
com.bagplease.features.auth.LoginTokenTest 14 0 0 0
com.bagplease.features.auth.UserRegistrationTest 7 0 0 0
TOTAL tests=115 failures=0 errors=0 skipped=0 classes=15
```

**115 re-measured, not quoted** — it happens to equal the dated "115 after Story 7.6" figure, but it was read from the
XML in this pass. Note for §7: `> Task :bp_back:compileKotlin UP-TO-DATE` in this run, which is why the baseline log
carries **no** compiler output and why the warning question in §8 needed its own control.

**Stack.** `docker compose up -d --build` → `COMPOSE_EXIT=0`, all three containers up, mongo healthy.

**SDL.** `/api/sdl` sits inside `authenticate(authMethod)`, so it needs a Bearer token:

```
$ curl -s -H "Authorization: Bearer $T" http://localhost:2080/api/sdl -o sdl-before.graphql -w "SDL_HTTP=%{http_code}\n"
SDL_HTTP=200
$ wc -l sdl-before.graphql   → 170
$ md5sum sdl-before.graphql  → 24f694bc89063ba52c753fc7e1b4615c
```

**Error shapes.** Captured through `probe.py`, which registers a fixed probe user (`gk12probe`) and creates a list, a
category and an item with **fixed UUIDs**, persisting the ids to `fixtures.json` so the *after* pass reuses the same
list id and the messages are byte-comparable rather than merely similar:

```
$ cat error-before.json
{"errors":[{"message":"Exception while fetching data (/saveItem) : Category 99999999-9999-4999-8999-999999999999 does not belong to list c035f3d6-4a95-442d-8571-1af6552dd2bf","locations":[{"line":1,"column":26}],"path":["saveItem"]}]}

$ cat forbidden-before.json
{"errors":[{"message":"Exception while fetching data (/lists) : Admin cannot access list resources","locations":[{"line":1,"column":9}],"path":["lists"],"extensions":{"code":"FORBIDDEN"}}]}
```

Two facts recorded because the spec's I/O matrix predicted otherwise: the failing-mutation body carries **no `data`
key at all** (not `"data":{"saveItem":null}`), and the `FORBIDDEN` case was reached via the **`AdminBlocked`** branch
(`ListApi.kt:147`) rather than a non-member read — an admin token on `query { lists }`, which needs no second actor
and produces the same `extensions.code`.

**Readiness.** `GET /api/graphiql` → **401 without a token**, **200 with one** (2511 bytes). The endpoint is inside
`authenticate(authMethod)` alongside the other GraphQL routes, so a plain browser navigation cannot reach it — see §6
for how the real-browser check was actually performed, and §8 for the ledger entry this produced.

**E2E split and run**, measured with the `--list` command and *not* `--list --project=…`:

```
$ npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c
     59 chromium
     59 mobile
      1 registration-toggle-chromium
      1 registration-toggle-mobile
Total: 120 tests in 10 files

$ npm run test:e2e
  120 passed (44.4s)
E2E_EXIT=0
```

`playwright.config.ts:25` is `retries: process.env.CI ? 2 : 0` and `CI` is unset, so this is a `retries: 0` run.
**Green first try** — the filed size-driven `createUserViaUi` defect did not fire, so the spec's "re-run once" branch
was never entered and its HALT branch never armed.

**Real-browser GraphiQL, baseline.** Recorded so the after-check in §6 is a comparison rather than a bare assertion.
Screenshot `graphiql-before.png`; the playground rendered (Documentation Explorer button, Query Editor region, Result
Window). One measurement worth carrying forward, because it cost a wasted attempt: driving this with
`context.setExtraHTTPHeaders({Authorization: …})` **fails** — the header is attached to the jsdelivr CDN requests too
and Chromium rejects the preflight:

```
[ERROR] Access to script at 'https://cdn.jsdelivr.net/npm/graphiql@3.0.6/graphiql.min.js' from origin
'http://localhost:2080' has been blocked by CORS policy: Request header field authorization is not allowed by
Access-Control-Allow-Headers in preflight response.
[ERROR] ReferenceError: GraphiQL is not defined
```

The page then sits on `Loading...` — a false negative that would read exactly like a broken playground. The working
form is a `context.route("http://localhost:2080/api/**")` interceptor that adds the header **only** to same-origin
API requests.

### 2 — Registry re-measurement and the routing decision

Measured in this pass from `repo1.maven.org`, 2026-08-16. Nothing below is the spec's planning number.

```
$ curl -s .../com/expediagroup/graphql-kotlin-ktor-server/maven-metadata.xml
    <latest>10.2.1</latest>
    <release>10.2.1</release>
    <lastUpdated>20260810182948</lastUpdated>
--- tail of <version> list ---
9.3.0
10.0.0-alpha.1 … 10.0.0-alpha.4
10.0.0  10.0.1  10.1.0  10.1.1  10.1.2  10.2.0  10.2.1

$ curl -s .../org/jetbrains/kotlin/kotlin-stdlib/maven-metadata.xml
    <latest>2.4.20-RC</latest>
    <release>2.4.20-RC</release>
    <lastUpdated>20260812083020</lastUpdated>
--- tail of <version> list ---
2.3.21  2.4.0-Beta1  2.4.0-Beta2  2.4.0-RC  2.4.0-RC2  2.4.0
2.4.10-RC  2.4.10-RC2  2.4.10  2.4.20-Beta1  2.4.20-Beta2  2.4.20-RC
```

`graphql-kotlin` latest stable = **10.2.1**. Kotlin's `<release>` is `2.4.20-RC`, which is a **prerelease and never a
candidate**; the newest *stable* is **2.4.10**. Both match the spec's planning figures, but they were re-derived here.

**The compatibility source, quoted (AC1).** `graphql-kotlin-ktor-server-10.2.1.pom`, fetched in this pass:

```xml
    <dependency>
      <groupId>org.jetbrains.kotlin</groupId>
      <artifactId>kotlin-stdlib</artifactId>
      <version>2.3.0</version>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.jetbrains.kotlin</groupId>
      <artifactId>kotlin-reflect</artifactId>
      <version>2.3.0</version>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>io.ktor</groupId>
      <artifactId>ktor-serialization-jackson3-jvm</artifactId>
      <version>3.4.1</version>
      <scope>compile</scope>
    </dependency>
```

`graphql-java` is not in that POM; it arrives via the schema generator —
`graphql-kotlin-schema-generator-10.2.1.pom` declares `<artifactId>graphql-java</artifactId> <version>25.0</version>`.

The three ranges are all **exact, lower-bound** declarations with **no upper bound on Kotlin**, so the library imposes
no ceiling; the ceiling can only come from this project's own build. Corroborated by the 10.0.0 release notes, which
name all three simultaneous moves:

```
* BREAKING CHANGE: Upgrade Kotlin to v2.3.0, graphql-java to v24.3   (PR #2147)
* BREAKING CHANGE: Upgrade to Jackson 3                              (PR #2162)
* feat: update to graphql-java 25                                    (PR #2170)
* feat(ktor-server): skip internal ContentNegotiation install when already configured  (PR #2174)
```

That last line is the mechanism the spec's Design Note §2 describes, named by upstream.

**Decision: LAND at `graphql-kotlin 10.2.1` + `kotlin 2.4.10`.** Reason: 10.2.1 is the measured latest stable 10.x;
2.4.10 is the measured newest stable Kotlin and the **top rung** of the ladder; the library declares no Kotlin upper
bound, so the top rung is admissible on the library's own terms and only this project's build could reject it. It did
not — see §4. **The ladder was never walked past rung 1**: `2.4.0` and the `2.3.21` hold were never attempted, because
`2.4.10` was green. No rung was rejected, so there is no rejection symptom to record.

`ktor-serialization-jackson3-jvm` **3.5.2 exists** on Central (`<release>3.5.2</release>`, tail
`3.4.1 3.4.2 3.4.3 3.5.0 3.5.1 3.5.2`), which is what makes the spec's conditional catalog entry *possible* — §4
shows it turned out to be *unnecessary*.

### 3 — What actually changed

`gradle/libs.versions.toml`, two lines, and nothing else anywhere in the repository:

```diff
 [versions]
-kotlin = "2.3.21"
+kotlin = "2.4.10"
 arrow = "2.2.3"
 logback = "1.6.2"
 ktor = "3.5.2"
-graphql-kotlin = "9.3.0"
+graphql-kotlin = "10.2.1"
```

`bp_back/build.gradle.kts` is **untouched** — `jvmToolchain(25)` at `:17` is unchanged (AC4).
`bp_back/.../plugins/GQL.kt` is **untouched**; every `com.expediagroup.*` import and both overridden signatures
compiled unmodified, exactly as Design Note §1 predicted.
`bp_back/.../plugins/Routing.kt` is **untouched** — the Jackson Block If never fired.
`bp_front/src/__generated__/` is **untouched** (§5).
**No conditional `ktor-serialization-jackson3` catalog entry was added**, because the measured resolution did not meet
the condition (§4).

**The serialization plugin moves in lockstep — read from the build, not from `version.ref`.**
`./gradlew :bp_back:buildEnvironment`:

```
+--- org.jetbrains.kotlin.plugin.serialization:org.jetbrains.kotlin.plugin.serialization.gradle.plugin:2.4.10
|    \--- org.jetbrains.kotlin:kotlin-serialization:2.4.10
+--- org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin:2.4.10
|    \--- org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.10
```

And the compiler itself, read off the compile classpath with `--debug`:

```
kotlin-compiler-embeddable-2.4.10.jar
kotlin-build-tools-impl-2.4.10.jar
```

### 4 — The classpath diff, and the one prediction it falsified

`./gradlew :bp_back:dependencies --configuration runtimeClasspath` re-run and flattened the same way. The complete
`diff -u flat-before.txt flat-after.txt` — every coordinate that moved, nothing elided:

```diff
-com.alibaba.fastjson2:fastjson2:2.0.56
-com.alibaba.fastjson2:fastjson2-kotlin:2.0.56
-com.apollographql.federation:federation-graphql-java-support:5.5.0
+com.alibaba.fastjson2:fastjson2:2.0.61
+com.alibaba.fastjson2:fastjson2-kotlin:2.0.61
+com.apollographql.federation:federation-graphql-java-support:6.0.0
-com.expediagroup:graphql-kotlin-automatic-persisted-queries:9.3.0
-com.expediagroup:graphql-kotlin-dataloader:9.3.0
-com.expediagroup:graphql-kotlin-dataloader-instrumentation:9.3.0
-com.expediagroup:graphql-kotlin-federation:9.3.0
-com.expediagroup:graphql-kotlin-ktor-server:9.3.0
-com.expediagroup:graphql-kotlin-schema-generator:9.3.0
-com.expediagroup:graphql-kotlin-server:9.3.0
+com.expediagroup:graphql-kotlin-automatic-persisted-queries:10.2.1
+com.expediagroup:graphql-kotlin-dataloader:10.2.1
+com.expediagroup:graphql-kotlin-dataloader-instrumentation:10.2.1
+com.expediagroup:graphql-kotlin-federation:10.2.1
+com.expediagroup:graphql-kotlin-ktor-server:10.2.1
+com.expediagroup:graphql-kotlin-schema-generator:10.2.1
+com.expediagroup:graphql-kotlin-server:10.2.1
-com.graphql-java:graphql-java:23.1
-com.graphql-java:java-dataloader:4.0.0
+com.graphql-java:graphql-java:25.0
+com.graphql-java:java-dataloader:6.0.0
+io.ktor:ktor-serialization-jackson3:3.5.2
+io.ktor:ktor-serialization-jackson3-jvm:3.5.2
-org.jetbrains.kotlin:kotlin-stdlib:2.4.0
+org.jetbrains.kotlin:kotlin-stdlib:2.4.10
+tools.jackson.core:jackson-core:3.1.3
+tools.jackson.core:jackson-databind:3.1.3
+tools.jackson:jackson-bom:3.1.3
+tools.jackson.module:jackson-module-kotlin:3.1.3
```

The explicit assertions the task list demanded:

- **`graphql-java` 23.1 → 25.0** — yes, exactly as the schema-generator POM declares. `java-dataloader` 4.0.0 → 6.0.0
  and `federation-graphql-java-support` 5.5.0 → 6.0.0 rode along; neither is named anywhere in this codebase.
- **Jackson 2 *and* Jackson 3 are both present.** `com.fasterxml.jackson.*:2.22.1` (unmoved: `jackson-databind`,
  `jackson-core`, `jackson-module-kotlin` all still 2.22.1, `jackson-annotations` 2.22) **and**
  `tools.jackson.*:3.1.3` (new: `jackson-core`, `jackson-databind`, `jackson-module-kotlin`, `jackson-bom`).
  Note the spec predicted Jackson 3 at **3.0.3**; the measured version is **3.1.3**.
- **`ktor-serialization-jackson3` resolved to 3.5.2** — the project's own Ktor version, *not* the `3.4.1` the
  graphql-kotlin POM asks for. Gradle's highest-wins conflict resolution lifted it, because every other `io.ktor:*`
  module in the graph is at 3.5.2. **The spec's conditional catalog entry was therefore NOT added** — its condition
  ("only if the measured resolution shows that module landing below the project's Ktor 3.5.2") is not met. This is a
  deliberate non-action, recorded rather than omitted.
- **`kotlin-stdlib` 2.4.0 → 2.4.10** — moved with the compiler, as expected.
- **`kotlin-reflect` is STILL 2.3.21. The split runtime did NOT heal.** This falsifies the spec's Design Note §4
  ("Moving the compiler to 2.4.x should pull both to the same number and close it") and the Story 7.7 ledger entry's
  proposal to "let Story 7.12 dissolve it". **The reason, traced rather than guessed** — the highest *request* in the
  whole graph is 2.3.21, and it comes from Ktor, not from Kotlin:

  ```
  $ grep -oP 'kotlin-reflect:[\w.\-]+( -> [\w.\-]+)?' deps-after.txt | sort | uniq -c
        2 kotlin-reflect:1.8.10 -> 2.3.21
        2 kotlin-reflect:2.1.21 -> 2.3.21
        7 kotlin-reflect:2.3.0  -> 2.3.21
        1 kotlin-reflect:2.3.21
  ```

  and the single un-upgraded request, with its parent resolved by walking the tree indentation:

  ```
  +--- io.ktor:ktor-server-core-jvm:3.5.2
  |    +--- org.jetbrains.kotlin:kotlin-reflect:2.3.21
  ```

  So `kotlin-reflect` tracks **Ktor**, not the `kotlin` catalog entry: the Kotlin Gradle Plugin injects `kotlin-stdlib`
  at the compiler version but never `kotlin-reflect`, and nothing else in the graph asks for more than Ktor's 2.3.21.
  The skew is unchanged in kind and one patch wider in degree (was 2.4.0/2.3.21, now 2.4.10/2.3.21), still in the
  supported direction, and green across all four instruments. **No `force`/`strictly`/`constraints` rule was added to
  close it** — that is a new build mechanism, which S-AC4 forbids. Filed in `deferred-work.md` with the corrected
  cause and a re-scoped trigger (§8).

### 5 — AC2: the schema is compared, not trusted

**SDL, from the running stack, before and after:**

```
$ md5sum sdl-before.graphql sdl-after.graphql
24f694bc89063ba52c753fc7e1b4615c  sdl-before.graphql
24f694bc89063ba52c753fc7e1b4615c  sdl-after.graphql

$ diff -u sdl-before.graphql sdl-after.graphql
DIFF_EXIT=0
```

**The diff is empty. Byte-identical — stated outright, not left inferred.** Not merely semantically equal: the two
170-line captures share an md5. So there is no semantic difference, no cosmetic difference, no reordering and no change
in built-in directive printing across `graphql-java` 23.1 → 25.0. **The SDL Block If did not fire.**

**The diff instrument is not vacuous.** A green `diff` proves nothing until it has been seen to go red for the right
reason, so a control was run: `sdl-after.graphql` with exactly one nullability character flipped —
the Block If's own failure class:

```
$ sed 's/  emoji: String$/  emoji: String!/' sdl-after.graphql > sdl-perturbed.graphql
$ diff -u sdl-before.graphql sdl-perturbed.graphql
@@ -75,7 +75,7 @@
 type List {
   createdAt: String!
-  emoji: String
+  emoji: String!
   id: ID!
CONTROL_DIFF_EXIT=1
```

**Codegen — the sharper instrument.** `npm run generate` from `bp_front/` with a fresh `CODEGEN_TOKEN` against the
rebuilt stack on `:2080`:

```
$ CODEGEN_TOKEN="…" npm run generate
✔ Load GraphQL schemas
✔ Load GraphQL documents
✔ Generate
✔ Generate outputs
GENERATE_EXIT=0

$ git status --short bp_front/src/__generated__/
(no output)

$ find src/__generated__ -type f | sort | xargs md5sum
546dfdb0896c2108bf06a9a54e97eb2f  src/__generated__/fragment-masking.ts
dfc1675614966e8b30bf2a69afb37b17  src/__generated__/gql.ts
27a530103ba703e857d91eaf55dcbf9d  src/__generated__/graphql.ts
4989093eb097fdf9cf48fbbc4d3a7cd2  src/__generated__/index.ts
```

All four md5s are identical to the pre-run capture. **The codegen output is byte-identical — stated explicitly.**
Nothing was committed from `bp_front/`, because nothing moved.

**And that instrument was falsified too**, because "empty `git status`" is exactly what a codegen run that silently
skipped writing would also produce:

```
$ printf '\n// PERTURBATION PROBE — must be erased by npm run generate\n' >> src/__generated__/graphql.ts
$ git status --short src/__generated__/
 M src/__generated__/graphql.ts                      ← detector goes red
$ md5sum src/__generated__/graphql.ts
2e9de7a72948831cae65b7e3e5c37e77                     ← perturbed
$ CODEGEN_TOKEN="…" npm run generate                 → REGEN_EXIT=0
$ git status --short src/__generated__/
(no output)                                          ← restored
$ md5sum src/__generated__/graphql.ts
27a530103ba703e857d91eaf55dcbf9d                     ← exactly the original
$ grep -c "PERTURBATION PROBE" src/__generated__/graphql.ts
0
```

So codegen genuinely rewrites the file and `git status` genuinely detects a difference; "byte-identical" is a
measurement, not an artifact of a skipped write.

### 6 — AC3: the error-shape contract, which no existing test can see

**Why this check exists and cannot be delegated to the suite.** `bp_front/src/lib/admin/adminErrors.ts:7` is
`const RESOLVER_WRAPPER = /^Exception while fetching data \([^)]*\)\s*:\s*/`, a regex over graphql-java's message
format, and `isForbiddenError` branches on `extensions.code`. The nearest E2E coverage is `sharing.spec.ts:109`:

```ts
await expect(page.getByTestId('share-error')).toContainText(`User '${ghost}' not found`)
```

`toContainText` is a **substring** match. If the wrapper stopped being stripped, the alert would read
`Exception while fetching data (/shareList) : User 'x' not found` — which still *contains* the expected substring, so
that assertion **still passes** while the framework noise ships to users. The suite structurally cannot make this
check; hence the byte-level diff below, and hence the E2E run in §7 is not a substitute for it.

**Recaptured against the same persisted user / list / item ids** (that is what `fixtures.json` is for), so the
comparison is byte-level and not merely "looks the same":

```
$ diff -u error-before.json error-after.json
ERR_DIFF_EXIT=0
$ diff -u forbidden-before.json forbidden-after.json
FORB_DIFF_EXIT=0
$ md5sum error-before.json error-after.json forbidden-before.json forbidden-after.json
0f14f39530c686ecc53218f28f1b79f4  error-before.json
0f14f39530c686ecc53218f28f1b79f4  error-after.json
e8f4a49ba280f66c1510a6bfbb0f21ea  forbidden-before.json
e8f4a49ba280f66c1510a6bfbb0f21ea  forbidden-after.json
```

**Byte-identical, both bodies.** The prefix `Exception while fetching data (/saveItem) : ` and
`extensions.code == "FORBIDDEN"` survive `graphql-java` 23.1 → 25.0 and the arrival of Jackson 3 unchanged — as does
every other field (`locations`, `path`, and the *absence* of a `data` key).

Applying the frontend's own regex to the post-bump messages, so the contract is exercised rather than eyeballed:

```
error-after.json
  raw     : "Exception while fetching data (/saveItem) : Category 9999…9999 does not belong to list c035f3d6-…"
  matches : true
  stripped: "Category 9999…9999 does not belong to list c035f3d6-…"
  code    : undefined
forbidden-after.json
  raw     : "Exception while fetching data (/lists) : Admin cannot access list resources"
  matches : true
  stripped: "Admin cannot access list resources"
  code    : "FORBIDDEN"
```

**Both comparators falsified.** Control A strips the wrapper prefix from the *after* capture; control B swaps the
code. Both go red, so a real regression in either would have been caught:

```
$ sed 's/Exception while fetching data (\/saveItem) : //' error-after.json > error-perturbed.json
$ diff -u error-before.json error-perturbed.json
-{"errors":[{"message":"Exception while fetching data (/saveItem) : Category 9999… …
+{"errors":[{"message":"Category 9999… …
CONTROL_A_EXIT=1

$ sed 's/"FORBIDDEN"/"INTERNAL_ERROR"/' forbidden-after.json > forbidden-perturbed.json
$ diff -u forbidden-before.json forbidden-perturbed.json
-… "extensions":{"code":"FORBIDDEN"}}]}
+… "extensions":{"code":"INTERNAL_ERROR"}}]}
CONTROL_B_EXIT=1
```

**On the Jackson question specifically.** The bodies being byte-identical is the contract that matters and it holds.
What this pass did **not** establish is *which* mapper produced them — `com.fasterxml` 2.22.1 via the project's own
`ContentNegotiation` (`Routing.kt:14-16`) or `tools.jackson` 3.1.3 via graphql-kotlin's internal install. No
distinguishing signal was available without a code change: the response carries a bare `Content-Type: application/json`
(measured post-bump) and both mappers serialise these shapes identically. Stated rather than glossed. What *is*
established is the thing the Block If guards: **nothing forced a change to the Jackson 2 `ContentNegotiation`**, so
`Routing.kt` is unedited and the auth REST surface was never touched.

**Real-browser `/api/graphiql`, post-bump.** Playwright MCP, same same-origin route interceptor as §1. Accessibility
snapshot of the loaded page — this is a rendered playground, not a 200:

```
- button "Show Documentation Explorer"   - button "Show History"
- button "Re-fetch GraphQL schema"       - button "Open settings dialog"
- tablist "Select active operation"
- region "Query Editor"  →  toolbar "Editor Commands"
                            - button "Execute query (Ctrl-Enter)"
                            - button "Prettify query (Shift-Ctrl-P)"
- region "Variables"     - region "Result Window"
```

Then a live query was typed into the editor and executed through the UI's own fetcher, against the bumped backend:

```
query : {applicationConfig{registrationEnabled}}
result: {
          "data": {
            "applicationConfig": {
              "registrationEnabled": true
            }
          }
        }
```

Screenshot `graphiql-after.png`. So the playground renders **and round-trips a real GraphQL response** — the docs
explorer being live also means introspection succeeded against `graphql-java` 25.0.

### 7 — Gates

| Gate | Command | Result |
|---|---|---|
| Compile | `:bp_back:compileKotlin` (inside the test run) | exit 0, **no source change required** |
| Backend suite | `./gradlew :bp_back:cleanTest :bp_back:test` | `TEST_EXIT=0`, **115 / 0 / 0 / 0**, 15 classes, from the JUnit XML |
| SDL | `diff -u sdl-before.graphql sdl-after.graphql` | empty, md5-identical |
| Codegen | `npm run generate` + `git status --short bp_front/src/__generated__/` | empty, all 4 md5s identical |
| Error shape | `diff -u` on both captures | both empty, md5-identical |
| E2E | `npm run test:e2e` at `retries: 0` | `E2E_EXIT=0`, **120 passed (45.6s)** |
| E2E split | `npx playwright test --list \| grep -oP … \| sort \| uniq -c` | **59 / 59 / 1 / 1**, Total 120 in 10 files |
| Image | `docker compose build bp_back` | `DOCKER_BUILD_EXIT=0` |
| Browser | `/api/graphiql` via Playwright MCP | playground renders, live query returns data |

**Backend suite, post-bump, read from `bp_back/build/test-results/test/TEST-*.xml`:**

```
com.bagplease.ApplicationTest 1 0 0 0                    com.bagplease.MigrationTest 5 0 0 0
com.bagplease.AuthApiTest 3 0 0 0                        com.bagplease.SubscriptionScopingTest 4 0 0 0
com.bagplease.ItemApiTest 5 0 0 0                        com.bagplease.WebSocketAuthTest 3 0 0 0
com.bagplease.ItemCategoryStorageTest 2 0 0 0            …admin.AdminUserManagementTest 7 0 0 0
com.bagplease.ItemLifecycleTest 25 0 0 0                 …admin.ApplicationConfigTest 7 0 0 0
com.bagplease.ListAuthorizationTest 4 0 0 0              …auth.LoginTokenTest 14 0 0 0
com.bagplease.ListServiceTest 10 0 0 0                   …auth.UserRegistrationTest 7 0 0 0
com.bagplease.ListSharingTest 18 0 0 0
TOTAL tests=115 failures=0 errors=0 skipped=0 classes=15
```

Identical class-by-class to the baseline. `SubscriptionScopingTest` (4) and `WebSocketAuthTest` (3) are the
subscription-transport and `4401`-close coverage; `ListAuthorizationTest` (4) is the auth wrapper. All green
unmodified, so the subscription row of the I/O matrix is discharged by the suite plus `sharing.spec.ts`'s FR52 live
check in the E2E run.

**The E2E run exercised the bumped backend, not a stale container.** `docker compose up -d --build` reported
`Container bag-please-bp_back-1 Recreated` / `Started` after `Image bag-please-bp_back Built`; `bp_front` was rebuilt
from an unchanged context and not recreated. The suite's own `webServer` re-runs the same command.

**AC4 — the shipped image.** `docker compose build bp_back` → `DOCKER_BUILD_EXIT=0`:

```
#6  [internal] load metadata for docker.io/library/gradle:9.6.1-jdk25
#8  [build 1/7] FROM docker.io/library/gradle:9.6.1-jdk25@sha256:e8aeffb8197b17151ce24607811f60e91125f0018f7a3b08dc504ba9168a9c4f
#16 68.74 > Task :bp_back:compileKotlin
#16 68.74 w: file:///home/gradle/src/bp_back/src/main/kotlin/com/bagplease/entity/user/UserService.kt:65:9 Expression is unused.
#16 74.44 BUILD SUCCESSFUL in 1m 14s
```

So `gradle:9.6.1-jdk25` still resolves the toolchain and the Kotlin 2.4.10 / graphql-kotlin 10.2.1 pair builds in the
image that ships. `jvmToolchain(25)` is unchanged in `bp_back/build.gradle.kts:17`. The compiler version is not printed
by the image build; it was read off the compile classpath instead (`kotlin-compiler-embeddable-2.4.10.jar`, §3), which
is the same catalog entry the image build resolves.

**Final confirming run on the exact committed tree.** After the §8 control experiment temporarily reverted and restored
the catalog, the working file was verified byte-identical to the gated version (`diff -q` → identical) and the suite
re-run from clean: `TEST_EXIT=0`, `TOTAL tests=115 failures=0 errors=0 skipped=0 classes=15`.

### 8 — Residual risks and new debt

Four items filed in `deferred-work.md` under `## Deferred from: Story 7.12 …`, inserted at the re-measured line
**1175** (the Story 7.11 section runs 1102–1174; the code-review run starts at 1175 — re-measured in this pass with
`grep -n "^## "`, file length 2232 lines before the edit).

1. **The split Kotlin runtime survived this story and is one patch wider.** The Story 7.7 ledger entry proposed
   "let Story 7.12 dissolve it"; that proposal is now measured false. Cause corrected: `kotlin-reflect` is pinned by
   `io.ktor:ktor-server-core-jvm:3.5.2`, not by anything Kotlin-versioned, so **no `kotlin` bump can ever close it** —
   only a Ktor bump whose `ktor-server-core` requests a newer reflect, or an explicit constraint. Trigger re-scoped
   from "Story 7.12" to "the next Ktor bump".
2. **Jackson 2 and Jackson 3 now coexist on the runtime classpath** (`com.fasterxml…2.22.1` + `tools.jackson…3.1.3`,
   four new jars), with two live `ContentNegotiation` converter implementations available and no measurement of which
   one serialises `data`/`errors`. Per Design Note §2, `JacksonWebsocketContentConverter()` (Jackson 2) at
   `GQL.kt:130` may now be vestigial for GraphQL frames — **noted, not deleted**, which is out of scope.
3. **A new Kotlin 2.4 compiler diagnostic**, `UserService.kt:65:9 Expression is unused.` — established as *new* with a
   control rather than assumed, because the baseline `compileKotlin` was `UP-TO-DATE` and produced no output at all:
   the catalog was stashed back to `9.3.0`/`2.3.21` and `./gradlew :bp_back:compileKotlin --rerun-tasks` run on the
   identical source, which emitted **0** warnings. Warning only; the build is green and nothing was suppressed.
4. **`/api/graphiql` cannot be loaded by a plain browser navigation** — it is inside `authenticate(authMethod)` and a
   navigation carries no `Authorization` header, so the documented manual readiness check returns **401**. Measured;
   pre-existing, not caused by this bump, and the `project-context.md` bullet that names it is inaccurate as written.

**No debt was avoided by weakening anything.** No `@Suppress` was added, no compiler flag, no `force`/`strictly`/
`constraints` resolution rule, no test assertion or expected value edited, no schema change, no product behaviour
change, no endpoint added. The final diff is `gradle/libs.versions.toml` and nothing else (S-AC4).

### 9 — Deviations from the spec, and things deliberately not done

- **The conditional `ktor-serialization-jackson3` catalog entry was not added.** Its stated condition ("only if the
  measured resolution shows that module landing below the project's Ktor 3.5.2") was tested and **not met** —
  it resolved to 3.5.2. Non-action, recorded rather than omitted.
- **The Kotlin ladder's lower rungs were never exercised.** `2.4.0` and the `2.3.21` hold were not attempted because
  rung 1 (`2.4.10`) was green. The spec asks to "record the rung and the symptom that rejected each earlier one";
  there is no earlier rung and therefore no rejection symptom. Saying so explicitly, rather than leaving the absence
  to be read as an omission.
- **Design Note §4's prediction is falsified, not fulfilled.** The spec expected the Kotlin bump to heal the split
  runtime and asked to "say so with the measured diff rather than claiming it". It did not heal; §4 gives the traced
  cause.
- **The spec's predicted Jackson 3 version (`3.0.3`) is wrong**; the measured version is `3.1.3`.
- **The I/O matrix's failing-mutation row is imprecise**: the measured body has no `data` key at all, rather than
  `data.saveItem: null`. The `errors[0].message` prefix — the part that is actually the contract — is exactly as
  specified.
- **The `FORBIDDEN` case was produced via `AdminBlocked`, not a non-member list read.** Same `extensions.code`, same
  code path through `ListAuthError.toException()` (`ListApi.kt:146-157`), and it needs no second registered actor.
- **`npm run lint` and `npm run build` were not run.** No `bp_front/` file changed in this story, so neither gate has
  anything new to see; and `bp_front/Dockerfile` runs `npm run build` inside the image build that the E2E gate
  performs, which passed. Stated rather than silently skipped.
- **One temporary, fully reverted experiment touched the tree**: the §8 control that stashed the catalog back to
  `9.3.0`/`2.3.21` to establish the compiler warning as new. The catalog was restored and verified byte-identical to
  the gated version, and the suite re-run green afterwards (§7).

### 10 — Corrections and measurements added at review (2026-08-16)

Seven review findings were patched in this pass. Four of them change a claim this record originally made, so the
superseded wording is named here to stop a later reader restoring it.

**(a) The reflect skew's *safety* was filed without ever being argued — now measured.** §8 item 1 and the
`project-context.md` bullet both recorded that `kotlin-reflect` stayed at 2.3.21 while the compiler moved to 2.4.10,
and neither said whether that is dangerous. It is not, and the evidence was already in hand:

```
$ javap -v -p -cp bp_back/build/classes/kotlin/main com.bagplease.entity.item.gql.GqlItem | grep mv=
      mv=[2,4,0]
$ docker run --rm --entrypoint sh <bp_back image> -c 'ls /app/lib | grep -Ei "kotlin-reflect|kotlin-stdlib"'
kotlin-reflect-2.3.21.jar
kotlin-stdlib-2.4.10.jar
kotlin-stdlib-jdk7-1.8.10.jar
kotlin-stdlib-jdk8-1.8.10.jar
```

The shipped image therefore runs reflect 2.3.21 against classes carrying metadata `mv=[2,4,0]`, and graphql-kotlin's
schema generation is **entirely** reflection over exactly those classes — `install(GraphQL)` would throw at boot if
2.3.21 could not read that metadata. It does not: the 120-test E2E suite ran against that image. The residual is only
reflection paths no test walks. This is an argument the original record should have made rather than leaving a reader
to wonder whether the shipped artifact was at risk.

**(b) "No `kotlin` bump can *ever* close the skew" is withdrawn as an absolute, and a third remedy was missing.**
The ledger and the rules file each named exactly two remedies (wait for a Ktor bump; an explicit `constraints { }`
pin) and omitted the ordinary one: a plain `implementation(kotlin("reflect"))` in `bp_back/build.gradle.kts`, which
the Kotlin Gradle Plugin version-aligns to the compiler automatically. That is a dependency declaration, not the "new
build mechanism" this record claimed S-AC4 forbids — and note the spec's Never clause names `force`/`strictly` only,
so extending it to `constraints` was this record's reading, not the spec's text. Both files corrected; the remedy is
still **not applied** here, because it is a build change outside a two-line version bump.

**(c) "No distinguishing signal was available without a code change" was asserted, not demonstrated.** It is the
sentence that closed out the single largest unknown this bump introduced — which of two live Jackson mappers
serialises GraphQL `data`/`errors` — and at least four black-box probes were never tried: non-ASCII / astral-plane
escaping through the schema's `emoji` field, `Accept`-header negotiation and 406 behaviour, the `Content-Type` charset
suffix, and field-ordering / pretty-print defaults. In a record that falsified every other instrument before trusting
it, closing this one with an unproven negative was the weakest link. Re-filed in the ledger as a probe rather than a
closed question.

**(d) AC4's compiler-version evidence was indirect where direct evidence was already quoted.** The record substituted
`kotlin-compiler-embeddable-2.4.10.jar`, read from the **host** classpath, for the image build's own report — an
inference across two Gradle installations. The stronger evidence sits three lines up in the same quoted image log:
`#16 68.74 w: …UserService.kt:65:9 Expression is unused.` is a diagnostic **only the 2.4 compiler emits** (§8 item 3
establishes it by control), produced *inside* the image. That is the citation AC4 should carry.

**(e) `sprint-status.yaml`'s `last_updated` annotation was stale and the task was checked off anyway.** The `git diff`
on that file was a single hunk at line 122; line 38 still narrated Story 7.11. The date string coincidentally
validated because both stories landed on 2026-08-16, which is how it escaped notice. Rewritten.

**(f) `project-context.md`'s readiness bullet was left factually wrong 110 lines from its own refutation.** This pass
measured that `/api/graphiql` returns **401** to a plain browser navigation, wrote that into the `_Last Updated`
block, and then left the Manual Testing bullet — the place a reader actually looks — still instructing agents that
"`/api/graphiql` loading is the manual readiness check". The self-imposed "Technology Stack only" scope does not
explain it, since the same pass prepended a 30-line entry outside that section. The bullet now carries the
token-bearing `curl` and an explicit "do not read that 401 as the backend being down".

**(g) `rule_count` moved by one while three directives were added.** 95 → **98**, with the arithmetic stated in the
`_Last Updated` entry: `kotlin-reflect`-tracks-Ktor, Jackson-2-and-3-must-not-be-unified, and
confirm-plugin-lockstep-from-`buildEnvironment`. The counter's definition is itself an open ledger item awaiting
`md`'s ruling; incrementing a disputed metric silently was the worse of the two options, so the count now shows its
working. Also corrected: the rules file stated as established fact that `GQL.kt:130`'s Jackson 2 converter "is what
… uses for WebSocket frames", while the ledger written in the same pass said it **may be vestigial**. The rules file
now carries the uncertainty, and the Jackson bullet gained the re-check trigger every comparable rule in that file
has.

**What the review did not change.** The bump itself, the commit, and every gate result stand unaltered — no finding
touched `gradle/libs.versions.toml`, `bp_back/`, or `bp_front/`. All seven patches are documentation.

## Auto Run Result

Status: `done`

### Implemented change

`graphql-kotlin` 9.3.0 → **10.2.1** and `kotlin` 2.3.21 → **2.4.10** — the epic's highest-risk backend bump, landed at
the top rung of the story's ladder with **no backend source change at all**. Commit `f796948`, whose entire content is
two lines of `gradle/libs.versions.toml`. The 10.0.0 release moved three things simultaneously and all three landed:
`graphql-java` 23.1 → 25.0, `java-dataloader` 4.0.0 → 6.0.0, and Jackson 2 → Jackson 3 (`tools.jackson.*` 3.1.3 now
sits beside the unmoved `com.fasterxml.jackson.*` 2.22.1). `GQL.kt`, `Routing.kt` and `bp_back/build.gradle.kts`
compiled unedited, so AR-E7-0's scoped unfreeze was never actually spent; `jvmToolchain(25)` is unchanged.

### Files changed

- `gradle/libs.versions.toml` — the two version numbers; the only file in the commit.
- `_bmad-output/implementation-artifacts/spec-7-12-graphql-kotlin-9-to-10-with-kotlin.md` — the spec, its
  10-subsection Implementation Record, and the review triage log.
- `_bmad-output/project-context.md` — Kotlin/graphql-kotlin/graphql-java/Jackson versions; the corrected
  split-runtime bullet (cause is Ktor, not Arrow; skew measured safe; three remedies); the Jackson 2 + 3 coexistence
  rule with a re-check trigger; the corrected `/api/graphiql` readiness bullet; `rule_count` 95 → 98 with its
  arithmetic; a Story 7.12 `_Last Updated` entry.
- `_bmad-output/implementation-artifacts/deferred-work.md` — a Story 7.12 section (4 items) plus a code-review section
  (11 items); both surrounding regions verified byte-unchanged by md5.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `7-12-…: done` and a refreshed `last_updated`.

### Review findings breakdown

- **Patches applied: 7** (medium 4, low 3) — all documentation; no finding touched `gradle/libs.versions.toml`,
  `bp_back/` or `bp_front/`. Two retracted overclaims (the "no `kotlin` bump can ever" absolute, and "no
  distinguishing signal was available"), two factually wrong rules-file statements corrected, one missing safety
  argument measured and added, one missing re-check trigger, one `rule_count` adjudication.
- **Items deferred: 11.** The sharpest is high-severity and structural: **the error-shape contract is permanently
  unassertable by any gate in this project** — every E2E check of a backend error message is a `toContainText`
  substring match that passes with the wrapper un-stripped, and no backend test asserts `errors[0].message` or
  `extensions.code` at all. Also filed: the unmeasured Jackson-mapper ownership with four untried probes; two probe
  writes to shared dev state (the `registrationEnabled` flag, and permanent rows feeding the size-driven
  `createUserViaUi` defect); no advisory sweep of a backend classpath that gained four jars and moved `fastjson2`;
  two transitive majors cleared on a `grep`; the serialization-plugin/core pairing closed by silence; no
  `languageVersion` pin or `allWarningsAsErrors`; the third reflect remedy; unretained falsification controls; and a
  two-variable control attributed to one.
- **Items rejected: 5** — the spec-status/`sprint-status` ordering (that is the workflow's design); the
  `/shareList`-vs-`/saveItem` capture choice (the reviewer itself verified both funnel through one
  `GraphQLForbiddenException` at `ListApi.kt:146-157`); the `constraints { }` scope-reading complaint (the action taken
  was correct, only the reasoning was loose — folded into a patch instead); the `_Last Updated` "triplication"
  complaint (headline-here / detail-in-ledger is this epic's established house style); and the removal of the
  `arrow-core` stdlib-2.4.0 note (superseded — at Kotlin 2.4.10 Arrow's floor is no longer binding).

### Verification performed

All measured in this pass, none quoted:

- `./gradlew :bp_back:cleanTest :bp_back:test` → **115 / 0 / 0 / 0** across 15 classes, read from
  `bp_back/build/test-results/test/TEST-*.xml`. Re-verified independently after the implementation agent returned.
- `npm run test:e2e` at `retries: 0` → **120 passed (45.6s)**, exit 0; split re-measured before and after at
  **59 / 59 / 1 / 1** — the standing invariant of exactly 1 test in each `registration-toggle-*` project holds.
- `/api/sdl` before vs after → `diff -u` empty, md5 `24f694bc89063ba52c753fc7e1b4615c` both sides. Control: a
  one-character nullability flip reddens it.
- `npm run generate` → all four `bp_front/src/__generated__/` files byte-identical. Control: a perturbed generated
  file reddens `git status` and codegen restores it to its exact md5.
- Raw failing-mutation and `FORBIDDEN` response bodies before vs after → md5-identical; wrapper prefix
  `Exception while fetching data (/saveItem) : ` and `extensions.code == "FORBIDDEN"` intact. Controls: stripping the
  prefix and swapping the code both redden.
- `docker compose build bp_back` exit 0 under `gradle:9.6.1-jdk25`; `/api/graphiql` renders in a real browser and
  round-trips a live query.
- Resolved `runtimeClasspath` re-verified independently: `graphql-kotlin` 10.2.1, `graphql-java` 25.0,
  `java-dataloader` 6.0.0, Jackson 2.22.1 **and** `tools.jackson` 3.1.3, `ktor-serialization-jackson3` lifted to the
  project's Ktor 3.5.2 (so the conditional catalog entry was tested and correctly **not** added), `kotlin-stdlib`
  2.4.10, `kotlin-reflect` **2.3.21**.
- Reflect-skew safety, measured at review: `javap -v` on the compiled GQL classes → metadata `mv=[2,4,0]`; the shipped
  image's `/app/lib` → `kotlin-reflect-2.3.21.jar` beside `kotlin-stdlib-2.4.10.jar`.

### Residual risks

- **The split Kotlin runtime survived** — stdlib 2.4.10, reflect 2.3.21, caused by `ktor-server-core-jvm:3.5.2`.
  Measured safe (reflect 2.3.21 demonstrably reads `mv=[2,4,0]`, or schema generation would fail at boot), but the
  residual is reflection paths no test walks. Re-check trigger is the next **Ktor** bump.
- **Which Jackson mapper serialises GraphQL `data`/`errors` is unknown**, and `GQL.kt:130`'s Jackson 2 websocket
  converter may be vestigial. Bodies are byte-identical either way; four black-box probes are filed and untried.
- **The error-shape contract has no automated guard on either side.** Until one exact-match assertion is added, every
  future graphql-java or graphql-kotlin bump must repeat this pass's manual byte-diff or ship blind.
- **A new Kotlin 2.4 diagnostic** (`UserService.kt:65:9 Expression is unused.`) is unsuppressed and unfixed; with no
  `allWarningsAsErrors`, future ones will arrive equally quietly.
- **The dev database gained probe rows and a forced `registrationEnabled`**, both feeding known filed defects.
