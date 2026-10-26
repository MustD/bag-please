package com.bagplease.entity.item.db

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID
import org.jetbrains.exposed.v1.javatime.timestamp

/**
 * The `items` table from `V1__baseline.sql`. `stores` is a `text[]` (order and casing kept). `(list_id, category_id)`
 * is a composite FK onto `categories (list_id, id)`, so an item's category must belong to the item's list.
 */
object ItemTable : Table("items") {
    val id = javaUUID("id")
    val name = text("name")
    val checked = bool("checked")
    val categoryId = javaUUID("category_id")
    val listId = javaUUID("list_id")
    val stores = array<String>("stores")
    val recurring = text("recurring").nullable()
    val addedBy = text("added_by").nullable()
    val deleted = bool("deleted")
    val deletedAt = timestamp("deleted_at").nullable()
    val checkedAt = timestamp("checked_at").nullable()

    override val primaryKey = PrimaryKey(id)
}
