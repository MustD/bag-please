package com.bagplease.entity.item.mongo

import com.bagplease.entity.item.Item
import com.bagplease.entity.item.Recurring

object MongoItemMapper {

    fun mapItemToMongo(item: Item): MongoItem {
        return MongoItem(
            id = item.id,
            name = item.name,
            checked = item.checked,
            category = item.category,
            listId = item.listId,
            store = item.store,
            recurring = item.recurring?.name,
            addedBy = item.addedBy,
            deleted = item.deleted,
            deletedAt = item.deletedAt,
            checkedAt = item.checkedAt,
        )
    }

    fun mapItemFromMongo(item: MongoItem): Item? {
        val listId = item.listId ?: return null  // skip pre-migration docs with no listId
        return Item(
            id = item.id,
            name = item.name,
            checked = item.checked,
            category = item.category,
            listId = listId,
            store = item.store,
            recurring = item.recurring?.let { Recurring.valueOf(it) },
            addedBy = item.addedBy,
            deleted = item.deleted,
            deletedAt = item.deletedAt,
            checkedAt = item.checkedAt,
        )
    }
}
