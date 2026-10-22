package com.bagplease.features.auth

import java.time.Instant

data class RefreshToken(
    val token: String,
    val username: String,
    val role: String,
    val expiresAt: Instant,
)
