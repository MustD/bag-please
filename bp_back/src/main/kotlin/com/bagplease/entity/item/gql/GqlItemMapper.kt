package com.bagplease.entity.item.gql

import com.bagplease.entity.item.Item
import com.expediagroup.graphql.generator.scalars.ID
import java.util.*

object GqlItemMapper {

    fun mapItemToGql(item: Item): GqlItem {
        return GqlItem(
            id = ID(item.id.toString()),
            name = item.name,
            checked = item.checked,
            category = item.category.toString(),
            listId = ID(item.listId.toString()),
        )
    }

    fun mapItemFromGql(item: GqlItem): Item {
        return Item(
            id = UUID.fromString(item.id.toString()),
            name = item.name,
            checked = item.checked,
            category = UUID.fromString(item.category),
            listId = UUID.fromString(item.listId.toString()),
        )
    }
}
