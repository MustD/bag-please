package com.bagplease.features.auth

import com.bagplease.features.auth.dto.ErrorResponse
import com.bagplease.module
import com.bagplease.plugins.authMethod
import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.bagplease.utils.setUpRegistration
import com.mongodb.client.model.Filters
import com.mongodb.kotlin.client.coroutine.MongoClient
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import org.bson.Document
import java.util.*

class LoginTokenTest : FunSpec({

    val container = mongoContainer()

    fun randomUser() = "user_${UUID.randomUUID().toString().take(8)}"

    suspend fun io.ktor.server.testing.ApplicationTestBuilder.registerUser(
        username: String,
        password: String = "password123",
    ) {
        setUpRegistration(container, true)
        client.post("/auth/register") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }.shouldHaveStatus(HttpStatusCode.OK)
    }

    suspend fun io.ktor.server.testing.ApplicationTestBuilder.loginUser(
        username: String,
        password: String = "password123",
    ): Pair<String, String> {
        val response = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }
        response.shouldHaveStatus(HttpStatusCode.OK)
        val body = response.bodyAsText()
        val accessToken = body.substringAfter(""""accessToken":"""").substringBefore('"')
        val cookieHeader = response.headers["Set-Cookie"] ?: ""
        val refreshToken = cookieHeader.substringAfter("refresh_token=").substringBefore(";")
        return Pair(accessToken, refreshToken)
    }

    // AC1 — admin login returns accessToken, username, role:admin and sets refresh cookie
    test("AC1 admin login returns accessToken with correct fields and sets refresh cookie") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val response = client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"admin","password":"admin"}""")
            }
            response.shouldHaveStatus(HttpStatusCode.OK)
            val body = response.bodyAsText()
            body shouldContain "accessToken"
            body shouldContain """"username":"admin""""
            body shouldContain """"role":"admin""""
            response.headers["Set-Cookie"] shouldContain "refresh_token="
            response.headers["Set-Cookie"] shouldContain "HttpOnly"
        }
    }

    // AC1 — registered user login returns accessToken, correct username, role:user and sets refresh cookie
    test("AC1 registered user login returns accessToken with role user") {
        val username = randomUser()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            registerUser(username)
            val response = client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"$username","password":"password123"}""")
            }
            response.shouldHaveStatus(HttpStatusCode.OK)
            val body = response.bodyAsText()
            body shouldContain "accessToken"
            body shouldContain """"username":"$username""""
            body shouldContain """"role":"user""""
            response.headers["Set-Cookie"] shouldContain "refresh_token="
        }
    }

    // AC2 — wrong password returns 401 with same error as non-existent user
    test("AC2 wrong password and non-existent user return identical 401 error") {
        val username = randomUser()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            registerUser(username)

            val wrongPasswordBody = client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"$username","password":"wrongpassword"}""")
            }.also { it.shouldHaveStatus(HttpStatusCode.Unauthorized) }.bodyAsText()

            val nonExistentBody = client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"nonexistent_${UUID.randomUUID()}","password":"anything"}""")
            }.also { it.shouldHaveStatus(HttpStatusCode.Unauthorized) }.bodyAsText()

            wrongPasswordBody shouldBe nonExistentBody
        }
    }

    // AC3 — 6th login request from same IP returns 429
    test("AC3 rate limit blocks 6th login request") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            repeat(5) {
                client.post("/auth/login") {
                    contentType(ContentType.Application.Json)
                    setBody("""{"username":"admin","password":"wrong"}""")
                }
            }
            client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"admin","password":"wrong"}""")
            }.shouldHaveStatus(HttpStatusCode.TooManyRequests)
        }
    }

    // AC4 — POST /auth/refresh with valid cookie returns 200 with new accessToken
    test("AC4 valid refresh cookie returns new accessToken") {
        val username = randomUser()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            registerUser(username)
            val (_, refreshToken) = loginUser(username)
            refreshToken shouldNotBe ""

            val refreshResponse = client.post("/auth/refresh") {
                header(HttpHeaders.Cookie, "refresh_token=$refreshToken")
            }
            refreshResponse.shouldHaveStatus(HttpStatusCode.OK)
            refreshResponse.bodyAsText() shouldContain "accessToken"
        }
    }

    // AC5 — POST /auth/refresh with no cookie returns 401
    test("AC5 refresh with no cookie returns 401") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            client.post("/auth/refresh").shouldHaveStatus(HttpStatusCode.Unauthorized)
        }
    }

    // AC6 — logout deletes refresh token; subsequent refresh returns 401
    test("AC6 logout invalidates refresh token") {
        val username = randomUser()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            registerUser(username)
            val (_, refreshToken) = loginUser(username)

            client.post("/auth/logout") {
                header(HttpHeaders.Cookie, "refresh_token=$refreshToken")
            }.shouldHaveStatus(HttpStatusCode.OK)

            client.post("/auth/refresh") {
                header(HttpHeaders.Cookie, "refresh_token=$refreshToken")
            }.shouldHaveStatus(HttpStatusCode.Unauthorized)
        }
    }

    // AC7 — admin login does not add document to users collection
    test("AC7 admin login does not create a user document") {
        val username = randomUser()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            registerUser(username)
            client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"admin","password":"admin"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)
        }
        // Verify directly: no document with username "admin" exists in the users collection
        MongoClient.create("mongodb://test_user:test_pass@localhost:${container.firstMappedPort}").use { mongoClient ->
            val adminCount = mongoClient.getDatabase("test")
                .getCollection<Document>("users")
                .countDocuments(Filters.eq("username", "admin"))
            adminCount shouldBe 0L
        }
    }

    // AC8 — user-role JWT returns 403 on admin-only endpoint; admin JWT returns 200
    test("AC8 user role JWT returns 403 on admin-only endpoint") {
        val username = randomUser()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application {
                module()
                routing {
                    authenticate(authMethod) {
                        get("/test-admin-only") {
                            if (!call.requireAdmin()) {
                                call.respond(HttpStatusCode.Forbidden, ErrorResponse("Forbidden"))
                                return@get
                            }
                            call.respond(HttpStatusCode.OK)
                        }
                    }
                }
            }

            registerUser(username)
            val (userToken, _) = loginUser(username)

            client.get("/test-admin-only") {
                header(HttpHeaders.Authorization, "Bearer $userToken")
            }.shouldHaveStatus(HttpStatusCode.Forbidden)

            val (adminToken, _) = loginUser("admin", "admin")
            client.get("/test-admin-only") {
                header(HttpHeaders.Authorization, "Bearer $adminToken")
            }.shouldHaveStatus(HttpStatusCode.OK)
        }
    }

    // AC9 — authenticated GraphQL request succeeds (principal threading)
    test("AC9 authenticated GraphQL request returns data not auth error") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val (adminToken, _) = loginUser("admin", "admin")

            val response = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Authorization, "Bearer $adminToken")
                setBody("""{"query":"{ getItems { id } }"}""")
            }
            response.shouldHaveStatus(HttpStatusCode.OK)
            response.bodyAsText() shouldNotContain """"errors":[{"message":"401"""
        }
    }

    // AC10 — change-password with correct current password returns 200; old password no longer works
    test("AC10 change password succeeds and invalidates old credentials") {
        val username = randomUser()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            registerUser(username)
            val (accessToken, _) = loginUser(username)

            client.post("/auth/change-password") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                setBody("""{"currentPassword":"password123","newPassword":"newpass456"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)

            client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"$username","password":"password123"}""")
            }.shouldHaveStatus(HttpStatusCode.Unauthorized)

            client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"$username","password":"newpass456"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)
        }
    }

    // AC10 (token invalidation) — refresh with old cookie returns 401 after change-password
    test("AC10 change password invalidates existing refresh tokens") {
        val username = randomUser()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            registerUser(username)
            val (accessToken, refreshToken) = loginUser(username)

            client.post("/auth/change-password") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                setBody("""{"currentPassword":"password123","newPassword":"newpass456"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)

            client.post("/auth/refresh") {
                header(HttpHeaders.Cookie, "refresh_token=$refreshToken")
            }.shouldHaveStatus(HttpStatusCode.Unauthorized)
        }
    }

    // Admin must not be able to change password via this endpoint
    test("admin calling change-password returns 403") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val (adminToken, _) = loginUser("admin", "admin")

            client.post("/auth/change-password") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Authorization, "Bearer $adminToken")
                setBody("""{"currentPassword":"admin","newPassword":"newpass"}""")
            }.shouldHaveStatus(HttpStatusCode.Forbidden)
        }
    }

    // AC11 — change-password with wrong current password returns 400
    test("AC11 change password with wrong current password returns 400") {
        val username = randomUser()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            registerUser(username)
            val (accessToken, _) = loginUser(username)

            client.post("/auth/change-password") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                setBody("""{"currentPassword":"wrongpassword","newPassword":"irrelevant"}""")
            }.shouldHaveStatus(HttpStatusCode.BadRequest)
        }
    }
})
