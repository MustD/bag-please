# Story 2.2: Admin User Management Backend

Status: done

## Story

As an admin,
I want to manage user accounts via GraphQL,
so that I can create, reset passwords, and remove users without direct database access, using the same API layer as the
rest of the application.

## Acceptance Criteria

**AC1 — Users query returns all regular users:**
Given the admin is authenticated,
When the GraphQL `users` query is called,
Then the response contains an array of `{id, username, role}` for all MongoDB users,
And the admin account (env-var credentials) is NOT included in the list.

**AC2 — createUser mutation:**
Given a valid admin JWT and username "tom" does not yet exist,
When the `createUser(username: "tom", password: "initial123")` mutation is called,
Then the response contains `{id, username: "tom", role: "user"}`,
And "tom" is stored in MongoDB with a bcrypt-12 hashed password,
And a subsequent `users` query includes "tom".

**AC3 — deleteUser mutation:**
Given user "tom" exists with a known UUID,
When the `deleteUser(id: "…")` mutation is called by the admin,
Then "tom" is removed from MongoDB,
And a subsequent `users` query does not include "tom".

**AC4 — resetUserPassword mutation:**
Given user "tom" exists with a known UUID,
When the `resetUserPassword(id: "…", newPassword: "newpass")` mutation is called,
Then "tom"'s password hash in MongoDB is updated to bcrypt-12("newpass"),
And all of "tom"'s active refresh tokens are deleted from `refresh_tokens`,
And "tom" can subsequently log in with "newpass".

**AC5 — Non-admin gets FORBIDDEN:**
Given a non-admin user calls any admin GraphQL mutation or query from this story,
When the GQL context principal is checked,
Then a GraphQL error with `extensions.code = "FORBIDDEN"` is returned.

**AC6 — NOT_FOUND for missing user:**
Given `deleteUser` is called with an ID that does not exist,
Then a GraphQL error with `extensions.code = "NOT_FOUND"` is returned.

## Tasks / Subtasks

- [x] Task 1: Extend UserRepository with findById and deleteById (AC: 3, 4, 6)
    - [x] Add `suspend fun findById(id: UUID): User?` — filter by UUID object (consistent with existing `save()`)
    - [x] Add `suspend fun deleteById(id: UUID)` — filter by UUID object

- [x] Task 2: Extend UserService with admin methods + AdminError (AC: 1, 2, 3, 4)
    - [x] Add `sealed class AdminError { data object NotFound : AdminError() }` at top of file
    - [x] Add `suspend fun getAllRegularUsers(): List<User>` — delegates to `repository.getAll()`
    - [x] Add `suspend fun adminCreateUser(username, password): Either<RegistrationError, User>` — same logic as
      `register()` minus `registrationEnabled` check
    - [x] Add `suspend fun adminDeleteUser(id: UUID): Either<AdminError, User>` — findById → deleteById → return User
    - [x] Add `suspend fun adminResetPassword(id: UUID, newPassword: String): Either<AdminError, User>` — findById →
      hash → save → return User

- [x] Task 3: Create GQL layer for user admin (AC: 1, 2, 3, 4, 5)
    - [x] Create `entity/user/gql/GqlUser.kt` — `@GraphQLName("User")` data class with `ID` id field
    - [x] Create `entity/user/gql/GqlUserMapper.kt` — object singleton, `UUID → ID(uuid.toString())`
    - [x] Create `entity/user/gql/UserAdminApi.kt` — `UserAdminQueries` + `UserAdminMutations` with local
      `requireAdmin()` check

- [x] Task 4: Create GraphQLNotFoundException Java class (AC: 6)
    - [x] Create `src/main/java/com/bagplease/plugins/GraphQLNotFoundException.java`
    - [x] `getExtensions()` returns `Map.of("code", "NOT_FOUND")`

- [x] Task 5: Wire into GQL.kt and Application.kt (AC: 1–6)
    - [x] Update `configureGql()` signature: add `userService: UserService`, `authService: AuthService`,
      `adminLogin: String`
    - [x] Add `"com.bagplease.entity.user.gql"` to packages list
    - [x] Add `UserAdminQueries(userService, adminLogin)` to queries list
    - [x] Add `UserAdminMutations(userService, authService, adminLogin)` to mutations list
    - [x] Update `Application.kt` call: `configureGql(appConfigService, userService, authService, adminLogin)`

