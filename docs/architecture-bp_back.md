# Architecture — bp_back (Backend)

## Executive Summary

`bp_back` is a Kotlin/Ktor backend serving a GraphQL API for the Bag Please shopping list app. It uses an in-memory
`ConcurrentMap` as a write-through cache on top of MongoDB. Real-time updates are delivered as GraphQL subscriptions via
Kotlin `SharedFlow` over WebSocket. A single hardcoded admin user authenticates via JWT.

## Technology Stack

| Category           | Technology                      | Version        |
|--------------------|---------------------------------|----------------|
| Language           | Kotlin                          | 2.3.21         |
| JVM                | JDK toolchain                   | 25             |
| Server framework   | Ktor (Netty engine)             | 3.4.3          |
| GraphQL            | graphql-kotlin (ExpediaGroup)   | 9.2.0          |
| Database driver    | MongoDB Kotlin Coroutine        | 5.5.1          |
| BSON serialization | bson-kotlinx                    | 5.5.1          |
| FP utilities       | Arrow-kt                        | 2.1.2          |
| Auth               | Ktor JWT plugin + Auth0 JWT     | (bundled)      |
| Build              | Gradle (wrapper at repo root)   | 9.5.0          |
| Testing            | Kotest FunSpec + Testcontainers | 6.1.11 / 2.0.5 |

## Architecture Pattern: Layered + Vertical Slices

The backend is structured as a layered architecture with vertical entity slices:

```
┌─────────────────────────────────────────────┐
│              HTTP / WebSocket               │
├─────────────────────────────────────────────┤
│  GQL Layer (graphql-kotlin)                 │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │  ItemApi     │  │  CategoryApi         │ │
│  │  (Q/M/Sub)   │  │  (Q/M/Sub)           │ │
│  └──────┬───────┘  └──────────┬───────────┘ │
├─────────┼──────────────────────┼────────────┤
│  Service Layer                 │            │
│  ┌──────▼───────┐  ┌──────────▼──────────┐ │
│  │  ItemService │  │  CategoryService    │ │
│  │  (+ flows)   │  │  (+ flows)          │ │
│  └──────┬───────┘  └──────────┬──────────┘ │
├─────────┼──────────────────────┼────────────┤
│  Storage Layer                 │            │
│  ┌──────▼───────┐  ┌──────────▼──────────┐ │
│  │  ItemStorage │  │  CategoryStorage    │ │
│  │  ConcurrentMap│ │  ConcurrentMap      │ │
│  └──────┬───────┘  └──────────┬──────────┘ │
├─────────┼──────────────────────┼────────────┤
│  MongoDB Layer                 │            │
│  ┌──────▼──────┐  ┌────────────▼──────────┐ │
│  │ItemRepository│  │CategoryRepository    │ │
│  └─────────────┘  └──────────────────────┘ │
│              MongoDB 8                      │
└─────────────────────────────────────────────┘
```

## Plugin System (Ktor)

Ktor uses a plugin-based configuration approach. All plugins are registered in `Application.module()`:

```
Application.module()
├── DI: provide { MongoConnection(config) }
├── configureCors()          → CORS.kt
├── configureMonitoring()    → Monitoring.kt (call logging)
├── configureSecurity()      → Security.kt (JWT setup)
├── configureGql()           → GQL.kt (GraphQL + WebSocket)
└── configureRouting()       → Routing.kt (assembles all routes)
```

`GQL.kt` is the most complex plugin — it:

1. Resolves `MongoConnection` from DI
2. Instantiates repositories → storages → services for each entity
3. Installs the `GraphQL` plugin with all Query/Mutation/Subscription objects
4. Installs `WebSockets` with `JacksonWebsocketContentConverter`

## Dependency Injection

Ktor's built-in DI (`ktor-server-di`) is used. Registrations go in `dependencies {}` blocks; injections use
`by dependencies` property delegates.

Currently only `MongoConnection` is registered at the application level. Entity repositories/services/storages are
instantiated directly in `GQL.kt` (not registered in DI).

## Authentication Flow

```
Client → POST /api/login {"username":"admin","password":"admin"}
       → returns JWT (7-day expiry, HMAC-256)

Client → POST /api/graphql
         Authorization: Bearer <jwt>
       → Ktor authenticate("auth-jwt") validates token
       → GraphQL operation executes

Client → ws://.../api/subscriptions
       → No auth (tech debt — subscriptions bypass auth)
```

## Real-Time Data Flow (Subscriptions)

```
Mutation saveItem(item) called
  └── ItemService.saveItem(item)
        ├── ItemStorage.save(item)        ← updates ConcurrentMap + MongoDB
        └── itemUpdateChannel.emit(item)  ← MutableSharedFlow<Item>

GraphQL subscription getItemUpdates()
  └── merge(
        service.itemUpdates.map { GqlItemUpdate(SAVED, it) },
        service.itemDeletions.map { GqlItemUpdate(DELETED, it) }
      )
  └── emits to all WebSocket subscribers
```

**Key constraint:** `SharedFlow` instances are declared as `private val` properties on the Service class. If declared
inside a function, each call creates a new flow with zero subscribers.

## Storage Lazy Sync Pattern

```kotlin
suspend fun sync() {
    if (synced.not()) {
        repository.getAll().forEach { storage[it.id] = it }
        synced = true
    }
}
// Called at the start of every read/write method
```

On first access, MongoDB data is loaded into the `ConcurrentMap`. Subsequent calls skip MongoDB entirely for reads.

## Configuration

All values come from `application.yaml` with env var override syntax:

```yaml
ktor:
  deployment:
    host: "0.0.0.0"
    port: 4000
    rootPath: "api"     # All routes are under /api/

jwt:
  secret: "$KTOR_JWT_SECRET:secret"
  admin_login: "$KTOR_ADMIN_LOGIN:admin"
  admin_pass: "$KTOR_ADMIN_PASS:admin"

db.mongo:
  host: "$KTOR_MONGO_HOST:localhost"
  port: "$KTOR_MONGO_PORT:27017"
```

## Testing Architecture

- **Framework:** Kotest `FunSpec` + JUnit 5 platform
- **Infrastructure:** Testcontainers `MongoDBContainer("mongo:8")` — no mocking
- **Test isolation:** Each `testApplication {}` block boots a fresh Ktor app with a fresh in-memory store that syncs
  from the shared MongoDB container on first access
- **Auth in tests:** `setUpJwt()` injects static JWT config; tests call `POST /login` to obtain a real token
- **Concurrency:** Tests run in parallel against a shared container — assertions must filter by UUIDs created in the
  current test

## Known Tech Debt

| Issue                                       | Location             | Notes                                                           |
|---------------------------------------------|----------------------|-----------------------------------------------------------------|
| WebSocket subscriptions are unauthenticated | `GQL.kt:gqlRoutes()` | `graphQLSubscriptionsRoute()` is outside `authenticate {}`      |
| `setUpJwt()` injects config dynamically     | `TestContainers.kt`  | Should be replaced by `src/test/resources/application.yaml`     |
| No health endpoint                          | `Routing.kt`         | No `/health` or `/ping`; use `/api/graphiql` as readiness check |
| `Service.kt` is unused                      | `Service.kt`         | Thin `ApplicationConfig` wrapper with no current usage          |
