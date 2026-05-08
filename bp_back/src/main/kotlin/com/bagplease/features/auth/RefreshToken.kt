package com.bagplease.features.auth

import com.bagplease.mongo.model.serialization.InstantBsonSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant

@Serializable
data class RefreshToken(
    @SerialName("_id") val token: String,
    val username: String,
    val role: String,
    @Serializable(with = InstantBsonSerializer::class) val expiresAt: Instant,
)
