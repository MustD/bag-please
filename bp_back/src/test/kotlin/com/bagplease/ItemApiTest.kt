package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import java.util.*

private val mapper = jacksonObjectMapper()

class ItemApiTest : FunSpec({

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

    suspend fun ApplicationTestBuilder.createList(token: String, name: String = "TestList"): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { createList(name: \"$name\") { id } }"}""")
        }
        return mapper.readTree(res.bodyAsText())["data"]["createList"]["id"].asText()
    }

    context("getItems") {
        test("saved item appears in list") {
            val catId = UUID.randomUUID()
            val itemId = UUID.randomUUID()
            val username = "user_${UUID.randomUUID().toString().take(8)}"

            testApplication {
                setUpMongo(container)
                setUpJwt()
                application { module() }
                val token = registerAndLogin(username)
                val listId = createList(token)

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Milk\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id } }"}""")
                }

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"{ getItems(listId: \"$listId\") { id name checked category listId } }"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    val body = bodyAsText()
                    body shouldNotContain "errors"
                    body shouldContain itemId.toString()
                }
            }
        }
    }

    context("saveItem") {
        test("creates item and returns it") {
            val catId = UUID.randomUUID()
            val itemId = UUID.randomUUID()
            val username = "user_${UUID.randomUUID().toString().take(8)}"

            testApplication {
                setUpMongo(container)
                setUpJwt()
                application { module() }
                val token = registerAndLogin(username)
                val listId = createList(token)

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Bread\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id name checked category listId } }"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    val body = bodyAsText()
                    body shouldNotContain "errors"
                    body shouldContain """"name":"Bread""""
                    body shouldContain """"checked":false"""
                    body shouldContain itemId.toString()
                    body shouldContain catId.toString()
                    body shouldContain listId
                }
            }
        }

        test("updates existing item") {
            val catId = UUID.randomUUID()
            val itemId = UUID.randomUUID()
            val username = "user_${UUID.randomUUID().toString().take(8)}"

            testApplication {
                setUpMongo(container)
                setUpJwt()
                application { module() }
                val token = registerAndLogin(username)
                val listId = createList(token)

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Oat milk\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id } }"}""")
                }

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Oat milk\", checked: true, category: \"$catId\", listId: \"$listId\" }) { id name checked category listId } }"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    val body = bodyAsText()
                    body shouldNotContain "errors"
                    body shouldContain """"name":"Oat milk""""
                    body shouldContain """"checked":true"""
                    body shouldContain itemId.toString()
                }
            }
        }
    }

    context("deleteItem") {
        test("deletes item and returns it") {
            val catId = UUID.randomUUID()
            val itemId = UUID.randomUUID()
            val username = "user_${UUID.randomUUID().toString().take(8)}"

            testApplication {
                setUpMongo(container)
                setUpJwt()
                application { module() }
                val token = registerAndLogin(username)
                val listId = createList(token)

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Eggs\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id } }"}""")
                }

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { deleteItem(id: \"$itemId\", listId: \"$listId\") { id name checked category listId } }"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    val body = bodyAsText()
                    body shouldNotContain "errors"
                    body shouldContain """"name":"Eggs""""
                    body shouldContain itemId.toString()
                }
            }
        }

        test("returns graphql error when item not found") {
            val missingId = UUID.randomUUID()
            val username = "user_${UUID.randomUUID().toString().take(8)}"

            testApplication {
                setUpMongo(container)
                setUpJwt()
                application { module() }
                val token = registerAndLogin(username)
                val listId = createList(token)

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { deleteItem(id: \"$missingId\", listId: \"$listId\") { id name } }"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    bodyAsText() shouldContain "errors"
                }
            }
        }
    }
})
