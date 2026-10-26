package com.bagplease.entity.item.db

import com.bagplease.entity.item.Item
import com.bagplease.entity.item.Recurring
import org.jetbrains.exposed.v1.core.ResultRow

object ItemRowMapper {
    fun itemFromRow(row: ResultRow): Item = Item(
        id = row[ItemTable.id],
        name = row[ItemTable.name],
        checked = row[ItemTable.checked],
        category = row[ItemTable.categoryId],
        listId = row[ItemTable.listId],
        stores = row[ItemTable.stores],
        recurring = row[ItemTable.recurring]?.let { Recurring.valueOf(it) },
        addedBy = row[ItemTable.addedBy],
        deleted = row[ItemTable.deleted],
        deletedAt = row[ItemTable.deletedAt],
        checkedAt = row[ItemTable.checkedAt],
    )
}
