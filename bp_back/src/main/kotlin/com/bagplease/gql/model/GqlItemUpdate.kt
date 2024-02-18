package com.bagplease.gql.model

import com.expediagroup.graphql.generator.annotations.GraphQLName

@GraphQLName("ItemUpdate")
data class GqlItemUpdate(
    val type: GqlItemUpdateType,
    val item: GqlItem,
)

@GraphQLName("ItemUpdateType")
enum class GqlItemUpdateType {
    SAVED, DELETED
}
