package com.bagplease.entity.feedback.db

import com.bagplease.entity.feedback.Feedback
import org.jetbrains.exposed.v1.core.ResultRow

object FeedbackRowMapper {
    fun fromRow(row: ResultRow): Feedback = Feedback(
        id = row[FeedbackTable.id].toString(),
        text = row[FeedbackTable.text],
        username = row[FeedbackTable.username],
        createdAt = row[FeedbackTable.createdAt],
    )
}
