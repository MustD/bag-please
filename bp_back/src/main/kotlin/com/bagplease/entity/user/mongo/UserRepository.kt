package com.bagplease.entity.user.mongo

import com.bagplease.entity.user.User
import com.mongodb.client.model.Filters
import com.mongodb.client.model.IndexOptions
import com.mongodb.client.model.Indexes
import com.mongodb.client.model.UpdateOptions
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import java.util.*

class UserRepository(db: MongoDatabase) {

    private val col = db.getCollection<MongoUser>("users")

    init {
        // Unique index is the DB-level safety net against duplicate usernames; backs up the in-memory
        // TOCTOU guard in UserService for multi-instance deployments or direct DB writes
        runBlocking { col.createIndex(Indexes.ascending("username"), IndexOptions().unique(true)) }
    }

    suspend fun getAll(): List<User> = col.find().map(MongoUserMapper::mapUserFromMongo).toList()

    suspend fun save(user: User) {
        val filter = Filters.eq("_id", user.id)
        val options = UpdateOptions().upsert(true)
        val update = Updates.combine(
            Updates.set(MongoUser::username.name, user.username),
            Updates.set(MongoUser::passwordHash.name, user.passwordHash),
            Updates.set(MongoUser::role.name, user.role),
        )
        col.updateOne(filter, update, options)
    }

    suspend fun findByUsername(username: String): User? =
        col.find(Filters.eq(MongoUser::username.name, username))
            .map(MongoUserMapper::mapUserFromMongo)
            .toList()
            .firstOrNull()

    suspend fun findById(id: UUID): User? =
        col.find(Filters.eq("_id", id))
            .map(MongoUserMapper::mapUserFromMongo)
            .toList()
            .firstOrNull()

    suspend fun deleteById(id: UUID): Boolean {
        val result = col.deleteOne(Filters.eq("_id", id))
        return result.deletedCount > 0
    }
}
