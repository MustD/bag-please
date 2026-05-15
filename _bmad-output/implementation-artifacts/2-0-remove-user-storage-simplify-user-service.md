# Story 2.0: Remove UserStorage — Simplify UserService to Direct MongoDB

Status: done

## Story

As a developer,
I want to eliminate the in-memory UserStorage cache layer,
So that the user data path is simpler, the concurrency hazards from the dual-map pattern are gone, and the codebase
is easier to maintain going into Epic 2.

## Acceptance Criteria

1. **AC1 — UserStorage deleted:** `UserStorage.kt` is removed from the codebase; no references to `UserStorage` remain.

2. **AC2 — UserService uses repository directly:** `UserService` takes a `UserRepository` constructor parameter instead
   of `UserStorage`; all user lookups and saves call `UserRepository` methods directly.

3. **AC3 — findByUsername is the primary lookup:** `UserRepository.findByUsername` is used for login, duplicate-check,
   and password-change lookups.

4. **AC4 — MongoDB unique index prevents duplicates:** The unique index on `username` (already created in
   `UserRepository.init {}`) is the sole duplicate-prevention mechanism; `UserService` catches `MongoWriteException`
   with error code 11000 and maps it to `RegistrationError.InvalidCredentials`.

5. **AC5 — Same HTTP 400 response for duplicates:** Registering with a duplicate username still returns HTTP 400 with
   `{"error":"Invalid credentials"}`; the response body is identical to the reserved-admin-username error.

6. **AC6 — All existing tests pass:** The full test suite passes against the simplified `UserService`; no test fails due
   to the removal of in-memory state.

7. **AC7 — No test relies on in-memory map state:** The "storage lazy sync" test in `UserRegistrationTest` is updated to
   reflect that persistence across restarts is now MongoDB-native (the test logic itself still works — it just no longer
   tests in-memory cache sync).

## Tasks / Subtasks

- [x] Task 1: Delete `UserStorage.kt` (AC: 1)
    - [x] Delete `bp_back/src/main/kotlin/com/bagplease/entity/user/UserStorage.kt`

- [x] Task 2: Refactor `UserService.kt` (AC: 2, 3, 4, 5)
    - [x] Change constructor parameter from `private val storage: UserStorage` to
      `private val repository: UserRepository`
    - [x] Remove `registrationMutex` and its `withLock` wrapper — the DB unique index is the concurrency guard
    - [x] In `register()`: remove `storage.findByUsername(username)` null-check; call `repository.save(user)` inside a
      `try/catch` for `MongoWriteException`; check `e.error.code == 11000` and raise
      `RegistrationError.InvalidCredentials`; admin-username check (`username == adminLogin`) stays in place before the
      save attempt
    - [x] In `login()`: replace `storage.findByUsername(username)` with `repository.findByUsername(username)`
    - [x] In `changePassword()`: replace both `storage.findByUsername(username)` and `storage.save(user.copy(...))` with
      `repository.findByUsername(username)` and `repository.save(user.copy(...))`
    - [x] Add `import com.mongodb.MongoWriteException` (package: `com.mongodb`)

- [x] Task 3: Update `Application.kt` (AC: 1, 2)
    - [x] Remove `val userStorage = UserStorage(userRepository)` line
    - [x] Change `UserService(userStorage, adminLogin, adminPass)` to
      `UserService(userRepository, adminLogin, adminPass)`
    - [x] Remove `import com.bagplease.entity.user.UserStorage`

- [x] Task 4: Update `UserRegistrationTest.kt` (AC: 6, 7)
    - [x] Rename test "storage lazy sync — registered user persists across app restart" to "registered user persists
      across app restart (MongoDB persistence)"
    - [x] Update the test comment — remove mention of lazy sync / in-memory map; note that MongoDB is the source of
      truth directly
    - [x] Verify all other tests in the file pass unchanged (no in-memory setup to remove — tests already go through the
      API)

- [x] Task 5: Run tests (AC: 6)
    - [x] From `bp_back/`: `../gradlew test`
    - [x] All tests in `UserRegistrationTest`, `LoginTokenTest`, `AuthApiTest`, `ItemApiTest` must pass

## Dev Notes

### What Exists Today

**`UserStorage.kt`** — a dual-map in-memory cache (`byId: ConcurrentHashMap<UUID, User>`,
`byUsername: ConcurrentHashMap<String, UUID>`) with a lazy-sync-from-MongoDB pattern (`synced` flag + `sync()` call at
the top of every method). It wraps `UserRepository` and was introduced to avoid per-request MongoDB reads.

**`UserService.kt`** — currently takes `UserStorage` as its only data-access dependency. The `registrationMutex` was
added to prevent a TOCTOU race between `findByUsername` and `save` in the in-memory cache. With the cache gone, the
MongoDB unique index makes the mutex unnecessary.

**`UserRepository.kt`** — already has a working `findByUsername` method (was "dead code" while UserStorage was in use).
The `users` collection unique index on `username` is created in `init {}` via `runBlocking`.

### Key Implementation Details

**`MongoWriteException` for duplicate usernames:**

