package com.bagplease.entity.list.db

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID
import org.jetbrains.exposed.v1.javatime.timestamp

/** The `lists` table from `V1__baseline.sql`. The owner's username is never stored: it is joined from `users`. */
object ListTable : Table("lists") {
    val id = javaUUID("id")
    val name = text("name")
    val emoji = text("emoji").nullable()
    val ownerId = javaUUID("owner_id")
    val origin = text("origin")
    val createdAt = timestamp("created_at")

    override val primaryKey = PrimaryKey(id)
}
