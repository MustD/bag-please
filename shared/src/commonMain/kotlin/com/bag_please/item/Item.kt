package com.bag_please.item

data class Item(
    val id: ItemId = ItemId.random(),
    val checked: Boolean,
    val title: String,
)


