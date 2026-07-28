package com.bagplease

import com.bagplease.entity.category.CategoryStorage
import com.bagplease.entity.category.mongo.CategoryRepository
import com.bagplease.entity.item.ItemService
import com.bagplease.entity.item.ItemStorage
import com.bagplease.entity.item.Recurring
import com.bagplease.entity.item.mongo.ItemRepository
import com.bagplease.entity.list.ListService
import com.bagplease.entity.list.ListStorage
import com.bagplease.entity.list.mongo.ListMemberRepository
import com.bagplease.entity.list.mongo.ListRepository
import com.bagplease.entity.user.mongo.UserRepository
import com.bagplease.utils.mongoContainer
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.mongodb.ConnectionString
import com.mongodb.MongoClientSettings
import com.mongodb.MongoCredential
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoClient
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import java.util.Date
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.nulls.shouldNotBeNull
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
import kotlinx.coroutines.flow.toList
import org.bson.Document
import org.bson.UuidRepresentation
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

private val mapper = jacksonObjectMapper()

class ItemLifecycleTest : FunSpec({

    val container = mongoContainer()

    // ── GQL API helpers ────────────────────────────────────────────────────

    suspend fun ApplicationTestBuilder.loginToken(username: String = "admin", password: String = "admin"): String {
        val res = client.post("/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"$username","password":"$password"}""")
        }
        return mapper.readTree(res.bodyAsText())["accessToken"].asText()
    }

    suspend fun ApplicationTestBuilder.registerAndLogin(username: String, password: String = "pass1234"): String {
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
        return mapper.readTree(res.bodyAsText())["data"]["createList"]["id"].asText()
    }

    suspend fun ApplicationTestBuilder.saveItem(
        token: String,
        itemId: UUID,
        catId: UUID,
        listId: String,
        name: String = "Item",
        store: String? = null,
        recurring: String? = null,
    ): String {
        val storeArg = if (store != null) """, store: \"$store\"""" else ""
        val recurringArg = if (recurring != null) """, recurring: \"$recurring\"""" else ""
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"$name\", checked: false, category: \"$catId\", listId: \"$listId\"$storeArg$recurringArg }) { id name checked category listId store recurring addedBy deleted } }"}""")
        }
        return res.bodyAsText()
    }

    suspend fun ApplicationTestBuilder.getItems(token: String, listId: String): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"{ getItems(listId: \"$listId\") { id name checked recurring deleted addedBy store } }"}""")
        }
        return res.bodyAsText()
    }

    // ── Direct MongoDB connection (for scheduler seeding) ──────────────────

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

    fun buildItemService(db: MongoDatabase): ItemService {
        val itemRepository = ItemRepository(db)
        val categoryRepository = CategoryRepository(db)
        val listRepository = ListRepository(db)
        val listMemberRepository = ListMemberRepository(db)
        val itemStorage = ItemStorage(itemRepository)
        val categoryStorage = CategoryStorage(categoryRepository)
        val listStorage = ListStorage(listRepository)
        val userRepository = UserRepository(db)
        val listService = ListService(
            listStorage = listStorage,
            listRepository = listRepository,
            userRepository = userRepository,
            itemRepository = itemRepository,
            categoryRepository = categoryRepository,
            itemStorage = itemStorage,
            categoryStorage = categoryStorage,
            adminLogin = "admin",
            listMemberRepository = listMemberRepository,
        )
        return ItemService(itemStorage, listService, itemRepository)
    }

    // ── AC1 / AC2 / AC3 ── field round-trips ──────────────────────────────

    test("AC1 addedBy is set from principal, not from input") {
        val username = "user_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)

            val body = saveItem(token, itemId, catId, listId)
            body shouldNotContain "errors"
            body shouldContain """"addedBy":"$username""""
        }
    }

    test("AC2 store round-trip") {
        val username = "user_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)

            saveItem(token, itemId, catId, listId, store = "Pharmacy")
            val body = getItems(token, listId)
            body shouldNotContain "errors"
            body shouldContain """"store":"Pharmacy""""
        }
    }

    test("AC3 recurring round-trip for all enum values") {
        val username = "user_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)

            for (value in listOf("WEEKLY", "BIWEEKLY", "MONTHLY", "ONE_TIME")) {
                val itemId = UUID.randomUUID()
                val saveBody = saveItem(token, itemId, catId, listId, recurring = value)
                saveBody shouldNotContain "errors"
                saveBody shouldContain """"recurring":"$value""""
            }

            val nullItemId = UUID.randomUUID()
            val nullBody = saveItem(token, nullItemId, catId, listId)
            nullBody shouldNotContain "errors"
            nullBody shouldContain """"recurring":null"""
        }
    }

    // ── AC4 ── regular item check-off ─────────────────────────────────────

    test("AC4 checkItem on regular item sets checked=true, item stays in list") {
        val username = "user_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)

            saveItem(token, itemId, catId, listId)

            val checkRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { checkItem(id: \"$itemId\", listId: \"$listId\") { id checked deleted } }"}""")
            }.bodyAsText()
            checkRes shouldNotContain "errors"
            checkRes shouldContain """"checked":true"""
            checkRes shouldContain """"deleted":false"""

            val listBody = getItems(token, listId)
            listBody shouldContain itemId.toString()
        }
    }

    // ── AC5 ── recurring item check-off ───────────────────────────────────

    test("AC5 checkItem on recurring WEEKLY item sets checked+checkedAt, item stays visible") {
        val username = "user_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)

            saveItem(token, itemId, catId, listId, recurring = "WEEKLY")

            val checkRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { checkItem(id: \"$itemId\", listId: \"$listId\") { id checked deleted checkedAt } }"}""")
            }.bodyAsText()
            checkRes shouldNotContain "errors"
            checkRes shouldContain """"checked":true"""
            checkRes shouldContain """"deleted":false"""
            checkRes shouldNotContain """"checkedAt":null"""

            val listBody = getItems(token, listId)
            listBody shouldContain itemId.toString()
        }
    }

    // ── AC6 ── one-timer check-off soft-delete ────────────────────────────

    test("AC6 checkItem on ONE_TIME item soft-deletes it and removes from getItems") {
        val username = "user_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)

            saveItem(token, itemId, catId, listId, recurring = "ONE_TIME")

            val checkRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { checkItem(id: \"$itemId\", listId: \"$listId\") { id checked deleted } }"}""")
            }.bodyAsText()
            checkRes shouldNotContain "errors"
            checkRes shouldContain """"deleted":true"""
            checkRes shouldContain """"checked":true"""

            val listBody = getItems(token, listId)
            listBody shouldNotContain(itemId.toString())
        }
    }

    // ── AC7 ── undo on soft-deleted one-timer ─────────────────────────────

    test("AC7 uncheckItem on soft-deleted ONE_TIME restores it to getItems") {
        val username = "user_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)

            saveItem(token, itemId, catId, listId, recurring = "ONE_TIME")
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { checkItem(id: \"$itemId\", listId: \"$listId\") { id } }"}""")
            }

            val uncheckRes = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { uncheckItem(id: \"$itemId\", listId: \"$listId\") { id checked deleted deletedAt } }"}""")
            }.bodyAsText()
            uncheckRes shouldNotContain "errors"
            uncheckRes shouldContain """"deleted":false"""
            uncheckRes shouldContain """"checked":false"""
            uncheckRes shouldContain """"deletedAt":null"""

            val listBody = getItems(token, listId)
            listBody shouldContain itemId.toString()
        }
    }

    // ── AC8 ── soft-deleted items invisible ───────────────────────────────

    test("AC8 soft-deleted items never appear in getItems") {
        val username = "user_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)

            saveItem(token, itemId, catId, listId, recurring = "ONE_TIME")
            client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"mutation { checkItem(id: \"$itemId\", listId: \"$listId\") { id } }"}""")
            }

            val body = getItems(token, listId)
            body shouldNotContain(itemId.toString())
        }
    }

    // ── AC9 ── recurring restore scheduler ────────────────────────────────

    test("AC9 scheduler restores WEEKLY item after 8 days") {
        val db = connectToDb()
        val itemService = buildItemService(db)

        val itemId = UUID.randomUUID()
        val listId = UUID.randomUUID()
        val eightDaysAgo = Instant.now().minus(8, ChronoUnit.DAYS)

        db.getCollection<Document>("items").insertOne(
            Document(mapOf(
                "_id" to itemId.toString(),
                "name" to "RecurringItem",
                "checked" to true,
                "category" to UUID.randomUUID().toString(),
                "listId" to listId.toString(),
                "recurring" to "WEEKLY",
                "checkedAt" to Date.from(eightDaysAgo),
            ))
        )

        itemService.runSchedulerCycle()

        val items = db.getCollection<Document>("items")
            .find(Filters.eq("_id", itemId.toString()))
            .toList()
        items.size shouldBe 1
        items[0].getBoolean("checked") shouldBe false
        items[0]["checkedAt"] shouldBe null
    }

    test("AC9 scheduler does not double-restore on second run") {
        val db = connectToDb()
        val itemService = buildItemService(db)

        val itemId = UUID.randomUUID()
        val listId = UUID.randomUUID()
        val eightDaysAgo = Instant.now().minus(8, ChronoUnit.DAYS)

        db.getCollection<Document>("items").insertOne(
            Document(mapOf(
                "_id" to itemId.toString(),
                "name" to "RecurringNoDouble",
                "checked" to true,
                "category" to UUID.randomUUID().toString(),
                "listId" to listId.toString(),
                "recurring" to "WEEKLY",
                "checkedAt" to Date.from(eightDaysAgo),
            ))
        )

        itemService.runSchedulerCycle()
        itemService.runSchedulerCycle()

        val items = db.getCollection<Document>("items")
            .find(Filters.eq("_id", itemId.toString()))
            .toList()
        items.size shouldBe 1
        items[0].getBoolean("checked") shouldBe false
    }

    // ── AC10 ── hard-delete scheduler ─────────────────────────────────────

    test("AC10 scheduler hard-deletes soft-deleted ONE_TIME items older than 1 hour") {
        val db = connectToDb()
        val itemService = buildItemService(db)

        val itemId = UUID.randomUUID()
        val listId = UUID.randomUUID()
        val twoHoursAgo = Instant.now().minus(2, ChronoUnit.HOURS)

        db.getCollection<Document>("items").insertOne(
            Document(mapOf(
                "_id" to itemId.toString(),
                "name" to "OneTimerOld",
                "checked" to true,
                "category" to UUID.randomUUID().toString(),
                "listId" to listId.toString(),
                "recurring" to "ONE_TIME",
                "deleted" to true,
                "deletedAt" to Date.from(twoHoursAgo),
            ))
        )

        itemService.runSchedulerCycle()

        val items = db.getCollection<Document>("items")
            .find(Filters.eq("_id", itemId.toString()))
            .toList()
        items.size shouldBe 0
    }

    // ── AC11 ── scheduler no-op ────────────────────────────────────────────

    test("AC11 scheduler no-op on clean database runs without error") {
        val db = connectToDb()
        val itemService = buildItemService(db)

        // runs without exception; no specific assertion needed beyond non-throw
        itemService.runSchedulerCycle()
    }

    // ── AC13 ── store suggestions ─────────────────────────────────────────

    test("AC13 itemStoreSuggestions returns distinct non-null store values") {
        val username = "user_${UUID.randomUUID().toString().take(8)}"
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)

            saveItem(token, UUID.randomUUID(), catId, listId, store = "Pharmacy")
            saveItem(token, UUID.randomUUID(), catId, listId, store = "Pharmacy")
            saveItem(token, UUID.randomUUID(), catId, listId, store = "Bakery")
            saveItem(token, UUID.randomUUID(), catId, listId)  // null store

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(token)
                setBody("""{"query":"{ itemStoreSuggestions(listId: \"$listId\") }"}""")
            }.bodyAsText()
            res shouldNotContain "errors"
            res shouldContain "Pharmacy"
            res shouldContain "Bakery"
            // verify distinct: "Pharmacy" appears only once in the result array
            val suggestions = mapper.readTree(res)["data"]["itemStoreSuggestions"]
            val storeList = suggestions.map { it.asText() }
            storeList.count { it == "Pharmacy" } shouldBe 1
        }
    }

    test("AC13 itemStoreSuggestions non-member caller returns GQL error") {
        val ownerUsername = "owner_${UUID.randomUUID().toString().take(8)}"
        val nonMemberUsername = "nonmem_${UUID.randomUUID().toString().take(8)}"

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(ownerUsername)
            val listId = createList(ownerToken)
            val nonMemberToken = registerAndLogin(nonMemberUsername)

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(nonMemberToken)
                setBody("""{"query":"{ itemStoreSuggestions(listId: \"$listId\") }"}""")
            }.bodyAsText()
            res shouldContain "errors"
        }
    }

    // ── AC14 ── compound indexes ──────────────────────────────────────────

    test("AC14 compound indexes exist after app start") {
        val db = connectToDb()
        // create ItemRepository which runs init{} to create indexes
        ItemRepository(db)

        val indexes = db.getCollection<Document>("items").listIndexes().toList()
        val indexKeys = indexes.map { it.get("key", Document::class.java).keys.toSet() }

        indexKeys shouldContain setOf("listId", "recurring", "checkedAt")
        indexKeys shouldContain setOf("deleted", "deletedAt")
    }

    // ── auth checks ───────────────────────────────────────────────────────

    test("checkItem non-member returns GQL error") {
        val ownerUsername = "owner_${UUID.randomUUID().toString().take(8)}"
        val nonMemberUsername = "nonmem_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(ownerUsername)
            val listId = createList(ownerToken)
            saveItem(ownerToken, itemId, catId, listId)
            val nonMemberToken = registerAndLogin(nonMemberUsername)

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(nonMemberToken)
                setBody("""{"query":"mutation { checkItem(id: \"$itemId\", listId: \"$listId\") { id } }"}""")
            }.bodyAsText()
            res shouldContain "errors"
        }
    }

    test("uncheckItem non-member returns GQL error") {
        val ownerUsername = "owner_${UUID.randomUUID().toString().take(8)}"
        val nonMemberUsername = "nonmem_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val ownerToken = registerAndLogin(ownerUsername)
            val listId = createList(ownerToken)
            saveItem(ownerToken, itemId, catId, listId)
            val nonMemberToken = registerAndLogin(nonMemberUsername)

            val res = client.post("/graphql") {
                contentType(ContentType.Application.Json)
                bearerAuth(nonMemberToken)
                setBody("""{"query":"mutation { uncheckItem(id: \"$itemId\", listId: \"$listId\") { id } }"}""")
            }.bodyAsText()
            res shouldContain "errors"
        }
    }
})
