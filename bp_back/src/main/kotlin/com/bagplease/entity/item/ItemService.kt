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

        // Story 9.6 / AR-E9-4 — normalize ONCE, above the branch, so create and update cannot
        // diverge. The client mirrors the same rule for immediate feedback, but the server is the
        // authority: whatever it stores here is what every screen renders.
        val incoming = item.copy(stores = StoreNames.normalize(item.stores))

        val stored = storage.getByIdCached(incoming.id, incoming.listId)
        val toSave = if (stored != null) {
            // BUG-E6-3b — a stale edit dialog can hold a category a co-member has since deleted;
            // writing it strands the item under no group on either screen. Story 9.3 closed the
            // matching CREATE hole below, so both branches now reject an out-of-list category with
            // the SAME message (the frontend maps exactly this wording to friendly copy).
            requireCategoryOnList(incoming.category, incoming.listId)
            // AC1 / AR-E7-1 — merge, do not reconstruct. addedBy, checkedAt, deleted and deletedAt are
            // server-owned and absent from ItemInput, so the incoming values are meaningless here.
            // The merge is therefore an ALLOWLIST of the three plain input fields — `name`,
            // `category` and, since Story 9.6, `stores` — and check state is
            // then applied by `applyCheckState` (AR-E9-11) — the one transition table shared with
            // checkItem/uncheckItem. Story 9.5: copying `checked` straight across (as this used to) left
            // `checkedAt` at the stored null, so an edit that checked a recurring item produced
            // `checked = true, checkedAt = null` — a row findCheckedRecurringItems returns and
            // runSchedulerCycle then drops at its `checkedAt == null` guard, checked off forever.
            applyCheckState(
                stored.copy(name = incoming.name, category = incoming.category, stores = incoming.stores),
                incoming.checked,
                incoming.recurring,
                Instant.now(),
            )
        } else {
            // AC3 — getByIdCached is list-scoped, so an id on another list also misses. Without this,
            // the create branch upserts by _id alone and silently relocates the item. It is checked
            // BEFORE the category guard on purpose: "this id lives elsewhere" is the more specific
            // diagnosis, and swapping the order would report a relocation attempt as a category error.
            if (repository.findById(incoming.id) != null) {
                throw IllegalArgumentException("Item ${incoming.id} belongs to a different list")
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
            requireCategoryOnList(incoming.category, incoming.listId)
            incoming // AC2 — create: addedBy from the caller, exactly as today
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
        val updated = applyCheckState(item, true, item.recurring, Instant.now())
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
        val restored = applyCheckState(item, false, item.recurring, Instant.now())
        val saved = storage.save(restored)
        itemUpdateChannel.emit(saved)
        saved
    }

    suspend fun getStoreSuggestions(listId: UUID, caller: CallerUsername): Either<ListAuthError, List<String>> = either {
        listService.verifyMembership(caller, listId).bind()
        // Story 9.6 — flatten every item's stores, then one name per key in the server's order
        // (AR-E9-4). StoreField renders them as offered: the client no longer trims, dedupes or
        // sorts, because only the server can see the whole list.
        StoreNames.suggestions(storage.getByListId(listId).flatMap { it.stores })
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

    /**
     * Story 9.5 / AR-E9-11 — the ONE check-state transition. `checkItem`, `uncheckItem` and
     * `saveItem`'s update branch all route through it, so no path can produce a check state the
     * others cannot; it is the only writer of `checked`, `recurring`, `checkedAt`, `deleted` and
     * `deletedAt` in this service, and it touches nothing else on the stored row.
     *
     * `recurring` is a PARAMETER and is written here on purpose: a save may change the cadence in the
     * same call that changes check state, and the branch must be chosen by the INCOMING cadence, not
     * the stored one. `checkItem`/`uncheckItem` pass `stored.recurring`, so for them it is a no-op.
     *
     * Both clocks are KEPT for a row that is already in the state being applied and STAMPED otherwise:
     * an edit of an already-checked item must not restart the cadence clock, or renaming a checked
     * weekly item every day would postpone its restore indefinitely (7.4 AC5), and re-saving an
     * already soft-deleted one-timer must not restart `findSoftDeletedToHardDelete`'s purge window.
     * The reuse is keyed on `stored.checked`/`stored.deleted`, not on the clock being non-null:
     * a row that is UN-checked may still carry a stale `checkedAt` (the legacy shape the pre-9.5
     * merge produced), and reusing that would have the next scheduler cycle un-check it on the spot.
     *
     * `now` is a parameter rather than an injected `Clock` deliberately — every caller passes
     * `Instant.now()`, and the suite controls time by rewinding the stored `checkedAt` after the
     * write, which exercises the scheduler's real threshold arithmetic.
     */
    private fun applyCheckState(stored: Item, checked: Boolean, recurring: Recurring?, now: Instant): Item =
        if (!checked) {
            stored.copy(checked = false, recurring = recurring, checkedAt = null, deleted = false, deletedAt = null)
        } else when (recurring) {
            Recurring.ONE_TIME -> stored.copy(
                checked = true,
                recurring = recurring,
                deleted = true,
                deletedAt = if (stored.deleted) stored.deletedAt ?: now else now,
            )
            Recurring.WEEKLY, Recurring.BIWEEKLY, Recurring.MONTHLY -> stored.copy(
                checked = true,
                recurring = recurring,
                checkedAt = if (stored.checked) stored.checkedAt ?: now else now,
            )
            null -> stored.copy(checked = true, recurring = recurring)
        }

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
            // Through the same transition as every other uncheck (Story 9.5): a restored row must also
            // shed `deleted`/`deletedAt`, which the hand-written copy here left set.
            val restored = applyCheckState(item, false, item.recurring, Instant.now())
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
