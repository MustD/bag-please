package com.bag_please.auth.logic

import com.bag_please.rpc.api.AuthResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object AuthRepository {
    private val _auth = MutableStateFlow<AuthResponse>(AuthResponse(token = ""))
    val auth: StateFlow<AuthResponse> = _auth

    suspend fun setAuth(auth: AuthResponse) = _auth.emit(auth)
}