package com.bagplease.mongo

import com.bagplease.mongo.model.MongoCategory
import com.bagplease.mongo.model.MongoCategoryMapper
import com.bagplease.storage.Category
import com.mongodb.client.model.Filters
import com.mongodb.client.model.UpdateOptions
import com.mongodb.client.model.Updates
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import java.util.*

object CategoryRepository {

    private const val COLLECTION_NAME = "categories"
    private val db = Connection.db
    private val col = db.getCollection<MongoCategory>(COLLECTION_NAME)
    private const val ID_COL = "_id"

    suspend fun getAll(): List<Category> = col.find().map(MongoCategoryMapper::mapCategoryFromMongo).toList()

    suspend fun save(category: Category) {
        val filter = Filters.eq(ID_COL, category.id)
        val options = UpdateOptions().upsert(true)
        val update = Updates.combine(
            Updates.set(MongoCategory::name.name, category.name)
        )
        col.updateOne(filter, update, options)
    }

    suspend fun delete(id: UUID) {
        val filter = Filters.eq(ID_COL, id)
        col.deleteOne(filter)
    }
}