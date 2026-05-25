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
import java.util.UUID

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

        val owner = userRepository.findByUsername(caller.value)
            ?: throw IllegalStateException("User not found: ${caller.value}")

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

        // cascade: items → categories → list (order enables lazy-sync recovery on partial failure)
        val deletedItems = itemRepository.deleteAllInList(id)
        val deletedCategories = categoryRepository.deleteAllInList(id)
        listRepository.delete(id)

        // evict in-memory caches after MongoDB deletes succeed
        itemStorage.evictList(id)
        categoryStorage.evictList(id)
        listStorage.evictFromCache(id)

        DeleteListResult(
            deletedItemCount = deletedItems,
            deletedCategoryCount = deletedCategories,
        )
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
        if (existing != null && existing.status != "DECLINED") raise(ListAuthError.AlreadyPending(username))
        listMemberRepository.save(ListMember(listId, targetUser.id, username, "PENDING", Instant.now()))
        list
    }

    suspend fun acceptInvite(listId: UUID, caller: CallerUsername): Either<ListAuthError, List> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        val list = listStorage.getById(listId) ?: raise(ListAuthError.NotMember)
        val callerUser = userRepository.findByUsername(caller.value)
            ?: raise(ListAuthError.CallerNotFound)
        val member = listMemberRepository.findByListIdAndUserId(listId, callerUser.id)
        if (member == null || member.status != "PENDING") raise(ListAuthError.NotPendingInvite)
        listMemberRepository.save(member.copy(status = "ACCEPTED"))
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
        ensure(member.status == "PENDING") { ListAuthError.NotPendingInvite }
        listMemberRepository.save(member.copy(status = "DECLINED"))
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
