package com.bagplease.entity.list

import java.time.Instant
import java.util.UUID

data class ListMember(
    val listId: UUID,
    val userId: UUID,
    val username: String,
    val status: MemberStatus,
    val createdAt: Instant,
)
