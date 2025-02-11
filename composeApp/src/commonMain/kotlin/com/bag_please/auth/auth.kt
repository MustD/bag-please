package com.bag_please.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import com.bag_please.Backend
import com.bag_please.auth.logic.AuthService
import com.bag_please.layout.Style.padding1
import com.bag_please.rpc.AuthRequest
import kotlinx.coroutines.launch

@Composable
fun auth() {
    val scope = rememberCoroutineScope()

    val connection = Backend.service.collectAsState()
    val authState = AuthService.stateFlow().collectAsState()

    var user by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }

    val authenticate = {
        scope.launch {
            connection.value?.authenticate(AuthRequest(user, pass))?.let {
                AuthService.auth(it)
            }
        }
    }

    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(authState.value.message)

        OutlinedTextField(
            label = { Text("User") },
            modifier = Modifier.padding1(),
            value = user,
            onValueChange = { newVal -> user = newVal },
        )

        OutlinedTextField(
            label = { Text("Password") },
            modifier = Modifier.padding1(),
            value = pass,
            visualTransformation = PasswordVisualTransformation(),
            onValueChange = { newVal -> pass = newVal },
        )

        Button(
            modifier = Modifier.padding1(),
            content = { Text("Authenticate") },
            onClick = { authenticate() }
        )

    }
}