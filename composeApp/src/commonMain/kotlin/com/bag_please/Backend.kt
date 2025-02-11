package com.bag_please

import com.bag_please.rpc.AuthService
import io.ktor.client.*
import io.ktor.http.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.rpc.krpc.ktor.client.installKrpc
import kotlinx.rpc.krpc.ktor.client.rpc
import kotlinx.rpc.krpc.ktor.client.rpcConfig
import kotlinx.rpc.krpc.serialization.json.json
import kotlinx.rpc.withService


expect val DEV_SERVER_HOST: String


object Backend {
    val service = MutableStateFlow<AuthService?>(null)

    private val client by lazy {
        HttpClient { installKrpc() }
    }

    fun CoroutineScope.connectBackend() = launch {
        client.rpc {
            url {
                host = DEV_SERVER_HOST
                port = 8080
                encodedPath = "/api"
            }

            rpcConfig { serialization { json() } }
        }.withService<AuthService>().also { service.emit(it) }
    }
}