package com.bag_please.theme

import androidx.compose.material.Colors
import androidx.compose.ui.graphics.Color

object BPColors {

    val light = Colors(
        primary = Color(0xFF4c662b),
        primaryVariant = Color(0xFFcdeda3),
        secondary = Color(0xFF586249),
        secondaryVariant = Color(0xFFdce7c8),
        background = Color(0xFFf9faef),
        surface = Color(0xFFf9faef),
        error = Color(0xFFba1a1a),
        onPrimary = Color(0xFFffffff),
        onSecondary = Color(0xFFffffff),
        onBackground = Color(0xFF4c662b),
        onSurface = Color(0xFF1a1c16),
        onError = Color(0xFFffffff),
        isLight = true,
    )

    val dark = Colors(
        primary = Color(0xFFb1d18a),
        primaryVariant = Color(0xFF354e16),
        secondary = Color(0xFFbfcbad),
        secondaryVariant = Color(0xFF404a33),
        background = Color(0xFF12140e),
        surface = Color(0xFF12140e),
        error = Color(0xFFffb4ab),
        onPrimary = Color(0xFF1f3701),
        onSecondary = Color(0xFF2a331e),
        onBackground = Color(0xFFe2e3d8),
        onSurface = Color(0xFFe2e3d8),
        onError = Color(0xFF690005),
        isLight = true,
    )
}