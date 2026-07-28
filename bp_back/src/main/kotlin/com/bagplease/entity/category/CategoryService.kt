package com.bagplease.entity.category

import arrow.core.Either
import arrow.core.raise.either
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

    suspend fun deleteCategory(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Category> = either {
        listService.verifyMembership(caller, listId).bind()
        val deletedCategory = storage.delete(id, listId)
        categoryDeleteChannel.emit(deletedCategory)
        deletedCategory
    }
}
