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
            // BUG-E6-3b — a stale edit dialog can hold a category a co-member has since deleted;
            // writing it strands the item under no group on either screen. Story 9.3 closed the
            // matching CREATE hole below, so both branches now reject an out-of-list category with
            // the SAME message (the frontend maps exactly this wording to friendly copy).
            requireCategoryOnList(item.category, item.listId)
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
            // the create branch upserts by _id alone and silently relocates the item. It is checked
            // BEFORE the category guard on purpose: "this id lives elsewhere" is the more specific
            // diagnosis, and swapping the order would report a relocation attempt as a category error.
            if (repository.findById(item.id) != null) {
                throw IllegalArgumentException("Item ${item.id} belongs to a different list")
            }
            // Story 9.3 — the create hole, closed. An add-item dialog left open while a co-member
            // removes the category would otherwise manufacture a fresh orphan on submit, which was the
            // last ordinary way to produce the data shape the cascade above exists to eliminate.
            //
            // With this, no SUCCESSFUL call on the ITEM surface can leave an item pointing at a
            // category that is not on its list. That is narrower than "no orphan is reachable", and
            // deliberately so (review finding, 2026-09-17). Three windows remain, all recorded in
            // deferred-work.md: (a) `CategoryService.saveCategory` re-saves by `_id` and sets `listId`,
            // so an existing category can be RELOCATED to another list, stranding the old list's items
            // — `saveItem` guards exactly this for items, categories have no equivalent; (b) this check
            // reads the in-memory `CategoryStorage` and `storage.save` runs outside any lock, so a
            // create racing a cascade is a TOCTOU window; (c) the cascade is non-transactional, and its
            // failure residue IS an orphan.
            requireCategoryOnList(item.category, item.listId)
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
        // Story 9.3 — do not RESURRECT an orphan. Since the cascade, an item whose category is gone is
        // almost always legacy data (see the residual windows listed on the CREATE branch above);
        // un-checking it would take a soft-deleted row and put it back on both screens under no group.
        // Deliberately `uncheckItem` only, not `checkItem` (md, 2026-09-17): a pre-existing orphan that
        // is already checked stays checked until it is reassigned.
        //
        // Recovery is EditItemDialog (reassign the category) for an orphan that still RENDERS — one
        // that is checked but not soft-deleted. For a soft-deleted one (a checked ONE_TIME), there is
        // no recovery and this guard removes the API-only one that existed before: `getByListId`
        // filters `deleted` rows out, so it reaches no screen and no dialog either way. Recorded rather
        // than special-cased (review finding, 2026-09-17) — exempting soft-deleted rows would restore
        // exactly the "back on both screens under no group" outcome this guard exists to prevent.
        requireCategoryOnList(item.category, listId)
        val restored = item.copy(checked = false, deleted = false, deletedAt = null, checkedAt = null)
        val saved = storage.save(restored)
        itemUpdateChannel.emit(saved)
        saved
    }

    suspend fun getStoreSuggestions(listId: UUID, caller: CallerUsername): Either<ListAuthError, List<String>> = either {
        listService.verifyMembership(caller, listId).bind()
        storage.getByListId(listId).mapNotNull { it.store }.distinct()
    }

    /**
     * Story 9.3 — the item half of `CategoryService.deleteCategory`'s cascade. `internal` on purpose:
     * membership is verified once, by `deleteCategory`, and nothing outside the module should be able
     * to wipe a category's items without deleting the category. `ItemStorage.deleteAllInCategory` is
     * `internal` too, for the same reason — otherwise the guarantee is one call away.
     *
     * It emits NOTHING. Both SharedFlows here are `extraBufferCapacity = 1` / `DROP_OLDEST`, so a
     * per-item fan-out would be truncated for any subscriber not consuming instantly — reproducing the
     * partial prune this story removes. The single category DELETED event is authoritative for the
     * children; clients fan it out locally.
     */
    internal suspend fun deleteAllInCategory(listId: UUID, categoryId: UUID) =
        storage.deleteAllInCategory(listId, categoryId)

    private suspend fun requireCategoryOnList(categoryId: UUID, listId: UUID) {
        if (categoryStorage.getByListId(listId).none { it.id == categoryId }) {
            throw IllegalArgumentException("Category $categoryId does not belong to list $listId")
        }
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
