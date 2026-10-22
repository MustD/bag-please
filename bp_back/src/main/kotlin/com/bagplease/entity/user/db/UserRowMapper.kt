package com.bagplease.entity.user.db

import com.bagplease.entity.user.User
import org.jetbrains.exposed.v1.core.ResultRow

object UserRowMapper {
    fun fromRow(row: ResultRow): User = User(
        id = row[UserTable.id],
        username = row[UserTable.username],
        passwordHash = row[UserTable.passwordHash],
        role = row[UserTable.role],
    )
}
