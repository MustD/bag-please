<!-- bmad:context -->
<!-- Verified 2026-09-07 against 1bb60cb. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## bag-please

Shopping-list / store-management app: Kotlin/Ktor GraphQL backend, Vite + React 19 SPA, MongoDB, Caddy, all on Docker
Compose. Architecture, commands and per-layer conventions are in the root and per-directory `CLAUDE.md` files, which
load with this one — this block carries only what those do not.

## Policy

- Production configuration lives on the server only, deliberately. `docker-compose.yaml` is the dev / E2E topology and
  nothing else — never infer production behaviour from it, and never add production credentials, compose files or the
  TLS edge wiring to this repo. `KTOR_RATE_LIMIT_ATTEMPTS: 6000` there is a dev/E2E override of `application.yaml`'s
  default `5`; do not "fix" it.
- Anything deferred goes in `_bmad-output/implementation-artifacts/deferred-work.md`, not only in a story file.
- Feature branches are named `feature/<description>`.

## Where things are

- Planning: `_bmad-output/planning-artifacts/` (`prd.md`, `epics.md`, `architecture.md`). Story records,
  `sprint-status.yaml` and the `deferred-work.md` ledger: `_bmad-output/implementation-artifacts/`.
- Backend sources are Kotlin under `bp_back/src/main/kotlin/`. The four `GraphQL*Exception` classes are the only Java,
  under `bp_back/src/main/java/com/bagplease/plugins/`.
- Before touching Playwright projects, tags or viewports, read the header comments in `bp_front/playwright.config.ts` —
  the four-project topology, the 320 px mobile floor and the count invariants are documented there, not here.
- Shared E2E helpers are in `bp_front/e2e/support/` (`ui.ts` UI-driving, `api.ts` setup-only, `layout.ts`, `png.ts`).
  Never re-declare one in a spec.

## Running and verifying

- Always `./gradlew :bp_back:cleanTest :bp_back:test`. Bare `:bp_back:test` (and `mise run back:test`) is
  `UP-TO-DATE`-cacheable: it prints `BUILD SUCCESSFUL`, executes nothing, and leaves the previous run's JUnit XML in
  place, so the totals you read next are stale.
- Read backend test totals from `bp_back/build/test-results/test/TEST-*.xml` — Kotest prints no console summary.
- Backend tests need a running Docker daemon (Testcontainers); without one you get a Docker socket error, not a test
  failure. `--tests "com.bagplease.SomeTest"` runs one whole Kotest class and is the cheap iteration loop.
- JDK 25 is required locally (`jvmToolchain(25)`); a wrong JDK gives a cryptic toolchain-resolution error, not a
  version message.
- Backend readiness check:
  `curl -o /dev/null -w '%{http_code}' -H "Authorization: Bearer <admin token>" http://localhost:2080/api/graphiql`
  → `200`. A plain browser navigation to `/api/graphiql` returns **401 on a healthy backend** — `graphiQLRoute()` sits
  inside `authenticate(...)` — so do not read that 401 as "the backend is down".
- Registration defaults to OFF (persisted in Mongo); enable it with the `setRegistrationEnabled(enabled: true)`
  mutation as admin. `admin`/`admin` is blocked from every list operation and from change-password, so register a
  regular user for any list or account flow.
- Run one Playwright suite at a time against a given `:2080` backend. `registrationEnabled` is a single shared Mongo
  document, so a second concurrent suite (a TLS-edge run, or `--shard`) re-creates the race the four-project topology
  exists to close.

## Conventions that differ from defaults

- `bp_front/src` imports use the `@/*` alias; **`bp_front/e2e` must use relative imports** — `tsconfig.e2e.json`
  declares no `paths`, so an `@/` import type-checks and then fails at runtime.
- `bp_front/e2e/` is inside both quality gates: `npm run lint` is `eslint .`, and `npm run build`'s `tsc -b`
  type-checks the specs through `tsconfig.e2e.json`. A spec-file type error fails the production image build.
