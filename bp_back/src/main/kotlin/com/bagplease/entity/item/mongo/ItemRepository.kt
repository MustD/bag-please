package com.bagplease.entity.item.mongo

import com.bagplease.entity.item.Item
import com.mongodb.client.model.Filters
import com.mongodb.client.model.UpdateOptions
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import java.util.UUID

class ItemRepository(
    db: MongoDatabase,
) {

    private val collectionName = "items"
    private val idCol = "_id"
    private val col = db.getCollection<MongoItem>(collectionName)

    suspend fun getAll(): List<Item> = col.find().map(MongoItemMapper::mapItemFromMongo).toList()

    suspend fun save(item: Item) {
        val filter = Filters.eq(idCol, item.id)
        val options = UpdateOptions().upsert(true)
        val update = Updates.combine(
            Updates.set(MongoItem::name.name, item.name),
            Updates.set(MongoItem::checked.name, item.checked),
            Updates.set(MongoItem::category.name, item.category),
        )
        col.updateOne(filter, update, options)
    }

    suspend fun delete(id: UUID) {
        val filter = Filters.eq(idCol, id)
        col.deleteOne(filter)
    }
}
