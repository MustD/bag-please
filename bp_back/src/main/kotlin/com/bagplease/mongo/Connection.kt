package com.bagplease.mongo

import com.bagplease.Service
import com.mongodb.ConnectionString
import com.mongodb.MongoClientSettings
import com.mongodb.MongoCredential
import com.mongodb.kotlin.client.coroutine.MongoClient
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import org.bson.UuidRepresentation

object Connection {

    val db: MongoDatabase

    init {
        val config = Service.config.config("db.mongo")
        val dbName = config.property("db_name").getString()
        val host = config.property("host").getString()
        val port = config.property("port").getString()
        val user = config.property("user").getString()
        val pass = config.property("pass").getString()

        val connectionString = ConnectionString("mongodb://$host:$port/$dbName")
        val credential = MongoCredential.createScramSha1Credential(user, "admin", pass.toCharArray())

        val settings = MongoClientSettings.builder()
            .credential(credential)
            .uuidRepresentation(UuidRepresentation.STANDARD)
            .applyConnectionString(connectionString)
            .build()

        val client = MongoClient.create(settings)
        db = client.getDatabase(databaseName = dbName)
    }
}