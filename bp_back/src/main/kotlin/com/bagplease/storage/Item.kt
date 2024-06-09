package com.bagplease.storage

import java.util.*

data class Item(
    val id: UUID = UUID.randomUUID(),
    val name: String = "",
    val checked: Boolean = false,
    val category: UUID,
)
