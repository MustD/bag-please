package com.bag_please.rpc

import kotlinx.coroutines.flow.Flow
import kotlinx.rpc.RemoteService
import kotlinx.rpc.annotations.Rpc
import kotlinx.serialization.Serializable

@Serializable
data class AuthRequest(
    val user: String,
    val pass: String,
)

@Serializable
data class AuthResponse(
    val message: String
)

@Rpc
interface AuthService : RemoteService {
    suspend fun authenticate(req: AuthRequest): AuthResponse

    suspend fun subscribeToNews(): Flow<String>
}