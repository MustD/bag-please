package com.bagplease.entity.user.mongo

import com.bagplease.mongo.model.serialization.UUIDMongoSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.*

@Serializable
data class MongoUser(
    @SerialName("_id")
    @Serializable(with = UUIDMongoSerializer::class)
    val id: UUID,
    val username: String,
    val passwordHash: String,
    val role: String,
)
