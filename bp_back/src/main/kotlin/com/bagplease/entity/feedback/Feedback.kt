package com.bagplease.entity.feedback

import java.time.Instant
import java.util.UUID

// Domain model for a single feedback submission (Story 9.9). `id` is a UUID
// generated as a plain string, mirroring the precedent at
// `features/auth/AuthService.kt:31` — no `UUID` type here, no BSON UUID codec
// to fight, consistent with how the other append-only/admin-facing entities in
// this codebase (app config) store their identifiers.
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

// Story 9.10: FeedbackQueries (feedback query) and deleteFeedback will read/mutate
// this same collection, guarded by requireAdmin(), and are out of scope here.
