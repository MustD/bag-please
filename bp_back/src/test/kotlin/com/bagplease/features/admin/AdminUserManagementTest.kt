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
import java.util.*

class AdminUserManagementTest : FunSpec({

    val container = mongoContainer()

    suspend fun ApplicationTestBuilder.loginAdmin(): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"admin","password":"admin"}""")
        }
        return jacksonObjectMapper().readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.loginRegularUser(username: String, password: String = "pass123"): String {
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

    test("AC1 users query returns registered users excluding admin") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val username = "user_ac1_${UUID.randomUUID().toString().take(8)}"
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"pass123\") { id username role } }"}""")
            }.shouldHaveStatus(HttpStatusCode.OK)

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ users { id username role } }"}""")
            }.bodyAsText()

            body shouldNotContain """"errors":"""
            body shouldContain """"username":"$username""""
            body shouldNotContain """"username":"admin""""
        }
    }

    test("AC2 createUser mutation creates user and subsequent users query includes them") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val username = "user_ac2_${UUID.randomUUID().toString().take(8)}"

            val createBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"initial123\") { id username role } }"}""")
            }.bodyAsText()

            createBody shouldNotContain """"errors":"""
            createBody shouldContain """"username":"$username""""
            createBody shouldContain """"role":"user""""

            val listBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ users { id username role } }"}""")
            }.bodyAsText()

            listBody shouldNotContain """"errors":"""
            listBody shouldContain """"username":"$username""""
        }
    }

    test("AC3 deleteUser removes user and subsequent query excludes them") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val username = "delete_ac3_${UUID.randomUUID().toString().take(8)}"

            val createBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"pass123\") { id username role } }"}""")
            }.bodyAsText()
            createBody shouldNotContain """"errors":"""
            val userId = jacksonObjectMapper().readTree(createBody)["data"]["createUser"]["id"].asText()

            val deleteBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { deleteUser(id: \"$userId\") { id username } }"}""")
            }.bodyAsText()
            deleteBody shouldNotContain """"errors":"""

            val listBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ users { id username } }"}""")
            }.bodyAsText()
            listBody shouldNotContain """"username":"$username""""
        }
    }

    test("AC4 resetUserPassword updates hash and new password works for login") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()
            val username = "reset_ac4_${UUID.randomUUID().toString().take(8)}"

            val createBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"oldpass\") { id username role } }"}""")
            }.bodyAsText()
            createBody shouldNotContain """"errors":"""
            val userId = jacksonObjectMapper().readTree(createBody)["data"]["createUser"]["id"].asText()

            val resetBody = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { resetUserPassword(id: \"$userId\", newPassword: \"newpass\") { id username } }"}""")
            }.bodyAsText()
            resetBody shouldNotContain """"errors":"""

            val oldPassRes = client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"$username","password":"oldpass"}""")
            }
            oldPassRes.shouldHaveStatus(HttpStatusCode.Unauthorized)

            val loginRes = client.post("/auth/login") {
                contentType(ContentType.Application.Json)
                setBody("""{"username":"$username","password":"newpass"}""")
            }
            loginRes.shouldHaveStatus(HttpStatusCode.OK)
            val loginBody = loginRes.bodyAsText()
            loginBody shouldContain "accessToken"
        }
    }

    test("AC5 non-admin JWT on users query returns FORBIDDEN") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val username = "nonAdmin_ac5_${UUID.randomUUID().toString().take(8)}"
            val userToken = loginRegularUser(username)

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userToken)
                setBody("""{"query":"{ users { id username role } }"}""")
            }.bodyAsText()
            body shouldContain """"code":"FORBIDDEN""""
        }
    }

    test("AC5 non-admin JWT on createUser mutation returns FORBIDDEN") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val username = "nonAdmin_ac5m_${UUID.randomUUID().toString().take(8)}"
            val userToken = loginRegularUser(username)

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userToken)
                setBody("""{"query":"mutation { createUser(username: \"newuser\", password: \"pass\") { id } }"}""")
            }.bodyAsText()
            body shouldContain """"code":"FORBIDDEN""""
        }
    }

    test("AC6 deleteUser with non-existent UUID returns NOT_FOUND") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { deleteUser(id: \"00000000-0000-0000-0000-000000000000\") { id } }"}""")
            }.bodyAsText()
            body shouldContain """"code":"NOT_FOUND""""
        }
    }
})
