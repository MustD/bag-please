---
title: 'Story 9.1: The test run waits until the backend is ready'
type: 'feature'
created: '2026-09-15'
status: 'done'
baseline_revision: '7535617913c51f033038892dd4153917c9f8170d'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
warnings: [oversized]
deferred:
  - summary: >-
      A failed webServer start (e.g. bp_front port bind) leaves mongo and bp_back running; nothing stops them.
    evidence: |-
      Observed twice (implementer AC2 run and orchestrator port-held re-run): after "failed to bind host port 127.0.0.1:2080", docker ps listed bag-please-bp_back-1 and bag-please-mongo-1. Fixing it needs a wrapper script or trap around compose, which is more than a trivial patch.
    location: >-
      bp_front/playwright.config.ts webServer.command
    severity: medium
  - summary: >-
      With stdout ignored, a bp_back crash during startup may surface only as a container exit, without the logback stack trace.
    evidence: |-
      logback.xml sends everything to a STDOUT ConsoleAppender, and in the e2e log only container stderr lines (JVM warnings) appeared, never logback lines. Unverified: what compose itself prints to stderr on --abort-on-container-failure. To settle it, force a startup crash (e.g. an invalid KTOR_MONGO_PORT) and read the npm run test:e2e output.
    location: >-
      bp_front/playwright.config.ts stdout: 'ignore'
    severity: medium (unverified)
  - summary: >-
      The cold-start E2E gate is not green: the create-user dialog flake in admin.spec.ts fails 1-4 chromium tests per run.
    evidence: |-
      Cold runs: 202 passed / 4 failed, then 205 passed / 1 failed, all at createUserViaUi (create-user-dialog Expected 0 Received 1, 5000 ms), with about 3000 users rows in the table. Pre-existing Epic 7 action D4, routed to Story 9.2; admin.spec.ts passes when run alone.
    location: >-
      bp_front/e2e/admin.spec.ts:49
    severity: medium
  - summary: >-
      routing/CLAUDE.md still calls GET /api/graphiql the readiness check that the /api route order protects.
    evidence: |-
      routing/CLAUDE.md:25 reads "the `GET /api/graphiql` readiness check still reach the backend". The readiness check is now /api/health. This is an agent-context file, so the fix is deferred.
    location: >-
      routing/CLAUDE.md:25
    severity: low
  - summary: >-
      Agent docs gaps: AGENTS.md documents only the :2080 health probe (not :4000 for the Vite dev loop), and CLAUDE.md prescribes ./gradlew, which is absent from the repo.
    evidence: |-
      `ls gradlew` fails with "No such file or directory". The implementer ran backend tests with mise's gradle 9.7.1. AGENTS.md:40 gives only http://localhost:2080/api/health. Both are agent-context files, so the fix is deferred.
    location: >-
      AGENTS.md:40; CLAUDE.md Commands section
    severity: low
---

<intent-contract>

## Intent

**Problem:** `npm run test:e2e` cannot cold-start. `docker compose up -d --build` exits as soon as the containers
start, Playwright reads that exit as `Process from config.webServer exited early` and runs zero tests. Its probe
(`http://localhost:2080`) only shows that Caddy answers. It never shows that Ktor and Mongo are ready. A compose
startup failure can also burn the whole 600 s timeout before its output appears. The backend has no health endpoint.

**Approach:** Add an unauthenticated, non-rate-limited `GET /api/health` that pings Mongo inside
`withTimeout(2.seconds)`: `200` on success, `503` on any failure or timeout (AD-9). Run compose in the foreground so
Playwright owns the process, point `webServer.url` at `/api/health`, pipe stderr, stop the stack gracefully at
teardown, and retarget the readiness references (docs, global setup, PWA denylist test) from `/api/graphiql` to
`/api/health`.

## Boundaries & Constraints

**Always:**
- Declare the route as `get("/health")` inside `routing {}`, outside `authenticate` and every `rateLimit`. It is
  served at `/api/health` through `rootPath: "api"`. Never write `get("/api/health")`, which would serve
  `/api/api/health`.
- Resolve the Mongo handle through the existing `MongoConnection` DI provider (`dependencies`). Do not create a second
  client.
- Any exception or timeout from the ping → `503`, and the handler returns within about 2 s.
- Every new or retargeted test is observed FAILING before the implementation lands. Record the red output in the
  story record.
