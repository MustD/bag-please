package com.bagplease.features.auth

import com.mongodb.client.model.Filters
import com.mongodb.client.model.IndexOptions
import com.mongodb.client.model.Indexes
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import java.util.concurrent.TimeUnit

class RefreshTokenRepository(db: MongoDatabase) {
    private val col = db.getCollection<RefreshToken>("refresh_tokens")

    init {
        runBlocking {
            try {
                col.createIndex(
                    Indexes.ascending(RefreshToken::expiresAt.name),
                    IndexOptions().expireAfter(0, TimeUnit.SECONDS),
                )
            } catch (e: Exception) {
                throw IllegalStateException(
                    "Failed to create TTL index on refresh_tokens.expiresAt — expired tokens will not be auto-deleted: ${e.message}",
                    e,
                )
            }
        }
    }

    suspend fun save(token: RefreshToken) {
        col.insertOne(token)
    }

    suspend fun findById(tokenValue: String): RefreshToken? =
        col.find(Filters.eq("_id", tokenValue)).toList().firstOrNull()

    suspend fun deleteById(tokenValue: String) {
        col.deleteOne(Filters.eq("_id", tokenValue))
    }

    suspend fun deleteAllForUser(username: String) {
        col.deleteMany(Filters.eq(RefreshToken::username.name, username))
    }
}
