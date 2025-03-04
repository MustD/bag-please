package com.bag_please.rpc.api

import kotlinx.serialization.Serializable

@Serializable
data class AuthRequest(
    val user: String,
    val pass: String,
)