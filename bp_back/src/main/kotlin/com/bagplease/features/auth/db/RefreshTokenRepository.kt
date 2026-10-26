package com.bagplease.features.auth.db

import com.bagplease.features.auth.RefreshToken
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.r2dbc.deleteWhere
import org.jetbrains.exposed.v1.r2dbc.insert
import org.jetbrains.exposed.v1.r2dbc.selectAll
import java.time.Instant
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList

/** `refresh_tokens` over Exposed-on-R2DBC. Every method must run inside a service's `tx {}` (AD-2). */
class RefreshTokenRepository {

    suspend fun save(token: RefreshToken) {
        RefreshTokenTable.insert {
            it[RefreshTokenTable.token] = token.token
            it[username] = token.username
            it[role] = token.role
            it[expiresAt] = token.expiresAt
        }
    }

    suspend fun findById(tokenValue: String): RefreshToken? =
        RefreshTokenTable.selectAll().where { RefreshTokenTable.token eq tokenValue }
            .map {
                RefreshToken(
                    token = it[RefreshTokenTable.token],
                    username = it[RefreshTokenTable.username],
                    role = it[RefreshTokenTable.role],
                    expiresAt = it[RefreshTokenTable.expiresAt],
                )
            }
            .toList()
            .firstOrNull()

    suspend fun deleteById(tokenValue: String) {
        RefreshTokenTable.deleteWhere { token eq tokenValue }
    }

    suspend fun deleteAllForUser(username: String) {
        RefreshTokenTable.deleteWhere { RefreshTokenTable.username eq username }
    }

    /** Deletes every token whose `expires_at` is before [now]; returns how many. */
    suspend fun deleteExpired(now: Instant): Int =
        RefreshTokenTable.deleteWhere { expiresAt lessEq now }
}
