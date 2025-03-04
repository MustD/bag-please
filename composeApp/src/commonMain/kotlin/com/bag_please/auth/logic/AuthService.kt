package com.bag_please.auth.logic

import com.bag_please.rpc.api.AuthResponse

object AuthService {
    private val repository = AuthRepository

    fun stateFlow() = repository.auth

    suspend fun auth(res: AuthResponse) = repository.setAuth(res)
}