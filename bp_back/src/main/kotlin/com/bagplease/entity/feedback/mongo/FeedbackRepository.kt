package com.bagplease.entity.feedback.mongo

import com.bagplease.entity.feedback.Feedback
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Sorts
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList

// Persistence for feedback (Story 9.9), modeled on
// `config/mongo/ApplicationConfigRepository.kt`. No index needed for this
// story — feedback pagination is out of scope for the epic.
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

    // All entries, newest-first (Story 9.10). Unpaginated — feedback pagination
    // is explicitly out of scope for this epic (mirrors `UserRepository.findPage`'s
    // ascending sort, descending here instead). `_id` is a secondary tiebreaker
    // since `createdAt` is only millisecond-precision and several entries can
    // share a timestamp.
    suspend fun findAllNewestFirst(): List<Feedback> =
        collection.find()
            .sort(Sorts.orderBy(Sorts.descending(MongoFeedback::createdAt.name), Sorts.descending("_id")))
            .map(::toDomain)
            .toList()

    // Atomic find-and-delete (Story 9.10) — a single `findOneAndDelete` instead
    // of find-then-`deleteOne`, so a racing second delete for the same id can't
    // observe the document and report a fake success; only the call that
    // actually removes it gets a non-null result, mirroring
    // `UserService.adminDeleteUser`'s NotFound-on-nothing-removed behaviour.
    suspend fun deleteById(id: String): Feedback? =
        collection.findOneAndDelete(Filters.eq("_id", id))?.let(::toDomain)

    private fun toDomain(mongo: MongoFeedback): Feedback =
        Feedback(id = mongo.id, text = mongo.text, username = mongo.username, createdAt = mongo.createdAt)
}
