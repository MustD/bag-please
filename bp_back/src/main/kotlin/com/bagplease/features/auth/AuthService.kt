package com.bagplease.features.auth

import arrow.core.Either
import arrow.core.raise.either
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.bagplease.entity.user.AuthError
import com.bagplease.entity.user.UserService
import com.bagplease.features.auth.db.RefreshTokenRepository
import com.bagplease.plugins.tx
import org.slf4j.LoggerFactory
import io.ktor.server.auth.jwt.JWTPrincipal
import java.time.Instant
import java.util.*

data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    val username: String,
    val role: String,
)

private val logger = LoggerFactory.getLogger(AuthService::class.java)

class AuthService(
    private val userService: UserService,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val jwtSecret: String,
    private val jwtIssuer: String,
    private val jwtAudience: String,
    private val accessExpiryMinutes: Long,
    private val refreshExpiryDays: Long,
) {
    suspend fun login(username: String, password: String): Either<AuthError, AuthTokens> = either {
        val result = userService.login(username, password).bind()
        val refreshTokenValue = UUID.randomUUID().toString()
        val expiresAt = Instant.now().plusSeconds(refreshExpiryDays * 24 * 60 * 60)
        tx { refreshTokenRepository.save(RefreshToken(refreshTokenValue, result.username, result.role, expiresAt)) }
        AuthTokens(
            accessToken = issueAccessToken(result.username, result.role),
            refreshToken = refreshTokenValue,
            username = result.username,
            role = result.role,
        )
    }

    suspend fun refresh(refreshTokenValue: String): Either<AuthError, String> = either {
        val stored = tx { refreshTokenRepository.findById(refreshTokenValue) }
            ?: raise(AuthError.InvalidCredentials)
        if (!stored.expiresAt.isAfter(Instant.now())) raise(AuthError.InvalidCredentials)
        issueAccessToken(stored.username, stored.role)
    }

    suspend fun logout(refreshTokenValue: String) {
        tx { refreshTokenRepository.deleteById(refreshTokenValue) }
    }

    /** Scheduler step (AD-10): deletes every expired refresh token, no live one. Returns how many. */
    suspend fun purgeExpiredTokens(): Int {
        val purged = tx { refreshTokenRepository.deleteExpired(Instant.now()) }
        logger.info("Purged $purged expired refresh token(s)")
        return purged
    }

    fun verifyAccessToken(token: String): JWTPrincipal? = try {
        val decoded = JWT.require(Algorithm.HMAC256(jwtSecret))
            .withAudience(jwtAudience)
            .withIssuer(jwtIssuer)
            .build()
            .verify(token)
        val username = decoded.getClaim("username").asString() ?: ""
        val role = decoded.getClaim("role").asString() ?: ""
        if (username.isNotEmpty() && role.isNotEmpty()) JWTPrincipal(decoded) else null
    } catch (e: Exception) {
        null
    }

    private fun issueAccessToken(username: String, role: String): String =
        JWT.create()
            .withAudience(jwtAudience)
            .withIssuer(jwtIssuer)
            .withClaim("username", username)
            .withClaim("role", role)
            .withExpiresAt(Instant.now().plusSeconds(accessExpiryMinutes * 60))
            .sign(Algorithm.HMAC256(jwtSecret))
}
