package com.bagplease.entity.list.mongo

import com.bagplease.mongo.model.serialization.InstantBsonSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant

@Serializable
data class MongoListMember(
    @SerialName("_id") val id: String,
    val listId: String,
    val userId: String,
    val username: String,
    val status: String,
    @Serializable(with = InstantBsonSerializer::class) val createdAt: Instant,
)
