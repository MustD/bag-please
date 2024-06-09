package com.bagplease.storage

import com.bagplease.mongo.CategoryRepository
import io.ktor.util.collections.*
import java.util.*

@Suppress("RedundantSuspendModifier")
object CategoryStorage {
    private val storage: ConcurrentMap<UUID, Category> = ConcurrentMap()
    private val repository = CategoryRepository
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
        if (storage.size >= 50) throw IllegalStateException("Max items count reached")
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