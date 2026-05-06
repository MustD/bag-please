package com.bagplease.entity.category.mongo

import com.bagplease.entity.category.Category

object MongoCategoryMapper {

    /**
     * Maps an instance of [Category] to [MongoCategory].
     *
     * @param category The [Category] to be mapped.
     * @return The [MongoCategory] mapped from the given [Category].
     */
    fun mapCategoryToMongo(category: Category): MongoCategory {
        return MongoCategory(
            id = category.id,
            name = category.name
        )
    }

    /**
     * Maps a [MongoCategory] object to an [Category] object.
     *
     * @param category The [MongoCategory] object to be mapped.
     * @return The mapped [Category] object.
     */
    fun mapCategoryFromMongo(category: MongoCategory): Category {
        return Category(
            id = category.id,
            name = category.name
        )
    }
}
