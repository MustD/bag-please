package com.bag_please.item.logic

import com.bag_please.AppEventBus
import com.bag_please.item.Item
import com.bag_please.item.ItemId
import com.bag_please.item.logic.events.SaveItem
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.mapNotNull
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

object ItemService {
    private val eventBus = AppEventBus
    private val repository = ItemRepository

    fun CoroutineScope.startItemEventHandler() = launch {
        AppEventBus.events.collect { event ->
            when (event) {
                is SaveItem -> repository.save(event.payload)
            }
        }
    }

    fun stateFlow(): StateFlow<Map<ItemId, Item>> = repository.items

    private fun createDefaultItem(
        id: ItemId = ItemId.random(),
        checked: Boolean = false,
        title: String = "",
    ) = Item(id, checked, title)

    fun CoroutineScope.stateItemById(id: ItemId): StateFlow<Item> {
        val initial = repository.items.value[id] ?: createDefaultItem(id)
        return repository.items.mapNotNull { items ->
            items[id]
        }.stateIn(scope = this, started = SharingStarted.Lazily, initialValue = initial)
    }

    fun CoroutineScope.saveItem(item: Item) = launch { eventBus.emit(SaveItem(item)) }

}