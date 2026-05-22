package com.bagplease.entity.category.mongo

import com.bagplease.mongo.model.serialization.UUIDSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.*

@Serializable
data class MongoCategory(
    @SerialName("_id")
    @Serializable(with = UUIDSerializer::class)
    val id: UUID,
    val name: String,
    @Serializable(with = UUIDSerializer::class)
    val listId: UUID? = null,
)
