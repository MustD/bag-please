---
project_name: 'bag-please'
user_name: 'md'
date: '2026-05-07'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules']
status: 'complete'
rule_count: 93
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Backend
- Kotlin 2.3.21, JVM toolchain 25 (JDK 25) — deliberately **not** bumped by Story 7.7's sweep; it moves in Story 7.12
  with `graphql-kotlin` 10. **The declared version is not the resolved one:** since Story 7.7, `arrow-core` 2.2.3
  declares `kotlin-stdlib:2.4.0`, so the runtime classpath carries **stdlib 2.4.0 with reflect 2.3.21** — a split
  Kotlin runtime, green across the whole suite, filed in the ledger. Read the resolved versions from
  `./gradlew :bp_back:dependencies --configuration runtimeClasspath`, never from `libs.versions.toml` alone
- Ktor 3.5.2 (Netty engine, App Router style plugins)
- graphql-kotlin 9.3.0 (ExpediaGroup)
- MongoDB Kotlin Coroutine Driver 5.9.2 + bson-kotlinx 5.9.2
- Arrow-kt 2.2.3 (arrow-core, arrow-fx-coroutines)
- Logback 1.6.2; Kotest 6.2.4 (runner-junit5, property, assertions-ktor, extensions-testcontainers);
  Testcontainers 2.0.5; bcrypt 0.10.2
- Gradle wrapper 9.6.1, **held** while 9.7.0 exists: `bp_back/Dockerfile:1` is `FROM gradle:9.6.1-jdk25` and the shipped
  image builds with the image's Gradle, so the wrapper cannot move alone (ledger entry, Story 7.7)
- Kotlin Serialization (plugin 2.3.21) — used only for MongoDB BSON, not HTTP
- Jackson — used for HTTP content negotiation and WebSocket frames
- Gradle with shared version catalog at `gradle/libs.versions.toml`

### Frontend (rebuilt from scratch in Epic 5 — Vite SPA, no Next.js)

- Vite 8.2.1 + `@vitejs/plugin-react` 6.0.5 (Story 7.9; plugin 6 peers on `vite ^8.0.0` — do not bump one without the
  other). **Vite 8 is Rolldown-based, not esbuild/rollup-based:** `rolldown` 1.2.4 + `lightningcss` 1.33.0 + `postcss`
  8.5.26 replace them, and **`esbuild` and `rollup` are gone from the lockfile entirely** — `esbuild` is now only an
  optional peer. The native bindings are platform-optional packages, so the `node:26-alpine` image resolves the
  **-musl** variants and a glibc host build proves nothing about it; `docker compose build bp_front` is the real check.
  `vite.config.ts` carries no `build`/`rollupOptions`/`optimizeDeps`/`esbuild`/`css` block and must not gain one to
  steer Rolldown. The build still emits **no CSS file** (all styling is emotion CSS-in-JS)
- **Vite 8 raised the shipped browser floor, and no gate in this project can see it.** Measured from both packages,
  not recalled: Vite 7.3.6's `ESBUILD_BASELINE_WIDELY_AVAILABLE_TARGET` is
  `["chrome107","edge107","firefox104","safari16"]`; Vite 8.2.1 resolves this project's actual config to
  `["chrome111","edge111","firefox114","safari16.4","ios16.4"]` (`vite.resolveConfig(…, 'build').build.target`), with
  `build.minify` now `"oxc"`. **Safari/iOS 16.0–16.3, Chrome/Edge 107–110 and Firefox 104–113 were dropped by the
  upgrade**, silently: Playwright runs Chromium only, and identical screenshots on a current browser cannot detect a
  narrowed support floor. Accepted as a normal consequence of a build-tool major rather than pinned back — but it is a
  *decision*, and it matters more than usual here because Story 7.14 makes this an installable mobile app. Re-check the
  resolved `build.target` on every future Vite major and record the delta
- `@types/node` 26.2.0 — kept on the **same major as the Node that builds the project** (`mise.toml:6` = `26.4.0`,
  `bp_front/Dockerfile:7` = `node:26-alpine`). A types major behind the runtime type-checks against APIs the build no
  longer has. `tsc -b` is build-mode and caches per project under `node_modules/.tmp/`, so a types bump must be gated
  on `npx tsc -b --force` or it proves nothing
- React 19.2.8 / react-dom 19.2.8
- react-router-dom 7.18.x — **declarative API** (`<BrowserRouter>` + `<Routes>`), not `createBrowserRouter`
- TypeScript 6.0.3 (strict mode, `moduleResolution: bundler`; `baseUrl` is deprecated in TS 6 — `paths` resolves without
  it), and **`6.0.3` is already the newest stable 6.x**, so there is no patch to take inside the major. **HELD at 6
  while `7.0.2` is `latest` (Story 7.10, 2026-08-15) — do not bump it, and do not re-derive why.** The blocker is
  `typescript-eslint`: **no published version admits TypeScript 7.** Swept across all 83 published
  `typescript-eslint >=8.0.0` releases the `typescript` peer takes four values, the highest bound being
  `>=4.8.4 <6.1.0` (8.67.0 `latest` *and* 8.67.1-alpha.4 `canary`); upstream issue #10940 tracks support for TS
  **>=7.1**, never 7.0. Three facts an agent would otherwise burn a pass rediscovering: (1) **TS 7 is the native (Go)
  port and ships no JavaScript compiler API** — `require('typescript')` yields exactly
  `['version','versionMajorMinor']`, `ts.createProgram` is `undefined`, and **`tsserver` is gone from `bin/`** (6.0.3
  ships both), so editor tooling is affected too and no gate here can see that; (2) **`npm install typescript@7.0.2`
  SUCCEEDS, exit 0** — npm only `warn`s `ERESOLVE overriding peer dependency` for an explicitly-versioned target, so
  the peer conflict does not stop you; `npm run lint` then dies at **module load** with
  `Error: typescript-eslint does not support TS 7.0.` (exit 2, **zero files linted** — the whole static lint gate,
  including the load-bearing `react-hooks/set-state-in-effect` rule); (3) **the codebase itself is already TS-7-clean**
  — `tsc -b tsconfig.json --force` under 7.0.2 exits 0 with zero diagnostics across all three projects, under unchanged
  `strict`/`noUnusedLocals`/`noUnusedParameters`, so the hold is about the linter, not the code, and the eventual bump
  is expected to be one line. The documented side-by-side/dual-TypeScript workaround is **refused** — it would
  *downgrade* the linting compiler to `@typescript/typescript6@6.0.2`. Full record and the re-check trigger:
  `deferred-work.md`, "Deferred from: Story 7.10". **The hold does not block Story 7.11** — `typescript-eslint@8.67.0`
  peers `eslint: "^8.57.0 || ^9.0.0 || ^10.0.0"`
- Apollo Client 4.2.11 (+ rxjs 7.8.2 peer) — plain React, no SSR integration package
- MUI (Material UI) 9.3.1 + @mui/icons-material 9.3.1
- Emotion 11.14.x (MUI peer dependency)
- graphql 16.14.2 + graphql-ws 6.2.1
- graphql-codegen CLI 7.2.0 + client-preset 6.1.3
- @playwright/test 1.62.x (E2E; no unit/component framework exists) — a runner bump needs
  `npx playwright install chromium` or the suite fails with "Executable doesn't exist"
- eslint 9.39.5 / @eslint/js 9.39.5 / typescript-eslint 8.67.0 / eslint-plugin-react-hooks 7.1.1 /
  eslint-plugin-react-refresh 0.5.4 / globals 17.11.0
- **`package.json` mixes pinned and caret entries and `bp_front/Dockerfile` runs `npm ci`, so the LOCKFILE is what
  ships.** Read installed versions from `package-lock.json`, never from `package.json`

### Infrastructure
- MongoDB 8 (all environments — dev, prod, and Testcontainers)
- **Caddy** serves the built SPA and proxies `/api` — single entrypoint on `127.0.0.1:2080` (replaced nginx in Epic 5)
- An external host edge proxy terminates TLS at `https://bag-please.localhost` → `127.0.0.1:2080`; not managed by this
  repo (see `routing/edge-proxy.md`). HTTPS is required for auth to persist — the refresh cookie is `Secure` +
  `SameSite=Strict`, so a plain-`http` LAN IP silently fails to keep a session.
- Docker Compose for orchestration

## Critical Implementation Rules

### Language-Specific Rules

#### Kotlin (Backend)
- **Gradle wrapper at project root** — run all backend commands from `bp_back/` but use the wrapper at the repo root: `../gradlew build`, `../gradlew run -t`, `../gradlew test`
- **Kotlin Serialization is BSON-only** — do not use `@Serializable` for HTTP request/response bodies; Jackson handles those via `ktor-serialization-jackson`
- **UUID identity** — all domain IDs are `java.util.UUID`; never use `String` or `Long` as an ID type in the domain/storage layer
- **`@Suppress("unused")`** on GQL Query/Mutation/Subscription classes — graphql-kotlin resolves them reflectively; the IDE will incorrectly flag them as unused
- **`@Suppress("RedundantSuspendModifier")`** on Storage methods — suspend is intentional even when the body is synchronous (for future coroutine compatibility)
- **Arrow-kt is available** but not yet widely used; prefer it for error handling over throwing exceptions where practical
- **Ktor DI** — dependencies are registered via `dependencies { }` block and injected with `by dependencies`; do not use constructor injection at the Application level

