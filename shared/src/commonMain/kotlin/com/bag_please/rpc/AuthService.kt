package com.bag_please.rpc

import com.bag_please.rpc.api.AuthHolder
import com.bag_please.rpc.api.AuthRequest
import com.bag_please.rpc.api.AuthResponse
import kotlinx.coroutines.flow.Flow
import kotlinx.rpc.RemoteService
import kotlinx.rpc.annotations.Rpc

@Rpc
interface AuthService : RemoteService {
    suspend fun authenticate(req: AuthRequest): AuthResponse

    suspend fun subscribeToNews(auth: AuthHolder): Flow<String>
}