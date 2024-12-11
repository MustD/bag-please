package com.bag_please

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

object AppEventBus {
    private val _events = MutableSharedFlow<ClientEvent>()
    val events: SharedFlow<ClientEvent> = _events

    suspend fun emit(event: ClientEvent) = _events.emit(event)
}