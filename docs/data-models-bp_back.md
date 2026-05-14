# Data Models — bp_back

## Layer Architecture

Each entity exists simultaneously in three representations kept in sync by mappers:

```
Domain (Item / Category)
  ↕ GqlItemMapper / GqlCategoryMapper
GQL (GqlItem / GqlCategory)          ← exposed to clients
  
Domain
  ↕ MongoItemMapper / MongoCategoryMapper
Mongo (MongoItem / MongoCategory)    ← persisted to MongoDB
```

Mappers are `object` singletons. The GQL and Mongo layers never call each other's mappers.

---

## Entity: Item

### Domain model (`entity/item/Item.kt`)

```kotlin
data class Item(
    val id: UUID = UUID.randomUUID(),
    val name: String = "",
    val checked: Boolean = false,
    val category: UUID,          // FK → Category.id
)
```

### GQL model (`entity/item/gql/GqlItem.kt`)

```kotlin
@GraphQLName("Item")
data class GqlItem(
    val id: ID,           // com.expediagroup.graphql.generator.scalars.ID (String wrapper)
    val name: String,
    val checked: Boolean,
    val category: String, // UUID as plain String (not an ID scalar — known inconsistency)
)
```

Subscription event wrapper:

```kotlin
@GraphQLName("ItemUpdate")
data class GqlItemUpdate(
    val type: GqlItemUpdateType,  // enum: SAVED | DELETED
    val item: GqlItem,
)
```

### MongoDB model (`entity/item/mongo/MongoItem.kt`)

```kotlin
@Serializable
data class MongoItem(
    @SerialName("_id")
    @Serializable(with = UUIDMongoSerializer::class)
    val id: UUID,                                          // stored as UUID binary
    val name: String,
    val checked: Boolean,
    @Serializable(with = UUIDMongoSerializer::class)
    val category: UUID = UUID(0, 0),                       // stored as UUID binary
)
```

**Collection:** `items`

### MongoDB upsert pattern (ItemRepository)

```kotlin
Filters.eq("_id", item.id)    // filter on _id (note: UUID object works here via STANDARD repr)
Updates.combine(
    Updates.set("name", item.name),
    Updates.set("checked", item.checked),
    Updates.set("category", item.category),
)
// _id is NOT included in Updates — would cause immutable field error
UpdateOptions().upsert(true)
```

---

## Entity: Category

### Domain model (`entity/category/Category.kt`)

```kotlin
data class Category(
    val id: UUID = UUID.randomUUID(),
    val name: String = ""
)
```

### GQL model (`entity/category/gql/GqlCategory.kt`)

```kotlin
@GraphQLName("Category")
data class GqlCategory(
    val id: ID,
    val name: String
)
```

Subscription event wrapper:

```kotlin
@GraphQLName("CategoryUpdate")
data class GqlCategoryUpdate(
    val type: GqlCategoryUpdateType,  // enum: SAVED | DELETED
    val item: GqlCategory,            // field name "item" is inherited from design — represents the category
)
```

### MongoDB model (`entity/category/mongo/MongoCategory.kt`)

Follows same `@Serializable` pattern as `MongoItem`.

**Collection:** `categories`

---

## In-Memory Storage Layer

Both `ItemStorage` and `CategoryStorage` follow identical patterns:

```
ConcurrentMap<UUID, Entity>  ← thread-safe in-memory cache
var synced: Boolean = false  ← lazy initialization flag

sync():
  if (!synced) {
    repository.getAll().forEach { storage[it.id] = it }
    synced = true
  }
```

Every read/write method calls `sync()` first. Once synced, all reads are served from memory; writes update memory AND
MongoDB atomically (memory first, then async persist).

**Key invariants:**

- `synced` is never reset — in-memory state is never invalidated after startup.
- Each `testApplication` in tests has its own fresh storage instance (no shared state between tests within isolated
  app).
- Direct MongoDB writes bypass the in-memory layer — always use the API for test setup.

---

## Relationships

```
Category (1) ──── (*) Item
```

- `Item.category` is a `UUID` foreign key referencing `Category.id`.
- No referential integrity is enforced at the storage or MongoDB level.
- Deleting a category does NOT cascade to items — orphaned items remain in storage.

---

## MongoDB Connection

- Driver: `mongodb-driver-kotlin-coroutine` 5.5.1
- `UuidRepresentation.STANDARD` — UUIDs stored as binary subtype 4 (RFC 4122)
- Auth: SCRAM-SHA-1 credential against the `admin` database
- Connection configured from `application.yaml` via env vars (see CLAUDE.md configuration table)
