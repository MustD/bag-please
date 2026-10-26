package com.bagplease.entity.list

import java.time.Instant
import java.util.UUID

data class List(
    val id: UUID = UUID.randomUUID(),
    val name: String,
    val emoji: String?,
    val ownerId: UUID,
    val ownerUsername: String,
    val origin: String,
    val createdAt: Instant,
)
