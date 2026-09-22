package com.bagplease.features.feedback

import com.bagplease.module
import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.mongodb.ConnectionString
import com.mongodb.MongoClientSettings
import com.mongodb.MongoCredential
import com.mongodb.kotlin.client.coroutine.MongoClient
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
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
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.testcontainers.mongodb.MongoDBContainer

// Story 9.9 — sendFeedback(text). Modeled on features/admin/ApplicationConfigTest.kt:
// raw /graphql POSTs, no GraphQL client, `shouldContain`/`shouldNotContain` on the
// response body. Only `sendFeedback` exists yet — the `feedback` query and
// `deleteFeedback` are Story 9.10.
class FeedbackTest : FunSpec({

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

    fun sendFeedbackQuery(text: String): String {
        // Escape embedded quotes/newlines so the fixture stays a single-line JSON
        // string body — the same raw-string-POST idiom ApplicationConfigTest uses.
        val escaped = text.replace("\\", "\\\\").replace("\"", "\\\"")
        return """{"query":"mutation { sendFeedback(text: \"$escaped\") }"}"""
    }

    // Reads the `feedback` collection directly, bypassing the GraphQL layer — the
    // same raw-MongoClient idiom `utils/TestContainers.kt`'s `setUpRegistration`
    // uses. Proves what was actually PERSISTED, not just the mutation's boolean
    // return.
    suspend fun feedbackDocuments(container: MongoDBContainer): List<Document> {
        val credential = MongoCredential.createScramSha1Credential("test_user", "admin", "test_pass".toCharArray())
        val settings = MongoClientSettings.builder()
            .credential(credential)
            .applyConnectionString(ConnectionString("mongodb://localhost:${container.firstMappedPort}/test"))
            .build()
        val client = MongoClient.create(settings)
        try {
            return client.getDatabase("test").getCollection<Document>("feedback").find().toList()
        } finally {
            client.close()
        }
    }

    // Happy path: regular user, text trimmed server-side.
    test("a regular user's feedback is accepted and trimmed") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_happy")

            val response = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userToken)
                setBody(sendFeedbackQuery("  Please add dark icons  "))
            }
            response.shouldHaveStatus(HttpStatusCode.OK)
            val body = response.bodyAsText()
            body shouldNotContain """"errors":"""
            body shouldContain """"sendFeedback":true"""

            // What was actually PERSISTED, not just the mutation's boolean return.
            val stored = feedbackDocuments(container)
            stored shouldHaveSize 1
            val doc = stored.first()
            doc.getString("text") shouldBe "Please add dark icons"
            doc.getString("username") shouldBe "feedback_happy"
            doc["createdAt"].shouldNotBeNull()
        }
    }

    // Blank text (after trim) is rejected.
    test("blank feedback text is rejected") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_blank")

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userToken)
                setBody(sendFeedbackQuery("   "))
            }.bodyAsText()
            body shouldContain """"errors":"""
            body shouldContain """"code":"BAD_USER_INPUT""""
        }
    }

    // Over-length text (post-trim, > 2000 UTF-16 chars) is rejected.
    test("feedback text over 2000 characters is rejected") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_toolong")

            val tooLong = "a".repeat(2001)
            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userToken)
                setBody(sendFeedbackQuery(tooLong))
            }.bodyAsText()
            body shouldContain """"errors":"""
            body shouldContain """"code":"BAD_USER_INPUT""""
        }
    }

    // Exactly 2000 characters (post-trim) is accepted.
    test("feedback text of exactly 2000 characters is accepted") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_exact")

            val exact = "b".repeat(2000)
            val response = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(userToken)
                setBody(sendFeedbackQuery(exact))
            }
            response.shouldHaveStatus(HttpStatusCode.OK)
            val body = response.bodyAsText()
            body shouldNotContain """"errors":"""
            body shouldContain """"sendFeedback":true"""
        }
    }

    // The admin caller is rejected exactly like every other admin-blocked mutation.
    test("the admin account cannot send feedback") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            val body = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody(sendFeedbackQuery("Please add dark icons"))
            }.bodyAsText()
            body shouldContain """"code":"FORBIDDEN""""
        }
    }

    // No JWT on /graphql returns HTTP 401, same as every other GraphQL mutation.
    test("unauthenticated sendFeedback returns HTTP 401") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }

            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                setBody(sendFeedbackQuery("Please add dark icons"))
            }.shouldHaveStatus(HttpStatusCode.Unauthorized)
        }
    }
})
