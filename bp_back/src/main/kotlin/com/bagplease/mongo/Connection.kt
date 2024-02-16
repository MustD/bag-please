package com.bagplease.mongo

import com.mongodb.ConnectionString
import com.mongodb.MongoClientSettings
import com.mongodb.kotlin.client.coroutine.MongoClient
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import org.bson.UuidRepresentation

object Connection {

    val client: MongoClient
    val db: MongoDatabase

    init {
        val dbName = "bag_please"
        val connectionString = ConnectionString("mongodb://localhost:27017/$dbName")
        val settings = MongoClientSettings.builder()
            .uuidRepresentation(UuidRepresentation.STANDARD)
            .applyConnectionString(connectionString)
            .build()
        client = MongoClient.create(settings)
        db = client.getDatabase(databaseName = dbName)
    }
}