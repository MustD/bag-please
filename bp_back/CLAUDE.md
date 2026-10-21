# CLAUDE.md — Backend (`bp_back/`)

Guidance for working in the Kotlin/Ktor GraphQL backend. Build/test commands live in the root `CLAUDE.md`.

## Backend layers

```
GQL layer      (entity/<name>/gql/)          – graphql-kotlin Query/Mutation/Subscription objects
Service layer  (entity/<name>/<Name>Service) – business logic + Kotlin SharedFlow subscriptions
Storage layer  (entity/<name>/<Name>Storage) – in-memory ConcurrentMap with lazy sync on first access
Mongo layer    (entity/<name>/mongo/)        – MongoDB coroutine driver repositories
```

Data flows from the GQL layer down through the service, through the in-memory storage, and is persisted to MongoDB. On
startup the storage is populated from MongoDB on first access (`synced` flag). `synced` is never reset, so a document
written straight to Mongo after a storage's first access stays invisible to the app until restart. Mutations emit on a
`MutableSharedFlow` which the GraphQL subscriptions expose as a `Flow`.

Shared code sits beside the entity slices under `src/main/kotlin/com/bagplease/`: `config/` (application config,
its GQL and Mongo parts), `features/auth/` (REST auth routes, `AuthService`, refresh tokens), `mongo/`
(`MongoConnection`, `AppMigrationsRepository`) and `plugins/` (Ktor plugins, `GQL.kt`, `Migration.kt`).

The code is sliced **per entity**, not per layer: `src/main/kotlin/com/bagplease/entity/<name>/` (`item`, `category`,
`list`, `user`, `feedback`) holds all of that entity's layers, e.g. `entity/item/`:

- `Item.kt` — plain domain model
- `ItemService.kt` — orchestrates storage + emits subscription events
- `ItemStorage.kt` — the in-memory cache (only `item`, `category` and `list` have one; `user` and `feedback`
  services call their repository directly)
- `gql/` — GraphQL model + `object` mapper, and the `ItemApi.kt` Query/Mutation/Subscription objects, registered in
  `plugins/GQL.kt`'s `configureGql()`
- `mongo/` — MongoDB BSON model + `object` mapper + `ItemRepository`

## Tests

Kotest `FunSpec` only, no mocking library: tests run against a real MongoDB from the `FunSpec.mongoContainer()` helper
in `src/test/kotlin/com/bagplease/utils/TestContainers.kt`.

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
  with `username` + `role` claims, **plus** an httpOnly `Secure` `SameSite=Strict` `refresh_token` cookie (UUID in Mongo
  `refresh_tokens` with a TTL index, 30 days). Auth endpoints are rate-limited (`RateLimitName("auth")` → HTTP 429).
- **All GraphQL HTTP** (`POST /api/graphql`) requires `Authorization: Bearer <accessToken>`.
- **GraphQL subscriptions ARE authenticated** (Story 4.2): the JWT arrives in `connection_init` as
  `connectionParams.Authorization = "Bearer <token>"`; `WsGraphQLContextFactory` verifies it and closes the socket with
  code **4401** if it is missing or invalid.
- **The principal IS exposed through the GraphQL context** under the `GQL_CALL_PRINCIPAL` key —
  `CustomGraphQLContextFactory`
  for HTTP, `WsGraphQLContextFactory` for WebSocket (both in `GQL.kt`). Service-layer authorization reads the caller
  from there; per-list access is enforced by `verifyMembership` on subscribe plus a `takeWhile` membership re-check on
  every emitted event, so a revoked member's stream terminates on the next event.
- **The `admin` account is special-cased:** it has no row in the `users` collection, is 403-forbidden from
  `/api/auth/change-password`, and is blocked from all list operations (`ensure(caller.value != adminLogin)`).
