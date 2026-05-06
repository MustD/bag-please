package com.bagplease.entity.item

import com.bagplease.entity.item.mongo.ItemRepository
import io.ktor.util.collections.ConcurrentMap
import java.util.UUID

@Suppress("RedundantSuspendModifier")
class ItemStorage(
    private val repository: ItemRepository,
) {
    private val storage: ConcurrentMap<UUID, Item> = ConcurrentMap()
    private var synced = false

    suspend fun sync() {
        if (synced.not()) {
            repository.getAll().forEach {
                storage[it.id] = it
            }
            synced = true
        }
    }

    suspend fun save(item: Item): Item {
        sync()
        storage[item.id] = item
        repository.save(item)
        return item
    }

    suspend fun getAll(): List<Item> {
        sync()
        return storage.map { it.value }
    }

    suspend fun delete(id: UUID): Item {
        sync()
        val item = storage.remove(id) ?: throw IllegalStateException("Item not found")
        repository.delete(id)
        return item
    }
}