- Keep `docker compose up` targeting the same services and the same `cwd: '..'`. Keep `reuseExistingServer:
  !process.env.CI` and the 600 s timeout for cold image builds.
- Close the four routed deferred-work entries in place. Mark sprint-status F20 item 36 `done` and story `9-1`
  `done`; set `epic-9` to `in-progress`.

**Never:**
- No probe binary (`curl`, `wget`) added to the `bp_back` image, and no compose healthcheck on `bp_back`.
- No change to `navigateFallbackDenylist` / `runtimeCaching` in `vite.config.ts`, apart from correcting the comment.
- No new dependencies, no version bumps, no GraphQL schema change (so no codegen).
- Do not `docker compose down -v` or otherwise remove the `db_data` volume at teardown.
- Do not use the shared project-scoped `mongoContainer()` for the Mongo-down case. Pausing it would break other specs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Healthy | `GET /api/health`, no credentials, Mongo up | `200`, body `OK` | none |
| Mongo hung | Mongo container paused (ping never answers) | `503`, body `UNAVAILABLE`, response in < 5 s wall clock (2 s timeout) | `TimeoutCancellationException` caught → 503 |
| Mongo unreachable | Mongo container stopped (driver would wait 30 s on server selection) | `503` in < 5 s | timeout or any `Exception` caught → 503 |
| Rate limit | 20 rapid `GET /api/health` (auth limit is 5 in test config) | all `200`, never `429` | none |
| Cold start E2E | no bag-please containers, `npm run test:e2e` | Playwright waits on `:2080/api/health` and the suite executes | none |
| Compose fails | e.g. `:2080` held by another non-2xx process, or a build error | the webServer error and compose stderr appear within seconds, not after 600 s | Playwright reports the early exit with the piped stderr |

</intent-contract>

## Code Map

