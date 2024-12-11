package com.bag_please

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import com.bag_please.item.logic.ItemService.startItemEventHandler
import com.bag_please.theme.BagPleaseTheme
import kotlinx.coroutines.launch
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
@Preview
fun App() {
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        scope.launch {
            startItemEventHandler()
        }
    }

    BagPleaseTheme {
        mainLayout()
    }
}