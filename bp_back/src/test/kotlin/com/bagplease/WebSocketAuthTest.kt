package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.channels.ClosedReceiveChannelException
import kotlinx.coroutines.withTimeoutOrNull
import java.util.*

private val mapper = jacksonObjectMapper()
private const val GQL_WS_PROTOCOL = "graphql-transport-ws"

class WebSocketAuthTest : FunSpec({

    val container = mongoContainer()

    suspend fun ApplicationTestBuilder.loginToken(username: String = "admin", password: String = "admin"): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }
        return mapper.readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.registerAndLogin(username: String, password: String = "pass1234"): String {
        val adminToken = loginToken()
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"$password\") { id } }"}""")
        }
        return loginToken(username, password)
    }

    test("unauthenticated connection: missing Authorization is rejected with 4401") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }

            val wsClient = createClient { install(WebSockets) }
            wsClient.webSocket("/subscriptions", request = { header(HttpHeaders.SecWebSocketProtocol, GQL_WS_PROTOCOL) }) {
                outgoing.send(Frame.Text("""{"type":"connection_init","payload":{}}"""))
                try {
                    incoming.receive()
                } catch (_: ClosedReceiveChannelException) {
                }
                val reason = withTimeoutOrNull(3000) { closeReason.await() }
                reason shouldNotBe null
                reason!!.code shouldBe 4401.toShort()
            }
        }
    }

    test("invalid token is rejected with 4401") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }

            val wsClient = createClient { install(WebSockets) }
            wsClient.webSocket("/subscriptions", request = { header(HttpHeaders.SecWebSocketProtocol, GQL_WS_PROTOCOL) }) {
                outgoing.send(Frame.Text("""{"type":"connection_init","payload":{"Authorization":"Bearer invalid_token_xyz"}}"""))
                try {
                    incoming.receive()
                } catch (_: ClosedReceiveChannelException) {
                }
                val reason = withTimeoutOrNull(3000) { closeReason.await() }
                reason shouldNotBe null
                reason!!.code shouldBe 4401.toShort()
            }
        }
    }

    test("valid token is accepted and connection_ack is received") {
        val username = "wsAuth_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)

            val wsClient = createClient { install(WebSockets) }
            wsClient.webSocket("/subscriptions", request = { header(HttpHeaders.SecWebSocketProtocol, GQL_WS_PROTOCOL) }) {
                outgoing.send(Frame.Text("""{"type":"connection_init","payload":{"Authorization":"Bearer $token"}}"""))
                val frame = incoming.receive()
                val body = (frame as Frame.Text).readText()
                body shouldNotBe null
                body shouldContain "connection_ack"
            }
        }
    }
})
