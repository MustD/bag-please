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

The backend has a single admin user. `POST /api/login` returns a JWT (7-day expiry). All GraphQL mutations/queries
require this token as `Authorization: Bearer <token>`. GraphQL subscriptions do **not** require auth (via WebSocket).
The `CustomGraphQLContextFactory` in `GQL.kt` has commented-out code for exposing the principal through the GraphQL
context if needed.
