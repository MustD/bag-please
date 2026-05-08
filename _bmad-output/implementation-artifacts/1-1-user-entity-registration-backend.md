# Story 1.1: User Entity & Registration Backend

Status: ready-for-dev

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

- [ ] Task 1: Add bcrypt dependency and verify rate-limit plugin (prereq for all ACs)
    - [ ] Check whether `io.ktor:ktor-server-rate-limit` is available for Ktor 3.4.3 (look for it in Maven Central); if
      stable, add to `gradle/libs.versions.toml`; otherwise implement in-memory sliding window fallback (see Dev Notes)
    - [ ] Add `at.favre.lib:bcrypt` to `gradle/libs.versions.toml` (`[versions]` + `[libraries]`) and
      `bp_back/build.gradle.kts` `dependencies {}` block
    - [ ] Update `bp_back/src/main/resources/application.yaml`: add `rateLimit:` section with `attempts` and
      `windowSeconds` keys using `"$ENV_VAR:default"` syntax

- [ ] Task 2: Create `src/test/resources/application.yaml` (resolves AR8 tech debt) (AC: 5 — test infrastructure)
    - [ ] Create `bp_back/src/test/resources/application.yaml` with static JWT config matching existing `setUpJwt()`
      values plus the new `rateLimit` section
    - [ ] Do NOT modify existing tests; `setUpJwt()` calls remain harmless (mergeWith overrides with same values)

- [ ] Task 3: Create User domain vertical slice (AC: 1, 2, 3, 5)
    - [ ] Create `entity/user/User.kt` — domain data class with `id: UUID`, `username: String`, `passwordHash: String`,
      `role: String` (always "user" for DB users)
    - [ ] Create `entity/user/mongo/MongoUser.kt` — `@Serializable` BSON model, `_id` with `UUIDMongoSerializer`
    - [ ] Create `entity/user/mongo/MongoUserMapper.kt` — `object` singleton with `mapUserToMongo` and`mapUserFromMongo`
    - [ ] Create `entity/user/mongo/UserRepository.kt` — `getAll()`, `save()` (upsert), `findByUsername()` if needed for
      direct DB lookup
    - [ ] Create `entity/user/UserStorage.kt` — dual-map lazy sync pattern (see Dev Notes — critical)

- [ ] Task 4: Create UserService with register operation (AC: 1, 2, 3, 4)
    - [ ] Create `entity/user/UserService.kt` with `register(username, password): Either<RegistrationError, User>`
    - [ ] Sealed class or enum `RegistrationError` with `InvalidCredentials` variant (uniform message — AR: FR27)
    - [ ] Reserved username check: compare incoming username against `adminLogin` constructor param
    - [ ] Duplicate check: `storage.findByUsername(username) != null`
    - [ ] Hash password with bcrypt-12 inside `withContext(Dispatchers.IO)` (see Dev Notes — critical)
    - [ ] Save via `storage.save(user)` and return `Right(user)`

- [ ] Task 5: Create DTOs and registration route handler (AC: 1, 2, 3)
    - [ ] Create `features/auth/dto/RegisterRequest.kt` — Jackson DTO (NOT `@Serializable`)
    - [ ] Create `features/auth/dto/RegisterResponse.kt` —
      `data class RegisterResponse(val username: String, val role: String)` (Story 1.2 will extend to full
      `LoginResponse` with access token)
    - [ ] Create `features/auth/dto/ErrorResponse.kt` — `data class ErrorResponse(val error: String)` (shared across
      auth/admin features)
    - [ ] Create `features/auth/AuthRoutes.kt` — `fun Application.configureAuthRoutes(userService: UserService)` with
      `POST /auth/register` handler using Arrow fold pattern

- [ ] Task 6: Create rate-limiting plugin (AC: 6)
    - [ ] Create `plugins/RateLimiting.kt` — `fun Application.configureRateLimiting()` using ktor plugin or fallback (
      see Dev Notes)
    - [ ] Apply limit to `/auth/register` path now; design to include `/auth/login` for Story 1.2 with no additional
      changes

- [ ] Task 7: Wire services and configure functions in `Application.kt` (AC: all)
    - [ ] In `Application.module()`: resolve `MongoConnection by dependencies`, create `UserRepository`, `UserStorage`,
      `UserService(userStorage, adminLogin)`
    - [ ] Read `adminLogin` from `environment.config.property("jwt.admin_login").getString()`
    - [ ] Call order: `configureRateLimiting()` → `configureSecurity()` → `configureAuthRoutes(userService)` →
      `configureGql()` → `configureRouting()`
    - [ ] Ensure `ContentNegotiation` (Jackson) is available for the new routes (see Dev Notes)

