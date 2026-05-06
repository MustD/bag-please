package com.bagplease

import com.bagplease.mongo.MongoConnection
import com.bagplease.plugins.configureCors
import com.bagplease.plugins.configureGql
import com.bagplease.plugins.configureMonitoring
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

    configureCors()
    configureMonitoring()
    configureSecurity()
    configureGql()
    configureRouting()
}