#### TypeScript (Frontend)
- **TypeScript strict mode is on** — no `any`, no implicit nulls; all props must be fully typed
- **Path alias `@/*`** maps to `src/*` (set in both `tsconfig` and `vite.config.ts`) — always use `@/` imports, never
  relative `../` chains
- **`moduleResolution: bundler`** — do not use `node` or `node16` resolution patterns
- **No `"use client"` directives** — this is a client-only SPA; there are no Server Components. If you see one, it is
  leftover Next.js residue and should be deleted
- **Never edit `src/__generated__/`** — all files there are auto-generated by graphql-codegen; run `npm run generate`
  (requires the stack on `:2080` + a fresh `CODEGEN_TOKEN`) to regenerate after schema changes

### Framework-Specific Rules

#### Ktor / graphql-kotlin (Backend)
- **Entity registration** — new Query/Mutation/Subscription classes must be added to the `packages`, `queries`, `mutations`, and `subscriptions` lists in `GQL.kt:configureGql()`; they are not auto-discovered
- **DI registration** — before injecting anything with `by dependencies`, register it in the `dependencies {}` block in the relevant plugin setup; failing to register produces a runtime error, not a compile error
- **Auth boundary** — all GraphQL HTTP routes are wrapped in `authenticate(authMethod)`. WebSocket subscriptions **are**
  authenticated (delivered in Story 4.2): the JWT arrives in `connection_init` as `connectionParams.Authorization:
  "Bearer <token>"` and the socket is closed with code `4401` on a bad token. Per-list scoping is enforced at two
  points —
  `verifyMembership` on subscribe, plus a `takeWhile` membership re-check on every emitted event, so a revoked member's
  stream terminates on the next event
- **GQL scalar IDs** — use `com.expediagroup.graphql.generator.scalars.ID` for GraphQL ID fields; convert to/from `UUID` in the mapper, never pass `ID` into the service or storage layer
- **`@GraphQLName`** — use on GQL model classes when the class name would otherwise expose implementation details (e.g. `GqlItem` → `@GraphQLName("Item")`)
- **Application config** — all env-configurable values use Ktor's `"$ENV_VAR:default"` syntax in `application.yaml`; read them via `environment.config.property(...)` in plugins, never hardcode
- **SharedFlow per-entity pattern** — each entity's service needs two `MutableSharedFlow` instances (updates + deletes) declared as `private val` properties; they are merged in the GQL Subscription class with `merge(updates, deletions)`; declaring a flow inside a function creates a new instance per call with zero subscribers
- **Storage lazy sync is mandatory** — every new Storage class must implement the `if (synced.not()) { ... synced = true }` guard in `sync()` and call `sync()` at the start of every read/write method; omitting it means the in-memory store starts empty and never recovers state after restart
- **Mongo model `_id` field** — must be declared as `@SerialName("_id") @Serializable(with = UUIDMongoSerializer::class) val id: UUID`; naming it `id` without `@SerialName` causes MongoDB to generate its own ObjectId instead of using the provided UUID
- **MongoDB filter with UUID** — use `Filters.eq("_id", item.id.toString())` (string), not the UUID object directly; the UUID object in a filter returns zero results
- **MongoDB upsert `$set` payload** — exclude `_id` from the `Updates.combine()` call; including it causes `"Performing an update on the path '_id' would modify the immutable field"` error
- **Mapper access pattern** — mappers are `object` singletons; call as `GqlItemMapper.mapItemToGql(item)`, never `GqlItemMapper()` (that's a constructor call and won't compile)
- **GQL Subscription flow mapping** — the flow exposed by a Subscription class must map domain types to GQL types via the mapper; exposing the domain type directly will fail schema generation or serialize incorrectly
- **An upsert service method MERGES the stored row; it never reconstructs the entity from the input** (Story 7.4, the
  shape to copy for every future entity). `ItemService.saveItem` loads the stored row with
  `storage.getByIdCached(id, listId)` and, when it exists, `stored.copy(...)`s onto it **only the fields the GraphQL
  input carries** — for `ItemInput` that is exactly `name`, `checked`, `category`, `store`, `recurring`. Everything
  else on `Item` is **server-owned**: `addedBy`, `checkedAt`, `deleted`, `deletedAt` come from storage on an update
  and are *meaningless* on the incoming object, because `GqlItemMapper.mapItemFromInput` builds a fresh `Item` and you
  cannot tell "absent from the input" from "defaulted" inside the service. The direction matters and is not a style
  choice: **copy the input onto the stored row (allowlist)**, never `item.copy(addedBy = stored.addedBy, …)`
  (denylist) — the denylist form silently regresses the next server-owned field somebody adds. Three shipped
  production bugs (BUG-E6-1/2/3) came from the reconstruct form. `checkItem`, `uncheckItem` and `runSchedulerCycle`
  call `storage.save` directly and never route through `saveItem`; they already `copy()` the stored item and are the
  reference pattern
- **Create-vs-update is discriminated by EXISTENCE IN STORAGE, never by presence of an id.** Client-supplied UUIDs
  mean `GqlItemInput.id` is non-nullable and the frontend calls `crypto.randomUUID()` for **new** items too, so
  "reject an id that does not exist" rejects every add — measured, it turned **16 of the 25 `ItemLifecycleTest` tests
  red** on `Exception while fetching data (/saveItem) : Item <uuid> does not exist`. `getByIdCached` hit → update
  branch, miss → create branch
- **`saveItem`'s two rejections are scoped differently, and the asymmetry is deliberate.** A **cross-list id** (the id
  exists globally but on another list) is rejected on **every** call — `ItemRepository.save`'s filter is `_id` only,
  with no `listId` clause, so an unguarded upsert silently *relocates* the item; the global point read
  `ItemRepository.findById(id)` exists solely to see that case, because `getByIdCached` is list-scoped and misses it.
  A **category that does not belong to the list** is rejected on the **update branch only** (`md`'s ruling A,
  2026-08-10): that is the actual shape of the bug (a stale edit dialog), and guarding creates too would fail 29
  existing `saveItem` test sites across six files. The create-branch hole is knowingly open, filed in
  `deferred-work.md`, and pinned by a tripwire test so a later "tightening" fails one obvious test instead of 29
  unrelated ones. **Both rejections must `throw` before `itemUpdateChannel.emit(...)`** — the subscription broadcasts
  whatever is emitted, so emitting on a rejected save pushes a `SAVED` event for a write that never happened
- **An enumerated field is an enum in the DOMAIN model only; the Mongo model and the GQL model both keep their own
  `String`.** This is the codebase's mapper-boundary convention, established by `Recurring` and generalised by
  `MemberStatus` (Story 7.6). The shape, all four parts required: (1) the enum is its own one-line file in the entity
  package (`entity/item/Recurring.kt`, `entity/list/MemberStatus.kt`); (2) **the constant names are byte-identical to
  the persisted strings** — that identity is the entire wire-safety argument and the only thing worth pinning with a
  test; (3) conversion happens at the mapper on read (`Recurring.valueOf(it)`, `MemberStatus.valueOf(mongo.status)`) and
  via `.name` on write; (4) `Mongo{Entity}.field` stays `String`/`String?` and `Gql{Entity}.field` holds its **own**
  `String`, so **the GraphQL SDL never moves and no data migration is needed**. **Never put the enum at the persistence
  layer:** `kotlinx-serialization` throws `SerializationException` on an unknown enum value, so one unexpected row would
  fail an entire common query — for `list_members` that is `findActiveByListId`, feeding six `ListApi` call sites, i.e.
  the whole `lists` query for every member of that list. **Watch the write paths that have no mapper.** A repository
  `Updates.set(...)` is a domain→Mongo write with no mapper in it and must pass `.name` explicitly
  (`ItemRepository.kt:60`, `ListMemberRepository.kt:40`). Measured **twice**, so nobody re-litigates it *and nobody
  over-generalises it*: with an enum carrying no `@SerialName` overrides, passing the *enum* there was **not** a
  corruption bug — `org.bson.codecs.EnumCodecProvider` is in the default registry and encoded it to the same BSON
  string, and Story 7.6's persistence test stayed green under that revert. Story 7.6 measured it on driver
  `mongodb 5.5.1`; **Story 7.7 re-measured it on `mongodb 5.9.2` and the result is unchanged** —
  `ListMemberRepository.kt:40` reverted to bare `member.status`, `./gradlew :bp_back:cleanTest :bp_back:test --tests
  "com.bagplease.ListSharingTest"` → exit 0, `ListSharingTest 18 0 0 0`, including the raw-BSON assertion
  `acceptedDoc["status"] shouldBe "ACCEPTED"`; `EnumCodec`/`EnumCodecProvider` are still present in `bson-5.9.2.jar`
  and `MongoConnection.kt:29-38` still installs no custom `CodecRegistry`. Read it as a two-point measurement, not a
  law — and note **both data points sit inside driver major 5**, so the trigger stays **any driver bump**, not
  "the next major".
  `.name` is therefore mandatory as an explicitness/independence choice — it is what keeps the stored bytes from
  depending on a driver default — while the thing a test can actually pin is the constant-name identity in (2).
  A BSON filter on such a field must also use `MemberStatus.PENDING.name`, never a bare literal
  (`ListMemberRepository.kt:50,63`); note that filtering status **at the database** is what keeps `valueOf`'s throw
  unreachable on the hot paths, while an `_id`-only lookup like `findByListIdAndUserId` stays exposed (filed in
  `deferred-work.md`, not fixed)
