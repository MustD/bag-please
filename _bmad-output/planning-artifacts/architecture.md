---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-05-08'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/project-context.md
  - docs/index.md
  - docs/architecture-bp_back.md
  - docs/architecture-bp_front.md
  - docs/architecture-routing.md
  - docs/api-contracts-bp_back.md
  - docs/data-models-bp_back.md
  - docs/integration-architecture.md
  - docs/deployment-guide.md
  - docs/development-guide.md
  - docs/component-inventory-bp_front.md
  - docs/source-tree-analysis.md
  - docs/project-overview.md
workflowType: 'architecture'
project_name: 'bag-please'
user_name: 'md'
date: '2026-05-08'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each
architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
33 FRs spanning: user registration/login, session management (access + refresh tokens), admin user CRUD,
ApplicationConfig (registration toggle), RBAC enforcement, rate limiting, reserved username guard, and uniform error
responses. The requirements are well-scoped for a single MVP phase with no ambiguity about what is deferred (Phase 2+).

**Non-Functional Requirements:**
The NFRs with the highest architectural weight:

- NFR1: bcrypt cost-12 — adds ~200–400ms per hash operation; acceptable but must not be done on the main coroutine
  thread
- NFR2-3: Refresh token in MongoDB with TTL index + httpOnly SameSite=Strict cookie delivery — defines the token
  lifecycle architecture
- NFR4: Access token 15 min, refresh token 30 days — determines frontend retry complexity
- NFR6: Per-IP rate limiting on `/auth/login` and `/auth/register` — requires a new Ktor plugin
- NFR12: ApplicationConfig loaded at startup, cached in memory, cache invalidated on write — a specific caching contract

**Scale & Complexity:**

- Primary domain: full-stack web authentication (Kotlin backend + Next.js frontend + MongoDB)
- Complexity level: medium (brownfield feature addition, new auth layer, token lifecycle, RBAC, admin controls)
- Epics: 2 | Stories: 7
- Estimated architectural components: 4 backend (UserService, ApplicationConfigService, UserStorage,
  ApplicationConfigStorage), 3 MongoDB collections (users, refresh_tokens, app_config), 5+ new frontend components, 3
  new pages, 2 updated existing components

### Technical Constraints & Dependencies

- **No second Apollo client** — `ApolloWrapper.tsx` is the single client instance; any auth state changes must integrate
  with it, not replace it
- **Ktor plugins pattern** — all new backend concerns go in `plugins/configure*()` functions registered from
  `Application.kt`; no inline configuration
- **Vertical slice mandatory** — every new entity needs domain model + GQL or REST mapper + Storage (with lazy sync) +
  Service + registration
- **Kotlin Serialization is BSON-only** — HTTP request/response bodies use Jackson; `@Serializable` is not used on REST
  DTOs
- **`synced` lazy init is mandatory** — every new Storage class must implement the sync guard; omitting it means the
  in-memory store starts empty
- **Brownfield integrity** — existing Item/Category functionality must not regress; auth layer additions are purely
  additive except for Principal threading and the `localStorage`-to-context token migration

### Cross-Cutting Concerns Identified

1. **Auth state propagation** — Touches backend JWT issuance, Ktor auth plugin validation, Principal in GQL context
   factory, React auth context, Apollo SetContextLink, and all route guards. A single shared mental model must govern
   all layers.
2. **Token lifecycle** — Access token (15 min, in-memory) + refresh token (30 days, httpOnly cookie + MongoDB TTL) must
   behave consistently across login, refresh, logout, and password reset flows.
3. **RBAC enforcement** — Role claim lives in JWT. Backend enforces it on all `/admin/*` endpoints. Frontend enforces it
   via admin route guard and conditional navigation rendering. Both layers must agree on the role vocabulary (`"admin"`
   vs `"user"`).
4. **Registration toggle** — State lives in MongoDB (`app_config`), cached in backend memory, consumed by
   `/auth/register` availability check, and reflected on the frontend login page. A write on the admin panel must
   propagate to the login page without a full reload — requires the frontend to fetch config on load and cache it in
   context.
5. **bcrypt on the hot path** — Password hashing (cost 12) must run off the main dispatcher. Ktor coroutine context +
   `withContext(Dispatchers.IO)` is the safe pattern.
6. **Refresh token invalidation** — Three triggers: logout, admin reset-password, admin delete-user. All must delete
   from the `refresh_tokens` MongoDB collection and take effect on the next `/auth/refresh` call.

