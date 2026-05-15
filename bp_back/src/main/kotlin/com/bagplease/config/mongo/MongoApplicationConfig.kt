package com.bagplease.config.mongo

import com.bagplease.mongo.model.serialization.UUIDMongoSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.*

@Serializable
data class MongoApplicationConfig(
    @SerialName("_id") @Serializable(with = UUIDMongoSerializer::class) val id: UUID,
    val registrationEnabled: Boolean,
)
