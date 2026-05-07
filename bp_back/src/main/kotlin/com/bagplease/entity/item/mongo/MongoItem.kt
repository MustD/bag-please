package com.bagplease.entity.item.mongo

import com.bagplease.mongo.model.serialization.UUIDMongoSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.*

/**
 * @see https://www.mongodb.com/docs/drivers/kotlin/coroutine/current/fundamentals/data-formats/serialization/
 */
@Serializable
data class MongoItem(
    @SerialName("_id")
    @Serializable(with = UUIDMongoSerializer::class)
    val id: UUID,
    val name: String,
    val checked: Boolean,
    @Serializable(with = UUIDMongoSerializer::class)
    val category: UUID = UUID(0, 0),
)
