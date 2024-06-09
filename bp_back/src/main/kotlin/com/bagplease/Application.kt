package com.bagplease

import com.bagplease.plugins.*
import io.ktor.server.application.*

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    configureCors()
    configureMonitoring()
    configureSecurity()
    configureGql()
    configureRouting()
}
