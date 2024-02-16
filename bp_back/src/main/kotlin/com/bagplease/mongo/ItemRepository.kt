package com.bagplease.mongo

import com.bagplease.mongo.model.MongoItem
import com.bagplease.mongo.model.MongoItemMapper
import com.bagplease.storage.Item
import com.mongodb.client.model.Filters
import com.mongodb.client.model.UpdateOptions
import com.mongodb.client.model.Updates
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import java.util.*

object ItemRepository {

    private const val collectionName = "items"
    private val db = Connection.db
    private val col = db.getCollection<MongoItem>(collectionName)
    private const val ID_COL = "_id"

    suspend fun getAll(): List<Item> = col.find().map(MongoItemMapper::mapItemFromMongo).toList()

    suspend fun save(item: Item) {
        val filter = Filters.eq(ID_COL, item.id)
        val options = UpdateOptions().upsert(true)
        val update = Updates.combine(
            Updates.set(MongoItem::name.name, item.name),
            Updates.set(MongoItem::checked.name, item.checked)
        )
        col.updateOne(filter, update, options)
    }

    suspend fun delete(id: UUID) {
        val filter = Filters.eq(ID_COL, id)
        col.deleteOne(filter)
    }
}