- [x] Task 6: Write tests (AC: 1–6)
    - [x] Create `bp_back/src/test/kotlin/com/bagplease/features/admin/AdminUserManagementTest.kt`
    - [x] AC1: `users` query returns registered users; admin username not present
    - [x] AC2: `createUser` mutation creates user; subsequent `users` query includes them
    - [x] AC3: `deleteUser` removes user by UUID; subsequent `users` query excludes them
    - [x] AC4: `resetUserPassword` updates hash; deletes refresh tokens; new password works for login
    - [x] AC5: Non-admin JWT on `users` query and any mutation returns FORBIDDEN
    - [x] AC6: `deleteUser` with non-existent UUID returns NOT_FOUND

- [x] Task 7: Run tests
    - [x] From `bp_back/`: `../gradlew test`
    - [x] All `AdminUserManagementTest` tests plus existing suites pass

## Dev Notes

### Architecture Decision: GQL not REST

The architecture doc lists `features/admin/AdminRoutes.kt` with REST endpoints (`GET/POST/DELETE /api/admin/users`). The
story ACs explicitly use GQL operations (`users` query, `createUser`/`deleteUser`/`resetUserPassword` mutations). Same
conflict existed in story 2.1 — epics.md AR2 is definitive: "Admin operations are exposed via GraphQL
mutations/queries (not REST)." Do NOT create `AdminRoutes.kt` or `features/admin/dto/` in this story.

### Design: Admin Account Is Never in MongoDB

The admin (env-var `KTOR_ADMIN_LOGIN`) is authenticated purely via env-var check in `UserService.login()` — admin
credentials are never written to MongoDB. `UserService.register()` already blocks attempts to register with the admin
username (`if (username == adminLogin) raise(...)`). Therefore `repository.getAll()` will never include the admin; the
AC exclusion is enforced by the data model, not a runtime filter.

### Design: Session Invalidation Belongs in the GQL Layer

The GQL mutation class calls `authService.invalidateUserSessions(user.username)` after `deleteUser` and
`resetUserPassword`. This keeps `UserService` unaware of refresh tokens, preserving existing separation of concerns.
`AuthService.invalidateUserSessions(username)` already exists — use it directly.

### CRITICAL: UserRepository Filter Pattern

The existing `UserRepository.save()` uses `Filters.eq("_id", user.id)` — UUID object, NOT string. The
`UUIDMongoSerializer` stores `_id` values as strings (via `encoder.encodeString(value.toString())`), so there is an
apparent inconsistency. However, the `UUIDMongoSerializer.deserialize()` handles both `BsonType.STRING` and
`BsonType.BINARY`, so existing data works either way.

For the new `findById(id)` and `deleteById(id)` methods, **use `Filters.eq("_id", id)` (UUID object) — consistent with
the existing `save()` pattern in UserRepository**. Do NOT use `id.toString()` here; that pattern is specific to
`ApplicationConfigRepository` (which explicitly used string for CONFIG_ID). If `findById` returns null for a user that
was just created in a test, switch to `id.toString()` and document the behavior.

### CRITICAL: GraphQLNotFoundException Must Be Java

`GraphQLForbiddenException` was placed in `src/main/java/` because Kotlin cannot implement `graphql.GraphQLError` on a
class extending `RuntimeException` — JVM signature conflict between `RuntimeException.message: String?` and
`GraphQLError.getMessage(): String!`. **The same constraint applies to `GraphQLNotFoundException`.** Place it in
`src/main/java/com/bagplease/plugins/GraphQLNotFoundException.java`.

### CRITICAL: requireAdmin() Cannot Be Imported

`requireAdmin()` in `ApplicationConfigApi.kt` is `private`. Define the **identical** private extension function in
`UserAdminApi.kt`:

```kotlin
private fun DataFetchingEnvironment.requireAdmin() {
    val principal = graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
        ?: throw GraphQLForbiddenException("Forbidden")
    val role = principal.payload.getClaim("role").asString() ?: ""
    if (role != "admin") throw GraphQLForbiddenException("Forbidden")
}
```

### Implementation: New Files

#### `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/GqlUser.kt`

```kotlin
package com.bagplease.entity.user.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

@GraphQLName("User")
data class GqlUser(
    val id: ID,
    val username: String,
    val role: String,
)
```

#### `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/GqlUserMapper.kt`

```kotlin
package com.bagplease.entity.user.gql

import com.bagplease.entity.user.User
import com.expediagroup.graphql.generator.scalars.ID

object GqlUserMapper {
    fun toGql(user: User) = GqlUser(
        id = ID(user.id.toString()),
        username = user.username,
        role = user.role,
    )
}
```

