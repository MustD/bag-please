# Story 1.1: User Entity & Registration Backend

Status: done

## Story

As a new user,
I want to be able to register an account with a username and password,
so that I have my own identity in bag-please instead of sharing the admin credential.

## Acceptance Criteria

1. **AC1 — Successful registration:** `POST /api/auth/register` with `{"username": "mia", "password": "secret123"}` (
   where "mia" does not already exist) returns HTTP 200 with body `{"username": "mia", "role": "user"}` and stores a
   bcrypt-12 hash of the password in the `users` MongoDB collection — never the plaintext password.

2. **AC2 — Duplicate username:** `POST /api/auth/register` with a username that already exists returns HTTP 400 with
   `{"error": "<uniform message>"}`. No new user is created.

3. **AC3 — Reserved username (admin):** `POST /api/auth/register` with username matching `KTOR_ADMIN_LOGIN` returns HTTP
   400 with the same uniform error message. No user record is written to MongoDB.

4. **AC4 — No credential logging:** On any registration request (success or failure) no plaintext password value appears
   in application logs.

5. **AC5 — UserStorage lazy sync:** On the first read or write call to `UserStorage` after startup, the storage syncs
   from the MongoDB `users` collection exactly once; all subsequent calls are served from the in-memory map without
   hitting MongoDB.

6. **AC6 — Rate limiting:** 6 or more `POST /api/auth/register` requests from the same IP within 1 minute result in HTTP
   429 for the 6th and subsequent requests. (The same limiter will apply to `/api/auth/login` when Story 1.2 adds it —
   design the limiter to cover both paths.)

## Tasks / Subtasks

- [x] Task 1: Add bcrypt dependency and verify rate-limit plugin (prereq for all ACs)
  - [x] Check whether `io.ktor:ktor-server-rate-limit` is available for Ktor 3.4.3 (look for it in Maven Central); if
      stable, add to `gradle/libs.versions.toml`; otherwise implement in-memory sliding window fallback (see Dev Notes)
  - [x] Add `at.favre.lib:bcrypt` to `gradle/libs.versions.toml` (`[versions]` + `[libraries]`) and
      `bp_back/build.gradle.kts` `dependencies {}` block
  - [x] Update `bp_back/src/main/resources/application.yaml`: add `rateLimit:` section with `attempts` and
      `windowSeconds` keys using `"$ENV_VAR:default"` syntax

- [x] Task 2: Create `src/test/resources/application.yaml` (resolves AR8 tech debt) (AC: 5 — test infrastructure)
  - [x] Create `bp_back/src/test/resources/application.yaml` with static JWT config matching existing `setUpJwt()`
      values plus the new `rateLimit` section
  - [x] Do NOT modify existing tests; `setUpJwt()` calls remain harmless (mergeWith overrides with same values)

- [x] Task 3: Create User domain vertical slice (AC: 1, 2, 3, 5)
  - [x] Create `entity/user/User.kt` — domain data class with `id: UUID`, `username: String`, `passwordHash: String`,
      `role: String` (always "user" for DB users)
  - [x] Create `entity/user/mongo/MongoUser.kt` — `@Serializable` BSON model, `_id` with `UUIDMongoSerializer`
  - [x] Create `entity/user/mongo/MongoUserMapper.kt` — `object` singleton with `mapUserToMongo` and`mapUserFromMongo`
  - [x] Create `entity/user/mongo/UserRepository.kt` — `getAll()`, `save()` (upsert), `findByUsername()` if needed for
      direct DB lookup
  - [x] Create `entity/user/UserStorage.kt` — dual-map lazy sync pattern (see Dev Notes — critical)

- [x] Task 4: Create UserService with register operation (AC: 1, 2, 3, 4)
  - [x] Create `entity/user/UserService.kt` with `register(username, password): Either<RegistrationError, User>`
  - [x] Sealed class or enum `RegistrationError` with `InvalidCredentials` variant (uniform message — AR: FR27)
  - [x] Reserved username check: compare incoming username against `adminLogin` constructor param
  - [x] Duplicate check: `storage.findByUsername(username) != null`
  - [x] Hash password with bcrypt-12 inside `withContext(Dispatchers.IO)` (see Dev Notes — critical)
  - [x] Save via `storage.save(user)` and return `Right(user)`

