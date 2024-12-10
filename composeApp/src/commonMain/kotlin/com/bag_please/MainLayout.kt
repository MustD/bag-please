package com.bag_please

import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.unit.dp
import com.bag_please.item.Item
import com.bag_please.item.ItemStore
import com.bag_please.item.itemCard
import kotlinx.coroutines.launch

@Composable
fun mainLayout() {
    val coroutineScope = rememberCoroutineScope()
    val itemsState = ItemStore.items.collectAsState()

    val createItem = { Item(checked = false, name = "my new item") }
    val saveItem = { el: Item -> coroutineScope.launch { ItemStore.save(el) } }

    // https://developer.android.com/develop/ui/compose/components/scaffold
    Scaffold(
        topBar = { TopAppBar(title = { Text("Bag please") }) },
        bottomBar = { BottomAppBar { Text("Menu") } },
        floatingActionButton = { FloatingActionButton(onClick = { saveItem(createItem()) }) { Text("+") } }
    ) {
        Surface {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 240.dp)
            ) {
                items(itemsState.value.toList()) { (_, el) ->
                    itemCard(el) { toggled -> saveItem(toggled.copy(checked = toggled.checked.not())) }
                }
            }
        }
    }
}