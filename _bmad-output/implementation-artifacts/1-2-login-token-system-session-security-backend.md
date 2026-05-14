# Story 1.2: Login, Token System & Session Security Backend

Status: done

## Story

As a registered user,
I want to log in with my credentials and have my session maintained securely via short-lived tokens,
so that I stay authenticated without repeatedly entering my password, with no plaintext tokens accessible from
JavaScript.

## Acceptance Criteria

1. **AC1 — Login success:** `POST /api/auth/login` with correct credentials returns HTTP 200 with
   `{"accessToken": "<jwt>", "username": "<name>", "role": "<role>"}`. The JWT has 15-minute expiry with claims
   `username` + `role`. A `Set-Cookie` header sets an httpOnly, `SameSite=Strict`, `path=/api/auth` refresh token
   cookie (30-day expiry). The refresh token UUID is stored in the `refresh_tokens` MongoDB collection.

2. **AC2 — Login failure:** Any authentication failure (wrong password, wrong username, non-existent user) returns HTTP
   401 with `{"error": "<uniform message>"}`. The message is identical regardless of whether the username exists or the
   password was wrong. No credential material appears in logs.

3. **AC3 — Rate limiting on login:** 6 or more `POST /api/auth/login` requests from the same IP within 1 minute result
   in HTTP 429 for the 6th and subsequent requests. The existing rate limit for `POST /api/auth/register` continues to
   apply.

4. **AC4 — Refresh token rotates access token:** `POST /api/auth/refresh` with a valid httpOnly refresh cookie returns
   HTTP 200 with `{"accessToken": "<new 15-min jwt>"}`. The original refresh token document remains in MongoDB until its
   30-day TTL expires.

5. **AC5 — Invalid refresh token:** `POST /api/auth/refresh` with an expired, absent, or unknown refresh cookie returns
   HTTP 401.

6. **AC6 — Logout:** `POST /api/auth/logout` with a valid refresh cookie returns HTTP 200. The refresh token document is
   deleted from `refresh_tokens`. A subsequent `POST /api/auth/refresh` with the same cookie returns HTTP 401.

7. **AC7 — Admin login:** `POST /api/auth/login` with `KTOR_ADMIN_LOGIN`/`KTOR_ADMIN_PASS` credentials returns a JWT
   with `role: "admin"`. No admin document is stored in the `users` MongoDB collection.

8. **AC8 — Role enforcement:** A valid JWT containing `role: "user"` sent to an admin-only endpoint returns HTTP 403. (
   Test with a testApplication-scoped route using the `requireAdmin()` helper created in this story.)

9. **AC9 — Principal in GraphQL context:** All authenticated GraphQL HTTP requests expose `JWTPrincipal` (containing
   `username` and `role` claims) via `CustomGraphQLContextFactory` under key `GQL_CALL_PRINCIPAL`.

10. **AC10 — Change password:** `POST /api/auth/change-password` with a valid JWT and correct `currentPassword` returns
    HTTP 200. The user's `passwordHash` in MongoDB is updated to a bcrypt-12 hash of `newPassword`. All active refresh
    tokens for that user are deleted from `refresh_tokens`.

11. **AC11 — Wrong current password:** `POST /api/auth/change-password` with an incorrect `currentPassword` returns HTTP
    400 with a non-distinguishing error message.

## Tasks / Subtasks

- [x] Task 1: Extend UserService with login and changePassword (AC: 1, 2, 7, 10, 11)
    - [x] Add `adminPass: String` constructor param to `UserService` — plaintext comparison for env-var admin
      credentials (no bcrypt for admin; see Dev Notes rationale)
    - [x] Add `sealed class AuthError` with variants `InvalidCredentials` and `WrongCurrentPassword` to `UserService.kt`
    - [x] Add `suspend fun login(username: String, password: String): Either<AuthError, LoginResult>` — checks admin
      creds first (plain text), then DB user with bcrypt verify; uniform `InvalidCredentials` for ALL failures (wrong
      username, wrong password, non-existent user)
    - [x] Add `data class LoginResult(val username: String, val role: String)` to `UserService.kt`
    - [x] Expose `suspend fun verifyPassword(plaintext: String, hash: String): Boolean` as `internal` (needed by
      `AuthService` for change-password flow if direct call is required, but better kept internal to UserService)
    - [x] Add
      `suspend fun changePassword(username: String, currentPassword: String, newPassword: String): Either<AuthError, Unit>` —
      finds user, verifies current pw with bcrypt, hashes new, saves updated user via `storage.save()`
    - [x] Update `Application.kt` to pass `adminPass` to `UserService` constructor alongside `adminLogin`

