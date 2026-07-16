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
            // origin.remoteHost reflects the real client IP after XForwardedHeaders reads X-Forwarded-For.
            // The edge proxy sets X-Forwarded-For and Caddy forwards it (trusted_proxies in routing/Caddyfile);
            // without that trust the key collapses to a single proxy IP and rate limiting becomes global.
            requestKey { call -> call.request.origin.remoteHost }
        }
    }
}
