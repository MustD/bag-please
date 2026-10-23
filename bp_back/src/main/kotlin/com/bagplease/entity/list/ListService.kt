package com.bagplease.entity.list

import arrow.core.Either
import arrow.core.raise.either
import arrow.core.raise.ensure
import com.bagplease.entity.category.CategoryService
import com.bagplease.entity.item.ItemService
import com.bagplease.entity.list.db.DuplicateMemberException
import com.bagplease.entity.list.db.ListRepository
import com.bagplease.entity.user.User
import com.bagplease.entity.user.UserLookup
import com.bagplease.features.auth.CallerUsername
import com.bagplease.plugins.tx
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.*

sealed class ListAuthError {
    data object NotMember : ListAuthError()
    data object NotOwner : ListAuthError()
    data object AdminBlocked : ListAuthError()
    data class UserNotFound(val username: String) : ListAuthError()
    data class AlreadyMember(val username: String) : ListAuthError()
    data class AlreadyPending(val username: String) : ListAuthError()
    data object SelfShare : ListAuthError()
    data object CannotRemoveOwner : ListAuthError()
    data object CannotLeaveAsOwner : ListAuthError()
    data object NotPendingInvite : ListAuthError()
    data object CallerNotFound : ListAuthError()
}

data class DeleteListResult(
    val deletedItemCount: Int,
    val deletedCategoryCount: Int,
)

data class PendingInvite(
    val listId: UUID,
    val listName: String,
    val listEmoji: String?,
    val ownerUsername: String,
)

/** A list as the API shows it: the list, its PENDING + ACCEPTED members (owner excluded) and its unchecked item count. */
data class ListView(
    val list: List,
    val members: kotlin.collections.List<ListMember>,
    val uncheckedItemCount: Int,
)

data class GetListsResult(
    val lists: kotlin.collections.List<ListView>,
    val pendingInvites: kotlin.collections.List<PendingInvite>,
)

