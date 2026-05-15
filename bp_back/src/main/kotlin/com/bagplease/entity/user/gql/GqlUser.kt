package com.bagplease.entity.user.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

@GraphQLName("User")
data class GqlUser(
    val id: ID,
    val username: String,
    val role: String,
)
