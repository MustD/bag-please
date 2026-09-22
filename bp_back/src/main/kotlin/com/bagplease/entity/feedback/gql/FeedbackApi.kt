package com.bagplease.entity.feedback.gql

import com.bagplease.entity.feedback.FeedbackError
import com.bagplease.entity.feedback.FeedbackService
import com.bagplease.features.auth.CallerUsername
import com.bagplease.plugins.GQL_CALL_PRINCIPAL
import com.bagplease.plugins.GraphQLForbiddenException
import com.bagplease.plugins.GraphQLInvalidInputException
import com.expediagroup.graphql.server.operations.Mutation
import graphql.schema.DataFetchingEnvironment
import io.ktor.server.auth.jwt.JWTPrincipal

// Duplicated locally rather than shared, per the project's tolerance for this
// exact duplication (see the two `requireAdmin()` copies in
// `config/gql/ApplicationConfigApi.kt` / `entity/user/gql/UserAdminApi.kt`):
// `ListApi.kt`'s own `caller()` extension is file-scoped.
private fun DataFetchingEnvironment.caller(): CallerUsername {
    val principal = graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
        ?: throw IllegalStateException("Unauthenticated")
    return CallerUsername(principal.payload.getClaim("username").asString())
}

@Suppress("unused")
class FeedbackMutations(private val service: FeedbackService) : Mutation {
    suspend fun sendFeedback(text: String, env: DataFetchingEnvironment): Boolean {
        val caller = env.caller()
        return service.send(caller, text).fold(
            ifLeft = { error ->
                throw when (error) {
                    is FeedbackError.AdminBlocked -> GraphQLForbiddenException("Admin cannot send feedback")
                    is FeedbackError.BlankText -> GraphQLInvalidInputException("Feedback text is required")
                    is FeedbackError.TooLong -> GraphQLInvalidInputException("Feedback text is too long")
                }
            },
            ifRight = { true },
        )
    }
}

// Story 9.10: FeedbackQueries (feedback query) and deleteFeedback land here, guarded by a third requireAdmin() copy.
