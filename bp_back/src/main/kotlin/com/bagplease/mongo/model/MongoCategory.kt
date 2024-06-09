package com.bagplease.mongo.model

import com.bagplease.mongo.model.serialization.UUIDMongoSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.*

@Serializable
data class MongoCategory(
    @SerialName("_id")
    @Serializable(with = UUIDMongoSerializer::class)
    val id: UUID,
    val name: String,
)
