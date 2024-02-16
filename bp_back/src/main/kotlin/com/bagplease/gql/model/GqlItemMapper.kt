package com.bagplease.gql.model

import com.bagplease.storage.Item
import com.expediagroup.graphql.generator.scalars.ID
import java.util.*

object GqlItemMapper {

    /**
     * Maps an [Item] object to a [GqlItem] object.
     *
     * @param item The item to be mapped.
     * @return The mapped [GqlItem] object.
     */
    fun mapItemToGql(item: Item): GqlItem {
        return GqlItem(
            id = ID(item.id.toString()),
            name = item.name,
            checked = item.checked
        )
    }

    /**
     * Maps a [GqlItem] object to an [Item] object.
     *
     * @param item The GqlItem to be mapped.
     * @return The mapped [Item] object.
     */
    fun mapItemFromGql(item: GqlItem): Item {
        return Item(
            id = UUID.fromString(item.id.toString()),
            name = item.name,
            checked = item.checked
        )
    }
}