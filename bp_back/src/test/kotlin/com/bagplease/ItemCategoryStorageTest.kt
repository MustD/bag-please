package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import java.util.*

private val mapper = jacksonObjectMapper()

class ItemCategoryStorageTest : FunSpec({

    val container = mongoContainer()

    suspend fun ApplicationTestBuilder.loginToken(username: String = "admin", password: String = "admin"): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }
        return mapper.readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.createUserAndLogin(username: String, password: String = "pass1234"): String {
        val adminToken = loginToken()
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"$password\") { id } }"}""")
        }
        return loginToken(username, password)
    }

    suspend fun ApplicationTestBuilder.createList(token: String, name: String = "TestList"): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { createList(name: \"$name\") { id } }"}""")
        }
        val body = res.bodyAsText()
        body shouldNotContain "errors"
        return mapper.readTree(body)["data"]["createList"]["id"].asText()
    }

    test("AC4 evictList on ItemStorage: post-evict getByListId returns empty") {
        val username = "evict_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()
        val itemId = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = createUserAndLogin(username)
            val listId = createList(token)

            // Create an item in the list
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"EvictItem\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id } }"}""")
            }

            // Verify item is accessible
            val beforeEvict = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"{ getItems(listId: \"$listId\") { id name } }"}""")
            }.bodyAsText()
            beforeEvict shouldContain itemId.toString()

            // deleteList triggers evictList
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { deleteList(id: \"$listId\") { deletedItemCount } }"}""")
            }.bodyAsText() shouldNotContain "errors"

            // After deleteList, querying items(listId) returns an error (non-member / list not found)
            val afterEvict = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"{ getItems(listId: \"$listId\") { id name } }"}""")
            }.bodyAsText()
            afterEvict shouldContain "errors"
            afterEvict shouldNotContain "EvictItem"
        }
    }

    test("AC4 evictList does not affect items in different lists") {
        val username = "evict2_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()
        val itemId1 = UUID.randomUUID()
        val itemId2 = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = createUserAndLogin(username)
            val listId1 = createList(token, "List1")
            val listId2 = createList(token, "List2")

            // Create items in both lists
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId1\", name: \"Item1\", checked: false, category: \"$catId\", listId: \"$listId1\" }) { id } }"}""")
            }
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId2\", name: \"Item2\", checked: false, category: \"$catId\", listId: \"$listId2\" }) { id } }"}""")
            }

            // Delete list1 only
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { deleteList(id: \"$listId1\") { deletedItemCount } }"}""")
            }

            // List2's items should still be accessible
            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"{ getItems(listId: \"$listId2\") { id name } }"}""")
            }.bodyAsText()
            res shouldNotContain "errors"
            res shouldContain itemId2.toString()
        }
    }
})
