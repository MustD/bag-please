# Integration Architecture

## Overview

The three parts communicate through nginx as a unified entry point. The frontend communicates with the backend
exclusively via GraphQL (HTTP for queries/mutations, WebSocket for subscriptions). There is no direct
frontend-to-MongoDB connection.

```
┌──────────────────────────────────────────────────────┐
│                    Browser                           │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP / WebSocket
                       ▼
┌──────────────────────────────────────────────────────┐
│              routing (nginx :2080)                   │
│                                                      │
│  /api/subscriptions ──────────────────────────────┐  │
│  /api/*             ───────────────────────────┐  │  │
│  /                  ──────────────────────┐    │  │  │
└─────────────────────────────────────────  │    │  │  ┘
                                            │    │  │
                    ┌───────────────────────┘    │  │
                    │  HTTP                      │  │
                    ▼                            │  │
┌─────────────────────────────┐   WebSocket      │  │
│  bp_front (Next.js :3000)   │                  │  │
│                             │                  │  │
│  ApolloWrapper              │                  │  │
│    HTTP link ───────────────┼──────────────────┘  │
│    WS link  ────────────────┼─────────────────────┘
└─────────────────────────────┘
                                  │        │
                                  ▼        ▼
                  ┌──────────────────────────────────┐
                  │     bp_back (Ktor :4000)         │
                  │                                  │
                  │  POST /api/graphql               │
                  │  ws   /api/subscriptions         │
                  │  POST /api/login                 │
                  └───────────────┬──────────────────┘
                                  │
                                  ▼
                  ┌──────────────────────────────────┐
                  │     MongoDB :27017               │
                  │     Database: bag_please         │
                  │     Collections: items, categories│
                  └──────────────────────────────────┘
```

## Integration Points

| From     | To       | Protocol     | Path                               | Auth                             |
|----------|----------|--------------|------------------------------------|----------------------------------|
| Browser  | nginx    | HTTP/WS      | `:2080/*`                          | None (nginx is public)           |
| nginx    | bp_front | HTTP         | `/:3000`                           | None                             |
| nginx    | bp_back  | HTTP         | `/api/*:4000`                      | JWT Bearer (verified by bp_back) |
| nginx    | bp_back  | WebSocket    | `/api/subscriptions:4000`          | None (tech debt)                 |
| nginx    | bp_front | WebSocket    | `/_next/webpack-hmr:3000`          | None (dev only)                  |
| bp_front | bp_back  | GraphQL HTTP | `POST /api/graphql`                | `Authorization: Bearer <jwt>`    |
| bp_front | bp_back  | GraphQL WS   | `ws(s)://<host>/api/subscriptions` | None                             |
| bp_front | bp_back  | REST         | `POST /api/login`                  | None (credential payload)        |
| bp_back  | MongoDB  | TCP          | `:27017`                           | SCRAM-SHA-1 credentials          |

## Authentication Boundary

```
Browser → nginx → bp_back (POST /api/graphql)
                      ↑
              Ktor authenticate("auth-jwt")
              validates JWT in Authorization header

Browser → nginx → bp_back (ws /api/subscriptions)
                      ↑
              NO authentication (known tech debt)
```

The frontend injects the JWT on every HTTP request via `ApolloWrapper`'s `SetContextLink`. WebSocket connections carry
no credentials.

## Data Flow — Create Item

```
1. User fills CreateItem dialog → clicks Save
2. bp_front: useMutation(createItemMutation) fires
3. Apollo HTTP link → POST /api/graphql
   Body: { query: "mutation { saveItem(...) { ... } }" }
   Header: Authorization: Bearer <jwt>
4. nginx routes /api/* → bp_back:4000
5. bp_back: Ktor auth validates JWT
6. ItemMutations.saveItem() → ItemService.saveItem()
7. ItemStorage.save() → ConcurrentMap update + ItemRepository.save()
8. MongoDB upsert (items collection)
9. itemUpdateChannel.emit(savedItem)  [SharedFlow]
10. Response: saved GqlItem
11. All WebSocket subscribers on getItemUpdates receive ItemUpdate{SAVED, item}
12. bp_front: subscribeToMore.updateQuery() updates Apollo cache
13. ItemsList re-renders with new item
```

## Data Flow — Login

```
1. User submits LoginPage form
2. bp_front: fetch POST /api/login {username, password}
3. nginx routes /api/* → bp_back:4000
4. bp_back: Security.kt securityRoutes() handles POST /login
5. Validates credentials against KTOR_ADMIN_LOGIN / KTOR_ADMIN_PASS
6. Returns { token: "<jwt>", user: "admin" }
7. bp_front: localStorage.setItem("token", jwt)
8. router.push("/")
```

## Shared Data Contracts

The GraphQL schema is the single source of truth. The contract is maintained by:

- `bp_back` generating the schema at startup (graphql-kotlin schema-first)
- `bp_front/src/__generated__/graphql.ts` generated from the live schema via `npm run generate`

Any schema change in `bp_back` requires `npm run generate` to be run before the frontend types are in sync.

## Docker Networking

All services share the `bp_network` bridge network. In dev mode, the router uses `host.docker.internal` to reach
locally-running services instead of Docker container names. See `deployment-guide.md` for switching modes.
