package com.bag_please

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.bag_please.rpc.AuthRequest
import com.bag_please.rpc.AuthResponse
import com.bag_please.rpc.AuthService
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.datetime.Clock
import kotlinx.datetime.toJavaInstant
import kotlin.coroutines.CoroutineContext
import kotlin.time.Duration.Companion.hours

class UserServiceImpl(override val coroutineContext: CoroutineContext) : AuthService {

    override suspend fun authenticate(req: AuthRequest): AuthResponse {
        val config = Service.jwtConfig
        val token = JWT.create()
            .withAudience(config.audience)
            .withIssuer(config.issuer)
            .withClaim("username", req.user)
            .withExpiresAt(Clock.System.now().plus(1.hours).toJavaInstant())
            .sign(Algorithm.HMAC256(config.secret))

        return AuthResponse(token)
    }

    override suspend fun subscribeToNews(token: String): Flow<String> {
        val config = Service.jwtConfig

        val verification = JWT.require(Algorithm.HMAC256(config.secret))
            .withAudience(config.audience)
            .withIssuer(config.issuer)
            .build()

        val user = kotlin.runCatching {
            val jwt = verification.verify(token)
            jwt.getClaim("username").asString()
        }.getOrDefault("Anonymous")

        return flow {
            repeat(10) {
                delay(1000)
                emit("Article for $user number $it")
            }
        }
    }
}