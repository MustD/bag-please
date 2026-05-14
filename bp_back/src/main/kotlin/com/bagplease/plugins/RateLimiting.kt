package com.bagplease.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.origin
import io.ktor.server.plugins.ratelimit.RateLimit
import io.ktor.server.plugins.ratelimit.RateLimitName
import kotlin.time.Duration.Companion.seconds

fun Application.configureRateLimiting() {
    val attempts = environment.config.propertyOrNull("rateLimit.attempts")?.getString()?.toIntOrNull() ?: 5
    val windowSeconds = environment.config.propertyOrNull("rateLimit.windowSeconds")?.getString()?.toLongOrNull() ?: 60L

    install(RateLimit) {
        register(RateLimitName("auth")) {
            rateLimiter(limit = attempts, refillPeriod = windowSeconds.seconds)
            // origin.remoteHost reflects the real client IP after XForwardedHeaders reads X-Forwarded-For;
            // nginx must set: proxy_set_header X-Forwarded-For $remote_addr (see routing/nginx.conf)
            requestKey { call -> call.request.origin.remoteHost }
        }
    }
}
