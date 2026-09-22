package com.bagplease.entity.feedback.gql

import com.bagplease.entity.feedback.FeedbackError
import com.bagplease.entity.feedback.FeedbackService
import com.bagplease.features.auth.CallerUsername
import com.bagplease.plugins.GQL_CALL_PRINCIPAL
import com.bagplease.plugins.GraphQLForbiddenException
import com.bagplease.plugins.GraphQLInvalidInputException
import com.bagplease.plugins.GraphQLNotFoundException
import com.bagplease.plugins.requireAdmin
import com.expediagroup.graphql.generator.scalars.ID
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import graphql.schema.DataFetchingEnvironment
import io.ktor.server.auth.jwt.JWTPrincipal

// `ListApi.kt`'s own `caller()` extension is file-scoped and stays that way —
// only `sendFeedback` uses it. The new admin-only resolvers below use the
// shared `requireAdmin()` instead, same as `UserAdminQueries`/`UserAdminMutations`.
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

    suspend fun deleteFeedback(id: ID, env: DataFetchingEnvironment): ID {
        env.requireAdmin()
        return service.delete(id.value).fold(
            ifLeft = { throw GraphQLNotFoundException("Feedback not found") },
            ifRight = { ID(it.id) },
        )
    }
}

@Suppress("unused")
class FeedbackQueries(private val service: FeedbackService) : Query {
    suspend fun feedback(env: DataFetchingEnvironment): List<GqlFeedback> {
        env.requireAdmin()
        return service.list().map(GqlFeedbackMapper::toGql)
    }
}
