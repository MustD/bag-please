package com.bagplease.plugins

import com.bagplease.entity.item.ItemService
import com.bagplease.features.auth.AuthService
import io.ktor.server.application.Application
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import kotlin.time.Duration.Companion.hours

private val logger = LoggerFactory.getLogger("Scheduler")

/** One named hourly job. Each step owns its transaction(s); the scheduler never opens one for it. */
class SchedulerStep(val name: String, val run: suspend () -> Unit)

/** The ordered hourly steps (AD-10): recurring restore, soft-deleted hard delete, expired refresh-token purge. */
fun schedulerSteps(
    restoreRecurring: suspend () -> Unit,
    hardDeleteSoftDeleted: suspend () -> Unit,
    authService: AuthService,
): List<SchedulerStep> = listOf(
    SchedulerStep("restore recurring items") { restoreRecurring() },
    SchedulerStep("hard-delete soft-deleted items") { hardDeleteSoftDeleted() },
    SchedulerStep("purge expired refresh tokens") { authService.purgeExpiredTokens() },
)

/** Runs every step once, in order. A step that throws is logged and the rest still run. */
suspend fun runSchedulerCycle(steps: List<SchedulerStep>) {
    for (step in steps) {
        try {
            step.run()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            logger.error("Scheduler step '${step.name}' failed", e)
        }
    }
}

fun Application.configureScheduler(itemService: ItemService, authService: AuthService) {
    val steps = schedulerSteps({ itemService.restoreRecurring() }, { itemService.hardDeleteSoftDeleted() }, authService)
    launch {
        while (true) {
            runSchedulerCycle(steps)
            delay(1.hours)
        }
    }
}
