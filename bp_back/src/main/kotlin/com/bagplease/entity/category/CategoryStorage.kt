package com.bagplease.entity.category

import com.bagplease.entity.category.mongo.CategoryRepository
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.Volatile

@Suppress("RedundantSuspendModifier")
class CategoryStorage(
    private val repository: CategoryRepository,
) {
    private val storage: ConcurrentHashMap<UUID, ConcurrentHashMap<UUID, Category>> = ConcurrentHashMap()
    @Volatile
    private var synced = false

    suspend fun sync() {
        if (synced.not()) {
            repository.getAll().forEach { category ->
                val listId = category.listId
                storage.computeIfAbsent(listId) { ConcurrentHashMap() }[category.id] = category
            }
            synced = true
        }
    }

    suspend fun save(category: Category): Category {
        sync()
        storage.computeIfAbsent(category.listId) { ConcurrentHashMap() }[category.id] = category
        repository.save(category)
        return category
    }

    suspend fun getByListId(listId: UUID): List<Category> {
        sync()
        return storage[listId]?.values?.toList() ?: emptyList()
    }

    suspend fun delete(id: UUID, listId: UUID): Category {
        sync()
        val category = storage[listId]?.remove(id) ?: throw IllegalStateException("Category not found")
        repository.delete(id)
        return category
    }

    fun evictList(listId: UUID) {
        storage.remove(listId)
        // DO NOT reset synced — only the evicted list's inner map is removed
    }
}
