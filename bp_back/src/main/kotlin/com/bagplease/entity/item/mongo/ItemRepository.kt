package com.bagplease.entity.item.mongo

import com.bagplease.entity.item.Item
import com.mongodb.client.model.Filters
import com.mongodb.client.model.IndexModel
import com.mongodb.client.model.IndexOptions
import com.mongodb.client.model.Indexes
import com.mongodb.client.model.UpdateOptions
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.mapNotNull
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import java.util.UUID

class ItemRepository(
    db: MongoDatabase,
) {

    private val collectionName = "items"
    private val idCol = "_id"
    private val col = db.getCollection<MongoItem>(collectionName)

    init {
        runBlocking {
            col.createIndexes(
                listOf(
                    IndexModel(Indexes.ascending("listId", "_id"), IndexOptions().background(true)),
                )
            ).toList()
        }
    }

    suspend fun getAll(): List<Item> =
        col.find().mapNotNull(MongoItemMapper::mapItemFromMongo).toList()

    suspend fun save(item: Item) {
        val filter = Filters.eq(idCol, item.id.toString())
        val options = UpdateOptions().upsert(true)
        val update = Updates.combine(
            Updates.set(MongoItem::name.name, item.name),
            Updates.set(MongoItem::checked.name, item.checked),
            Updates.set(MongoItem::category.name, item.category.toString()),
            Updates.set("listId", item.listId.toString()),
        )
        col.updateOne(filter, update, options)
    }

    suspend fun delete(id: UUID) {
        val filter = Filters.eq(idCol, id.toString())
        col.deleteOne(filter)
    }

    suspend fun deleteAllInList(listId: UUID): Int {
        val result = col.deleteMany(Filters.eq("listId", listId.toString()))
        return result.deletedCount.toInt()
    }
}