- **`ListService.deleteList`'s cascade is `items → categories → members → list`, then the three `evict*` calls**
  (Story 7.6 inserted the members step). Every child collection of a list is deleted **before**
  `listRepository.delete(id)`, in the same block. **That ordering is a convention, NOT a safety property — do not repeat
  the rationale this file carried before 2026-08-12, which had it backwards.** The block is four independent Mongo
  deletes with no session, so a throw at `listRepository.delete` leaves a *live* list whose children are already gone;
  and for `list_members` specifically there is no in-memory cache, so "a restart re-syncs it" is false — those rows are
  gone for good. Neither ordering is failure-safe; only a single `ClientSession` transaction would be (filed in
  `deferred-work.md`). The returned delete counts are only surfaced for items and categories; **do not add a new count
  to `DeleteListResult`** for a new child collection, that is a schema change. Orphaned `list_members` rows are
  invisible through the API (`getLists` `mapNotNull`s them away), so a cascade test must count on the **raw**
  collection, must assert a *second* list's rows survive (otherwise it passes on a `deleteMany` with no `listId`
  clause), and must include a **DECLINED** row on the deleted list — DECLINED is the one status `findActiveByListId`
  cannot see, so it is what a status-filtered `deleteMany` would strand with every other assertion still green
  (measured: that mistake yields `expected:<0L> but was:<1L>`). **Deleting a USER still leaks membership rows** —
  `UserService.adminDeleteUser` has no equivalent cascade; that is open, not fixed
- **A service rejects with `IllegalArgumentException`, never with a `GraphQL*Exception`.** The four
  `GraphQL*Exception` classes live in `bp_back/src/main/java/com/bagplease/plugins/` and are imported **only** by
  `*/gql` files; importing one into a service is a service→plugins layering violation. Consequence to accept
  knowingly: a plain throw surfaces as graphql-java's default `ExceptionWhileDataFetching` with **no
  `extensions.code`**, so the frontend can only branch on the message string (`graphqlErrorMessage` strips the
  `Exception while fetching data (/field) : ` wrapper). Arrow's `either { }` captures `Raise` shifts, **not** thrown
  exceptions, so the throw escapes the block entirely and the caller's `fold` never runs — a test that asserts only
  `errors` proves nothing about the write, so always re-read and assert the stored row is unchanged as well

#### Vite SPA / Apollo Client (Frontend)

- **GraphQL operations live in `src/lib/<slice>/<slice>Queries.ts`** (`lib/admin/adminQueries.ts`,
  `lib/lists/listsQueries.ts`) — define all queries, mutations, and subscriptions there using the `graphql()` tagged
  template from `@/__generated__`; codegen scans `src/**/*.{ts,tsx}` to generate typed documents; do not inline
  operations in component files
- **Never create a second Apollo client** — `src/lib/apollo/ApolloProvider.tsx` owns the single client: `split()` routes
  subscriptions to `GraphQLWsLink` (`/api/subscriptions`) and everything else to `HttpLink` (`/api/graphql`). Never
  instantiate another `ApolloClient` or graphql-ws client
- **Real-time updates use `subscribeToMore`** on the parent `useQuery` — never a separate `useSubscription` alongside a
  `useQuery` for the same data. **The merge must be idempotent**: the backend echoes the caller's own actions, and a
  `SAVED` event can carry `deleted === true` (one-timer check-off). Key by `id`: `DELETED` or `SAVED && deleted` →
  remove; otherwise replace-or-append
- **Access token is in memory only — never `localStorage`.** `AuthContext` holds `{username, role, accessToken}`; the
  refresh token is an httpOnly `Secure` cookie (`POST /api/auth/refresh`). Identity comes from decoding the JWT via
  `lib/auth/jwt.ts` — **there is no `me` query and no `/api/auth/me`**
- **`RouteGuard` is the single owner of the redirect to `/auth`.** Never add a competing `navigate('/auth')`:
  react-router 7 defers imperative `navigate()` under `startTransition`, so an urgent `clearAuth()` re-render commits
  first and the guard wins the race (this silently ate two signals during Epic 5). Pass signals as `AuthContext` flags
  (`expired`, `passwordChanged`) and let the guard carry them. All auth-driven redirects use `replace`, never `push`
- **Apollo cache is cleared on logout** (`clearStore()` on the username non-null→null transition) — without it a second
  user signing in in the same tab reads the previous user's cached lists
- **MUI usage** — always consult `mcp__mui-mcp__fetchDocs` / `mcp__mui-mcp__useMuiDocs` MCP tools before writing or
  editing MUI components; do not guess at v9 API from v5/v6 memory. v9 specifics learned the hard way: inputs take
  `slotProps={{ htmlInput: { 'data-testid': … } }}` (not legacy `inputProps`), and `Switch`'s `slotProps.input` is
  strictly typed and rejects `data-testid` — put the testid on the root and select `[data-testid="…"] input`
- **No `useEffect` state-sync** — `eslint-plugin-react-hooks` v7's `react-hooks/set-state-in-effect` forbids it. Use
  render-phase adjustment or query-derived state instead
- **Client-supplied UUIDs** — categories and items are upserted with a client-generated `crypto.randomUUID()`; lists get
  their id from the server (`createList`)
- **Where `/` resolves to has exactly ONE implementation: `useHomePath(mode)` in `src/lib/lists/homePath.ts`** (Story
  7.5). `HomeRedirect` consumes it and does nothing else; `AppShell`'s title link consumes it to decide whether it is
  standing on that route. **No consumer may re-derive the path** (AR-E6-7/AR-E7-8) — the app bar compares the path it is
  *given* against `useLocation().pathname` and nothing more. **The `mode` argument is a permission, not a preference:**
  `'resolve'` (HomeRedirect, which owns the redirect) is `cache-first` and may fetch; `'observe'` (the app bar, which
  only decorates an answer that already exists) is **`cache-only`** so the app bar never issues the membership-gated
  `lists` request — the same reason `ListDetailPage.tsx:52` uses it. **Branch order is load-bearing: `!data` must
  precede the empty-list check.** Without it a cold cache in observe mode reads as `[]` → `/lists`, and the link goes
  inert on `/lists` for a user who actually owns lists. `null` is the only honest "not known yet" and it maps to the two
  correct behaviours — a spinner in `HomeRedirect`, a **live** link in `AppShell` (fail toward navigating, never toward
  a dead control). **Timestamp ordering is numeric**: `byCreatedAtAsc` = `Date.parse(a) - Date.parse(b)`, exported from
  the same module and used by every `createdAt` sort (currently `useHomePath` and `ListShoppingPage`'s switcher
  `useMemo`). `localeCompare` on `createdAt` is a shipped bug, not a style choice — the backend emits
  `Instant.toString()`, which drops the fractional part at zero nanos, so `…:05Z` sorts *after* `…:05.100Z`
  (`'Z'` 0x5A > `'.'` 0x2E). Fixing this backend-side was explicitly **rejected** (AR-E7-7): a wire format is not
  changed to paper over a frontend comparison
- **An inert control means INERT-BUT-PRESENT** (Story 7.5, the app-bar home link is the reference case). Suppression is
  a `preventDefault()` in the element's own `onClick` and nothing else: react-router 7's `Link` calls the caller's
  `onClick` first and skips its internal navigation when `event.defaultPrevented`, and Enter on an anchor dispatches a
  click, so one line covers pointer *and* keyboard. The element keeps its `href`, its role in the accessibility tree,
  its Tab-reachability, its visible focus ring and its exact type scale; `aria-current="page"` is the only attribute
  added. **Never** swap in a `Button`, set `disabled`/`aria-disabled`, set `tabIndex={-1}`, hide it, or unmount it —
  `/admin` and `/account/password` have no back affordance of their own, so on those screens this link plus the user
  menu are the only in-app exits, and a title that vanishes on one screen reads as a broken render. Never an imperative
  `navigate()` either: `RouteGuard` owns auth redirects and the anchor stays declarative. The nearest sibling idiom is
  `ListShoppingPage.tsx`'s switcher chip (`active ? undefined : onClick` + `aria-current`), but a `Chip` drops a handler
  where a real anchor must prevent a default

### Testing Rules

