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
