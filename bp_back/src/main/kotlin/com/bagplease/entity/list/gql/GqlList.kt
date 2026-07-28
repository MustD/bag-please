package com.bagplease.entity.list.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

@GraphQLName("List")
data class GqlList(
    val id: ID,
    val name: String,
    val emoji: String?,
    val ownerId: String,
    val ownerUsername: String,
    val members: kotlin.collections.List<GqlListMember>,
    val createdAt: String,
    val uncheckedItemCount: Int = 0,
)