class ListService(
    private val repository: ListRepository,
    private val userLookup: UserLookup,
    // Items verify membership through this service, so the two are a
    // construction cycle: the item service is resolved on first use.
    private val itemService: Lazy<ItemService>,
    // Categories are reached only through their service; it depends on this one, so it is resolved on first use.
    private val categoryService: Lazy<CategoryService>,
    private val adminLogin: String,
) {

    // Composes the API view of the given lists: members (owner excluded) and unchecked counts. Runs in the caller's tx.
    private suspend fun views(lists: kotlin.collections.List<List>): kotlin.collections.List<ListView> {
        if (lists.isEmpty()) return emptyList()
        val ids = lists.map { it.id }
        val members = repository.findVisibleMembers(ids)
        val counts = itemService.value.countUncheckedByList(ids)
        return lists.map { ListView(it, members[it.id] ?: emptyList(), counts[it.id] ?: 0) }
    }

    private suspend fun view(list: List): ListView = views(listOf(list)).single()

    suspend fun createList(name: String, emoji: String?, caller: CallerUsername): Either<ListAuthError, ListView> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        if (name.length > 100) throw IllegalArgumentException("List name must not exceed 100 characters")

        tx {
            // A caller whose user row has gone (admin delete, Story 9.4) must be REFUSED, not crashed on: a createList
            // racing the deletion on a still-valid access token lands here.
            val owner = userLookup.findByUsername(caller.value) ?: raise(ListAuthError.CallerNotFound)
            // The list row and the owner's ACCEPTED row are written together or not at all.
            val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
            val list = List(
                name = name,
                emoji = emoji,
                ownerId = owner.id,
                ownerUsername = owner.username,
                origin = "USER_CREATED",
                createdAt = now,
            )
            repository.insertList(list)
            repository.insertMember(list.id, owner.id, MemberStatus.ACCEPTED, now)
            view(list)
        }
    }

    // The Epic 4 startup migration: one default list for the migration target, with the owner's ACCEPTED row.
    suspend fun seedMigratedList(owner: User, name: String, emoji: String?): List = tx {
        val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
        val list = List(
            name = name,
            emoji = emoji,
            ownerId = owner.id,
            ownerUsername = owner.username,
            origin = "MIGRATED",
            createdAt = now,
        )
        repository.insertList(list)
        repository.insertMember(list.id, owner.id, MemberStatus.ACCEPTED, now)
        list
    }

    suspend fun getLists(caller: CallerUsername): Either<ListAuthError, GetListsResult> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        tx {
            val callerUser = userLookup.findByUsername(caller.value)
            if (callerUser == null) {
                GetListsResult(lists = emptyList(), pendingInvites = emptyList())
            } else {
                val pending = repository.findPendingLists(callerUser.id).map {
                    PendingInvite(listId = it.id, listName = it.name, listEmoji = it.emoji, ownerUsername = it.ownerUsername)
                }
                GetListsResult(lists = views(repository.findAcceptedLists(callerUser.id)), pendingInvites = pending)
            }
        }
    }

    suspend fun renameList(id: UUID, name: String, caller: CallerUsername): Either<ListAuthError, ListView> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        if (name.length > 100) throw IllegalArgumentException("List name must not exceed 100 characters")
        tx {
            val callerUser = userLookup.findByUsername(caller.value) ?: raise(ListAuthError.CallerNotFound)
            val list = repository.findById(id) ?: raise(ListAuthError.NotMember)
            if (list.ownerId != callerUser.id) raise(ListAuthError.NotOwner)
            repository.rename(id, name)
            view(list.copy(name = name))
        }
    }

    suspend fun deleteList(id: UUID, caller: CallerUsername): Either<ListAuthError, DeleteListResult> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        tx {
            val list = repository.findById(id) ?: raise(ListAuthError.NotMember)
            ensure(list.ownerUsername == caller.value) { ListAuthError.NotOwner }
            cascadeDeleteList(list)
        }
    }

    // The one place a list and everything hanging off it is destroyed: `deleteList` (owner-initiated) and
    // `purgeUser` (admin user delete) both route through here. It performs NO authorization of its own.
    //
    // cascade: items -> categories -> members -> list, all in the caller's tx.
    private suspend fun cascadeDeleteList(list: List): DeleteListResult {
        val id = list.id
        val deletedItems = itemService.value.deleteAllInList(id)
        val deletedCategories = categoryService.value.deleteAllInList(id)
        repository.deleteMembersInList(id)
        repository.deleteList(id)

        return DeleteListResult(
            deletedItemCount = deletedItems,
            deletedCategoryCount = deletedCategories,
        )
    }

    // Removes every trace of a deleted user from list data (Story 9.4): owned lists are destroyed with their content
    // (no ownership transfer, a product decision), then every membership row the user holds in any status goes.
    // Called by `UserService.deleteUser` inside its transaction, BEFORE the `users` row is deleted (the FKs from
    // `lists.owner_id` / `list_members.user_id` are RESTRICT). Deliberately caller-less: the caller has already been
    // proven an admin at the GraphQL boundary (the single documented exception to NFR-L2). Idempotent.
    suspend fun purgeUser(userId: UUID) = tx {
        repository.findOwnedLists(userId).forEach { cascadeDeleteList(it) }
        repository.deleteMembersForUser(userId)
        Unit
    }

    // How many lists a user owns: the number the admin's delete confirmation states before destroying them.
    suspend fun countOwnedLists(userId: UUID): Int = tx { repository.countOwned(userId) }

    suspend fun countOwnedLists(userIds: Collection<UUID>): Map<UUID, Int> {
        if (userIds.isEmpty()) return emptyMap()
        val wanted = userIds.toSet()
        val counts = tx { repository.countOwned(wanted) }
        return wanted.associateWith { counts[it] ?: 0 }
    }

    // NFR-L2: callers run this inside the same tx as the work it guards (it joins an open tx).
    suspend fun verifyMembership(caller: CallerUsername, listId: UUID): Either<ListAuthError, Unit> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        val member = tx { repository.isAcceptedMember(listId, caller.value) }
        ensure(member) { ListAuthError.NotMember }
    }

    // One indexed read in its own tx; the subscription re-check on every event.
    suspend fun isMember(caller: CallerUsername, listId: UUID): Boolean =
        tx { repository.isAcceptedMember(listId, caller.value) }

    suspend fun shareList(listId: UUID, username: String, caller: CallerUsername): Either<ListAuthError, ListView> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        tx {
            val list = repository.findById(listId) ?: raise(ListAuthError.NotMember)
            ensure(list.ownerUsername == caller.value) { ListAuthError.NotOwner }
            ensure(username != caller.value) { ListAuthError.SelfShare }
            val targetUser = userLookup.findByUsername(username) ?: raise(ListAuthError.UserNotFound(username))
            val existing = repository.findMember(listId, targetUser.id)
            val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
            when (existing?.status) {
                MemberStatus.ACCEPTED -> raise(ListAuthError.AlreadyMember(username))
                MemberStatus.PENDING -> raise(ListAuthError.AlreadyPending(username))
                // Re-inviting a declined user revives the row with a fresh created_at.
                MemberStatus.DECLINED -> repository.updateMember(listId, targetUser.id, MemberStatus.PENDING, now)
                null -> try {
                    repository.insertMember(listId, targetUser.id, MemberStatus.PENDING, now)
                } catch (e: DuplicateMemberException) {
                    raise(ListAuthError.AlreadyPending(username))
                }
            }
            view(list)
        }
    }

    suspend fun acceptInvite(listId: UUID, caller: CallerUsername): Either<ListAuthError, ListView> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        tx {
            val list = repository.findById(listId) ?: raise(ListAuthError.NotMember)
            val callerUser = userLookup.findByUsername(caller.value) ?: raise(ListAuthError.CallerNotFound)
            val member = repository.findMember(listId, callerUser.id)
            if (member == null || member.status != MemberStatus.PENDING) raise(ListAuthError.NotPendingInvite)
            repository.updateMember(listId, callerUser.id, MemberStatus.ACCEPTED)
            view(list)
        }
    }

    suspend fun rejectInvite(listId: UUID, caller: CallerUsername): Either<ListAuthError, Boolean> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        tx {
            repository.findById(listId) ?: raise(ListAuthError.NotMember)
            val callerUser = userLookup.findByUsername(caller.value) ?: raise(ListAuthError.CallerNotFound)
            val member = repository.findMember(listId, callerUser.id) ?: raise(ListAuthError.NotPendingInvite)
            ensure(member.status == MemberStatus.PENDING) { ListAuthError.NotPendingInvite }
            repository.updateMember(listId, callerUser.id, MemberStatus.DECLINED)
            true
        }
    }

    suspend fun removeMember(listId: UUID, username: String, caller: CallerUsername): Either<ListAuthError, ListView> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        tx {
            val list = repository.findById(listId) ?: raise(ListAuthError.NotMember)
            ensure(list.ownerUsername == caller.value) { ListAuthError.NotOwner }
            ensure(username != list.ownerUsername) { ListAuthError.CannotRemoveOwner }
            ensure(repository.isAcceptedMember(listId, username)) { ListAuthError.NotMember }
            val targetUser = userLookup.findByUsername(username) ?: raise(ListAuthError.UserNotFound(username))
            repository.deleteMember(listId, targetUser.id)
            view(list)
        }
    }

    suspend fun leaveList(listId: UUID, caller: CallerUsername): Either<ListAuthError, Boolean> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        tx {
            val list = repository.findById(listId) ?: raise(ListAuthError.NotMember)
            ensure(repository.isAcceptedMember(listId, caller.value)) { ListAuthError.NotMember }
            ensure(list.ownerUsername != caller.value) { ListAuthError.CannotLeaveAsOwner }
            val callerUser = userLookup.findByUsername(caller.value) ?: raise(ListAuthError.CallerNotFound)
            repository.deleteMember(listId, callerUser.id)
            true
        }
    }
}
