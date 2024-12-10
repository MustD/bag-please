package com.bag_please

import androidx.compose.material.MaterialTheme
import androidx.compose.runtime.Composable
import com.bag_please.theme.BPColors
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
@Preview
fun App() {
    MaterialTheme(
        colors = BPColors.dark
    ) {
        mainLayout()
    }
}