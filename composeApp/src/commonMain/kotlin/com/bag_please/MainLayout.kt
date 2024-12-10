package com.bag_please

import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import com.bag_please.item.Item
import com.bag_please.items.item

@Composable
fun mainLayout() {
    var showContent by remember { mutableStateOf(false) }

    // https://developer.android.com/develop/ui/compose/components/scaffold
    Scaffold(
        topBar = { TopAppBar(title = { Text("Bag please") }) },
        bottomBar = { BottomAppBar { Text("Menu") } },
    ) {
        Surface {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 240.dp)
            ) {
                items(count = 10) { i ->
                    item(
                        Item(
                            checked = false,
                            name = "Item name $i"
                        )
                    )
                }
            }
        }
    }
}