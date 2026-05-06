package com.bagplease.entity.category

import com.bagplease.entity.category.mongo.CategoryRepository
import io.ktor.util.collections.ConcurrentMap
import java.util.UUID

@Suppress("RedundantSuspendModifier")
class CategoryStorage(
    private val repository: CategoryRepository,
) {
    private val storage: ConcurrentMap<UUID, Category> = ConcurrentMap()
    private var synced = false

    suspend fun sync() {
        if (synced.not()) {
            repository.getAll().forEach {
                storage[it.id] = it
            }
            synced = true
        }
    }

    suspend fun save(category: Category): Category {
        sync()
        storage[category.id] = category
        repository.save(category)
        return category
    }

    suspend fun getAll(): List<Category> {
        sync()
        return storage.map { it.value }
    }

    suspend fun delete(id: UUID): Category {
        sync()
        val category = storage.remove(id) ?: throw IllegalStateException("Category not found")
        repository.delete(id)
        return category
    }
}
