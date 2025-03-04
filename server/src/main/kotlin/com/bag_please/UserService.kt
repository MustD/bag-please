package com.bag_please

import com.bag_please.auth.AuthHandler
import com.bag_please.rpc.AuthService
import com.bag_please.rpc.api.AuthHolder
import com.bag_please.rpc.api.AuthRequest
import com.bag_please.rpc.api.AuthResponse
import com.bag_please.user.User
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlin.coroutines.CoroutineContext

class UserServiceImpl(override val coroutineContext: CoroutineContext) : AuthService {
    private val authHandler = AuthHandler

    override suspend fun authenticate(req: AuthRequest): AuthResponse {
        val token = authHandler.authenticate(req.user, req.pass)
        return AuthResponse(user = User(username = req.user), token = token)
    }

    override suspend fun subscribeToNews(auth: AuthHolder): Flow<String> {
        val user = authHandler.verify(auth.token)
        return flow {
            repeat(10) {
                delay(1000)
                emit("Article for ${user.username} number $it")
            }
        }
    }
}