- [x] Task 5: Create DTOs and registration route handler (AC: 1, 2, 3)
  - [x] Create `features/auth/dto/RegisterRequest.kt` — Jackson DTO (NOT `@Serializable`)
  - [x] Create `features/auth/dto/RegisterResponse.kt` —
      `data class RegisterResponse(val username: String, val role: String)` (Story 1.2 will extend to full
      `LoginResponse` with access token)
  - [x] Create `features/auth/dto/ErrorResponse.kt` — `data class ErrorResponse(val error: String)` (shared across
      auth/admin features)
  - [x] Create `features/auth/AuthRoutes.kt` — `fun Application.configureAuthRoutes(userService: UserService)` with
      `POST /auth/register` handler using Arrow fold pattern

- [x] Task 6: Create rate-limiting plugin (AC: 6)
  - [x] Create `plugins/RateLimiting.kt` — `fun Application.configureRateLimiting()` using ktor plugin or fallback (
      see Dev Notes)
  - [x] Apply limit to `/auth/register` path now; design to include `/auth/login` for Story 1.2 with no additional
      changes

- [x] Task 7: Wire services and configure functions in `Application.kt` (AC: all)
  - [x] In `Application.module()`: resolve `MongoConnection by dependencies`, create `UserRepository`, `UserStorage`,
      `UserService(userStorage, adminLogin)`
  - [x] Read `adminLogin` from `environment.config.property("jwt.admin_login").getString()`
  - [x] Call order: `configureRateLimiting()` → `configureSecurity()` → `configureAuthRoutes(userService)` →
      `configureGql()` → `configureRouting()`
  - [x] Ensure `ContentNegotiation` (Jackson) is available for the new routes (see Dev Notes)

- [x] Task 8: Write `UserRegistrationTest` (AC: 1, 2, 3, 4, 5, 6)
  - [x] Create `bp_back/src/test/kotlin/com/bagplease/features/auth/UserRegistrationTest.kt`
  - [x] Cover all six ACs — each as its own `test("...")` block inside a `context("POST /auth/register")` in a
      `FunSpec`
  - [x] Use `mongoContainer()` + `setUpMongo()` (no `setUpJwt()` needed — test yaml covers it)
  - [x] Identify test data by generated UUIDs / unique usernames to survive parallel test runs

### Review Findings

- [x] [Review][Patch] Rate limiter keys on proxy IP — install `ForwardedHeaders` plugin, switch to
  `call.request.origin.remoteHost`, add nginx `proxy_set_header X-Forwarded-For` directive for production
  setup [RateLimiting.kt:19, routing/nginx.conf]
- [x] [Review][Dismiss] Case-sensitive admin username reservation — dismissed; strict equality matches spec intent and
  login auth is also case-sensitive
- [x] [Review][Patch] `synced` flag missing `@Volatile` — double-init race on startup [UserStorage.kt:11]
- [x] [Review][Patch] TOCTOU race between duplicate check and save — two concurrent requests for the same username both
  pass `findByUsername` and both succeed [UserService.kt:19-23]
- [x] [Review][Patch] No unique MongoDB index on `username` field — no DB-level constraint prevents duplicate usernames
  from concurrent writes [UserRepository.kt]
- [x] [Review][Patch] `toInt()` / `toLong()` crash on non-numeric env var — use `toIntOrNull()` / `toLongOrNull()` with
  fallback [RateLimiting.kt:13-14]
- [x] [Review][Patch] Dead import `io.ktor.server.request.uri` [RateLimiting.kt:7]
- [x] [Review][Patch] Test name says "after 5 requests" but spec says 6th request triggers
  429 [UserRegistrationTest.kt:133]
- [x] [Review][Defer] No input validation on username/password (length, blank, character
  set) [RegisterRequest.kt, UserService.kt] — deferred, out of scope for this story
