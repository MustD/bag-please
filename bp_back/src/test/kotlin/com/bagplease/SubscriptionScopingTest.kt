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

    suspend fun ApplicationTestBuilder.saveCategory(token: String, catId: UUID, listId: String, name: String = "Cat"): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { saveCategory(category: { id: \"$catId\", name: \"$name\", listId: \"$listId\" }) { id } }"}""")
        }
        return res.bodyAsText()
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

            // Story 9.3: saveItem rejects a category that is not on the target list on BOTH branches,
            // so the category this item names has to exist before the item does.
            saveCategory(tokenA, catId, listIdA)

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

    test("Point 2 takeWhile revocation: subscriber flow terminates after removeMember") {
        val owner = "revokeOwner_${UUID.randomUUID().toString().take(8)}"
        val userA = "revokeUserA_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()
        val itemId = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(owner)
            val userAToken = registerAndLogin(userA)
            val listId = createList(ownerToken)
            // Story 9.3: the trigger item below names this category, and saveItem now rejects a
            // category that is not on the list.
            saveCategory(ownerToken, catId, listId)

            // Share list with userA and have them accept
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(ownerToken)
                setBody("""{"query":"mutation { shareList(listId: \"$listId\", username: \"$userA\") { id } }"}""")
            }
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userAToken)
                setBody("""{"query":"mutation { acceptInvite(listId: \"$listId\") { id } }"}""")
            }

            val wsClient = createClient { install(WebSockets) }

            // userA subscribes to itemUpdates
            val receivedAfterRemoval = async {
                var gotEventAfterRemoval = false
                wsClient.webSocket("/subscriptions", request = { header(HttpHeaders.SecWebSocketProtocol, GQL_WS_PROTOCOL) }) {
                    outgoing.send(Frame.Text("""{"type":"connection_init","payload":{"Authorization":"Bearer $userAToken"}}"""))
                    val ack = incoming.receive() as Frame.Text
                    ack.readText() shouldContain "connection_ack"

                    val subId = UUID.randomUUID().toString()
                    outgoing.send(Frame.Text("""{"type":"subscribe","id":"$subId","payload":{"query":"subscription { getItemUpdates(listId: \"$listId\") { type item { id } } }"}}"""))

                    // Wait briefly for subscription to be established
                    kotlinx.coroutines.delay(200)

                    // Owner removes userA while subscription is active
                    client.post("/graphql") {
                        contentType(ContentType.Application.Json)
                        bearerAuth(ownerToken)
                        setBody("""{"query":"mutation { removeMember(listId: \"$listId\", username: \"$userA\") { id } }"}""")
                    }

                    // Owner triggers an item mutation to emit an event
                    client.post("/graphql") {
                        contentType(ContentType.Application.Json)
                        bearerAuth(ownerToken)
                        setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"TriggerItem\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id } }"}""")
                    }

                    // userA should receive no event after removal (flow terminates)
                    val event = withTimeoutOrNull(2000) { incoming.receive() }
                    if (event is Frame.Text) {
                        val text = event.readText()
                        // If we get a next message, it should not be a data event for this item
                        if (text.contains(itemId.toString())) {
                            gotEventAfterRemoval = true
                        }
                    }
                }
                gotEventAfterRemoval
            }

            receivedAfterRemoval.await() shouldBe false
        }
    }

    // ── Story 9.3 ── the cascade's event contract ─────────────────────────
    //
    // Both SharedFlows are extraBufferCapacity = 1 with DROP_OLDEST, so a per-item fan-out would be
    // silently truncated for any subscriber that is not consuming instantly — which is the partial-prune
    // bug the cascade exists to remove. The contract is therefore "one category DELETED event, and the
    // client treats it as authoritative for the children"; nothing else in the suite would notice a
    // well-meant per-item emit being added back.
    test("9.3 a category cascade emits ONE category DELETED event and NO item events") {
        val user = "cascEvt_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()
        val itemIds = List(3) { UUID.randomUUID() }
        val itemSub = "items-${UUID.randomUUID()}"
        val catSub = "cats-${UUID.randomUUID()}"
        val probeCatId = UUID.randomUUID()
        val probeItemId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(user)
            val listId = createList(token)
            saveCategory(token, catId, listId, "Doomed") shouldNotContain "errors"
            for (itemId in itemIds) {
                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Casc\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id } }"}""")
                }.bodyAsText() shouldNotContain "errors"
            }

            val wsClient = createClient { install(WebSockets) }
            val frames = mutableListOf<String>()
            wsClient.webSocket("/subscriptions", request = { header(HttpHeaders.SecWebSocketProtocol, GQL_WS_PROTOCOL) }) {
                outgoing.send(Frame.Text("""{"type":"connection_init","payload":{"Authorization":"Bearer $token"}}"""))
                (incoming.receive() as Frame.Text).readText() shouldContain "connection_ack"

                // BOTH streams on one socket: an item-event regression is only observable from a
                // subscriber that was listening to the item stream at the moment of the delete.
                outgoing.send(Frame.Text("""{"type":"subscribe","id":"$itemSub","payload":{"query":"subscription { getItemUpdates(listId: \"$listId\") { type item { id } } }"}}"""))
                outgoing.send(Frame.Text("""{"type":"subscribe","id":"$catSub","payload":{"query":"subscription { getCategoryUpdates(listId: \"$listId\") { type item { id } } }"}}"""))

                // Both streams are proven LIVE by a probe, not by a sleep (review finding, 2026-09-17).
                // graphql-ws sends no per-subscription ack, so the previous `delay(400)` was the only
                // thing between "subscribe sent" and the delete: on a slow box the subscriptions would
                // register AFTER the delete and the "no item events" assertion below would pass for the
                // wrong reason — the most expensive kind of green, on the one test that guards this
                // story's event contract. The probe writes a category and an item on this list and waits
                // for each stream to deliver its own frame; only then is either stream known to be
                // attached. The probe pair also doubles as a control: neither belongs to the doomed
                // category, so both must SURVIVE the cascade.
                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveCategory(category: { id: \"$probeCatId\", name: \"Probe\", listId: \"$listId\" }) { id } }"}""")
                }.bodyAsText() shouldNotContain "errors"
                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$probeItemId\", name: \"Probe\", checked: false, category: \"$probeCatId\", listId: \"$listId\" }) { id } }"}""")
                }.bodyAsText() shouldNotContain "errors"

                var catStreamLive = false
                var itemStreamLive = false
                val probesArrived = withTimeoutOrNull(5000) {
                    while (!catStreamLive || !itemStreamLive) {
                        val frame = incoming.receive()
                        if (frame !is Frame.Text) continue
                        val text = frame.readText()
                        if (!text.contains(""""type":"next"""")) continue
                        if (text.contains(""""id":"$catSub"""") && text.contains(probeCatId.toString())) catStreamLive = true
                        if (text.contains(""""id":"$itemSub"""") && text.contains(probeItemId.toString())) itemStreamLive = true
                    }
                    true
                }
                // Fail LOUDLY rather than drifting into a vacuous pass if a stream never attaches.
                probesArrived shouldBe true

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { deleteCategory(id: \"$catId\", listId: \"$listId\") { id } }"}""")
                }.bodyAsText() shouldNotContain "errors"

                // Drain for a fixed window rather than receiving a fixed number of frames: the failure
                // being guarded is EXTRA events, and a counted receive would simply stop before them.
                withTimeoutOrNull(2000) {
                    while (true) {
                        val frame = incoming.receive()
                        if (frame is Frame.Text) frames += frame.readText()
                    }
                }
            }

            val payloads = frames.filter { it.contains(""""type":"next"""") }
            val categoryEvents = payloads.filter { it.contains(""""id":"$catSub"""") }
            val itemEvents = payloads.filter { it.contains(""""id":"$itemSub"""") }

            // The cascade actually RAN — without this the "no item events" assertion is also satisfied
            // by a deleteCategory that never touched the items at all, which is the pre-story behaviour.
            val remaining = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"{ getItems(listId: \"$listId\") { id } }"}""")
            }.bodyAsText()
            for (itemId in itemIds) remaining shouldNotContain itemId.toString()
            // The probe pair as a control: a cascade that wiped the whole list would satisfy the
            // "doomed items are gone" assertion above just as well.
            remaining shouldContain probeItemId.toString()

            categoryEvents.size shouldBe 1
            categoryEvents.single() shouldContain catId.toString()
            categoryEvents.single() shouldContain "DELETED"
            itemEvents shouldBe emptyList()
        }
    }
})
