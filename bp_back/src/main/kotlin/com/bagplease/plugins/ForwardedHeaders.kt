package com.bagplease.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.forwardedheaders.XForwardedHeaders

// Reads X-Forwarded-For and exposes the real client IP via call.request.origin.remoteHost.
// Only the client IP is consumed here (by the auth rate limiter) — the backend does not read
// the forwarded scheme or host. Request chain in production: external edge proxy (TLS/domain)
// -> Caddy -> this backend. Caddy must trust the edge proxy (trusted_proxies in routing/Caddyfile)
// so the real client IP survives the extra hop; otherwise remoteHost collapses to the proxy's IP.
// The edge MUST overwrite X-Forwarded-For (Ktor keys on its first value) — see routing/edge-proxy.md.
fun Application.configureForwardedHeaders() {
    install(XForwardedHeaders)
}
