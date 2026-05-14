package com.bagplease.features.auth.dto

data class LoginResponse(val accessToken: String, val username: String, val role: String)
