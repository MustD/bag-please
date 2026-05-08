package com.bagplease.entity.user

import java.util.*

data class User(
    val id: UUID = UUID.randomUUID(),
    val username: String,
    val passwordHash: String,
    val role: String = "user",
)
