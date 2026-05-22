package com.bagplease.entity.item

import arrow.core.Either
import arrow.core.raise.either
import com.bagplease.entity.list.ListAuthError
import com.bagplease.entity.list.ListService
import com.bagplease.features.auth.CallerUsername
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import java.util.*

class ItemService(
    private val storage: ItemStorage,
    private val listService: ListService,
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
        val savedItem = storage.save(item)
        itemUpdateChannel.emit(savedItem)
        savedItem
    }

    suspend fun deleteItem(id: UUID, listId: UUID, caller: CallerUsername): Either<ListAuthError, Item> = either {
        listService.verifyMembership(caller, listId).bind()
        val deletedItem = storage.delete(id, listId)
        itemDeleteChannel.emit(deletedItem)
        deletedItem
    }
}
