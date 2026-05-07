# Project Overview — Bag Please

## Summary

**Bag Please** is a full-stack personal shopping list manager. Users maintain a list of items grouped by categories, checking items off as they shop. The app supports real-time updates across browser sessions via GraphQL subscriptions.

## Repository Structure

| Type | Description |
|------|-------------|
| Multi-part repository | Three independently deployable parts unified by Docker Compose |
| Orchestration | Docker Compose (dev & prod) |
| Entry point | nginx on port 2080 |

## Parts

| Part | Root | Type | Language / Runtime |
|------|------|------|--------------------|
| **bp_back** | `bp_back/` | Backend API | Kotlin 2.3.21 / JVM 25 |
| **bp_front** | `bp_front/` | Frontend SPA | TypeScript 6 / Next.js 16 / React 19 |
| **routing** | `routing/` | Reverse proxy | nginx |

## Technology Stack Summary

### Backend (`bp_back`)
- **Language:** Kotlin 2.3.21, JDK 25
- **Framework:** Ktor 3.4.3 (Netty engine)
- **API:** graphql-kotlin 9.2.0 (ExpediaGroup) — schema-first GraphQL
- **Database:** MongoDB 8 via Kotlin Coroutine Driver 5.5.1
- **Auth:** JWT (HMAC-256, 7-day expiry, single admin user)
- **In-memory cache:** `ConcurrentMap` with lazy MongoDB sync on first access
- **Real-time:** Kotlin `SharedFlow` exposed as GraphQL subscriptions over WebSocket
- **FP library:** Arrow-kt 2.1.2

### Frontend (`bp_front`)
- **Language:** TypeScript 6.0.3 (strict mode)
- **Framework:** Next.js 16.2.4 (App Router, standalone output)
- **UI Library:** React 19.2.5 + MUI v9.0.0
- **GraphQL client:** Apollo Client 4.1.9
- **Real-time:** graphql-ws 6.0.8 (WebSocket subscriptions via `subscribeToMore`)
- **State:** React `useState` + Immutable.js 5.1.5 for sorted/filtered lists
- **Types:** auto-generated from schema via graphql-codegen 7.0.0

### Routing
- **nginx** on port 2080 — unified entry point routing `/api/*` to backend and `/` to frontend

## Architecture Pattern

```
Browser
  └── nginx :2080
        ├── /api/subscriptions  → WebSocket → Ktor :4000
        ├── /api/*              → HTTP      → Ktor :4000
        └── /                  → HTTP      → Next.js :3000

Ktor backend
  └── GQL layer (graphql-kotlin)
        └── Service layer (business logic + SharedFlow events)
              └── Storage layer (ConcurrentMap, lazy sync)
                    └── MongoDB layer (coroutine driver)
```

## Domain Model

Two entities: **Item** and **Category**.
- An `Item` belongs to one `Category` (FK by UUID).
- Items and Categories support CRUD via GraphQL mutations.
- Both entities publish real-time changes (saves + deletes) as GraphQL subscriptions.

## Key Entry Points

| Concern | URL / Path |
|---------|-----------|
| App (browser) | `http://localhost:2080/` |
| Login page | `http://localhost:2080/auth` |
| GraphQL playground | `http://localhost:2080/api/graphiql` |
| GraphQL endpoint | `POST http://localhost:2080/api/graphql` |
| GraphQL subscriptions | `ws://localhost:2080/api/subscriptions` |
| REST login | `POST http://localhost:2080/api/login` |

## Existing Supporting Files

- `documentation/bag-please.drawio` — architecture diagram (DrawIO format)
- `ApiPlayground/` — IntelliJ HTTP Client `.http` files for all API operations
- `CLAUDE.md` — AI agent coding rules for this project
