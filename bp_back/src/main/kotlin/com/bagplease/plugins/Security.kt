package com.bagplease.plugins

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.bagplease.Service
import io.ktor.http.*
import io.ktor.serialization.jackson.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.time.ZonedDateTime

data class User(val username: String, val password: String)

const val authMethod = "auth-jwt"

fun Application.configureSecurity() {
    val myRealm = environment.config.property("jwt.realm").getString()
    val secret = environment.config.property("jwt.secret").getString()
    val issuer = environment.config.property("jwt.issuer").getString()
    val audience = environment.config.property("jwt.audience").getString()

    install(Authentication) {
        jwt(authMethod) {
            realm = myRealm
            verifier(
                JWT.require(Algorithm.HMAC256(secret)).withAudience(audience).withIssuer(issuer).build()
            )

            validate { credential ->
                if (credential.payload.getClaim("username").asString() != "") {
                    JWTPrincipal(credential.payload)
                } else {
                    null
                }
            }
            challenge { defaultScheme, realm ->
                call.respond(HttpStatusCode.Unauthorized, "Token is not valid or has expired")
            }
        }
    }

}

fun Routing.securityRoutes() {
    val config = Service.config.config("jwt")
    val secret = config.property("secret").getString()
    val issuer = config.property("issuer").getString()
    val audience = config.property("audience").getString()
    val adminLogin = config.property("admin_login").getString()
    val adminPass = config.property("admin_pass").getString()

    install(ContentNegotiation) {
        jackson()
    }

    post("/login") {

        val user = call.receive<User>()

        if (user.username != adminLogin || user.password != adminPass) {
            call.respond(HttpStatusCode.Unauthorized, "Username and password does not match the password")
        }

        val token = JWT.create()
            .withAudience(audience)
            .withIssuer(issuer)
            .withClaim("username", user.username)
            .withExpiresAt(ZonedDateTime.now().plusDays(7).toInstant())
            .sign(Algorithm.HMAC256(secret))
        call.respond(hashMapOf("token" to token, "user" to user.username))
    }

    authenticate(authMethod) {
        get("/auth-test") {
            val principal = call.principal<JWTPrincipal>()
            val username = principal!!.payload.getClaim("username").asString()
            val expiresAt = principal.expiresAt?.time?.minus(System.currentTimeMillis())
            call.respondText("Hello, $username! Token is expired at $expiresAt ms.")
        }
    }

}
