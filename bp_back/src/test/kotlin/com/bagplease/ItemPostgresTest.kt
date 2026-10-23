package com.bagplease

import com.bagplease.entity.category.Category
import com.bagplease.entity.item.Item
import com.bagplease.entity.item.Recurring
import com.bagplease.features.auth.CallerUsername
import com.bagplease.plugins.SchedulerStep
import com.bagplease.plugins.runSchedulerCycle
import com.bagplease.utils.SharedPostgres
import com.bagplease.utils.buildTestServices
import com.bagplease.utils.mongoContainer
import com.bagplease.utils.pgCount
import com.bagplease.utils.pgExec
import com.bagplease.utils.pgRows
import com.bagplease.utils.setUpJwt
import com.bagplease.utils.setUpMongo
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID

private val mapper = jacksonObjectMapper()

// Story 11.6: items and the hourly item jobs live in PostgreSQL. Matrix rows asserted against the `items` table.
class ItemPostgresTest : FunSpec({

    val container = mongoContainer()

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

    data class Fixture(val owner: String, val member: String, val listId: UUID, val categoryId: UUID, val ownerToken: String)

    /** Two users sharing a list that holds one category. */
    suspend fun ApplicationTestBuilder.fixture(prefix: String): Fixture {
        val admin = login("admin", "admin")
        listOf("${prefix}Owner", "${prefix}Member").forEach {
            gql(admin, """mutation { createUser(username: "$it", password: "pass1234") { id } }""")
        }
        val ownerToken = login("${prefix}Owner", "pass1234")
        val memberToken = login("${prefix}Member", "pass1234")
        val listId = mapper.readTree(gql(ownerToken, """mutation { createList(name: "L") { id } }"""))["data"]["createList"]["id"].asText()
        gql(ownerToken, """mutation { shareList(listId: "$listId", username: "${prefix}Member") { id } }""") shouldNotContain "errors"
        gql(memberToken, """mutation { acceptInvite(listId: "$listId") { id } }""") shouldNotContain "errors"
        val list = UUID.fromString(listId)
        val cat = UUID.randomUUID()
        buildTestServices().categoryService.saveCategory(Category(cat, "Cat", list), CallerUsername("${prefix}Owner"))
            .isRight() shouldBe true
        return Fixture("${prefix}Owner", "${prefix}Member", list, cat, ownerToken)
    }

    fun <T> CoroutineScope.collectFor(flow: SharedFlow<T>, millis: Long) =
        async { val seen = mutableListOf<T>(); withTimeoutOrNull(millis) { flow.collect { seen += it } }; seen }

    val scope = CoroutineScope(Dispatchers.Default)

    test("create and merge keep stores order and casing, and emit one UPDATE event per save after commit") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemMerge")
            val items = buildTestServices().itemService
            val id = UUID.randomUUID()
            val seen = scope.collectFor(items.itemUpdates, 1500)
            delay(200)
            val created = Item(id = id, name = "Milk", category = f.categoryId, listId = f.listId, stores = listOf(" Lidl ", "aldi", "LIDL"), addedBy = f.owner)
            items.saveItem(created, CallerUsername(f.owner)).isRight() shouldBe true
            pgRows("SELECT stores, added_by FROM items WHERE id = '$id'") shouldBe listOf(listOf("{Lidl,aldi}", f.owner))

            // The member edits: name and stores merge, addedBy stays the creator's.
            items.saveItem(created.copy(name = "Oat milk", stores = listOf("aldi", "Rewe"), addedBy = f.member), CallerUsername(f.member))
                .isRight() shouldBe true
            pgRows("SELECT name, stores, added_by FROM items WHERE id = '$id'") shouldBe listOf(listOf("Oat milk", "{aldi,Rewe}", f.owner))
            seen.await().map { it.name } shouldContainExactly listOf("Milk", "Oat milk")
        }
    }

    test("a non-member save is an auth error and emits nothing") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemNonMember")
            val items = buildTestServices().itemService
            val seen = scope.collectFor(items.itemUpdates, 700)
            delay(100)
            items.saveItem(Item(name = "X", category = f.categoryId, listId = f.listId), CallerUsername("nobody")).isLeft() shouldBe true
            seen.await() shouldBe emptyList()
            pgCount("SELECT count(*) FROM items") shouldBe 0L
        }
    }

    test("an id stored on another list is rejected and the row is left unchanged") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemForeign")
            val items = buildTestServices().itemService
            val otherList = mapper.readTree(gql(f.ownerToken, """mutation { createList(name: "B") { id } }"""))["data"]["createList"]["id"].asText()
            val otherCat = UUID.randomUUID()
            buildTestServices().categoryService.saveCategory(Category(otherCat, "B", UUID.fromString(otherList)), CallerUsername(f.owner))
            val id = UUID.randomUUID()
            items.saveItem(Item(id = id, name = "Mine", category = f.categoryId, listId = f.listId), CallerUsername(f.owner)).isRight() shouldBe true

            val e = shouldThrow<IllegalArgumentException> {
                items.saveItem(Item(id = id, name = "Hijack", category = otherCat, listId = UUID.fromString(otherList)), CallerUsername(f.owner))
            }
            e.message shouldBe "Item $id belongs to a different list"
            pgRows("SELECT name, list_id FROM items WHERE id = '$id'") shouldBe listOf(listOf("Mine", f.listId.toString()))
        }
    }

    test("a category of another list is rejected (FR58)") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemBadCat")
            val items = buildTestServices().itemService
            shouldThrow<IllegalArgumentException> {
                items.saveItem(Item(name = "Bad", category = UUID.randomUUID(), listId = f.listId), CallerUsername(f.owner))
            }
            pgCount("SELECT count(*) FROM items") shouldBe 0L
        }
    }

    test("a write that fails inside the tx changes no row and emits no event") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemRollback")
            val items = buildTestServices().itemService
            val id = UUID.randomUUID()
            items.saveItem(Item(id = id, name = "Before", category = f.categoryId, listId = f.listId), CallerUsername(f.owner)).isRight() shouldBe true

            pgExec("CREATE FUNCTION fail_item_write() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN RAISE EXCEPTION 'boom'; END \$\$")
            pgExec("CREATE TRIGGER fail_item_write BEFORE UPDATE OR INSERT ON items FOR EACH STATEMENT EXECUTE FUNCTION fail_item_write()")
            try {
                val seen = scope.collectFor(items.itemUpdates, 900)
                delay(100)
                shouldThrow<Exception> {
                    items.saveItem(Item(id = id, name = "After", category = f.categoryId, listId = f.listId), CallerUsername(f.owner))
                }
                shouldThrow<Exception> {
                    items.saveItem(Item(name = "New", category = f.categoryId, listId = f.listId), CallerUsername(f.owner))
                }
                seen.await() shouldBe emptyList()
            } finally {
                pgExec("DROP TRIGGER fail_item_write ON items")
                pgExec("DROP FUNCTION fail_item_write()")
            }
            pgRows("SELECT name FROM items") shouldBe listOf(listOf("Before"))
        }
    }

    test("soft-deleted rows are hidden from getItems, the unchecked count and store suggestions") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemHidden")
            val items = buildTestServices().itemService
            val live = Item(name = "Live", category = f.categoryId, listId = f.listId, stores = listOf("Lidl"))
            val gone = Item(name = "Gone", category = f.categoryId, listId = f.listId, stores = listOf("Hidden"), recurring = Recurring.ONE_TIME)
            items.saveItem(live, CallerUsername(f.owner)).isRight() shouldBe true
            items.saveItem(gone, CallerUsername(f.owner)).isRight() shouldBe true
            items.checkItem(gone.id, f.listId, CallerUsername(f.owner)).isRight() shouldBe true

            items.getItems(f.listId, CallerUsername(f.owner)).getOrNull()!!.map { it.name } shouldBe listOf("Live")
            items.countUncheckedByList(listOf(f.listId)) shouldBe mapOf(f.listId to 1)
            items.getStoreSuggestions(f.listId, CallerUsername(f.owner)).getOrNull() shouldBe listOf("Lidl")
        }
    }

    fun seed(f: Fixture, name: String, checked: Boolean, recurring: String?, checkedAt: String? = null, deleted: Boolean = false, deletedAt: String? = null): UUID {
        val id = UUID.randomUUID()
        pgExec(
            "INSERT INTO items (id, name, checked, category_id, list_id, recurring, deleted, checked_at, deleted_at) VALUES " +
                "('$id', '$name', $checked, '${f.categoryId}', '${f.listId}', ${recurring?.let { "'$it'" } ?: "NULL"}, $deleted, ${checkedAt ?: "NULL"}, ${deletedAt ?: "NULL"})"
        )
        return id
    }

    test("restore un-checks recurring items past their cadence and emits UPDATE; hard delete removes old soft-deleted rows and emits DELETE") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemSched")
            val items = buildTestServices().itemService
            val weekly = seed(f, "Weekly", true, "WEEKLY", checkedAt = "now() - interval '8 days'")
            val biweeklyFresh = seed(f, "BiFresh", true, "BIWEEKLY", checkedAt = "now() - interval '8 days'")
            val monthly = seed(f, "Monthly", true, "MONTHLY", checkedAt = "now() - interval '31 days'")
            val oldGone = seed(f, "OldGone", true, "ONE_TIME", deleted = true, deletedAt = "now() - interval '2 hours'")
            val freshGone = seed(f, "FreshGone", true, "ONE_TIME", deleted = true, deletedAt = "now() - interval '10 minutes'")

            val updates = scope.collectFor(items.itemUpdates, 1500)
            val deletions = scope.collectFor(items.itemDeletions, 1500)
            delay(200)
            items.restoreRecurring()
            items.hardDeleteSoftDeleted()

            // The flow is DROP_OLDEST with a one-slot buffer (unchanged), so a burst may be truncated; only restored
            // ids may appear, and the fresh BIWEEKLY row never does.
            val updated = updates.await().map { it.id }.toSet()
            updated.isNotEmpty() shouldBe true
            (updated - setOf(weekly, monthly)) shouldBe emptySet()
            deletions.await().map { it.id } shouldBe listOf(oldGone)
            pgRows("SELECT id, checked FROM items WHERE id IN ('$weekly', '$monthly', '$biweeklyFresh') ORDER BY name")
                .associate { UUID.fromString(it[0]) to it[1] } shouldBe mapOf(weekly to "f", monthly to "f", biweeklyFresh to "t")
            pgCount("SELECT count(*) FROM items WHERE id = '$oldGone'") shouldBe 0L
            pgCount("SELECT count(*) FROM items WHERE id = '$freshGone'") shouldBe 1L
        }
    }

    test("a throwing restore step does not stop the hard-delete step or the token purge") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemStep")
            val services = buildTestServices()
            val items = services.itemService
            val stuck = seed(f, "Stuck", true, "WEEKLY", checkedAt = "now() - interval '8 days'")
            val oldGone = seed(f, "OldGone", true, "ONE_TIME", deleted = true, deletedAt = "now() - interval '2 hours'")

            pgExec("CREATE FUNCTION fail_item_update() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN RAISE EXCEPTION 'boom'; END \$\$")
            pgExec("CREATE TRIGGER fail_item_update BEFORE UPDATE ON items FOR EACH STATEMENT EXECUTE FUNCTION fail_item_update()")
            try {
                val ran = mutableListOf<String>()
                runSchedulerCycle(
                    listOf(
                        SchedulerStep("restore") { ran += "restore"; items.restoreRecurring() },
                        SchedulerStep("hard delete") { ran += "hard"; items.hardDeleteSoftDeleted() },
                        SchedulerStep("purge") { ran += "purge" },
                    )
                )
                ran shouldContainExactly listOf("restore", "hard", "purge")
            } finally {
                pgExec("DROP TRIGGER fail_item_update ON items")
                pgExec("DROP FUNCTION fail_item_update()")
            }
            pgRows("SELECT checked FROM items WHERE id = '$stuck'") shouldBe listOf(listOf("t")) // restore rolled back
            pgCount("SELECT count(*) FROM items WHERE id = '$oldGone'") shouldBe 0L // hard delete still ran
        }
    }

    test("deleting a list reports counts equal to the rows removed, soft-deleted items included") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemListDel")
            seed(f, "A", false, null)
            seed(f, "B", true, "ONE_TIME", deleted = true, deletedAt = "now()")
            val body = gql(f.ownerToken, """mutation { deleteList(id: "${f.listId}") { deletedItemCount deletedCategoryCount } }""")
            val r = mapper.readTree(body)["data"]["deleteList"]
            r["deletedItemCount"].asInt() shouldBe 2
            r["deletedCategoryCount"].asInt() shouldBe 1
            pgCount("SELECT count(*) FROM items") shouldBe 0L
        }
    }

    test("a failing list delete leaves items, categories, members and the list in place") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemListRoll")
            seed(f, "A", false, null)
            pgExec("CREATE FUNCTION fail_list_delete() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN RAISE EXCEPTION 'boom'; END \$\$")
            pgExec("CREATE TRIGGER fail_list_delete BEFORE DELETE ON lists FOR EACH STATEMENT EXECUTE FUNCTION fail_list_delete()")
            try {
                gql(f.ownerToken, """mutation { deleteList(id: "${f.listId}") { deletedItemCount } }""") shouldContain "errors"
            } finally {
                pgExec("DROP TRIGGER fail_list_delete ON lists")
                pgExec("DROP FUNCTION fail_list_delete()")
            }
            pgCount("SELECT count(*) FROM items WHERE list_id = '${f.listId}'") shouldBe 1L
            pgCount("SELECT count(*) FROM categories WHERE list_id = '${f.listId}'") shouldBe 1L
            pgCount("SELECT count(*) FROM list_members WHERE list_id = '${f.listId}'") shouldBe 2L
            pgCount("SELECT count(*) FROM lists WHERE id = '${f.listId}'") shouldBe 1L
        }
    }

    test("checkItem and uncheckItem emit one UPDATE after commit, deleteItem one DELETE; non-members and failed writes emit nothing") {
        testApplication {
            setUpMongo(container); setUpJwt(); application { module() }
            val f = fixture("itemEvents")
            val items = buildTestServices().itemService
            val owner = CallerUsername(f.owner)
            val id = seed(f, "Evt", false, null)

            val checked = scope.collectFor(items.itemUpdates, 800)
            delay(100)
            items.checkItem(id, f.listId, owner).isRight() shouldBe true
            checked.await().map { it.checked } shouldBe listOf(true)

            val unchecked = scope.collectFor(items.itemUpdates, 800)
            delay(100)
            items.uncheckItem(id, f.listId, owner).isRight() shouldBe true
            unchecked.await().map { it.checked } shouldBe listOf(false)

            // Non-member: auth error, no events on either flow.
            val quietU = scope.collectFor(items.itemUpdates, 600)
            val quietD = scope.collectFor(items.itemDeletions, 600)
            delay(100)
            val stranger = CallerUsername("nobody")
            items.checkItem(id, f.listId, stranger).isLeft() shouldBe true
            items.uncheckItem(id, f.listId, stranger).isLeft() shouldBe true
            items.deleteItem(id, f.listId, stranger).isLeft() shouldBe true
            quietU.await() shouldBe emptyList()
            quietD.await() shouldBe emptyList()

            // Failing writes: no event, row unchanged.
            pgExec("CREATE FUNCTION fail_evt() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN RAISE EXCEPTION 'boom'; END \$\$")
            pgExec("CREATE TRIGGER fail_evt BEFORE UPDATE OR DELETE ON items FOR EACH STATEMENT EXECUTE FUNCTION fail_evt()")
            try {
                val failU = scope.collectFor(items.itemUpdates, 600)
                val failD = scope.collectFor(items.itemDeletions, 600)
                delay(100)
                shouldThrow<Exception> { items.checkItem(id, f.listId, owner) }
                shouldThrow<Exception> { items.deleteItem(id, f.listId, owner) }
                failU.await() shouldBe emptyList()
                failD.await() shouldBe emptyList()
            } finally {
                pgExec("DROP TRIGGER fail_evt ON items")
                pgExec("DROP FUNCTION fail_evt()")
            }
            pgCount("SELECT count(*) FROM items WHERE id = '$id' AND checked = false") shouldBe 1L

            val deleted = scope.collectFor(items.itemDeletions, 800)
            delay(100)
            items.deleteItem(id, f.listId, owner).getOrNull()!!.id shouldBe id
            deleted.await().map { it.id } shouldBe listOf(id)
            pgCount("SELECT count(*) FROM items") shouldBe 0L
        }
    }
})
