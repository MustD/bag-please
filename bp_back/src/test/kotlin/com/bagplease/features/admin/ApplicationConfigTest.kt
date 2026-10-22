package com.bagplease.features.admin

import com.bagplease.module
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.appJdbcUrl
import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.shouldBe
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
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
    // One PostgreSQL per JVM: start every test from empty tables so no test depends on declaration order.
    beforeTest { SharedPostgres.reset() }

    fun appConfigRows(): Int =
        java.sql.DriverManager.getConnection(
            SharedPostgres.container.appJdbcUrl(), SharedPostgres.APP_USER, SharedPostgres.APP_PASSWORD,
        ).use { c ->
            c.createStatement().use { st ->
                st.executeQuery("SELECT count(*) FROM app_config").use { it.next(); it.getInt(1) }
            }
        }

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

    // Story 11.3: reads never write app_config, so an empty database stays empty (the importer relies on it).
    test("cold reads leave app_config empty and report registration disabled") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }

            client.get("/auth/config").bodyAsText() shouldContain "false"
            client.post("/auth/register") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"cold_read","password":"pass123"}""")
            }.shouldHaveStatus(HttpStatusCode.Forbidden)
            val adminToken = loginAdmin()
            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ applicationConfig { registrationEnabled } }"}""")
            }.bodyAsText()
            body shouldContain """"registrationEnabled":false"""
            appConfigRows() shouldBe 0
        }
    }

    test("a toggled value is stored in PostgreSQL and read back on the next request") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            for (enabled in listOf(true, false, true)) {
                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(adminToken)
                    setBody("""{"query":"mutation { setRegistrationEnabled(enabled: $enabled) { registrationEnabled } }"}""")
                }.shouldHaveStatus(HttpStatusCode.OK)
                client.get("/auth/config").bodyAsText() shouldContain "$enabled"
                appConfigRows() shouldBe 1
            }
        }
    }

    // AC1: First startup initializes with registrationEnabled: false
    test("AC1 first startup initializes applicationConfig with registrationEnabled false") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            // Enable first, so the read-back below proves the later false is a stored value, not the default.
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { setRegistrationEnabled(enabled: true) { registrationEnabled } }"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)

            // Now set to false and query — verifies the mutation + read-back path.
            // The cold-start path (no row) is covered by the zero-rows test above.
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
