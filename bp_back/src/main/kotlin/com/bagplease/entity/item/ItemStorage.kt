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

    /**
     * Story 9.3 — bulk removal of one category's items, Mongo first then cache, mirroring
     * `ListService.deleteList`. That ordering is CONVENTION, not transactional safety: these are two
     * independent writes with no session.
     *
     * It walks the raw inner map on purpose. `getByListId` filters `!deleted` out, so the obvious
     * implementation ("get the list's items, delete the ones in this category") would leave every
     * soft-deleted row of the category behind — invisible to `getItems`, still on disk, and pointing
     * at a category that no longer exists. That is exactly the orphan this story removes.
     *
     * `internal`, like `ItemService.deleteAllInCategory` that wraps it (review finding, 2026-09-17).
     * A public storage method with the same signature would put the membership check `deleteCategory`
     * performs one call away from being skipped, which is the guarantee the wrapper claims to hold.
     * Returns nothing: the repository's deleted-count was read by no caller along the chain.
     */
    internal suspend fun deleteAllInCategory(listId: UUID, categoryId: UUID) {
        sync()
        repository.deleteAllInCategory(listId, categoryId)
        storage[listId]?.entries?.removeIf { it.value.category == categoryId }
    }

    fun evictList(listId: UUID) {
        storage.remove(listId)
        // DO NOT reset synced — only the evicted list's inner map is removed
    }
}
