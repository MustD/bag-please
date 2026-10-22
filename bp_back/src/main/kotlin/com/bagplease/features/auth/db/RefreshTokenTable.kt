package com.bagplease.features.auth.db

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

/** The `refresh_tokens` table from `V1__baseline.sql`. No FK: the admin account has tokens but no `users` row. */
object RefreshTokenTable : Table("refresh_tokens") {
    val token = text("token")
    val username = text("username")
    val role = text("role")
    val expiresAt = timestamp("expires_at")

    override val primaryKey = PrimaryKey(token)
}