- [ ] Task 8: Write `UserRegistrationTest` (AC: 1, 2, 3, 4, 5, 6)
    - [ ] Create `bp_back/src/test/kotlin/com/bagplease/features/auth/UserRegistrationTest.kt`
    - [ ] Cover all six ACs — each as its own `test("...")` block inside a `context("POST /auth/register")` in a
      `FunSpec`
    - [ ] Use `mongoContainer()` + `setUpMongo()` (no `setUpJwt()` needed — test yaml covers it)
    - [ ] Identify test data by generated UUIDs / unique usernames to survive parallel test runs

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
// CORRECT — string UUID for _id filter (per project-context rule):
val filter = Filters.eq("_id", user.id.toString())

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
`configureAuthRoutes()` is a separate `Application` extension with its own `routing {}` block. To ensure
`call.receive<RegisterRequest>()` works, one of these approaches must be used:

**Option A (recommended):** Move `install(ContentNegotiation) { jackson() }` from `securityRoutes()` to
`Application.module()` (or `configureSecurity()`) so it applies globally. Then remove the Route-level install from
`securityRoutes()`.

**Option B:** Install ContentNegotiation again inside `configureAuthRoutes()`'s `routing {}` block (harmless in Ktor 3.x
route scoping).

Check whether the Ktor 3.4.3 ContentNegotiation plugin accepts double-install gracefully before choosing Option B.

### Rate Limiting Plugin

First, verify whether `io.ktor:ktor-server-rate-limit` is available and stable for Ktor 3.4.3.

**If available (Ktor native plugin):**

```kotlin
// plugins/RateLimiting.kt
fun Application.configureRateLimiting() {
    install(RateLimit) {
        register(RateLimitName("auth")) {
            rateLimiter(limit = 5, refillPeriod = 60.seconds)
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

Read `attempts` and `windowSeconds` from `environment.config` (added to application.yaml in Task 1).

**Fallback (in-memory sliding window — if ktor plugin not available):**

```kotlin
// plugins/RateLimiting.kt
private val rateLimitWindows = ConcurrentHashMap<String, ArrayDeque<Long>>()
private const val RATE_LIMIT = 5
private const val WINDOW_MS = 60_000L

fun Application.configureRateLimiting() {
    intercept(ApplicationCallPipeline.Plugins) {
        val path = call.request.path()
        if (path.startsWith("/auth/register") || path.startsWith("/auth/login")) {
            val ip = call.request.local.remoteHost
            val now = System.currentTimeMillis()
            val window = rateLimitWindows.getOrPut(ip) { ArrayDeque() }
            synchronized(window) {
                window.removeAll { it < now - WINDOW_MS }
                if (window.size >= RATE_LIMIT) {
                    call.respond(HttpStatusCode.TooManyRequests, ErrorResponse("Too many requests"))
                    finish()
                    return@intercept
                }
                window.addLast(now)
            }
        }
    }
}
```

Note: Read limits from `environment.config` even in the fallback — don't hardcode.

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

Create `bp_back/src/test/resources/application.yaml`:

```yaml
jwt:
  secret: "secret"
  issuer: "localhost"
  audience: "localhost"
  realm: "localhost"
  admin_login: "admin"
  admin_pass: "admin"

rateLimit:
  attempts: 5
  windowSeconds: 60
```

After creation, `setUpJwt()` calls in `AuthApiTest` and `ItemApiTest` are redundant but harmless — do not touch existing
tests.

### Test Pattern for UserRegistrationTest

```kotlin
class UserRegistrationTest : FunSpec({
    val container = mongoContainer()

    context("POST /auth/register") {
        test("successful registration returns username and role") {
            val username = "user_${UUID.randomUUID().toString().take(8)}"
            testApplication {
                setUpMongo(container)
                application { module() }
                client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"$username","password":"secret123"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    val body = bodyAsText()
                    body shouldContain """"username":"$username""""
                    body shouldContain """"role":"user""""
                    body shouldNotContain "secret"       // AC4 — no password in response
                }
            }
        }

        test("duplicate username returns 400") { ... }
        test("reserved admin username returns 400") { ... }
        test("uniform error for both duplicate and reserved") { /* both return identical error shape */ }
        test("storage lazy sync — second call does not re-sync") { /* register twice, assert only one stored */ }
        test("rate limit returns 429 after 5 requests from same IP") { /* loop 6 calls, 6th is 429 */ }
    }
})
```

**Test isolation rules (project-context):**

- Generate unique usernames per test: `"user_${UUID.randomUUID()}"` pattern avoids cross-test collisions
- Assert by UUID/username you created — never assume the DB is empty
- No mocking — all tests run against real MongoDB via Testcontainers (`mongoContainer()` helper)

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
    └── Security.kt                         [MODIFY — move ContentNegotiation if choosing Option A]

bp_back/src/main/resources/
└── application.yaml                        [MODIFY — add rateLimit section]

bp_back/src/test/resources/
└── application.yaml                        [NEW — static JWT + rateLimit config]

bp_back/src/test/kotlin/com/bagplease/
└── features/auth/
    └── UserRegistrationTest.kt             [NEW]

gradle/libs.versions.toml                   [MODIFY — add bcrypt, optionally ktor-rate-limit]
bp_back/build.gradle.kts                    [MODIFY — add bcrypt implementation]
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

### Completion Notes List

### File List
