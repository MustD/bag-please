package com.bagplease.mongo

import com.mongodb.client.model.Filters
import com.mongodb.client.model.ReplaceOptions
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import org.bson.Document

@Serializable
data class AppMigration(
    @SerialName("_id")
    val type: String,
    val complete: Boolean,
)

class AppMigrationsRepository(db: MongoDatabase) {

    private val col = db.getCollection<Document>("app_migrations")

    suspend fun findMigration(type: String): AppMigration? {
        val doc = col.find(Filters.and(
            Filters.eq("_id", type),
            Filters.eq("complete", true),
        )).firstOrNull() ?: return null
        return AppMigration(
            type = doc.getString("_id") ?: return null,
            complete = doc.getBoolean("complete") ?: false,
        )
    }

    suspend fun saveMigration(type: String, complete: Boolean) {
        val doc = Document(mapOf("_id" to type, "complete" to complete))
        col.replaceOne(
            Filters.eq("_id", type),
            doc,
            ReplaceOptions().upsert(true),
        )
    }
}
