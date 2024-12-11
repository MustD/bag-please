package com.bag_please

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.bag_please.rpc.UserData
import com.bag_please.rpc.UserService
import io.ktor.client.*
import io.ktor.http.*
import kotlinx.rpc.krpc.ktor.client.installRPC
import kotlinx.rpc.krpc.ktor.client.rpc
import kotlinx.rpc.krpc.ktor.client.rpcConfig
import kotlinx.rpc.krpc.serialization.json.json
import kotlinx.rpc.krpc.streamScoped
import kotlinx.rpc.withService

expect val DEV_SERVER_HOST: String

val client by lazy {
    HttpClient {
        installRPC()
    }
}

@Composable
fun home() {
    var serviceOrNull: UserService? by remember { mutableStateOf(null) }

    LaunchedEffect(Unit) {
        serviceOrNull = client.rpc {
            url {
                host = DEV_SERVER_HOST
                port = 8080
                encodedPath = "/api"
            }

            rpcConfig {
                serialization {
                    json()
                }
            }
        }.withService()
    }

    val service = serviceOrNull // for smart casting

    if (service != null) {
        var greeting by remember { mutableStateOf<String?>(null) }
        val news = remember { mutableStateListOf<String>() }

        LaunchedEffect(service) {
            greeting = service.hello(
                "User from ${getPlatform().name} platform",
                UserData("Berlin", "Smith")
            )
        }

        LaunchedEffect(service) {
            streamScoped {
                service.subscribeToNews().collect { article ->
                    news.add(article)
                }
            }
        }

        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            greeting?.let {
                Text(it)
            } ?: run {
                Text("Establishing server connection...")
            }

            news.forEach {
                Text("Article: $it")
            }


        }
    }
}