package com.bag_please.item

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.bag_please.layout.Style.padding1
import kotlinx.coroutines.launch

@Composable
fun itemEdit(
    itemId: ItemId = ItemId.random(),
    onSave: () -> Unit = {},
) {
    val coroutineScope = rememberCoroutineScope()

    val itemState = remember {
        mutableStateOf(ItemStore.findById(itemId) ?: Item(checked = false, name = ""))
    }

    val saveItem = { el: Item ->
        coroutineScope.launch { ItemStore.save(el) }
        onSave()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column {
            OutlinedTextField(
                modifier = Modifier.padding1(),
                value = itemState.value.name,
                onValueChange = { newName -> itemState.value = itemState.value.copy(name = newName) }
            )
            Row {
                Checkbox(
                    modifier = Modifier.padding1(),
                    checked = itemState.value.checked,
                    onCheckedChange = { itemState.value = itemState.value.copy(checked = it) }
                )
                Text(
                    modifier = Modifier.padding1().align(Alignment.CenterVertically),
                    text = "Value"
                )
            }
            Row {
                Button(
                    modifier = Modifier.padding1(),
                    onClick = { saveItem(itemState.value) }) { Text("Save") }
            }
        }
    }
}