package com.bagplease.entity.list.gql

import com.bagplease.entity.list.ListAuthError
import com.bagplease.entity.list.ListService
import com.bagplease.features.auth.CallerUsername
import com.bagplease.plugins.GQL_CALL_PRINCIPAL
import com.bagplease.plugins.GraphQLForbiddenException
import com.expediagroup.graphql.generator.scalars.ID
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import graphql.schema.DataFetchingEnvironment
import io.ktor.server.auth.jwt.JWTPrincipal
import java.util.UUID

@Suppress("unused")
class ListQueries(
    private val service: ListService,
) : Query {

    suspend fun lists(env: DataFetchingEnvironment): List<GqlList> {
        val caller = env.caller()
        return service.getLists(caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { it.map(GqlListMapper::mapListToGql) },
        )
    }
}

@Suppress("unused")
class ListMutations(
    private val service: ListService,
) : Mutation {

    suspend fun createList(name: String, emoji: String? = null, env: DataFetchingEnvironment): GqlList {
        val caller = env.caller()
        return service.createList(name, emoji, caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { GqlListMapper.mapListToGql(it) },
        )
    }

    suspend fun deleteList(id: ID, env: DataFetchingEnvironment): GqlDeleteListResult {
        val caller = env.caller()
        return service.deleteList(UUID.fromString(id.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { GqlDeleteListResult(it.deletedItemCount, it.deletedCategoryCount) },
        )
    }
}

private fun DataFetchingEnvironment.caller(): CallerUsername {
    val principal = graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
        ?: throw IllegalStateException("Unauthenticated")
    return CallerUsername(principal.payload.getClaim("username").asString())
}

internal fun ListAuthError.toException(): GraphQLForbiddenException = when (this) {
    is ListAuthError.AdminBlocked -> GraphQLForbiddenException("Admin cannot access list resources")
    is ListAuthError.NotMember -> GraphQLForbiddenException("Access denied: not a list member")
    is ListAuthError.NotOwner -> GraphQLForbiddenException("Access denied: only the list owner can perform this action")
}
