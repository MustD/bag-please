package com.bagplease.entity.item.db

import com.bagplease.entity.item.Item
import com.bagplease.entity.item.Recurring
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.count
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.less
import org.jetbrains.exposed.v1.r2dbc.deleteWhere
import org.jetbrains.exposed.v1.r2dbc.insert
import org.jetbrains.exposed.v1.r2dbc.select
import org.jetbrains.exposed.v1.r2dbc.selectAll
import org.jetbrains.exposed.v1.r2dbc.update
import java.time.Instant
import java.util.UUID

/**
 * `items` over Exposed-on-R2DBC. Every method must run inside a service's `tx {}` (AD-2); the repository never opens a
 * transaction itself, and only `ItemService` calls it.
 */
class ItemRepository {

    /** Global point read by id, ignoring the list: `saveItem` must tell "new id" from "id on another list". */
    suspend fun findById(id: UUID): Item? =
        ItemTable.selectAll().where { ItemTable.id eq id }
            .map(ItemRowMapper::itemFromRow).toList().firstOrNull()

    /** Non-deleted items of a list. */
    suspend fun findActiveByListId(listId: UUID): List<Item> =
        ItemTable.selectAll().where { (ItemTable.listId eq listId) and (ItemTable.deleted eq false) }
            .orderBy(ItemTable.name to SortOrder.ASC, ItemTable.id to SortOrder.ASC)
            .map(ItemRowMapper::itemFromRow).toList()

    /** Unchecked, non-deleted item count per list; lists with none are absent. */
    suspend fun countUncheckedByList(listIds: Collection<UUID>): Map<UUID, Int> {
        if (listIds.isEmpty()) return emptyMap()
        val count = ItemTable.id.count()
        return ItemTable.select(ItemTable.listId, count)
            .where { (ItemTable.listId inList listIds) and (ItemTable.checked eq false) and (ItemTable.deleted eq false) }
            .groupBy(ItemTable.listId)
            .map { it[ItemTable.listId] to it[count].toInt() }
            .toList().toMap()
    }

    suspend fun insert(item: Item) {
        ItemTable.insert {
            it[id] = item.id
            it[name] = item.name
            it[checked] = item.checked
            it[categoryId] = item.category
            it[listId] = item.listId
            it[stores] = item.stores
            it[recurring] = item.recurring?.name
            it[addedBy] = item.addedBy
            it[deleted] = item.deleted
            it[deletedAt] = item.deletedAt
            it[checkedAt] = item.checkedAt
        }
    }

    /** Writes every mutable column; `id`, `list_id` and `added_by` never change after insert. */
    suspend fun update(item: Item) {
        ItemTable.update({ ItemTable.id eq item.id }) {
            it[name] = item.name
            it[checked] = item.checked
            it[categoryId] = item.category
            it[stores] = item.stores
            it[recurring] = item.recurring?.name
            it[deleted] = item.deleted
            it[deletedAt] = item.deletedAt
            it[checkedAt] = item.checkedAt
        }
    }

    suspend fun delete(id: UUID): Boolean = ItemTable.deleteWhere { ItemTable.id eq id } > 0

    /** Soft-deleted rows included: they still point at the category. Returns the number removed. */
    suspend fun deleteAllInCategory(listId: UUID, categoryId: UUID): Int =
        ItemTable.deleteWhere { (ItemTable.listId eq listId) and (ItemTable.categoryId eq categoryId) }

    suspend fun deleteAllInList(listId: UUID): Int = ItemTable.deleteWhere { ItemTable.listId eq listId }

    suspend fun findCheckedRecurring(): List<Item> =
        ItemTable.selectAll().where {
            (ItemTable.checked eq true) and
                (ItemTable.recurring inList listOf(Recurring.WEEKLY, Recurring.BIWEEKLY, Recurring.MONTHLY).map { it.name })
        }.map(ItemRowMapper::itemFromRow).toList()

    suspend fun findSoftDeletedBefore(cutoff: Instant): List<Item> =
        ItemTable.selectAll().where { (ItemTable.deleted eq true) and (ItemTable.deletedAt less cutoff) }
            .map(ItemRowMapper::itemFromRow).toList()
}