## Starter Template Evaluation

### Primary Technology Domain

Brownfield full-stack web application. No starter template applies — the existing
Kotlin/Ktor + Next.js stack is already operational.

### Existing Stack Confirmed

All core technology decisions are inherited from the existing codebase (see project-context.md).
No stack changes are required for this feature.

### New Dependencies Required

**Backend (`gradle/libs.versions.toml`):**

- **bcrypt library** — password hashing at cost factor 12. Recommended: `at.favre.lib:bcrypt`
  (pure Java, no native dependencies, well-maintained). Must be added to version catalog.
- **Ktor rate limiting** — `ktor-server-rate-limit` is available in Ktor 3.x. Verify availability
  for 3.4.3 before committing; fall back to a lightweight in-memory sliding window implementation
  if the plugin is not stable in this version.

**Frontend (`bp_front/package.json`):**

- No new packages required. MUI v9, Apollo Client 4, Next.js 16 cover all auth and admin UI needs.
  `next/font/google` for Inter font is built into the existing Next.js install.

### Note on Dependency Validation

The bcrypt library choice and Ktor rate-limit plugin availability must be verified during
Story 1.1 (User Entity & Registration Backend) before committing to either. This is the first
implementation story and the appropriate moment to lock these in.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- ApplicationConfig caching: AtomicReference singleton (not Storage pattern)
- Auth context placement: separate AuthProvider wrapping ApolloWrapper
- Route guard: client-side layout guard (not Next.js middleware)
- bcrypt library: at.favre.lib:bcrypt

**Already Established by PRD/Project Context:**

- Auth API: REST endpoints under /api/ rootPath (not GraphQL)
- Token structure: 15-min access (JWT, in-memory) + 30-day refresh (httpOnly cookie + MongoDB TTL)
- bcrypt cost factor: 12 (NFR1)
- No refresh token rotation: Phase 1 scope matches PRD TTL model
- RefreshToken: MongoDB-only repository, no domain/storage layer
- Principal threading: activate commented-out code in CustomGraphQLContextFactory

**Deferred Decisions (Post-MVP):**

- Refresh token rotation (Phase 2 security hardening)
- Next.js middleware auth guard (if SSR requirements emerge)

### Data Architecture

**ApplicationConfig Caching**

- Pattern: `AtomicReference<ApplicationConfig>` singleton on the service
- Load: from MongoDB on first access (lazy, same concept as Storage lazy sync)
- Invalidate: atomic replace on every write
- Rationale: Single-document config is a different shape from entity collections;
  the full ConcurrentMap Storage pattern adds conformance overhead without value.

**RefreshToken**

- No domain/storage layer — session artifact only
- Direct MongoDB repository accessed from auth service
- Collection: `refresh_tokens`; TTL index on `expiresAt` field (30 days)
- Invalidation triggers: logout, admin reset-password, admin delete-user

**UserStorage**

- Follows existing lazy sync ConcurrentMap pattern (mandated by project-context AR3)
- Collection: `users`

### Authentication & Security

**bcrypt Library**

- Selected: `at.favre.lib:bcrypt` (pure Java, no native deps, active maintenance)
- Cost factor: 12 (NFR1)
- Must run in `withContext(Dispatchers.IO)` to keep off the main coroutine dispatcher

**JWT Token Structure**

- Access token: 15-min expiry, claims: `username` + `role` (NFR4/NFR8)
- Refresh token: 30-day expiry, stored in MongoDB + httpOnly SameSite=Strict cookie (NFR3)
- Signing: HMAC-256 (existing algorithm, same `KTOR_JWT_SECRET`)
- No token rotation in Phase 1

**Rate Limiting**

- Verify `ktor-server-rate-limit` availability for Ktor 3.4.3 during Story 1.1
- Fallback: in-memory sliding window `ConcurrentHashMap<String, Deque<Long>>`
- Applied per-IP to `/auth/login` and `/auth/register`
- Limit: 5 attempts per 60-second window (reasonable default; configurable via application.yaml)

### API & Communication Patterns

**Route Structure**

