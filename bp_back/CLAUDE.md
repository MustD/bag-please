# CLAUDE.md — Backend (`bp_back/`)

Guidance for working in the Kotlin/Ktor GraphQL backend. Build/test commands live in the root `CLAUDE.md`.

## Backend layers

```
GQL layer      (entity/<name>/gql/)          – graphql-kotlin Query/Mutation/Subscription objects
Service layer  (entity/<name>/<Name>Service) – business logic + Kotlin SharedFlow subscriptions
Storage layer  (entity/<name>/<Name>Storage) – in-memory ConcurrentMap with lazy sync on first access
Mongo layer    (entity/<name>/mongo/)        – MongoDB coroutine driver repositories
```

(Users, refresh tokens, feedback, the app config and lists/list members are the exception since Stories 11.2-11.4: they use a `db/` package over PostgreSQL and no storage cache, see below. Only `item` and `category` still have a Storage and a `mongo/` layer.)

Data flows from the GQL layer down through the service, through the in-memory storage, and is persisted to MongoDB. On
startup the storage is populated from MongoDB on first access (`synced` flag). `synced` is never reset, so a document
written straight to Mongo after a storage's first access stays invisible to the app until restart. Mutations emit on a
`MutableSharedFlow` which the GraphQL subscriptions expose as a `Flow`.

Shared code sits beside the entity slices under `src/main/kotlin/com/bagplease/`: `config/` (application config,
its GQL and PostgreSQL `db/` parts), `features/auth/` (REST auth routes, `AuthService`, refresh tokens), `mongo/`
(`MongoConnection`, `AppMigrationsRepository`) and `plugins/` (Ktor plugins, `GQL.kt`, `Migration.kt`).

The code is sliced **per entity**, not per layer: `src/main/kotlin/com/bagplease/entity/<name>/` (`item`, `category`,
`list`, `user`, `feedback`) holds all of that entity's layers, e.g. `entity/item/`:

- `Item.kt` — plain domain model
- `ItemService.kt` — orchestrates storage + emits subscription events
- `ItemStorage.kt` — the in-memory cache (only `item` and `category` have one; `user`, `feedback` and `list`
  services call their repository directly inside `tx {}`)
- `gql/` — GraphQL model + `object` mapper, and the `ItemApi.kt` Query/Mutation/Subscription objects, registered in
  `plugins/GQL.kt`'s `configureGql()`
- `mongo/` — MongoDB BSON model + `object` mapper + `ItemRepository`

## PostgreSQL foundation (Epic 11, Story 11.1)

PostgreSQL 18 runs beside Mongo until Story 11.7. **Users and refresh tokens (Story 11.2), feedback and the app config (Story 11.3) and lists, shares and invites (Story 11.4) live in PostgreSQL**; items and
categories are still Mongo. The registration switch is read from `app_config` on every request (no cache); a missing row means the defaults and a read never writes it, only `setRegistrationEnabled` upserts it. What exists:

- `plugins/Database.kt` reads one `db.postgres` block (`KTOR_DB_HOST/PORT/NAME/USER/PASSWORD/SSLMODE/SSLROOTCERT`,
  defaults `localhost:25432`/`bag_please`/`bag_please_app`, `sslmode: disable`) and builds BOTH URLs from it: Flyway's JDBC
  URL (`sslrootcert`) and the runtime R2DBC URL (`sslRootCert`). The app always connects as the non-superuser
  `bag_please_app`, which owns `public` in `bag_please` (`postgres/init/01-app-role.sh` in Compose).
- **Schema is Flyway only**: `src/main/resources/db/migration/V<n>__<name>.sql`, applied by `configureDatabase()` in
  `module()` before `configureGql`. DDL only, no data rows, additive, a shipped migration is never edited, never
  `clean`. `V1__baseline.sql` holds all eight tables. No `SchemaUtils`/`MigrationUtils` anywhere.
- **`tx { }` is the only caller of `suspendTransaction`.** It joins an open transaction or opens one (no savepoints,
  max attempts 1). `afterCommit { }` (on the `TxScope` receiver) queues an action on the OUTERMOST transaction: it runs
  once, in registration order, after that commit, and is dropped on rollback. Never `emit` inside `tx`. Put Arrow
  `either { }` outside `tx { }`: a `raise` inside rolls the transaction back.