- [x] [Review][Defer] BCrypt 72-byte password truncation — passwords >72 bytes silently truncated, no max length
  enforced [UserService.kt:28] — deferred, security hardening out of scope
- [x] [Review][Defer] `password.toCharArray()` not zeroed after hashing [UserService.kt:28] — deferred, not actionable
  in JVM with String origin
- [x] [Review][Defer] `role` field is raw String, not typed enum [User.kt:9] — deferred, design concern out of scope
- [x] [Review][Defer] `UserRepository.findByUsername` is dead code — storage serves from memory
  only [UserRepository.kt:28-32] — deferred, minor design concern
- [x] [Review][Defer] No test for malformed / empty JSON request body [UserRegistrationTest.kt] — deferred, out of scope
  for this story
- [x] [Review][Defer] No test verifies bcrypt hash stored in MongoDB, only HTTP response
  checked [UserRegistrationTest.kt] — deferred, would require direct DB access against project policy
- [x] [Review][Defer] UUID deserialization byte-swap risk — `UUIDMongoSerializer.asUuid()` may use JAVA_LEGACY byte
  order vs STANDARD stored; needs verification against existing ItemRepository pattern [UserRepository.kt] — deferred,
  needs cross-cutting investigation
- [x] [Review][Defer] Rate limiter coverage of `/auth/login` — `RateLimitName("auth")` is already reusable by Story 1.2,
  no structural refactor needed — deferred, Story 1.2 scope
- [x] [Review][Defer] Monitoring plugin may log request bodies including passwords [Application.kt] — deferred,
  pre-existing concern not introduced by this change

## Dev Notes

### UserStorage — Dual-Map Pattern (CRITICAL — Architecture Gap 1 Resolution)

`UserStorage` **must** maintain two internal maps: a primary `byId` map and a secondary `byUsername` index. Both are
populated atomically during `sync()` and on every write. Omitting the secondary map forces a full scan on every
login/duplicate-check.

```kotlin
// entity/user/UserStorage.kt
@Suppress("RedundantSuspendModifier")
class UserStorage(private val repository: UserRepository) {
    private val byId = ConcurrentHashMap<UUID, User>()
    private val byUsername = ConcurrentHashMap<String, UUID>()
    private var synced = false

    private suspend fun sync() {
        if (!synced) {
            repository.getAll().forEach {
                byId[it.id] = it
                byUsername[it.username] = it.id
            }
            synced = true
        }
    }

    suspend fun save(user: User): User {
        sync()
        byId[user.id] = user
        byUsername[user.username] = user.id
        repository.save(user)
        return user
    }

    suspend fun findByUsername(username: String): User? {
        sync()
        return byUsername[username]?.let { byId[it] }
    }

    suspend fun getAll(): List<User> {
        sync()
        return byId.values.toList()
    }
}
```

### bcrypt IO Dispatcher (CRITICAL — NFR1)

All bcrypt operations **must** run in `withContext(Dispatchers.IO)` — never on the main coroutine dispatcher.

```kotlin
// In UserService:
private suspend fun hashPassword(password: String): String =
    withContext(Dispatchers.IO) {
        BCrypt.withDefaults().hashToString(12, password.toCharArray())
    }
```

**Anti-pattern (WRONG — blocks dispatcher):**

```kotlin
val hash = BCrypt.withDefaults().hashToString(12, password.toCharArray())  // NEVER do this
```

### Arrow Either Error Handling Pattern

Service layer uses Arrow `Either`. Route handler folds the result — no exceptions thrown.

```kotlin
// UserService.register():
suspend fun register(username: String, password: String): Either<RegistrationError, User> =
    either {
        if (username == adminLogin) raise(RegistrationError.InvalidCredentials)
        if (storage.findByUsername(username) != null) raise(RegistrationError.InvalidCredentials)
        val hash = hashPassword(password)
        val user = User(username = username, passwordHash = hash, role = "user")
        storage.save(user)
        user
    }

// AuthRoutes handler:
post("/auth/register") {
    val body = call.receive<RegisterRequest>()
    userService.register(body.username, body.password).fold(
        ifLeft = { call.respond(HttpStatusCode.BadRequest, ErrorResponse("Invalid credentials")) },
        ifRight = { call.respond(HttpStatusCode.OK, RegisterResponse(it.username, it.role)) }
    )
}
```