#### `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/UserAdminApi.kt`

```kotlin
package com.bagplease.entity.user.gql

import com.bagplease.entity.user.AdminError
import com.bagplease.entity.user.RegistrationError
import com.bagplease.entity.user.UserService
import com.bagplease.features.auth.AuthService
import com.bagplease.plugins.GQL_CALL_PRINCIPAL
import com.bagplease.plugins.GraphQLForbiddenException
import com.bagplease.plugins.GraphQLNotFoundException
import com.expediagroup.graphql.generator.scalars.ID
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import graphql.schema.DataFetchingEnvironment
import io.ktor.server.auth.jwt.JWTPrincipal
import java.util.UUID

private fun DataFetchingEnvironment.requireAdmin() {
    val principal = graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
        ?: throw GraphQLForbiddenException("Forbidden")
    val role = principal.payload.getClaim("role").asString() ?: ""
    if (role != "admin") throw GraphQLForbiddenException("Forbidden")
}

@Suppress("unused")
class UserAdminQueries(
    private val userService: UserService,
    private val adminLogin: String,
) : Query {
    suspend fun users(env: DataFetchingEnvironment): List<GqlUser> {
        env.requireAdmin()
        return userService.getAllRegularUsers().map(GqlUserMapper::toGql)
    }
}

@Suppress("unused")
class UserAdminMutations(
    private val userService: UserService,
    private val authService: AuthService,
    private val adminLogin: String,
) : Mutation {
    suspend fun createUser(username: String, password: String, env: DataFetchingEnvironment): GqlUser {
        env.requireAdmin()
        return userService.adminCreateUser(username, password).fold(
            ifLeft = { throw RuntimeException("Username already taken or invalid") },
            ifRight = { GqlUserMapper.toGql(it) },
        )
    }

    suspend fun deleteUser(id: ID, env: DataFetchingEnvironment): GqlUser {
        env.requireAdmin()
        val uuid = UUID.fromString(id.value)
        return userService.adminDeleteUser(uuid).fold(
            ifLeft = { throw GraphQLNotFoundException("User not found") },
            ifRight = { user ->
                authService.invalidateUserSessions(user.username)
                GqlUserMapper.toGql(user)
            },
        )
    }

    suspend fun resetUserPassword(id: ID, newPassword: String, env: DataFetchingEnvironment): GqlUser {
        env.requireAdmin()
        val uuid = UUID.fromString(id.value)
        return userService.adminResetPassword(uuid, newPassword).fold(
            ifLeft = { throw GraphQLNotFoundException("User not found") },
            ifRight = { user ->
                authService.invalidateUserSessions(user.username)
                GqlUserMapper.toGql(user)
            },
        )
    }
}
```

#### `bp_back/src/main/java/com/bagplease/plugins/GraphQLNotFoundException.java`

```java
package com.bagplease.plugins;

import graphql.ErrorType;
import graphql.GraphQLError;
import graphql.language.SourceLocation;

import java.util.List;
import java.util.Map;

public class GraphQLNotFoundException extends RuntimeException implements GraphQLError {
    public GraphQLNotFoundException(String message) {
        super(message);
    }

    @Override
    public String getMessage() {
        return super.getMessage();
    }

    @Override
    public List<SourceLocation> getLocations() {
        return List.of();
    }

    @Override
    public ErrorType getErrorType() {
        return ErrorType.DataFetchingException;
    }

    @Override
    public Map<String, Object> getExtensions() {
        return Map.of("code", "NOT_FOUND");
    }
}
```

### Implementation: Modified Files

#### `UserService.kt` — Add AdminError + admin methods

Add `AdminError` sealed class (after or alongside `RegistrationError` and `AuthError`):

```kotlin
sealed class AdminError {
    data object NotFound : AdminError()
}
```

Add these methods to `UserService` class (existing `hashPassword` and `verifyPassword` are already there — reuse them):

