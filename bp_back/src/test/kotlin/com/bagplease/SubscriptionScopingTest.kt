package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
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
import kotlinx.coroutines.async
import kotlinx.coroutines.withTimeoutOrNull
import java.util.*

private val mapper = jacksonObjectMapper()
private const val GQL_WS_PROTOCOL = "graphql-transport-ws"

class SubscriptionScopingTest : FunSpec({

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

    suspend fun ApplicationTestBuilder.createList(token: String): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { createList(name: \"List_${UUID.randomUUID().toString().take(8)}\") { id } }"}""")
        }
        return mapper.readTree(res.bodyAsText())["data"]["createList"]["id"].asText()
    }

    test("subscribe-time gate: non-member receives error on itemUpdates(listId)") {
        val userA = "scopeA_${UUID.randomUUID().toString().take(8)}"
        val userB = "scopeB_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val tokenA = registerAndLogin(userA)
            val tokenB = registerAndLogin(userB)
            val listId = createList(tokenA)

            val wsClient = createClient { install(WebSockets) }
            wsClient.webSocket("/subscriptions", request = { header(HttpHeaders.SecWebSocketProtocol, GQL_WS_PROTOCOL) }) {
                // Authenticate as user B (not a member of listA)
                outgoing.send(Frame.Text("""{"type":"connection_init","payload":{"Authorization":"Bearer $tokenB"}}"""))
                val ackFrame = incoming.receive()
                (ackFrame as Frame.Text).readText() shouldContain "connection_ack"

                // Subscribe to itemUpdates for a list B is not a member of
                val subId = UUID.randomUUID().toString()
                outgoing.send(Frame.Text("""{"type":"subscribe","id":"$subId","payload":{"query":"subscription { getItemUpdates(listId: \"$listId\") { type item { id } } }"}}"""))

                // AC3 requires an active GQL error response, not silence
                val response = withTimeoutOrNull(3000) { incoming.receive() }
                response shouldNotBe null
                if (response is Frame.Text) {
                    response.readText() shouldContain "error"
                }
            }
        }
    }

    test("cross-list isolation: item mutation in listA does not reach listB subscriber") {
        val userA = "isolA_${UUID.randomUUID().toString().take(8)}"
        val userB = "isolB_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val tokenA = registerAndLogin(userA)
            val tokenB = registerAndLogin(userB)
            val listIdA = createList(tokenA)
            val listIdB = createList(tokenB)

            val wsClient = createClient { install(WebSockets) }

            // User B subscribes to their own listB updates, collects any events received
            val receivedByB = async {
                var received: String? = null
                wsClient.webSocket("/subscriptions", request = { header(HttpHeaders.SecWebSocketProtocol, GQL_WS_PROTOCOL) }) {
                    outgoing.send(Frame.Text("""{"type":"connection_init","payload":{"Authorization":"Bearer $tokenB"}}"""))
                    val ack = incoming.receive() as Frame.Text
                    ack.readText() shouldContain "connection_ack"

                    val subId = UUID.randomUUID().toString()
                    outgoing.send(Frame.Text("""{"type":"subscribe","id":"$subId","payload":{"query":"subscription { getItemUpdates(listId: \"$listIdB\") { type item { id } } }"}}"""))

                    // Wait briefly for any events from listA mutation
                    val event = withTimeoutOrNull(2000) {
                        val frame = incoming.receive()
                        if (frame is Frame.Text) frame.readText() else null
                    }
                    received = event
                }
                received
            }

            // Mutate an item in listA (User A)
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(tokenA)
                setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"ListAItem\", checked: false, category: \"$catId\", listId: \"$listIdA\" }) { id } }"}""")
            }

            // User B's listB subscriber should receive NO event from listA mutation
            val eventForB = receivedByB.await()
            if (eventForB != null) {
                eventForB shouldNotContain itemId.toString()
            }
        }
    }

    test("cross-list isolation: category mutation in listA does not reach listB subscriber") {
        val userA = "catIsolA_${UUID.randomUUID().toString().take(8)}"
        val userB = "catIsolB_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val tokenA = registerAndLogin(userA)
            val tokenB = registerAndLogin(userB)
            val listIdA = createList(tokenA)
            val listIdB = createList(tokenB)

            val wsClient = createClient { install(WebSockets) }

            val receivedByB = async {
                var received: String? = null
                wsClient.webSocket("/subscriptions", request = { header(HttpHeaders.SecWebSocketProtocol, GQL_WS_PROTOCOL) }) {
                    outgoing.send(Frame.Text("""{"type":"connection_init","payload":{"Authorization":"Bearer $tokenB"}}"""))
                    val ack = incoming.receive() as Frame.Text
                    ack.readText() shouldContain "connection_ack"

                    val subId = UUID.randomUUID().toString()
                    outgoing.send(Frame.Text("""{"type":"subscribe","id":"$subId","payload":{"query":"subscription { getCategoryUpdates(listId: \"$listIdB\") { type item { id } } }"}}"""))

                    val event = withTimeoutOrNull(2000) {
                        val frame = incoming.receive()
                        if (frame is Frame.Text) frame.readText() else null
                    }
                    received = event
                }
                received
            }

            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(tokenA)
                setBody("""{"query":"mutation { saveCategory(category: { id: \"$catId\", name: \"ListACat\", listId: \"$listIdA\" }) { id } }"}""")
            }

            val eventForB = receivedByB.await()
            if (eventForB != null) {
                eventForB shouldNotContain catId.toString()
            }
        }
    }

    // TODO (Story 4.3): Add Point 2 (takeWhile membership revocation) test once member removal
    // mutation is available. This test requires removing a user from a list mid-subscription
    // and verifying the subscription terminates on the next event after removal.
})