- `bp_back/src/main/kotlin/com/bagplease/plugins/Routing.kt` -- `configureRouting()` (called last in `Application.module()`), `routing { install(ContentNegotiation); gqlRoutes() }`. Add the health route here (spine file map: `plugins/Routing.kt # get("/health")`). Unused `val env` can stay.
- `bp_back/src/main/kotlin/com/bagplease/Application.kt:31-35` -- `dependencies { provide { MongoConnection(config) } }`; `val connection: MongoConnection by dependencies` is the reuse pattern.
- `bp_back/src/main/kotlin/com/bagplease/mongo/MongoConnection.kt` -- exposes `db: MongoDatabase` (coroutine driver). Ping = `db.runCommand(Document("ping", 1))`.
- `bp_back/src/main/kotlin/com/bagplease/features/auth/AuthRoutes.kt:38-39` -- the only `rateLimit(RateLimitName("auth"))` block. Health must not sit inside it. `plugins/GQL.kt:135-140` -- the `authenticate(authMethod)` block, also off-limits.
- `bp_back/src/main/kotlin/com/bagplease/plugins/Migration.kt:29` -- `configureMigration` runs `runBlocking` Mongo reads at startup, so the app cannot START with Mongo down. The down case must break Mongo AFTER the app answers once.
- `bp_back/src/main/resources/application.yaml:9` -- `rootPath: "api"`. `bp_back/src/test/resources/application.yaml` shadows it on the test classpath and has no `ktor.deployment`. Ktor's test host does not read `ktor.deployment.rootPath` (only `EngineMain`/`CommandLine.kt:59` does). Use `testApplication { serverConfig { rootPath = "api" } }` so the test hits `/api/health` exactly as production serves it.
- `bp_back/src/test/kotlin/com/bagplease/utils/TestContainers.kt` -- `setUpMongo(container)`, `setUpJwt()`, `mongoContainer()` (PROJECT-scoped, shared; do not pause it). For the down case, start a dedicated `MongoDBContainer("mongo:8")` with the same env in the spec, and pause/unpause it via `container.dockerClient.pauseContainerCmd(container.containerId).exec()` / `unpauseContainerCmd`, stopping it in `afterSpec`.
- `bp_back/src/test/kotlin/com/bagplease/AuthApiTest.kt` -- test style template (`FunSpec`, `testApplication`, `application { module() }`, `shouldHaveStatus`).
- `bp_front/playwright.config.ts:64-74` -- the `webServer` block (`docker compose up -d --build`, `url: 'http://localhost:2080'`). The long counts-ledger comment at `:75-190` gets NO new row: this story adds no E2E test (it retargets one).
- `bp_front/e2e/global-setup.ts:27-43` -- `waitForBackend()` polls `/api/auth/config`, which consumes auth rate-limit slots and whose comment says "there is still no /health endpoint". Retarget it to `/api/health` and fix the comment.
- `bp_front/e2e/pwa.spec.ts:162-179` -- `NFR-E7-7 — /api/graphiql stays the backend readiness check…` uses an admin Bearer header. Retarget it to an unauthenticated `page.goto('/api/health')`. `loginApi` stays imported only if other tests use it (they do at `:181+`; check before removing).
- `bp_front/vite.config.ts:47-51` and `bp_front/CLAUDE.md` (PWA section, first bullet) -- the comments call `/api/graphiql` "this project's only backend-readiness check". Reword to `/api/health`. The denylist code itself does not change.
- `AGENTS.md:40-43` -- the "Backend readiness check" bullet (the token-bearing graphiql curl). Replace it with `curl -o /dev/null -w '%{http_code}' http://localhost:2080/api/health` → `200` (503 = Mongo unreachable).
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` §14 (`:763-806`, frontmatter `verified_at_commit` `:9`) and `DESIGN.md` §13 (`:424-455`, `:9`) -- the mechanical re-verify triggers fire (`playwright.config.ts` and `vite.config.ts` change). Anchors `playwright.config.ts:2,6,31,32` must stay valid, so edit only below line 60.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- entries to close in place: the index bullets `:73-76`; "Playwright `webServer` gaps" `:106-111`; the Story 7.1 review cold-start entry `:124-132`; the Story 7.12 "no backend health endpoint" entry `:295-308`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `:115` `9-1-…: backlog`, `:114` `epic-9: backlog`, `:371-378` item 36 (F20) `status: open`.

## Tasks & Acceptance

**Execution:**
- `bp_back/src/test/kotlin/com/bagplease/HealthApiTest.kt` -- NEW, written FIRST. Every test uses `serverConfig { rootPath = "api" }` + `setUpMongo` + `setUpJwt` + `module()`. (a) Shared container, `GET /api/health` → 200 body `OK`. (b) 20 sequential requests → all 200 (proves no rate limit). (c) Dedicated container: first request 200, then pause the container → request returns 503 and the measured elapsed time is < 5 s, unpause in `finally`. (d) Same dedicated container, now stopped (unreachable, connection refused) → 503 in < 5 s. Run it and record the red result (404s) -- proves the test observes the missing route.
- `bp_back/src/main/kotlin/com/bagplease/plugins/Routing.kt` -- add `get("/health")` directly under `routing {}`: resolve `MongoConnection` from `dependencies`, `withTimeout(2.seconds) { db.runCommand(Document("ping", 1)) }`, `respondText("OK")` or, on any `Exception` (`TimeoutCancellationException` included), `respondText("UNAVAILABLE", status = ServiceUnavailable)`. Rethrow a `CancellationException` that is NOT a timeout (call cancellation). -- AD-9.
- `bp_front/e2e/pwa.spec.ts` -- retarget the `:162` test to `/api/health`: rename it (`NFR-E7-7 — /api/health reaches Ktor while the worker controls the page`), drop the Bearer header, assert that the `page.goto` response status is 200, the body text is `OK` and `#root` has count 0. Run it against the pre-change backend image and record the red result.
- `bp_front/playwright.config.ts` -- `webServer`: `command: 'docker compose up --build --abort-on-container-failure'` (foreground, no `-d`), `url: 'http://localhost:2080/api/health'`, `stdout: 'ignore'`, `stderr: 'pipe'`, `gracefulShutdown: {signal: 'SIGTERM', timeout: 60_000}`. Rewrite the block comment to say why: a foreground process never "exits early" on a healthy start, and a failed build/port bind/crashing container exits it at once with stderr shown. 503 and 502 are not ready, so Playwright keeps polling. A stack Playwright started is stopped (not removed; volume kept) at teardown, and a reused stack is untouched.
- `bp_front/e2e/global-setup.ts` -- poll `${BACKEND}/api/health` and update the comment. -- stops readiness polling from spending auth rate-limit slots.
- `bp_front/vite.config.ts`, `bp_front/CLAUDE.md`, `AGENTS.md` -- comment/doc retarget per the Code Map.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md`, `DESIGN.md` -- re-run both check blocks at the final code state, correct any false claim, and set `verified_at_commit` to the story-start commit `7535617913c51f033038892dd4153917c9f8170d` (and the matching prose in `DESIGN.md:448`).
- `_bmad-output/implementation-artifacts/deferred-work.md`, `sprint-status.yaml` -- close the four entries in place with `✅ CLOSED by Story 9.1 (2026-09-15):` plus a one-line resolution; update the statuses listed in the Code Map.

**Acceptance Criteria:**
- Given no bag-please containers are running (`docker compose stop` first), when md runs `npm run test:e2e` from `bp_front/`, then the log shows no `Process from config.webServer exited early`, the suite executes, and afterwards `docker ps` lists no bag-please container.
- Given something non-2xx already holds `127.0.0.1:2080`, when `npm run test:e2e` runs, then it fails within 60 s of the image build finishing and shows compose's port-bind error, instead of waiting out 600 s.
- Given the running stack, when `curl http://localhost:2080/api/health` is sent without credentials, then it returns `200`. After `docker compose pause mongo`, it returns `503` in ≤ 3 s. Unpause afterwards.
- Given the service worker controls the page, when the browser navigates to `/api/health`, then Ktor's `OK` is shown and no SPA shell is served (the retargeted pwa test, both viewport projects).
- Given `git diff`, when inspected, then `bp_back/Dockerfile`, `docker-compose.yaml` and the `navigateFallbackDenylist`/`runtimeCaching` values are unchanged, and `playwright.config.ts` records the teardown and stdout/stderr choices.