- **Accounts and sessions (Story 11.2)**: `entity/user/db/` and `features/auth/db/` hold the Exposed `Table`, row mapper
  and repository (no connection argument; they run inside a service's `tx {}`). Services own the transaction:
  `UserService` / `AuthService` wrap every DB-touching body in `tx {}` with Arrow `either {}` outside it. SQLSTATE `23505`
  is translated in `UserRepository.insert` to `DuplicateUsernameException` (`Throwable.isUniqueViolation()` in
  `Database.kt`). `username` is `COLLATE "C"`: case-sensitive equality, binary order for the admin list. Password
  change / admin reset drop the user's refresh tokens in the same transaction as the new hash.
  `UserService.deleteUser` is one transaction: `SELECT … FOR UPDATE`, list purge via `ListService`, tokens deleted,
  `users` row deleted last. `ListService` and the epic-4 migration look users up through `UserLookup`
  (`tx { findByUsername }`, joins an open tx), never a PG repository directly.
- **Lists, shares and invites (Story 11.4)**: `entity/list/db/` (`ListTable`, `ListMemberTable`, `ListRowMapper`,
  `ListRepository`). `list_members` is the sole membership/invite record: the owner holds an `ACCEPTED` row but is
  excluded from `List.members` (the Share dialog data = `PENDING` + `ACCEPTED` rows minus the owner, oldest first by
  `created_at` then `user_id`; `DECLINED` never shown). Owner and member usernames are joined from `users`, never stored;
  domain `List` has no member arrays. `ListService` owns every `tx {}` (the membership check runs in the same tx as the
  work it guards) and returns `ListView(list, members, uncheckedItemCount)`; `isMember` is a suspend one-row indexed read
  used by the subscription `takeWhile`. Creating a list inserts the list and the owner row in one tx; re-inviting a
  `DECLINED` user flips that row to `PENDING` with a fresh `created_at`; the admin has no rows and every list operation
  rejects it. `ListService` takes `Lazy<ItemService>` (items verify membership, list views count unchecked items via
  `ItemService.countUncheckedByList`); `Application.kt` builds `ItemService` after a `lateinit var`. The list cascade
  deletes items/categories on Mongo first, then members/list in PostgreSQL: the two stores are not atomic on this
  branch (AR-E11-2). `UserService.deleteUser` calls `ListService.purgeUser(userId)`; the `lists.owner_id` /
  `list_members.user_id` FKs are `RESTRICT`, so the `users` row can only go after the purge.
- **Expired refresh tokens** are rejected on read (`AuthService.refresh`) and purged by the hourly scheduler step
  `purgeExpiredTokens()` (`plugins/Scheduler.kt`: ordered named steps, each in its own try/catch). Nothing expires them automatically in the database.
- `/api/health` answers 200 only when `SELECT 1` and the Mongo ping both answer within 2 s in total; otherwise 503.
- Verified in the 11.1 spike: Ktor Netty and r2dbc-postgresql's reactor-netty run together (Gradle resolves Netty to
  4.2.17) and R2DBC connects over TLS with `verify-full`.

## Tests

Kotest `FunSpec` only, no mocking library: tests run against a real MongoDB from the `FunSpec.mongoContainer()` helper
in `src/test/kotlin/com/bagplease/utils/TestContainers.kt`. `FunSpec.postgresContainer()` returns one shared
`postgres:18` per test JVM; PostgreSQL rows (users, lists, members, ...) outlive a spec, so `mongoContainer()` calls `SharedPostgres.reset()`
(TRUNCATE … CASCADE) before each spec, and PG-only specs call it explicitly. Specs that build services directly call
`connectDatabase(container.appConfig())` first (role `bag_please_app` set up like Compose); `setUpMongo` also points the app at it, because
`module()` runs Flyway at startup. Specs that need a clean schema create their own database with `createDatabase`. `buildTestServices(db)` wires `ListService` + `ItemService` the way `Application.kt` does, and `pgRows` / `pgCount` assert on PostgreSQL over JDBC.

