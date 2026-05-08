package com.bagplease.features.auth.dto

data class ChangePasswordRequest(val currentPassword: String, val newPassword: String)