- [x] Task 2: Update application.yaml with JWT expiry config (AC: 1, 4)
    - [x] Add `jwt.accessExpiryMinutes: "$KTOR_JWT_ACCESS_EXPIRY_MINUTES:15"` to
      `bp_back/src/main/resources/application.yaml`
    - [x] Add `jwt.refreshExpiryDays: "$KTOR_JWT_REFRESH_EXPIRY_DAYS:30"` to
      `bp_back/src/main/resources/application.yaml`
    - [x] Add same two keys with static values `15` and `30` to `bp_back/src/test/resources/application.yaml`

- [x] Task 3: Create RefreshToken BSON model and repository (AC: 1, 4, 5, 6, 10)
    - [x] Create `bp_back/src/main/kotlin/com/bagplease/mongo/model/serialization/InstantBsonSerializer.kt` —
      `object InstantBsonSerializer : KSerializer<java.time.Instant>` that encodes as `BsonDateTime` (epoch millis) and
      decodes from `BsonDateTime`; follow the same pattern as `UUIDMongoSerializer`
    - [x] Create `bp_back/src/main/kotlin/com/bagplease/features/auth/RefreshToken.kt` —
      `@Serializable data class RefreshToken(@SerialName("_id") val token: String, val username: String, @Serializable(with = InstantBsonSerializer::class) val expiresAt: java.time.Instant)` —
      NO domain layer, BSON model only; `_id` is a UUID string
    - [x] Create `bp_back/src/main/kotlin/com/bagplease/features/auth/RefreshTokenRepository.kt` — holds MongoDB
      collection `refresh_tokens`; `init {}` block creates TTL index on `expiresAt` field (
      `IndexOptions().expireAfter(0, TimeUnit.SECONDS)`) using `runBlocking`; methods: `save(token: RefreshToken)`,
      `findById(tokenValue: String): RefreshToken?`, `deleteById(tokenValue: String)`,
      `deleteAllForUser(username: String)`

- [x] Task 4: Create AuthService (AC: 1, 4, 6, 7, 10)
    - [x] Create `bp_back/src/main/kotlin/com/bagplease/features/auth/AuthService.kt`
    - [x] Constructor params: `userService: UserService`, `refreshTokenRepository: RefreshTokenRepository`,
      `jwtSecret: String`, `jwtIssuer: String`, `jwtAudience: String`, `accessExpiryMinutes: Long`,
      `refreshExpiryDays: Long`
    - [x] `suspend fun login(username: String, password: String): Either<AuthError, AuthTokens>` — calls
      `userService.login()`, on success generates UUID refresh token string, stores in MongoDB via
      `refreshTokenRepository.save()`, returns
      `AuthTokens(accessToken: String, refreshToken: String, username: String, role: String)`
    - [x] `suspend fun refresh(refreshTokenValue: String): Either<AuthError, String>` — calls
      `refreshTokenRepository.findById(refreshTokenValue)`, if null returns `Left(InvalidCredentials)`, if found and not
      expired returns `Right(newAccessToken)`, if found but expired returns `Left(InvalidCredentials)` (note: MongoDB
      TTL deletes expired docs, but check `expiresAt` vs now to handle delay)
    - [x] `suspend fun logout(refreshTokenValue: String)` — calls
      `refreshTokenRepository.deleteById(refreshTokenValue)` (idempotent; no error on missing token)
    - [x] `suspend fun invalidateUserSessions(username: String)` — calls
      `refreshTokenRepository.deleteAllForUser(username)`, used after change-password
    - [x] Private `fun issueAccessToken(username: String, role: String): String` — creates JWT with `username` + `role`
      claims, 15-min expiry, signed with HMAC256

- [x] Task 5: Create new DTOs (AC: 1, 4, 10)
    - [x] Create `bp_back/src/main/kotlin/com/bagplease/features/auth/dto/LoginRequest.kt` —
      `data class LoginRequest(val username: String, val password: String)` (Jackson DTO, NOT @Serializable)
    - [x] Create `bp_back/src/main/kotlin/com/bagplease/features/auth/dto/LoginResponse.kt` —
      `data class LoginResponse(val accessToken: String, val username: String, val role: String)` (Jackson DTO)
    - [x] Create `bp_back/src/main/kotlin/com/bagplease/features/auth/dto/RefreshResponse.kt` —
      `data class RefreshResponse(val accessToken: String)` (Jackson DTO)
    - [x] Create `bp_back/src/main/kotlin/com/bagplease/features/auth/dto/ChangePasswordRequest.kt` —
      `data class ChangePasswordRequest(val currentPassword: String, val newPassword: String)` (Jackson DTO)
    - [x] Note: `RegisterResponse` currently in `features/auth/dto/RegisterResponse.kt` stays as-is for now — its
      response shape `{"username", "role"}` differs from `LoginResponse` which adds `accessToken`; Story 1.4 (auto-login
      after register) will upgrade to `LoginResponse`

