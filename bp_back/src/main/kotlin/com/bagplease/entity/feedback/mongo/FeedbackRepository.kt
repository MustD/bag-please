package com.bagplease.entity.feedback.mongo

import com.bagplease.entity.feedback.Feedback
import com.mongodb.kotlin.client.coroutine.MongoDatabase

// Persistence for feedback (Story 9.9), modeled on
// `config/mongo/ApplicationConfigRepository.kt`. No index needed for this
// story — listing/sorting is Story 9.10's job.
class FeedbackRepository(db: MongoDatabase) {
    private val collection = db.getCollection<MongoFeedback>("feedback")

    suspend fun insert(feedback: Feedback) {
        collection.insertOne(
            MongoFeedback(
                id = feedback.id,
                text = feedback.text,
                username = feedback.username,
                createdAt = feedback.createdAt,
            )
        )
    }

    // Story 9.10: findAllNewestFirst() and deleteById(id) land here.
}