## Spec Change Log

## Review Triage Log

### 2026-09-15 — Review pass
- verdicts: 33 findings — high 0, medium 12, low 13, false 5, maybe-false 3
- findings:
  - `[low]` `[reject]` (intent-alignment) The backend test sets `rootPath = "api"` by hand instead of loading the production `application.yaml` — the test classpath's `application.yaml` shadows the main one, and the explicit rootPath still catches the `/api/api/health` mistake. Loading the main YAML would add config plumbing for a setting that rarely changes.
  - `[low]` `[patch]` (intent-alignment) The 503 timing is asserted as < 5 s, not near the 2 s timeout — grouped with the Blind Hunter timing finding; bounds tightened to < 3 500 ms in `HealthApiTest` (c) and (d).
  - `[medium]` `[defer]` (intent-alignment) "Failure surfaces promptly" is manually checked for only one failure type; a failed start leaves mongo/bp_back running — grouped with the leftover-containers entry, deferred (fix needs a wrapper/trap around compose).
  - `[medium]` `[defer]` (intent-alignment) The cold-start suite executes but is not green — pre-existing D4 create-user flake (`admin.spec.ts:49`), owned by Story 9.2; deferred.
  - `[low]` `[reject]` (intent-alignment) Nothing tests GraphiQL through the service worker any more — the unchanged `/^\/api/` denylist is still proven by the `/api/health` navigation; a second test for the same regex adds no coverage anyone would miss.
  - `[false]` `[reject]` (intent-alignment) Dockerfile, compose file, denylist and teardown choices are checked only by inspection — the AC itself names diff inspection as the check, and the diff meets it; no defect.
  - `[medium]` `[defer]` (verification-gap, other) A failed start leaves mongo and bp_back running — observed twice; grouped with the leftover-containers entry.
  - `[medium]` `[patch]` (verification-gap, other) A later run can reuse a bp_front container with no published port and silently wait out 600 s — observed in the orchestrator's first cold run (PortBindings set, NetworkSettings.Ports `{}`); fixed by adding `--force-recreate` to `webServer.command`, plus a comment line.
  - `[maybe-false]` `[defer]` (blind-hunter) With `stdout: 'ignore'`, a bp_back startup crash may lose its stack trace — logback writes only to the container's stdout, and only container stderr lines reached the e2e log. Unverified: what compose prints to stderr on `--abort-on-container-failure`. To settle it, force a startup crash. Deferred at medium (unverified).
  - `[low]` `[defer]` (blind-hunter) `routing/CLAUDE.md:25` still names `/api/graphiql` as the readiness check — confirmed by grep; agent-context file, so deferred.
  - `[medium]` `[defer]` (blind-hunter) Known risks found in step-03 were not recorded as deferred — grouped with the leftover-containers entry (now in `deferred`) and the portless-container patch.
  - `[medium]` `[patch]` (blind-hunter) A running stack whose health is 503/404 is not reused; compose attaches, and teardown stops it, contradicting the "left untouched" comment — confirmed (Playwright `isURLAvailable` accepts 200-403 only); the comment in `playwright.config.ts` was corrected to state the real behaviour.
  - `[false]` `[reject]` (blind-hunter) Spec `in-review` disagrees with sprint-status `done` — transient mid-review state; finalization sets the spec to `done` before the single commit, so the committed tree is consistent.
  - `[medium]` `[defer]` (blind-hunter) The Verification section expects a passing suite, but cold runs had 4 and then 1 admin failures — same root cause as the D4 flake entry; deferred.
  - `[low]` `[patch]` (blind-hunter) `HealthApiTest` < 5 000 ms does not prove the 2 s timeout — tightened to < 3 500 ms in (c) and (d); HealthApiTest 4/4 green.
  - `[maybe-false]` `[reject]` (blind-hunter) The `CancellationException` rethrow could turn a driver-originated cancellation into 500 — no evidence the Mongo coroutine driver throws a non-call cancellation; if true, 500 is still "not ready" to Playwright (only 200-403 count as ready), so it would only be low.
  - `[low]` `[reject]` (blind-hunter) CallLogging logs every health probe — confirmed (`Monitoring.kt` filters on `/`), but the root logback level is already `trace`, with Mongo heartbeat DEBUG lines every 10 s; probe lines add negligible noise, and excluding them adds a filter branch.
  - `[low]` `[reject]` (blind-hunter) Tests (c)/(d) share one dedicated container — Kotest runs them in declared order; the coupling only affects diagnosis when Docker itself fails, and per-test containers add startup cost and code.
  - `[low]` `[reject]` (blind-hunter) The pwa test could assert `response.fromServiceWorker() === false` instead of 200/`OK` — the `#root` absence plus Ktor's `OK` body already fail on a worker fallback; an extra assertion adds nothing anyone would miss.
  - `[false]` `[reject]` (blind-hunter) `verified_at_commit` pins the story-start commit although measured on the uncommitted tree — the checked grep claims (NARROW_FLOOR_PX lines, custom.bp tokens, etc.) are untouched by this diff, so they hold at `7535617` too; the implementer found the 5-line count already true there.
  - `[low]` `[patch]` (blind-hunter) The deferred-work closures leave stale present-tense text — the retained original text of each of the four closures is now prefixed "Was:", and the webServer-gaps closure notes the leftover-containers residue.
  - `[false]` `[reject]` (blind-hunter) The global-setup comment overstates the auth-slot saving — the comment states two true facts (`/api/health` is outside the limiter; `/api/auth/config` is inside it). The compose limit of 6000 does not make them false.
  - `[low]` `[defer]` (blind-hunter) AGENTS.md lacks the `:4000` probe, and CLAUDE.md prescribes an absent `./gradlew` — confirmed (`ls gradlew` fails); agent-context files, so deferred.
  - `[false]` `[reject]` (blind-hunter) Unused catch parameters and `val env` produce compiler warnings — `gradle :bp_back:compileKotlin --rerun-tasks` emits exactly one warning, in `UserService.kt:65`, none in `Routing.kt`; `val env` predates this story.
  - `[medium]` `[patch]` (edge-case) A running stack answering 503/404 gets compose run over it and is then stopped — same root cause as the reuse-comment entry; comment corrected.
  - `[medium]` `[patch]` (edge-case) The portless reused `bp_front` container burns 600 s — same root cause as the verification-gap entry; `--force-recreate` added.
  - `[medium]` `[defer]` (edge-case) mongo/bp_back stay running after a failed bind — leftover-containers entry, deferred.
  - `[maybe-false]` `[reject]` (edge-case) The 60 s gracefulShutdown could be exceeded — every observed teardown stopped all three containers well within the window; if it ever overran, the only cost is containers left running (low).
  - `[low]` `[reject]` (edge-case) An unpause failure in `finally` masks the assertion — needs a Docker daemon failure mid-test; unlikely in everyday use, and `runCatching` adds code.
  - `[low]` `[reject]` (edge-case) A paused container would break test (d) after a (c) failure — same infra-failure-only cascade as above; rejected for the same reason.
  - `[low]` `[reject]` (edge-case, deletion) Retiring the GraphiQL-through-worker test — same as the intent-alignment entry; denylist still proven.
  - `[medium]` `[patch]` (edge-case, claim) The "left untouched" claim in the config comment is false — comment corrected (reuse-comment group).
  - `[medium]` `[patch]` (edge-case, claim) The "surfaces within seconds" claim fails for a reused portless container — `--force-recreate` added (portless-container group).