- [x] Task 6: Update AuthRoutes with new endpoints (AC: 1, 2, 3, 4, 5, 6, 8, 10, 11)
    - [x] Update `configureAuthRoutes()` signature to
      `fun Application.configureAuthRoutes(userService: UserService, authService: AuthService)` (add `authService`
      param)
    - [x] Add `post("/auth/login")` inside `rateLimit(RateLimitName("auth"))` block alongside existing
      `/auth/register` — reads `LoginRequest`, calls `authService.login()`, on success sets httpOnly cookie and responds
      with `LoginResponse`, on failure responds HTTP 401 with `ErrorResponse`
    - [x] Add `post("/auth/refresh")` outside rate limit block — reads `call.request.cookies["refresh_token"]`, calls
      `authService.refresh()`, responds with `RefreshResponse` or HTTP 401
    - [x] Add `post("/auth/logout")` outside rate limit block — reads cookie, calls `authService.logout()` (ignore if
      missing), clears cookie, responds HTTP 200
    - [x] Add `authenticate(authMethod) { post("/auth/change-password") { ... } }` outside rate limit block — reads
      `JWTPrincipal` to get `username` claim, reads `ChangePasswordRequest` body, calls `userService.changePassword()`,
      on success calls `authService.invalidateUserSessions(username)`, responds HTTP 200 or HTTP 400 on
      `WrongCurrentPassword`
    - [x] Add `fun ApplicationCall.requireAdmin(): Boolean` extension (or top-level function) — checks
      `principal<JWTPrincipal>()?.payload?.getClaim("role")?.asString() == "admin"`; used by Story 2 admin route
      handlers via
      `if (!call.requireAdmin()) { call.respond(HttpStatusCode.Forbidden, ErrorResponse("Forbidden")); return@post }`
      pattern

- [x] Task 7: Update Security.kt — remove old login, update JWT validator (AC: 7, 8, 9)
    - [x] Remove `data class User(val username: String, val password: String)` from `Security.kt` — it was the old login
      DTO; conflicts with entity `User` class in later imports
    - [x] Remove `fun Routing.securityRoutes()` function entirely — contains the old `post("/login")` (admin-only, 7-day
      token) and `get("/auth-test")` debug endpoint; both are replaced by story 1.2 routes
    - [x] Update JWT `validate { }` block in `configureSecurity()` to check BOTH `username` and `role` claims are
      non-empty —
      `val username = credential.payload.getClaim("username").asString(); val role = credential.payload.getClaim("role").asString(); if (username.isNotEmpty() && role.isNotEmpty()) JWTPrincipal(credential.payload) else null`

- [x] Task 8: Update Routing.kt — remove securityRoutes() call (AC: 2)
    - [x] Remove `securityRoutes()` call from `configureRouting()` in `Routing.kt` — old login is now served by
      `configureAuthRoutes()` in `Application.module()`
    - [x] `gqlRoutes()` stays as-is

- [x] Task 9: Activate Principal threading in GQL.kt (AC: 9)
    - [x] In `CustomGraphQLContextFactory.generateContext()`, uncomment the
      `.plus(mapOf(GQL_CALL_PRINCIPAL to request.call.principal<JWTPrincipal>()))` line
    - [x] Add required import: `import io.ktor.server.auth.principal` and `import io.ktor.server.auth.jwt.JWTPrincipal`

- [x] Task 10: Wire new services in Application.kt (AC: all)
    - [x] Read `adminPass` from config: `config.property("jwt.admin_pass").getString()`
    - [x] Read `accessExpiryMinutes` and `refreshExpiryDays` from config
    - [x] Create `RefreshTokenRepository(connection.db)`
    - [x] Update `UserService` construction to `UserService(userStorage, adminLogin, adminPass)`
    - [x] Create
      `AuthService(userService, refreshTokenRepository, secret, issuer, audience, accessExpiryMinutes, refreshExpiryDays)`
    - [x] Update `configureAuthRoutes(userService)` call to `configureAuthRoutes(userService, authService)`

- [x] Task 11: Update AuthApiTest.kt for new endpoint (AC: 1, 2)
    - [x] Update `"login with valid credentials returns token"` test: change path `/login` → `/auth/login`, update body
      to use `LoginRequest` shape, verify response now contains `accessToken` (not `token`), verify `username` and
      `role` fields present
    - [x] Update `"login with wrong password returns 401"` test: change path `/login` → `/auth/login`
    - [x] Note: `"graphql without token returns 401"` test stays unchanged — still tests GraphQL auth gate

