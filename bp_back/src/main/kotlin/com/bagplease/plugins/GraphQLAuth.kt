package com.bagplease.plugins

import graphql.schema.DataFetchingEnvironment
import io.ktor.server.auth.jwt.JWTPrincipal

// Shared admin gate (Story 9.10), consolidating the two copies this file
// replaces (`config/gql/ApplicationConfigApi.kt`, `entity/user/gql/UserAdminApi.kt`)
// plus this story's own `feedback`/`deleteFeedback` resolvers — three call
// sites, one definition. Requires the caller IS admin; this is the opposite
// idiom from `FeedbackApi.kt`'s `sendFeedback`, which BLOCKS the admin instead.
fun DataFetchingEnvironment.requireAdmin() {
    val principal = graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
        ?: throw GraphQLForbiddenException("Forbidden")
    val role = principal.payload.getClaim("role").asString() ?: ""
    if (role != "admin") throw GraphQLForbiddenException("Forbidden")
}
