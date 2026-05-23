package com.bagplease.entity.item.gql

import com.bagplease.entity.item.Item
import com.bagplease.entity.item.Recurring
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
            store = item.store,
            recurring = item.recurring?.name,
            addedBy = item.addedBy,
            deleted = item.deleted,
            deletedAt = item.deletedAt?.toString(),
            checkedAt = item.checkedAt?.toString(),
        )
    }

    fun mapItemFromInput(input: GqlItemInput, addedBy: String?): Item {
        return Item(
            id = UUID.fromString(input.id.toString()),
            name = input.name,
            checked = input.checked,
            category = UUID.fromString(input.category),
            listId = UUID.fromString(input.listId.toString()),
            store = input.store,
            recurring = input.recurring?.let {
                runCatching { Recurring.valueOf(it) }.getOrElse {
                    throw IllegalArgumentException("Invalid recurring value: $it. Valid: ONE_TIME, WEEKLY, BIWEEKLY, MONTHLY")
                }
            },
            addedBy = addedBy,
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
