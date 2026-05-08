package com.bagplease

import com.bagplease.entity.user.UserService
import com.bagplease.entity.user.UserStorage
import com.bagplease.entity.user.mongo.UserRepository
import com.bagplease.features.auth.configureAuthRoutes
import com.bagplease.mongo.MongoConnection
import com.bagplease.plugins.configureCors
import com.bagplease.plugins.configureForwardedHeaders
import com.bagplease.plugins.configureGql
import com.bagplease.plugins.configureMonitoring
import com.bagplease.plugins.configureRateLimiting
import com.bagplease.plugins.configureRouting
import com.bagplease.plugins.configureSecurity
import io.ktor.server.application.Application
import io.ktor.server.plugins.di.dependencies

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    val config = environment.config
    dependencies {
        provide { MongoConnection(config) }
    }

    val connection: MongoConnection by dependencies
    val userRepository = UserRepository(connection.db)
    val userStorage = UserStorage(userRepository)
    val adminLogin = config.property("jwt.admin_login").getString()
    val userService = UserService(userStorage, adminLogin)


    configureCors()
    configureMonitoring()
    configureForwardedHeaders()
    configureRateLimiting()
    configureSecurity()
    configureAuthRoutes(userService)
    configureGql()
    configureRouting()
}