- All new endpoints fall under Ktor's existing `rootPath: "api"`:
    - `POST /api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
    - `POST /api/auth/change-password`
    - `GET/POST/DELETE /api/admin/users`, `POST /api/admin/users/{id}/reset-password`
    - `GET/PUT /api/admin/config`
- nginx `/api/*` rule already proxies all of these correctly — no nginx changes required

**Error Response Format**

- All auth endpoint errors return JSON: `{"error": "<message>"}` — consistent with existing REST pattern
- Uniform "Invalid credentials" message for all login/register failures (FR27)
- HTTP 400 for validation errors, 401 for auth failures, 403 for role violations, 429 for rate limit

**Existing /api/login**

- The existing single-user `/api/login` endpoint will be replaced by `/api/auth/login`
  which handles both admin (env-var check) and registered users (DB lookup)

### Frontend Architecture

**Auth Context**

- Implementation: React `createContext` + `useState` — no external library
- Provider: `AuthProvider` component wrapping `ApolloWrapper` in `layout.tsx`
- State shape: `{ username: string | null, role: "admin" | "user" | null, accessToken: string | null }`
- Token mutations: `setAuth({ username, role, accessToken })`, `clearAuth()`
- `ApolloWrapper.tsx` SetContextLink reads `accessToken` via `useContext(AuthContext)`

**Route Guards**

- Implementation: client-side `"use client"` component in root layout
- Auth guard: checks `AuthContext.username`; if null, redirects to `/auth`
- Admin guard: checks `AuthContext.role === "admin"`; non-admin on `/admin/*` redirects to `/`
- Guards run after Apollo hydration — no flash of protected content on fast connections

**Apollo 401 Retry**

- `authErrorLink` enhanced: on network 401 → call `POST /api/auth/refresh` →
  on success update `AuthContext.accessToken` and retry original request once
- On refresh failure: call `clearAuth()` and redirect to `/auth?expired=1`
- The `?expired=1` query param signals the login page to show the session expiry `Alert`

### Infrastructure & Deployment

No changes to Docker Compose, nginx, or MongoDB infrastructure.
New MongoDB collections (`users`, `refresh_tokens`, `app_config`) are created automatically
by MongoDB on first write — no migration scripts required.

## Implementation Patterns & Consistency Rules

### Backend Package Structure

New auth code is split across two concerns:

**Entity slice (`entity/user/`):**

```
entity/user/
  User.kt                      ← domain model
  UserStorage.kt               ← ConcurrentMap + lazy sync (per project-context rule)
  UserService.kt               ← business logic; Arrow Either error handling
  mongo/
    MongoUser.kt               ← @Serializable BSON model
    MongoUserMapper.kt         ← object singleton mapper
    UserRepository.kt          ← MongoDB coroutine repository
```

**Auth plugin (`plugins/`):**

```
plugins/
  Auth.kt                      ← configureSecurity() extension — JWT setup (existing, extend)
  AuthRoutes.kt                ← configureAuthRoutes() — /auth/* handlers
  AdminRoutes.kt               ← configureAdminRoutes() — /admin/* handlers
  RateLimiting.kt              ← configureRateLimiting() — per-IP limiter plugin
```

**ApplicationConfig (not an entity slice — single-document config):**

```
config/
  ApplicationConfig.kt         ← domain + AtomicReference service in one file (simple)
  mongo/
    MongoApplicationConfig.kt  ← @Serializable BSON model
    ApplicationConfigRepository.kt
```

**RefreshToken (session artifact — no domain/storage layer):**

```
auth/
  RefreshToken.kt              ← @Serializable BSON model only (no domain model)
  RefreshTokenRepository.kt    ← MongoDB repository, called directly from UserService
```

**Registration in Application.kt:**

```kotlin
// In Application.module():
configureRateLimiting()        // NEW — must be before auth routes
configureSecurity()            // existing — extend for multi-user JWT
configureAuthRoutes(userService, appConfigService)   // NEW
configureAdminRoutes(userService, appConfigService)  // NEW
configureRouting()             // existing — keep /api/login until fully replaced
```

---

### REST Handler Pattern (New Pattern)

All auth/admin route handlers follow this structure — no existing REST handler pattern exists
in the codebase, so this establishes the convention:

```kotlin
// In configureAuthRoutes():
post("/auth/login") {
    val body = call.receive<LoginRequest>()          // Jackson deserialization
    val result = userService.login(body.username, body.password)
    result.fold(
        ifLeft = { err -> call.respond(err.status, ErrorResponse(err.message)) },
        ifRight = { token -> call.respond(HttpStatusCode.OK, LoginResponse(...)) }
    )
}
```

**Rules:**

- Request bodies use Jackson (`call.receive<T>()`) — NOT `@Serializable` (Kotlin Serialization is BSON-only)
- All errors return `{"error": "<message>"}` JSON — use a shared `data class ErrorResponse(val error: String)`
- Service layer returns `Arrow Either<AuthError, T>` — fold at the route handler, never throw
- Route handlers are thin — no business logic; delegate entirely to service

---

### bcrypt IO Dispatcher Pattern

```kotlin
// In UserService — ALWAYS wrap bcrypt in Dispatchers.IO:
suspend fun hashPassword(password: String): String =
    withContext(Dispatchers.IO) {
        BCrypt.withDefaults().hashToString(12, password.toCharArray())
    }

suspend fun verifyPassword(password: String, hash: String): Boolean =
    withContext(Dispatchers.IO) {
        BCrypt.verifyer().verify(password.toCharArray(), hash).verified
    }
```

**Anti-pattern to avoid:**

```kotlin
// WRONG — blocks the coroutine dispatcher:
val hash = BCrypt.withDefaults().hashToString(12, password.toCharArray())
```

---

### Admin Credential Check Pattern

Admin is from env vars — never stored in the `users` collection. The login handler
must check admin credentials BEFORE the DB:

```kotlin
// In UserService.login():
suspend fun login(username: String, password: String): Either<AuthError, LoginResult> {
    // 1. Check admin credentials first (env var comparison)
    if (username == adminLogin && verifyPassword(password, adminPasswordHash)) {
        return Right(LoginResult(username, Role.ADMIN))
    }
    // 2. Only then check the users collection
    val user = userStorage.findByUsername(username) ?: return Left(AuthError.InvalidCredentials)
    if (!verifyPassword(password, user.passwordHash)) return Left(AuthError.InvalidCredentials)
    return Right(LoginResult(username, Role.USER))
}
```

**Rule:** Uniform "Invalid credentials" returned for ALL failures — wrong username,
wrong password, and non-existent user all produce the same `AuthError.InvalidCredentials`.

---

### Refresh Token Cookie Pattern

All refresh token cookie writes must use exactly these attributes:

```kotlin
response.cookies.append(
    name = "refresh_token",
    value = refreshToken,
    maxAge = 30 * 24 * 60 * 60,   // 30 days in seconds
    httpOnly = true,
    secure = true,                  // HTTPS only in production; Ktor handles dev vs prod
    extensions = mapOf("SameSite" to "Strict"),
    path = "/api/auth"              // scope to auth endpoints only
)
```

**Reading the cookie in handlers:**

```kotlin
val refreshToken = call.request.cookies["refresh_token"]
    ?: return call.respond(HttpStatusCode.Unauthorized, ErrorResponse("No refresh token"))
```

---

### API Response DTO Shapes

These must be consistent across all stories — agents must not invent their own shapes:

```kotlin
// Shared DTOs (create in auth/dto/ package)
data class ErrorResponse(val error: String)

data class LoginRequest(val username: String, val password: String)
data class LoginResponse(val accessToken: String, val username: String, val role: String)

data class RegisterRequest(val username: String, val password: String)
// Register returns LoginResponse (same shape — auto-login chain)

data class RefreshResponse(val accessToken: String)
// Refresh returns only a new access token — username/role already in existing token

data class UserResponse(val id: String, val username: String, val role: String)
// Used by GET /admin/users and POST /admin/users
```

---

### ApplicationConfig Service Pattern

```kotlin
// config/ApplicationConfig.kt
data class ApplicationConfig(val registrationEnabled: Boolean = false)

class ApplicationConfigService(private val repository: ApplicationConfigRepository) {
    private val cache = AtomicReference<ApplicationConfig?>(null)

    suspend fun get(): ApplicationConfig {
        return cache.get() ?: repository.load()
            .also { cache.set(it) }
    }

    suspend fun update(config: ApplicationConfig) {
        repository.save(config)
        cache.set(config)              // invalidate immediately
    }
}
```

**Anti-pattern to avoid:**

```kotlin
// WRONG — do not use ConcurrentMap for single-document config:
private val configMap = ConcurrentHashMap<String, ApplicationConfig>()
```

---

### Frontend AuthContext Pattern

```typescript
// src/lib/auth/AuthContext.tsx
interface AuthState {
  username: string | null
  role: "admin" | "user" | null
  accessToken: string | null
}

interface AuthContextValue extends AuthState {
  setAuth: (state: AuthState) => void
  clearAuth: () => void
}

export const AuthContext = createContext<AuthContextValue>(...)

// Always consume via hook — never useContext(AuthContext) directly in components:
export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
```

**Rules:**

- Components always call `useAuth()` — never `useContext(AuthContext)` directly
- `AuthProvider` wraps `ApolloWrapper` in `layout.tsx` — no exceptions
- `ApolloWrapper.tsx` reads `useAuth().accessToken` for the SetContextLink

---

### Apollo 401 Retry Pattern

```typescript
// In ApolloWrapper.tsx authErrorLink — enhanced:
// On 401 network error:
//   1. Set operation.getContext().retried = true to prevent loops
//   2. Call POST /api/auth/refresh
//   3. On success: call setAuth({ ...existing, accessToken: newToken }), retry once
//   4. On failure: call clearAuth(), router.push('/auth?expired=1')
// IMPORTANT: check operation.getContext().retried before retrying
```

**Rules:**

- Retry the original request **exactly once** after successful token refresh
- Use `operation.getContext().retried` flag to prevent infinite retry loops
- On refresh failure: clear auth state and redirect — do not retry again
- The `?expired=1` query param is the only mechanism for the session expiry Alert

---

### Enforcement Guidelines

**All AI Agents MUST:**

- Use `call.receive<T>()` (Jackson) for REST request bodies — never `@Serializable` on DTOs
- Wrap all bcrypt operations in `withContext(Dispatchers.IO)`
- Return `ErrorResponse(error = "...")` JSON for all REST errors — never plain text
- Check admin env-var credentials before DB lookup in the login flow
- Use the exact `LoginResponse` / `RefreshResponse` / `UserResponse` DTO shapes above
- Consume auth state via `useAuth()` hook — never `useContext(AuthContext)` directly
- Set a retry-once flag in Apollo 401 handling to prevent infinite loops

**Anti-patterns to flag in review:**

- `ConcurrentHashMap` or `ConcurrentMap` used for ApplicationConfig
- bcrypt called without `withContext(Dispatchers.IO)`
- Second Apollo client created anywhere
- `localStorage` used for token storage in any new code
- `@Serializable` annotation on HTTP request/response DTOs

## Project Structure & Boundaries

### Backend — Feature-Based Package Organization

Package root: `bp_back/src/main/kotlin/com/bagplease/`

**Design principle:** Entity slices own domain concerns; feature packages own HTTP, token, and
session concerns. Route `configure*()` functions live in their feature package and are wired
from `plugins/Routing.kt`.

```
src/main/kotlin/com/bagplease/
├── Application.kt
├── entity/
│   ├── item/                          (existing — unchanged)
│   ├── category/                      (existing — unchanged)
│   └── user/
│       ├── User.kt                    domain model
│       ├── UserStorage.kt             ConcurrentMap + lazy sync
│       ├── UserService.kt             register, findByUsername, verifyPassword, changePassword
│       └── mongo/
│           ├── MongoUser.kt           @Serializable BSON model
│           ├── MongoUserMapper.kt     object singleton mapper
│           └── UserRepository.kt     MongoDB coroutine repository
├── features/
│   ├── auth/
│   │   ├── dto/
│   │   │   ├── LoginRequest.kt
│   │   │   ├── LoginResponse.kt
│   │   │   ├── RegisterRequest.kt
│   │   │   ├── RefreshResponse.kt
│   │   │   └── ErrorResponse.kt
│   │   ├── AuthService.kt             token issuance, refresh, logout (calls UserService)
│   │   ├── AuthRoutes.kt              configureAuthRoutes() — /auth/* handlers
│   │   ├── RefreshToken.kt            @Serializable BSON model only (no domain layer)
│   │   └── RefreshTokenRepository.kt  MongoDB repository; TTL index on expiresAt
│   └── admin/
│       ├── dto/
│       │   ├── CreateUserRequest.kt
│       │   ├── ResetPasswordRequest.kt
│       │   ├── UserResponse.kt
│       │   └── UpdateConfigRequest.kt
│       └── AdminRoutes.kt             configureAdminRoutes() — /admin/* handlers
├── config/
│   ├── ApplicationConfig.kt           domain data class
│   ├── ApplicationConfigService.kt    AtomicReference cache; lazy load; invalidate on write
│   └── mongo/
│       ├── MongoApplicationConfig.kt  @Serializable BSON model
│       └── ApplicationConfigRepository.kt
├── plugins/
│   ├── Cors.kt                        (existing — unchanged)
│   ├── GQL.kt                         (MODIFIED — activate Principal in context factory)
│   ├── Monitoring.kt                  (existing — unchanged)
│   ├── Routing.kt                     (MODIFIED — call configureAuthRoutes + configureAdminRoutes)
│   ├── Security.kt                    (MODIFIED — multi-user JWT + role claim)
│   └── RateLimiting.kt                [NEW] configureRateLimiting()
└── mongo/
    └── MongoConnection.kt             (existing — unchanged)
```

**Configuration changes:**

```
src/main/resources/application.yaml   [MODIFIED] new: jwt.accessExpiryMinutes,
                                                       jwt.refreshExpiryDays,
                                                       rateLimit.attempts,
                                                       rateLimit.windowSeconds
gradle/libs.versions.toml             [MODIFIED] add: bcrypt (at.favre.lib),
                                                       ktor-server-rate-limit (verify 3.4.3)
```

**Test files:**

```
src/test/resources/application.yaml   [NEW] static JWT config — replaces setUpJwt() tech debt
src/test/kotlin/com/bagplease/
├── (existing tests — unchanged)
├── features/
│   ├── auth/
│   │   ├── UserRegistrationTest.kt    Story 1.1 ACs
│   │   └── LoginTokenTest.kt          Story 1.2 ACs
│   └── admin/
│       ├── AdminUserManagementTest.kt Stories 2.2 ACs
│       └── ApplicationConfigTest.kt   Story 2.1 ACs
└── TestContainers.kt                  [MODIFIED] remove setUpJwt() after test yaml is in place
```

---

### Frontend — New Files (`bp_front/src/`)

```
src/
├── lib/
│   ├── item/Queries.tsx              (existing — unchanged)
│   ├── category/Queries.tsx          (existing — unchanged)
│   ├── auth/
│   │   ├── AuthContext.tsx           [NEW] AuthProvider, AuthContext, useAuth() hook
│   │   └── authApi.ts                [NEW] plain fetch() calls for all auth REST endpoints
│   └── theme.ts                      [NEW] MUI v9 dark theme (UX-DR1)
├── app/
│   ├── layout.tsx                    [MODIFIED] AuthProvider + ThemeProvider wrapping
│   ├── AppHeader.tsx                 [MODIFIED] UserChip; admin nav link (UX-DR9)
│   ├── Navigation.tsx                [MODIFIED] admin-only "User Management" MenuItem (UX-DR10)
│   ├── ApolloWrapper.tsx             [MODIFIED] SetContextLink reads from AuthContext;
│   │                                            enhanced 401 retry with refresh
│   ├── auth/
│   │   ├── page.tsx                  [MODIFIED] edge-to-edge; session expiry Alert;
│   │   │                                        conditional Register link (UX-DR2)
│   │   └── register/
│   │       └── page.tsx              [NEW] RegisterPage (UX-DR3)
│   ├── store/
│   │   ├── page.tsx                  [MODIFIED] render WelcomeBanner
│   │   └── WelcomeBanner.tsx         [NEW] one-time welcome banner (UX-DR5)
│   ├── admin/
│   │   ├── users/
│   │   │   └── page.tsx              [NEW] AdminUsersPage (UX-DR6)
│   │   └── ConfirmDialog.tsx         [NEW] reusable confirmation dialog (UX-DR7)
│   └── account/
│       └── password/
│           └── page.tsx              [NEW] ChangePasswordPage (UX-DR8)
└── __generated__/
    └── graphql.ts                    (no change — auth is REST, no schema regeneration)
```

---

### Requirements → File Mapping

| Story                             | Backend Files                                                                                         | Frontend Files                                                                                               |
|-----------------------------------|-------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| 1.1 User Entity & Registration    | `entity/user/*`, `features/auth/AuthRoutes.kt`, `features/auth/dto/*`, `plugins/RateLimiting.kt`      | —                                                                                                            |
| 1.2 Login, Tokens & Security      | `features/auth/AuthService.kt`, `features/auth/RefreshToken*.kt`, `plugins/Security.kt`               | —                                                                                                            |
| 1.3 Frontend Theme & Auth Infra   | —                                                                                                     | `lib/theme.ts`, `lib/auth/AuthContext.tsx`, `lib/auth/authApi.ts`, `app/layout.tsx`, `app/ApolloWrapper.tsx` |
| 1.4 Login & Registration UI       | —                                                                                                     | `app/auth/page.tsx`, `app/auth/register/page.tsx`                                                            |
| 1.5 Identity & Account UI         | —                                                                                                     | `app/AppHeader.tsx`, `app/store/WelcomeBanner.tsx`, `app/account/password/page.tsx`, `app/Navigation.tsx`    |
| 2.1 ApplicationConfig Backend     | `config/*`, `features/admin/AdminRoutes.kt` (GET/PUT /admin/config)                                   | —                                                                                                            |
| 2.2 Admin User Management Backend | `entity/user/UserService.kt` (admin methods), `features/admin/AdminRoutes.kt`, `features/admin/dto/*` | —                                                                                                            |
| 2.3 Admin User Management UI      | —                                                                                                     | `app/admin/users/page.tsx`, `app/admin/ConfirmDialog.tsx`                                                    |
| 2.4 Registration Toggle UI        | —                                                                                                     | `app/auth/page.tsx` (conditional Register link), `app/admin/users/page.tsx` (Switch)                         |

---

### Architectural Boundaries

**Backend:**

- `features/auth/AuthService.kt` and `features/admin/AdminRoutes.kt` depend on `entity/user/UserService.kt` and
  `config/ApplicationConfigService.kt` — never on repositories directly
- Route handlers in `features/*/` are thin: receive DTO, call service, fold Either, respond
- `plugins/Routing.kt` is the single wiring point: calls `configureAuthRoutes()` and `configureAdminRoutes()` with
  injected dependencies
- `plugins/GQL.kt` receives `Principal` from the context factory — existing GQL operations pass it through without
  acting on it

**Frontend:**

- `lib/auth/AuthContext.tsx` owns auth state — all components consume via `useAuth()`
- `lib/auth/authApi.ts` owns all HTTP calls to auth REST endpoints — no bare `fetch()` in components or pages
- `ApolloWrapper.tsx` reads token from `AuthContext` via `useAuth()` — does not own auth state
- Route guards live as client components in `app/layout.tsx` — not in `middleware.ts`

**Data flow (login):**

```
POST /api/auth/login
  → features/auth/AuthRoutes.kt (receive LoginRequest via Jackson)
  → features/auth/AuthService.kt (admin env-var check → UserService.verifyPassword → issue tokens)
  → features/auth/RefreshTokenRepository.kt (save refresh token to MongoDB)
  → response: LoginResponse (access token in body) + Set-Cookie (refresh token httpOnly)
  → lib/auth/authApi.ts (fetch call)
  → lib/auth/AuthContext.tsx setAuth({ username, role, accessToken })
  → ApolloWrapper SetContextLink picks up accessToken on next GQL request
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices are mutually compatible. Kotlin/JDK 25 + Ktor 3.4.3 + at.favre.lib:bcrypt
(pure JVM, no native deps) + Arrow Either + MongoDB coroutine driver 5.5.1 have no version conflicts.
Frontend: Next.js 16 + React 19 + MUI v9 + Apollo Client 4 are already running together in
production — no integration risk. AtomicReference and secondary Map indexes are standard JDK,
compatible with Ktor coroutines without synchronization issues.

