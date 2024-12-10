package com.bag_please.layout

import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import com.bag_please.layout.Style.padding1

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun topBar(navigation: NavHostController) {
    TopAppBar(
        title = { Text("Bag please") },
        actions = {
            BagPleaseRoutes.entries.filter {
                when (it) {
                    BagPleaseRoutes.ItemPage -> false
                    else -> true
                }
            }.map {
                Button(
                    modifier = Modifier.padding1(),
                    onClick = { navigation.navigate(it.name) }) { Text(it.title) }
            }
        }
    )
}