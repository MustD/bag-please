package com.bagplease.entity.item

import java.util.UUID

data class Item(
    val id: UUID = UUID.randomUUID(),
    val name: String = "",
    val checked: Boolean = false,
    val category: UUID,
    val listId: UUID,
)
