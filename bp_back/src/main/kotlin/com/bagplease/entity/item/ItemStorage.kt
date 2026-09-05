package com.bagplease.entity.item

import com.bagplease.entity.item.mongo.ItemRepository
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.Volatile

@Suppress("RedundantSuspendModifier")
class ItemStorage(
    private val repository: ItemRepository,
) {
    private val storage: ConcurrentHashMap<UUID, ConcurrentHashMap<UUID, Item>> = ConcurrentHashMap()
    @Volatile
    private var synced = false

    suspend fun sync() {
        if (synced.not()) {
            repository.getAll().forEach { item ->
                val listId = item.listId
                storage.computeIfAbsent(listId) { ConcurrentHashMap() }[item.id] = item
            }
            synced = true
        }
    }

    suspend fun save(item: Item): Item {
        sync()
        storage.computeIfAbsent(item.listId) { ConcurrentHashMap() }[item.id] = item
        repository.save(item)
        return item
    }

    suspend fun getByListId(listId: UUID): List<Item> {
        sync()
        return storage[listId]?.values?.filter { !it.deleted }?.toList() ?: emptyList()
    }

    suspend fun getByIdCached(id: UUID, listId: UUID): Item? {
        sync()
        return storage[listId]?.get(id)
    }

    suspend fun delete(id: UUID, listId: UUID): Item {
        sync()
        val item = storage[listId]?.remove(id) ?: throw IllegalStateException("Item not found")
        repository.delete(id)
        return item
    }

    fun evictList(listId: UUID) {
        storage.remove(listId)
        // DO NOT reset synced — only the evicted list's inner map is removed
    }
}
