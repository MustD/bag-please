package com.bag_please.rpc.api

import kotlinx.serialization.Serializable

@Serializable
data class AuthHolder(
    val token: String = "",
)
