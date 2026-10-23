package com.bagplease.entity.category

import arrow.core.Either
import arrow.core.raise.either
import com.bagplease.entity.category.db.CategoryRepository
import com.bagplease.entity.item.ItemService
import com.bagplease.entity.list.ListAuthError
import com.bagplease.entity.list.ListService
import com.bagplease.features.auth.CallerUsername
import com.bagplease.plugins.tx
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import java.util.*

class CategoryService(
    private val repository: CategoryRepository,
    private val listService: ListService,
    private val itemService: ItemService,
) {

    private val categoryUpdateChannel = MutableSharedFlow<Category>(
        onBufferOverflow = BufferOverflow.DROP_OLDEST, extraBufferCapacity = 1
    )
    private val categoryDeleteChannel = MutableSharedFlow<Category>(
        onBufferOverflow = BufferOverflow.DROP_OLDEST, extraBufferCapacity = 1
    )

    val categoryUpdates = categoryUpdateChannel as SharedFlow<Category>
    val categoryDeletions = categoryDeleteChannel as SharedFlow<Category>

    suspend fun getCategories(listId: UUID, caller: CallerUsername): Either<ListAuthError, List<Category>> = either {
        tx {
            listService.verifyMembership(caller, listId).bind()
            repository.findByListId(listId)
        }
    }

    /**
     * Creates the category, or renames it when the id already exists on the SAME list. An id that exists on another
     * list is rejected (`IllegalArgumentException`), never relocated: the `items` composite FK ties a category to its
     * list. The SAVED event is emitted after commit, so a failed save emits nothing.
     */
    suspend fun saveCategory(category: Category, caller: CallerUsername): Either<ListAuthError, Category> = either {
        tx {
            listService.verifyMembership(caller, category.listId).bind()
            val existing = repository.findById(category.id)
            when {
                existing == null -> repository.insert(category)
                existing.listId != category.listId ->
                    throw IllegalArgumentException("Category ${category.id} belongs to another list")
                else -> repository.rename(category.id, category.name)
            }
            afterCommit { categoryUpdateChannel.emit(category) }
            category
        }
    }

    /**
     * Story 9.3 — removing a category removes its items, for everyone.
     *
     * The cascade lives HERE, not in `ItemService`: this is where membership is verified (so the item removal
     * inherits NFR-L2 without a second check) and where the one authoritative event is emitted. Order inside one
     * `tx`: membership, find (missing -> "Category not found"), items deleted (Mongo, until Story 11.6), then the
     * category row. The DELETED event is queued with `afterCommit`, so a failed cascade or delete emits nothing and
     * leaves the category row in place.
     *
     * Exactly ONE event is emitted, the category `DELETED`. Clients treat it as authoritative for the category's
     * children and prune locally; see `ItemService.deleteAllInCategory` for why a per-item fan-out would be dropped.
     * The items (Mongo) and the row (PostgreSQL) are not one atomic unit on this branch (AR-E11-2, accepted).
     */
    suspend fun deleteCategory(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Category> = either {
        tx {
            listService.verifyMembership(caller, listId).bind()
            val category = repository.findById(id)?.takeIf { it.listId == listId }
                ?: throw IllegalStateException("Category not found")
            itemService.deleteAllInCategory(listId, id)
            repository.delete(id)
            afterCommit { categoryDeleteChannel.emit(category) }
            category
        }
    }

    /** True when the category exists AND belongs to the list. For other services' guards; reaches categories only here. */
    suspend fun existsOnList(categoryId: UUID, listId: UUID): Boolean =
        tx { repository.existsOnList(categoryId, listId) }

    /** Removes every category of a list and returns how many went. Used by the list delete cascade, in its `tx`. */
    suspend fun deleteAllInList(listId: UUID): Int = tx { repository.deleteAllInList(listId) }
}
