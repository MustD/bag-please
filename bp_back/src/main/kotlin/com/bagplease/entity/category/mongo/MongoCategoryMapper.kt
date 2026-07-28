package com.bagplease.entity.category.mongo

import com.bagplease.entity.category.Category

object MongoCategoryMapper {

    fun mapCategoryToMongo(category: Category): MongoCategory {
        return MongoCategory(
            id = category.id,
            name = category.name,
            listId = category.listId,
        )
    }

    fun mapCategoryFromMongo(category: MongoCategory): Category? {
        val listId = category.listId ?: return null  // skip pre-migration docs with no listId
        return Category(
            id = category.id,
            name = category.name,
            listId = listId,
        )
    }
}
