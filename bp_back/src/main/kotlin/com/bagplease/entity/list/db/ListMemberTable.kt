package com.bagplease.entity.list.db

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID
import org.jetbrains.exposed.v1.javatime.timestamp

/**
 * The `list_members` table from `V1__baseline.sql`: the sole membership / invite record (AD-4). The owner holds an
 * `ACCEPTED` row. `status` is text with a CHECK constraint.
 */
object ListMemberTable : Table("list_members") {
    val listId = javaUUID("list_id")
    val userId = javaUUID("user_id")
    val status = text("status")
    val createdAt = timestamp("created_at")

    override val primaryKey = PrimaryKey(listId, userId)
}
