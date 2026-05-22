package com.bagplease.entity.list.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName

@GraphQLName("DeleteListResult")
data class GqlDeleteListResult(
    val deletedItemCount: Int,
    val deletedCategoryCount: Int,
)