#### Backend (Kotest + Testcontainers)
- **FunSpec only** — all test classes extend `FunSpec`; do not use DescribeSpec, BehaviorSpec, or StringSpec
- **No mocking framework** — MockK and Mockito are not in the project; do not add them; all tests run against real infrastructure via Testcontainers
- **Use `mongoContainer()` helper** — never instantiate `MongoDBContainer` directly; the helper in `TestContainers.kt` registers a `TestContainerProjectExtension` scoped to the spec, shared once per Gradle test run
- **Test config: static vs dynamic** — a `src/test/resources/application.yaml` may be introduced for static test values (JWT secret, issuer, admin credentials); only truly dynamic values — like the Testcontainers-assigned MongoDB port — must be injected via `MapApplicationConfig`; `setUpJwt()` is tech debt and may be replaced by a test yaml
- **Tests are parallel and DB-agnostic** — tests run concurrently against a shared MongoDB; never assume the DB is empty or in a known state before a test starts; design every test to work regardless of what other tests have written
- **Set up test data through the application API** — use GraphQL mutations to insert test data, not direct MongoDB writes; direct DB inserts bypass business logic and can corrupt the in-memory storage layer; only reach into MongoDB directly when the API cannot cover the setup, and be explicit about the consistency risk
- **Assert only on what your test created** — identify records by the UUIDs generated at the top of the test, not by human-readable names (e.g. `"Milk"`) which may match data from other parallel tests; filter responses to your data before asserting
- **Each `testApplication` has isolated in-memory storage** — each app instance boots fresh and syncs from MongoDB on first access; within a single `testApplication` block the in-memory layer is predictable: it reflects MongoDB state at boot plus mutations made through that instance's API; use this to assert subscription events confidently within the same block
- **Subscription assertions must be bidirectional** — verify your mutation triggers the expected subscription event AND that events from other concurrent tests do not appear as false positives; identify subscription events by the UUIDs generated in the current test; cross-test subscription noise is a known open problem (likely addressed with an external broker in the future)
- **HTTP 200 does not mean GraphQL success** — GraphQL always returns HTTP 200; a failed mutation returns `{"errors": [...], "data": {"field": null}}`; always assert the `errors` field is absent and `data` contains expected non-null values
- **Protected endpoints must be tested with valid auth** — every test exercising a mutation or query must supply a valid token; the exact auth pattern is flexible but auth cannot be skipped
- **Test GraphQL the most readable way** — no restriction on using helper libraries to build queries or parse responses; prefer clarity

#### Frontend (Playwright e2e) — the hard gate

- **Framework**: Playwright — config at `bp_front/playwright.config.ts`, tests at `bp_front/e2e/`, run via
  `npm run test:e2e`. **52 specs / 104 runs at the end of Epic 6** (32/64 at the end of Epic 5; Epic 6 added
  `navigation.spec.ts` and `item-editing.spec.ts`, 10 tests each). Story 7.4 took it to 106 runs and Story 7.5 to
  **120 runs in 10 files** (`navigation.spec.ts` is now 17 tests). Every figure here is dated — re-measure, never quote.
- **`bp_front/e2e/` is inside both quality gates** (since Story 7.1). `npm run lint` is `eslint .`; rules apply to
  `**/*.{ts,tsx}` only, so `e2e/`, `playwright.config.ts`, `vite.config.ts` and `codegen.ts` are now checked alongside
  `src/`, while `.mjs`/`.js` files are walked but carry no rules. Flat config does **not** read `.gitignore` — the
  config's `ignores` array is the only thing keeping `dist`, `src/__generated__` and the Playwright output directories
  out, so add to it rather than to the script glob. `npm run build`'s `tsc -b` type-checks the specs through a third
  project, `bp_front/tsconfig.e2e.json`, referenced from the solution `tsconfig.json`
  (`include: ["e2e", "playwright.config.ts"]`, `types: ["node"]`, and `lib` **includes** `DOM`/`DOM.Iterable` because
  `page.evaluate` callbacks are genuinely browser code — omitting DOM produces 11 spurious errors in correct specs).
  `react-refresh/only-export-components` is switched off for `e2e/**` so a support module of exported helpers is legal
  there. So a spec-file type error or unused import now fails the build — **including the production image build**,
  which runs `npm run build` inside `bp_front/Dockerfile`.
- **The static gate proves a spec compiles, not that every assertion is awaited.** Type-aware linting is not enabled
  (`tseslint.configs.recommended`, no `parserOptions.project`/`projectService`), so
  `@typescript-eslint/no-floating-promises` does not run: a forgotten `await` on `expect(locator).toBeVisible()` still
  passes both gates and silently asserts nothing. **Await every web-first matcher by hand.** (Ledger entry and the fix's
  implementation trap: `deferred-work.md`, "Deferred from: Story 7.1".)
- **E2E runs against the PRODUCTION image, not the dev server** — `webServer` runs `docker compose up -d --build` and
  `baseURL` is `http://localhost:2080` (built `dist/` served by Caddy). This is deliberate: it closes the "green on the
  dev server, broken in the shipped bundle" gap (asset hashing, base path, tree-shaking, SPA-fallback misconfig). Do not
  point E2E at `:5173`.
- **Two viewport projects are mandatory: `chromium` (Desktop Chrome) + `mobile` (Pixel 7).** Mobile is not optional —
  Epic 4's regression was a mobile-only failure. Every flow must pass on both.
- **The config declares FOUR projects, not two (Story 7.3), and the extra pair is a mutual-exclusion mechanism, not
  extra coverage.** Topology: `chromium` and `mobile` both carry `grepInvert: /@registration-toggle/`;
  `registration-toggle-chromium` (Desktop Chrome, `grep: /@registration-toggle/`,
  `dependencies: ['chromium', 'mobile']`) and `registration-toggle-mobile` (Pixel 7, same `grep`,
  `dependencies: ['registration-toggle-chromium']`) run afterwards, in series, both with `fullyParallel: false` so a
  future *second* tagged test cannot race the first. The tagged test is *rerouted*, not duplicated: at Story 7.3 the
  split was **51 / 51 / 1 / 1 = 104**; at Story 7.4 **52 / 52 / 1 / 1 = 106**; at Story 7.5 it is
  **59 / 59 / 1 / 1 = 120 tests in 10 files** — the +2 at 7.4 was `item-attribution.spec.ts`'s single
  untagged test, the +12 at 7.5 is `navigation.spec.ts`'s six new untagged tests, each in both viewport projects.
  Treat the absolute totals as dated; the standing invariant is **exactly 1 test in
  each `registration-toggle-*` project** and everything else in the two viewport projects. Adding a new spec means +2
  runs, in `chromium`/`mobile`; only a test that writes the shared registration flag belongs in the tagged pair.