## Config

`application.yaml` is read once at startup (`EngineMain`, `ktor.development: false`), so edits to it need a restart of
`run -t`. The `run` task also passes `-Dio.ktor.development=<-Pdevelopment present?>` (`build.gradle.kts:16-17`), but the
explicit `ktor.development: false` in the yaml is the configured value, so `-Pdevelopment` alone is not expected to
switch development mode on (not measured).

## Which Jackson writes what

Jackson 2 (`com.fasterxml`) and Jackson 3 (`tools.jackson`) are both on the runtime classpath. Measured in Story 10.2:

- **GraphQL HTTP bodies are written by graphql-kotlin's own Jackson 3** (`graphql-ws` frames likewise by its subscription
  server — inferred from the dependency graph and from the Ktor converter being unused, not black-box measured)
  (`graphql-kotlin-ktor-server` depends on `ktor-serialization-jackson3`; its route-level `ContentNegotiation` wins).
  The root install does not touch them: `INDENT_OUTPUT` on it leaves GraphQL bodies compact, and deleting it leaves
  GraphQL responses identical. GraphQL answers `200` `application/json` (no charset) for `application/json`, `*/*` or no
  `Accept`, and `406` with an empty body for `application/xml` / `text/plain`.
- **REST (`/auth/*` DTOs) is written by the root `install(ContentNegotiation) { jackson() }` in `Routing.kt` (Jackson
  2)**, keys in declaration order (`accessToken, username, role`). Moving it to a sub-route or removing it breaks REST
  login and every call that logs in.
- `install(WebSockets)` carries no `contentConverter` (it was unused; no `sendSerialized`/`receiveDeserialized` exists).
- Pinned by `JacksonSerializationTest` (behaviour, not library identity: it would not catch a swap that keeps output
  identical). Re-check before any Ktor or graphql-kotlin major.
- Re-checked at graphql-kotlin 11.0.0 (Story 10.4, graphql-java 26.1): `graphql-kotlin-ktor-server:11.0.0` still pulls
  `ktor-serialization-jackson3` (Jackson 3 `tools.jackson` 3.2.2, unchanged from 10.2.1), `JacksonSerializationTest`
  green, and the GraphQL error bodies, `406` and GraphiQL statuses are byte-identical to 10.2.1.

## Security

Multi-user with RBAC (built out across Epics 1–4 — the "single admin user" model is long gone).

- **Auth is REST under `/api/auth/*`** (not a bare `/api/login`): `register`, `login`, `refresh`, `logout`,
  `change-password`, `config`. `POST /api/auth/login` returns a short-lived **access token (~15 min**,
  `KTOR_JWT_ACCESS_EXPIRY_MINUTES`)
  with `username` + `role` claims, **plus** an httpOnly `Secure` `SameSite=Strict` `refresh_token` cookie (UUID in PostgreSQL
  `refresh_tokens`, 30 days, expired rows purged hourly by the scheduler). Auth endpoints are rate-limited (`RateLimitName("auth")` → HTTP 429).
- **All GraphQL HTTP** (`POST /api/graphql`) requires `Authorization: Bearer <accessToken>`.
- **GraphQL subscriptions ARE authenticated** (Story 4.2): the JWT arrives in `connection_init` as
  `connectionParams.Authorization = "Bearer <token>"`; `WsGraphQLContextFactory` verifies it and closes the socket with
  code **4401** if it is missing or invalid.
- **The principal IS exposed through the GraphQL context** under the `GQL_CALL_PRINCIPAL` key —
  `CustomGraphQLContextFactory`
  for HTTP, `WsGraphQLContextFactory` for WebSocket (both in `GQL.kt`). Service-layer authorization reads the caller
  from there; per-list access is enforced by `verifyMembership` on subscribe plus a `takeWhile` membership re-check on
  every emitted event, so a revoked member's stream terminates on the next event.
- **The `admin` account is special-cased:** it has no row in the `users` table, is 403-forbidden from
  `/api/auth/change-password`, and is blocked from all list operations (`ensure(caller.value != adminLogin)`).