## Design Notes

Teardown and stdout/stderr choices (recorded as the AC requires):
- **Foreground compose, not `-d` / `--wait`:** Playwright treats any exit of the command before `url` is ready as fatal. `--wait` also exits (once containers are healthy/started, not once Ktor is warm), so only a long-lived foreground process fits the `webServer` contract.
- **`--abort-on-container-failure`:** a container that crashes on startup (for example a migration error in `bp_back`) ends the command, so the failure surfaces at once instead of Playwright polling a 502 for 600 s.
- **`stdout: 'ignore'`:** attached compose streams every container's logs to stdout. Piping them would drown the test report. **`stderr: 'pipe'`:** compose build, pull and port-bind errors go to stderr, which is exactly the failure output that must surface.
- **`gracefulShutdown` SIGTERM, 60 s:** the default is SIGKILL, which kills the compose client and leaves the containers running. SIGTERM makes compose stop them. 60 s covers three containers' 10 s stop grace. `stop`, not `down`: the named `db_data` volume is always preserved.

## Verification

**Commands:**
- `./gradlew :bp_back:cleanTest :bp_back:test` -- expected: BUILD SUCCESSFUL; `bp_back/build/test-results/test/TEST-com.bagplease.HealthApiTest.xml` shows 4 tests, 0 failures, and total failures across all XML are 0.
- `cd bp_front && npm run lint && npm run build` -- expected: exit 0.
- `docker compose stop; cd bp_front && npm run test:e2e` -- expected: suite executes and passes, with no `exited early`; afterwards `docker ps` shows no bag-please containers.
- `cd bp_front && npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c` -- expected: identical per-project counts before and after the change (measure at story start; the Story 8.6 row read 111 / 111 / 1 / 1), since this story retargets a test rather than adding one.

