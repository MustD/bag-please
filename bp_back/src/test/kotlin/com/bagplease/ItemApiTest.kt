package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldContain
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.config.mergeWith
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import java.util.*

private val mapper = jacksonObjectMapper()

class ItemApiTest : FunSpec({

    val container = mongoContainer()

    suspend fun ApplicationTestBuilder.loginToken(): String {
        val res = client.post("/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"admin","password":"admin"}""")
        }
        return mapper.readTree(res.bodyAsText())["token"].asText()
    }

    context("getItems") {
        test("saved item appears in list") {
            val catId = UUID.randomUUID()
            val itemId = UUID.randomUUID()

            testApplication {
                application { module() }
                val token = loginToken()

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Milk\", checked: false, category: \"$catId\" }) { id } }"}""")
                }

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"{ getItems { id name checked category } }"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    bodyAsText() shouldContain itemId.toString()
                }
            }
        }
    }

    context("saveItem") {
        test("creates item and returns it") {
            val catId = UUID.randomUUID()
            val itemId = UUID.randomUUID()

            testApplication {
                application { module() }
                setUpMongo(container)
                setUpJwt()
                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(loginToken())
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Bread\", checked: false, category: \"$catId\" }) { id name checked category } }"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    val body = bodyAsText()
                    body shouldContain """"name":"Bread""""
                    body shouldContain """"checked":false"""
                    body shouldContain itemId.toString()
                    body shouldContain catId.toString()
                }
            }
        }

        test("updates existing item") {
            val catId = UUID.randomUUID()
            val itemId = UUID.randomUUID()

            testApplication {
                application { module() }
                setUpMongo(container)
                setUpJwt()
                val token = loginToken()

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Oat milk\", checked: false, category: \"$catId\" }) { id } }"}""")
                }

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Oat milk\", checked: true, category: \"$catId\" }) { id name checked category } }"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    val body = bodyAsText()
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

            testApplication {
                application { module() }
                setUpMongo(container)
                setUpJwt()
                val token = loginToken()

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Eggs\", checked: false, category: \"$catId\" }) { id } }"}""")
                }

                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(token)
                    setBody("""{"query":"mutation { deleteItem(id: \"$itemId\") { id name checked category } }"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    val body = bodyAsText()
                    body shouldContain """"name":"Eggs""""
                    body shouldContain itemId.toString()
                }
            }
        }

        test("returns graphql error when item not found") {
            val missingId = UUID.randomUUID()

            testApplication {
                application { module() }
                setUpMongo(container)
                setUpJwt()
                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(loginToken())
                    setBody("""{"query":"mutation { deleteItem(id: \"$missingId\") { id name } }"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    bodyAsText() shouldContain "errors"
                }
            }
        }
    }
})
