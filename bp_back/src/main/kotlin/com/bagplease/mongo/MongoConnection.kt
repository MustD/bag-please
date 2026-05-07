package com.bagplease.mongo

import com.mongodb.ConnectionString
import com.mongodb.MongoClientSettings
import com.mongodb.MongoCredential
import com.mongodb.kotlin.client.coroutine.MongoClient
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import io.ktor.server.config.ApplicationConfig
import io.ktor.util.logging.KtorSimpleLogger
import org.bson.UuidRepresentation

class MongoConnection(config: ApplicationConfig) {

    private val logger = KtorSimpleLogger("${MongoConnection::class.qualifiedName}")
    val db: MongoDatabase

    init {
        val config = config.config("db.mongo")
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

        logger.info("Connecting to mongo database at mongodb://$host:$port/$dbName with user $user")

        val client = MongoClient.create(settings)
        db = client.getDatabase(databaseName = dbName)
    }
}