**Manual checks (if no CLI):**
- The red runs of `HealthApiTest` and the retargeted pwa test are recorded in the Auto Run Result / story record.

## Story Record (2026-09-15)

**Environment note:** the repo has no `./gradlew` wrapper on disk; backend runs used `gradle` from mise (9.7.1), the
same binary `mise/back_test.sh` invokes.

**Baseline (story start, `7535617`):** `npx playwright test --list | … | uniq -c` → **114 / 114 / 1 / 1** (not the
111 of the Story 8.6 row; that row was already stale before this story). Unchanged after the change: 114 / 114 / 1 / 1.

**Red — `HealthApiTest` before `Routing.kt` changed** (`gradle :bp_back:cleanTest :bp_back:test --tests
"com.bagplease.HealthApiTest"`): `4 tests 4 failures`, every one
`AssertionFailedError: Response should have status 200 but had status 404.`

**Red — retargeted pwa test against the pre-change production image** (`docker compose up -d --build` at the
unchanged backend; `curl :2080/api/health` → `404`): `2 failed` — `[chromium]` and `[mobile]` `pwa.spec.ts:161`
`NFR-E7-7 — /api/health reaches Ktor while the worker controls the page`, both `Expected: 200 / Received: 404`.

**Green — backend** (`gradle :bp_back:cleanTest :bp_back:test`): BUILD SUCCESSFUL; `TEST-com.bagplease.HealthApiTest.xml`
4 tests, 0 failures; all XML 119 tests, 0 failures, 0 errors.

**Green — frontend gates:** `npm run lint` exit 0, `npm run build` exit 0.

**Design docs:** both check blocks re-run at the final code state. `DESIGN.md` §13: every figure holds.
`EXPERIENCE.md` §14: one false claim corrected — `NARROW_FLOOR_PX` is 5 lines, not 6 (`layout.ts` has no `:100`
comment). `verified_at_commit` → `7535617913c51f033038892dd4153917c9f8170d` in both.

