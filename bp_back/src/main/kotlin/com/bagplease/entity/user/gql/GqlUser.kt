package com.bagplease.entity.user.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

@GraphQLName("User")
data class GqlUser(
    val id: ID,
    val username: String,
    val role: String,
    // How many lists this user OWNS (Story 9.4). Joined at the GQL boundary from
    // the list cache — the domain `User` stays list-agnostic. The admin's delete
    // confirmation states it, because those lists are destroyed with the account.
    val ownedListCount: Int,
)