- [x] Task 12: Create LoginTokenTest.kt with all ACs (AC: 1–11)
    - [x] Create `bp_back/src/test/kotlin/com/bagplease/features/auth/LoginTokenTest.kt` extending `FunSpec`
    - [x] Use `mongoContainer()` + `setUpMongo(container)` + `setUpJwt()` in each `testApplication`
    - [x] Cover AC1: admin login returns `accessToken`, `username: "admin"`, `role: "admin"` and sets refresh cookie
    - [x] Cover AC1: registered user login returns `accessToken`, correct `username`, `role: "user"` and sets refresh
      cookie
    - [x] Cover AC2: wrong password returns 401 with same error as non-existent user (sample both; assert identical
      `error` field)
    - [x] Cover AC3: send 6 requests from same IP to `/auth/login`, verify 6th is HTTP 429
    - [x] Cover AC4: login → capture cookie → `POST /auth/refresh` with cookie → 200 with new `accessToken`
    - [x] Cover AC5: `POST /auth/refresh` with no cookie → 401
    - [x] Cover AC6: login → capture cookie → `POST /auth/logout` → 200; then `POST /auth/refresh` with same cookie →
      401
    - [x] Cover AC7: admin login does not add document to `users` collection (check via register → login count does not
      change)
    - [x] Cover AC8: register+login (role: "user") → use `accessToken` to call a testApplication route that calls
      `requireAdmin()` → verify HTTP 403; admin token on same route → HTTP 200
    - [x] Cover AC9: authenticated GraphQL request → check response does NOT have auth error (Principal threading is
      structural; full assertion is integration-level; a simple auth'd GQL query returning data is sufficient)
    - [x] Cover AC10: register → login → `POST /auth/change-password` with correct current pw → 200; then verify old
      password no longer works for login (HTTP 401)
    - [x] Cover AC10 (token invalidation): login → capture cookie → `POST /auth/change-password` → `POST /auth/refresh`
      with original cookie → 401
    - [x] Cover AC11: `POST /auth/change-password` with wrong current password → 400

## Dev Notes

### AdminPass Plain Text Comparison — Rationale

Admin credentials come from environment variables and are never stored in MongoDB. Unlike user passwords (which are
hashed at rest), admin passwords are system-level secrets managed externally (env vars, secrets manager). Plain text
string comparison is appropriate: `username == adminLogin && password == adminPass`. Do NOT bcrypt-hash the admin pass
inside the `UserService` constructor using `runBlocking` — this adds 200–400ms to every application startup with no
security benefit, since the secret is already in memory.

The architecture sketch using `verifyPassword(password, adminPasswordHash)` was illustrative; this story chooses
plain text comparison for admin credentials specifically.

### RefreshToken BSON Date Serialization — Critical Detail

MongoDB's TTL index on `expiresAt` requires the field to be stored as BSON `Date` type (`BsonDateTime`). Storing as
`Long` (epoch ms) causes the TTL index to silently ignore the field and expired tokens will never be auto-deleted.

Create `InstantBsonSerializer` in `mongo/model/serialization/` following the `UUIDMongoSerializer` pattern:

```kotlin
@OptIn(ExperimentalSerializationApi::class)
object InstantBsonSerializer : KSerializer<java.time.Instant> {
    override val descriptor = PrimitiveSerialDescriptor("Instant", PrimitiveKind.LONG)

    override fun serialize(encoder: Encoder, value: java.time.Instant) {
        when (encoder) {
            is BsonEncoder -> encoder.encodeBsonValue(BsonDateTime(value.toEpochMilli()))
            else -> encoder.encodeLong(value.toEpochMilli())
        }
    }

    override fun deserialize(decoder: Decoder): java.time.Instant {
        return when (decoder) {
            is BsonDecoder -> java.time.Instant.ofEpochMilli(decoder.decodeBsonValue().asDateTime().value)
            else -> java.time.Instant.ofEpochMilli(decoder.decodeLong())
        }
    }
}
```

If `encoder.encodeBsonValue(BsonDateTime(...))` does not compile, check the `BsonEncoder` interface in
`org.bson.codecs.kotlinx.BsonEncoder` — in bson-kotlinx 5.5.1, `encodeBsonValue(BsonValue)` is available on the
interface. Verify by reading the library source or Javadoc.

### RefreshToken Document Structure

```kotlin
// features/auth/RefreshToken.kt
@Serializable
data class RefreshToken(
    @SerialName("_id") val token: String,     // UUID string IS the MongoDB _id
    val username: String,                      // for deleteAllForUser() query
    @Serializable(with = InstantBsonSerializer::class)
    val expiresAt: java.time.Instant
)
```

The `_id` is a plain String (UUID string), NOT a UUID object. Filters use string directly:

```kotlin
Filters.eq("_id", tokenValue)                 // tokenValue is a UUID.randomUUID().toString()
```

### RefreshTokenRepository Pattern

```kotlin
class RefreshTokenRepository(db: MongoDatabase) {
    private val col = db.getCollection<RefreshToken>("refresh_tokens")

    init {
        runBlocking {
            col.createIndex(
                Indexes.ascending(RefreshToken::expiresAt.name),
                IndexOptions().expireAfter(0, TimeUnit.SECONDS)
            )
        }
    }

    suspend fun save(token: RefreshToken) {
        col.insertOne(token)          // not upsert — new token every login
    }

    suspend fun findById(tokenValue: String): RefreshToken? =
        col.find(Filters.eq("_id", tokenValue)).firstOrNull()

    suspend fun deleteById(tokenValue: String) {
        col.deleteOne(Filters.eq("_id", tokenValue))
    }

    suspend fun deleteAllForUser(username: String) {
        col.deleteMany(Filters.eq(RefreshToken::username.name, username))
    }
}
```

Note: `col.insertOne(token)` not upsert — each login creates a new refresh token document. Multiple concurrent
sessions per user are allowed in Phase 1.

### JWT Cookie Pattern — Exact Attributes

Copy exactly, including `path = "/api/auth"` scoping:

```kotlin
response.cookies.append(
    name = "refresh_token",
    value = refreshToken,
    maxAge = refreshExpiryDays * 24 * 60 * 60,
    httpOnly = true,
    secure = true,
    extensions = mapOf("SameSite" to "Strict"),
    path = "/api/auth"          // scoped to auth endpoints
)
```

To clear the cookie on logout:

```kotlin
response.cookies.append(
    name = "refresh_token",
    value = "",
    maxAge = 0,
    httpOnly = true,
    secure = true,
    extensions = mapOf("SameSite" to "Strict"),
    path = "/api/auth"
)
```

### AuthService JWT Issuance Pattern

```kotlin
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import java.time.Instant

private fun issueAccessToken(username: String, role: String): String =
    JWT.create()
        .withAudience(jwtAudience)
        .withIssuer(jwtIssuer)
        .withClaim("username", username)
        .withClaim("role", role)
        .withExpiresAt(Instant.now().plusSeconds(accessExpiryMinutes * 60))
        .sign(Algorithm.HMAC256(jwtSecret))
```

The existing JWT library is `com.auth0:java-jwt` (pulled in transitively by `ktor-server-auth-jwt`). Use the
same `Algorithm.HMAC256(secret)` pattern as the existing `Security.kt`.

### Admin Login — No DB Lookup on Correct Admin Credentials

```kotlin
// In UserService.login():
suspend fun login(username: String, password: String): Either<AuthError, LoginResult> = either {
    // Check admin FIRST — never do DB lookup for admin username
    if (username == adminLogin) {
        if (password == adminPass) return@either LoginResult(username, "admin")
        else raise(AuthError.InvalidCredentials)    // admin username but wrong password → same uniform error
    }
    // Only reach here for non-admin usernames
    val user = storage.findByUsername(username) ?: raise(AuthError.InvalidCredentials)
    if (!verifyPassword(password, user.passwordHash)) raise(AuthError.InvalidCredentials)
    LoginResult(user.username, user.role)
}
```

Key: if `username == adminLogin` but password is wrong, still return `InvalidCredentials` — never reveal that the
admin account exists.

### requireAdmin() Extension — Placement

Define in `AuthRoutes.kt` (not in Security.kt) as:

```kotlin
fun ApplicationCall.requireAdmin(): Boolean =
    principal<JWTPrincipal>()?.payload?.getClaim("role")?.asString() == "admin"
```

Story 2 admin route handlers will call this:

```kotlin
authenticate(authMethod) {
    get("/admin/users") {
        if (!call.requireAdmin()) {
            call.respond(HttpStatusCode.Forbidden, ErrorResponse("Forbidden"))
            return@get
        }
        // ... admin logic
    }
}
```

### Removing securityRoutes() — What Breaks

`Security.kt` has `Routing.securityRoutes()` which is called in `Routing.kt`. It contains:

1. `post("/login")` — old admin-only 7-day token login (REPLACE with `/auth/login`)
2. `get("/auth-test")` — debug endpoint (REMOVE)
3. Also has `data class User(val username: String, val password: String)` at file top — REMOVE (conflicts with
   entity `User` in later imports)

After removal, `securityRoutes()` is dead — remove the function AND its call in `configureRouting()`.

The `authMethod` constant and `configureSecurity()` function stay in `Security.kt` — they are still used.

### ContentNegotiation — Existing Debug Log from Story 1.1

ContentNegotiation is installed at the routing root by `Routing.kt`'s `install(ContentNegotiation)` block. All
routing blocks (from `configureAuthRoutes`, `configureGql`, etc.) share the same routing tree root, so
ContentNegotiation
applies to all routes. Do NOT reinstall ContentNegotiation in any new routing block.

The `authenticate(authMethod)` block inside `configureAuthRoutes()` for `/auth/change-password` requires that
`configureSecurity()` runs before `configureAuthRoutes()` in `Application.module()` (already the case from story 1.1).

### Testing — Cookie Handling in testApplication

The Ktor `testApplication` client does NOT automatically store and resend cookies between requests. To test the
refresh flow, capture the cookie from the login response and resend it manually:

```kotlin
// In LoginTokenTest:
val loginResponse = client.post("/auth/login") { ... }
val cookieHeader = loginResponse.headers["Set-Cookie"] ?: ""
// Extract the refresh_token value:
val refreshToken = cookieHeader.substringAfter("refresh_token=").substringBefore(";")

val refreshResponse = client.post("/auth/refresh") {
    header(HttpHeaders.Cookie, "refresh_token=$refreshToken")
}
```

### Testing — Rate Limit Test Must Fire 5 Previous Requests First

The rate limiter allows 5 attempts before blocking. To trigger 429, you must send 5 requests that succeed (or fail)
and then a 6th:

- Send 5 login requests (any credentials — failed logins still count against the limit)
- Send the 6th request — verify HTTP 429
- Use a unique IP per test by overriding `setUpMongo(container)` with a different `X-Forwarded-For` header, OR rely
  on the fact that testApplication uses "localhost" as remote host for all requests (they share the limit)

Note: rate limit state is in-memory and shared across tests in the same JVM process. Test isolation may require each
rate-limit test to use a fresh `testApplication` block — this is already the case since each `testApplication` creates
a fresh application instance with a fresh rate limiter.

### Testing — AC8 (requireAdmin) Verification Pattern

```kotlin
test("user role JWT returns 403 on admin-only endpoint") {
    val username = "user_${UUID.randomUUID().toString().take(8)}"
    testApplication {
        setUpMongo(container)
        setUpJwt()
        application {
            module()
            // Add a test-only admin route:
            routing {
                authenticate(authMethod) {
                    get("/test-admin-only") {
                        if (!call.requireAdmin()) {
                            call.respond(HttpStatusCode.Forbidden, ErrorResponse("Forbidden"))
                            return@get
                        }
                        call.respond(HttpStatusCode.OK, mapOf("ok" to true))
                    }
                }
            }
        }
        // Register + login as regular user
        client.post("/auth/register") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"pass"}""")
        }
        val loginBody = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"pass"}""")
        }.bodyAsText()
        val token = jacksonObjectMapper().readTree(loginBody).get("accessToken").asText()

        client.get("/test-admin-only") {
            header(HttpHeaders.Authorization, "Bearer $token")
        }.shouldHaveStatus(HttpStatusCode.Forbidden)

        // Repeat with admin token
        val adminLoginBody = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"admin","password":"admin"}""")
        }.bodyAsText()
        val adminToken = jacksonObjectMapper().readTree(adminLoginBody).get("accessToken").asText()

        client.get("/test-admin-only") {
            header(HttpHeaders.Authorization, "Bearer $adminToken")
        }.shouldHaveStatus(HttpStatusCode.OK)
    }
}
```

Jackson's `jacksonObjectMapper()` is available from the `jackson-module-kotlin` transitive dependency. Alternatively,
use `bodyAsText()` + string contains assertions to avoid Jackson deserialization complexity in tests.

### Package Structure for New/Modified Files

```
bp_back/src/main/kotlin/com/bagplease/
├── Application.kt                                         [MODIFY — add adminPass, RefreshTokenRepository, AuthService]
├── entity/user/
│   └── UserService.kt                                     [MODIFY — add login(), changePassword(), AuthError sealed class, adminPass constructor param]
├── features/
│   └── auth/
│       ├── AuthRoutes.kt                                  [MODIFY — add login/refresh/logout/change-password; add requireAdmin()]
│       ├── AuthService.kt                                 [NEW]
│       ├── RefreshToken.kt                                [NEW — BSON model only, no domain layer]
│       ├── RefreshTokenRepository.kt                      [NEW]
│       └── dto/
│           ├── LoginRequest.kt                            [NEW]
│           ├── LoginResponse.kt                           [NEW]
│           ├── RefreshResponse.kt                         [NEW]
│           └── ChangePasswordRequest.kt                   [NEW]
├── mongo/
│   └── model/
│       └── serialization/
│           └── InstantBsonSerializer.kt                   [NEW — for expiresAt BSON Date encoding]
└── plugins/
    ├── GQL.kt                                             [MODIFY — uncomment Principal threading]
    ├── Routing.kt                                         [MODIFY — remove securityRoutes() call]
    └── Security.kt                                        [MODIFY — remove old User data class, remove securityRoutes(), update JWT validator]

bp_back/src/main/resources/
└── application.yaml                                       [MODIFY — add accessExpiryMinutes, refreshExpiryDays]

bp_back/src/test/resources/
└── application.yaml                                       [MODIFY — add accessExpiryMinutes: 15, refreshExpiryDays: 30]

bp_back/src/test/kotlin/com/bagplease/
├── AuthApiTest.kt                                         [MODIFY — update /login → /auth/login, accessToken field]
└── features/auth/
    └── LoginTokenTest.kt                                  [NEW]
```

### Do Not Touch

- `entity/user/User.kt`, `entity/user/UserStorage.kt` — no changes needed; UserStorage already has `findByUsername()`
- `entity/user/mongo/` — MongoUser, MongoUserMapper, UserRepository unchanged
- `features/auth/dto/RegisterRequest.kt`, `RegisterResponse.kt` — unchanged (Story 1.4 upgrades register to return
  LoginResponse)
- `features/auth/dto/ErrorResponse.kt` — unchanged; reused by new route handlers
- `plugins/RateLimiting.kt` — unchanged; `RateLimitName("auth")` already designed to cover both register and login
- `entity/item/`, `entity/category/` — zero changes; this story is purely additive to auth layer
- `src/__generated__/` — auth is REST; no GraphQL schema changes; do NOT run `npm run generate`
- Existing `plugins/GQL.kt` beyond the Principal uncomment — all GQL schema, queries, mutations unchanged

### References

- Story 1.1 dev notes: `_bmad-output/implementation-artifacts/1-1-user-entity-registration-backend.md` —
  ContentNegotiation debug log, UUID filter pattern, test setup pattern
- Architecture patterns: `_bmad-output/planning-artifacts/architecture.md` — "Admin Credential Check Pattern", "Refresh
  Token Cookie Pattern", "API Response DTO Shapes", "Gap 2 RefreshToken _id", "Gap 3 TTL index creation"
- JWT issuance: `bp_back/src/main/kotlin/com/bagplease/plugins/Security.kt` — existing JWT library usage (com.auth0.jwt)
- BSON serializer pattern: `bp_back/src/main/kotlin/com/bagplease/mongo/model/serialization/UUIDSerializer.kt`
- Test pattern: `bp_back/src/test/kotlin/com/bagplease/features/auth/UserRegistrationTest.kt`
- Test utilities: `bp_back/src/test/kotlin/com/bagplease/utils/TestContainers.kt`
- Rate limiter: `bp_back/src/main/kotlin/com/bagplease/plugins/RateLimiting.kt` — `RateLimitName("auth")` design

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `GraphQLContext.plus()` does not exist — the context is mutable; used `ctx.put(key, value)` directly after
  `super.generateContext()`.
- `FindFlow.firstOrNull()` not available — used `.toList().firstOrNull()` matching existing repository pattern.
- `testApplication` does not auto-load `application.yaml` — new keys `accessExpiryMinutes` and `refreshExpiryDays` had
  to be added to `setUpJwt()` in addition to `application.yaml`.
- `RefreshToken` spec omits `role` field — added `role: String` to `RefreshToken` so refresh endpoint can issue correct
  role in new access tokens (admin role would otherwise be lost on token rotation).

### Completion Notes List

- Implemented full login/token/session lifecycle: `POST /api/auth/login`, `POST /api/auth/refresh`,
  `POST /api/auth/logout`, `POST /api/auth/change-password`.
- Admin credentials use plain-text comparison; user credentials use bcrypt-12; uniform `InvalidCredentials` error for
  all login failures (AC2 satisfied).
- `RefreshToken` stored in `refresh_tokens` MongoDB collection with TTL index on `expiresAt`; includes `role` field (
  added beyond spec) to correctly issue role-bearing access tokens on refresh.
- `requireAdmin()` extension on `ApplicationCall` defined in `AuthRoutes.kt` for reuse by Story 2 admin routes.
- JWT `validate {}` block updated to require both `username` and `role` claims non-empty (AC8/AC9).
- Principal threading activated: `CustomGraphQLContextFactory` now puts `JWTPrincipal` under `GQL_CALL_PRINCIPAL` key (
  AC9).
- Old `securityRoutes()` (`POST /login`, `GET /auth-test`) and `data class User` removed from `Security.kt` +
  `Routing.kt`.
- `ItemApiTest.loginToken()` updated from `/login` → `/auth/login` and `token` → `accessToken` to fix regression.
- All 28 tests pass (28 new/updated, 0 regressions).

### File List

bp_back/src/main/kotlin/com/bagplease/Application.kt
bp_back/src/main/kotlin/com/bagplease/entity/user/UserService.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/AuthRoutes.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/AuthService.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/RefreshToken.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/RefreshTokenRepository.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/dto/ChangePasswordRequest.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/dto/LoginRequest.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/dto/LoginResponse.kt
bp_back/src/main/kotlin/com/bagplease/features/auth/dto/RefreshResponse.kt
bp_back/src/main/kotlin/com/bagplease/mongo/model/serialization/InstantBsonSerializer.kt
bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt
bp_back/src/main/kotlin/com/bagplease/plugins/Routing.kt
bp_back/src/main/kotlin/com/bagplease/plugins/Security.kt
bp_back/src/main/resources/application.yaml
bp_back/src/test/kotlin/com/bagplease/AuthApiTest.kt
bp_back/src/test/kotlin/com/bagplease/ItemApiTest.kt
bp_back/src/test/kotlin/com/bagplease/features/auth/LoginTokenTest.kt
bp_back/src/test/kotlin/com/bagplease/utils/TestContainers.kt
bp_back/src/test/resources/application.yaml

### Review Findings

**Decision needed (2):**

- [x] [Review][Decision] AC3 — Login and register share the same rate-limit bucket — resolved: shared bucket is
  intentional; "continues to apply" means register still has rate limiting, not that it requires a separate counter.
- [x] [Review][Patch] Admin calling /auth/change-password must return 403 "Admin password cannot be changed via this
  endpoint" — admin is not in UserStorage; currently raises WrongCurrentPassword and returns misleading 400; add
  explicit admin guard at top of handler [AuthRoutes.kt change-password handler]

**Patch (7):**

- [x] [Review][Patch] Refresh expiry uses `isBefore` instead of `!isAfter` — token expiring at exactly `Instant.now()`
  passes the check; use `!stored.expiresAt.isAfter(Instant.now())` [AuthService.kt refresh()]
- [x] [Review][Patch] /auth/refresh and /auth/change-password are outside the `rateLimit("auth")` block —
  unauthenticated callers can brute-force refresh tokens at full speed; /change-password likewise
  unthrottled [AuthRoutes.kt]
- [x] [Review][Patch] `runBlocking` in `RefreshTokenRepository.init {}` can deadlock or fail silently — index creation
  failure goes undetected; TTL cleanup never runs; use suspend init pattern or startup
  hook [RefreshTokenRepository.kt:14]
- [x] [Review][Patch] `getClaim().asString()` returns null for absent claim — `null.isNotEmpty()` throws NPE; add
  null-safe check (`?.isNotEmpty() == true`) in JWT `validate` block [Security.kt:30-32]
- [x] [Review][Patch] AC7 test logic is insufficient — re-registering "admin" fails due to reserved-name guard
  regardless of DB state; test cannot prove admin document was not stored; query the users collection directly to
  verify [LoginTokenTest.kt AC7 test]
- [x] [Review][Patch] AC11 — distinguishable error messages in change-password: "Current password is incorrect" vs "
  Password change failed" reveals failure mode; use a single uniform message for all 400
  responses [AuthRoutes.kt:98-103]

**Deferred (10):**

- [x] [Review][Defer] Admin timing attack — plain-text `==` comparison is faster than bcrypt+DB; spec explicitly
  documents plain-text comparison as intentional; inherent in design — deferred, pre-existing
- [x] [Review][Defer] Admin password in JVM heap as String — general JVM concern for any config-sourced String; not
  zeroed on GC; not introduced by this story — deferred, pre-existing
- [x] [Review][Defer] Refresh tokens stored as plaintext in MongoDB — SHA-256 of token should be stored as the index;
  requires schema change; security hardening beyond current scope — deferred, pre-existing
- [x] [Review][Defer] Access token not revoked on password change — existing 15-min access JWTs remain valid after
  change-password; known JWT limitation; requires token blocklist to fix — deferred, pre-existing
- [x] [Review][Defer] Admin timing leak vs regular user (bcrypt+DB round trip) — inherent in admin plain-text design;
  see spec Dev Notes — deferred, pre-existing
- [x] [Review][Defer] No `iat` (issued-at) claim in JWT — prevents "invalidate tokens before T" pattern; security
  hardening beyond current scope — deferred, pre-existing
- [x] [Review][Defer] `UserStorage.sync()` check-then-act race on `synced` flag — pre-existing code not touched in this
  story — deferred, pre-existing
- [x] [Review][Defer] CORS plugin does not allow credentials or expose Authorization header — pre-existing config;
  frontend is same-origin via nginx in production — deferred, pre-existing
- [x] [Review][Defer] MongoDB error handling absent in repositories — `insertOne` / `deleteOne` propagate
  MongoWriteException as 500; pre-existing pattern across all repositories — deferred, pre-existing
- [x] [Review][Defer] AC2 log sanitization — request bodies including credentials may appear in Ktor monitoring logs;
  pre-existing concern flagged in Story 1.1 deferred items — deferred, pre-existing

## Change Log

- 2026-05-08: Implemented Story 1.2 — login/token/session security backend. New endpoints: POST /api/auth/login,
  /auth/refresh, /auth/logout, /auth/change-password. New files: AuthService, RefreshToken, RefreshTokenRepository,
  InstantBsonSerializer, 4 DTOs, LoginTokenTest. Modified: UserService (login/changePassword), AuthRoutes (new
  endpoints + requireAdmin), Security.kt (removed old login + updated JWT validator), Routing.kt (removed
  securityRoutes), GQL.kt (principal threading), Application.kt (wiring), application.yaml (expiry config), AuthApiTest,
  ItemApiTest, TestContainers (setUpJwt). 28/28 tests pass.
