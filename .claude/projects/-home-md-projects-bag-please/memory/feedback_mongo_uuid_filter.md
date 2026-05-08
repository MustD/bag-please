---
name: MongoDB UUID filter for _id in bag-please
description: Use UUID object (not toString()) in Filters.eq for _id field with UuidRepresentation.STANDARD
type: feedback
---

Use `Filters.eq("_id", entity.id)` (UUID object), NOT `Filters.eq("_id", entity.id.toString())` (string).

**Why:** `MongoConnection` configures `UuidRepresentation.STANDARD`. With UUID object in filter, MongoDB upsert stores
`_id` as Binary subtype 4. `UUIDMongoSerializer.deserialize` reads binary via `asBinary().asUuid()`. Using `toString()`
stores `_id` as a plain string — subsequent `getAll()` calls fail with
`BsonInvalidOperationException: Value expected to be of type BINARY is of unexpected type STRING`. The
project-context.md rule saying to use string UUID is incorrect for this codebase.

**How to apply:** In all new Repository `save()` methods with upsert, use `Filters.eq("_id", entity.id)` where
`entity.id` is a `java.util.UUID`. Follow the same pattern as `ItemRepository`.
