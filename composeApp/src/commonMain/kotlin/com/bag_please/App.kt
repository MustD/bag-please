package com.bag_please

import androidx.compose.runtime.Composable
import com.bag_please.item.logic.ItemService.startItemEventHandler
import com.bag_please.theme.BagPleaseTheme
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import org.jetbrains.compose.ui.tooling.preview.Preview

@OptIn(DelicateCoroutinesApi::class)
@Composable
@Preview
fun App() {
    GlobalScope.launch {
        startItemEventHandler()
    }

    BagPleaseTheme {
        mainLayout()
    }
}