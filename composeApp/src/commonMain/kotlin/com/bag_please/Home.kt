package com.bag_please

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.bag_please.layout.Style.padding1
import com.bag_please.rpc.AuthRequest
import com.bag_please.rpc.AuthService
import io.ktor.client.*
import io.ktor.http.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.rpc.krpc.ktor.client.installKrpc
import kotlinx.rpc.krpc.ktor.client.rpc
import kotlinx.rpc.krpc.ktor.client.rpcConfig
import kotlinx.rpc.krpc.serialization.json.json
import kotlinx.rpc.krpc.streamScoped
import kotlinx.rpc.withService

expect val DEV_SERVER_HOST: String

val client by lazy {
    HttpClient {
        installKrpc()
    }
}

@Composable
fun home() {
    var serviceOrNull: AuthService? by remember { mutableStateOf(null) }

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
        var counter by remember { mutableStateOf("") }
        var input by remember { mutableStateOf("") }
        val output = MutableSharedFlow<Int>()

        LaunchedEffect(service) {
            greeting = service.authenticate(
                AuthRequest("anonymous", "none")
            ).message
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

            OutlinedTextField(
                modifier = Modifier.padding1(),
                value = input,
                onValueChange = { newVal -> input = newVal }
            )
            Text("Counter: $counter")

            news.forEach {
                Text("Article: $it")
            }


        }
    }
}