- **THE TOTAL PROVES NOTHING — check the per-project split.** Drop or misspell the tag and the test
  simply runs in `chromium`+`mobile` while both toggle projects collect zero: the total is *unchanged*
  (the tag REROUTES a test rather than duplicating it),
  the race is silently back, and the guard that used to absorb it is gone. The real check is
  `npx playwright test --list | grep -oP '^\s+\[\K[^\]]+' | sort | uniq -c`. (Do **not** use `--list --project=<name>`
  for this — `--project` pulls in that project's `dependencies`, so the toggle projects report 103 and 104.)
- **Consequence of `dependencies`, measured: a failing dependency project makes the dependent one NOT RUN.** Observed
  2026-08-08 by deliberately failing one `chromium` test: `1 failed / 2 did not run / 101 passed`, exit code `1`, and
  Playwright's wording is "did not run" (not "skipped"). One failing dependency is enough — `mobile` passed in that
  experiment. So **any red run tells you nothing about FR20/FR21**. To get that answer while something else is broken,
  run `npx playwright test --project=registration-toggle-chromium --no-deps`. **`--no-deps` is not optional here:**
  without it the command re-runs the still-broken dependency and fails identically. `globalSetup` still runs under
  `--no-deps`, so registration is still enabled. Note also that `--project=chromium` or `--project=mobile` alone runs
  **no** FR20/FR21 case at all — it is `grepInvert`ed out of both, and reports as absent rather than skipped.
- **The exclusivity holds within ONE Playwright invocation only.** `dependencies` orders projects inside a single
  runner process. Two suites run concurrently against the same `:2080` backend — e.g. a default run plus an
  `E2E_BASE_URL=https://bag-please.localhost` run, which `reuseExistingServer` makes easy — share one Mongo
  `ApplicationConfig` document and re-create the original race in full, now with no retry wrapper to absorb it. Same for
  `--shard`. Run one suite at a time against a given backend.
- **TLS path**: `E2E_BASE_URL=https://bag-please.localhost npm run test:e2e` exercises the real HTTPS + `Secure`-cookie
  route through the host edge proxy (the edge must already be running; compose only starts `:2080`).
- **Tests are UI-driven.** API calls are permitted **only** for environment preparation (e.g. `global-setup.ts` enabling
  registration idempotently, or seeding membership for a two-actor test) — never for the behavior being asserted. Never
  fake a session via `page.route`. Mock only the *input to a render*, never the thing under test.
- **Every test names its FR (s)** in the `describe`/`test` title.
- **Manually exercise each flow in a real browser before writing its test.** This caught three real bugs in Epic 5 that
  no type check or unit test could reach.
- **A new test is unproven until it has been observed FAILING.** Before accepting any new spec: break the behaviour it
  guards (in the product code), rebuild the production image, confirm the test goes **red on both `chromium` and
  `mobile`**, then restore. A green test is evidence of nothing until you have seen it be red for the right reason.
  Established as a convention at the Epic 6 retro, because **6 of that epic's 17 review patches were assertions that
  could not fail for the reason they were written** — an app-bar height bound a two-line wrap fits inside, `.focus()`
  standing in for `:focus-visible`, a `browser.newContext()` that silently dropped mobile emulation and voided the
  mandatory mobile gate, a suggestion-absence check that fired before its query resolved, and an error-alert testid that
  was only ever asserted *absent* so the `catch` branch never once executed. The counter-practice was already proven in
  the same epic: Story 6.1 temporarily set `checked: false, recurring: null`, confirmed both carry-forward regression
  tests failed on both projects, and restored — which is the only reason those two tests are known to be non-vacuous.
- **`browser.newContext()` does NOT inherit the project's `use` block.** A hand-built context silently runs at a desktop
  viewport on the `mobile` project, quietly voiding the mobile gate for whatever it covers. Prefer the `page` fixture
  (already per-test isolated); when a second actor genuinely needs its own context, put the actor whose *rendering* the
  mobile gate must cover on `page`, not in the hand-built context.
- **No login fixture and no `storageState` exist** — each spec registers a fresh unique user through the UI and logs in
  through the form. The shared helper emits `` `${prefix}_e2e_${label}_${projectName}_${Date.now()}` `` —
  `uniqueUsername(prefix, label, projectName)` in `e2e/support/ui.ts`, one distinct prefix per spec. (`auth.spec.ts:12`
  predates the helper and inlines an eighth shape, `mia_e2e_${project.name}_${Date.now()}`, with **no label segment** —
  do not "unify" it.) Use `browser.newContext()` when a second actor is needed so the first session is untouched.
- **The DB volume `./db/data` persists across runs and the two projects run concurrently** — assert only on data your
  test created, and never on total row counts.
- **`registrationEnabled` is ON for the whole run, and that is now an invariant, not a hope (Story 7.3 — the race is
  deleted).** It is one shared Mongo `ApplicationConfig` document. `global-setup.ts` sets it to `true` idempotently
  before the run (which is also what recovers a flag stranded OFF by a crashed prior run — `./db/data` persists). The
  only test that writes it is the FR20/FR21 toggle case in `admin.spec.ts`, tagged `@registration-toggle` and routed by
  the four-project topology above so its OFF window opens **only after both viewport projects have finished** — nothing
  anywhere is registering while it is open. Consequences for anyone writing E2E here:
    - **Do not add a retry loop around reaching the register form.** `registerViaUi` starts with a plain
      `await page.goto('/auth')`. The `expect(async () => …).toPass()` wrapper that used to guard it was deleted with
      the race, deliberately: keeping it "just in case" is what made this flake invisible for seven acceptances. If
      `to-register-link` is ever missing again, that is a real regression and must be allowed to fail. The rule is
      about *that guard*, not about the `toPass` matcher in general — `toPass` remains legitimate for genuinely
      settling UI (`navigation.spec.ts:100` uses it for CSS hover, and is the only remaining occurrence).
    - **`auth.spec.ts`'s inline, unhardened registration (`:18-28`) is correct as-is** and is no longer an exposure —
      the decision was taken explicitly in Story 7.3, not by omission. Do not "harden" it.
    - **Any new test that writes the flag must carry the `@registration-toggle` tag**, or it will run inside
      `chromium`/`mobile` and re-create the race. Nothing enforces this mechanically yet (ledger item).
    - The `setRegistration(page, true)` baseline at the top of the tagged test stays: the chain runs that same test
      twice in sequence, so it is what recovers the flag if the chromium link strands it.
  **Evidence this was a real race and is really closed** (both measured at `retries: 0` against the production image,
  2026-08-08): with the mechanism disabled, three consecutive full runs failed **3 / 5 / 4** tests, all inside
  `registerViaUi`, carrying `alert: "Registration is disabled"` or a 30 s timeout `waiting for
  getByTestId('to-register-link')`; with the mechanism in place, two consecutive full runs were `104 passed`, 0 flaky.
  **Read the 3/5/4 correctly:** those runs had the mechanism absent *and the `toPass` workaround already removed*, so
  they measure the fully-exposed race, not the historical one. They are **not** comparable with the "1 flaky,
  retry-healed" reports from Epics 5–6, which were measured with the workaround in place and retries on. No run was
  ever taken in the historical configuration; the honest claim is "the race is real and the mechanism closes it", not
  "the race was five times worse than reported".
  Historical note kept because it explains the shape of the fix: the workaround had **five** copies before Story 7.2
  (`lists:32`, `shopping:33`, `sharing:32`, `item-editing:41`, `navigation:41`), which is why the race could not be
  fixed in one place (Epic 6 retro action B4); 7.2 removed that obstacle and 7.3 landed the fix once.
- **No component/unit test framework exists** — do not assume one.

##### Shared E2E helpers live in `bp_front/e2e/support/` (Story 7.2)

- **`e2e/support/ui.ts`** holds `PASSWORD` and the UI-driving helpers (`uniqueUsername`, `registerViaUi`,
  `openListsViaMenu`, `createListAndOpen`, `addCategory`, `addItem`). **`e2e/support/api.ts`** holds `BACKEND`,
  `loginApi` and `gql<T>`. Do not re-declare any of them in a spec — that is the duplication Story 7.2 removed.
- **`support/api.ts` must never import `@playwright/test`.** `global-setup.ts` runs in Playwright's globalSetup phase,
  before the runner exists; a top-level runner import in `api.ts` would drag it into that phase. **This is now
  load-bearing in fact, not just in principle:** since Story 7.3 `global-setup.ts` does
  `import {BACKEND, gql, loginApi} from './support/api'` and holds no `BASE_URL` literal, no inline login and no inline
  GraphQL `fetch` of its own. It imports nothing from `ui.ts` — it authenticates as `admin`/`admin` (the first-boot
  admin), not with the suite's registered-user `PASSWORD` — so the two-file split is doing exactly the job it was built
  for.
- **`BACKEND` stays `'http://localhost:2080'`** — API prep always hits the local Caddy entrypoint directly. It must not
  become `baseURL` or `E2E_BASE_URL`, which only control the *browser-facing* origin, or the TLS-edge run mode breaks.
- **Imports are relative — `from './support/ui'`, never `@/`.** `tsconfig.e2e.json` has no `paths`, and Playwright
  resolves the *closest* `tsconfig.json` walking up, so it reads `bp_front/tsconfig.json` and an alias would type-check
  and then fail at runtime.
- **A support file must not match `*.spec.ts` / `*.test.ts`, and must be `.ts`, never `.tsx`.** `playwright.config.ts`
  sets no `testMatch`, so the default pattern applies and a `support/helpers.spec.ts` would be *collected* and fail the
  run with zero tests. `.tsx` falls outside the `bp/e2e-playwright` override glob (`e2e/**/*.ts`) and would get
  `react-refresh/only-export-components: error` — the rule that exists to permit a module of named exports here.
- **`uniqueUsername` takes the caller's prefix first**: `uniqueUsername('shopping', label, project.name)`. The **eight**
  prefixes (`acct`, `admin`, `attrib`, `lists`, `nav`, `sharing`, `shopping`, `item_editing`) are load-bearing —
  `./db/data` persists and both projects run concurrently, so collapsing the namespaces would make specs collide on
  foreign data. `attrib` is `item-attribution.spec.ts` (Story 7.4, FR45/FR58). **A new spec claims a new prefix and
  adds it to the registry comment at `support/ui.ts:14-18`** — that comment is the only inventory there is.
- **It is a support module, not a login fixture** (AR-E7-5). No `storageState`, no `test.extend`, no session reuse:
  every spec still registers a fresh user through the UI and logs in through the form.

### Code Quality & Style Rules

#### Backend (Kotlin)
- **KDoc only where behaviour is non-obvious** — add KDoc on public service and mapper methods only when the method name and types don't already communicate the behaviour; no inline comments on obvious code
- **Data classes for all models** — domain (`Item`), GQL (`GqlItem`), and Mongo (`@Serializable MongoItem`) models are all `data class`
- **`object` for mappers** — mappers are stateless `object` singletons: `GqlItemMapper`, `MongoItemMapper`; never instantiate them
- **Model naming convention** — `{Entity}` for domain, `Gql{Entity}` for GraphQL, `Mongo{Entity}` for MongoDB; same prefix pattern for mappers
- **Package structure** — each entity owns its full vertical slice at `entity/<name>/`, `entity/<name>/gql/`, `entity/<name>/mongo/`; cross-entity utilities go in a top-level package or alongside the infrastructure they support; do not create `entity/shared/`
- **Arrow-kt error handling** — service layer uses Arrow `Either`/`raise` for domain errors; infrastructure failures may use exceptions; do not mix idioms; check existing services before choosing an approach for a new entity
- **Mapping layer boundary** — the GQL layer only calls GQL mappers; the Mongo layer only calls Mongo mappers; the service layer operates exclusively on domain models; never call `MongoItemMapper` from a GQL class or vice versa
- **New infrastructure goes in `plugins/`** — new Ktor concerns get their own `configure*()` function in the `plugins/` package; register from `Application.kt` or `Service.kt`; do not inline plugin configuration
- **Storage methods return values, not references** — never return a live reference to an internal `ConcurrentMap` entry; subscriptions read from the same in-memory state concurrently
- **`@GraphQLName` is required on all GQL model classes** — applies to both output types and input types; omitting it exposes implementation class names to the schema

#### Frontend (TypeScript / React)

- **ESLint is a flat config** (`bp_front/eslint.config.mjs`): `typescript-eslint` + `eslint-plugin-react-hooks` +
  `eslint-plugin-react-refresh`. `eslint-config-next` is gone. `npm run lint` runs `eslint .` — the whole package is
  *walked*, but only `**/*.{ts,tsx}` carries rules, so a `.mjs`/`.js` file appearing in the linted set is not evidence
  it was checked (see the E2E gate section above). The flat config's `ignores` is the only exclusion mechanism —
  `.gitignore` is not consulted. Flat config objects concatenate and **later objects win**, so the `bp/e2e-playwright`
  override must stay last
- **All styling via the MUI theme + `sx`** — no `style={{}}`, no `className` styling, no CSS modules. The theme is
  dark-only (`src/theme.ts`): bg `#000`, paper `#1C1C1E`, primary teal `#4DC9BB`, success `#30D158`, error `#FF453A`,
  warning `#FFD60A`, plus `theme.custom.bp.*` tokens. Theme switching is out of scope
- **File layout**: `src/routes/` = route components, `src/components/` = shared components, `src/lib/<slice>/` = data +
  API layers. PascalCase component files; there are no `page.tsx`/`layout.tsx` conventions (that was Next.js)
- **One default component export per file** — named exports of prop types and constants alongside it are fine
- **No debug logs in components** — `ApolloProvider.tsx` logs GraphQL/network errors intentionally; nowhere else
- **All GraphQL types must come from `src/__generated__/`** — never declare inline types for GraphQL response shapes or variables; always import from `@/__generated__/graphql`
- **Backend test files live in `bp_back/src/test/kotlin/com/bagplease/`**; frontend tests are E2E only, in
  `bp_front/e2e/`

#### Frontend forms & feedback conventions (each paid for by a real Epic 5 bug — do not rediscover)

- **Manual controlled state, no form library** — `useState` per field, a `fieldErrors` object, a top-level error string,
  a
  `loading` boolean. Validate on submit; block the request when invalid
- **Every async branch needs a real `catch`** that sets the inline error. A branch shipped with `try { … } finally` and
  no
  `catch` in Story 5.2 threw out of the handler instead of showing the error
- **Same-tick re-entry guard `if (loading) return`** at the top of every submit handler — `setLoading(true)` only
  disables the form on the *next* render, so two fast Enter presses both enter the handler. Give async buttons (incl.
  logout) a disabled in-flight state
- **Never bucket a loading `null` with a `false`** — a still-loading async flag rendered as the disabled/off branch
  causes a visible wrong-state flash (and lets an E2E pass without proving anything). Guard `null` explicitly
- **Errors are inline, never toasts/Snackbars** — MUI `<Alert role="alert">` or `helperText`. Mutations are confirmed by
  the UI changing (dialog closes, row updates), **never** by a success toast
- **`helperText={fieldErrors.x ?? ' '}`** reserves vertical space so inline errors don't shift the layout
- **Post-mutation refetch must not be reported as a failed mutation** — on success: `reset()` → `onClose()` →
  `void onDone().catch(() => {})`. Awaiting a refetch inside the mutation's `try` turns a successful write into a
  misleading error and invites a duplicate submit
- **Trim a username once** and use the trimmed value for both validation and the API call (untrimmed input created
  whitespace-padded accounts that only logged in with the exact padding)
- **Surface GraphQL errors via `graphqlErrorMessage`** (`@/lib/admin/adminErrors`) — it strips graphql-kotlin's
  `Exception while fetching data (/field) : ` wrapper. `isForbiddenError` detects `FORBIDDEN`. Note that list/sharing
  flows return `FORBIDDEN` for *everything*, so the differentiating signal is the message string, surfaced verbatim
- **Destructive actions are confirmation-first** — reuse `components/ConfirmDialog.tsx`; the mutation fires only from
  the dialog's confirm button

### Development Workflow Rules

#### Local Development

- **Exactly two run modes** — there is deliberately no Caddy-proxies-to-host-Vite hybrid (it was considered and
  dropped):
    1. **Inner loop (day-to-day):** `npm run dev` → native Vite + HMR on **`:5173`**, with `vite.config.ts`
       `server.proxy`
       forwarding `/api` → `http://localhost:4000` and `/api/subscriptions` over ws. Browse `:5173` directly, no Caddy.
       Run the backend with `docker compose up -d mongo bp_back` (or local gradle).
    2. **Gate / ship (authoritative for E2E):** `docker compose up -d --build` → the production image (built `dist/`
       served by Caddy) on **`http://localhost:2080`**. This is the artifact that ships, so E2E tests exactly it.
- **Port map** — Caddy `127.0.0.1:2080` (single entrypoint), backend `:4000`, Vite dev server `:5173`, MongoDB host-side
  `127.0.0.1:27217` (maps to container 27017; avoids clashing with a local MongoDB). The TLS edge fronts `:2080` at
  `https://bag-please.localhost`
- **Caddy route order matters** — `handle` blocks are mutually exclusive and evaluated in source order, so
  `/api/subscriptions` must be matched **before** `/api/*`. Caddy upgrades WebSockets automatically; no extra directives
  (a real simplification over nginx)
- **JDK 25 required locally** — the Gradle JVM toolchain targets JDK 25; ensure `java -version` reports 25 before running `../gradlew`; a wrong JDK produces a cryptic toolchain resolution error, not a clear version mismatch message
- **Default dev credentials** — admin is `admin` / `admin` (the `application.yaml` fallback values). Auth is under
  `/api/auth/*` (e.g. `POST /api/auth/login`), not a bare `/api/login`. **The admin account is 403-forbidden from
  change-password and blocked from all list operations** — use a registered regular user for any list/account flow
- **`admin` is not in the `users` collection** — it never appears in the admin users table and cannot self-delete
- **Registration defaults to OFF** and is persisted in Mongo (`ApplicationConfig`); enable it via the
  `setRegistrationEnabled(enabled: true)` GraphQL mutation as admin (this is what `e2e/global-setup.ts` does
  idempotently)
- **Backend readiness — no health endpoint yet** — there is currently no `/health` or `/ping` endpoint; this is a known
  gap / tech debt; for now, `http://localhost:2080/api/graphiql` loading is the manual readiness check
- **Backend hot reload** — `../gradlew run -t` (from `bp_back/`) enables continuous compilation; `application.yaml` changes require a manual restart — resource files are not hot-reloaded
- **`KTOR_RATE_LIMIT_ATTEMPTS: 6000` in `docker-compose.yaml` is dev/E2E-only and is overridden in production.**
  The repo default in `application.yaml` is `5` per 60s; the compose value exists purely so the E2E suite's many
  registrations don't trip the limiter. **Production does not use this repo's `docker-compose.yaml`** — see the
  deployment note below. Do not "fix" the 6000 here and do not re-file it as debt; that was closed at the Epic 6 retro.

#### Deployment

- **Production configuration lives on the server only, by deliberate security decision.** The production compose file
  and its environment (real credentials, `MIGRATION_TARGET_USER`, JWT secrets, the rate-limit value, the TLS edge
  wiring) are **not** in this repo and must not be added to it. `docker-compose.yaml` in the repo is the local dev / E2E
  topology and nothing more. Consequence for agents: never infer production behaviour from `docker-compose.yaml`, and
  never conclude from repo contents alone that a production value is wrong — ask. Recorded at the Epic 6 retro (action
  item A4), which supersedes Epic 5's "lower `KTOR_RATE_LIMIT_ATTEMPTS` for a production profile" item.
- **Images are published with `images-build-push.sh`** (reads `version=` from `gradle.properties`, needs `project.env`
  with the image names, and a `docker login`). **Both images build from the repo root as context** —
  `bp_front/Dockerfile`
  does `COPY routing/Caddyfile` and `COPY bp_front/ ./`, so it cannot build with `./bp_front` as context. The script
  passed `./bp_front` from before Epic 1 and was silently broken by Epic 5's Caddy rewrite; fixed in `fe31fbf`. Note the
  gap this left: the E2E gate builds via `docker compose` (`context: .`), so **the image that actually ships was never
  covered by the "test the production artifact" gate** — a build-path divergence that survived two epics undetected.
- **First deployment to production happened at the close of Epic 6** (version `0.16.0`). The FR47 Epic-4 migration ran
  against real data at that point and succeeded; it is idempotent via the `app_migrations` `epic4-list-seed` record and
  will not re-run. Real-device HTTPS auth was validated and works, which finally refutes Epic 4's "mobile login broken
  on a real device" finding.

#### Schema & Code Generation

- **Regenerate whenever operations change** — run `npm run generate` from `bp_front/` after adding or editing any
  GraphQL operation (and after any backend schema change). Requires the stack on `:2080` **and** a fresh admin token
- **`codegen.ts` reads the token from `CODEGEN_TOKEN`** — never commit a JWT (access tokens live ~15 min). Mint one
  inline:
  ```bash
  CODEGEN_TOKEN="$(curl -s -X POST http://localhost:2080/api/auth/login \
    -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')" npm run generate
  ```
- **Regenerate immediately after authoring operations, before writing the components that import them** — the generated
  result types are what the pages consume
- **Stale codegen types may not cause compile errors** — after a schema change, `__generated__/` types can become inconsistent without breaking TypeScript compilation; always regenerate before assuming the frontend is schema-current
- **Commit the generated output; never hand-edit it.** A generated result type can collide with the exported document
  constant of the same name — alias the type import (e.g. `AdminUsersQueryResult`) rather than touching the generated
  file
- **API playground files** — `ApiPlayground/` contains `.http` files for IntelliJ HTTP Client; update these when adding new endpoints or mutations

#### Testing
- **Docker daemon required for tests** — `../gradlew test` uses Testcontainers which requires a running Docker daemon; a missing Docker daemon produces a Docker socket error, not a useful test failure message
- **Run tests from `bp_back/`** — execute as `../gradlew test` from within `bp_back/`; from the repo root use `./gradlew :bp_back:test`
- **Always `cleanTest` first: `./gradlew :bp_back:cleanTest :bp_back:test`.** `:bp_back:test` on its own is
  `UP-TO-DATE`-cacheable — it reports `BUILD SUCCESSFUL`, executes nothing, and leaves the previous run's JUnit XML in
  place, so the totals you then read are **stale**. That trap fired during Story 7.4's planning pass. `:bp_back:build`
  does run `check` → `test`, so it is not a substitute for reading the results either.
- **Read the totals from the JUnit XML, not from the console.** Kotest's console output does not print a summary line;
  the numbers live in `bp_back/build/test-results/test/TEST-*.xml` (`tests`/`failures`/`errors`/`skipped` on each
  `<testsuite>`). Suite size for reference: **105 at `73db447`, 113 after Story 7.4, 115 after Story 7.6**
  (`ListSharingTest` 16 → 18). Treat those as dated — the standing rule is to re-measure, never to quote a remembered
  number.
- **A `--tests "com.bagplease.SomeTest"` filter runs the whole Kotest class**, which is the cheap way to iterate on one
  spec's red/green observation without paying for the full suite (~17 s vs ~1 m 35 s).

#### Git
- **Branch naming** — feature branches follow `feature/<description>`
- **Gradle wrapper at repo root** — use `../gradlew` from within `bp_back/`; the wrapper lives at the repo root, not inside `bp_back/`

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code in this project
- Follow all rules exactly as documented; when two rules conflict, prefer the more restrictive one
- When adding a new entity, the full vertical slice is required: domain model, GQL model + mapper, Mongo model + mapper, Storage, Service, and GQL registration in `GQL.kt`
- Update this file when new patterns emerge or existing ones are corrected

**For Humans:**
- Keep this file lean and focused on unobvious agent needs; remove rules that become obvious over time
- Update when technology stack versions change
- Tech debt items noted inline (subscription auth, `setUpJwt()`, health endpoint) should be removed from this file once resolved

_Last Updated: 2026-08-13 (Stories 7.8 + 7.9) — **frontend build-tool versions, plus four operational directives that
follow from them.** No behavioural convention changed, but the "versions only" framing was **corrected at review**: the
entries below carry directives, and `rule_count` rises 89 → **93** for the four — a types major tracks the Node major
that builds the project; a types bump is gated on `npx tsc -b --force`; `vite.config.ts` must not gain a
`build`/`optimizeDeps`/`esbuild`/`css` block to steer Rolldown; and the resolved `build.target` is re-checked and its
delta recorded on every future Vite major. The Technology Stack section now records `@types/node` **26.2.0** (Story 7.8, one
commit alone — the types major must track the Node major that builds the project, and a `tsc -b` gate must be
`--force`d because build mode caches per project under `node_modules/.tmp/`) and Vite **8.2.1** with
`@vitejs/plugin-react` **6.0.5** (Story 7.9, both in one commit — plugin 6 peers on `vite ^8.0.0`). The one genuinely
new fact for an agent is that **Vite 8 is Rolldown-based**: `rolldown` 1.2.4 + `lightningcss` 1.33.0 + `postcss` 8.5.26
are in, `esbuild` and `rollup` are out of the lockfile entirely, the native bindings are platform-optional packages so
the musl image build is the only real check, and `vite.config.ts` must not gain a `build`/`optimizeDeps`/`esbuild`/`css`
block to steer the new bundler. `bp_front/package.json`'s `allowScripts` block was deleted rather than re-pinned,
because Vite 8 removed the `esbuild` it named from the tree — which closes Story 7.7's ledger entry on that drift. The
fourth directive is the browser-floor bullet above, which is the one user-visible consequence of this pass and the one
no gate here can catch. New debt from this pass — chiefly that the `createUserViaUi` "flake" is **size-driven, not
random**: the admin users query is unpaginated, so the create-user dialog's close time grows with the users table
(probed at 5015 ms against a 5000 ms assertion at ~5.5k rows) until the suite fails under parallel load. **Corrected at
review — do not restore the earlier wording:** it is *not* "deterministic", *not* "monotonic", and re-running does
*not* "always fail to converge" (two full green runs happened at larger row counts than a preceding red one in the same
pass); and the Vite 7 control run that the first draft credited with settling attribution ran at the largest DB of the
pass with both sides saturated at 8/8 failures, so it proved nothing. What actually settled it: `md` cleared the
database and the **unchanged** Vite 8 tree passed twice in a row at `retries: 0`. Also note the E2E rule below still
says `./db/data`; `md` switched the mongo mount to a named Docker volume (`bag-please_db_data`) on 2026-08-13, so the
persistence claim holds but the path is stale — filed rather than swept, because that compose change is uncommitted and
not this story's. All of it lives in `deferred-work.md`, not here (NFR-E7-1). Prior entry:
2026-08-12 (Story 7.7) — **dependency versions, plus three operational directives that follow from
them.** No behavioural convention changed. The
Technology Stack section now records what actually shipped after the minor/patch sweep: backend Ktor 3.5.2,
graphql-kotlin 9.3.0, MongoDB driver + bson-kotlinx 5.9.2, Arrow 2.2.3, Logback 1.6.2, Kotest 6.2.4 (Kotlin stays
**2.3.21** by AC2, Testcontainers 2.0.5 and bcrypt 0.10.2 re-confirmed latest, Gradle wrapper **held** at 9.6.1 because
`bp_back/Dockerfile:1` pins the build image); frontend Apollo 4.2.11 + rxjs 7.8.2, MUI/icons 9.3.1, graphql 16.14.2,
graphql-ws 6.2.1, React/react-dom 19.2.8, codegen 7.2.0/6.1.3, `@types/*` refreshed, react-router-dom 7.18.x,
Playwright 1.62.x, eslint 9.39.5 + typescript-eslint 8.67.0 (TypeScript held at 6.0.3, Vite at 7.3.6,
`@vitejs/plugin-react` at 5.2.0 — each the newest release inside the major a later story owns). Three notes added
alongside the numbers, and they are directives rather than facts, which is why the "versions only" framing was
corrected at review: read installed frontend versions from the **lockfile**, not `package.json`, because
`bp_front/Dockerfile` runs `npm ci`; a Playwright runner bump needs `npx playwright install chromium`; and read the
**resolved** Kotlin classpath rather than the catalog, because Arrow 2.2.3 now drags `kotlin-stdlib` to 2.4.0 above the
2.3.21 compiler. `rule_count` stays 89 because no convention was added or changed. The standing instruction to **re-measure the enum-encoding finding after a driver bump was discharged**: on
`mongodb 5.9.2` the bare-enum revert of `ListMemberRepository.kt:39` still leaves `ListSharingTest` 18/0/0/0 green
(raw-BSON assertion included), `EnumCodecProvider` is still in `bson-5.9.2.jar`, and `MongoConnection.kt` still
installs no custom registry — so that bullet now reads as a two-point measurement, with the re-measure trigger moved to
the next driver **major**. New debt from this story — the Gradle-wrapper hold, the `typescript-eslint`/TS 7 deadlock
risk, the pre-existing `allowScripts` `esbuild` drift, the unused `kotest-property`, a **pre-existing**
`admin.spec.ts` `createUserViaUi` flake that failed the baseline run before any bump moved (which also **falsifies the
epic's "green at zero retries, stays green" close criterion** until it is fixed), the non-deterministic lists-index
ordering from `ListStorage.getAll()`, and the review's own findings — the split Kotlin runtime, the silent
`kotlinx-serialization`/`kotlinx-coroutines` moves under Ktor, four npm advisories, the unverified `wss://` path, the
unpinned `devices['Pixel 7']` viewport and the un-automated Playwright-browser install — lives in `deferred-work.md`,
not here (NFR-E7-1). Prior entry:
2026-08-12 (Story 7.6) — **an enumerated field is an enum in the domain model only; persistence and the
GraphQL model each keep their own `String`.** Two backend rules added: the mapper-boundary convention generalised from
`Recurring` to `MemberStatus` (own one-line enum file, constant names byte-identical to the persisted strings, `valueOf`
on read and `.name` on write, `Mongo*`/`Gql*` both still `String` so the SDL never moves and no migration is needed),
including the trap that a repository `Updates.set` is a mapper-less write path and a BSON filter must use
`MemberStatus.PENDING.name` rather than a literal — plus the **measured** correction that passing the enum there was
*not* a corruption bug on driver `mongodb 5.5.1` (`org.bson.codecs.EnumCodecProvider` is in the default registry, so the
stored bytes were identical and the persistence test stayed green under that revert), recorded as a dated one-config
measurement to re-check after Story 7.7's dependency sweep rather than as a law, which is why `.name` stays mandatory for
explicitness and why the invariant worth pinning is the constant-name identity; and `ListService.deleteList`'s cascade is
now `items → categories → members → list` before the three `evict*` calls, with the rule that a new child collection gets
no new count on `DeleteListResult` (schema change) and that a cascade test must count on the raw collection, assert a
second list's rows survive, **and carry a DECLINED row** on the deleted list (the one status `findActiveByListId` cannot
see, so the one a status-filtered `deleteMany` would strand — measured `expected:<0L> but was:<1L>`). **Three claims this
story first wrote and the review then corrected in place, flagged here so the earlier wording is not restored:** the
cascade ordering is a convention and **not** a partial-failure mitigation (the four deletes share no session, and
`list_members` has no cache to re-sync, so a throw at the list delete leaves a live list with its memberships
permanently gone); the `@Volatile` residual is a **correctness** gap, not merely duplicated startup I/O (a stale sync
snapshot can overwrite a newer cached row and the process never recovers); and *list* deletion no longer leaks
membership rows but **user deletion still does** (`UserService.adminDeleteUser` has no such cascade). Backend suite size
refreshed to **115 after Story 7.6** (`ListSharingTest` 16 → 18). New debt — the check-then-act half of the lazy-sync
race that `@Volatile` does *not* fix (with a `Mutex`-shaped proposal), the `findByListIdAndUserId` unknown-status throw,
`md`'s standing no-backfill assumption, the two non-equivalent "active member" predicates, and the seven findings
deferred by this story's code review (user-delete leak, non-transactional cascade, the share-during-delete window,
AC4's inspection-only ordering, the leaked test `MongoClient`, the frontend's bare status literals, and the
`sprint-status.yaml` narrative duplication) — lives in `deferred-work.md`, not here (NFR-E7-1). Prior entry:
2026-08-11 (Story 7.5) — **where `/` resolves to has exactly one implementation**, and an inert control
means inert-but-PRESENT. Two frontend rules added: `useHomePath(mode)` in `src/lib/lists/homePath.ts` is the single home
resolver (both `HomeRedirect` and `AppShell` consume it; no consumer re-derives the path), `mode` is a *permission* —
`'resolve'` may fetch, `'observe'` is **`cache-only`** so the app bar never issues the membership-gated `lists` request —
the `!data` branch must precede the empty-list check or a cold cache makes the link inert on `/lists` for a user who owns
lists, and `byCreatedAtAsc` (`Date.parse` difference) is the only legal `createdAt` ordering because
`Instant.toString()` drops the fractional part at zero nanos (backend-side fixed precision was **rejected**, AR-E7-7);
and the inert-but-present contract — a `preventDefault()` in the element's own `onClick` (react-router 7 runs the
caller's handler first and skips its navigation when `defaultPrevented`, and Enter on an anchor dispatches a click, so
one line covers both), `aria-current="page"` the only added attribute, never a `Button`/`disabled`/`aria-disabled`/
`tabIndex={-1}`/hidden/unmounted, and never an imperative `navigate()`. E2E counts corrected: the four-project split is
**59 / 59 / 1 / 1 = 120 tests in 10 files**, measured, and the "`Total: 104` does not prove the routing works" bullet was
rewritten as **the total proves nothing** — the tag reroutes a test rather than duplicating it, so a dropped tag leaves
the total unchanged. The prefix registry is unchanged at eight (`nav` already owned this spec). New debt — the
`/lists`-with-no-lists dead-end under standalone display, the absence of any mechanical guard against a third
`localeCompare` sort site, the `/admin/*` splat interaction with exact-pathname equality, the cold-cache window where the
link is briefly live, and one unreproducible cold-start red run whose failure text was not captured — lives in
`deferred-work.md`, not here (NFR-E7-1). Prior entry:
2026-08-10 (Story 7.4) — an upsert service method **merges the stored row**; it never reconstructs the
entity from its GraphQL input. Four backend rules added: the merge shape and why the direction is an allowlist
(`stored.copy(...)`, not `item.copy(addedBy = stored.addedBy, …)`) with the five `ItemInput` fields named and
`addedBy`/`checkedAt`/`deleted`/`deletedAt` named as server-owned; create-vs-update is discriminated by **existence in
storage**, never by presence of an id (measured: the id-based form turns 16 of 25 `ItemLifecycleTest` tests red, since
the client generates UUIDs for new items too); `saveItem`'s two rejections and their deliberate asymmetry (cross-list
id **always**, category-not-in-list **update branch only** per `md`'s ruling A — 29 test sites across six files is what
guarding creates would cost), both throwing **before** `itemUpdateChannel.emit`; and the error idiom
(`IllegalArgumentException`, never a `GraphQL*Exception` — those are imported only by `*/gql` files, so a service
import is a layering violation — with the `ExceptionWhileDataFetching`/no-`extensions.code` consequence and the
`either { }` caveat that a thrown exception escapes the block, so an `errors`-only assertion proves nothing about the
write). Four testing rules added: **`cleanTest` is mandatory** (`:bp_back:test` alone is `UP-TO-DATE`-cacheable — it
prints `BUILD SUCCESSFUL`, executes nothing and leaves stale JUnit XML), read totals from
`build/test-results/test/TEST-*.xml`, the suite is **113 after this story (105 at `73db447`)**, and `--tests` filters
run a whole Kotest class. The E2E prefix registry went from seven to **eight** (`attrib`) and the four-project split is
now **52 / 52 / 1 / 1 = 106 tests in 10 files**, measured. New debt — the open create-branch category hole, the
BUG-E6-3a severity downgrade, the declined `BAD_USER_INPUT` shape and the new `checked=false` + non-null `checkedAt`
state — lives in `deferred-work.md`, not here (NFR-E7-1). Prior entry:
2026-08-08 (Story 7.3) — the `registrationEnabled` race is **deleted, not retried**. The FR20/FR21
toggle test is tagged `@registration-toggle` and routed into two new Playwright projects chained behind `chromium` and
`mobile` with `dependencies`, so its OFF window is exclusive across projects; the `expect(...).toPass()` workaround in
`support/ui.ts` was deleted in the same change. The "Known race" bullet was replaced with the new invariant
(registration is ON for the whole run) and its four rules for spec authors; a four-project topology bullet (51/51/1/1 =
104) and a measured `dependencies`-on-failure bullet ("did not run", exit 1, one failing dependency is enough) were
added; `global-setup.ts` now consumes `support/api.ts`. Both claims are backed by measurement: three disabled-mechanism
runs failed 3/5/4 tests inside `registerViaUi`, two consecutive `retries: 0` runs with the mechanism are `104 passed`,
0 flaky. New debt (no machine gate for the tag; red-run loses toggle coverage; CI still at `retries: 2`) lives in
`deferred-work.md`, not here. Prior entry:
2026-08-08 (Story 7.2) — the eight duplicated E2E helpers now live once under `bp_front/e2e/support/`;
added the "Shared E2E helpers live in `bp_front/e2e/support/`" rules block (two-file split and why `api.ts` must stay
runner-free, relative imports, the `*.spec.ts`/`.tsx` naming traps, the prefix parameter, support-module ≠ login
fixture), and corrected the `registrationEnabled` bullet's copy count from four to **five** — `navigation.spec.ts:41`
was the copy every prior document missed. New debt from that story lives in `deferred-work.md`, not here. Prior entry:
2026-08-07 (Story 7.1) — `bp_front/e2e/` is now **inside** both frontend quality gates: the "outside both
quality gates" bullet was replaced with the new reality (third tsconfig project `tsconfig.e2e.json` referenced from the
solution config; `npm run lint` widened to `eslint .`; `react-refresh/only-export-components` off for `e2e/**`), and the
residual gap was named — type-aware linting is still not enabled, so an un-awaited assertion still ships undetected. New
debt from that story lives in `deferred-work.md`, not here. Prior entry:
2026-07-29 (Epic 6 retro) — added the "a new test is unproven until observed failing" testing convention
and the `browser.newContext()` viewport trap; added a Deployment section recording that production config is server-only
by design, the repo-root build-context requirement for both images, and the first production deployment (`0.16.0`);
closed out the rate-limiter item; refreshed the E2E counts and the `registrationEnabled` decided fix. Prior entry:
2026-07-28 — frontend, infrastructure, testing, and workflow sections rewritten for the Epic 5 reframe (
Vite SPA + MUI + Caddy, in-memory tokens, production-image E2E). The prior Next.js / nginx / localStorage content was
stale from Story 5.3 onward and had been warned about in four consecutive story records instead of fixed. Backend rules
are unchanged — Epic 5 touched no backend code._
