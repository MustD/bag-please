package com.bagplease.entity.category.gql

import com.bagplease.entity.category.CategoryService
import com.bagplease.entity.list.ListService
import com.bagplease.entity.list.gql.toException
import com.bagplease.features.auth.CallerUsername
import com.bagplease.plugins.GQL_CALL_PRINCIPAL
import com.expediagroup.graphql.generator.scalars.ID
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import com.expediagroup.graphql.server.operations.Subscription
import graphql.schema.DataFetchingEnvironment
import io.ktor.server.auth.jwt.JWTPrincipal
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.flow.takeWhile
import java.util.*

@Suppress("unused")
class CategoryQueries(
    private val service: CategoryService,
) : Query {

    suspend fun getCategories(listId: ID, env: DataFetchingEnvironment): List<GqlCategory> {
        val caller = env.caller()
        return service.getCategories(UUID.fromString(listId.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { it.map(GqlCategoryMapper::mapCategoryToGql) },
        )
    }
}

@Suppress("unused")
class CategoryMutations(
    private val service: CategoryService,
) : Mutation {

    suspend fun saveCategory(category: GqlCategory, env: DataFetchingEnvironment): GqlCategory {
        val caller = env.caller()
        return service.saveCategory(category.let(GqlCategoryMapper::mapCategoryFromGql), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { GqlCategoryMapper.mapCategoryToGql(it) },
        )
    }

    suspend fun deleteCategory(id: ID, listId: ID, env: DataFetchingEnvironment): GqlCategory {
        val caller = env.caller()
        return service.deleteCategory(UUID.fromString(id.value), UUID.fromString(listId.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { GqlCategoryMapper.mapCategoryToGql(it) },
        )
    }
}

@Suppress("unused")
class CategorySubscriptions(
    private val service: CategoryService,
    private val listService: ListService,
) : Subscription {

    fun getCategoryUpdates(listId: ID, env: DataFetchingEnvironment): Flow<GqlCategoryUpdate> {
        val caller = env.caller()
        val listUUID = UUID.fromString(listId.value)
        return flow {
            listService.verifyMembership(caller, listUUID).fold(
                ifLeft = { throw it.toException() },
                ifRight = {},
            )
            val updates = service.categoryUpdates
                .filter { it.listId == listUUID }
                .map { GqlCategoryUpdate(GqlCategoryUpdateType.SAVED, GqlCategoryMapper.mapCategoryToGql(it)) }
            val deletions = service.categoryDeletions
                .filter { it.listId == listUUID }
                .map { GqlCategoryUpdate(GqlCategoryUpdateType.DELETED, GqlCategoryMapper.mapCategoryToGql(it)) }
            emitAll(merge(updates, deletions).takeWhile { listService.isMember(caller, listUUID) })
        }
    }
}

private fun DataFetchingEnvironment.caller(): CallerUsername {
    val principal = graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
        ?: throw IllegalStateException("Unauthenticated")
    return CallerUsername(principal.payload.getClaim("username").asString())
}