**Pattern Consistency:**
Implementation patterns are internally consistent. The REST handler pattern (thin route → Arrow
fold → service) follows the existing GQL handler style. Feature package organization is consistent
within itself. Frontend `useAuth()` hook pattern matches the existing Apollo `useQuery` consumption
pattern. bcrypt IO dispatcher pattern is the standard Ktor coroutines approach.

**Structure Alignment:**
Feature packages support the architectural boundaries: `features/auth/` and `features/admin/` own
HTTP and session concerns; `entity/user/` owns domain concerns; `plugins/` is infrastructure-only.
Route configure functions live in feature packages and are wired from `plugins/Routing.kt` —
consistent with the existing `configureGql()`, `configureSecurity()` wiring pattern.

---

### Requirements Coverage Validation ✅

**All 33 Functional Requirements covered:**
Every FR maps to a specific file in the project structure (see Requirements → File Mapping table).
No FR is left architecturally unaddressed. Cross-feature FRs (FR24 RBAC, FR28 Principal) are
covered by `plugins/Security.kt` + `GQL.kt` and consumed by both feature packages.

**All 16 Non-Functional Requirements covered:**

- NFR1 bcrypt-12: `withContext(Dispatchers.IO)` pattern + at.favre.lib:bcrypt
- NFR2 TTL index: `RefreshTokenRepository.init {}` (see Gap 3 resolution)
- NFR3 httpOnly cookie: exact cookie attributes specified in patterns section
- NFR4 token expiry: `AuthService` token issuance with configured values
- NFR6 rate limiting: `plugins/RateLimiting.kt` per-IP
- NFR7 no credentials in logs: Arrow Either + no log statements on auth failure paths
- NFR12 ApplicationConfig cached: `AtomicReference` invalidated on write

