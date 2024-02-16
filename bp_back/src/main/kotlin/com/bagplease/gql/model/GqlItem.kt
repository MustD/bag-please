package com.bagplease.gql.model

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

@GraphQLName("Item")
data class GqlItem(
    val id: ID,
    val name: String,
    val checked: Boolean,
)
