package com.bagplease.entity.user.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName

// The GraphQL wrapper for one page of users (Story 9.2), following the
// GqlListsResult precedent: a plain @GraphQLName-annotated data class returned
// directly from the query, auto-registered via the already-listed
// `com.bagplease.entity.user.gql` package.
//
// `offset` is the page the server SERVED, which the client adopts as its new
// current page — see UserService.getUserPage.
@GraphQLName("UserPage")
data class GqlUserPage(
    val users: List<GqlUser>,
    val totalCount: Int,
    val offset: Int,
)
