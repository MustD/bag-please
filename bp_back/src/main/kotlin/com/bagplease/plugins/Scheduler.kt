package com.bagplease.plugins

import com.bagplease.entity.item.ItemService
import io.ktor.server.application.Application
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import kotlin.time.Duration.Companion.hours

private val logger = LoggerFactory.getLogger("Scheduler")

fun Application.configureScheduler(itemService: ItemService) {
    launch {
        while (true) {
            try {
                itemService.runSchedulerCycle()
            } catch (e: Exception) {
                logger.error("Scheduler cycle failed", e)
            }
            kotlinx.coroutines.delay(1.hours)
        }
    }
}
