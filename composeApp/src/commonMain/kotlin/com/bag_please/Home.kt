package com.bag_please

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.bag_please.layout.Style.padding1
import com.bag_please.rpc.UserData
import com.bag_please.rpc.UserService
import io.ktor.client.*
import io.ktor.http.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flow
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
        var counter by remember { mutableStateOf(0) }
        var input by remember { mutableStateOf(0) }
        val output = MutableSharedFlow<Int>()

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

        LaunchedEffect(service) {
            val flow = flow {
                delay(5000)
                emit(1)
                delay(1000)
                emit(2)
            }
            streamScoped {
                service.duplicate(emptyFlow()).collect { result ->
                    counter = result
                }
            }
        }

        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            greeting?.let {
                Text(it)
            } ?: run {
                Text("Establishing server connection...")
            }

            OutlinedTextField(
                modifier = Modifier.padding1(),
                value = if (input == 0) "" else input.toString(),
                onValueChange = { newVal -> input = newVal.toIntOrNull() ?: 0 }
            )
            Text("Counter: $counter")

            news.forEach {
                Text("Article: $it")
            }


        }
    }
}