package com.bag_please.item

import kotlin.jvm.JvmInline
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

@OptIn(ExperimentalUuidApi::class)
@JvmInline
value class ItemId(val id: Uuid) {
    companion object {
        fun random() = ItemId(Uuid.random())
    }
}