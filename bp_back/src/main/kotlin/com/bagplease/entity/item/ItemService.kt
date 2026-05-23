package com.bagplease.entity.item

import arrow.core.Either
import arrow.core.raise.either
import com.bagplease.entity.item.mongo.ItemRepository
import com.bagplease.entity.list.ListAuthError
import com.bagplease.entity.list.ListService
import com.bagplease.features.auth.CallerUsername
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.*

class ItemService(
    private val storage: ItemStorage,
    private val listService: ListService,
    private val repository: ItemRepository,
) {

    private val itemUpdateChannel = MutableSharedFlow<Item>(
        onBufferOverflow = BufferOverflow.DROP_OLDEST, extraBufferCapacity = 1
    )
    private val itemDeleteChannel = MutableSharedFlow<Item>(
        onBufferOverflow = BufferOverflow.DROP_OLDEST, extraBufferCapacity = 1
    )

    val itemUpdates = itemUpdateChannel as SharedFlow<Item>
    val itemDeletions = itemDeleteChannel as SharedFlow<Item>

    suspend fun getItems(listId: UUID, caller: CallerUsername): Either<ListAuthError, List<Item>> = either {
        listService.verifyMembership(caller, listId).bind()
        storage.getByListId(listId)
    }

    suspend fun saveItem(item: Item, caller: CallerUsername): Either<ListAuthError, Item> = either {
        listService.verifyMembership(caller, item.listId).bind()
        val savedItem = storage.save(item)
        itemUpdateChannel.emit(savedItem)
        savedItem
    }

    suspend fun deleteItem(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Item> = either {
        listService.verifyMembership(caller, listId).bind()
        val deletedItem = storage.delete(id, listId)
        itemDeleteChannel.emit(deletedItem)
        deletedItem
    }

    suspend fun checkItem(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Item> = either {
        listService.verifyMembership(caller, listId).bind()
        val item = storage.getByIdCached(id, listId) ?: throw IllegalStateException("Item not found")
        val updated = when (item.recurring) {
            Recurring.ONE_TIME -> item.copy(checked = true, deleted = true, deletedAt = Instant.now())
            Recurring.WEEKLY, Recurring.BIWEEKLY, Recurring.MONTHLY -> item.copy(checked = true, checkedAt = Instant.now())
            null -> item.copy(checked = true)
        }
        val saved = storage.save(updated)
        itemUpdateChannel.emit(saved)
        saved
    }

    suspend fun uncheckItem(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Item> = either {
        listService.verifyMembership(caller, listId).bind()
        storage.getByListId(listId)  // ensure sync
        val item = storage.getByIdCached(id, listId) ?: throw IllegalStateException("Item not found")
        val restored = item.copy(checked = false, deleted = false, deletedAt = null, checkedAt = null)
        val saved = storage.save(restored)
        itemUpdateChannel.emit(saved)
        saved
    }

    suspend fun getStoreSuggestions(listId: UUID, caller: CallerUsername): Either<ListAuthError, List<String>> = either {
        listService.verifyMembership(caller, listId).bind()
        storage.getByListId(listId).mapNotNull { it.store }.distinct()
    }

    internal suspend fun runSchedulerCycle() {
        // Recurring restore
        val candidates = repository.findCheckedRecurringItems()
        for (item in candidates) {
            val elapsedDays = when (item.recurring) {
                Recurring.WEEKLY -> 7L
                Recurring.BIWEEKLY -> 14L
                Recurring.MONTHLY -> 30L
                else -> continue
            }
            val threshold = Instant.now().minus(elapsedDays, ChronoUnit.DAYS)
            if (item.checkedAt == null || item.checkedAt.isAfter(threshold)) continue
            val restored = item.copy(checked = false, checkedAt = null)
            storage.save(restored)
            itemUpdateChannel.emit(restored)
        }

        // Hard-delete soft-deleted one-timers
        val toDelete = repository.findSoftDeletedToHardDelete()
        for (item in toDelete) {
            storage.delete(item.id, item.listId)
            itemDeleteChannel.emit(item)
        }
    }
}
