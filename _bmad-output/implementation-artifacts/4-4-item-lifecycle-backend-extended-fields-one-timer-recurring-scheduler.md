# Story 4.4: Item Lifecycle Backend — Extended Fields, One-Timer & Recurring Scheduler

Status: ready-for-dev

## Story

As a list member,
I want items to carry a store, lifecycle designation, and authorship,
so that one-timers clean themselves up automatically, recurring items reappear at the right cadence, and everyone can see who added what.

## Acceptance Criteria

**AC1 — New Item fields persisted and returned:**
Given `Item.kt` is updated with new fields: `store: String?`, `recurring: Recurring?`, `addedBy: String?`, `deleted: Boolean = false`, `deletedAt: Instant?`, `checkedAt: Instant?`,
When `saveItem` is called with or without these fields,
Then all fields are persisted to MongoDB and returned in GQL responses,
And `addedBy` is populated from `principal.username` in the GQL resolver — it is NOT part of `GqlItemInput`; clients cannot supply or override it,
And items without `addedBy` (migration items, pre-Epic-4 items) return `addedBy: null`.

**AC2 — `store` round-trip:**
Given `saveItem` is called with `store: "Pharmacy"` in `GqlItemInput`,
When the item is saved,
Then the `store` field is persisted and returned on subsequent `getItems(listId)` queries.

**AC3 — `recurring` round-trip:**
Given `saveItem` is called with `recurring: "WEEKLY"` (String) in `GqlItemInput`,
When the item is saved,
Then `item.recurring = Recurring.WEEKLY` is persisted to MongoDB as the string `"WEEKLY"`,
And `recurring` is exposed in the GQL schema as a String (not a GQL enum) for forward compatibility.

**AC4 — Regular item check-off:**
Given a list member calls `checkItem(id: ID!, listId: ID!)` on a regular item (`recurring: null`),
When the mutation resolves,
Then `item.checked = true` is persisted and the item remains in the list.

**AC5 — Recurring item check-off:**
Given a list member calls `checkItem` on a recurring item (`recurring: WEEKLY`, `BIWEEKLY`, or `MONTHLY`),
When the mutation resolves,
Then `item.checked = true` and `item.checkedAt = now()` are persisted,
And the item remains visible — no deletion, no scheduling performed at check-off time.

**AC6 — One-timer check-off soft-delete:**
Given a list member calls `checkItem` on a one-timer item (`recurring: ONE_TIME`),
When the mutation resolves,
Then `item.deleted = true` and `item.deletedAt = now()` are persisted (soft-delete),
And the item is excluded from all subsequent `getItems(listId)` query results,
And the GQL response returns the item with `deleted: true` so the frontend can start the 5-second undo window.

**AC7 — Undo (uncheckItem) on soft-deleted one-timer:**
Given a list member calls `uncheckItem(id: ID!, listId: ID!)` on a soft-deleted one-timer (within the undo window),
When the mutation resolves,
Then `item.deleted = false` and `item.deletedAt = null` are cleared,
And the item reappears in `getItems(listId)` query results.

**AC8 — Soft-deleted items invisible:**
Given `getItems(listId)` is queried,
When the query resolves,
Then items with `deleted: true` are always filtered out — soft-deleted items are invisible to all GQL queries.

**AC9 — Recurring restore scheduler:**
Given the hourly background scheduler runs,
When it processes recurring items,
Then it queries for items where `checked = true` AND `recurring` is not null and not `ONE_TIME` AND the cadence has elapsed since `checkedAt` (WEEKLY = 7 days, BIWEEKLY = 14 days, MONTHLY = 30 days),
And for each matched item it sets `checked = false` and clears `checkedAt`,
And each item is restored exactly once per run regardless of how many cadence cycles have been missed.

**AC10 — One-timer hard-delete scheduler:**
Given the hourly background scheduler runs,
When it processes soft-deleted one-timers,
Then it queries items where `deleted = true` AND `deletedAt` is older than 1 hour,
And for each matched item it permanently hard-deletes the document from MongoDB and evicts it from `ItemStorage`.

