package com.bagplease

import com.bagplease.entity.list.ListAuthError
import com.bagplease.features.auth.CallerUsername
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.appJdbcUrl
import com.bagplease.utils.buildTestServices
import com.bagplease.utils.mongoContainer
import com.bagplease.utils.pgCount
import com.bagplease.utils.pgRows
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.mongodb.ConnectionString
import com.mongodb.MongoClientSettings
import com.mongodb.MongoCredential
import com.mongodb.kotlin.client.coroutine.MongoClient
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.bson.UuidRepresentation
import java.sql.DriverManager

private val mapper = jacksonObjectMapper()

// Story 11.4: lists, shares and invites live in PostgreSQL. Matrix rows that the GraphQL-level specs do not pin.
class ListPostgresTest : FunSpec({

    val container = mongoContainer()

    // The container is shared across specs and tests: every test counts rows, so each starts from empty tables.
    beforeTest { SharedPostgres.reset() }

    suspend fun ApplicationTestBuilder.login(username: String, password: String): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }
        return mapper.readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.gql(token: String, query: String): String =
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody(mapper.writeValueAsString(mapOf("query" to query)))
        }.bodyAsText()

    suspend fun ApplicationTestBuilder.users(vararg names: String): List<String> {
        val admin = login("admin", "admin")
        names.forEach { gql(admin, """mutation { createUser(username: "$it", password: "pass1234") { id } }""") }
        return names.map { login(it, "pass1234") }
    }

    fun sql(statement: String) = DriverManager.getConnection(
        SharedPostgres.container.appJdbcUrl(), SharedPostgres.APP_USER, SharedPostgres.APP_PASSWORD,
    ).use { c -> c.createStatement().use { it.execute(statement) } }

    test("createList writes the list row and the owner's ACCEPTED row; members stays empty") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val (owner) = users("pgOwner")
            val body = gql(owner, """mutation { createList(name: "L") { id members { username } } }""")
            body shouldNotContain "errors"
            val id = mapper.readTree(body)["data"]["createList"]["id"].asText()
            mapper.readTree(body)["data"]["createList"]["members"].size() shouldBe 0
            pgRows("SELECT u.username, m.status FROM list_members m JOIN users u ON u.id = m.user_id WHERE m.list_id = '$id'") shouldBe
                listOf(listOf("pgOwner", "ACCEPTED"))
        }
    }

    test("createList is atomic: a failing owner-row insert leaves no list row") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val (owner) = users("pgAtomic")
            sql(
                """CREATE FUNCTION fail_member_insert() RETURNS trigger LANGUAGE plpgsql AS
                   ${'$'}${'$'} BEGIN RAISE EXCEPTION 'injected failure'; END ${'$'}${'$'}"""
            )
            sql("CREATE TRIGGER fail_member_insert BEFORE INSERT ON list_members FOR EACH ROW EXECUTE FUNCTION fail_member_insert()")
            try {
                gql(owner, """mutation { createList(name: "Doomed") { id } }""") shouldContain "errors"
            } finally {
                sql("DROP TRIGGER fail_member_insert ON list_members")
                sql("DROP FUNCTION fail_member_insert()")
            }
            pgCount("SELECT count(*) FROM lists") shouldBe 0L
            pgCount("SELECT count(*) FROM list_members") shouldBe 0L
        }
    }

    test("re-inviting a DECLINED user turns the row back into PENDING with a fresh created_at") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val (owner, guest) = users("pgInviter", "pgGuest")
            val id = mapper.readTree(gql(owner, """mutation { createList(name: "L") { id } }"""))["data"]["createList"]["id"].asText()
            fun row() = pgRows("SELECT status, created_at FROM list_members WHERE list_id = '$id' AND user_id = (SELECT id FROM users WHERE username = 'pgGuest')").single()

            gql(owner, """mutation { shareList(listId: "$id", username: "pgGuest") { id } }""") shouldNotContain "errors"
            val first = row()
            gql(guest, """mutation { rejectInvite(listId: "$id") }""") shouldNotContain "errors"
            row()[0] shouldBe "DECLINED"
            // DECLINED is never shown.
            gql(owner, """{ lists { lists { members { username } } } }""") shouldNotContain "pgGuest"

            Thread.sleep(20)
            val again = gql(owner, """mutation { shareList(listId: "$id", username: "pgGuest") { members { username status } } }""")
            again shouldContain """"status":"PENDING""""
            val second = row()
            second[0] shouldBe "PENDING"
            (second[1] != first[1]) shouldBe true
            pgCount("SELECT count(*) FROM list_members WHERE list_id = '$id'") shouldBe 2L
        }
    }

    test("the admin is rejected by every list operation and never gets a row") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val admin = login("admin", "admin")
            gql(admin, """mutation { createList(name: "A") { id } }""") shouldContain "errors"
            gql(admin, """{ lists { lists { id } } }""") shouldContain "errors"
            pgCount("SELECT count(*) FROM lists") shouldBe 0L
            pgCount("SELECT count(*) FROM list_members") shouldBe 0L
            pgCount("SELECT count(*) FROM users WHERE username = 'admin'") shouldBe 0L
        }
    }

    test("a users row cannot be deleted while a list or membership still references it") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val (owner, guest) = users("pgRestrictOwner", "pgRestrictGuest")
            val id = mapper.readTree(gql(owner, """mutation { createList(name: "L") { id } }"""))["data"]["createList"]["id"].asText()
            gql(owner, """mutation { shareList(listId: "$id", username: "pgRestrictGuest") { id } }""") shouldNotContain "errors"
            gql(guest, """mutation { acceptInvite(listId: "$id") { id } }""") shouldNotContain "errors"

            shouldThrow<Exception> { sql("DELETE FROM users WHERE username = 'pgRestrictOwner'") }
            shouldThrow<Exception> { sql("DELETE FROM users WHERE username = 'pgRestrictGuest'") }
            pgCount("SELECT count(*) FROM users WHERE username LIKE 'pgRestrict%'") shouldBe 2L
        }
    }

    test("isMember turns false the moment a member leaves or is removed") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val (owner, a, b) = users("pgMemOwner", "pgMemA", "pgMemB")
            val id = mapper.readTree(gql(owner, """mutation { createList(name: "L") { id } }"""))["data"]["createList"]["id"].asText()
            for ((name, token) in listOf("pgMemA" to a, "pgMemB" to b)) {
                gql(owner, """mutation { shareList(listId: "$id", username: "$name") { id } }""") shouldNotContain "errors"
                gql(token, """mutation { acceptInvite(listId: "$id") { id } }""") shouldNotContain "errors"
            }
            val credential = MongoCredential.createScramSha1Credential("test_user", "admin", "test_pass".toCharArray())
            val db = MongoClient.create(
                MongoClientSettings.builder().credential(credential).uuidRepresentation(UuidRepresentation.STANDARD)
                    .applyConnectionString(ConnectionString("mongodb://localhost:${container.firstMappedPort}/test")).build()
            ).getDatabase("test")
            val service = buildTestServices(db).listService
            val listId = java.util.UUID.fromString(id)

            service.isMember(CallerUsername("pgMemA"), listId) shouldBe true
            service.isMember(CallerUsername("pgMemOwner"), listId) shouldBe true
            service.isMember(CallerUsername("admin"), listId) shouldBe false
            gql(a, """mutation { leaveList(listId: "$id") }""") shouldNotContain "errors"
            gql(owner, """mutation { removeMember(listId: "$id", username: "pgMemB") { id } }""") shouldNotContain "errors"
            service.isMember(CallerUsername("pgMemA"), listId) shouldBe false
            service.isMember(CallerUsername("pgMemB"), listId) shouldBe false
            service.verifyMembership(CallerUsername("pgMemA"), listId).leftOrNull() shouldBe ListAuthError.NotMember
        }
    }
})
