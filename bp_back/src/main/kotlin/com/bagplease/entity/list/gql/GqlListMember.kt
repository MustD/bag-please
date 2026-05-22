package com.bagplease.entity.list.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName

@GraphQLName("ListMember")
data class GqlListMember(
    val userId: String,
    val username: String,
    val status: String,
)