**AC11 — Scheduler no-op on clean database:**
Given the scheduler runs against a clean database (nothing to restore, nothing to hard-delete),
When it completes,
Then it performs zero writes and completes without error.

**AC12 — Scheduler registration:**
Given the application starts,
When `Application.module()` initialises,
Then the hourly scheduler is registered and fires immediately on start, then every 60 minutes,
And a missed run due to app restart self-heals on the next tick — no external state tracking required.

**AC13 — Store suggestions query:**
Given `itemStoreSuggestions(listId: ID!)` is called by a list member,
When the query resolves,
Then it returns a distinct list of non-null `store` values from all items in that list,
And `verifyMembership()` is called first; non-member caller receives a GQL error.

**AC14 — Compound indexes:**
Given the application starts,
When `ItemRepository.init {}` completes,
Then both compound indexes exist in MongoDB: `{listId, recurring, checkedAt}` and `{deleted, deletedAt}`.

## Tasks / Subtasks

- [ ] **Task 1: Create `Recurring` enum** (AC: 3, 6, 9, 10)
  - [ ] Create `entity/item/Recurring.kt`: `enum class Recurring { ONE_TIME, WEEKLY, BIWEEKLY, MONTHLY }`

- [ ] **Task 2: Update `Item.kt` domain model** (AC: 1–8)
  - [ ] Add fields: `store: String? = null`, `recurring: Recurring? = null`, `addedBy: String? = null`, `deleted: Boolean = false`, `deletedAt: Instant? = null`, `checkedAt: Instant? = null`
  - [ ] Add `import java.time.Instant`

- [ ] **Task 3: Update MongoDB layer** (AC: 1–3, 9, 10, 14)
  - [ ] Update `MongoItem.kt` — add all new fields as nullable with defaults (existing docs in MongoDB will be missing them): `val store: String? = null`, `val recurring: String? = null`, `val addedBy: String? = null`, `val deleted: Boolean = false`, `val deletedAt: Instant? = null`, `val checkedAt: Instant? = null`; use `@Serializable(with = InstantBsonSerializer::class)` for both `Instant?` fields
  - [ ] Update `MongoItemMapper.kt` — map all new fields bidirectionally in `mapItemToMongo()` and `mapItemFromMongo()`: `recurring` maps to `item.recurring?.name` (to String) and `MongoItem.recurring?.let { Recurring.valueOf(it) }` (from String)
  - [ ] Update `ItemRepository.save()` — add to `Updates.combine()`: `Updates.set("store", item.store)`, `Updates.set("recurring", item.recurring?.name)`, `Updates.set("addedBy", item.addedBy)`, `Updates.set("deleted", item.deleted)`, `Updates.set("deletedAt", item.deletedAt)`, `Updates.set("checkedAt", item.checkedAt)` (null values are fine with `$set` — they set field to null)
  - [ ] Update `ItemRepository.init {}` — add compound indexes:
    - `Indexes.ascending("listId", "recurring", "checkedAt")` (existing `{listId, _id}` index remains)
    - `Indexes.ascending("deleted", "deletedAt")`
  - [ ] Add `ItemRepository.findCheckedRecurringItems(): List<Item>` — query: `Filters.and(Filters.eq("checked", true), Filters.in("recurring", listOf("WEEKLY", "BIWEEKLY", "MONTHLY")))` — returns all checked recurring items; scheduler filters by cadence in-memory
  - [ ] Add `ItemRepository.findSoftDeletedToHardDelete(): List<Item>` — query: `Filters.and(Filters.eq("deleted", true), Filters.lt("deletedAt", Instant.now().minus(1, ChronoUnit.HOURS)))` — returns items to permanently delete

- [ ] **Task 4: Update `ItemStorage`** (AC: 6, 7, 8)
  - [ ] Update `getByListId()`: filter `!item.deleted` — soft-deleted items are invisible to queries: `return storage[listId]?.values?.filter { !it.deleted }?.toList() ?: emptyList()`
  - [ ] Add `fun getByIdCached(id: UUID, listId: UUID): Item?` — raw lookup including soft-deleted items: `return storage[listId]?.get(id)` (no sync call — caller must ensure sync via prior `getByListId` or explicit `sync()` call)