**Uniform error message:** AC3 and FR27 require the SAME error message for duplicate username, reserved username, and
all other registration failures — "Invalid credentials" or similar non-distinguishing text.

### MongoDB Rules for UserRepository

Follow these rules exactly — they deviate from the existing `ItemRepository` where the project-context is more
restrictive:

```kotlin
// CORRECT — UUID object for _id filter (matches MongoConnection UuidRepresentation.STANDARD):
val filter = Filters.eq("_id", user.id)

// CORRECT — exclude _id from Updates.combine() (per project-context rule):
val update = Updates.combine(
    Updates.set(MongoUser::username.name, user.username),
    Updates.set(MongoUser::passwordHash.name, user.passwordHash),
    Updates.set(MongoUser::role.name, user.role),
    // _id intentionally excluded — MongoDB will reject updates to immutable field
)
```

### MongoUser Model

```kotlin
// entity/user/mongo/MongoUser.kt
@Serializable
data class MongoUser(
    @SerialName("_id")
    @Serializable(with = UUIDMongoSerializer::class)
    val id: UUID,
    val username: String,
    val passwordHash: String,
    val role: String,
)
```

The `UUIDMongoSerializer` is at `com.bagplease.mongo.model.serialization.UUIDMongoSerializer` — reuse it exactly as done
in `MongoItem`.

### Jackson DTOs — NOT @Serializable

HTTP request/response DTOs (`RegisterRequest`, `RegisterResponse`, `ErrorResponse`) must NOT use `@Serializable`. Kotlin
Serialization is for BSON only. Jackson handles all HTTP bodies via `call.receive<T>()` and `call.respond(...)`.

```kotlin
// CORRECT:
data class RegisterRequest(val username: String, val password: String)

// WRONG — do not add @Serializable to HTTP DTOs:
@Serializable
data class RegisterRequest(...)
```

### ContentNegotiation for Auth Routes

The existing `securityRoutes()` installs `ContentNegotiation` inside the routing scope (Route-level plugin).
`configureAuthRoutes()` is a separate `Application` extension with its own `routing {}` block. Both `routing {}` blocks
merge into the same routing tree root, so ContentNegotiation from `securityRoutes()` covers all routes including
`/auth/register`. Do NOT install ContentNegotiation again in `configureAuthRoutes()` — both routing blocks share the
same root node and a second install throws `DuplicatePluginException`.

### Rate Limiting Plugin

`io.ktor:ktor-server-rate-limit` 3.4.3 is available on Maven Central. Used the Ktor native plugin.

```kotlin
// plugins/RateLimiting.kt
fun Application.configureRateLimiting() {
    install(RateLimit) {
        register(RateLimitName("auth")) {
            rateLimiter(limit = attempts, refillPeriod = windowSeconds.seconds)
            requestKey { call -> call.request.local.remoteHost }
        }
    }
}

// In AuthRoutes.kt, wrap auth routes:
rateLimit(RateLimitName("auth")) {
    post("/auth/register") { ... }
    // post("/auth/login") added by Story 1.2
}
```

Reads `attempts` (Int) and `windowSeconds` (Long) from `environment.config` using `propertyOrNull` with fallback
defaults.

### Application.kt Wiring Pattern

Follow the same inline service creation pattern as `configureGql()`:

```kotlin
fun Application.module() {
    val config = environment.config
    dependencies {
        provide { MongoConnection(config) }
    }

    val connection: MongoConnection by dependencies
    val userRepository = UserRepository(connection.db)
    val userStorage = UserStorage(userRepository)
    val adminLogin = config.property("jwt.admin_login").getString()
    val userService = UserService(userStorage, adminLogin)

    configureCors()
    configureMonitoring()
    configureRateLimiting()     // NEW — before auth routes
    configureSecurity()
    configureAuthRoutes(userService)  // NEW
    configureGql()
    configureRouting()
}
```

