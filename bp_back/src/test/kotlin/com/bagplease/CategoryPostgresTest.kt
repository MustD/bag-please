package com.bagplease

import com.bagplease.entity.category.Category
import com.bagplease.entity.category.CategoryService
import com.bagplease.entity.category.db.CategoryRepository
import com.bagplease.entity.item.ItemService
import com.bagplease.features.auth.CallerUsername
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.postgresContainer
import com.bagplease.utils.buildTestServices
import com.bagplease.utils.pgCount
import com.bagplease.utils.pgExec
import com.bagplease.utils.pgRows
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpPostgres
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
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
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID

private val mapper = jacksonObjectMapper()

// Story 11.5: categories live in PostgreSQL. Matrix rows asserted against the `categories` table.
class CategoryPostgresTest : FunSpec({

    val container = postgresContainer()

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

    suspend fun ApplicationTestBuilder.list(token: String, name: String = "L"): String =
        mapper.readTree(gql(token, """mutation { createList(name: "$name") { id } }"""))["data"]["createList"]["id"].asText()

    suspend fun ApplicationTestBuilder.saveCategory(token: String, id: UUID, listId: String, name: String): String =
        gql(token, """mutation { saveCategory(category: { id: "$id", name: "$name", listId: "$listId" }) { id name listId } }""")

    test("create inserts a row and saving the same id on the same list renames it") {
        testApplication {
            setUpPostgres(); setUpJwt(); application { module() }
            val (owner) = users("catOwner")
            val listId = list(owner)
            val cat = UUID.randomUUID()
            saveCategory(owner, cat, listId, "Dairy") shouldNotContain "errors"
            saveCategory(owner, cat, listId, "Milk") shouldNotContain "errors"
            pgRows("SELECT name, list_id FROM categories WHERE id = '$cat'") shouldBe listOf(listOf("Milk", listId))
        }
    }

    test("an id that exists on another list is rejected and the row is left unchanged") {
        testApplication {
            setUpPostgres(); setUpJwt(); application { module() }
            val (owner) = users("catForeignOwner")
            val listA = list(owner, "A")
            val listB = list(owner, "B")
            val cat = UUID.randomUUID()
            saveCategory(owner, cat, listA, "Dairy") shouldNotContain "errors"
            saveCategory(owner, cat, listB, "Hijack") shouldContain "errors"
            pgRows("SELECT name, list_id FROM categories WHERE id = '$cat'") shouldBe listOf(listOf("Dairy", listA))
        }
    }

    test("a non-member cannot save or delete and the row is untouched") {
        testApplication {
            setUpPostgres(); setUpJwt(); application { module() }
            val (owner, stranger) = users("catMemOwner", "catStranger")
            val listId = list(owner)
            val cat = UUID.randomUUID()
            saveCategory(owner, cat, listId, "Dairy") shouldNotContain "errors"
            saveCategory(stranger, cat, listId, "Mine") shouldContain "errors"
            gql(stranger, """mutation { deleteCategory(id: "$cat", listId: "$listId") { id } }""") shouldContain "errors"
            pgRows("SELECT name FROM categories WHERE id = '$cat'") shouldBe listOf(listOf("Dairy"))
        }
    }

    test("deleting a category removes the row; a second delete reports Category not found") {
        testApplication {
            setUpPostgres(); setUpJwt(); application { module() }
            val (owner) = users("catDelOwner")
            val listId = list(owner)
            val cat = UUID.randomUUID()
            saveCategory(owner, cat, listId, "Dairy") shouldNotContain "errors"
            gql(owner, """mutation { deleteCategory(id: "$cat", listId: "$listId") { id } }""") shouldNotContain "errors"
            pgCount("SELECT count(*) FROM categories") shouldBe 0L
            gql(owner, """mutation { deleteCategory(id: "$cat", listId: "$listId") { id } }""") shouldContain "Category not found"
        }
    }

    test("deleting a category through the API removes its items; a category passed with another list's id is not found") {
        testApplication {
            setUpPostgres(); setUpJwt(); application { module() }
            val (owner) = users("catItemsOwner")
            val listA = list(owner, "A")
            val listB = list(owner, "B")
            val cat = UUID.randomUUID()
            val item = UUID.randomUUID()
            saveCategory(owner, cat, listA, "Dairy") shouldNotContain "errors"
            gql(owner, """mutation { saveItem(item: { id: "$item", name: "Milk", checked: false, category: "$cat", listId: "$listA", stores: [] }) { id } }""") shouldNotContain "errors"
            // FR58: the category of list A cannot be used by an item of list B.
            gql(owner, """mutation { saveItem(item: { id: "${UUID.randomUUID()}", name: "Bad", checked: false, category: "$cat", listId: "$listB", stores: [] }) { id } }""") shouldContain "does not belong to list"

            gql(owner, """mutation { deleteCategory(id: "$cat", listId: "$listB") { id } }""") shouldContain "Category not found"
            pgCount("SELECT count(*) FROM categories WHERE id = '$cat'") shouldBe 1L

            gql(owner, """mutation { deleteCategory(id: "$cat", listId: "$listA") { id } }""") shouldNotContain "errors"
            pgCount("SELECT count(*) FROM categories WHERE id = '$cat'") shouldBe 0L
            gql(owner, """{ getItems(listId: "$listA") { id } }""") shouldNotContain item.toString()
        }
    }

    test("deleting a list reports deletedCategoryCount equal to the rows removed") {
        testApplication {
            setUpPostgres(); setUpJwt(); application { module() }
            val (owner) = users("catCascadeOwner")
            val listId = list(owner)
            val other = list(owner, "Other")
            repeat(2) { saveCategory(owner, UUID.randomUUID(), listId, "C$it") shouldNotContain "errors" }
            saveCategory(owner, UUID.randomUUID(), other, "Keep") shouldNotContain "errors"
            val body = gql(owner, """mutation { deleteList(id: "$listId") { deletedCategoryCount } }""")
            mapper.readTree(body)["data"]["deleteList"]["deletedCategoryCount"].asInt() shouldBe 2
            pgCount("SELECT count(*) FROM categories WHERE list_id = '$listId'") shouldBe 0L
            pgCount("SELECT count(*) FROM categories WHERE list_id = '$other'") shouldBe 1L
        }
    }

    /** Registers two users and a list they share, through the API, then returns the ids needed by service-level checks. */
    data class Shared(val owner: String, val member: String, val listId: UUID)

    suspend fun ApplicationTestBuilder.sharedList(prefix: String): Shared {
        val (ownerToken, memberToken) = users("${prefix}Owner", "${prefix}Member")
        val listId = list(ownerToken)
        gql(ownerToken, """mutation { shareList(listId: "$listId", username: "${prefix}Member") { id } }""") shouldNotContain "errors"
        gql(memberToken, """mutation { acceptInvite(listId: "$listId") { id } }""") shouldNotContain "errors"
        return Shared("${prefix}Owner", "${prefix}Member", UUID.fromString(listId))
    }

    test("a member's rename is emitted once, after commit; a rejected save and a non-member emit nothing") {
        testApplication {
            setUpPostgres(); setUpJwt(); application { module() }
            val shared = sharedList("catEvt")
            val other = list(login("catEvtOwner", "pass1234"), "Other")
            val service = buildTestServices().categoryService
            val cat = Category(UUID.randomUUID(), "Dairy", shared.listId)
            service.saveCategory(cat, CallerUsername(shared.owner)).isRight() shouldBe true

            // Subscribe BEFORE saving; the flow has no replay.
            val renamed = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Default).async {
                withTimeoutOrNull(5000) { service.categoryUpdates.first() }
            }
            kotlinx.coroutines.delay(200)
            service.saveCategory(cat.copy(name = "Milk"), CallerUsername(shared.member)).isRight() shouldBe true
            renamed.await() shouldBe cat.copy(name = "Milk")
            pgRows("SELECT name FROM categories WHERE id = '${cat.id}'") shouldBe listOf(listOf("Milk"))

            fun quiet() = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Default).async {
                withTimeoutOrNull(700) { service.categoryUpdates.first() }
            }
            // Foreign-list save (the caller IS a member of both lists): rejected, nothing emitted.
            val q1 = quiet(); kotlinx.coroutines.delay(100)
            shouldThrow<IllegalArgumentException> {
                service.saveCategory(cat.copy(listId = UUID.fromString(other), name = "Hijack"), CallerUsername(shared.owner))
            }
            q1.await() shouldBe null
            // Non-member: auth error, nothing emitted.
            val q2 = quiet(); kotlinx.coroutines.delay(100)
            service.saveCategory(cat.copy(name = "Nope"), CallerUsername("catEvtNobody")).isLeft() shouldBe true
            q2.await() shouldBe null
            pgRows("SELECT name, list_id FROM categories WHERE id = '${cat.id}'") shouldBe listOf(listOf("Milk", shared.listId.toString()))
        }
    }

    test("a failing item cascade keeps the category row and emits no DELETED event") {
        testApplication {
            setUpPostgres(); setUpJwt(); application { module() }
            val shared = sharedList("catRoll")
            val healthy = buildTestServices()
            val cat = Category(UUID.randomUUID(), "Doomed", shared.listId)
            healthy.categoryService.saveCategory(cat, CallerUsername(shared.owner)).isRight() shouldBe true

            // A statement trigger makes every DELETE on items fail, so the item cascade throws inside the tx.
            pgExec("CREATE FUNCTION fail_item_delete() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN RAISE EXCEPTION 'boom'; END \$\$")
            pgExec("CREATE TRIGGER fail_item_delete BEFORE DELETE ON items FOR EACH STATEMENT EXECUTE FUNCTION fail_item_delete()")
            val service = healthy.categoryService

            val event = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Default).async {
                withTimeoutOrNull(700) { service.categoryDeletions.first() }
            }
            kotlinx.coroutines.delay(100)
            try {
                shouldThrow<Exception> { service.deleteCategory(cat.id, shared.listId, CallerUsername(shared.owner)) }
                event.await() shouldBe null
            } finally {
                pgExec("DROP TRIGGER fail_item_delete ON items")
                pgExec("DROP FUNCTION fail_item_delete()")
            }
            pgCount("SELECT count(*) FROM categories WHERE id = '${cat.id}'") shouldBe 1L
        }
    }

    test("deleting a category deletes its items first and emits exactly one DELETED event after the row is gone") {
        testApplication {
            setUpPostgres(); setUpJwt(); application { module() }
            val shared = sharedList("catDelEvt")
            val services = buildTestServices()
            val service = services.categoryService
            val cat = Category(UUID.randomUUID(), "Doomed", shared.listId)
            service.saveCategory(cat, CallerUsername(shared.owner)).isRight() shouldBe true

            val events = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Default).async {
                val seen = mutableListOf<Category>()
                withTimeoutOrNull(1000) { service.categoryDeletions.collect { seen += it; pgCount("SELECT count(*) FROM categories WHERE id = '${it.id}'") shouldBe 0L } }
                seen
            }
            kotlinx.coroutines.delay(200)
            service.deleteCategory(cat.id, shared.listId, CallerUsername(shared.member)).getOrNull() shouldBe cat
            events.await() shouldBe listOf(cat)
            pgCount("SELECT count(*) FROM categories") shouldBe 0L
        }
    }
})
