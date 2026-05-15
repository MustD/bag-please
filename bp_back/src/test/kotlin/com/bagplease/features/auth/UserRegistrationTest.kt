package com.bagplease.features.auth

import com.bagplease.module
import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.bagplease.utils.setUpRegistration
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import java.util.*

class UserRegistrationTest : FunSpec({

    val container = mongoContainer()

    context("POST /auth/register") {

        test("successful registration returns username and role") {
            val username = "user_${UUID.randomUUID().toString().take(8)}"
            testApplication {
                setUpMongo(container)
                setUpJwt()
                setUpRegistration(container, true)
                application { module() }
                client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"$username","password":"secret123"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.OK)
                    val body = bodyAsText()
                    body shouldContain """"username":"$username""""
                    body shouldContain """"role":"user""""
                    body shouldNotContain "secret123"
                }
            }
        }

        test("duplicate username returns 400") {
            val username = "user_${UUID.randomUUID().toString().take(8)}"
            testApplication {
                setUpMongo(container)
                setUpJwt()
                setUpRegistration(container, true)
                application { module() }
                client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"$username","password":"pass1"}""")
                }.shouldHaveStatus(HttpStatusCode.OK)

                client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"$username","password":"pass2"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.BadRequest)
                    bodyAsText() shouldContain "error"
                }
            }
        }

        test("reserved admin username returns 400") {
            testApplication {
                setUpMongo(container)
                setUpJwt()
                setUpRegistration(container, true)
                application { module() }
                client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"admin","password":"anything"}""")
                }.apply {
                    shouldHaveStatus(HttpStatusCode.BadRequest)
                    bodyAsText() shouldContain "error"
                }
            }
        }

        test("uniform error message for duplicate and reserved username") {
            val username = "user_${UUID.randomUUID().toString().take(8)}"
            testApplication {
                setUpMongo(container)
                setUpJwt()
                setUpRegistration(container, true)
                application { module() }

                client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"$username","password":"pass1"}""")
                }.shouldHaveStatus(HttpStatusCode.OK)

                val duplicateError = client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"$username","password":"pass2"}""")
                }.bodyAsText()

                val reservedError = client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"admin","password":"pass3"}""")
                }.bodyAsText()

                duplicateError shouldBe reservedError
            }
        }

        test("registered user persists across app restart (MongoDB persistence)") {
            val username = "user_${UUID.randomUUID().toString().take(8)}"

            testApplication {
                setUpMongo(container)
                setUpJwt()
                setUpRegistration(container, true)
                application { module() }
                client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"$username","password":"pass1"}""")
                }.shouldHaveStatus(HttpStatusCode.OK)
            }

            // Registers in one app instance, verifies second instance sees the user via MongoDB
            testApplication {
                setUpMongo(container)
                setUpJwt()
                setUpRegistration(container, true)
                application { module() }
                client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"$username","password":"pass2"}""")
                }.shouldHaveStatus(HttpStatusCode.BadRequest)
            }
        }

        test("rate limit returns 429 on 6th request from same IP") {
            testApplication {
                setUpMongo(container)
                setUpJwt()
                setUpRegistration(container, true)
                application { module() }

                repeat(5) { _ ->
                    val username = "user_${UUID.randomUUID().toString().take(8)}"
                    client.post("/auth/register") {
                        contentType(ContentType.Application.Json)
                        setBody("""{"username":"$username","password":"pass"}""")
                    }.also { response ->
                        response.status shouldBe HttpStatusCode.OK
                    }
                }

                client.post("/auth/register") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"user_${UUID.randomUUID().toString().take(8)}","password":"pass"}""")
                }.shouldHaveStatus(HttpStatusCode.TooManyRequests)
            }
        }
    }
})
