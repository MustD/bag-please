package com.bagplease

import com.bagplease.plugins.configureMonitoring
import com.bagplease.plugins.configureSecurity
import com.bagplease.plugins.graphQLModule
import io.ktor.server.application.*

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    configureSecurity()
//    configureHTTP()
    configureMonitoring()
    graphQLModule()
}
