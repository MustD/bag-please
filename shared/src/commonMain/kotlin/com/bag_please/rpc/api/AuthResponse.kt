package com.bag_please.rpc.api

import com.bag_please.user.User
import kotlinx.serialization.Serializable

@Serializable
data class AuthResponse(
    val user: User = User(),
    val token: String = "",
)