package com.bagplease.entity.list

import arrow.core.Either
import arrow.core.raise.either
import arrow.core.raise.ensure
import com.bagplease.entity.category.CategoryStorage
import com.bagplease.entity.category.mongo.CategoryRepository
import com.bagplease.entity.item.ItemStorage
import com.bagplease.entity.item.mongo.ItemRepository
import com.bagplease.entity.list.mongo.ListMemberRepository
import com.bagplease.entity.list.mongo.ListRepository
import com.bagplease.entity.user.mongo.UserRepository
import com.bagplease.features.auth.CallerUsername
import java.time.Instant
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

data class GetListsResult(
    val lists: kotlin.collections.List<List>,
    val pendingInvites: kotlin.collections.List<PendingInvite>,
)

class ListService(
    private val listStorage: ListStorage,
    private val listRepository: ListRepository,
    private val userRepository: UserRepository,
    private val itemRepository: ItemRepository,
    private val categoryRepository: CategoryRepository,
    private val itemStorage: ItemStorage,
    private val categoryStorage: CategoryStorage,
    private val adminLogin: String,
    private val listMemberRepository: ListMemberRepository,
) {

    suspend fun createList(name: String, emoji: String?, caller: CallerUsername): Either<ListAuthError, List> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        if (name.length > 100) throw IllegalArgumentException("List name must not exceed 100 characters")

        // A caller whose user row has gone (admin delete, Story 9.4) must be REFUSED, not crashed on: the purge
        // runs after the user row is deleted, so a createList racing it on a still-valid access token lands here,
        // and re-creating a list for a user who no longer exists is exactly what the ordering exists to prevent.
        val owner = userRepository.findByUsername(caller.value) ?: raise(ListAuthError.CallerNotFound)

        val list = List(
            name = name,
            emoji = emoji,
            ownerId = owner.id,
            ownerUsername = caller.value,
            members = listOf(owner.id),
            memberUsernames = listOf(caller.value),
            origin = "USER_CREATED",
            createdAt = Instant.now(),
        )
        listStorage.save(list)
        list
    }

    suspend fun getLists(caller: CallerUsername): Either<ListAuthError, GetListsResult> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        val memberLists = listStorage.getByMemberUsername(caller.value)
        val callerUser = userRepository.findByUsername(caller.value)
        val pendingInvites = if (callerUser != null) {
            listMemberRepository.findPendingByUserId(callerUser.id).mapNotNull { invite ->
                val list = listStorage.getById(invite.listId) ?: return@mapNotNull null
                PendingInvite(
                    listId = list.id,
                    listName = list.name,
                    listEmoji = list.emoji,
                    ownerUsername = list.ownerUsername,
                )
            }
        } else {
            emptyList()
        }
        GetListsResult(lists = memberLists, pendingInvites = pendingInvites)
    }

    suspend fun renameList(id: UUID, name: String, caller: CallerUsername): Either<ListAuthError, List> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        if (name.length > 100) throw IllegalArgumentException("List name must not exceed 100 characters")
        val callerUser = userRepository.findByUsername(caller.value) ?: raise(ListAuthError.CallerNotFound)
        val list = listStorage.getById(id) ?: raise(ListAuthError.NotMember)
        if (list.ownerId != callerUser.id) raise(ListAuthError.NotOwner)
        listStorage.rename(id, name)
    }

    suspend fun deleteList(id: UUID, caller: CallerUsername): Either<ListAuthError, DeleteListResult> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }

        val list = listStorage.getById(id) ?: raise(ListAuthError.NotMember)
        ensure(list.ownerUsername == caller.value) { ListAuthError.NotOwner }

        cascadeDeleteList(list)
    }

    // The one place a list and everything hanging off it is destroyed — `deleteList` (owner-initiated) and
    // `purgeUser` (admin user delete, Story 9.4) both route through here, so the two can never drift apart.
    // It performs NO authorization of its own: every caller gates first.
    //
    // cascade: items → categories → members → list. The ordering is a CONVENTION, not a safety
    // property — these are four independent Mongo deletes with no session, so a throw at
    // listRepository.delete leaves a live list whose children are already gone, and list_members
    // has no in-memory cache to re-sync from. Neither ordering is failure-safe; only a single
    // ClientSession transaction would be (filed in deferred-work.md). Do not restore the earlier
    // "order enables lazy-sync recovery on partial failure" rationale — it had this backwards.
    private suspend fun cascadeDeleteList(list: List): DeleteListResult {
        val id = list.id
        val deletedItems = itemRepository.deleteAllInList(id)
        val deletedCategories = categoryRepository.deleteAllInList(id)
        listMemberRepository.deleteAllInList(id)
        listRepository.delete(id)

        // evict in-memory caches after MongoDB deletes succeed
        itemStorage.evictList(id)
        categoryStorage.evictList(id)
        listStorage.evictFromCache(id)

        return DeleteListResult(
            deletedItemCount = deletedItems,
            deletedCategoryCount = deletedCategories,
        )
    }

    // Removes every trace of a deleted user from list data (Story 9.4). Called by
    // `UserAdminMutations.deleteUser` AFTER the user row is gone and BEFORE sessions are invalidated — that order is
    // load-bearing, see the comment there.
    //
    // Deliberately caller-less: it takes no `CallerUsername` and runs no `adminLogin` / ownership gate, because the
    // subject of the purge is not the caller and the caller has already been proven an admin at the GraphQL boundary.
    // It is the single documented exception to NFR-L2. It is also idempotent: a second run finds no owned lists, no
    // member arrays to strip and no rows to delete, and changes nothing.
    //
    // Writes go through `ListStorage.save` and the private cascade only — never `ListRepository` directly, or the
    // in-memory list cache diverges from Mongo and keeps serving the phantom member. No subscription event is
    // emitted: a member sitting on a deleted owner's list is redirected by the Story 5.6 FORBIDDEN guard on their
    // next data access.
    suspend fun purgeUser(userId: UUID, username: String) {
        val all = listStorage.getAll()

        // Lists the user OWNED go away entirely, with their items, categories and member rows. No ownership
        // transfer — that is a product decision, not an omission (md, 2026-09-15).
        all.filter { it.ownerId == userId }.forEach { cascadeDeleteList(it) }

        // Lists they merely BELONGED to survive, minus them. Both arrays are stripped: `memberUsernames` is what
        // `getLists` and the membership guard read, `members` is what the Share dialog resolves ids from.
        //
        // Each one is RE-READ immediately before its save, exactly as every other mutating path here does.
        // `ListStorage.save` is a whole-document upsert, so stripping a copy taken in the snapshot above — which is
        // now several Mongo round-trips old, the owned-list cascades having run since — would silently revert a
        // concurrent accept/remove/rename, and would resurrect a list deleted in the meantime. A list that has gone
        // is skipped: there is nothing left to strip.
        all.filter { it.ownerId != userId }
            .filter { it.members.contains(userId) || it.memberUsernames.contains(username) }
            .forEach { stale ->
                val list = listStorage.getById(stale.id) ?: return@forEach
                listStorage.save(
                    list.copy(
                        members = list.members.filter { it != userId },
                        memberUsernames = list.memberUsernames.filter { it != username },
                    )
                )
            }

        // Last, so a row is never orphaned by a half-done strip above: every `list_members` row the user held, in
        // any status. The owned-list cascade has already removed its own rows; this catches the rest.
        listMemberRepository.deleteAllForUser(userId)
    }

    // How many lists a user owns — the number the admin's delete confirmation states before destroying them.
    // Answered off the in-memory list cache, so a 20-row admin page costs one scan and no Mongo round-trip.
    suspend fun countOwnedLists(userId: UUID): Int = listStorage.getAll().count { it.ownerId == userId }

    suspend fun countOwnedLists(userIds: Collection<UUID>): Map<UUID, Int> {
        if (userIds.isEmpty()) return emptyMap()
        val wanted = userIds.toSet()
        val counts = listStorage.getAll()
            .filter { wanted.contains(it.ownerId) }
            .groupingBy { it.ownerId }
            .eachCount()
        return wanted.associateWith { counts[it] ?: 0 }
    }

    suspend fun verifyMembership(caller: CallerUsername, listId: UUID): Either<ListAuthError, Unit> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        val list = listStorage.getById(listId) ?: raise(ListAuthError.NotMember)
        ensure(list.memberUsernames.contains(caller.value)) { ListAuthError.NotMember }
    }

    fun isMember(caller: CallerUsername, listId: UUID): Boolean {
        val list = listStorage.getByIdCached(listId) ?: return false
        return list.memberUsernames.contains(caller.value)
    }

    suspend fun shareList(listId: UUID, username: String, caller: CallerUsername): Either<ListAuthError, List> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        val list = listStorage.getById(listId) ?: raise(ListAuthError.NotMember)
        ensure(list.ownerUsername == caller.value) { ListAuthError.NotOwner }
        ensure(username != caller.value) { ListAuthError.SelfShare }
        val targetUser = userRepository.findByUsername(username) ?: raise(ListAuthError.UserNotFound(username))
        ensure(!list.memberUsernames.contains(username)) { ListAuthError.AlreadyMember(username) }
        val existing = listMemberRepository.findByListIdAndUserId(listId, targetUser.id)
        if (existing != null && existing.status != MemberStatus.DECLINED) raise(ListAuthError.AlreadyPending(username))
        listMemberRepository.save(ListMember(listId, targetUser.id, username, MemberStatus.PENDING, Instant.now()))
        list
    }

    suspend fun acceptInvite(listId: UUID, caller: CallerUsername): Either<ListAuthError, List> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        val list = listStorage.getById(listId) ?: raise(ListAuthError.NotMember)
        val callerUser = userRepository.findByUsername(caller.value)
            ?: raise(ListAuthError.CallerNotFound)
        val member = listMemberRepository.findByListIdAndUserId(listId, callerUser.id)
        if (member == null || member.status != MemberStatus.PENDING) raise(ListAuthError.NotPendingInvite)
        listMemberRepository.save(member.copy(status = MemberStatus.ACCEPTED))
        val updatedList = list.copy(
            members = list.members + callerUser.id,
            memberUsernames = list.memberUsernames + caller.value,
        )
        listStorage.save(updatedList)
        updatedList
    }

    suspend fun rejectInvite(listId: UUID, caller: CallerUsername): Either<ListAuthError, Boolean> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        listStorage.getById(listId) ?: raise(ListAuthError.NotMember)
        val callerUser = userRepository.findByUsername(caller.value)
            ?: raise(ListAuthError.CallerNotFound)
        val member = listMemberRepository.findByListIdAndUserId(listId, callerUser.id)
            ?: raise(ListAuthError.NotPendingInvite)
        ensure(member.status == MemberStatus.PENDING) { ListAuthError.NotPendingInvite }
        listMemberRepository.save(member.copy(status = MemberStatus.DECLINED))
        true
    }

    suspend fun removeMember(listId: UUID, username: String, caller: CallerUsername): Either<ListAuthError, List> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        val list = listStorage.getById(listId) ?: raise(ListAuthError.NotMember)
        ensure(list.ownerUsername == caller.value) { ListAuthError.NotOwner }
        ensure(username != list.ownerUsername) { ListAuthError.CannotRemoveOwner }
        ensure(list.memberUsernames.contains(username)) { ListAuthError.NotMember }
        val targetUser = userRepository.findByUsername(username) ?: raise(ListAuthError.UserNotFound(username))
        val updatedList = list.copy(
            members = list.members.filter { it != targetUser.id },
            memberUsernames = list.memberUsernames.filter { it != username },
        )
        listMemberRepository.deleteByListIdAndUserId(listId, targetUser.id)
        listStorage.save(updatedList)
        updatedList
    }

    suspend fun leaveList(listId: UUID, caller: CallerUsername): Either<ListAuthError, Boolean> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        val list = listStorage.getById(listId) ?: raise(ListAuthError.NotMember)
        ensure(list.memberUsernames.contains(caller.value)) { ListAuthError.NotMember }
        ensure(list.ownerUsername != caller.value) { ListAuthError.CannotLeaveAsOwner }
        val callerUser = userRepository.findByUsername(caller.value)
            ?: raise(ListAuthError.CallerNotFound)
        val updatedList = list.copy(
            members = list.members.filter { it != callerUser.id },
            memberUsernames = list.memberUsernames.filter { it != caller.value },
        )
        listMemberRepository.deleteByListIdAndUserId(listId, callerUser.id)
        listStorage.save(updatedList)
        true
    }
}
