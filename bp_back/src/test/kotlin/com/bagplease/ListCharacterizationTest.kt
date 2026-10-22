package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication

private val mapper = jacksonObjectMapper()

/**
 * Story 11.4 characterization: the exact GraphQL JSON of the list flows with an owner, an accepted member and a
 * pending invitee. Captured green on the Mongo implementation first; it must pass unchanged on PostgreSQL.
 */
class ListCharacterizationTest : FunSpec({

    val container = mongoContainer()

    suspend fun ApplicationTestBuilder.login(username: String, password: String): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }
        return mapper.readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.gql(token: String, query: String): String =
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody(mapper.writeValueAsString(mapOf("query" to query)))
        }.bodyAsText()

    test("owner + accepted + pending: members JSON, order and owner exclusion are unchanged") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val admin = login("admin", "admin")
            val ids = listOf("charOwner", "charAccepted", "charPending").associateWith { name ->
                mapper.readTree(
                    gql(admin, """mutation { createUser(username: "$name", password: "pass1234") { id } }""")
                )["data"]["createUser"]["id"].asText()
            }
            val owner = login("charOwner", "pass1234")
            val accepted = login("charAccepted", "pass1234")

            val created = mapper.readTree(
                gql(owner, """mutation { createList(name: "Char", emoji: "x") { id name emoji ownerId ownerUsername members { userId username status } uncheckedItemCount } }""")
            )["data"]["createList"]
            val listId = created["id"].asText()
            mapper.writeValueAsString(created) shouldBe
                """{"id":"$listId","name":"Char","emoji":"x","ownerId":"${ids["charOwner"]}","ownerUsername":"charOwner","members":[],"uncheckedItemCount":0}"""

            val shared = gql(owner, """mutation { shareList(listId: "$listId", username: "charAccepted") { id members { userId username status } } }""")
            shared shouldBe
                """{"data":{"shareList":{"id":"$listId","members":[{"userId":"${ids["charAccepted"]}","username":"charAccepted","status":"PENDING"}]}}}"""
            gql(accepted, """mutation { acceptInvite(listId: "$listId") { id } }""") shouldBe
                """{"data":{"acceptInvite":{"id":"$listId"}}}"""
            val sharedPending = gql(owner, """mutation { shareList(listId: "$listId", username: "charPending") { id members { userId username status } } }""")
            sharedPending shouldBe
                """{"data":{"shareList":{"id":"$listId","members":[{"userId":"${ids["charAccepted"]}","username":"charAccepted","status":"ACCEPTED"},{"userId":"${ids["charPending"]}","username":"charPending","status":"PENDING"}]}}}"""

            val lists = gql(owner, """{ lists { lists { id name emoji ownerId ownerUsername members { userId username status } createdAt uncheckedItemCount } pendingInvites { listId } } }""")
            val node = mapper.readTree(lists)["data"]["lists"]["lists"][0]
            (node as com.fasterxml.jackson.databind.node.ObjectNode).remove("createdAt")
            mapper.writeValueAsString(node) shouldBe
                """{"id":"$listId","name":"Char","emoji":"x","ownerId":"${ids["charOwner"]}","ownerUsername":"charOwner","members":[{"userId":"${ids["charAccepted"]}","username":"charAccepted","status":"ACCEPTED"},{"userId":"${ids["charPending"]}","username":"charPending","status":"PENDING"}],"uncheckedItemCount":0}"""

            val pendingUser = login("charPending", "pass1234")
            gql(pendingUser, """{ lists { lists { id } pendingInvites { listId listName listEmoji ownerUsername } } }""") shouldBe
                """{"data":{"lists":{"lists":[],"pendingInvites":[{"listId":"$listId","listName":"Char","listEmoji":"x","ownerUsername":"charOwner"}]}}}"""

            gql(owner, """mutation { removeMember(listId: "$listId", username: "charAccepted") { id members { username status } } }""") shouldBe
                """{"data":{"removeMember":{"id":"$listId","members":[{"username":"charPending","status":"PENDING"}]}}}"""
        }
    }
    test("uncheckedItemCount counts only unchecked items, per list, in the lists query and mutation payloads") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val admin = login("admin", "admin")
            gql(admin, """mutation { createUser(username: "countOwner", password: "pass1234") { id } }""")
            val owner = login("countOwner", "pass1234")
            val busy = mapper.readTree(gql(owner, """mutation { createList(name: "Busy") { id } }"""))["data"]["createList"]["id"].asText()
            gql(owner, """mutation { createList(name: "Empty") { id } }""")
            val cat = java.util.UUID.randomUUID()
            gql(owner, """mutation { saveCategory(category: { id: "$cat", name: "C", listId: "$busy" }) { id } }""") shouldBe
                """{"data":{"saveCategory":{"id":"$cat"}}}"""
            for ((n, checked) in listOf("a" to false, "b" to false, "c" to true)) {
                val res = gql(owner, """mutation { saveItem(item: { id: "${java.util.UUID.randomUUID()}", name: "$n", checked: $checked, category: "$cat", listId: "$busy", stores: [] }) { id } }""")
                (res.contains("errors")) shouldBe false
            }
            val counts = mapper.readTree(gql(owner, """{ lists { lists { name uncheckedItemCount } } }"""))["data"]["lists"]["lists"]
                .associate { it["name"].asText() to it["uncheckedItemCount"].asInt() }
            counts shouldBe mapOf("Busy" to 2, "Empty" to 0)
            gql(owner, """mutation { renameList(id: "$busy", name: "Busy2") { uncheckedItemCount } }""") shouldBe
                """{"data":{"renameList":{"uncheckedItemCount":2}}}"""
        }
    }
})
