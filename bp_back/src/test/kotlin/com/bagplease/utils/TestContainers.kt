package com.bagplease.utils

import io.kotest.core.extensions.install
import io.kotest.core.spec.style.FunSpec
import io.kotest.extensions.testcontainers.TestContainerProjectExtension
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.config.mergeWith
import io.ktor.server.testing.ApplicationTestBuilder
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
