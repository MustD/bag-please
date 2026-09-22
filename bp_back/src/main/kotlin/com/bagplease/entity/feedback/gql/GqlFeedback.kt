package com.bagplease.entity.feedback.gql

import com.expediagroup.graphql.generator.annotations.GraphQLName
import com.expediagroup.graphql.generator.scalars.ID

// GraphQL model for a feedback entry (Story 9.10), modeled on
// `entity/user/gql/GqlUser.kt`. `createdAt` is a `String` (`.toString()` on the
// domain `Instant`) — the same convention `GqlItemMapper.kt` uses for
// `deletedAt`/`checkedAt`; no new GraphQL scalar.
@GraphQLName("Feedback")
data class GqlFeedback(
    val id: ID,
    val text: String,
    val username: String,
    val createdAt: String,
)
