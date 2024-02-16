package com.bagplease.mongo.model

import com.bagplease.storage.Item

object MongoItemMapper {

    /**
     * Maps an instance of [Item] to [MongoItem].
     *
     * @param item The [Item] to be mapped.
     * @return The [MongoItem] mapped from the given [Item].
     */
    fun mapItemToMongo(item: Item): MongoItem {
        return MongoItem(
            id = item.id,
            name = item.name,
            checked = item.checked
        )
    }

    /**
     * Maps a [MongoItem] object to an [Item] object.
     *
     * @param item The [MongoItem] object to be mapped.
     * @return The mapped [Item] object.
     */
    fun mapItemFromMongo(item: MongoItem): Item {
        return Item(
            id = item.id,
            name = item.name,
            checked = item.checked
        )
    }
}