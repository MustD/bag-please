package com.bagplease.entity.category.db

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID

/** The `categories` table from `V1__baseline.sql`. `(list_id, id)` is unique: it is the target of items' composite FK. */
object CategoryTable : Table("categories") {
    val id = javaUUID("id")
    val name = text("name")
    val listId = javaUUID("list_id")

    override val primaryKey = PrimaryKey(id)
}