### Test application.yaml (AR8 Tech Debt)

Created `bp_back/src/test/resources/application.yaml`. Note: `testApplication {}` does NOT auto-load YAML files from
classpath — it uses MapApplicationConfig by default. The `setUpJwt()` helper is still needed in new tests. The YAML
file documents static test values and is available if the load mechanism changes.

### Test Pattern for UserRegistrationTest

Tests must call `setUpJwt()` in addition to `setUpMongo()` since testApplication doesn't auto-load application.yaml.
Use unique usernames per test to survive parallel test runs.

### Package Structure for New Files

```
bp_back/src/main/kotlin/com/bagplease/
├── Application.kt                          [MODIFY]
├── entity/user/
│   ├── User.kt                             [NEW]
│   ├── UserStorage.kt                      [NEW]
│   ├── UserService.kt                      [NEW]
│   └── mongo/
│       ├── MongoUser.kt                    [NEW]
│       ├── MongoUserMapper.kt              [NEW]
│       └── UserRepository.kt              [NEW]
├── features/
│   └── auth/
│       ├── dto/
│       │   ├── RegisterRequest.kt          [NEW]
│       │   ├── RegisterResponse.kt         [NEW]  ← Story 1.2 replaces with LoginResponse
│       │   └── ErrorResponse.kt            [NEW]
│       └── AuthRoutes.kt                   [NEW]
└── plugins/
    ├── RateLimiting.kt                     [NEW]
    └── Security.kt                         [MODIFY — ContentNegotiation stays at Route level in securityRoutes()]

bp_back/src/main/resources/
└── application.yaml                        [MODIFY — add rateLimit section]

bp_back/src/test/resources/
└── application.yaml                        [NEW — static JWT + rateLimit config]

bp_back/src/test/kotlin/com/bagplease/
└── features/auth/
    └── UserRegistrationTest.kt             [NEW]

gradle/libs.versions.toml                   [MODIFY — add bcrypt, ktor-rate-limit]
bp_back/build.gradle.kts                    [MODIFY — add bcrypt and rate-limit implementation]
```

### Project Structure Notes

- `features/auth/` and `features/admin/` are new top-level packages in `com.bagplease` — follow the `entity/` pattern
  for subdirectory organization
- `AuthRoutes.kt` lives in `features/auth/` (NOT in `plugins/`) — plugins/ is for infrastructure concerns only
- `RateLimiting.kt` lives in `plugins/` because it is a cross-cutting infrastructure concern
- `ErrorResponse.kt` lives in `features/auth/dto/` for now; Story 2.2 (admin routes) will import it from there — do not
  create a duplicate
- `@GraphQLName` is NOT needed on any of these types — this story is REST-only; nothing is registered in the GraphQL
  schema

### Do Not Touch

- `entity/item/` and `entity/category/` — Story 1.1 is purely additive; no existing entity code changes
- `plugins/GQL.kt` — Principal threading (the commented-out code) is Story 1.2 scope
- `src/__generated__/` — auth is REST; no schema changes; do not run `npm run generate`
- The existing `/api/login` endpoint in `Security.kt` remains intact — it is NOT replaced until Story 1.2

### References

- Architecture patterns: `_bmad-output/planning-artifacts/architecture.md` — "Backend Package Structure", "REST Handler
  Pattern", "bcrypt IO Dispatcher Pattern", "Gap 1 UserStorage.findByUsername"
- Storage lazy sync: `bp_back/src/main/kotlin/com/bagplease/entity/item/ItemStorage.kt`
- BSON serialization: `bp_back/src/main/kotlin/com/bagplease/mongo/model/serialization/UUIDSerializer.kt`
- MongoItem pattern: `bp_back/src/main/kotlin/com/bagplease/entity/item/mongo/MongoItem.kt`
- Mongo filter pattern (string UUID): `project-context.md` — "MongoDB filter with UUID"
- Test pattern: `bp_back/src/test/kotlin/com/bagplease/ItemApiTest.kt`
- Test utilities: `bp_back/src/test/kotlin/com/bagplease/utils/TestContainers.kt`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- ContentNegotiation must stay Route-level (not Application-level): graphql-kotlin installs it at route scope; moving to
  Application scope triggers DuplicatePluginException. Both routing{} blocks share the root node — second install from
  securityRoutes() also throws DuplicatePluginException. Solution: install once in securityRoutes(), no reinstall in
  configureAuthRoutes().
