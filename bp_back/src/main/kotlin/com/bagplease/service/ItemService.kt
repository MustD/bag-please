package com.bagplease.service

import com.bagplease.storage.Item
import com.bagplease.storage.ItemStorage
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import java.util.*

object ItemService {

    private val storage = ItemStorage
    private val itemUpdateChannel = MutableSharedFlow<Item>()
    private val itemDeleteChannel = MutableSharedFlow<Item>()

    val itemUpdates = itemUpdateChannel as SharedFlow<Item>
    val itemDeletions = itemDeleteChannel as SharedFlow<Item>

    /**
     * Retrieves a list of items.
     *
     * This method asynchronously fetches a list of items from storage using the `getAll` method and returns the result.
     *
     * @return A list of items.
     */
    suspend fun getItems(): List<Item> = storage.getAll()

    /**
     * Saves an item to the storage.
     *
     * @param item The item to be saved.
     * @return The saved item.
     */
    suspend fun saveItem(item: Item): Item {
        val savedItem = storage.save(item)
        itemUpdateChannel.emit(savedItem)
        return savedItem
    }

    /**
     * Deletes an item with the specified ID from the storage.
     *
     * @param id The ID of the item to be deleted.
     * @return The deleted item.
     * @throws IllegalStateException if the item is not found in the storage.
     */
    suspend fun deleteItem(id: UUID): Item {
        val deletedItem = storage.delete(id)
        itemDeleteChannel.emit(deletedItem)
        return deletedItem
    }
}