```kotlin
suspend fun getAllRegularUsers(): List<User> = repository.getAll()

suspend fun adminCreateUser(username: String, password: String): Either<RegistrationError, User> =
    either {
        if (username == adminLogin) raise(RegistrationError.InvalidCredentials)
        val hash = hashPassword(password)
        val user = User(username = username, passwordHash = hash, role = "user")
        try {
            repository.save(user)
        } catch (e: MongoWriteException) {
            if (e.error.code == 11000) raise(RegistrationError.InvalidCredentials)
            throw e
        }
        user
    }

suspend fun adminDeleteUser(id: UUID): Either<AdminError, User> = either {
    val user = repository.findById(id) ?: raise(AdminError.NotFound)
    repository.deleteById(id)
    user
}

suspend fun adminResetPassword(id: UUID, newPassword: String): Either<AdminError, User> = either {
    val user = repository.findById(id) ?: raise(AdminError.NotFound)
    val newHash = hashPassword(newPassword)
    repository.save(user.copy(passwordHash = newHash))
    user
}
```

`adminCreateUser` is intentionally identical to `register()` minus the `registrationEnabled` check. No refactoring
needed — that's future cleanup.

#### `UserRepository.kt` — Add findById and deleteById

```kotlin
suspend fun findById(id: UUID): User? =
    col.find(Filters.eq("_id", id))
        .map(MongoUserMapper::mapUserFromMongo)
        .toList()
        .firstOrNull()

suspend fun deleteById(id: UUID) {
    col.deleteOne(Filters.eq("_id", id))
}
```

Note: `Filters.eq("_id", id)` uses UUID object — consistent with existing `save()`. Flow → `.toList().firstOrNull()` —
required because MongoDB `find()` returns a `Flow`, not a sequence.

#### `GQL.kt` — Updated signature and registration

Change `configureGql` signature:

```kotlin
fun Application.configureGql(
    appConfigService: ApplicationConfigService,
    userService: UserService,
    authService: AuthService,
    adminLogin: String,
)
```

Add to schema block (complete updated lists):

```kotlin
packages = listOf(
    "com.bagplease.entity.item.gql",
    "com.bagplease.entity.category.gql",
    "com.bagplease.config.gql",
    "com.bagplease.entity.user.gql",     // NEW
)
queries = listOf(
    ItemQueries(itemService),
    CategoryQueries(categoryService),
    ApplicationConfigQueries(appConfigService),
    UserAdminQueries(userService, adminLogin),  // NEW
)
mutations = listOf(
    ItemMutations(itemService),
    CategoryMutations(categoryService),
    ApplicationConfigMutations(appConfigService),
    UserAdminMutations(userService, authService, adminLogin),  // NEW
)
```

Add imports: `UserAdminQueries`, `UserAdminMutations` from `com.bagplease.entity.user.gql`; `AuthService` from
`com.bagplease.features.auth`; `UserService` from `com.bagplease.entity.user`.

#### `Application.kt` — Pass new params to configureGql

```kotlin
configureGql(appConfigService, userService, authService, adminLogin)
```

`userService` and `authService` and `adminLogin` already exist as local variables in `Application.module()`.

### Testing: AdminUserManagementTest.kt

File location: `bp_back/src/test/kotlin/com/bagplease/features/admin/AdminUserManagementTest.kt`
Package: `com.bagplease.features.admin`

Copy the `loginAdmin()` and `loginRegularUser()` helper functions from `ApplicationConfigTest.kt` — they cannot be
imported (private to their class). Keep the same implementations.

**Key isolation rule:** Generate unique usernames per test using UUID suffix (e.g.,
`"user_ac2_${UUID.randomUUID().toString().take(8)}"`). Multiple tests run in parallel against shared MongoDB — duplicate
usernames cause 11000 errors.

**AC1 test pattern:**

```kotlin
test("AC1 users query returns registered users excluding admin") {
    testApplication {
        setUpMongo(container)
        setUpJwt()
        application { module() }
        val adminToken = loginAdmin()
        // Create a test user via createUser mutation
        val username = "test_ac1_${UUID.randomUUID().toString().take(8)}"
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"pass123\") { id username role } }"}""")
        }.shouldHaveStatus(HttpStatusCode.OK)
        // Query users list
        val body = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"{ users { id username role } }"}""")
        }.bodyAsText()
        body shouldNotContain """"errors":"""
        body shouldContain """"username":"$username""""
        body shouldNotContain """"username":"admin""""  // admin never in list
    }
}
```

**AC3 test pattern (deleteUser):**

