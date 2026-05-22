package com.bagplease.entity.category.mongo

import com.bagplease.entity.category.Category
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

class CategoryRepository(db: MongoDatabase) {

    private val collectionName = "categories"
    private val idCol = "_id"
    private val col = db.getCollection<MongoCategory>(collectionName)

    init {
        runBlocking {
            col.createIndexes(
                listOf(
                    IndexModel(Indexes.ascending("listId", "_id"), IndexOptions().background(true)),
                )
            ).toList()
        }
    }

    suspend fun getAll(): List<Category> =
        col.find().mapNotNull(MongoCategoryMapper::mapCategoryFromMongo).toList()

    suspend fun save(category: Category) {
        val filter = Filters.eq(idCol, category.id.toString())
        val options = UpdateOptions().upsert(true)
        val update = Updates.combine(
            Updates.set(MongoCategory::name.name, category.name),
            Updates.set("listId", category.listId.toString()),
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
