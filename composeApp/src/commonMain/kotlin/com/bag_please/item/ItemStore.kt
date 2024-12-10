package com.bag_please.item

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object ItemStore {
    private val _items = MutableStateFlow(emptyMap<ItemId, Item>())
    val items: StateFlow<Map<ItemId, Item>> = _items

    suspend fun save(item: Item): Unit = _items.emit(_items.value + (item.id to item))
}