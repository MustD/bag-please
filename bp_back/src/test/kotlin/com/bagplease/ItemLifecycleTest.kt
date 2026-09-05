package com.bagplease

import com.bagplease.entity.category.CategoryStorage
import com.bagplease.entity.category.mongo.CategoryRepository
import com.bagplease.entity.item.ItemService
import com.bagplease.entity.item.ItemStorage
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
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
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
import java.util.*

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

    suspend fun ApplicationTestBuilder.saveCategory(
        token: String,
        catId: UUID,
        listId: String,
        name: String = "Category",
    ): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { saveCategory(category: { id: \"$catId\", name: \"$name\", listId: \"$listId\" }) { id } }"}""")
        }
        return res.bodyAsText()
    }

    // `checked` is a parameter because Story 7.4's merge takes `checked` from the input while `checkedAt`
    // stays server-owned: an edit that left `checked: false` would silently un-check the item, and
    // `findCheckedRecurringItems` would then never see it again.
    suspend fun ApplicationTestBuilder.saveItem(
        token: String,
        itemId: UUID,
        catId: UUID,
        listId: String,
        name: String = "Item",
        store: String? = null,
        recurring: String? = null,
        checked: Boolean = false,
    ): String {
        val storeArg = if (store != null) """, store: \"$store\"""" else ""
        val recurringArg = if (recurring != null) """, recurring: \"$recurring\"""" else ""
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { saveItem(item: { id: \"$itemId\", name: \"$name\", checked: $checked, category: \"$catId\", listId: \"$listId\"$storeArg$recurringArg }) { id name checked category listId store recurring addedBy deleted deletedAt checkedAt } }"}""")
        }
        return res.bodyAsText()
    }

    suspend fun ApplicationTestBuilder.checkItem(token: String, itemId: UUID, listId: String): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { checkItem(id: \"$itemId\", listId: \"$listId\") { id checked checkedAt deleted deletedAt } }"}""")
        }
        return res.bodyAsText()
    }

    suspend fun ApplicationTestBuilder.shareList(token: String, listId: String, username: String): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { shareList(listId: \"$listId\", username: \"$username\") { id } }"}""")
        }
        return res.bodyAsText()
    }

    suspend fun ApplicationTestBuilder.acceptInvite(token: String, listId: String): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"mutation { acceptInvite(listId: \"$listId\") { id } }"}""")
        }
        return res.bodyAsText()
    }

    suspend fun ApplicationTestBuilder.getItems(token: String, listId: String): String {
        val res = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody("""{"query":"{ getItems(listId: \"$listId\") { id name checked recurring deleted addedBy store category } }"}""")
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
        return ItemService(itemStorage, listService, itemRepository, categoryStorage)
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

    // ── Story 7.4 ── saveItem merges the stored item instead of reconstructing it ──────────
    //
    // `ItemInput` carries only {name, checked, category, store, recurring}. Everything else on `Item`
    // is server-owned, so on an update the incoming values for addedBy/checkedAt/deleted/deletedAt are
    // whatever `Item`'s defaults happen to be — meaningless. These tests pin that they come from the
    // stored row instead (AC1), that create still works and the discriminator is storage existence
    // (AC2), the two rejections (AC3, AC4), and that the check-off clock survives well enough for the
    // scheduler to still restore the item (AC5).

    test("7.4 AC1 an edit by another member keeps addedBy and the check-off clock") {
        val owner = "own74_${UUID.randomUUID().toString().take(8)}"
        val member = "mem74_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            // Exactly two registerAndLogin calls: each costs two /auth/login requests and the `auth`
            // rate limiter allows 5 per 60s. A third here would return 429.
            val ownerToken = registerAndLogin(owner)
            val memberToken = registerAndLogin(member)
            val listId = createList(ownerToken)
            saveCategory(ownerToken, catId, listId) shouldNotContain "errors"
            shareList(ownerToken, listId, member) shouldNotContain "errors"
            acceptInvite(memberToken, listId) shouldNotContain "errors"

            saveItem(ownerToken, itemId, catId, listId, name = "Milk", recurring = "WEEKLY") shouldNotContain "errors"
            val checkBody = checkItem(ownerToken, itemId, listId)
            checkBody shouldNotContain "errors"
            checkBody shouldNotContain """"checkedAt":null"""

            val editBody = saveItem(
                memberToken, itemId, catId, listId, name = "Oat milk", recurring = "WEEKLY", checked = true,
            )
            editBody shouldNotContain "errors"
            editBody shouldContain """"name":"Oat milk""""
            editBody shouldContain """"addedBy":"$owner""""
            editBody shouldNotContain """"addedBy":"$member""""
            editBody shouldNotContain """"checkedAt":null"""
            editBody shouldContain """"deleted":false"""
            editBody shouldContain """"deletedAt":null"""
        }
    }

    test("7.4 AC1 an edit preserves a soft delete and the item stays invisible") {
        val username = "soft74_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)
            saveCategory(token, catId, listId) shouldNotContain "errors"

            saveItem(token, itemId, catId, listId, name = "Batteries", recurring = "ONE_TIME") shouldNotContain "errors"
            val checkBody = checkItem(token, itemId, listId)
            checkBody shouldNotContain "errors"
            checkBody shouldContain """"deleted":true"""

            val editBody = saveItem(
                token, itemId, catId, listId, name = "AA batteries", recurring = "ONE_TIME", checked = true,
            )
            editBody shouldNotContain "errors"
            editBody shouldContain """"name":"AA batteries""""
            editBody shouldContain """"deleted":true"""
            editBody shouldNotContain """"deletedAt":null"""

            getItems(token, listId) shouldNotContain (itemId.toString())
        }
    }

    test("7.4 AC2 an unknown id creates with the caller as addedBy, a known id merges in place") {
        val username = "crt74_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)
            saveCategory(token, catId, listId) shouldNotContain "errors"

            // The client generates the UUID for NEW items too, so a non-existent id must NOT be rejected
            // (Epic 6 action item C1's literal wording would have rejected every add).
            val createBody = saveItem(token, itemId, catId, listId, name = "Bread")
            createBody shouldNotContain "errors"
            createBody shouldContain """"addedBy":"$username""""

            val updateBody = saveItem(token, itemId, catId, listId, name = "Rye bread")
            updateBody shouldNotContain "errors"
            updateBody shouldContain """"name":"Rye bread""""
            updateBody shouldContain """"addedBy":"$username""""

            val items = mapper.readTree(getItems(token, listId))["data"]["getItems"]
            items.count { it["id"].asText() == itemId.toString() } shouldBe 1
            items.count { it["name"].asText() == "Bread" } shouldBe 0
        }
    }

    test("7.4 AC3 an id that already lives on another list is rejected, not relocated") {
        val username = "xlst74_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listX = createList(token, "ListX")
            val listY = createList(token, "ListY")

            saveItem(token, itemId, catId, listX, name = "OnListX") shouldNotContain "errors"

            // getByIdCached is list-scoped, so this misses and lands on the create branch; the global
            // findById is what stops ItemRepository.save's _id-only upsert from moving the row.
            // Assert the REASON, not merely that some error came back: a bare `shouldContain "errors"`
            // is equally satisfied by a 401, a rate-limit 429 or a schema error, so it cannot tell
            // "rejected for the right reason" from "never reached the code under test" (review, 2026-08-21).
            saveItem(token, itemId, catId, listY, name = "MovedToY") shouldContain
                    "Item $itemId belongs to a different list"

            val xBody = getItems(token, listX)
            xBody shouldContain itemId.toString()
            xBody shouldContain """"name":"OnListX""""
            getItems(token, listY) shouldNotContain (itemId.toString())
        }
    }

    test("7.4 AC4 an update carrying a category from another list is rejected and writes nothing") {
        val username = "cat74a_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catHere = UUID.randomUUID()
        val catElsewhere = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listHere = createList(token, "Here")
            val listElsewhere = createList(token, "Elsewhere")
            saveCategory(token, catHere, listHere, "Dairy") shouldNotContain "errors"
            saveCategory(token, catElsewhere, listElsewhere, "Frozen") shouldNotContain "errors"

            saveItem(token, itemId, catHere, listHere, name = "Butter") shouldNotContain "errors"

            // The rejected edit changes the NAME as well as the category, deliberately: if it resent
            // "Butter" the re-read below could not tell "nothing was written" from "the name was
            // written and only the category rejected". The spec's Kotest recipe requires a re-read
            // that proves the stored row is unchanged, not merely that an error came back.
            saveItem(token, itemId, catElsewhere, listHere, name = "Margarine") shouldContain
                    "Category $catElsewhere does not belong to list $listHere"

            val body = getItems(token, listHere)
            body shouldContain catHere.toString()
            body shouldNotContain (catElsewhere.toString())
            body shouldContain """"name":"Butter""""
            body shouldNotContain """"name":"Margarine""""
        }
    }

    test("7.4 AC4 an update carrying a category that belongs to no list is rejected") {
        val username = "cat74b_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catHere = UUID.randomUUID()
        val catGhost = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)
            saveCategory(token, catHere, listId, "Dairy") shouldNotContain "errors"

            saveItem(token, itemId, catHere, listId, name = "Cheese") shouldNotContain "errors"

            // Name changed too — see the sibling test above: same name on both saves would make the
            // re-read blind to a partial write.
            saveItem(token, itemId, catGhost, listId, name = "Gouda") shouldContain
                    "Category $catGhost does not belong to list $listId"

            val body = getItems(token, listId)
            body shouldContain catHere.toString()
            body shouldNotContain (catGhost.toString())
            body shouldContain """"name":"Cheese""""
            body shouldNotContain """"name":"Gouda""""
        }
    }

    test("7.4 AC4 a CREATE with an unknown category is still accepted (ruling A tripwire)") {
        // Deliberate scope decision (md, 2026-08-10): the check is update-only. Guarding creates too
        // would fail 29 existing saveItem invocations that invent a catId. This test exists so that a
        // later "tightening" trips one obvious tripwire instead of those 29, and so the open hole
        // filed in deferred-work.md is visible in the suite.
        val username = "cat74c_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catGhost = UUID.randomUUID()

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)

            val body = saveItem(token, itemId, catGhost, listId, name = "Ghosted")
            body shouldNotContain "errors"
            body shouldContain catGhost.toString()
        }
    }

    test("7.4 AC5 an edit keeps the check-off clock, so the scheduler still restores the item") {
        val username = "sch74_${UUID.randomUUID().toString().take(8)}"
        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()
        val db = connectToDb()
        val itemsCol = db.getCollection<Document>("items")
        val itemFilter = Filters.eq("_id", itemId.toString())

        testApplication {
            setUpMongo(container)
            setUpJwt()
            application { module() }
            val token = registerAndLogin(username)
            val listId = createList(token)
            saveCategory(token, catId, listId) shouldNotContain "errors"

            saveItem(token, itemId, catId, listId, name = "Coffee", recurring = "WEEKLY") shouldNotContain "errors"
            val checkBody = checkItem(token, itemId, listId)
            checkBody shouldNotContain "errors"
            checkBody shouldNotContain """"checkedAt":null"""

            // The edit under test. It must carry `checked` forward, because `checked` IS in ItemInput
            // while `checkedAt` is not — sending false here would un-check the item and
            // findCheckedRecurringItems would stop seeing it, failing for a reason that is not the bug.
            val editBody = saveItem(
                token, itemId, catId, listId, name = "Ground coffee", recurring = "WEEKLY", checked = true,
            )
            editBody shouldNotContain "errors"
            editBody shouldContain """"name":"Ground coffee""""

            // Backdate RELATIVE to whatever the edit actually left behind, deliberately. An absolute
            // Updates.set(..., eightDaysAgo) would hand the scheduler a valid clock even when the merge
            // had just wiped it, and this test would then pass with the bug fully present.
            val checkedAtAfterEdit = itemsCol.find(itemFilter).toList().single()["checkedAt"] as Date?
            itemsCol.updateOne(
                itemFilter,
                Updates.set("checkedAt", checkedAtAfterEdit?.let { Date.from(it.toInstant().minus(8, ChronoUnit.DAYS)) }),
            )
        }

        // Built AFTER the HTTP writes: this ItemService owns a separate ItemStorage and only sees the
        // rows written above through its own first lazy sync().
        buildItemService(db).runSchedulerCycle()

        val restored = itemsCol.find(itemFilter).toList().single()
        restored.getString("name") shouldBe "Ground coffee"
        restored.getBoolean("checked") shouldBe false
        restored["checkedAt"] shouldBe null
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
