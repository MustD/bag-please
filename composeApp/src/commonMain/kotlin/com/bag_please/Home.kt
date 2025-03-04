package com.bag_please

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.bag_please.auth.logic.AuthService
import com.bag_please.rpc.api.AuthHolder
import kotlinx.rpc.krpc.streamScoped


@Composable
fun home() {
    val connection = Backend.service.collectAsState()
    val authState = AuthService.stateFlow().collectAsState()

    val news = remember { mutableStateListOf<String>() }

    LaunchedEffect(connection.value) {
        streamScoped {
            connection.value?.subscribeToNews(AuthHolder(authState.value.token))?.collect { article ->
                news.add(article)
            }
        }
    }

    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        news.forEach { Text("Article: $it") }
    }

}