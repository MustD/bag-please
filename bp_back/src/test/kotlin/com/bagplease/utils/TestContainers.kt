package com.bagplease.utils

import com.mongodb.ConnectionString
import com.mongodb.MongoClientSettings
import com.mongodb.MongoCredential
import com.mongodb.client.model.Filters
import com.mongodb.client.model.ReplaceOptions
import com.mongodb.kotlin.client.coroutine.MongoClient
import io.kotest.core.extensions.install
import io.kotest.core.spec.style.FunSpec
import io.kotest.extensions.testcontainers.TestContainerProjectExtension
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.config.mergeWith
import io.ktor.server.testing.ApplicationTestBuilder
import org.bson.Document
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.mongodb.MongoDBContainer

fun FunSpec.mongoContainer(): MongoDBContainer = install(
    TestContainerProjectExtension(
        MongoDBContainer("mongo:8")
    )
) {
    withEnv("MONGO_INITDB_ROOT_USERNAME", "test_user")
    withEnv("MONGO_INITDB_ROOT_PASSWORD", "test_pass")
    waitingFor(Wait.forListeningPort())
}

fun ApplicationTestBuilder.setUpMongo(container: MongoDBContainer) = environment {
    config = config.mergeWith(
        MapApplicationConfig(
            "db.mongo.host" to "localhost",
            "db.mongo.port" to container.firstMappedPort.toString(),
            "db.mongo.db_name" to "test",
            "db.mongo.user" to "test_user",
            "db.mongo.pass" to "test_pass",
        )
    )
}

// Writes the app_config document directly to MongoDB before the application starts.
// Must be called before application { module() } so the AtomicReference cache starts cold.
// Does not consume any HTTP rate-limit slots.
suspend fun setUpRegistration(container: MongoDBContainer, enabled: Boolean) {
    val credential = MongoCredential.createScramSha1Credential("test_user", "admin", "test_pass".toCharArray())
    val settings = MongoClientSettings.builder()
        .credential(credential)
        .applyConnectionString(ConnectionString("mongodb://localhost:${container.firstMappedPort}/test"))
        .build()
    val client = MongoClient.create(settings)
    try {
        val collection = client.getDatabase("test").getCollection<Document>("app_config")
        val CONFIG_ID = "00000000-0000-0000-0000-000000000001"
        collection.replaceOne(
            Filters.eq("_id", CONFIG_ID),
            Document(mapOf("_id" to CONFIG_ID, "registrationEnabled" to enabled)),
            ReplaceOptions().upsert(true),
        )
    } finally {
        client.close()
    }
}

fun ApplicationTestBuilder.setUpJwt() = environment {
    config = config.mergeWith(
        MapApplicationConfig(
            "jwt.secret" to "secret",
            "jwt.issuer" to "localhost",
            "jwt.audience" to "localhost",
            "jwt.realm" to "localhost",
            "jwt.admin_login" to "admin",
            "jwt.admin_pass" to "admin",
            "jwt.accessExpiryMinutes" to "15",
            "jwt.refreshExpiryDays" to "30",
        )
    )
}
