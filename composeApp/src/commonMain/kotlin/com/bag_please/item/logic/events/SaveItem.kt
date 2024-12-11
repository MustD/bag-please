package com.bag_please.item.logic.events

import com.bag_please.ClientEvent
import com.bag_please.item.Item

data class SaveItem(
    val payload: Item,
) : ClientEvent
