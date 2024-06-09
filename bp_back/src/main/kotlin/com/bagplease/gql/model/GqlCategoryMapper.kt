package com.bagplease.gql.model

import com.bagplease.storage.Category
import com.expediagroup.graphql.generator.scalars.ID
import java.util.*

object GqlCategoryMapper {

    /**
     * Maps an [Category] object to a [GqlCategory] object.
     *
     * @param category The category to be mapped.
     * @return The mapped [GqlCategory] object.
     */
    fun mapCategoryToGql(category: Category): GqlCategory {
        return GqlCategory(
            id = ID(category.id.toString()),
            name = category.name
        )
    }

    /**
     * Maps a [GqlCategory] object to a [Category] object.
     *
     * @param category The GqlCategory to be mapped.
     * @return The mapped [Category] object.
     */
    fun mapCategoryFromGql(category: GqlCategory): Category {
        return Category(
            id = UUID.fromString(category.id.toString()),
            name = category.name
        )
    }
}