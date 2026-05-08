package com.bagplease.features.auth

import com.bagplease.entity.user.UserService
import com.bagplease.features.auth.dto.ErrorResponse
import com.bagplease.features.auth.dto.RegisterRequest
import com.bagplease.features.auth.dto.RegisterResponse
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.plugins.ratelimit.RateLimitName
import io.ktor.server.plugins.ratelimit.rateLimit
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.post
import io.ktor.server.routing.routing

fun Application.configureAuthRoutes(userService: UserService) {
    routing {
        rateLimit(RateLimitName("auth")) {
            post("/auth/register") {
                val body = call.receive<RegisterRequest>()
                userService.register(body.username, body.password).fold(
                    ifLeft = { call.respond(HttpStatusCode.BadRequest, ErrorResponse("Invalid credentials")) },
                    ifRight = { call.respond(HttpStatusCode.OK, RegisterResponse(it.username, it.role)) },
                )
            }
        }
    }
}
