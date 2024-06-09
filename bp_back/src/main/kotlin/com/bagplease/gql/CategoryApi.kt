package com.bagplease.gql

import com.bagplease.gql.model.GqlCategory
import com.bagplease.gql.model.GqlCategoryMapper
import com.bagplease.gql.model.GqlCategoryUpdate
import com.bagplease.gql.model.GqlCategoryUpdateType
import com.bagplease.service.CategoryService
import com.expediagroup.graphql.generator.scalars.ID
import com.expediagroup.graphql.server.operations.Mutation
import com.expediagroup.graphql.server.operations.Query
import com.expediagroup.graphql.server.operations.Subscription
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge
import java.util.*

@Suppress("unused")
object CategoryQueries : Query {

    private val service = CategoryService

    /**
     * Retrieves a list of GraphQL categories.
     *
     * This method asynchronously fetches a list of categories from storage using the `getAll` method,
     * maps each category to a [GqlCategory] object using the [GqlCategoryMapper.mapCategoryToGql] method,
     * and returns the list of mapped categories.
     *
     * @return A list of [GqlCategory] objects.
     */
    suspend fun getCategories(): List<GqlCategory> = service.getCategories().map(GqlCategoryMapper::mapCategoryToGql)
}

@Suppress("unused")
object CategoryMutations : Mutation {

    private val service = CategoryService

    /**
     * Saves a category to the storage.
     *
     * @param category The category to be saved.
     * @return The saved category.
     */
    suspend fun saveCategory(category: GqlCategory): GqlCategory =
        category.let(GqlCategoryMapper::mapCategoryFromGql).let {
            service.saveCategory(it)
        }.let(GqlCategoryMapper::mapCategoryToGql)

    /**
     * Deletes a category with the specified ID from the storage.
     *
     * @param id The ID of the category to be deleted.
     * @return The deleted category as a [GqlCategory].
     * @throws IllegalStateException if the category is not found in the storage.
     */
    suspend fun deleteCategory(id: ID): GqlCategory = id.let { UUID.fromString(it.value) }.let {
        service.deleteCategory(it)
    }.let(GqlCategoryMapper::mapCategoryToGql)
}

@Suppress("unused")
object CategorySubscriptions : Subscription {

    private val service = CategoryService

    /**
     * Retrieves updates for categories.
     *
     * @return A [Flow] of [GqlCategoryUpdate] that emits category updates.
     */
    fun getCategoryUpdates(): Flow<GqlCategoryUpdate> {
        val updates = service.categoryUpdates.map {
            GqlCategoryUpdate(
                type = GqlCategoryUpdateType.SAVED, item = GqlCategoryMapper.mapCategoryToGql(it)
            )
        }

        val deletions = service.categoryDeletions.map {
            GqlCategoryUpdate(
                type = GqlCategoryUpdateType.DELETED, item = GqlCategoryMapper.mapCategoryToGql(it)
            )
        }
        return merge(updates, deletions)
    }
}