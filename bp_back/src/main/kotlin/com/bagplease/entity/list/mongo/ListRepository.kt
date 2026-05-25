package com.bagplease.entity.list.mongo

import com.bagplease.entity.list.List
import com.mongodb.client.model.Filters
import com.mongodb.client.model.IndexModel
import com.mongodb.client.model.IndexOptions
import com.mongodb.client.model.Indexes
import com.mongodb.client.model.UpdateOptions
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import java.util.UUID

class ListRepository(db: MongoDatabase) {

    private val col = db.getCollection<MongoList>("lists")

    init {
        runBlocking {
            col.createIndexes(
                listOf(
                    IndexModel(Indexes.ascending("memberUsernames"), IndexOptions().background(true)),
                    IndexModel(Indexes.ascending("ownerId"), IndexOptions().background(true)),
                )
            ).toList()
        }
    }

    suspend fun getAll(): kotlin.collections.List<List> =
        col.find().map(MongoListMapper::mapListFromMongo).toList()

    suspend fun save(list: List) {
        val filter = Filters.eq("_id", list.id.toString())
        val options = UpdateOptions().upsert(true)
        val update = Updates.combine(
            Updates.set(MongoList::name.name, list.name),
            Updates.set(MongoList::emoji.name, list.emoji),
            Updates.set(MongoList::ownerId.name, list.ownerId.toString()),
            Updates.set(MongoList::ownerUsername.name, list.ownerUsername),
            Updates.set(MongoList::memberUsernames.name, list.memberUsernames),
            Updates.set(MongoList::members.name, list.members.map { it.toString() }),
            Updates.set(MongoList::origin.name, list.origin),
            Updates.set(MongoList::createdAt.name, list.createdAt),
        )
        col.updateOne(filter, update, options)
    }

    suspend fun rename(id: UUID, name: String) {
        col.updateOne(Filters.eq("_id", id.toString()), Updates.set(MongoList::name.name, name))
    }

    suspend fun delete(id: UUID) {
        col.deleteOne(Filters.eq("_id", id.toString()))
    }

    suspend fun deleteAllInList(listId: UUID) {
        // Not applicable for lists themselves; kept for interface consistency
    }
}
