package com.bag_please

import io.ktor.server.config.*

object Service {
    private val config by lazy { ApplicationConfig(null) }

    val jwtConfig by lazy {
        JwtConfig()
    }

}

data class JwtConfig(
    val secret: String = "secret",
    val issuer: String = "bag-please",
    val audience: String = "audience",
    val realm: String = "bag-please",
)