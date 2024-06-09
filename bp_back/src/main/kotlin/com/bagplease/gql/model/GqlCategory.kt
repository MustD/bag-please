package com.bagplease.gql.model

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

@GraphQLName("Category")
data class GqlCategory(
    val id: ID,
    val name: String
)
