package com.bagplease.entity.category.db

import com.bagplease.entity.category.Category
import org.jetbrains.exposed.v1.core.ResultRow

object CategoryRowMapper {
    fun categoryFromRow(row: ResultRow): Category = Category(
        id = row[CategoryTable.id],
        name = row[CategoryTable.name],
        listId = row[CategoryTable.listId],
    )
}
