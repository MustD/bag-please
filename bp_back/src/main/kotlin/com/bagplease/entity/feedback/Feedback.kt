package com.bagplease.entity.feedback

import java.time.Instant
import java.util.UUID

// Domain model for a single feedback submission (Story 9.9). `id` is a UUID
// held as a plain string; the `db/` row mapper converts it to the `uuid` column.
//
// `username` is a PLAIN COPIED STRING, the caller's username at send time —
// never a user-id reference. Story 9.4's user-deletion purge therefore never
// touches this collection (there is nothing referential to purge), and a
// deleted user's past feedback survives them, on purpose (epic-9-context.md).
data class Feedback(
    val id: String = UUID.randomUUID().toString(),
    val text: String,
    val username: String,
    val createdAt: Instant,
)
