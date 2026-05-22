package com.bagplease.entity.item.gql

import com.bagplease.entity.item.ItemService
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
class ItemQueries(
    private val service: ItemService,
) : Query {

    suspend fun getItems(listId: ID, env: DataFetchingEnvironment): List<GqlItem> {
        val caller = env.caller()
        return service.getItems(UUID.fromString(listId.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { it.map(GqlItemMapper::mapItemToGql) },
        )
    }
}

@Suppress("unused")
class ItemMutations(
    private val service: ItemService,
) : Mutation {

    suspend fun saveItem(item: GqlItem, env: DataFetchingEnvironment): GqlItem {
        val caller = env.caller()
        return service.saveItem(item.let(GqlItemMapper::mapItemFromGql), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { GqlItemMapper.mapItemToGql(it) },
        )
    }

    suspend fun deleteItem(id: ID, listId: ID, env: DataFetchingEnvironment): GqlItem {
        val caller = env.caller()
        return service.deleteItem(UUID.fromString(id.value), UUID.fromString(listId.value), caller).fold(
            ifLeft = { throw it.toException() },
            ifRight = { GqlItemMapper.mapItemToGql(it) },
        )
    }
}

@Suppress("unused")
class ItemSubscriptions(
    private val service: ItemService,
    private val listService: ListService,
) : Subscription {

    fun getItemUpdates(listId: ID, env: DataFetchingEnvironment): Flow<GqlItemUpdate> {
        val caller = env.caller()
        val listUUID = UUID.fromString(listId.value)
        return flow {
            listService.verifyMembership(caller, listUUID).fold(
                ifLeft = { throw it.toException() },
                ifRight = {},
            )
            val updates = service.itemUpdates
                .filter { it.listId == listUUID }
                .map { GqlItemUpdate(GqlItemUpdateType.SAVED, GqlItemMapper.mapItemToGql(it)) }
            val deletions = service.itemDeletions
                .filter { it.listId == listUUID }
                .map { GqlItemUpdate(GqlItemUpdateType.DELETED, GqlItemMapper.mapItemToGql(it)) }
            emitAll(merge(updates, deletions).takeWhile { listService.isMember(caller, listUUID) })
        }
    }
}

private fun DataFetchingEnvironment.caller(): CallerUsername {
    val principal = graphQlContext.get<JWTPrincipal>(GQL_CALL_PRINCIPAL)
        ?: throw IllegalStateException("Unauthenticated")
    return CallerUsername(principal.payload.getClaim("username").asString())
}