- [ ] **Task 5: Update `ItemService`** (AC: 4–10, 13)
  - [ ] Add `private val repository: ItemRepository` to constructor (for scheduler queries)
  - [ ] Add `checkItem(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Item>`:
    1. `listService.verifyMembership(caller, listId).bind()`
    2. `sync()` via `storage.getByListId(listId)` or direct `storage.sync()`; get item: `val item = storage.getByIdCached(id, listId) ?: throw IllegalStateException("Item not found")`
    3. Branch on `item.recurring`:
       - `ONE_TIME` → `val updated = item.copy(checked = true, deleted = true, deletedAt = Instant.now())`; emit via `itemUpdateChannel`; return `storage.save(updated)` — NOTE: emits `SAVED` type with `deleted=true`, not `DELETED` — frontend detects soft-delete by `deleted=true`
       - `WEEKLY/BIWEEKLY/MONTHLY` → `item.copy(checked = true, checkedAt = Instant.now())`; `storage.save(updated)`; emit update
       - `null` → `item.copy(checked = true)`; `storage.save(updated)`; emit update
    4. Return updated item
  - [ ] Add `uncheckItem(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Item>`:
    1. `listService.verifyMembership(caller, listId).bind()`
    2. Ensure storage is synced: call `storage.getByListId(listId)` first to guarantee sync
    3. `val item = storage.getByIdCached(id, listId) ?: throw IllegalStateException("Item not found")`
    4. `val restored = item.copy(checked = false, deleted = false, deletedAt = null, checkedAt = null)`
    5. `storage.save(restored)` + `itemUpdateChannel.emit(restored)`
    6. Return restored
  - [ ] Add `getStoreSuggestions(listId: UUID, caller: CallerUsername): Either<ListAuthError, List<String>>`:
    1. `listService.verifyMembership(caller, listId).bind()`
    2. `return storage.getByListId(listId).mapNotNull { it.store }.distinct()`
  - [ ] Add `suspend fun runSchedulerCycle()`:
    1. **Recurring restore:** `val candidates = repository.findCheckedRecurringItems()`; for each, check cadence: `WEEKLY = 7 days`, `BIWEEKLY = 14 days`, `MONTHLY = 30 days`; filter: `item.checkedAt != null && item.checkedAt.isBefore(Instant.now().minus(days, ChronoUnit.DAYS))`; for each to restore: `val restored = item.copy(checked = false, checkedAt = null)`; `storage.save(restored)`; `itemUpdateChannel.emit(restored)`
    2. **Hard-delete:** `val toDelete = repository.findSoftDeletedToHardDelete()`; for each: `storage.delete(item.id, item.listId)` (removes from in-memory + MongoDB) + `itemDeleteChannel.emit(item)`

- [ ] **Task 6: Create `GqlItemInput`** (AC: 1–3)
  - [ ] Create `entity/item/gql/GqlItemInput.kt`:
    ```kotlin
    @GraphQLName("ItemInput")
    data class GqlItemInput(
        val id: ID,
        val name: String,
        val checked: Boolean,
        val category: String,
        val listId: ID,
        val store: String? = null,
        val recurring: String? = null,
    )
    ```
    Note: `addedBy` is intentionally absent — server-set only.

- [ ] **Task 7: Update `GqlItem` output type** (AC: 1–3)
  - [ ] Add to `GqlItem.kt`: `val store: String? = null`, `val recurring: String? = null`, `val addedBy: String? = null`

- [ ] **Task 8: Update `GqlItemMapper`** (AC: 1–3)
  - [ ] Update `mapItemToGql()`: add `store = item.store`, `recurring = item.recurring?.name`, `addedBy = item.addedBy`
  - [ ] Add `mapItemFromInput(input: GqlItemInput, addedBy: String?): Item`:
    ```kotlin
    Item(
        id = UUID.fromString(input.id.toString()),
        name = input.name,
        checked = input.checked,
        category = UUID.fromString(input.category),
        listId = UUID.fromString(input.listId.toString()),
        store = input.store,
        recurring = input.recurring?.let { runCatching { Recurring.valueOf(it) }.getOrElse { throw IllegalArgumentException("Invalid recurring value: $it. Valid: ONE_TIME, WEEKLY, BIWEEKLY, MONTHLY") } },
        addedBy = addedBy,
    )
    ```
  - [ ] Keep `mapItemFromGql()` for backward compat or remove if unused after this story (it was only used by `saveItem`)

