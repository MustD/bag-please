# CLAUDE.md — Backend (`bp_back/`)

Guidance for working in the Kotlin/Ktor GraphQL backend. Build/test commands live in the root `CLAUDE.md`.

## Backend layers

```
GQL layer (gql/)          – graphql-kotlin Query/Mutation/Subscription objects
Service layer (service/)  – business logic + Kotlin SharedFlow subscriptions
Storage layer (storage/)  – in-memory ConcurrentMap with lazy sync on first access
Mongo layer (mongo/)      – MongoDB coroutine driver repositories
```

Data flows from the GQL layer down through the service, through the in-memory storage, and is persisted to MongoDB. On
startup the storage is populated from MongoDB on first access (`synced` flag). Mutations emit on a `MutableSharedFlow`
which the GraphQL subscriptions expose as a `Flow`.

Each domain entity (Item, Category) has a parallel set of files in each layer:

- `storage/` — plain domain model (`Item`, `Category`)
- `mongo/model/` — MongoDB BSON model + mapper
- `gql/model/` — GraphQL model + mapper
- `service/` — orchestrates storage + emits subscription events
- `gql/` — Query/Mutation/Subscription objects registered in `GqlDefinition`

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
