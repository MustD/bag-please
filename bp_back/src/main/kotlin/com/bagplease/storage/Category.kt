package com.bagplease.storage

import java.util.*

data class Category(
    val id: UUID = UUID.randomUUID(),
    val name: String = ""
)