---

### Gap Analysis Results

Four important gaps identified and resolved during validation:

**Gap 1 — UserStorage.findByUsername (RESOLVED)**
The primary `Map<UUID, User>` cannot support O(1) username lookup required for login.

Resolution: `UserStorage` maintains a secondary `Map<String, UUID>` (username → UUID) populated
during lazy sync alongside the primary map. Both maps are updated atomically on every write.

```kotlin
// In UserStorage:
private val byId = ConcurrentHashMap<UUID, User>()
private val byUsername = ConcurrentHashMap<String, UUID>()

fun findByUsername(username: String): User? =
    byUsername[username]?.let { byId[it] }

// sync() populates both maps from MongoDB on first access
```

**Gap 2 — RefreshToken `_id` (RESOLVED)**
Refresh token lookup must be O(1) — the cookie value must be the document key.

Resolution: The UUID token string IS the MongoDB `_id`. The cookie stores the same UUID.
`RefreshTokenRepository` uses `findById(tokenValue)` and `deleteById(tokenValue)`.

```kotlin
@Serializable
data class RefreshToken(
    @SerialName("_id") val token: String,   // UUID string — IS the _id
    val username: String,
    val expiresAt: Instant
)
```

**Gap 3 — TTL index creation (RESOLVED)**
MongoDB does not auto-create indexes; `RefreshTokenRepository` must create the TTL index
at startup — not per-operation.

