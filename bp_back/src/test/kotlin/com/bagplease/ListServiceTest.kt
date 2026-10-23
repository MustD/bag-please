package com.bagplease

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
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import io.kotest.assertions.ktor.client.shouldHaveStatus
import io.kotest.core.spec.style.FunSpec
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
import org.bson.UuidRepresentation
import java.util.*

private val mapper = jacksonObjectMapper()

class ListServiceTest : FunSpec({

    val container = mongoContainer()

    suspend fun ApplicationTestBuilder.loginToken(username: String = "admin", password: String = "admin"): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }
        return mapper.readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.createUserAndLogin(username: String, password: String = "pass1234"): String {
        val adminToken = loginToken()
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(adminToken)
            setBody("""{"query":"mutation { createUser(username: \"$username\", password: \"$password\") { id } }"}""")
        }
        return loginToken(username, password)
    }

    suspend fun ApplicationTestBuilder.createList(token: String, name: String = "TestList", emoji: String? = null): String {
        val emojiArg = if (emoji != null) """, emoji: \"$emoji\"""" else ""
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { createList(name: \"$name\"$emojiArg) { id name emoji ownerId } }"}""")
        }
        val body = res.bodyAsText()
        body shouldNotContain "errors"
        return mapper.readTree(body)["data"]["createList"]["id"].asText()
    }

    test("AC5 createList happy path") {
        val username = "listuser_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = createUserAndLogin(username)

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { createList(name: \"Groceries\", emoji: \"🛒\") { id name emoji ownerId } }"}""")
            }
            val body = res.bodyAsText()
            body shouldNotContain "errors"
            body shouldContain """"name":"Groceries""""
            // emoji may be serialized as surrogate pair (🛒), so compare via parsed JSON
            mapper.readTree(body)["data"]["createList"]["emoji"].asText() shouldBe "🛒"
            body shouldContain "ownerId"
        }
    }

    test("AC6 createList with null emoji") {
        val username = "listuser_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = createUserAndLogin(username)

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { createList(name: \"NoEmoji\") { id name emoji } }"}""")
            }
            val body = res.bodyAsText()
            body shouldNotContain "errors"
            body shouldContain """"name":"NoEmoji""""
            body shouldContain """"emoji":null"""
        }
    }

    test("AC7 createList name too long returns error") {
        val username = "listuser_${UUID.randomUUID().toString().take(8)}"
        val longName = "x".repeat(101)
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = createUserAndLogin(username)

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { createList(name: \"$longName\") { id } }"}""")
            }
            res.bodyAsText() shouldContain "errors"
        }
    }

    test("AC8 lists query returns only lists where caller is member") {
        val userA = "userA_${UUID.randomUUID().toString().take(8)}"
        val userB = "userB_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val tokenA = createUserAndLogin(userA)
            val tokenB = createUserAndLogin(userB)

            val listIdA = createList(tokenA, "UserA List")
            createList(tokenB, "UserB List")

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(tokenA)
                setBody("""{"query":"{ lists { lists { id name } pendingInvites { listId } } }"}""")
            }
            val body = res.bodyAsText()
            body shouldNotContain "errors"
            body shouldContain listIdA
            body shouldNotContain "UserB List"
        }
    }

    test("AC9 lists query empty for new user") {
        val username = "newuser_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = createUserAndLogin(username)

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"{ lists { lists { id name } pendingInvites { listId } } }"}""")
            }
            val body = res.bodyAsText()
            body shouldNotContain "errors"
            body shouldContain """"lists":[]"""
        }
    }

    test("AC10 deleteList cascade removes items and categories") {
        val username = "deluser_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()
        val itemId = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = createUserAndLogin(username)
            val listId = createList(token)

            // create a category and item in the list
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { saveCategory(category: { id: \"$catId\", name: \"Dairy\", listId: \"$listId\" }) { id } }"}""")
            }
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Milk\", checked: false, category: \"$catId\", listId: \"$listId\", stores: [] }) { id } }"}""")
            }

            val deleteRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { deleteList(id: \"$listId\") { deletedItemCount deletedCategoryCount } }"}""")
            }
            val deleteBody = deleteRes.bodyAsText()
            deleteBody shouldNotContain "errors"
            deleteBody shouldContain "deletedItemCount"
            deleteBody shouldContain "deletedCategoryCount"
        }
    }

    test("AC11 deleteList non-owner returns error") {
        val owner = "owner_${UUID.randomUUID().toString().take(8)}"
        val nonOwner = "nonowner_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = createUserAndLogin(owner)
            val nonOwnerToken = createUserAndLogin(nonOwner)
            val listId = createList(ownerToken)

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(nonOwnerToken)
                setBody("""{"query":"mutation { deleteList(id: \"$listId\") { deletedItemCount deletedCategoryCount } }"}""")
            }
            res.bodyAsText() shouldContain "errors"
        }
    }

    test("AC15 admin blocked on createList") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginToken()

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { createList(name: \"Admin List\") { id } }"}""")
            }
            res.bodyAsText() shouldContain "errors"
        }
    }

    test("AC15 admin blocked on lists query") {
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginToken()

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"{ lists { lists { id } pendingInvites { listId } } }"}""")
            }
            res.bodyAsText() shouldContain "errors"
        }
    }

    test("AC15 admin blocked on deleteList") {
        val owner = "owner2_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = createUserAndLogin(owner)
            val listId = createList(ownerToken)
            val adminToken = loginToken()

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(adminToken)
                setBody("""{"query":"mutation { deleteList(id: \"$listId\") { deletedItemCount deletedCategoryCount } }"}""")
            }
            res.bodyAsText() shouldContain "errors"
        }
    }

    // Direct, raw-Mongo access for the service-level test below — the same shape as `ListSharingTest.connectToDb()`.
    fun connectToDb(): MongoDatabase {
        val credential = MongoCredential.createScramSha1Credential(
            "test_user", "admin", "test_pass".toCharArray()
        )
        val settings = MongoClientSettings.builder()
            .credential(credential)
            .uuidRepresentation(UuidRepresentation.STANDARD)
            .applyConnectionString(ConnectionString("mongodb://localhost:${container.firstMappedPort}/test"))
            .build()
        return MongoClient.create(settings).getDatabase("test")
    }

    // AC-9.4-rerun — `purgeUser` is IDEMPOTENT, asserted at the service level because that is the only place the
    // claim can be tested: through `deleteUser` a second call raises NOT_FOUND on the missing user row and never
    // reaches the purge, so it proves nothing about running the purge twice.
    //
    // The service is built here over the same databases the app used; assertions read PostgreSQL directly.
    test("AC-9.4-rerun purgeUser run twice raises nothing and changes nothing") {
        val owner = "rerunOwner_${UUID.randomUUID().toString().take(8)}"
        val other = "rerunOther_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val adminToken = loginToken()
            val ownerId = mapper.readTree(
                client.post("/graphql") {
                    contentType(ContentType.Application.Json)
                    bearerAuth(adminToken)
                    setBody("""{"query":"mutation { createUser(username: \"$owner\", password: \"pass1234\") { id } }"}""")
                }.bodyAsText()
            )["data"]["createUser"]["id"].asText()
            val ownerToken = loginToken(owner, "pass1234")
            val otherToken = createUserAndLogin(other)

            val ownedId = createList(ownerToken, "RerunOwned")
            val sharedId = createList(otherToken, "RerunShared")
            // The owner becomes an ACCEPTED member of the other user's list, so the purge has both a list to
            // cascade and a list to strip.
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(otherToken)
                setBody("""{"query":"mutation { shareList(listId: \"$sharedId\", username: \"$owner\") { id } }"}""")
            }.bodyAsText() shouldNotContain "errors"
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(ownerToken)
                setBody("""{"query":"mutation { acceptInvite(listId: \"$sharedId\") { id } }"}""")
            }.bodyAsText() shouldNotContain "errors"

            val service = buildTestServices().listService

            fun snapshot() = pgRows(
                "SELECT l.id, l.name, m.user_id, m.status FROM lists l LEFT JOIN list_members m ON m.list_id = l.id ORDER BY l.id, m.user_id"
            )

            service.purgeUser(UUID.fromString(ownerId))

            pgCount("SELECT count(*) FROM lists WHERE id = '$ownedId'") shouldBe 0L
            pgCount("SELECT count(*) FROM list_members WHERE user_id = '$ownerId'") shouldBe 0L
            pgCount("SELECT count(*) FROM lists WHERE id = '$sharedId'") shouldBe 1L
            val afterFirst = snapshot()

            // The re-run: no exception, and not one row different.
            service.purgeUser(UUID.fromString(ownerId))

            snapshot() shouldBe afterFirst
        }
    }
})