- [ ] **Task 9: Update `ItemApi.kt`** (AC: 1–8, 13)
  - [ ] Change `saveItem` signature: `suspend fun saveItem(item: GqlItemInput, env: DataFetchingEnvironment): GqlItem`; populate `addedBy` from caller: `val caller = env.caller()`; call `service.saveItem(GqlItemMapper.mapItemFromInput(item, caller.value), caller)`
  - [ ] Add to `ItemMutations`:
    ```kotlin
    suspend fun checkItem(id: ID, listId: ID, env: DataFetchingEnvironment): GqlItem {
        val caller = env.caller()
        return service.checkItem(UUID.fromString(id.value), UUID.fromString(listId.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { GqlItemMapper.mapItemToGql(it) },
        )
    }
    
    suspend fun uncheckItem(id: ID, listId: ID, env: DataFetchingEnvironment): GqlItem {
        val caller = env.caller()
        return service.uncheckItem(UUID.fromString(id.value), UUID.fromString(listId.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { GqlItemMapper.mapItemToGql(it) },
        )
    }
    ```
  - [ ] Add to `ItemQueries`:
    ```kotlin
    suspend fun itemStoreSuggestions(listId: ID, env: DataFetchingEnvironment): List<String> {
        val caller = env.caller()
        return service.getStoreSuggestions(UUID.fromString(listId.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { it },
        )
    }
    ```

- [ ] **Task 10: Create `plugins/Scheduler.kt`** (AC: 9, 10, 11, 12)
  - [ ] Create file with `configureScheduler(itemService: ItemService)` function:
    ```kotlin
    fun Application.configureScheduler(itemService: ItemService) {
        launch {
            while (true) {
                try {
                    itemService.runSchedulerCycle()
                } catch (e: Exception) {
                    // log exception but keep scheduler alive
                    application.log.error("Scheduler cycle failed", e)
                }
                delay(1.hours)
            }
        }
    }
    ```
    Import: `import kotlin.time.Duration.Companion.hours`

- [ ] **Task 11: Update `plugins/GQL.kt`** (AC: 12)
  - [ ] Pass `itemRepository` to `ItemService` constructor: `val itemService = ItemService(itemStorage, listService, itemRepository)`
  - [ ] Call `configureScheduler(itemService)` after creating `itemService` (before `install(GraphQL)`): `configureScheduler(itemService)`

- [ ] **Task 12: Write backend tests** (AC: all)
  - [ ] Create `bp_back/src/test/kotlin/com/bagplease/ItemLifecycleTest.kt` (FunSpec + Testcontainers):
    - `addedBy` server-side: `saveItem` with no `addedBy` in input → response has `addedBy` = caller's username
    - `store` round-trip: `saveItem` with `store: "Pharmacy"` → `getItems` returns `store: "Pharmacy"`
    - `recurring` round-trip: each enum value (`WEEKLY`, `BIWEEKLY`, `MONTHLY`, `ONE_TIME`) persisted as string; `null` returns `recurring: null`
    - Regular item check-off: `checkItem` on `recurring: null` item → `checked: true`, item in `getItems`
    - Recurring check-off: `checkItem` on `recurring: WEEKLY` → `checked: true`, `checkedAt` set, item still in `getItems`
    - ONE_TIME soft-delete: `checkItem` on `recurring: ONE_TIME` → response has `deleted: true`; item absent from `getItems`
    - Undo restore: `uncheckItem` on soft-deleted item → `deleted: false`, `deletedAt: null`, item reappears in `getItems`
    - Scheduler — recurring restore: use `runSchedulerCycle()` directly; seed WEEKLY item with `checked: true`, `checkedAt: 8 days ago` via direct MongoDB update; run cycle; assert `checked: false`, `checkedAt: null`
    - Scheduler — no double-restore: run scheduler twice; item restored exactly once (second run: `checkedAt` is null, so not picked up again)
    - Scheduler — hard-delete: seed soft-deleted ONE_TIME with `deletedAt: 2 hours ago`; run cycle; assert item absent from MongoDB and from `getItems`
    - Scheduler — no-op: clean DB; run cycle; assert zero writes (via `getItems` returning same data)
    - `itemStoreSuggestions`: returns distinct non-null store values; non-member caller → GQL error
    - Compound index existence: assert both indexes exist after app start