**Unchanged by `git diff`:** `bp_back/Dockerfile`, `docker-compose.yaml`, the `navigateFallbackDenylist` /
`runtimeCaching` values.

**AC1 — cold start** (no bag-please containers before; `npm run test:e2e`): zero `exited early`; the suite executed
(`202 passed, 4 failed, 22 skipped, 2 did not run`, 3.0 m); the webServer log shows compose stopping the containers at
teardown, and `docker ps` afterwards lists no bag-please container. The 4 failures are all `[chromium] admin.spec.ts`,
all `getByTestId('create-user-dialog') Expected: 0 Received: 1 Timeout: 5000ms`: the size-driven `createUserViaUi`
flake (Epic 7 action D4, routed to Story 9.2), with 3023 `users` rows in `db_data`. `admin.spec.ts --project=chromium`
re-run alone against the same stack: `4 passed`. `2 did not run` is the `registration-toggle-*` chain behind a red
`chromium`, as documented in `playwright.config.ts`.

**AC2 — port held:** `python3 -m http.server` bound to `127.0.0.1:2080` (`/api/health` → 404), then
`npm run test:e2e`: failed after **8 s** wall time (images cached) with `[WebServer] … failed to bind host port
127.0.0.1:2080/tcp: address already in use` and `Error: Process from config.webServer was not able to start. Exit code:
1`. **Residue:** compose had already started `mongo` and `bp_back` before `bp_front` failed to bind, and exiting on the
error does not stop them; they were left running and stopped by hand. Not in this story's contract (AC2 asks only for a
fast, visible failure), but a failed start is not self-cleaning.

**AC3 — running stack:** `curl http://localhost:2080/api/health` with no credentials → `OK` `200`;
`docker compose pause mongo` → `503` in **2.007 s**; after unpause → `200`.

