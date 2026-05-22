package com.bagplease.entity.item.mongo

import com.bagplease.mongo.model.serialization.UUIDSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
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
)
