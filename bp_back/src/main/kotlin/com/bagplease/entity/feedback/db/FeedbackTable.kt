package com.bagplease.entity.feedback.db

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID
import org.jetbrains.exposed.v1.javatime.timestamp

/** The `feedback` table from `V1__baseline.sql`. `username` is a plain copied string, no FK: feedback outlives its author. */
object FeedbackTable : Table("feedback") {
    val id = javaUUID("id")
    val text = text("text")
    val username = text("username")
    val createdAt = timestamp("created_at")

    override val primaryKey = PrimaryKey(id)
}
