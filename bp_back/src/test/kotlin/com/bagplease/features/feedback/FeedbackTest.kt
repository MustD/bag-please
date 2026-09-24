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
import io.kotest.matchers.shouldNotBe
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

// Story 9.9 — sendFeedback(text). Story 9.10 adds the admin-only `feedback`
// query and `deleteFeedback` mutation. Modeled on
// features/admin/ApplicationConfigTest.kt: raw /graphql POSTs, no GraphQL
// client, `shouldContain`/`shouldNotContain` on the response body.
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

    suspend fun ApplicationTestBuilder.sendFeedback(token: String, text: String) {
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody(sendFeedbackQuery(text))
        }.shouldHaveStatus(HttpStatusCode.OK)
    }

    suspend fun ApplicationTestBuilder.feedbackQuery(token: String): String =
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"{ feedback { id text username createdAt } }"}""")
        }.bodyAsText()

    suspend fun ApplicationTestBuilder.deleteFeedbackMutation(token: String, id: String): String =
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { deleteFeedback(id: \"$id\") }"}""")
        }.bodyAsText()

    // Story 9.10 I/O matrix row "No feedback yet". MUST run before any other
    // test in this spec inserts a row: `container` is one Mongo instance shared
    // by every `test()` block in this file (declared once above, not reset
    // between tests), so this is the only point at which the `feedback`
    // collection is guaranteed empty. Kotest's default FunSpec order is
    // declaration order, which is why this is placed first.
    test("the feedback query returns an empty list when nothing has been submitted yet") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            val body = feedbackQuery(adminToken)
            body shouldNotContain """"errors":"""
            body shouldContain """"feedback":[]"""
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

    // ─────────────────────────────────────────────────────────────────────────
    // Story 9.10 — admin review (`feedback` query) and clearing (`deleteFeedback`).
    // Helpers (`sendFeedback`, `feedbackQuery`, `deleteFeedbackMutation`) are
    // declared above, before the empty-list test, so that test can use them too.
    // ─────────────────────────────────────────────────────────────────────────

    test("the admin lists feedback newest-first") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_list_order")
            val adminToken = loginAdmin()

            sendFeedback(userToken, "first entry")
            sendFeedback(userToken, "second entry")
            sendFeedback(userToken, "third entry")

            val body = feedbackQuery(adminToken)
            body shouldNotContain """"errors":"""
            // Newest-first: "third entry" must appear before "first entry" in the
            // raw JSON body.
            val thirdIndex = body.indexOf("third entry")
            val firstIndex = body.indexOf("first entry")
            thirdIndex shouldNotBe -1
            firstIndex shouldNotBe -1
            (thirdIndex < firstIndex) shouldBe true
        }
    }

    test("a non-admin caller cannot query feedback") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_query_forbidden")

            val body = feedbackQuery(userToken)
            body shouldContain """"code":"FORBIDDEN""""
        }
    }

    test("the admin deletes a feedback entry and it no longer appears") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_delete_happy")
            val adminToken = loginAdmin()

            sendFeedback(userToken, "entry to delete")
            val stored = feedbackDocuments(container)
            val id = stored.first { it.getString("text") == "entry to delete" }.getString("_id")

            val deleteBody = deleteFeedbackMutation(adminToken, id)
            deleteBody shouldNotContain """"errors":"""
            deleteBody shouldContain id

            val afterBody = feedbackQuery(adminToken)
            afterBody shouldNotContain "entry to delete"
        }
    }

    test("deleting a non-existent feedback id returns NOT_FOUND") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            val body = deleteFeedbackMutation(adminToken, java.util.UUID.randomUUID().toString())
            body shouldContain """"code":"NOT_FOUND""""
        }
    }

    test("a non-admin caller cannot delete feedback") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_delete_forbidden")

            sendFeedback(userToken, "not deletable by a regular user")
            val stored = feedbackDocuments(container)
            val id = stored.first { it.getString("text") == "not deletable by a regular user" }.getString("_id")

            val body = deleteFeedbackMutation(userToken, id)
            body shouldContain """"code":"FORBIDDEN""""

            // Still present — the rejected delete did not go through.
            val afterBody = feedbackQuery(loginAdmin())
            afterBody shouldContain "not deletable by a regular user"
        }
    }

    test("deleting a user does not delete their feedback") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_survives_user_delete")
            val adminToken = loginAdmin()

            sendFeedback(userToken, "feedback that outlives its author")

            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody(
                    """{"query":"{ users(limit: 100) { users { id username } } }"}"""
                )
            }.bodyAsText().let { usersBody ->
                val userId = jacksonObjectMapper().readTree(usersBody)["data"]["users"]["users"]
                    .first { it["username"].asText() == "feedback_survives_user_delete" }["id"].asText()
                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(adminToken)
                    setBody("""{"query":"mutation { deleteUser(id: \"$userId\") { id } }"}""")
                }.shouldHaveStatus(HttpStatusCode.OK)
            }

            val afterBody = feedbackQuery(adminToken)
            afterBody shouldContain "feedback that outlives its author"
        }
    }
})
