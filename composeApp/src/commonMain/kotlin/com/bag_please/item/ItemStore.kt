package com.bag_please.item

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object ItemStore {
    private val _items = MutableStateFlow(emptyMap<ItemId, Item>())
    val items: StateFlow<Map<ItemId, Item>> = _items

    fun findById(id: ItemId): Item? = _items.value[id]
    suspend fun save(item: Item): Unit = _items.emit(_items.value + (item.id to item))
}