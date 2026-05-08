package com.bagplease.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.forwardedheaders.XForwardedHeaders

// Reads X-Forwarded-For (set by nginx) and exposes the real client IP via call.request.origin.remoteHost.
// Production nginx requirement: proxy_set_header X-Forwarded-For $remote_addr; must be present
// in each location block that proxies to the backend (see routing/nginx.conf).
fun Application.configureForwardedHeaders() {
    install(XForwardedHeaders)
}
