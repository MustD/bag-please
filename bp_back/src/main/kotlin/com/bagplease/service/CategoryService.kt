package com.bagplease.service

import com.bagplease.storage.Category
import com.bagplease.storage.CategoryStorage
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import java.util.*

object CategoryService {

    private val storage = CategoryStorage
    private val categoryUpdateChannel = MutableSharedFlow<Category>(
        onBufferOverflow = BufferOverflow.DROP_OLDEST, extraBufferCapacity = 1
    )
    private val categoryDeleteChannel = MutableSharedFlow<Category>(
        onBufferOverflow = BufferOverflow.DROP_OLDEST, extraBufferCapacity = 1
    )

    val categoryUpdates = categoryUpdateChannel as SharedFlow<Category>
    val categoryDeletions = categoryDeleteChannel as SharedFlow<Category>

    /**
     * Retrieves a list of categories.
     *
     * This method asynchronously fetches a list of categories from storage using the `getAll` method and returns the result.
     *
     * @return A list of categories.
     */
    suspend fun getCategories(): List<Category> = storage.getAll()

    /**
     * Saves a category to the storage.
     *
     * @param category The category to be saved.
     * @return The saved category.
     */
    suspend fun saveCategory(category: Category): Category {
        val savedCategory = storage.save(category)
        categoryUpdateChannel.emit(savedCategory)
        return savedCategory
    }

    /**
     * Deletes a category with the specified ID from the storage.
     *
     * @param id The ID of the category to be deleted.
     * @return The deleted category.
     * @throws IllegalStateException if the category is not found in the storage.
     */
    suspend fun deleteCategory(id: UUID): Category {
        val deletedCategory = storage.delete(id)
        categoryDeleteChannel.emit(deletedCategory)
        return deletedCategory
    }
}