package com.bagplease.features.feedback

import com.bagplease.module
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.appJdbcUrl
import com.bagplease.utils.postgresContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpPostgres
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
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

// Story 9.9 — sendFeedback(text). Story 9.10 adds the admin-only `feedback`
// query and `deleteFeedback` mutation. Modeled on
// features/admin/ApplicationConfigTest.kt: raw /graphql POSTs, no GraphQL
// client, `shouldContain`/`shouldNotContain` on the response body.
class FeedbackTest : FunSpec({

    val container = postgresContainer()
    // One PostgreSQL per JVM: start every test from empty tables so no test depends on declaration order.
    beforeTest { SharedPostgres.reset() }

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

    // Reads the `feedback` table directly, bypassing the GraphQL layer. Proves what was actually PERSISTED,
    // not just the mutation's boolean return.
    data class StoredFeedback(val id: String, val text: String, val username: String, val createdAt: java.sql.Timestamp?)

    fun jdbc(): java.sql.Connection = java.sql.DriverManager.getConnection(
        SharedPostgres.container.appJdbcUrl(), SharedPostgres.APP_USER, SharedPostgres.APP_PASSWORD,
    )

    fun feedbackRows(): List<StoredFeedback> = jdbc().use { c ->
        c.createStatement().use { st ->
            st.executeQuery("SELECT id, text, username, created_at FROM feedback").use { rs ->
                buildList {
                    while (rs.next()) add(StoredFeedback(rs.getString(1), rs.getString(2), rs.getString(3), rs.getTimestamp(4)))
                }
            }
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
    // test in this spec inserts a row: `container` is one PostgreSQL instance shared
    // by every `test()` block in this file (declared once above, not reset
    // between tests), so this is the only point at which the `feedback`
    // table is guaranteed empty. Kotest's default FunSpec order is
    // declaration order, which is why this is placed first.
    test("the feedback query returns an empty list when nothing has been submitted yet") {
        testApplication {
            setUpPostgres()
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
            setUpPostgres()
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
            val stored = feedbackRows()
            stored shouldHaveSize 1
            val row = stored.first()
            row.text shouldBe "Please add dark icons"
            row.username shouldBe "feedback_happy"
            row.createdAt.shouldNotBeNull()
        }
    }

    // Blank text (after trim) is rejected.
    test("blank feedback text is rejected") {
        testApplication {
            setUpPostgres()
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
            setUpPostgres()
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
            setUpPostgres()
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
            setUpPostgres()
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
            setUpPostgres()
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
            setUpPostgres()
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
            setUpPostgres()
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_query_forbidden")

            val body = feedbackQuery(userToken)
            body shouldContain """"code":"FORBIDDEN""""
        }
    }

    test("the admin deletes a feedback entry and it no longer appears") {
        testApplication {
            setUpPostgres()
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_delete_happy")
            val adminToken = loginAdmin()

            sendFeedback(userToken, "entry to delete")
            val stored = feedbackRows()
            val id = stored.first { it.text == "entry to delete" }.id

            val deleteBody = deleteFeedbackMutation(adminToken, id)
            deleteBody shouldNotContain """"errors":"""
            deleteBody shouldContain id

            val afterBody = feedbackQuery(adminToken)
            afterBody shouldNotContain "entry to delete"
        }
    }

    test("deleting a non-existent feedback id returns NOT_FOUND") {
        testApplication {
            setUpPostgres()
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            val body = deleteFeedbackMutation(adminToken, java.util.UUID.randomUUID().toString())
            body shouldContain """"code":"NOT_FOUND""""
        }
    }

    test("a non-admin caller cannot delete feedback") {
        testApplication {
            setUpPostgres()
            setUpJwt()
            application { module() }
            val userToken = loginRegularUser("feedback_delete_forbidden")

            sendFeedback(userToken, "not deletable by a regular user")
            val stored = feedbackRows()
            val id = stored.first { it.text == "not deletable by a regular user" }.id

            val body = deleteFeedbackMutation(userToken, id)
            body shouldContain """"code":"FORBIDDEN""""

            // Still present — the rejected delete did not go through.
            val afterBody = feedbackQuery(loginAdmin())
            afterBody shouldContain "not deletable by a regular user"
        }
    }

    test("deleting a user does not delete their feedback") {
        testApplication {
            setUpPostgres()
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

    test("deleting a feedback id that is not a UUID returns NOT_FOUND") {
        testApplication {
            setUpPostgres()
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            val body = deleteFeedbackMutation(adminToken, "abc")
            body shouldContain """"code":"NOT_FOUND""""
        }
    }

    test("entries with equal timestamps are listed newest-first with id as the tiebreak") {
        testApplication {
            setUpPostgres()
            setUpJwt()
            application { module() }
            val adminToken = loginAdmin()

            jdbc().use { c ->
                c.createStatement().use { st ->
                    st.execute("DELETE FROM feedback")
                    st.execute("INSERT INTO feedback VALUES ('00000000-0000-0000-0000-00000000000a', 'tie low', 'x', '2026-01-01T00:00:00Z')")
                    st.execute("INSERT INTO feedback VALUES ('00000000-0000-0000-0000-00000000000b', 'tie high', 'x', '2026-01-01T00:00:00Z')")
                    st.execute("INSERT INTO feedback VALUES ('00000000-0000-0000-0000-00000000000c', 'older', 'x', '2025-01-01T00:00:00Z')")
                    st.execute("INSERT INTO feedback VALUES ('00000000-0000-0000-0000-00000000000d', 'newest', 'x', '2027-01-01T00:00:00Z')")
                }
            }

            val texts = jacksonObjectMapper().readTree(feedbackQuery(adminToken))["data"]["feedback"].map { it["text"].asText() }
            texts shouldBe listOf("newest", "tie high", "tie low", "older")
        }
    }
})
