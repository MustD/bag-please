package com.bagplease

import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.core.spec.style.FunSpec
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
import java.util.*

private val mapper = jacksonObjectMapper()

class ListAuthorizationTest : FunSpec({

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

    suspend fun ApplicationTestBuilder.createList(token: String, name: String = "TestList"): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { createList(name: \"$name\") { id } }"}""")
        }
        val body = res.bodyAsText()
        body shouldNotContain "errors"
        return mapper.readTree(body)["data"]["createList"]["id"].asText()
    }

    test("AC13 non-member on items(listId) returns GQL error") {
        val userA = "authA_${UUID.randomUUID().toString().take(8)}"
        val userB = "authB_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val tokenA = createUserAndLogin(userA)
            val tokenB = createUserAndLogin(userB)
            val listIdA = createList(tokenA)

            // User B tries to access User A's list items
            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(tokenB)
                setBody("""{"query":"{ getItems(listId: \"$listIdA\") { id } }"}""")
            }
            res.bodyAsText() shouldContain "errors"
        }
    }

    test("AC13 non-member on categories(listId) returns GQL error") {
        val userA = "authC_${UUID.randomUUID().toString().take(8)}"
        val userB = "authD_${UUID.randomUUID().toString().take(8)}"
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val tokenA = createUserAndLogin(userA)
            val tokenB = createUserAndLogin(userB)
            val listIdA = createList(tokenA)

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(tokenB)
                setBody("""{"query":"{ getCategories(listId: \"$listIdA\") { id } }"}""")
            }
            res.bodyAsText() shouldContain "errors"
        }
    }

    test("cross-tenant isolation: user A cannot read user B's items via listId") {
        val userA = "isolA_${UUID.randomUUID().toString().take(8)}"
        val userB = "isolB_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()
        val itemId = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val tokenA = createUserAndLogin(userA)
            val tokenB = createUserAndLogin(userB)

            val listIdB = createList(tokenB)
            // User B creates an item
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(tokenB)
                setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"SecretItem\", checked: false, category: \"$catId\", listId: \"$listIdB\" }) { id } }"}""")
            }

            // User A tries to access User B's list
            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(tokenA)
                setBody("""{"query":"{ getItems(listId: \"$listIdB\") { id name } }"}""")
            }
            val body = res.bodyAsText()
            body shouldContain "errors"
            body shouldNotContain "SecretItem"
        }
    }

    test("AC12 verifyMembership is enforced before data access on saveItem") {
        val owner = "owner_v_${UUID.randomUUID().toString().take(8)}"
        val stranger = "stranger_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()
        val itemId = UUID.randomUUID()
        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = createUserAndLogin(owner)
            val strangerToken = createUserAndLogin(stranger)
            val listId = createList(ownerToken)

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(strangerToken)
                setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"HackedItem\", checked: false, category: \"$catId\", listId: \"$listId\" }) { id } }"}""")
            }
            val body = res.bodyAsText()
            body shouldContain "errors"
            body shouldNotContain "HackedItem"
        }
    }
})
