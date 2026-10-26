package com.bagplease.entity.user.db

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID

/**
 * The `users` table from `V1__baseline.sql`. `username` is `COLLATE "C" UNIQUE`: equality is case-sensitive and
 * ordering is binary, both decided by the column, not by the application.
 */
object UserTable : Table("users") {
    val id = javaUUID("id")
    val username = text("username")
    val passwordHash = text("password_hash")
    val role = text("role")

    override val primaryKey = PrimaryKey(id)
}