- [ ] **Task 13: Build verification**
  - [ ] `cd bp_back && ../gradlew build -x test` — clean build
  - [ ] `cd bp_back && ../gradlew test` — all tests pass (currently ~70; new tests add to count)
  - [ ] `cd bp_front && npx tsc --noEmit` — no TypeScript errors (no frontend changes in this story)

## Dev Notes

### Current State — Files Being Modified

**`entity/item/Item.kt` (CURRENT — read before coding):**
```kotlin
data class Item(
    val id: UUID = UUID.randomUUID(),
    val name: String = "",
    val checked: Boolean = false,
    val category: UUID,
    val listId: UUID,
)
```
Add 6 new fields. All nullable with defaults — existing item usages that don't specify them will compile fine.

**`entity/item/mongo/MongoItem.kt` (CURRENT):**
```kotlin
@Serializable
data class MongoItem(
    @SerialName("_id") @Serializable(with = UUIDSerializer::class) val id: UUID,
    val name: String,
    val checked: Boolean,
    @Serializable(with = UUIDSerializer::class) val category: UUID = UUID(0, 0),
    @Serializable(with = UUIDSerializer::class) val listId: UUID? = null,
)
```
Add all new fields as nullable with defaults. `Instant?` fields use `@Serializable(with = InstantBsonSerializer::class)`. Existing docs in MongoDB won't have these fields — defaults ensure deserialization works.

**`entity/item/mongo/ItemRepository.kt` (CURRENT):**
`save()` uses `Updates.combine()`. Add all new fields to this combine call. MongoDB `$set` with null value sets field to null — this is correct for clearing `deletedAt`/`checkedAt`.

Two existing indexes: `{listId, _id}`. Add two more in `init {}`.

`repository.delete(id)` is the hard-delete. Used by `storage.delete()` and called indirectly by scheduler via `storage.delete()`.

**`entity/item/ItemStorage.kt` (CURRENT):**
```kotlin
class ItemStorage(private val repository: ItemRepository) {
    private val storage: ConcurrentHashMap<UUID, ConcurrentHashMap<UUID, Item>> = ConcurrentHashMap()
    private var synced = false

    suspend fun getByListId(listId: UUID): List<Item> {
        sync()
        return storage[listId]?.values?.toList() ?: emptyList()
    }
    
    fun evictList(listId: UUID) {
        storage.remove(listId)  // does NOT reset synced
    }
}
```
`getByListId()` needs to filter `!item.deleted`. Soft-deleted items stay in memory for `uncheckItem` but are invisible to queries.

`getByIdCached(id, listId)` bypasses sync. This is safe for `checkItem`/`uncheckItem` because `verifyMembership()` in the service triggers storage sync (it calls `listStorage.getById` which syncs list storage; item storage sync is triggered by `getByListId` in same request context). To be safe: call `sync()` explicitly in `getByIdCached`, or ensure caller has synced first. **SAFER**: call `sync()` inside `getByIdCached` since it's idempotent.

**`entity/item/ItemService.kt` (CURRENT):**
```kotlin
class ItemService(
    private val storage: ItemStorage,
    private val listService: ListService,
) {
    private val itemUpdateChannel = MutableSharedFlow<Item>(onBufferOverflow = BufferOverflow.DROP_OLDEST, extraBufferCapacity = 1)
    private val itemDeleteChannel = MutableSharedFlow<Item>(onBufferOverflow = BufferOverflow.DROP_OLDEST, extraBufferCapacity = 1)
    val itemUpdates = itemUpdateChannel as SharedFlow<Item>
    val itemDeletions = itemDeleteChannel as SharedFlow<Item>
}
```
Add `private val repository: ItemRepository` as 3rd constructor param. `GQL.kt` already has `itemRepository` in scope — just pass it.

