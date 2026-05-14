package com.bagplease.features.auth

import com.bagplease.entity.user.UserService
import com.bagplease.features.auth.dto.ChangePasswordRequest
import com.bagplease.features.auth.dto.ErrorResponse
import com.bagplease.features.auth.dto.LoginRequest
import com.bagplease.features.auth.dto.LoginResponse
import com.bagplease.features.auth.dto.RefreshResponse
import com.bagplease.features.auth.dto.RegisterRequest
import com.bagplease.features.auth.dto.RegisterResponse
import com.bagplease.plugins.authMethod
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.jwt.JWTPrincipal
import io.ktor.server.auth.principal
import io.ktor.server.plugins.ratelimit.RateLimitName
import io.ktor.server.plugins.ratelimit.rateLimit
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.post
import io.ktor.server.routing.routing

private const val REFRESH_TOKEN_COOKIE = "refresh_token"

fun ApplicationCall.requireAdmin(): Boolean =
    principal<JWTPrincipal>()?.payload?.getClaim("role")?.asString() == "admin"

fun Application.configureAuthRoutes(userService: UserService, authService: AuthService, adminLogin: String) {
    routing {
        rateLimit(RateLimitName("auth")) {
            post("/auth/register") {
                val body = call.receive<RegisterRequest>()
                userService.register(body.username, body.password).fold(
                    ifLeft = { call.respond(HttpStatusCode.BadRequest, ErrorResponse("Invalid credentials")) },
                    ifRight = { call.respond(HttpStatusCode.OK, RegisterResponse(it.username, it.role)) },
                )
            }

            post("/auth/login") {
                val body = call.receive<LoginRequest>()
                authService.login(body.username, body.password).fold(
                    ifLeft = { call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Invalid credentials")) },
                    ifRight = { tokens ->
                        call.response.cookies.append(
                            name = REFRESH_TOKEN_COOKIE,
                            value = tokens.refreshToken,
                            maxAge = 30L * 24 * 60 * 60,
                            httpOnly = true,
                            secure = true,
                            extensions = mapOf("SameSite" to "Strict"),
                            path = "/api/auth",
                        )
                        call.respond(HttpStatusCode.OK, LoginResponse(tokens.accessToken, tokens.username, tokens.role))
                    },
                )
            }

            post("/auth/refresh") {
                val tokenValue = call.request.cookies[REFRESH_TOKEN_COOKIE]
                if (tokenValue == null) {
                    call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Missing refresh token"))
                    return@post
                }
                authService.refresh(tokenValue).fold(
                    ifLeft = {
                        call.respond(
                            HttpStatusCode.Unauthorized,
                            ErrorResponse("Invalid or expired refresh token")
                        )
                    },
                    ifRight = { call.respond(HttpStatusCode.OK, RefreshResponse(it)) },
                )
            }

            post("/auth/logout") {
                val tokenValue = call.request.cookies[REFRESH_TOKEN_COOKIE]
                if (tokenValue != null) {
                    authService.logout(tokenValue)
                }
                call.response.cookies.append(
                    name = REFRESH_TOKEN_COOKIE,
                    value = "",
                    maxAge = 0,
                    httpOnly = true,
                    secure = true,
                    extensions = mapOf("SameSite" to "Strict"),
                    path = "/api/auth",
                )
                call.respond(HttpStatusCode.OK)
            }

            authenticate(authMethod) {
                post("/auth/change-password") {
                    val principal = call.principal<JWTPrincipal>()!!
                    val username = principal.payload.getClaim("username").asString()
                    if (username == adminLogin) {
                        call.respond(
                            HttpStatusCode.Forbidden,
                            ErrorResponse("Admin password cannot be changed via this endpoint"),
                        )
                        return@post
                    }
                    val body = call.receive<ChangePasswordRequest>()
                    userService.changePassword(username, body.currentPassword, body.newPassword).fold(
                        ifLeft = { call.respond(HttpStatusCode.BadRequest, ErrorResponse("Password change failed")) },
                        ifRight = {
                            authService.invalidateUserSessions(username)
                            call.respond(HttpStatusCode.OK)
                        },
                    )
                }
            }
        }
    }
}
