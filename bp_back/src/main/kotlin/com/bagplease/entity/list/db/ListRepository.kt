package com.bagplease.entity.list.db

import com.bagplease.entity.list.List
import com.bagplease.entity.list.ListMember
import com.bagplease.entity.list.MemberStatus
import com.bagplease.entity.user.db.UserTable
import com.bagplease.plugins.isUniqueViolation
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.r2dbc.deleteWhere
import org.jetbrains.exposed.v1.r2dbc.insert
import org.jetbrains.exposed.v1.r2dbc.select
import org.jetbrains.exposed.v1.r2dbc.selectAll
import org.jetbrains.exposed.v1.r2dbc.update
import java.time.Instant
import java.util.UUID

/** Thrown by [ListRepository.insertMember] when the (list, user) row already exists (SQLSTATE 23505). */
class DuplicateMemberException(cause: Throwable) : RuntimeException("Membership row already exists", cause)

/**
 * `lists` and `list_members` over Exposed-on-R2DBC. Every method must run inside a service's `tx {}` (AD-2); the
 * repository never opens a transaction itself. Owner and member usernames are joined from `users`, never stored.
 */
class ListRepository {

    private val listsWithOwner = ListTable.join(UserTable, JoinType.INNER, ListTable.ownerId, UserTable.id)
    private val membersWithUser = ListMemberTable.join(UserTable, JoinType.INNER, ListMemberTable.userId, UserTable.id)

    suspend fun insertList(list: List) {
        ListTable.insert {
            it[id] = list.id
            it[name] = list.name
            it[emoji] = list.emoji
            it[ownerId] = list.ownerId
            it[origin] = list.origin
            it[createdAt] = list.createdAt
        }
    }

    suspend fun insertMember(listId: UUID, userId: UUID, status: MemberStatus, createdAt: Instant) {
        try {
            ListMemberTable.insert {
                it[ListMemberTable.listId] = listId
                it[ListMemberTable.userId] = userId
                it[ListMemberTable.status] = status.name
                it[ListMemberTable.createdAt] = createdAt
            }
        } catch (e: Exception) {
            if (e.isUniqueViolation()) throw DuplicateMemberException(e)
            throw e
        }
    }

    suspend fun findById(id: UUID): List? =
        listsWithOwner.selectAll().where { ListTable.id eq id }
            .map(ListRowMapper::listFromRow).toList().firstOrNull()

    /** Lists the user is an ACCEPTED member of (the owner included), oldest first. */
    suspend fun findAcceptedLists(userId: UUID): kotlin.collections.List<List> =
        ListTable
            .join(ListMemberTable, JoinType.INNER, ListTable.id, ListMemberTable.listId)
            .join(UserTable, JoinType.INNER, ListTable.ownerId, UserTable.id)
            .selectAll()
            .where { (ListMemberTable.userId eq userId) and (ListMemberTable.status eq MemberStatus.ACCEPTED.name) }
            .orderBy(ListTable.createdAt to SortOrder.ASC, ListTable.id to SortOrder.ASC)
            .map(ListRowMapper::listFromRow).toList()

    /** Lists the user holds a PENDING invite to, oldest invite first. */
    suspend fun findPendingLists(userId: UUID): kotlin.collections.List<List> =
        ListTable
            .join(ListMemberTable, JoinType.INNER, ListTable.id, ListMemberTable.listId)
            .join(UserTable, JoinType.INNER, ListTable.ownerId, UserTable.id)
            .selectAll()
            .where { (ListMemberTable.userId eq userId) and (ListMemberTable.status eq MemberStatus.PENDING.name) }
            .orderBy(ListMemberTable.createdAt to SortOrder.ASC, ListTable.id to SortOrder.ASC)
            .map(ListRowMapper::listFromRow).toList()

    /**
     * PENDING + ACCEPTED rows of the given lists EXCLUDING each list's owner, oldest first (`created_at`, `user_id`
     * tiebreak). DECLINED is never returned.
     */
    suspend fun findVisibleMembers(listIds: Collection<UUID>): Map<UUID, kotlin.collections.List<ListMember>> {
        if (listIds.isEmpty()) return emptyMap()
        return membersWithUser
            .join(ListTable, JoinType.INNER, ListMemberTable.listId, ListTable.id)
            .selectAll()
            .where {
                (ListMemberTable.listId inList listIds) and
                    (ListMemberTable.status inList listOf(MemberStatus.PENDING.name, MemberStatus.ACCEPTED.name)) and
                    (ListMemberTable.userId neq ListTable.ownerId)
            }
            .orderBy(ListMemberTable.createdAt to SortOrder.ASC, ListMemberTable.userId to SortOrder.ASC)
            .map(ListRowMapper::memberFromRow).toList()
            .groupBy { it.listId }
    }

    suspend fun findMember(listId: UUID, userId: UUID): ListMember? =
        membersWithUser.selectAll()
            .where { (ListMemberTable.listId eq listId) and (ListMemberTable.userId eq userId) }
            .map(ListRowMapper::memberFromRow).toList().firstOrNull()

    /** The one indexed read behind every membership check: an ACCEPTED row joined to `users` by username. */
    suspend fun isAcceptedMember(listId: UUID, username: String): Boolean =
        membersWithUser.selectAll()
            .where {
                (ListMemberTable.listId eq listId) and (UserTable.username eq username) and
                    (ListMemberTable.status eq MemberStatus.ACCEPTED.name)
            }
            .count() > 0

    suspend fun updateMember(listId: UUID, userId: UUID, status: MemberStatus, createdAt: Instant? = null) {
        ListMemberTable.update({ (ListMemberTable.listId eq listId) and (ListMemberTable.userId eq userId) }) {
            it[ListMemberTable.status] = status.name
            if (createdAt != null) it[ListMemberTable.createdAt] = createdAt
        }
    }

    suspend fun deleteMember(listId: UUID, userId: UUID) {
        ListMemberTable.deleteWhere { (ListMemberTable.listId eq listId) and (ListMemberTable.userId eq userId) }
    }

    suspend fun rename(id: UUID, name: String) {
        ListTable.update({ ListTable.id eq id }) { it[ListTable.name] = name }
    }

    suspend fun deleteMembersInList(listId: UUID): Int =
        ListMemberTable.deleteWhere { ListMemberTable.listId eq listId }

    suspend fun deleteList(id: UUID): Boolean = ListTable.deleteWhere { ListTable.id eq id } > 0

    /** Every membership row the user holds, in any status. */
    suspend fun deleteMembersForUser(userId: UUID): Int =
        ListMemberTable.deleteWhere { ListMemberTable.userId eq userId }

    suspend fun findOwnedLists(userId: UUID): kotlin.collections.List<List> =
        listsWithOwner.selectAll().where { ListTable.ownerId eq userId }
            .map(ListRowMapper::listFromRow).toList()

    suspend fun countOwned(userId: UUID): Int =
        ListTable.selectAll().where { ListTable.ownerId eq userId }.count().toInt()

    suspend fun countOwned(userIds: Collection<UUID>): Map<UUID, Int> {
        if (userIds.isEmpty()) return emptyMap()
        return ListTable.select(ListTable.ownerId).where { ListTable.ownerId inList userIds }
            .map { it[ListTable.ownerId] }.toList()
            .groupingBy { it }.eachCount()
    }
}