**`entity/item/gql/ItemApi.kt` (CURRENT):**
- `saveItem(item: GqlItem, ...)` — change to `saveItem(item: GqlItemInput, ...)`
- `GqlItemMapper.mapItemFromGql(item)` in the resolver — replace with `GqlItemMapper.mapItemFromInput(item, caller.value)`

**`plugins/GQL.kt` (CURRENT):**
```kotlin
val itemService = ItemService(itemStorage, listService)
```
Change to `ItemService(itemStorage, listService, itemRepository)`. Then call `configureScheduler(itemService)` immediately after.

### Critical: Subscription Event Types for Lifecycle

When `checkItem` soft-deletes a ONE_TIME item, emit on `itemUpdateChannel` (type `SAVED` with `deleted=true`) — NOT on `itemDeleteChannel`. This tells the frontend the item changed state, not that it was permanently deleted. The frontend checks `item.deleted === true` to start the undo window.

When the scheduler hard-deletes an item, emit on `itemDeleteChannel` (type `DELETED`) — permanent removal.

This distinction matters for Story 4.7 frontend implementation.

### `Recurring` Enum — ONE_TIME Is Included

Per story 4.4 Technical Notes: `enum class Recurring { ONE_TIME, WEEKLY, BIWEEKLY, MONTHLY }`.
- `null` = regular item (no lifecycle behavior)
- `ONE_TIME` = soft-delete on check-off
- `WEEKLY`/`BIWEEKLY`/`MONTHLY` = recurring restore

Architecture.md has a minor inconsistency (shows enum without ONE_TIME) — the **story spec takes precedence**.

GQL schema exposes `recurring` as `String?` (not a GQL enum) — graphql-kotlin serializes Kotlin enums as strings by default. Mongo stores enum name as string (via `item.recurring?.name`).

### `addedBy` — Username String, Not UUID

`addedBy: String?` stores the caller's username (e.g. "alice"), populated from `CallerUsername.value` in the GQL resolver. Architecture.md says `UUID?` — the **story AC takes precedence** (FR45 says "display the username of the user who added it" — storing username directly avoids a join).

### `GqlItemInput` vs `GqlItem` Schema Impact

`saveItem` currently takes `item: GqlItem` (output type used as input — technically works in graphql-kotlin). After this story it takes `item: GqlItemInput`. The GraphQL schema type for the mutation arg changes from `Item` to `ItemInput`. Existing test calls use raw JSON field names and are unaffected by the type name change. No frontend code exists yet for items in Epic 4 (`app/store/` is deleted in Story 4.5).

### Scheduler Coroutine Scope

`Application` implements `CoroutineScope`. `launch {}` in `configureScheduler()` starts a coroutine tied to the application's lifecycle — it is automatically cancelled when the application stops. No manual coroutine management needed.

### Scheduler Instance Sharing

The scheduler must use the **same `ItemService` instance** as the GQL resolvers (they share `ItemStorage` in-memory state). This is achieved by calling `configureScheduler(itemService)` from within `configureGql()` after `itemService` is created — the scheduler receives the same instance.

Do NOT instantiate a separate `ItemService` or `ItemStorage` in `Scheduler.kt`.

### `findCheckedRecurringItems` Cadence Filtering

Query returns ALL checked recurring items. Cadence filtering happens in-memory in `runSchedulerCycle()`:
```kotlin
val elapsedDays = when (item.recurring) {
    Recurring.WEEKLY -> 7L
    Recurring.BIWEEKLY -> 14L
    Recurring.MONTHLY -> 30L
    else -> return@forEach  // skip ONE_TIME or null (shouldn't be in query result)
}
val threshold = Instant.now().minus(elapsedDays, ChronoUnit.DAYS)
if (item.checkedAt == null || item.checkedAt.isAfter(threshold)) return@forEach
// restore this item
```

