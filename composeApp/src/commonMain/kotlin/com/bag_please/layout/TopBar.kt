package com.bag_please.layout

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun topBar(navigation: NavHostController) {
    TopAppBar(
        title = { Text("Bag please") },
        actions = {
            BagPleaseRoutes.entries.map {
                Button(
                    modifier = Modifier.padding(4.dp),
                    onClick = { navigation.navigate(it.name) }) { Text(it.title) }
            }
        }
    )
}