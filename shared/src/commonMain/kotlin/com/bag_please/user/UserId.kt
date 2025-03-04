package com.bag_please.user

import kotlinx.serialization.Serializable
import kotlin.jvm.JvmInline
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

@OptIn(ExperimentalUuidApi::class)
@Serializable
@JvmInline
value class UserId(private val id: Uuid) {
    companion object {
        fun empty() = UserId(Uuid.NIL)
        fun random() = UserId(Uuid.random())
        fun fromString(uuidString: String) = UserId(Uuid.parse(uuidString))
    }

    override fun toString() = id.toString()
}