At current scale (small user base), querying all checked recurring items and filtering in memory is fine.

### `findSoftDeletedToHardDelete` Filter

```kotlin
val oneHourAgo = Instant.now().minus(1, ChronoUnit.HOURS)
Filters.and(Filters.eq("deleted", true), Filters.lt("deletedAt", oneHourAgo))
```

For `Filters.lt` with `Instant`: the MongoDB driver works with `BsonDateTime` for Instant comparisons. Use `deletedAt.toEpochMilli()` or pass the Instant directly — the MongoDB Kotlin coroutine driver handles `Instant` → `BsonDateTime` conversion automatically when using typed collections with kotlinx-serialization.

### Test Seeding for Scheduler Tests

To test scheduler behavior with specific `checkedAt`/`deletedAt` values (e.g., "8 days ago"), direct MongoDB writes are needed. Use the pattern from `MigrationTest.kt` — obtain a direct MongoDB client via Testcontainers and write documents directly. This is acceptable per testing rules since it's setting up state that the API cannot create (the API always sets `checkedAt = now()`).

To expose `runSchedulerCycle()` for testing: access `ItemService` via the application's dependency. But since `ItemService` is not in the DI container, you need to call the scheduler via the GQL API or expose a test endpoint. **Simpler**: Use a small helper in the test that directly calls `ItemRepository` to seed the data, then trigger scheduler via a test-only GQL mutation OR just call `itemService.runSchedulerCycle()` directly.

**Recommended approach for tests**: Call `runSchedulerCycle()` directly from the test by obtaining the `ItemService` instance from the application. This requires reflection or a test-only route. **Simpler still**: Expose a test helper method or use a test application config that shortens the scheduler delay so it runs during the test. **Most pragmatic**: Write the scheduler logic in `ItemService.runSchedulerCycle()`, and test it via the GQL API:
1. Seed data via saveItem (then update `checkedAt`/`deletedAt` directly in MongoDB via Testcontainers client)
2. Call `itemService.runSchedulerCycle()` (make it `internal` not `private`) — access via `testApplication { application { module() } }` is tricky
3. **Best approach**: Make `runSchedulerCycle()` `internal` and call it via a test extension in the same package — see `MigrationTest.kt` for the pattern of calling internal application functions

Actually: Look at how `MigrationTest.kt` tests migration. Replicate that approach.

### Existing Test Compatibility

`ItemApiTest.kt` tests call `saveItem(item: { id, name, checked, category, listId })` — these fields exist in `GqlItemInput` unchanged. Tests will continue to compile and pass. The new optional fields (`store`, `recurring`) are omitted, which is valid for nullable fields.

The GQL query `getItems(listId)` currently returns `{ id name checked category listId }`. After this story, the response also includes `store`, `recurring`, `addedBy` but those aren't asserted in existing tests — no breakage.

### File Locations (Summary)

| File | Action | Notes |
|------|--------|-------|
| `entity/item/Recurring.kt` | NEW | `enum class Recurring { ONE_TIME, WEEKLY, BIWEEKLY, MONTHLY }` |
| `entity/item/Item.kt` | UPDATE | +6 new fields |
| `entity/item/mongo/MongoItem.kt` | UPDATE | +6 new nullable fields with defaults |
| `entity/item/mongo/MongoItemMapper.kt` | UPDATE | Map all new fields |
| `entity/item/mongo/ItemRepository.kt` | UPDATE | +2 indexes, +2 query methods, `save()` updated |
| `entity/item/ItemStorage.kt` | UPDATE | `getByListId()` filters deleted, add `getByIdCached()` |
| `entity/item/ItemService.kt` | UPDATE | +`repository` param, +`checkItem`, `uncheckItem`, `getStoreSuggestions`, `runSchedulerCycle` |
| `entity/item/gql/GqlItemInput.kt` | NEW | Input type for `saveItem` mutation |
| `entity/item/gql/GqlItem.kt` | UPDATE | +`store`, `recurring`, `addedBy` |
| `entity/item/gql/GqlItemMapper.kt` | UPDATE | `mapItemToGql` updated, `mapItemFromInput` added |
| `entity/item/gql/ItemApi.kt` | UPDATE | `saveItem` uses `GqlItemInput`+`addedBy`, +`checkItem`, `uncheckItem` mutations, +`itemStoreSuggestions` query |
| `plugins/Scheduler.kt` | NEW | `configureScheduler(itemService)` |
| `plugins/GQL.kt` | UPDATE | `ItemService(itemStorage, listService, itemRepository)`, call `configureScheduler(itemService)` |
| `test/.../ItemLifecycleTest.kt` | NEW | All lifecycle + scheduler tests |

