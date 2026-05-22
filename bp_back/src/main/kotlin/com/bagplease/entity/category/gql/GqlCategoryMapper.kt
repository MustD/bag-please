package com.bagplease.entity.category.gql

import com.bagplease.entity.category.Category
import com.expediagroup.graphql.generator.scalars.ID
import java.util.*

object GqlCategoryMapper {

    fun mapCategoryToGql(category: Category): GqlCategory {
        return GqlCategory(
            id = ID(category.id.toString()),
            name = category.name,
            listId = ID(category.listId.toString()),
        )
    }

    fun mapCategoryFromGql(category: GqlCategory): Category {
        return Category(
            id = UUID.fromString(category.id.toString()),
            name = category.name,
            listId = UUID.fromString(category.listId.toString()),
        )
    }
}
