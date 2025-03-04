package com.bag_please.item

import com.bag_please.user.UserId

data class Item(
    val id: ItemId = ItemId.random(),
    val owner: UserId = UserId.empty(),
    val checked: Boolean = false,
    val title: String = "",
)