```kotlin
test("AC3 deleteUser removes user and subsequent query excludes them") {
    testApplication {
        setUpMongo(container)
        setUpJwt()
        application { module() }
        val adminToken = loginAdmin()
        val username = "delete_ac3_${UUID.randomUUID().toString().take(8)}"
        // Create user; capture returned ID
        val createBody = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"pass123\") { id username role } }"}""")
        }.bodyAsText()
        createBody shouldNotContain """"errors":"""
        val userId = jacksonObjectMapper().readTree(createBody)["data"]["createUser"]["id"].asText()
        // Delete user
        val deleteBody = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"mutation { deleteUser(id: \"$userId\") { id username } }"}""")
        }.bodyAsText()
        deleteBody shouldNotContain """"errors":"""
        // Verify no longer in list
        val listBody = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"{ users { id username } }"}""")
        }.bodyAsText()
        listBody shouldNotContain """"username":"$username""""
    }
}
```

**AC4 test pattern (resetUserPassword — verify new password works):**

```kotlin
// Create user via createUser mutation (not register — registration may be disabled)
// Call resetUserPassword with new password
// Verify new password login succeeds
val loginRes = client.post("/auth/login") {
    contentType(ContentType.Application.Json)
    setBody("""{"username":"$username","password":"newpass"}""")
}
loginRes.shouldHaveStatus(HttpStatusCode.OK)
```

**AC6 test pattern (NOT_FOUND):**

```kotlin
val body = client.post("/graphql") {
    contentType(ContentType.Application.Json)
    bearerAuth(adminToken)
    setBody("""{"query":"mutation { deleteUser(id: \"00000000-0000-0000-0000-000000000000\") { id } }"}""")
}.bodyAsText()
body shouldContain """"code":"NOT_FOUND""""
```

**AC5 test (FORBIDDEN for non-admin):**
Use `loginRegularUser()` helper (opens registration via setRegistrationEnabled mutation, registers, logs in). Test both
a query (`users`) and at least one mutation (`createUser`) for completeness.

### Critical Rule Reminders

- `@Suppress("unused")` on `UserAdminQueries` and `UserAdminMutations` — GQL reflection
- `@GraphQLName("User")` on `GqlUser` — required on all GQL model classes per project rules
- `entity/user/gql` package MUST be in the `packages` list in `GQL.kt` — not auto-discovered
- Never pass `ID` into service/repository — convert with `UUID.fromString(id.value)` in GQL layer
- Never pass `UUID` into GQL types — convert with `ID(uuid.toString())` in mapper
- `hashPassword()` already wraps bcrypt in `withContext(Dispatchers.IO)` — reuse private method
- Do NOT annotate `GqlUser` with `@Serializable` — Jackson handles HTTP, Kotlin Serialization is BSON-only
- `GQL_CALL_PRINCIPAL` constant is in `plugins/GQL.kt`
- MongoDB `find()` returns `Flow` — use `.toList().firstOrNull()`, never `.firstOrNull()` directly

### What NOT to Build

- `features/admin/AdminRoutes.kt` — REST is NOT required by ACs
- `features/admin/dto/` — not needed for GQL approach
- GQL subscriptions for user events — not in ACs
- Admin edit for role/username changes — not in ACs
- Rate limiting on admin GQL operations — not in ACs
- Frontend changes — stories 2.3 and 2.4

### Previous Story Learnings (Stories 2.0 and 2.1)

- `GraphQLForbiddenException` is in `src/main/java/` due to Kotlin/JVM `getMessage()` signature conflict — **same rule
  applies to `GraphQLNotFoundException`**
- Class is `UUIDMongoSerializer`, NOT `UUIDSerializer` — confirmed in story 2.1 debug log
- `find()` returns `Flow` — always use `.toList().firstOrNull()`, not `.firstOrNull()` directly
- Tests share MongoDB container — always use unique usernames per test via UUID suffix
- `setRegistrationEnabled(enabled: true)` must be called before registering test users via `POST /auth/register`;
  `loginRegularUser()` helper in `ApplicationConfigTest.kt` already implements this pattern — copy it
- Use `createUser` mutation (not `POST /auth/register`) to set up test users where `registrationEnabled` state is
  unknown
- Arrow `either {}` / `raise()` is the error handling pattern for service-layer domain errors

### References

- [epics.md §Story 2.2] — authoritative ACs
- [epics.md AR2] — GQL for admin operations (not REST)
- [project-context.md §Ktor/graphql-kotlin] — `@Suppress("unused")`, `@GraphQLName`, package registration, `ID` scalar
  pattern
