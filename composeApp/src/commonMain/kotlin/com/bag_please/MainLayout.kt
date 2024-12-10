package com.bag_please

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.bag_please.item.Item
import com.bag_please.item.ItemStore
import com.bag_please.item.itemCard
import kotlinx.coroutines.launch


enum class BagPleaseScreen(val title: String) {
    Home(title = "home"),
    ItemPage(title = "item page")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun mainLayout() {
    val coroutineScope = rememberCoroutineScope()
    val navController = rememberNavController()
    val itemsState = ItemStore.items.collectAsState()

    val createItem = { Item(checked = false, name = "my new item") }
    val saveItem = { el: Item -> coroutineScope.launch { ItemStore.save(el) } }

    // https://developer.android.com/develop/ui/compose/components/scaffold
    Scaffold(
        topBar = { TopAppBar(title = { Text("Bag please") }) },
        bottomBar = { BottomAppBar { Text("Menu") } },
        floatingActionButton = { FloatingActionButton(onClick = { saveItem(createItem()) }) { Text("+") } }
    ) { innerPadding ->
        Surface(modifier = Modifier.padding(innerPadding)) {
            NavHost(navController = navController, startDestination = BagPleaseScreen.Home.name) {
                composable(route = BagPleaseScreen.Home.name) {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 240.dp)
                    ) {
                        item {
                            Button(
                                onClick = { navController.navigate(BagPleaseScreen.ItemPage.name) },
                            ) { Text("Item page") }
                        }
                        items(itemsState.value.toList()) { (_, el) ->
                            itemCard(el) { toggled -> saveItem(toggled.copy(checked = toggled.checked.not())) }
                        }
                    }
                }
                composable(route = BagPleaseScreen.ItemPage.name) {
                    Column {
                        Button(
                            onClick = { navController.navigate(BagPleaseScreen.Home.name) },
                        ) { Text("Home") }
                        Text("Item page")
                    }
                }
            }

        }
    }
}