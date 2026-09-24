package com.bagplease.entity.feedback.gql

import com.bagplease.entity.feedback.Feedback
import com.expediagroup.graphql.generator.scalars.ID

object GqlFeedbackMapper {
    fun toGql(f: Feedback) = GqlFeedback(ID(f.id), f.text, f.username, f.createdAt.toString())
}
