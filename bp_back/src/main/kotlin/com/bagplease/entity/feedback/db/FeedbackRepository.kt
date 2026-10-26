package com.bagplease.entity.feedback.db

import com.bagplease.entity.feedback.Feedback
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.r2dbc.deleteReturning
import org.jetbrains.exposed.v1.r2dbc.insert
import org.jetbrains.exposed.v1.r2dbc.selectAll
import java.util.UUID

/** `feedback` over Exposed-on-R2DBC. Every method must run inside a service's `tx {}` (AD-2). */
class FeedbackRepository {

    suspend fun insert(feedback: Feedback) {
        FeedbackTable.insert {
            it[id] = UUID.fromString(feedback.id)
            it[text] = feedback.text
            it[username] = feedback.username
            it[createdAt] = feedback.createdAt
        }
    }

    // Newest first; `id` breaks ties between entries that share a timestamp.
    suspend fun findAllNewestFirst(): List<Feedback> =
        FeedbackTable.selectAll()
            .orderBy(FeedbackTable.createdAt to SortOrder.DESC, FeedbackTable.id to SortOrder.DESC)
            .map(FeedbackRowMapper::fromRow)
            .toList()

    // A single DELETE ... RETURNING: only the call that actually removes the row gets a result. An id that is not
    // a UUID cannot name a row, so it is "not found" rather than an error.
    suspend fun deleteById(id: String): Feedback? {
        val uuid = runCatching { UUID.fromString(id) }.getOrNull() ?: return null
        return FeedbackTable.deleteReturning(returning = FeedbackTable.columns) { FeedbackTable.id eq uuid }
            .map(FeedbackRowMapper::fromRow)
            .toList()
            .firstOrNull()
    }
}
