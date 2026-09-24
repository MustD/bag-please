package com.bagplease.entity.feedback.mongo

import com.bagplease.mongo.model.serialization.InstantBsonSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant

// BSON model, modeled on `config/mongo/MongoApplicationConfig.kt`. `id` is a
// plain String `_id` (the UUID-as-string precedent, not the `UUID` BSON codec
// `users` uses) — no repository confusion possible since this collection has
// only one identifier shape.
@Serializable
data class MongoFeedback(
    @SerialName("_id") val id: String,
    val text: String,
    val username: String,
    @Serializable(with = InstantBsonSerializer::class) val createdAt: Instant,
)