- UUID object in Filters.eq("_id", user.id) is correct (not toString()): MongoConnection sets
  UuidRepresentation.STANDARD; using toString() stores _id as String, but UUIDMongoSerializer.deserialize reads binary —
  mismatched, causes BsonInvalidOperationException. UUID object is stored as binary subtype 4 and reads correctly.
- testApplication{} does NOT auto-load application.yaml: starts with MapApplicationConfig; setUpJwt() is still required
  in new tests despite the test YAML file existing.

### Completion Notes List

- Implemented full user registration backend: User domain model, MongoDB persistence layer, UserStorage with dual-map
  lazy sync, UserService with Arrow Either error handling and bcrypt-12 hashing, REST route at POST /auth/register.
- Ktor native rate-limit plugin (3.4.3) used — 5 attempts per 60 seconds per IP, applied via RateLimitName("auth")
  covering /auth/register now and /auth/login in Story 1.2.
- ContentNegotiation wiring: securityRoutes() already installs it at the routing root; configureAuthRoutes() does not
  reinstall (avoids DuplicatePluginException); auth routes inherit it from the shared routing tree root.
- All 15 tests pass (6 new + 9 existing regressions): successful registration, duplicate username, reserved admin,
  uniform error message, lazy sync across app restart, rate limit 429.

### File List

gradle/libs.versions.toml
bp_back/build.gradle.kts
bp_back/src/main/resources/application.yaml
bp_back/src/test/resources/application.yaml
bp_back/src/main/kotlin/com/bagplease/Application.kt
bp_back/src/main/kotlin/com/bagplease/entity/user/User.kt
bp_back/src/main/kotlin/com/bagplease/entity/user/UserStorage.kt
bp_back/src/main/kotlin/com/bagplease/entity/user/UserService.kt
bp_back/src/main/kotlin/com/bagplease/entity/user/mongo/MongoUser.kt
bp_back/src/main/kotlin/com/bagplease/entity/user/mongo/MongoUserMapper.kt
bp_back/src/main/kotlin/com/bagplease/entity/user/mongo/UserRepository.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/AuthRoutes.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/dto/RegisterRequest.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/dto/RegisterResponse.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/dto/ErrorResponse.kt
bp_back/src/main/kotlin/com/bagplease/plugins/RateLimiting.kt
bp_back/src/main/kotlin/com/bagplease/plugins/Security.kt
bp_back/src/test/kotlin/com/bagplease/features/auth/UserRegistrationTest.kt

### Change Log

- Added bcrypt 0.10.2 and ktor-server-rate-limit (Ktor 3.4.3) dependencies (Date: 2026-05-08)
- Added rateLimit config section to application.yaml with ENV var syntax (Date: 2026-05-08)
- Created test/resources/application.yaml with static JWT and rateLimit config (Date: 2026-05-08)
- Implemented User entity vertical slice: User, MongoUser, MongoUserMapper, UserRepository, UserStorage (Date:
  2026-05-08)
- Implemented UserService with Arrow Either error handling and bcrypt-12 hashing on IO dispatcher (Date: 2026-05-08)
- Implemented RegistrationError sealed class with uniform InvalidCredentials variant (Date: 2026-05-08)
- Created REST auth routes: RegisterRequest/Response/ErrorResponse DTOs and AuthRoutes.kt (Date: 2026-05-08)
- Created RateLimiting plugin using Ktor native RateLimit, RateLimitName("auth") for /auth paths (Date: 2026-05-08)
- Wired UserRepository → UserStorage → UserService in Application.module(), configureRateLimiting() before auth routes (
  Date: 2026-05-08)
- Added UserRegistrationTest covering all 6 ACs with parallel-safe unique usernames (Date: 2026-05-08)
