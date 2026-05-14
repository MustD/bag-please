package com.bagplease.features.auth

import arrow.core.Either
import arrow.core.raise.either
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.bagplease.entity.user.AuthError
import com.bagplease.entity.user.UserService
import java.time.Instant
import java.util.*

data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    val username: String,
    val role: String,
)

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
        refreshTokenRepository.save(RefreshToken(refreshTokenValue, result.username, result.role, expiresAt))
        AuthTokens(
            accessToken = issueAccessToken(result.username, result.role),
            refreshToken = refreshTokenValue,
            username = result.username,
            role = result.role,
        )
    }

    suspend fun refresh(refreshTokenValue: String): Either<AuthError, String> = either {
        val stored = refreshTokenRepository.findById(refreshTokenValue)
            ?: raise(AuthError.InvalidCredentials)
        if (!stored.expiresAt.isAfter(Instant.now())) raise(AuthError.InvalidCredentials)
        issueAccessToken(stored.username, stored.role)
    }

    suspend fun logout(refreshTokenValue: String) {
        refreshTokenRepository.deleteById(refreshTokenValue)
    }

    suspend fun invalidateUserSessions(username: String) {
        refreshTokenRepository.deleteAllForUser(username)
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
