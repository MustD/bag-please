package com.bagplease.entity.item.mongo

import com.bagplease.mongo.model.serialization.InstantBsonSerializer
import com.bagplease.mongo.model.serialization.UUIDSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.util.*

@Serializable
data class MongoItem(
    @SerialName("_id")
    @Serializable(with = UUIDSerializer::class)
    val id: UUID,
    val name: String,
    val checked: Boolean,
    @Serializable(with = UUIDSerializer::class)
    val category: UUID = UUID(0, 0),
    @Serializable(with = UUIDSerializer::class)
    val listId: UUID? = null,
    // Story 9.6 — the legacy single-value `store` field is GONE from this class, not renamed. The
    // driver's codec ignores unknown BSON keys, so a not-yet-migrated document still deserializes
    // (its `store` is simply dropped on read) and the `emptyList()` default supplies `stores`.
    // `epic9-multi-store` folds the legacy value in at startup; `ItemRepository.save` unsets it on
    // every write, so no row can keep it.
    val stores: List<String> = emptyList(),
    val recurring: String? = null,
    val addedBy: String? = null,
    val deleted: Boolean = false,
    @Serializable(with = InstantBsonSerializer::class)
    val deletedAt: Instant? = null,
    @Serializable(with = InstantBsonSerializer::class)
    val checkedAt: Instant? = null,
)
