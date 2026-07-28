package com.bagplease.entity.item

import java.time.Instant
import java.util.UUID

data class Item(
    val id: UUID = UUID.randomUUID(),
    val name: String = "",
    val checked: Boolean = false,
    val category: UUID,
    val listId: UUID,
    val store: String? = null,
    val recurring: Recurring? = null,
    val addedBy: String? = null,
    val deleted: Boolean = false,
    val deletedAt: Instant? = null,
    val checkedAt: Instant? = null,
)
