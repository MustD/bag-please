package com.bagplease.entity.list.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName

@GraphQLName("ListsResult")
data class GqlListsResult(
    val lists: kotlin.collections.List<GqlList>,
    val pendingInvites: kotlin.collections.List<GqlPendingInvite>,
)
