package com.bag_please

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.bag_please.auth.auth
import com.bag_please.item.ItemId
import com.bag_please.item.itemEdit
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
                            home()
                        }

                        BagPleaseRoutes.Auth -> composable(route = route.name) {
                            Text(text = "${route.title} page", modifier = Modifier.padding(4.dp))
                            auth()
                        }

                        BagPleaseRoutes.ItemList -> composable(route = route.name) {
                            itemList(
                                onEdit = { itemId ->
                                    navController.navigate(route = "${BagPleaseRoutes.ItemPage.name}/$itemId")
                                }
                            )
                        }

                        BagPleaseRoutes.ItemPage -> composable(
                            route = "${route.name}/{itemId}",
                            arguments = listOf(navArgument("itemId") { type = NavType.StringType })
                        ) {
                            itemEdit(
                                itemId = it.arguments?.getString("itemId")?.let { id ->
                                    ItemId.fromString(id)
                                } ?: ItemId.random(),
                                onSave = { navController.navigate(BagPleaseRoutes.ItemList.name) }
                            )
                        }

                    }
                }
            }
        }
    }
}