package com.bagplease.entity.list.mongo

import com.bagplease.mongo.model.serialization.InstantBsonSerializer
import com.bagplease.mongo.model.serialization.UUIDSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.util.UUID

@Serializable
data class MongoList(
    @SerialName("_id")
    @Serializable(with = UUIDSerializer::class)
    val id: UUID,
    val name: String,
    val emoji: String?,
    @Serializable(with = UUIDSerializer::class)
    val ownerId: UUID,
    val ownerUsername: String,
    val memberUsernames: List<String>,
    val members: List<@Serializable(with = UUIDSerializer::class) UUID>,
    val origin: String,
    @Serializable(with = InstantBsonSerializer::class)
    val createdAt: Instant,
)
