package com.bagplease

import com.bagplease.plugins.configureCors
import com.bagplease.plugins.configureGql
import com.bagplease.plugins.configureMonitoring
import io.ktor.server.application.*

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
//    configureSecurity()
    configureCors()
    configureMonitoring()
    configureGql()
}
