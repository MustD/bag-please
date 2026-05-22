package com.bagplease.entity.list

import arrow.core.Either
import arrow.core.raise.either
import arrow.core.raise.ensure
import com.bagplease.entity.category.CategoryStorage
import com.bagplease.entity.category.mongo.CategoryRepository
import com.bagplease.entity.item.ItemStorage
import com.bagplease.entity.item.mongo.ItemRepository
import com.bagplease.entity.list.mongo.ListRepository
import com.bagplease.entity.user.mongo.UserRepository
import com.bagplease.features.auth.CallerUsername
import java.time.Instant
import java.util.UUID

sealed class ListAuthError {
    data object NotMember : ListAuthError()
    data object NotOwner : ListAuthError()
    data object AdminBlocked : ListAuthError()
}

data class DeleteListResult(
    val deletedItemCount: Int,
    val deletedCategoryCount: Int,
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

    suspend fun getLists(caller: CallerUsername): Either<ListAuthError, kotlin.collections.List<List>> = either {
        ensure(caller.value != adminLogin) { ListAuthError.AdminBlocked }
        listStorage.getByMemberUsername(caller.value)
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
}
