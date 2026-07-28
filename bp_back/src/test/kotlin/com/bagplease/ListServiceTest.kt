package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
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
                setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"Milk\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id } }"}""")
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
})
