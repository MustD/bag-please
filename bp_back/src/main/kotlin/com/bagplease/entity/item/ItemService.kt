package com.bagplease.entity.item

import arrow.core.Either
import arrow.core.raise.either
import com.bagplease.entity.category.CategoryService
import com.bagplease.entity.item.db.ItemRepository
import com.bagplease.entity.list.ListAuthError
import com.bagplease.entity.list.ListService
import com.bagplease.features.auth.CallerUsername
import com.bagplease.plugins.tx
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.*

class ItemService(
    private val listService: ListService,
    private val repository: ItemRepository,
    // CategoryService.deleteCategory cascades into this service, so the two are a construction cycle.
    private val categoryService: Lazy<CategoryService>,
) {

    private val itemUpdateChannel = MutableSharedFlow<Item>(
        onBufferOverflow = BufferOverflow.DROP_OLDEST, extraBufferCapacity = 1
    )
    private val itemDeleteChannel = MutableSharedFlow<Item>(
        onBufferOverflow = BufferOverflow.DROP_OLDEST, extraBufferCapacity = 1
    )

    val itemUpdates = itemUpdateChannel as SharedFlow<Item>
    val itemDeletions = itemDeleteChannel as SharedFlow<Item>

    /** Unchecked, non-deleted items per list; 0 for a list with none. Runs in the caller's tx or its own. */
    suspend fun countUncheckedByList(listIds: Collection<UUID>): Map<UUID, Int> {
        val counts = tx { repository.countUncheckedByList(listIds) }
        return listIds.associateWith { counts[it] ?: 0 }
    }

    suspend fun getItems(listId: UUID, caller: CallerUsername): Either<ListAuthError, List<Item>> = either {
        tx {
            listService.verifyMembership(caller, listId).bind()
            repository.findActiveByListId(listId)
        }
    }

    suspend fun saveItem(item: Item, caller: CallerUsername): Either<ListAuthError, Item> = either {
        tx {
            listService.verifyMembership(caller, item.listId).bind()

            // Story 9.6 / AR-E9-4 — normalize ONCE, above the branch, so create and update cannot
            // diverge. The client mirrors the same rule for immediate feedback, but the server is the
            // authority: whatever it stores here is what every screen renders.
            val incoming = item.copy(stores = StoreNames.normalize(item.stores))

            // One global read inside the write's tx: it tells a new id from an id stored on this list or on another one.
            val existing = repository.findById(incoming.id)
            // An id on another list is rejected BEFORE the category guard: "this id lives elsewhere" is the more specific
            // diagnosis, and without it the write would silently relocate the item.
            if (existing != null && existing.listId != incoming.listId) {
                throw IllegalArgumentException("Item ${incoming.id} belongs to a different list")
            }
            val stored = existing
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
                // Story 9.3 — the create hole, closed. An add-item dialog left open while a co-member
                // removes the category would otherwise manufacture a fresh orphan on submit, which was the
                // last ordinary way to produce the data shape the cascade above exists to eliminate.
                //
                // With this, no SUCCESSFUL call on the ITEM surface can leave an item pointing at a
                // category that is not on its list. That is narrower than "no orphan is reachable", and
                // deliberately so. The check and the insert share one transaction, and the composite FK
                // `(list_id, category_id)` makes a category removed in between fail the insert instead of orphaning the row.
                requireCategoryOnList(incoming.category, incoming.listId)
                incoming // AC2 — create: addedBy from the caller, exactly as today
            }

            if (stored != null) repository.update(toSave) else repository.insert(toSave)
            afterCommit { itemUpdateChannel.emit(toSave) }
            toSave
        }
    }

    suspend fun deleteItem(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Item> = either {
        tx {
            listService.verifyMembership(caller, listId).bind()
            val deletedItem = findOnList(id, listId) ?: throw IllegalStateException("Item not found")
            repository.delete(id)
            afterCommit { itemDeleteChannel.emit(deletedItem) }
            deletedItem
        }
    }

    suspend fun checkItem(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Item> = either {
        tx {
            listService.verifyMembership(caller, listId).bind()
            val item = findOnList(id, listId) ?: throw IllegalStateException("Item not found")
            val updated = applyCheckState(item, true, item.recurring, Instant.now())
            repository.update(updated)
            afterCommit { itemUpdateChannel.emit(updated) }
            updated
        }
    }

    suspend fun uncheckItem(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Item> = either {
        tx {
            listService.verifyMembership(caller, listId).bind()
            val item = findOnList(id, listId) ?: throw IllegalStateException("Item not found")
            // Story 9.3 — do not RESURRECT an orphan. An item whose category is gone is almost always legacy data;
            // un-checking it would put a soft-deleted row back on both screens under no group.
            // Deliberately `uncheckItem` only, not `checkItem` (md, 2026-09-17).
            requireCategoryOnList(item.category, listId)
            val restored = applyCheckState(item, false, item.recurring, Instant.now())
            repository.update(restored)
            afterCommit { itemUpdateChannel.emit(restored) }
            restored
        }
    }

    /** The stored row, only when it lives on [listId]. Runs in the caller's tx. */
    private suspend fun findOnList(id: UUID, listId: UUID): Item? =
        repository.findById(id)?.takeIf { it.listId == listId }

    suspend fun getStoreSuggestions(listId: UUID, caller: CallerUsername): Either<ListAuthError, List<String>> = either {
        tx {
            listService.verifyMembership(caller, listId).bind()
            // Story 9.6 — flatten every item's stores, then one name per key in the server's order
            // (AR-E9-4). StoreField renders them as offered: the client no longer trims, dedupes or
            // sorts, because only the server can see the whole list.
            StoreNames.suggestions(repository.findActiveByListId(listId).flatMap { it.stores })
        }
    }

    /**
     * Story 9.3 — the item half of `CategoryService.deleteCategory`'s cascade. `internal` on purpose:
     * membership is verified once, by `deleteCategory`, and nothing outside the module should be able
     * to wipe a category's items without deleting the category. `ItemRepository` is only reachable from this service.
     *
     * It emits NOTHING. Both SharedFlows here are `extraBufferCapacity = 1` / `DROP_OLDEST`, so a
     * per-item fan-out would be truncated for any subscriber not consuming instantly — reproducing the
     * partial prune this story removes. The single category DELETED event is authoritative for the
     * children; clients fan it out locally.
     */
    internal suspend fun deleteAllInCategory(listId: UUID, categoryId: UUID): Int =
        tx { repository.deleteAllInCategory(listId, categoryId) }

    /** The item half of the list delete cascade: every row of the list, soft-deleted included. Emits nothing. */
    internal suspend fun deleteAllInList(listId: UUID): Int = tx { repository.deleteAllInList(listId) }

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
        if (!categoryService.value.existsOnList(categoryId, listId)) {
            throw IllegalArgumentException("Category $categoryId does not belong to list $listId")
        }
    }

    /** Hourly step 1: un-check every recurring item whose cadence has elapsed. One tx; UPDATE events after commit. */
    suspend fun restoreRecurring() = tx {
        for (item in repository.findCheckedRecurring()) {
            val elapsedDays = when (item.recurring) {
                Recurring.WEEKLY -> 7L
                Recurring.BIWEEKLY -> 14L
                Recurring.MONTHLY -> 30L
                else -> continue
            }
            val threshold = Instant.now().minus(elapsedDays, ChronoUnit.DAYS)
            if (item.checkedAt == null || item.checkedAt.isAfter(threshold)) continue
            // Through the same transition as every other uncheck (Story 9.5): a restored row must also
            // shed `deleted`/`deletedAt`.
            val restored = applyCheckState(item, false, item.recurring, Instant.now())
            repository.update(restored)
            afterCommit { itemUpdateChannel.emit(restored) }
        }
    }

    /** Hourly step 2: remove soft-deleted items whose `deletedAt` is over an hour old. One tx; DELETE events after commit. */
    suspend fun hardDeleteSoftDeleted() = tx {
        for (item in repository.findSoftDeletedBefore(Instant.now().minus(1, ChronoUnit.HOURS))) {
            repository.delete(item.id)
            afterCommit { itemDeleteChannel.emit(item) }
        }
    }
}
