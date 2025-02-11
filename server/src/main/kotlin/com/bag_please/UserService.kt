package com.bag_please

import com.bag_please.rpc.AuthRequest
import com.bag_please.rpc.AuthResponse
import com.bag_please.rpc.AuthService
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlin.coroutines.CoroutineContext

class UserServiceImpl(override val coroutineContext: CoroutineContext) : AuthService {

    override suspend fun authenticate(req: AuthRequest): AuthResponse {
        return AuthResponse("Nice to meet you ${req.user}?")
    }

    override suspend fun subscribeToNews(): Flow<String> {
        return flow {
            repeat(10) {
                delay(1000)
                emit("Article number $it")
            }
        }
    }
}