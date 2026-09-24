package com.bagplease.entity.user.mongo

import com.bagplease.entity.user.User
import com.mongodb.client.model.Filters
import com.mongodb.client.model.IndexOptions
import com.mongodb.client.model.Indexes
import com.mongodb.client.model.Sorts
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

    // Paging primitives (Story 9.2). Query-only by design: the clamping of
    // `limit` and `offset` is a business rule and lives in UserService, so this
    // layer is handed a limit and a skip that are already valid.
    //
    // The sort and the `countUsernamesBefore` scan both ride the UNIQUE ASCENDING
    // INDEX on `username` created above, under Mongo's default binary collation —
    // which is also the order the GraphQL field promises.
    suspend fun countAll(): Int = col.countDocuments().toInt()

    suspend fun findPage(limit: Int, skip: Int): List<User> =
        col.find()
            .sort(Sorts.ascending(MongoUser::username.name))
            .skip(skip)
            .limit(limit)
            .map(MongoUserMapper::mapUserFromMongo)
            .toList()

    // How many usernames sort strictly before `username`. This is what turns an
    // `around` request into a page index, and it is TOTAL: it answers for a name
    // that is not in the collection just as well as for one that is.
    suspend fun countUsernamesBefore(username: String): Int =
        col.countDocuments(Filters.lt(MongoUser::username.name, username)).toInt()

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
