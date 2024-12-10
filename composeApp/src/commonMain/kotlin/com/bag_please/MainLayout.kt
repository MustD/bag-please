package com.bag_please

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.bag_please.item.itemList
import com.bag_please.layout.BagPleaseRoutes
import com.bag_please.layout.bottomBar
import com.bag_please.layout.topBar

@Composable
fun mainLayout() {
    val navController = rememberNavController()

    Scaffold(
        topBar = { topBar(navController) },
        bottomBar = { bottomBar() },
    ) { innerPadding ->
        Surface(modifier = Modifier.padding(innerPadding)) {
            NavHost(navController = navController, startDestination = BagPleaseRoutes.Home.name) {
                BagPleaseRoutes.entries.map { route ->
                    when (route) {
                        BagPleaseRoutes.Home -> composable(route = route.name) {
                            Text(text = "${route.title} page", modifier = Modifier.padding(4.dp))
                        }

                        BagPleaseRoutes.ItemList -> composable(route = route.name) {
                            itemList()
                        }

                        BagPleaseRoutes.ItemPage -> composable(route = route.name) {
                            Text(text = "${route.title} page", modifier = Modifier.padding(4.dp))
                        }
                    }
                }
            }
        }
    }
}