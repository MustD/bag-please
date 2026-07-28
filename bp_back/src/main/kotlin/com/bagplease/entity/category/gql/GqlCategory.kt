package com.bagplease.entity.category.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

@GraphQLName("Category")
data class GqlCategory(
    val id: ID,
    val name: String,
    val listId: ID,
)