Resolution: `RefreshTokenRepository` creates the index in its `init {}` block:

```kotlin
init {
    runBlocking {
        collection.createIndex(
            Indexes.ascending("expiresAt"),
            IndexOptions().expireAfter(0, TimeUnit.SECONDS)
        )
    }
}
```

**Gap 4 — ApplicationConfig document identity (RESOLVED)**
`findOne()` with no filter fails on an empty collection (first startup before default is written).

Resolution: Use a fixed UUID constant as `_id`. On startup, `ApplicationConfigService` upserts
the default config using this constant if no document exists.

```kotlin
// In ApplicationConfigRepository:
private val CONFIG_ID = UUID.fromString("00000000-0000-0000-0000-000000000001")

suspend fun load(): ApplicationConfig =
    collection.findOneById(CONFIG_ID.toString()) ?: ApplicationConfig().also { save(it) }
```

---

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

---

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level:** High — brownfield project with a well-established codebase; all new
patterns are extensions of existing ones; no unproven technology choices; all 16 checklist
items confirmed.

**Key Strengths:**

- All decisions are constrained by the existing working codebase — no greenfield uncertainty
- Feature-based package organization is clean and separates domain from HTTP/session concerns
- Implementation patterns include executable code examples for the highest-risk patterns
  (bcrypt IO dispatcher, admin credential check ordering, cookie attributes, Apollo 401 retry)