**Step-03 re-verification (orchestrator, independent of the implementer's report):**
- Backend `gradle :bp_back:cleanTest :bp_back:test`: 119 tests, 0 failures, 0 errors; `HealthApiTest` 4/4.
- `npm run lint` exit 0, `npm run build` exit 0, `--list` counts 114 / 114 / 1 / 1.
- First cold `npm run test:e2e` **timed out after 600 s**. Root cause was environmental: `bag-please-bp_front-1` (created 2026-09-08) had `PortBindings` `127.0.0.1:2080` but `NetworkSettings.Ports` `{}`. Nothing listened on `:2080`, and compose reused that container, which the implementer's AC2 port-held experiment had left without a published port. After `docker compose up -d --force-recreate bp_front`, `/api/health` → 200 within 2 s.
- Cold rerun (all containers stopped first): 0 × `exited early`, **205 passed, 1 failed, 22 skipped, 2 did not run** in 1.5 m; teardown log `Compose Stopping Gracefully`; 0 bag-please containers running afterwards. The single failure is `[chromium] admin.spec.ts:219` at `createUserViaUi` (`create-user-dialog` Expected 0 / Received 1, 5000 ms), the known size-driven D4 flake owned by Story 9.2 and not touched by this diff.
- Port-held re-run: `python3 -m http.server` on `127.0.0.1:2080` (404) → `npm run test:e2e` failed in **8 s** with `failed to bind host port 127.0.0.1:2080/tcp: address already in use` / `Process from config.webServer was not able to start`. It again left `bp_back` + `mongo` running. The stack was restored with `stop` + `--force-recreate bp_front` (health 200) and stopped.
- **Risk surfaced:** after a failed port bind, the next run can reuse a `bp_front` container with no published port and then waits out the full 600 s silently; `--abort-on-container-failure` does not catch it.

## Auto Run Result

**Status:** done (review pass 1, `review_loop_iteration` 0). Not pushed.

**Summary:** An unauthenticated, non-rate-limited `GET /api/health` (Mongo `ping` inside `withTimeout(2.seconds)`, `200 OK` / `503 UNAVAILABLE`) is the backend readiness probe. Playwright's `webServer` now runs `docker compose up --build --force-recreate --abort-on-container-failure` in the foreground and waits on `http://localhost:2080/api/health`, with stdout ignored, stderr piped and a SIGTERM stop at teardown. Readiness references (global setup, the PWA denylist test, docs) moved from `/api/graphiql` / `/api/auth/config` to `/api/health`.

**Files changed:**
- `bp_back/src/main/kotlin/com/bagplease/plugins/Routing.kt` -- the `get("/health")` route outside `authenticate`/`rateLimit`.
- `bp_back/src/test/kotlin/com/bagplease/HealthApiTest.kt` -- new: 200 OK, no rate limit (20 requests), 503 in < 3.5 s with a paused Mongo and with a stopped Mongo.
- `bp_front/playwright.config.ts` -- foreground compose with `--force-recreate`, `url` set to `/api/health`, stdout/stderr and teardown choices recorded in the comment.
- `bp_front/e2e/global-setup.ts` -- readiness poll moved to `/api/health`.
- `bp_front/e2e/pwa.spec.ts` -- denylist test retargeted to an unauthenticated `/api/health` navigation; unused `loginApi` import removed.
- `bp_front/vite.config.ts`, `bp_front/CLAUDE.md`, `AGENTS.md` -- readiness wording now names `/api/health` (denylist values unchanged).
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/DESIGN.md`, `EXPERIENCE.md` -- re-verified; `verified_at_commit` bumped; `NARROW_FLOOR_PX` count corrected from 6 to 5.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- four routed entries closed in place ("Was:" prefix, residue noted).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `epic-9` in-progress, `9-1` done, F20 item 36 done.
- `_bmad-output/implementation-artifacts/epic-9-context.md` -- new compiled Epic 9 context.

**Review findings:** 33 findings (high 0, medium 12, low 13, false 5, maybe-false 3).
- Patches applied, 4 groups:
  - (medium) `--force-recreate` added so a reused bp_front container with no published port cannot silently burn 600 s;
  - (medium) the config comment corrected: a stack answering 503/404 is not reused and is stopped at teardown;
  - (low) `HealthApiTest` down-case bounds tightened from 5 000 to 3 500 ms;
  - (low) deferred-work closures prefixed "Was:".
- Deferred, 5 groups: see frontmatter `deferred` (leftover containers after a failed start; possibly hidden crash stack trace, unverified; D4 admin flake; stale `routing/CLAUDE.md:25`; AGENTS.md `:4000` probe / absent `./gradlew`).
- Rejected: every rejected or false finding is logged with its reason in the Review Triage Log above (rootPath set by hand, GraphiQL-through-worker coverage, the transient status mismatch, cancellation rethrow, probe call logging, shared dedicated container, `fromServiceWorker` assertion, `verified_at_commit` pin, global-setup comment, compiler warnings, the 60 s graceful-shutdown window, unpause failure cascade).

**Follow-up review recommendation:** `true`. Patched counts by verdict: high 0, medium 2, low 2. The unverified risk: `--force-recreate` recreates all three containers on every launched run, and the patched command has not completed a full cold E2E run to teardown (see Verification).

**Verification performed:**
- Before the patches: backend `cleanTest test` 119/0/0; lint and build exit 0; counts 114 / 114 / 1 / 1; cold `npm run test:e2e` 205 passed / 1 failed (D4 flake) / 22 skipped / 2 did not run, 0 `exited early`, teardown stopped all containers; port-held run failed in 8 s with the bind error.
- After the patches: backend `cleanTest test` 119 tests, 0 failures, 0 errors (`HealthApiTest` 4/4); `npm run lint` 0; `npm run build` 0; `--list` counts 114 / 114 / 1 / 1; `webServer.command` confirmed at `playwright.config.ts:98`.
- Cold `npm run test:e2e` on the patched config: compose recreated mongo, bp_back and bp_front; `/api/health` became ready; the suite was executing (test 27/230), with 0 `exited early`, when the host killed the run for low memory (30 GiB RAM, 6.1 GiB swap in use, the user's own Chrome and a Playwright MCP session also running). It was not re-run, to avoid a second OOM kill. The kill left bp_back and mongo running; they were stopped by hand (`docker compose stop`).

**Residual risks:**
- A failed or killed run leaves mongo/bp_back running (deferred).
- The patched command's full cold run to teardown is unobserved (OOM kill); the readiness wait and teardown were observed on the pre-patch command, which differs only by `--force-recreate`.
- The E2E gate stays red until Story 9.2 fixes the D4 create-user flake.
- Whether a bp_back startup crash surfaces its stack trace with `stdout: 'ignore'` is unverified (deferred).
- Backend commands in the docs say `./gradlew`, which does not exist; mise's `gradle` 9.7.1 was used.

