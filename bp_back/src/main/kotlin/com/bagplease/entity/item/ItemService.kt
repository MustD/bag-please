package com.bagplease.entity.item

import arrow.core.Either
import arrow.core.raise.either
import com.bagplease.entity.category.CategoryStorage
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
    private val categoryStorage: CategoryStorage,
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

        val stored = storage.getByIdCached(item.id, item.listId)
        val toSave = if (stored != null) {
            // AC4 / BUG-E6-3b — UPDATE branch only (md, 2026-08-10). A stale edit dialog can hold a
            // category a co-member has since deleted; writing it strands the item under no group on
            // either screen. Scoped to update because that is the actual shape of the bug, and because
            // guarding creates too would fail 29 existing test sites. The create hole is filed.
            if (categoryStorage.getByListId(item.listId).none { it.id == item.category }) {
                throw IllegalArgumentException("Category ${item.category} does not belong to list ${item.listId}")
            }
            // AC1 / AR-E7-1 — merge, do not reconstruct. addedBy, checkedAt, deleted and deletedAt are
            // server-owned and absent from ItemInput, so the incoming values are meaningless here.
            stored.copy(
                name = item.name,
                checked = item.checked,
                category = item.category,
                store = item.store,
                recurring = item.recurring,
            )
        } else {
            // AC3 — getByIdCached is list-scoped, so an id on another list also misses. Without this,
            // the create branch upserts by _id alone and silently relocates the item.
            if (repository.findById(item.id) != null) {
                throw IllegalArgumentException("Item ${item.id} belongs to a different list")
            }
            item // AC2 — create: addedBy from the caller, exactly as today
        }

        val savedItem = storage.save(toSave)
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
