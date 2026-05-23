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
    val store: String? = null,
    val recurring: String? = null,
    val addedBy: String? = null,
    val deleted: Boolean = false,
    @Serializable(with = InstantBsonSerializer::class)
    val deletedAt: Instant? = null,
    @Serializable(with = InstantBsonSerializer::class)
    val checkedAt: Instant? = null,
)
