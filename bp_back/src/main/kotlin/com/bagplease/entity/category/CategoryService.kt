package com.bagplease.entity.category

import arrow.core.Either
import arrow.core.raise.either
import com.bagplease.entity.item.ItemService
import com.bagplease.entity.list.ListAuthError
import com.bagplease.entity.list.ListService
import com.bagplease.features.auth.CallerUsername
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import java.util.*

class CategoryService(
    private val storage: CategoryStorage,
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
        listService.verifyMembership(caller, listId).bind()
        storage.getByListId(listId)
    }

    suspend fun saveCategory(category: Category, caller: CallerUsername): Either<ListAuthError, Category> = either {
        listService.verifyMembership(caller, category.listId).bind()
        val savedCategory = storage.save(category)
        categoryUpdateChannel.emit(savedCategory)
        savedCategory
    }

    /**
     * Story 9.3 — removing a category removes its items, for everyone.
     *
     * The cascade lives HERE, not in `ItemService`: this is where membership is already verified (so
     * the item removal inherits NFR-L2 without a second check) and where the one authoritative event is
     * emitted. It runs AFTER the category delete and BEFORE the emit, so a subscriber that acts on the
     * event never sees a category whose children are still live.
     *
     * Exactly ONE event is emitted, the category `DELETED`. Clients treat it as authoritative for the
     * category's children and prune locally; see `ItemService.deleteAllInCategory` for why a per-item
     * fan-out would be silently dropped.
     *
     * Mongo-then-cache ordering mirrors `ListService.deleteList`. It is convention, not atomicity —
     * these are independent writes with no session, so a failure between them leaves a deleted category
     * with some items still present. That is strictly better than the client-side loop it replaces, and
     * no claim of atomicity is made.
     *
     * The emit is in a `finally` (review finding, 2026-09-17). The category is already gone from Mongo
     * and the cache by the time the cascade runs, so letting a cascade failure skip the event would add
     * a SECOND failure on top of the first: every watching `/list/:id` keeps rendering a phantom group
     * until something refetches. The event is emitted either way and the exception still propagates —
     * the residue is then items without a category, which is the documented non-atomic outcome above,
     * rather than items without a category AND clients that never heard about the delete.
     */
    suspend fun deleteCategory(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Category> = either {
        listService.verifyMembership(caller, listId).bind()
        val deletedCategory = storage.delete(id, listId)
        try {
            itemService.deleteAllInCategory(listId, id)
        } finally {
            categoryDeleteChannel.emit(deletedCategory)
        }
        deletedCategory
    }
}