- Four implementation gaps caught and resolved before code is written

**Areas for Future Enhancement (Post-MVP):**

- Refresh token rotation (Phase 2 security hardening)
- WebSocket subscription authentication (existing tech debt)
- Next.js middleware auth guard if SSR requirements emerge
- User status (active/suspended) — Phase 2 domain extension

---

### Implementation Handoff

**First Implementation Priority:**
Story 1.1 — User Entity & Registration Backend. This story:

1. Validates the bcrypt library choice (`at.favre.lib:bcrypt` — add to `libs.versions.toml`)
2. Validates the rate-limit plugin availability for Ktor 3.4.3 (or triggers fallback)
3. Establishes `entity/user/` and `features/auth/` as the first feature packages
4. Creates `src/test/resources/application.yaml` to resolve the `setUpJwt()` tech debt

**AI Agent Guidelines:**

- Read this document before implementing any story in this feature
- Follow all patterns exactly — especially bcrypt IO dispatcher, admin credential check ordering,
  cookie attributes, and Apollo 401 retry flag
- Use `useAuth()` hook exclusively — never `useContext(AuthContext)` directly in components
- Auth operations are REST — do not add GraphQL operations; do not run `npm run generate`
- All new Ktor route configuration functions follow `configure*()` convention and are registered
  from `plugins/Routing.kt`
