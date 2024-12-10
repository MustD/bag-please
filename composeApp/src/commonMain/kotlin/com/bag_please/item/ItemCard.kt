package com.bag_please.item

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
import com.bag_please.layout.Style.padding1
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.asFlow
import kotlinx.coroutines.flow.flatMapConcat
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
@Composable
fun itemCard(itemId: ItemId, onNavEdit: (ItemId) -> Unit = {}) {
    val coroutineScope = rememberCoroutineScope()

    val itemState = ItemStore.items.flatMapConcat { itemMap ->
        itemMap.filter { it.key == itemId }.values.asFlow()
    }.collectAsState(ItemStore.findById(itemId) ?: Item(checked = false, name = ""))

    val saveItem = { el: Item -> coroutineScope.launch { ItemStore.save(el) } }

    val item = itemState.value

    Card(modifier = Modifier.padding1()) {
        Row {
            Checkbox(
                modifier = Modifier.padding1(),
                checked = item.checked, onCheckedChange = { saveItem(item.copy(checked = item.checked.not())) })
            Text(
                modifier = Modifier.padding1().align(Alignment.CenterVertically),
                text = item.name
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