package com.bag_please.item

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.absolutePadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.bag_please.item.components.itemCard
import com.bag_please.item.logic.ItemService

@Composable
fun itemList(
    onEdit: (ItemId) -> Unit = {},
) {
    val itemsState = ItemService.stateFlow().collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 240.dp),
        ) {
            items(itemsState.value.toList()) { (_, el) ->
                itemCard(itemId = el.id, onNavEdit = { onEdit(el.id) })
            }
        }
        FloatingActionButton(
            modifier = Modifier.align(Alignment.BottomEnd).absolutePadding(bottom = 16.dp, right = 16.dp),
            onClick = { onEdit(ItemId.random()) },
        ) { Text("+") }
    }
}
