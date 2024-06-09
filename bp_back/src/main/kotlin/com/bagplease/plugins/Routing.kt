@file:Suppress("unused")

package com.bagplease.plugins

import io.ktor.server.application.*
import io.ktor.server.routing.*

fun Application.configureRouting() {
    val env = environment

    routing {
        securityRoutes()
        gqlRoutes()
    }
}