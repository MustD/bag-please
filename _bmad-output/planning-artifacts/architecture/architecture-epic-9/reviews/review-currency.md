# Review: Currency and Reality Check of the Epic 9 Architecture Spine

- **Spine:** `_bmad-output/planning-artifacts/architecture/architecture-epic-9/ARCHITECTURE-SPINE.md`
- **Lens:** were the decisions checked against the web or the repo, or only asserted? Are versions current, and do the
  APIs the ADs rely on exist and behave as claimed?
- **Date:** 2026-09-15
- **Verdict:** Mostly sound. The Stack table matches the repo pins exactly, and every API the ADs rely on exists in the
  pinned versions. But the memlog shows the versions were checked against the repo only, not the web. Two ADs also leave
  out mechanics that a developer will get wrong without guidance: the migration needs an aggregation-pipeline update
  (AD-5), and the health route runs under Ktor's `rootPath` with a hanging Mongo ping and no curl in the backend image
  (AD-9).

## 1. Stack table vs repo pins

| Spine entry                           | Repo pin                               | Evidence                                                                                     | Web currency (2026-09-15)                                                                                                                                     |
|---------------------------------------|----------------------------------------|----------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Kotlin 2.4.10                         | 2.4.10                                 | `gradle/libs.versions.toml:2`                                                                | Released 2026-07-14; latest 2.4.x found ([GitHub release](https://github.com/JetBrains/kotlin/releases/tag/v2.4.10))                                          |
| Ktor 3.5.2                            | 3.5.2                                  | `gradle/libs.versions.toml:5`                                                                | Latest 3.5.x, released Jul/Aug 2026 ([Ktor releases](https://ktor.io/docs/releases.html))                                                                     |
| graphql-kotlin 10.2.1                 | 10.2.1                                 | `gradle/libs.versions.toml:6`                                                                | Latest, released Aug 2026 ([releases](https://github.com/ExpediaGroup/graphql-kotlin/releases))                                                               |
| MongoDB Kotlin coroutine driver 5.9.2 | 5.9.2                                  | `gradle/libs.versions.toml:7`                                                                | Latest, released 2026-08-11; fixes a credential leak in `ProxySettings.toString()` ([driver releases](https://github.com/mongodb/mongo-java-driver/releases)) |
| MongoDB server mongo:8                | `mongo:8` (compose and Testcontainers) | `docker-compose.yaml:10`, `bp_back/src/test/kotlin/com/bagplease/utils/TestContainers.kt:21` | Floating major tag, see F-8                                                                                                                                   |
| React 19.2.8                          | 19.2.8 (lock 19.2.8)                   | `bp_front/package.json`                                                                      | Not web-checked                                                                                                                                               |
| Apollo Client 4.2.11                  | 4.2.11 (lock 4.2.11)                   | `bp_front/package.json`                                                                      | Not web-checked                                                                                                                                               |
| MUI 9.3.1                             | 9.3.1 (lock 9.3.1)                     | `bp_front/package.json`                                                                      | Not web-checked                                                                                                                                               |
| graphql (JS) 17.0.2                   | 17.0.2                                 | `bp_front/package.json`                                                                      | Not web-checked                                                                                                                                               |
| TypeScript 6.0.3                      | 6.0.3                                  | `bp_front/package.json`                                                                      | Not web-checked                                                                                                                                               |
| Vite ^8.2.1                           | ^8.2.1 (lock 8.2.1)                    | `bp_front/package.json`                                                                      | Not web-checked                                                                                                                                               |
| Playwright ^1.60.0                    | ^1.60.0 (**lock resolves 1.62.1**)     | `bp_front/package.json`, `bp_front/package-lock.json`                                        | See F-9                                                                                                                                                       |
| App version 0.18.0                    | 0.18.0 in both                         | `gradle.properties:3`, `bp_front/package.json:4`                                             | n/a                                                                                                                                                           |

All 13 rows match the repo. Epic 9 adds no dependency, so version currency is a low risk. The frontend rows were not
checked against the web in this review either; each matches the lock file.

## 2. API claims verified

| Claim (AD)                                                      | Result                                                                                                                                                   | Evidence                                                                                                                                                                                                                                                     |
|-----------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Coroutine driver can run `ping` (AD-9)                          | Exists: `MongoDatabase.runCommand(command: Bson, readPreference)`                                                                                        | driver sources 5.9.2 `com/mongodb/kotlin/client/coroutine/MongoDatabase.kt:170`                                                                                                                                                                              |
| `updateMany` accepts an aggregation pipeline (AD-5)             | Exists: `updateMany(filter: Bson, update: List<Bson>, options)`                                                                                          | driver sources 5.9.2 `MongoCollection.kt:868-908`; [API doc](https://mongodb.github.io/mongo-java-driver/5.1/apidocs/mongodb-driver-kotlin-coroutine/mongodb-driver-kotlin-coroutine/com.mongodb.kotlin.client.coroutine/-mongo-collection/update-many.html) |
| A plain `$set` can copy `store` into `stores` (AD-5)            | **No.** A classic update `$set` takes literal values and cannot reference another field; that needs the pipeline form (MongoDB 4.2+, so mongo:8 is fine) | see F-1                                                                                                                                                                                                                                                      |
| graphql-kotlin maps `List<String>` to `[String!]!` (AD-3)       | Yes. The existing `itemStoreSuggestions(): List<String>` already generates `Array<string>` (non-null list of non-null items)                             | `bp_back/.../item/gql/ItemApi.kt:36`, `bp_front/src/__generated__/graphql.ts:147`                                                                                                                                                                            |
| Ktor route outside `authenticate {}` is public (AD-9)           | Yes. Auth only applies inside `authenticate` blocks; `gqlRoutes` wraps only its own routes                                                               | `bp_back/.../plugins/GQL.kt:136`                                                                                                                                                                                                                             |
| Health route is outside any rate limit (AD-9)                   | Yes by default. The app registers only the named `auth` limiter and no `global {}`; named limiters apply only inside `rateLimit(name) {}`                | `bp_back/.../plugins/RateLimiting.kt:14-21`; [Ktor rate limit docs (3.5.2)](https://ktor.io/docs/server-rate-limit.html)                                                                                                                                     |
| Playwright `webServer.url` readiness (AD-9)                     | The URL must return 2xx, 3xx, 400, 401, 402 or 403. A 503 or a Caddy 502 keeps Playwright waiting, which is what the AD needs                            | `bp_front/node_modules/playwright/types/test.d.ts:10842-10846` (1.62.1)                                                                                                                                                                                      |
| Kotlin `lowercase(Locale.ROOT)` (AD-4)                          | Exists on JVM. The no-argument `lowercase()` already uses the invariant locale, so the two behave the same                                               | [kotlin stdlib docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/lowercase.html)                                                                                                                                                               |
| Old docs keep a `store` field during the transition (AD-3/AD-5) | Safe. The bson-kotlinx decoder skips unknown fields, and `encodeDefaults` defaults to true, so `stores = emptyList()` is written                         | bson-kotlinx 5.9.2 `BsonDecoder.kt:142-143`, `BsonConfiguration.kt:31`                                                                                                                                                                                       |

## 3. Findings

### F-1 — Medium — AD-5: the conversion needs a pipeline update, and the spine doesn't say so

- **Location:** AD-5 Rule ("sets `stores` to `[trimmed store]` when `store` is non-blank and `[]` otherwise, unsets
  `store`").
- **Problem:** The existing migration style is `updateMany(filter, Updates.set(...))` with literal values
  (`Migration.kt:80-81`). A developer who copies it cannot build `stores` from each document's own `store`. A classic
  `$set` document cannot reference a field path, so `Updates.set("stores", listOf("\$store"))` stores the literal string
  `"$store"`. The rule only works as a single statement in the aggregation-pipeline form (`List<Bson>` overload). The
  alternative is a per-document read/write loop, which is also resumable thanks to the `stores` missing filter. The
  spine picks neither and gives no warning.
- **Evidence:** `bp_back/src/main/kotlin/com/bagplease/plugins/Migration.kt:80-81`; driver 5.9.2
  `MongoCollection.kt:868` (`update: List<Bson>` overload); pipeline updates require MongoDB 4.2+ (mongo:8 in compose
  and tests, `TestContainers.kt:21`).
- **Suggested fix:** Add one line to AD-5: "implemented as a pipeline update:
  `updateMany(Filters.exists("stores", false), listOf($set stores = $cond(strLenCP($trim($ifNull($store,""))) > 0, [$trim(...)], []), $unset "store"))`,
  or an equivalent per-document loop". Require a migration test with an item whose `store` is null, missing, blank, or
  padded.

### F-2 — Medium — AD-9: `/api` comes from Ktor `rootPath`, so the route must be declared as `/health`

- **Location:** AD-9 Rule ("A plain Ktor route `GET /api/health`"); Structural Seed `plugins/Routing.kt`.
- **Problem:** The backend runs with `ktor.deployment.rootPath: "api"`, and existing routes are declared without the
  prefix (`get("/auth/config")`). Caddy forwards `/api/*` without stripping it. Writing `get("/api/health")`, as the AD
  literally reads, would serve `/api/api/health`. Playwright would then get a 404, which is not a ready code, and wait
  out the 600 s timeout.
- **Evidence:** `bp_back/src/main/resources/application.yaml:9`;
  `bp_back/src/main/kotlin/com/bagplease/features/auth/AuthRoutes.kt:40`; `routing/Caddyfile` (`handle /api/*` with
  `reverse_proxy`, no `uri strip_prefix`).
- **Suggested fix:** State "public path `/api/health`; declared as `get("/health")` under the configured `rootPath`".

### F-3 — Medium — AD-9: an unbounded Mongo ping hangs about 30 s instead of returning 503

- **Location:** AD-9 Rule ("returns `200` when a Mongo `ping` succeeds and `503` otherwise").
- **Problem:** `MongoConnection` does not set a server selection timeout, and the driver default is 30 s. When Mongo is
  down, `runCommand(ping)` blocks for 30 s and then throws. The route gives no quick 503. Unless the handler catches the
  exception, Ktor returns a 500, and the AD says nothing about catching it. A compose healthcheck with a 5 s timeout
  (the pattern already used for mongo) would record a timeout, not a 503.
- **Evidence:** `bp_back/src/main/kotlin/com/bagplease/mongo/MongoConnection.kt:29-33` (no timeout settings);
  mongodb-driver-core 5.9.2 `ClusterSettings.java:96` (`serverSelectionTimeoutMS = 30 s`).
- **Suggested fix:** Add to the rule: "ping wrapped in `withTimeout(~2 s)`; any exception or timeout returns 503".

### F-4 — Medium — AD-9: the compose healthcheck has no tool to run in the backend image, and `:2080` is a host port

- **Location:** AD-9 ("any compose healthcheck probe it through Caddy (`:2080/api/health`)"); Deferred, Operational
  envelope.
- **Problem:** `bp_back` runs on `eclipse-temurin:25`, which ships neither `curl` nor `wget` (checked by running the
  image). A backend-container healthcheck therefore needs a new tool or a JVM-based probe. `:2080` exists only on the
  host (`127.0.0.1:2080:80`). A healthcheck running inside a container would have to use `bp_front`'s `localhost:80`
  (caddy:2-alpine has busybox `wget`) or `bp_back:4000/api/health`. As written, the healthcheck part can't be built.
- **Evidence:** `bp_back/Dockerfile` (`FROM eclipse-temurin:25`);
  `docker run --rm --entrypoint sh eclipse-temurin:25 -c 'which curl wget'` printed nothing; `docker-compose.yaml`
  bp_front port mapping.
- **Suggested fix:** Say where the healthcheck runs: on `bp_front`, `wget -qO- http://localhost/api/health`. If a
  backend healthcheck is wanted, record that it needs a tool added to the image. Or drop the optional compose
  healthcheck and keep only Playwright's `webServer.url: 'http://localhost:2080/api/health'`.

### F-5 — Low — AD-4/AD-5: "trim" means three different things across Kotlin, JS and Mongo `$trim`

- **Location:** AD-4 (server trim plus client mirror in `storeValue.ts`); AD-5 ("`[trimmed store]`").
- **Problem:** Kotlin `String.trim()` removes `Char.isWhitespace` characters, JS `String.prototype.trim` removes
  ECMAScript WhiteSpace and LineTerminator, and Mongo `$trim` uses its own table (it includes U+0000). They differ on
  edge code points. The spine claims the client uses "the same rule". In practice the difference is negligible, but the
  claim is not literally true.
- **Evidence:** [MongoDB `$trim` docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/trim/)
  (default character table includes the null character).
- **Suggested fix:** Name the server rule as the reference (Kotlin `trim()` plus `lowercase(Locale.ROOT)`). Say the
  client uses `trim()` plus `toLowerCase()` (never `toLocaleLowerCase()`), and accept edge-code-point drift because the
  server re-normalizes. Optionally run the migration's result through the same Kotlin normalizer (a per-document loop)
  if exact parity matters.

### F-6 — Low — AD-3: the repository's field-by-field upsert is a fourth place to change, and it is not listed

- **Location:** AD-3 Rule and Structural Seed (`entity/item/` lists Item, MongoItem, GqlItem, GqlItemInput).
- **Problem:** `ItemRepository.save` builds a `$set` for each named field, including `Updates.set("store", item.store)`.
  It does not persist the `MongoItem` object. If the models change but this line doesn't, `store` keeps being written
  and `stores` is never saved, and nothing fails at compile time: `"store"` is a string literal. The two mappers
  (`MongoItemMapper`, `GqlItemMapper`) also reference `store`.
- **Evidence:** `bp_back/src/main/kotlin/com/bagplease/entity/item/mongo/ItemRepository.kt:59`;
  `MongoItemMapper.kt:15,32`; `GqlItemMapper.kt:17,33`.
- **Suggested fix:** Add `ItemRepository.save` (`Updates.set("stores", ...)`) and both mappers to AD-3's list of places
  to change.

### F-7 — Low — Memlog: versions were checked against the repo, not the web

- **Location:** `.memlog.md` `(version)` entry ("Reality-checked from repo 2026-09-15").
- **Problem:** The versions were compared with the repo but not with current upstream releases. This review web-checked
  the backend side, and every backend version is the latest release or a current patch. The frontend versions (React,
  Apollo, MUI, graphql-js, TypeScript, Vite) were not web-checked by the spine or by this review. Since Epic 9 adds no
  dependency, the risk is only that documentation goes stale.
- **Evidence:** memlog line; web sources in section 1.
- **Suggested fix:** None required. Optionally label the Stack table "repo pins as of 2026-09-15 (no upgrade in Epic 9)"
  so nobody reads it as a currency claim.

### F-8 — Info — `mongo:8` is a floating tag

- **Location:** Stack table, "MongoDB server | mongo:8".
- **Problem:** The tag follows the latest 8.x minor. AD-5 (pipeline update, 4.2+) and AD-9 (`ping`) work on any 8.x, so
  this does not affect fit. It is just not a pinned version.
- **Evidence:** `docker-compose.yaml:10`, `TestContainers.kt:21`.
- **Suggested fix:** Write the row as "mongo:8 (floating 8.x tag)".

### F-9 — Info — Playwright range vs installed version

- **Location:** Stack table, "Playwright | ^1.60.0".
- **Problem:** The spine repeats the `package.json` range; the lock file installs 1.62.1. The `webServer.url` semantics
  above were checked against the installed 1.62.1 types.
- **Evidence:** `bp_front/package-lock.json` (`node_modules/@playwright/test` 1.62.1).
- **Suggested fix:** Write the row as "^1.60.0 (lock 1.62.1)", or leave it; this changes nothing.

## 4. Not confirmed

- The exact per-list whitespace sets of JS `trim` and Kotlin `Char.isWhitespace` were not diffed character by character;
  F-5 treats them as "differ at edges".
- The graphql-kotlin documentation page on nullability could not be fetched (404). The `List<String>` to `[String!]!`
  mapping was confirmed from the project's own generated schema output, not from the docs.
- Whether the frontend library versions are the latest upstream releases (see F-7).