```kotlin
// In UserService.register():
try {
    repository.save(user)
} catch (e: MongoWriteException) {
    if (e.error.code == 11000) raise(RegistrationError.InvalidCredentials)
    throw e  // re-throw unexpected write errors
}
```

Import: `import com.mongodb.MongoWriteException`
Error code 11000 is the MongoDB duplicate key error code.

**Admin-username check stays before save:**
The `if (username == adminLogin) raise(RegistrationError.InvalidCredentials)` check must remain and must run before
`repository.save()`. This is essential: "admin" is not a MongoDB user, so the unique index can't block it — the explicit
check is the only guard.

**`either {}` + `raise()` pattern must be preserved:**
`UserService` uses Arrow `either {}` / `raise()` for error handling throughout. Do not switch to throwing exceptions or
returning `null`. The `MongoWriteException` catch must happen inside the `either {}` block.

**`registrationMutex` removal is safe:**
The mutex's only job was to close the TOCTOU window between `findByUsername` and `save` in the in-memory map. With
`UserRepository.save()` doing an upsert via MongoDB, the unique index enforces uniqueness atomically at the DB level.
The mutex adds zero safety on top of that.

**`repository.save()` is an upsert:**
`UserRepository.save()` uses `updateOne(..., UpdateOptions().upsert(true))`. For `register()`, the `user` is a freshly
constructed `User(id = UUID.randomUUID(), ...)`, so the upsert always inserts. For `changePassword()`, it updates an
existing document. Both cases are correct.

**`changePassword()` — no `getAll()` needed:**
`changePassword` currently calls `storage.findByUsername(username)` which reads from the in-memory map (already synced).
Replacing with `repository.findByUsername(username)` is a direct MongoDB read — semantically identical, one round trip.

### Test Update Guidance

**"storage lazy sync" test (`UserRegistrationTest`):**
This test registers a user in one `testApplication` block, then spins up a *second* `testApplication` pointing at the
same Mongo container and verifies the second instance rejects the duplicate. The test **still works after this story** —
it now tests that MongoDB persists across app restarts (which it always did). Update the name and remove the
in-memory-sync comment:

```kotlin
test("registered user persists across app restart (MongoDB persistence)") {
    // Registers in one app instance, verifies second instance sees the user via MongoDB
    ...
}
```

**No other test changes needed:** `LoginTokenTest`, `AuthApiTest`, and `ItemApiTest` all interact with the user layer
through the API (`/auth/register`, `/auth/login`, etc.). They do not reference `UserStorage` directly. They will pass
unchanged.

### Files Being Modified

| File                                                                          | Action | Notes                        |
|-------------------------------------------------------------------------------|--------|------------------------------|
| `bp_back/src/main/kotlin/com/bagplease/entity/user/UserStorage.kt`            | DELETE | Entire file removed          |
| `bp_back/src/main/kotlin/com/bagplease/entity/user/UserService.kt`            | UPDATE | See task 2                   |
| `bp_back/src/main/kotlin/com/bagplease/Application.kt`                        | UPDATE | See task 3                   |
| `bp_back/src/test/kotlin/com/bagplease/features/auth/UserRegistrationTest.kt` | UPDATE | Rename + update comment only |

### Architecture Compliance Reminders

- **`@Suppress("RedundantSuspendModifier")`** — `UserRepository` methods are `suspend`; `UserService` already uses
  `suspend` correctly; no change needed here
- **`UserRepository.findByUsername` filter** — uses `Filters.eq(MongoUser::username.name, username)` (string field
  name); correct as-is
- **MongoDB `_id` filter in `save()`** — uses `Filters.eq("_id", user.id)` (string `_id`); this is correct per project
  rules (UUID objects in filters return zero results)
- **`@Serializable` for MongoDB models** — already in place; no changes to Mongo layer
- **Do not create a `UserStorage`-like cache for `ApplicationConfig`** — Epic 2 architecture decision:
  `ApplicationConfig` reads direct from MongoDB with no cache (see AR4 in epics.md); this story sets the precedent

## File List

- `bp_back/src/main/kotlin/com/bagplease/entity/user/UserStorage.kt` — DELETED
- `bp_back/src/main/kotlin/com/bagplease/entity/user/UserService.kt` — UPDATED
- `bp_back/src/main/kotlin/com/bagplease/Application.kt` — UPDATED
- `bp_back/src/test/kotlin/com/bagplease/features/auth/UserRegistrationTest.kt` — UPDATED

## Change Log

- 2026-05-14: Removed `UserStorage.kt`; refactored `UserService` to use `UserRepository` directly with
  `MongoWriteException` duplicate detection; removed `registrationMutex`; updated `Application.kt` wiring; renamed
  persistence test.

## Dev Agent Record

### Completion Notes

All 5 tasks completed and all tests pass (BUILD SUCCESSFUL). `UserStorage.kt` deleted; `UserService` now takes
`UserRepository` directly, removes mutex, catches `MongoWriteException` code 11000 for duplicate detection.
`repository.save()` returns `Unit` so `user` is returned explicitly after the try/catch. All AC satisfied — existing
test suite passes unchanged.

### Review Findings

- [x] [Review][Defer] `adminPass` plaintext string comparison enables timing oracle in `login()` [UserService.kt:44] —
  deferred, pre-existing
