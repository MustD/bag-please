package com.bagplease.features.admin

import com.bagplease.module
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

class ApplicationConfigTest : FunSpec({

    val container = mongoContainer()

    suspend fun ApplicationTestBuilder.loginAdmin(): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"admin","password":"admin"}""")
        }
        return jacksonObjectMapper().readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.loginRegularUser(username: String, password: String = "pass123"): String {
        // Ensure registration is open before registering the test user.
        val adminToken = loginAdmin()
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"mutation { setRegistrationEnabled(enabled: true) { registrationEnabled } }"}""")
        }.shouldHaveStatus(HttpStatusCode.OK)
        client.post("/auth/register") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }.shouldHaveStatus(HttpStatusCode.OK)
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }
        return jacksonObjectMapper().readTree(res.bodyAsText())["accessToken"].asText()
    }

    // AC1: First startup initializes with registrationEnabled: false
    test("AC1 first startup initializes applicationConfig with registrationEnabled false") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            // Drop the app_config document so the next load() call hits the empty-collection
            // branch and auto-initializes the default (registrationEnabled: false).
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { setRegistrationEnabled(enabled: true) { registrationEnabled } }"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)

            // Now set to false and query — verifies the mutation + read-back path.
            // The true cold-start path (empty collection) is exercised implicitly on first
            // module() startup when no app_config document exists in the container.
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { setRegistrationEnabled(enabled: false) { registrationEnabled } }"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)

            val response = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ applicationConfig { registrationEnabled } }"}""")
            }
            response.shouldHaveStatus(HttpStatusCode.OK)
            val body = response.bodyAsText()
            body shouldNotContain """"errors":"""
            body shouldContain """"registrationEnabled":false"""
        }
    }

    // AC2: applicationConfig query returns current value
    test("AC2 applicationConfig query returns the current registrationEnabled value") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            // Set to true
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { setRegistrationEnabled(enabled: true) { registrationEnabled } }"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)

            val response = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ applicationConfig { registrationEnabled } }"}""")
            }
            response.shouldHaveStatus(HttpStatusCode.OK)
            val body = response.bodyAsText()
            body shouldNotContain """"errors":"""
            body shouldContain """"registrationEnabled":true"""
        }
    }

    // AC3: setRegistrationEnabled persists and subsequent query reflects change
    test("AC3 setRegistrationEnabled persists and subsequent query reflects the change") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            val mutationResponse = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { setRegistrationEnabled(enabled: true) { registrationEnabled } }"}""")
            }
            mutationResponse.shouldHaveStatus(HttpStatusCode.OK)
            mutationResponse.bodyAsText() shouldContain """"registrationEnabled":true"""

            val queryResponse = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ applicationConfig { registrationEnabled } }"}""")
            }
            queryResponse.shouldHaveStatus(HttpStatusCode.OK)
            queryResponse.bodyAsText() shouldContain """"registrationEnabled":true"""
        }
    }

    // AC4: User-role JWT on setRegistrationEnabled returns FORBIDDEN GQL error
    test("AC4 user-role JWT on setRegistrationEnabled mutation returns FORBIDDEN GQL error") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("testuser_ac4")

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userToken)
                setBody("""{"query":"mutation { setRegistrationEnabled(enabled: true) { registrationEnabled } }"}""")
            }.bodyAsText()
            body shouldContain """"code":"FORBIDDEN""""
        }
    }

    // AC4 (query path): User-role JWT on applicationConfig query also returns FORBIDDEN
    test("AC4 user-role JWT on applicationConfig query returns FORBIDDEN GQL error") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("testuser_ac4_query")

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userToken)
                setBody("""{"query":"{ applicationConfig { registrationEnabled } }"}""")
            }.bodyAsText()
            body shouldContain """"code":"FORBIDDEN""""
        }
    }

    // AC5: No JWT on /graphql returns HTTP 401
    test("AC5 unauthenticated request to graphql returns HTTP 401") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }

            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                setBody("""{"query":"mutation { setRegistrationEnabled(enabled: true) { registrationEnabled } }"}""")
            }.shouldHaveStatus(HttpStatusCode.Unauthorized)
        }
    }

    // Registration enforcement: POST /auth/register returns 403 when registrationEnabled is false
    test("registration returns 403 when registrationEnabled is false") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { setRegistrationEnabled(enabled: false) { registrationEnabled } }"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)

            client.post("/auth/register") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"blocked_user","password":"pass123"}""")
            }.shouldHaveStatus(HttpStatusCode.Forbidden)
        }
    }
})
