package com.bagplease.gql

import com.bagplease.gql.model.GqlItem
import com.bagplease.gql.model.GqlItemMapper
import com.bagplease.gql.model.GqlItemUpdate
import com.bagplease.gql.model.GqlItemUpdateType
import com.bagplease.service.ItemService
import com.expediagroup.graphql.generator.scalars.ID
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import com.expediagroup.graphql.server.operations.Subscription
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge
import java.util.*

@Suppress("unused")
object ItemQueries : Query {

    private val service = ItemService

    /**
     * Retrieves a list of GraphQL items.
     *
     * This method asynchronously fetches a list of items from storage using the `getAll` method,
     * maps each item to a [GqlItem] object using the [GqlItemMapper.mapItemToGql] method,
     * and returns the list of mapped items.
     *
     * @return A list of [GqlItem] objects.
     */
    suspend fun getItems(): List<GqlItem> = service.getItems().map(GqlItemMapper::mapItemToGql)
}

@Suppress("unused")
object ItemMutations : Mutation {

    private val service = ItemService

    /**
     * Saves an item to the storage.
     *
     * @param item The item to be saved.
     * @return The saved item.
     */
    suspend fun saveItem(item: GqlItem): GqlItem = item.let(GqlItemMapper::mapItemFromGql).let {
        service.saveItem(it)
    }.let(GqlItemMapper::mapItemToGql)

    /**
     * Deletes an item with the specified ID from the storage.
     *
     * @param id The ID of the item to be deleted.
     * @return The deleted item as a [GqlItem].
     * @throws IllegalStateException if the item is not found in the storage.
     */
    suspend fun deleteItem(id: ID): GqlItem = id.let { UUID.fromString(it.value) }.let {
        service.deleteItem(it)
    }.let(GqlItemMapper::mapItemToGql)
}

@Suppress("unused")
object ItemSubscriptions : Subscription {

    private val service = ItemService

    /**
     * Retrieves updates for items.
     *
     * @return A [Flow] of [GqlItemUpdate] that emits item updates.
     */
    suspend fun getItemUpdates(): Flow<GqlItemUpdate> {
        val updates = service.itemUpdates.map {
            GqlItemUpdate(
                type = GqlItemUpdateType.SAVED, item = GqlItemMapper.mapItemToGql(it)
            )
        }

        val deletions = service.itemDeletions.map {
            GqlItemUpdate(
                type = GqlItemUpdateType.DELETED, item = GqlItemMapper.mapItemToGql(it)
            )
        }

        return merge(updates, deletions)
    }
}