### Unhappy-Path & Concurrency Checklist

Before marking this story complete, the dev agent must verify and explicitly check each item:

- [ ] **Mutation errors surface to the user** — `checkItem`/`uncheckItem`/`getStoreSuggestions` return GQL errors for non-members; no silent failures
- [ ] **Dialog does not close on error** — N/A (backend-only story)
- [ ] **Cancel remains interactive during in-flight requests** — N/A (backend-only)
- [ ] **Client-side input validation** — N/A (backend-only); server validates `recurring` string → enum and throws `IllegalArgumentException` if invalid value
- [ ] **Concurrent write safety** — `checkItem` → `save()` in storage uses `ConcurrentHashMap`; soft-delete race (double-check same item) is idempotent (`deleted=true` + `deletedAt=now` on both). Scheduler vs user `uncheckItem` race: if scheduler hard-deletes while undo is in-flight, `uncheckItem` finds null from `getByIdCached` → throws `IllegalStateException("Item not found")` which surfaces as GQL error — acceptable behavior at this scale.
- [ ] **Loading state prevents double-submit** — N/A (backend-only)

Additional story-specific checks:
- [ ] **`deleted=true` items never appear in `getItems`** — filter in `ItemStorage.getByListId()` covers both query and in-memory layer; MongoDB query via `findAll()` in storage sync will still load them into memory (intentional — needed for `uncheckItem`)
- [ ] **Scheduler does not crash application on error** — try/catch in `configureScheduler()` wraps `runSchedulerCycle()` to keep scheduler alive
- [ ] **`addedBy` always comes from `principal.username`** — `GqlItemInput` has no `addedBy` field; `mapItemFromInput` takes `addedBy` as a separate parameter from the caller; cannot be smuggled in from client
- [ ] **Both compound indexes created before first scheduler run** — `ItemRepository.init {}` is `runBlocking`, completes before app serves any request; scheduler fires immediately at startup but after all plugins are initialized

### References

- [epics.md §Story 4.4] — Full AC list and Technical Notes (authoritative for enum values)
- [project-context.md §Ktor/graphql-kotlin] — `@GraphQLName`, `@Suppress("unused")`, mapper patterns, SharedFlow pattern
- [project-context.md §Testing] — FunSpec only, no mocks, Testcontainers, UUID-based assertions, HTTP 200 ≠ GQL success
- [entity/item/Item.kt] — current domain model (5 fields)
- [entity/item/mongo/MongoItem.kt] — `UUIDSerializer` pattern, `@SerialName("_id")`
- [entity/item/mongo/MongoItemMapper.kt] — current mapper (mapItemFromMongo skips docs with null listId)
- [entity/item/mongo/ItemRepository.kt] — `Updates.combine()` upsert pattern, existing `{listId, _id}` index
- [entity/item/ItemStorage.kt] — nested ConcurrentHashMap, `evictList`, lazy sync
- [entity/item/ItemService.kt] — SharedFlow pattern, `itemUpdateChannel` vs `itemDeleteChannel`
- [entity/item/gql/ItemApi.kt] — `caller()` helper, `toException()` call pattern
- [plugins/GQL.kt:66-86] — where to add `repository` param to ItemService and call configureScheduler
- [mongo/model/serialization/InstantBsonSerializer.kt] — for Instant? fields in MongoItem
- [test/utils/TestContainers.kt] — `mongoContainer()`, `setUpMongo()`, `setUpJwt()` helpers

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