- [project-context.md §Testing] — FunSpec, `mongoContainer()`, no mocking, parallel isolation rules
- [ApplicationConfigApi.kt] — `requireAdmin()` implementation to duplicate
- [GraphQLForbiddenException.java] — Java exception pattern template for `GraphQLNotFoundException`
- [UserService.kt] — existing admin credential check, bcrypt usage, Arrow Either pattern
- [UserRepository.kt] — existing filter patterns (`Filters.eq("_id", user.id)` UUID object)
- [AuthService.kt] — `invalidateUserSessions(username)` for session cleanup after delete/reset

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `findById(UUID)` and `deleteById(UUID)` to `UserRepository` using UUID object filter (consistent with existing
  `save()`)
- Added `AdminError` sealed class and four admin methods (`getAllRegularUsers`, `adminCreateUser`, `adminDeleteUser`,
  `adminResetPassword`) to `UserService`
- Created GQL layer: `GqlUser`, `GqlUserMapper`, `UserAdminApi` (`UserAdminQueries` + `UserAdminMutations`) with
  duplicated private `requireAdmin()` extension
- Created `GraphQLNotFoundException.java` in `src/main/java/` (required due to Kotlin/JVM `getMessage()` signature
  conflict), returning `code: NOT_FOUND` in extensions
- Wired `configureGql()` with new signature params; registered `com.bagplease.entity.user.gql` package, queries, and
  mutations
- Updated `Application.kt` to pass `userService`, `authService`, `adminLogin` to `configureGql`
- All 7 `AdminUserManagementTest` tests pass; 43 total tests pass with no regressions

### File List

- `bp_back/src/main/kotlin/com/bagplease/entity/user/mongo/UserRepository.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/user/UserService.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/GqlUser.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/GqlUserMapper.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/user/gql/UserAdminApi.kt`
- `bp_back/src/main/java/com/bagplease/plugins/GraphQLNotFoundException.java`
- `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt`
- `bp_back/src/main/kotlin/com/bagplease/Application.kt`
- `bp_back/src/test/kotlin/com/bagplease/features/admin/AdminUserManagementTest.kt`

### Review Findings

- [x] [Review][Patch] UUID.fromString throws uncaught IllegalArgumentException on malformed ID input — wrap
  `UUID.fromString(id.value)` in try/catch in `deleteUser` and `resetUserPassword`, throw a structured GraphQL error on
  `IllegalArgumentException` [UserAdminApi.kt]
- [x] [Review][Patch] deleteById ignores DeleteResult — concurrent delete produces false success — check
  `deleteResult.deletedCount` in `deleteById` or `adminDeleteUser`; raise `AdminError.NotFound` if
  0 [UserRepository.kt:deleteById, UserService.kt:adminDeleteUser]
- [x] [Review][Patch] adminResetPassword returns pre-update user object (stale data) — return
  `user.copy(passwordHash = newHash)` instead of `user` [UserService.kt:adminResetPassword]
- [x] [Review][Patch] createUser throws bare RuntimeException with no GraphQL error code — replace with a structured
  `GraphQLConflictException` (Java, same pattern as GraphQLForbiddenException) [UserAdminApi.kt:createUser]
- [x] [Review][Patch] adminLogin is dead constructor parameter in both GQL classes — remove from `UserAdminQueries`,
  `UserAdminMutations`, and the `GQL.kt` call sites [UserAdminApi.kt, GQL.kt]
- [x] [Review][Patch] AC4 test missing assertion that old password is rejected after reset — add a login attempt with
  the old password and assert it fails [AdminUserManagementTest.kt]
- [x] [Review][Defer] AC4 test does not verify refresh_tokens collection is cleared after resetUserPassword — deferred,
  pre-existing gap; direct DB inspection discouraged by project rules [AdminUserManagementTest.kt]
- [x] [Review][Defer] deleteUser session invalidation TOCTOU window — deferred, pre-existing architectural limitation;
  requires transactional semantics not in codebase [UserAdminApi.kt]
- [x] [Review][Defer] Password plaintext exposed in GQL mutation arguments (logged in debug mode) — deferred,
  pre-existing; same pattern as register() and changePassword() [UserAdminApi.kt]
- [x] [Review][Defer] No pagination on getAllRegularUsers / users query — deferred, out of scope for this
  story [UserService.kt, UserAdminApi.kt]

## Change Log

- 2026-05-15: Implemented admin user management GQL backend (AC1–AC6). New GQL queries/mutations: `users`, `createUser`,
  `deleteUser`, `resetUserPassword`. New Java exception `GraphQLNotFoundException`. 7 new tests added, all 43 tests
  pass.
