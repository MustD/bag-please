package com.bag_please.auth

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.bag_please.Service
import com.bag_please.user.User
import kotlinx.datetime.Clock
import kotlinx.datetime.toJavaInstant
import kotlin.time.Duration.Companion.hours

object AuthHandler {
    fun authenticate(user: String, pass: String): String {
        val config = Service.jwtConfig

        //todo: add user-pass check

        val token = JWT.create()
            .withAudience(config.audience)
            .withIssuer(config.issuer)
            .withClaim("username", user)
            .withExpiresAt(Clock.System.now().plus(1.hours).toJavaInstant())
            .sign(Algorithm.HMAC256(config.secret))

        return token
    }

    fun verify(token: String): User {
        val config = Service.jwtConfig
        val verification = JWT.require(Algorithm.HMAC256(config.secret))
            .withAudience(config.audience)
            .withIssuer(config.issuer)
            .build()

        val userName = kotlin.runCatching {
            val jwt = verification.verify(token)
            jwt.getClaim("username").asString()

        }.getOrDefault("Anonymous")

        return User(username = userName)
    }
}