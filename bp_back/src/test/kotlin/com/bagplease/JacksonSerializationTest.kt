package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.accept
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.ktor.websocket.Frame
import io.ktor.websocket.readText

// Story 10.2: pins which Jackson writes what (rule in bp_back/CLAUDE.md).
// GraphQL HTTP bodies come from graphql-kotlin's route-level ContentNegotiation
// (Jackson 3); REST auth DTOs come from the root ContentNegotiation (Jackson 2).
// Moving or removing the root install must fail the REST-order and 406 rows.
class JacksonSerializationTest : FunSpec({

    val container = mongoContainer()

    suspend fun ApplicationTestBuilder.adminToken(): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"admin","password":"admin"}""")
        }
        return jacksonObjectMapper().readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.gql(token: String, accept: String?): HttpResponse =
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            if (accept != null) header(HttpHeaders.Accept, accept)
            setBody("""{"query":"{ __typename }"}""")
        }

    fun ApplicationTestBuilder.boot() {
        setUpMongo(container)
        setUpJwt()
        application { module() }
    }

    test("GraphQL answers 200 application/json without charset and a compact body for json, wildcard and absent Accept") {
        testApplication {
            boot()
            val token = adminToken()
            for (accept in listOf("application/json", "*/*", null)) {
                val res = gql(token, accept)
                res.status shouldBe HttpStatusCode.OK
                res.headers[HttpHeaders.ContentType] shouldBe "application/json"
                val body = res.bodyAsText()
                body shouldBe """{"data":{"__typename":"Query"}}"""
                body shouldNotContain "\n"
            }
        }
    }

    test("GraphQL error bodies are compact too") {
        testApplication {
            boot()
            val token = adminToken()
            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"{ nope }"}""")
            }
            res.bodyAsText() shouldBe
                """{"errors":[{"message":"Validation error (FieldUndefined@[nope]) : Field 'nope' in type 'Query' is undefined","locations":[{"line":1,"column":3}],"extensions":{}}]}"""
        }
    }

    test("graphql-ws frames are written without a Ktor websocket converter") {
        testApplication {
            boot()
            val token = adminToken()
            val ws = createClient { install(WebSockets) }
            ws.webSocket("/subscriptions", request = { header(HttpHeaders.SecWebSocketProtocol, "graphql-transport-ws") }) {
                outgoing.send(Frame.Text("""{"type":"connection_init","payload":{"Authorization":"Bearer $token"}}"""))
                (incoming.receive() as Frame.Text).readText() shouldBe """{"type":"connection_ack"}"""
            }
        }
    }

    test("GraphQL answers 406 with an empty body for unacceptable Accept") {
        testApplication {
            boot()
            val token = adminToken()
            for (accept in listOf("application/xml", "text/plain")) {
                val res = gql(token, accept)
                res.status shouldBe HttpStatusCode.NotAcceptable
                res.bodyAsText() shouldBe ""
            }
        }
    }

    test("REST login is written by the root Jackson in declaration order") {
        testApplication {
            boot()
            val res = client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                accept(ContentType.Application.Json)
                setBody("""{"username":"admin","password":"admin"}""")
            }
            res.status shouldBe HttpStatusCode.OK
            jacksonObjectMapper().readTree(res.bodyAsText()).fieldNames().asSequence().toList() shouldBe
                listOf("accessToken", "username", "role")
        }
    }
})
