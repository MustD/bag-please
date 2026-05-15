package com.bagplease.config.mongo

import com.bagplease.config.ApplicationConfig
import com.mongodb.client.model.Filters
import com.mongodb.client.model.ReplaceOptions
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.toList
import java.util.*

class ApplicationConfigRepository(db: MongoDatabase) {
    private val collection = db.getCollection<MongoApplicationConfig>("app_config")
    private val configId = UUID.fromString("00000000-0000-0000-0000-000000000001")

    suspend fun load(): ApplicationConfig =
        collection.find(Filters.eq("_id", configId.toString())).toList().firstOrNull()
            ?.let { ApplicationConfig(it.registrationEnabled) }
            ?: ApplicationConfig().also { save(it) }

    suspend fun save(config: ApplicationConfig) {
        collection.replaceOne(
            Filters.eq("_id", configId.toString()),
            MongoApplicationConfig(configId, config.registrationEnabled),
            ReplaceOptions().upsert(true),
        )
    }
}
