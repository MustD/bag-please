@file:Suppress("unused")

package com.bagplease.plugins

import io.ktor.serialization.jackson.jackson
import io.ktor.server.application.Application
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing

fun Application.configureRouting() {
    val env = environment

    routing {
        install(ContentNegotiation) {
            jackson()
        }

        gqlRoutes()
    }
}
