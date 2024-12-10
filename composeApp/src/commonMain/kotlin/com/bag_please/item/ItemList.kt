package com.bag_please.item

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.absolutePadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
fun itemList() {
    val coroutineScope = rememberCoroutineScope()
    val itemsState = ItemStore.items.collectAsState()

    val createItem = { Item(checked = false, name = "my new item") }
    val saveItem = { el: Item -> coroutineScope.launch { ItemStore.save(el) } }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 240.dp),
            contentPadding = PaddingValues(4.dp)
        ) {
            items(itemsState.value.toList()) { (_, el) ->
                itemCard(el) { toggled -> saveItem(toggled.copy(checked = toggled.checked.not())) }
            }

        }
        FloatingActionButton(
            modifier = Modifier.absolutePadding(bottom = 16.dp, right = 16.dp).align(Alignment.BottomEnd),
            onClick = { saveItem(createItem()) },
        ) { Text("+") }
    }
}