- Type-aware linting is off (`tseslint.configs.recommended`, no `projectService`), so `no-floating-promises` never
  runs. **Await every Playwright web-first matcher by hand** — a forgotten `await` passes both gates and asserts nothing.
- The ESLint flat config's `ignores` array is the only exclusion mechanism; `.gitignore` is not consulted. Add new
  output directories there, not to the lint script's glob. The `bp/e2e-playwright` override must stay last.
- TypeScript is held at 6.x — do not bump to 7. `typescript-eslint` refuses TS 7 in its own runtime check, so
  `npm run lint` dies at module load with zero files linted and no `overrides` trick reaches it;
  `npm install typescript@7` still exits 0, so the install is not the signal. Measurements: `deferred-work.md`,
  "Deferred from: Story 7.10".
- The Gradle wrapper is held at 9.6.1 to match `FROM gradle:9.6.1-jdk25` in `bp_back/Dockerfile`; the shipped image
  builds with the image's Gradle, so the wrapper cannot move alone.
- Jackson 2 and Jackson 3 both sit on the backend runtime classpath by design — Jackson 2 via
  `ktor-serialization-jackson` serves `/api/auth/*`, Jackson 3 arrives with graphql-kotlin 10. Do not "unify" them.
- An enumerated field is an enum in the **domain** model only; the Mongo and GQL models each keep their own `String`,
  so the SDL never moves and no data migration is needed. A repository `Updates.set` has no mapper in it and must pass
  `.name` explicitly, and a BSON filter must use `Status.PENDING.name`, never a bare literal.
- A service rejects with `IllegalArgumentException`. The `GraphQL*Exception` classes are gql-layer only — importing one
  into a service is a service→plugins layering violation.

## Known pitfalls

- **`_id` representation differs per collection.** `users` stores a BSON UUID, so `UserRepository` filters with the
  `UUID` object; items, categories, lists and app-config store a String and filter with `id.toString()`. A mismatched
  filter matches nothing and reports nothing, and `UUIDSerializer` accepts both on read, so it never surfaces there —
  copy the form the collection's own repository already uses.
- Every new `testApplication { }` must call `setUpJwt()` and `setUpMongo(container)` before `application { module() }`.
  `bp_back/src/test/resources/application.yaml` exists but `testApplication` does not load it; without them `module()`
  fails on `Property jwt.admin_login not found`.
- Install `ContentNegotiation` exactly once, in `securityRoutes()`. graphql-kotlin installs its own at route scope, so
  adding it at Application level, or in a second `Application` extension sharing the `/` routing root, throws
  `DuplicatePluginException` at boot.
- A new Storage class must implement the `if (synced.not()) { … synced = true }` guard and call `sync()` at the top of
  every read and write. Omitting it means the in-memory store starts empty and never recovers state after a restart.
- New Query/Mutation/Subscription classes are **not** auto-discovered — register them in `GQL.kt`'s `configureGql()`.
  Likewise register anything injected with `by dependencies` in the `dependencies { }` block; missing registration is a
  runtime error, not a compile error.
- An upsert service **merges the stored row** with only the fields the GraphQL input carries (allowlist); never
  reconstruct the entity from the input. Server-owned fields are meaningless on the incoming object, and three shipped
  bugs (BUG-E6-1/2/3) came from the reconstruct form. `ItemService.saveItem` is the reference shape.
- Backend tests run in parallel against a shared Mongo, and the E2E `db_data` volume persists across runs. Assert only
  on records your test created, keyed by the UUIDs it generated — never on totals, and never by human-readable names
  like `"Milk"`.
- `browser.newContext()` does **not** inherit the project's `use` block, so a hand-built context silently runs at a
  desktop viewport on the `mobile` project and voids the mobile gate. Prefer the `page` fixture; when a second actor
  needs its own context, put the actor whose rendering the mobile gate must cover on `page`.
- A new E2E test is unproven until observed **failing**: break the behaviour it guards, rebuild the production image,
  confirm red on both viewport projects, then restore. Six of Epic 6's seventeen review patches were assertions that
  could not fail for the reason they were written.

<!-- /bmad:context -->
