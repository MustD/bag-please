package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldContain
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication

class AuthApiTest : FunSpec({

    val container = mongoContainer()

    test("graphql without token returns 401") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                setBody("""{"query":"{ getItems { id } }"}""")
            }.shouldHaveStatus(HttpStatusCode.Unauthorized)
        }
    }

    test("login with valid credentials returns token") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            client.post("/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"admin","password":"admin"}""")
            }.apply {
                shouldHaveStatus(HttpStatusCode.OK)
                bodyAsText() shouldContain "token"
            }
        }
    }

    test("login with wrong password returns 401") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            client.post("/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"admin","password":"wrong"}""")
            }.shouldHaveStatus(HttpStatusCode.Unauthorized)
        }
    }
})
