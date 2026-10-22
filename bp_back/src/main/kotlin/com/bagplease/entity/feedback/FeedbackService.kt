package com.bagplease.entity.feedback

import arrow.core.Either
import arrow.core.raise.either
import arrow.core.raise.ensure
import com.bagplease.entity.feedback.db.FeedbackRepository
import com.bagplease.features.auth.CallerUsername
import com.bagplease.plugins.tx
import java.time.Instant

// Business rules for sending feedback (Story 9.9), following `ListService`'s
// `Either`/`ensure` shape rather than `UserAdminApi`'s try/catch-in-resolver
// shape: the admin-block and the text validation are both business rules, not
// GQL input parsing.
sealed class FeedbackError {
    data object AdminBlocked : FeedbackError()
    data object BlankText : FeedbackError()
    data object TooLong : FeedbackError()
}

// Maximum length of the TRIMMED text, in UTF-16 code units (`String.length`).
private const val MAX_TEXT_LENGTH = 2000

// Services own the transaction (AD-2); Arrow `either {}` sits outside `tx {}` so a `raise` rolls back.
class FeedbackService(
    private val repository: FeedbackRepository,
    private val adminLogin: String,
) {
    suspend fun send(caller: CallerUsername, text: String): Either<FeedbackError, Unit> = either {
        ensure(caller.value != adminLogin) { FeedbackError.AdminBlocked }
        val trimmed = text.trim()
        ensure(trimmed.isNotEmpty()) { FeedbackError.BlankText }
        ensure(trimmed.length <= MAX_TEXT_LENGTH) { FeedbackError.TooLong }
        tx { repository.insert(Feedback(text = trimmed, username = caller.value, createdAt = Instant.now())) }
    }

    // Admin review (Story 9.10) — newest-first, unpaginated (out of scope for this epic).
    suspend fun list(): List<Feedback> = tx { repository.findAllNewestFirst() }

    suspend fun delete(id: String): Either<FeedbackDeleteError, Feedback> = either {
        tx { repository.deleteById(id) } ?: raise(FeedbackDeleteError.NotFound)
    }
}

sealed class FeedbackDeleteError {
    data object NotFound : FeedbackDeleteError()
}
