package com.bag_please.item

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material.Card
import androidx.compose.material.Checkbox
import androidx.compose.material.MaterialTheme
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun itemCard(data: Item, onToggle: (Item) -> Unit) {
    Card(
        modifier = Modifier.padding(4.dp),
        elevation = 4.dp,
        border = BorderStroke(1.dp, MaterialTheme.colors.secondary)
    ) {
        Row {
            Checkbox(checked = data.checked, onCheckedChange = { onToggle(data) })
            Text(
                modifier = Modifier.align(Alignment.CenterVertically),
                text = data.name
            )
        }
    }
}