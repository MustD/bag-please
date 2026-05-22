package com.bagplease.entity.category

import java.util.UUID

data class Category(
    val id: UUID = UUID.randomUUID(),
    val name: String = "",
    val listId: UUID,
)
