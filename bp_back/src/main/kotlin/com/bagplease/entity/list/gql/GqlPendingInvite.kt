package com.bagplease.entity.list.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

@GraphQLName("PendingInvite")
data class GqlPendingInvite(
    val listId: ID,
    val listName: String,
    val listEmoji: String?,
    val ownerUsername: String,
)
