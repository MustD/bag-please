package com.bag_please.user

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: UserId = UserId.empty(),
    val username: String = "",
)
