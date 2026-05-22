package com.bagplease.entity.item.mongo

import com.bagplease.entity.item.Item

object MongoItemMapper {

    fun mapItemToMongo(item: Item): MongoItem {
        return MongoItem(
            id = item.id,
            name = item.name,
            checked = item.checked,
            category = item.category,
            listId = item.listId,
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
        )
    }
}
