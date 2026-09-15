@file:Suppress("unused")

package com.bagplease.plugins

import com.bagplease.mongo.MongoConnection
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.jackson.jackson
import io.ktor.server.application.Application
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.di.dependencies
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import org.bson.Document
import kotlin.time.Duration.Companion.seconds

fun Application.configureRouting() {
    val env = environment
    val connection: MongoConnection by dependencies

    routing {
        install(ContentNegotiation) {
            jackson()
        }

        // Story 9.1 (AD-9) — backend readiness probe, served at /api/health via
        // rootPath "api" (so never write "/api/health" here). Deliberately outside
        // `authenticate` and every `rateLimit`: Playwright's webServer.url and
        // global setup poll it. 200 only when Mongo answers a ping within 2 s;
        // any failure or timeout is 503, so the handler returns in ~2 s even
        // while the driver would wait 30 s on server selection.
        get("/health") {
            val healthy = try {
                withTimeout(2.seconds) { connection.db.runCommand(Document("ping", 1)) }
                true
            } catch (e: TimeoutCancellationException) {
                false
            } catch (e: CancellationException) {
                throw e // the call itself was cancelled — not a health verdict
            } catch (e: Exception) {
                false
            }
            if (healthy) {
                call.respondText("OK")
            } else {
                call.respondText("UNAVAILABLE", status = HttpStatusCode.ServiceUnavailable)
            }
        }

        gqlRoutes()
    }
}
