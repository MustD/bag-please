package com.bagplease.utils

import io.kotest.core.extensions.install
import io.kotest.core.spec.style.FunSpec
import io.kotest.extensions.testcontainers.TestContainerProjectExtension
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.config.mergeWith
import io.ktor.server.testing.ApplicationTestBuilder
import org.testcontainers.containers.MongoDBContainer

fun FunSpec.mongoContainer() = install(
    TestContainerProjectExtension(
        MongoDBContainer("mongo:8")
    )
)

fun ApplicationTestBuilder.setUpMongo(container: MongoDBContainer) = environment {
    config = config.mergeWith(
        MapApplicationConfig(
            "db.mongo.host" to "localhost",
            "db.mongo.port" to container.firstMappedPort.toString(),
            "db.mongo.db_name" to "test",
            "db.mongo.user" to "",
            "db.mongo.pass" to "",
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
            "jwt.admin_pass" to "admin"
        )
    )
}
