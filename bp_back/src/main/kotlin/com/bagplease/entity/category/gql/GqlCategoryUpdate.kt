package com.bagplease.entity.category.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName

@GraphQLName("CategoryUpdate")
data class GqlCategoryUpdate(
    val type: GqlCategoryUpdateType,
    val item: GqlCategory,
)

@GraphQLName("CategoryUpdateType")
enum class GqlCategoryUpdateType {
    SAVED, DELETED
}
