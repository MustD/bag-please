package com.bagplease.entity.category.mongo

import com.bagplease.entity.category.Category
import com.mongodb.client.model.Filters
import com.mongodb.client.model.UpdateOptions
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import java.util.UUID

class CategoryRepository(db: MongoDatabase) {

    private val collectionName = "categories"
    private val idCol = "_id"
    private val col = db.getCollection<MongoCategory>(collectionName)

    suspend fun getAll(): List<Category> = col.find().map(MongoCategoryMapper::mapCategoryFromMongo).toList()

    suspend fun save(category: Category) {
        val filter = Filters.eq(idCol, category.id)
        val options = UpdateOptions().upsert(true)
        val update = Updates.combine(
            Updates.set(MongoCategory::name.name, category.name)
        )
        col.updateOne(filter, update, options)
    }

    suspend fun delete(id: UUID) {
        val filter = Filters.eq(idCol, id)
        col.deleteOne(filter)
    }
}
