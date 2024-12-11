package com.bag_please.item.components

import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.bag_please.item.Item
import com.bag_please.item.ItemId
import com.bag_please.item.logic.ItemService.saveItem
import com.bag_please.item.logic.ItemService.stateItemById
import com.bag_please.layout.Style.padding1

@Composable
fun itemCard(itemId: ItemId, onNavEdit: (ItemId) -> Unit = {}) {
    val coroutineScope = rememberCoroutineScope()

    val itemState = coroutineScope.stateItemById(itemId).collectAsState()
    val saveItem = { el: Item -> coroutineScope.saveItem(el) }

    val item = itemState.value
    Card(modifier = Modifier.padding1()) {
        Row {
            Checkbox(
                modifier = Modifier.padding1(),
                checked = item.checked, onCheckedChange = { saveItem(item.copy(checked = item.checked.not())) })
            Text(
                modifier = Modifier.padding1().align(Alignment.CenterVertically),
                text = item.title
            )
            Button(
                modifier = Modifier.align(Alignment.CenterVertically),
                onClick = { onNavEdit(itemId) },
            ) {
                Text("Edit")
            }
        }
    }
}