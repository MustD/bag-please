package com.bagplease

import com.bagplease.entity.category.mongo.CategoryRepository
import com.bagplease.entity.item.mongo.ItemRepository
import com.bagplease.entity.list.mongo.ListRepository
import com.bagplease.entity.user.User
import com.bagplease.entity.user.mongo.UserRepository
import com.bagplease.mongo.AppMigrationsRepository
import com.bagplease.plugins.configureMigration
import com.bagplease.utils.mongoContainer
import com.mongodb.ConnectionString
import com.mongodb.MongoClientSettings
import com.mongodb.MongoCredential
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoClient
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.bson.Document
import org.bson.UuidRepresentation
import java.util.*

class MigrationTest : FunSpec({

    val container = mongoContainer()

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

    suspend fun clearCollections(db: MongoDatabase) {
        db.getCollection<Document>("items").deleteMany(Document())
        db.getCollection<Document>("categories").deleteMany(Document())
        db.getCollection<Document>("lists").deleteMany(Document())
        db.getCollection<Document>("app_migrations").deleteMany(Document())
    }

    test("AC17 happy path: items and categories are migrated to a default list") {
        val db = connectToDb()
        clearCollections(db)

        val username = "miguser_${UUID.randomUUID().toString().take(8)}"
        val userRepo = UserRepository(db)
        userRepo.save(User(username = username, passwordHash = "hash"))

        val itemId = UUID.randomUUID()
        val catId = UUID.randomUUID()
        db.getCollection<Document>("items").insertOne(
            Document(mapOf("_id" to itemId.toString(), "name" to "OldItem", "checked" to false, "category" to catId.toString()))
        )
        db.getCollection<Document>("categories").insertOne(
            Document(mapOf("_id" to catId.toString(), "name" to "OldCat"))
        )

        configureMigration(
            db = db,
            userRepository = userRepo,
            itemRepository = ItemRepository(db),
            categoryRepository = CategoryRepository(db),
            listRepository = ListRepository(db),
            migrationTargetUsername = username,
        )

        val record = AppMigrationsRepository(db).findMigration("epic4-list-seed")
        record shouldNotBe null
        record!!.complete shouldBe true

        val item = db.getCollection<Document>("items").find(Filters.eq("_id", itemId.toString())).firstOrNull()
        item!!.getString("listId") shouldNotBe null

        val cat = db.getCollection<Document>("categories").find(Filters.eq("_id", catId.toString())).firstOrNull()
        cat!!.getString("listId") shouldNotBe null

        val lists = db.getCollection<Document>("lists").find().toList()
        lists.size shouldBe 1
        lists[0].getString("name") shouldBe "Groceries"
    }

    test("AC18 idempotency: second run skips and does not create a duplicate list") {
        val db = connectToDb()
        clearCollections(db)

        val username = "miguser2_${UUID.randomUUID().toString().take(8)}"
        val userRepo = UserRepository(db)
        userRepo.save(User(username = username, passwordHash = "hash"))

        db.getCollection<Document>("items").insertOne(
            Document(mapOf("_id" to UUID.randomUUID().toString(), "name" to "Item", "checked" to false))
        )

        val itemRepo = ItemRepository(db)
        val catRepo = CategoryRepository(db)
        val listRepo = ListRepository(db)

        configureMigration(db, userRepo, itemRepo, catRepo, listRepo, username)
        configureMigration(db, userRepo, itemRepo, catRepo, listRepo, username)

        db.getCollection<Document>("lists").find().toList().size shouldBe 1
        // NARROWED by Story 9.6, not removed: `app_migrations` now also holds `epic9-multi-store`,
        // so a total count would fail for a reason that has nothing to do with idempotency. What
        // this case is actually about is the list count above and the epic-4 record being written
        // exactly once.
        db.getCollection<Document>("app_migrations")
            .find(Filters.eq("_id", "epic4-list-seed")).toList().size shouldBe 1
    }

    test("AC19 hard-fail: MIGRATION_TARGET_USER not set with existing items") {
        val db = connectToDb()
        clearCollections(db)

        db.getCollection<Document>("items").insertOne(
            Document(mapOf("_id" to UUID.randomUUID().toString(), "name" to "Item"))
        )

        val ex = shouldThrow<IllegalStateException> {
            configureMigration(
                db = db,
                userRepository = UserRepository(db),
                itemRepository = ItemRepository(db),
                categoryRepository = CategoryRepository(db),
                listRepository = ListRepository(db),
                migrationTargetUsername = "",
            )
        }
        ex.message shouldContain "MIGRATION_TARGET_USER env var is not set"
    }

    test("AC20 hard-fail: MIGRATION_TARGET_USER username not found in users collection") {
        val db = connectToDb()
        clearCollections(db)

        val ghost = "ghost_${UUID.randomUUID().toString().take(8)}"
        db.getCollection<Document>("items").insertOne(
            Document(mapOf("_id" to UUID.randomUUID().toString(), "name" to "Item"))
        )

        val ex = shouldThrow<IllegalStateException> {
            configureMigration(
                db = db,
                userRepository = UserRepository(db),
                itemRepository = ItemRepository(db),
                categoryRepository = CategoryRepository(db),
                listRepository = ListRepository(db),
                migrationTargetUsername = ghost,
            )
        }
        ex.message shouldContain "not found in users collection"
        ex.message shouldContain ghost
    }

    test("AC21 fresh install: migration is skipped when no items exist") {
        val db = connectToDb()
        clearCollections(db)

        configureMigration(
            db = db,
            userRepository = UserRepository(db),
            itemRepository = ItemRepository(db),
            categoryRepository = CategoryRepository(db),
            listRepository = ListRepository(db),
            migrationTargetUsername = "",
        )

        AppMigrationsRepository(db).findMigration("epic4-list-seed") shouldBe null
        db.getCollection<Document>("lists").find().toList().size shouldBe 0
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Story 9.6 / AR-E9-5 — `epic9-multi-store`.
    //
    // Migrations run in DECLARED ORDER and each checks only its OWN record: before this story
    // `configureMigration` returned from the whole `runBlocking` the moment epic 4 was recorded (or
    // not needed), so a second migration bolted on after it could never run on any database that had
    // already seen epic 4 — i.e. on every real one. Every case below seeds `epic4-list-seed` as
    // already recorded for exactly that reason.
    // ─────────────────────────────────────────────────────────────────────────

    suspend fun runMigrations(db: MongoDatabase, username: String = "") = configureMigration(
        db = db,
        userRepository = UserRepository(db),
        itemRepository = ItemRepository(db),
        categoryRepository = CategoryRepository(db),
        listRepository = ListRepository(db),
        migrationTargetUsername = username,
    )

    fun storesOf(db: MongoDatabase, id: UUID): Document =
        runBlocking { db.getCollection<Document>("items").find(Filters.eq("_id", id.toString())).firstOrNull()!! }

    test("9.6 legacy `store` values fold into `stores` and the legacy field is unset") {
        val db = connectToDb()
        clearCollections(db)
        AppMigrationsRepository(db).saveMigration("epic4-list-seed", true)

        val listId = UUID.randomUUID().toString()
        fun seed(vararg pairs: Pair<String, Any?>): UUID {
            val id = UUID.randomUUID()
            val doc = Document(mapOf("_id" to id.toString(), "name" to "Item", "checked" to false, "listId" to listId))
            pairs.forEach { (k, v) -> doc[k] = v }
            runBlocking { db.getCollection<Document>("items").insertOne(doc) }
            return id
        }

        val legacyOnly = seed("store" to "Lidl")
        val mixed = seed("store" to " lidl ", "stores" to listOf("LIDL"))
        val nullStore = seed("store" to null)
        val blankStore = seed("store" to "")
        val paddedStore = seed("store" to "   ")
        val alreadyConverted = seed("stores" to listOf("Rewe"))

        runMigrations(db)

        // A legacy-only row: the one name, trimmed, in `stores`.
        storesOf(db, legacyOnly).getList("stores", String::class.java) shouldBe listOf("Lidl")
        // A mixed row: the EXISTING list comes first, so the legacy value is a duplicate KEY and
        // loses — the stored casing "LIDL" survives, " lidl " does not reappear beside it.
        storesOf(db, mixed).getList("stores", String::class.java) shouldBe listOf("LIDL")
        // Null / empty / whitespace-only legacy values are not stores.
        storesOf(db, nullStore).getList("stores", String::class.java) shouldBe emptyList()
        storesOf(db, blankStore).getList("stores", String::class.java) shouldBe emptyList()
        storesOf(db, paddedStore).getList("stores", String::class.java) shouldBe emptyList()
        // A row with no legacy field at all is not in the filter and is left exactly as it was.
        storesOf(db, alreadyConverted).getList("stores", String::class.java) shouldBe listOf("Rewe")

        // NO document keeps the legacy field, whatever its value was.
        db.getCollection<Document>("items").find(Filters.exists("store")).toList().size shouldBe 0

        // The completion record is written LAST, after every document is converted.
        AppMigrationsRepository(db).findMigration("epic9-multi-store")!!.complete shouldBe true
        // …and epic 4's record is untouched: neither migration short-circuits the other.
        AppMigrationsRepository(db).findMigration("epic4-list-seed")!!.complete shouldBe true
    }

    test("9.6 a converted row still reads back through the item repository") {
        val db = connectToDb()
        clearCollections(db)
        AppMigrationsRepository(db).saveMigration("epic4-list-seed", true)

        val itemId = UUID.randomUUID()
        val listId = UUID.randomUUID()
        db.getCollection<Document>("items").insertOne(
            Document(
                mapOf(
                    "_id" to itemId.toString(), "name" to "Milk", "checked" to false,
                    "category" to UUID.randomUUID().toString(), "listId" to listId.toString(),
                    "store" to "Lidl",
                )
            )
        )

        // `MongoItem` DROPPED the `store` property rather than renaming it, which only works because
        // the driver's codec ignores unknown BSON keys. Reading a legacy row through `getAll` before
        // the migration is what proves that — a codec that rejected it would fail the whole app on
        // startup, since `ItemStorage.sync()` calls exactly this.
        ItemRepository(db).getAll().single().stores shouldBe emptyList()

        runMigrations(db)

        ItemRepository(db).getAll().single().stores shouldBe listOf("Lidl")
    }

    test("9.6 re-running changes nothing, and a fresh database still records the migration") {
        val db = connectToDb()
        clearCollections(db)
        AppMigrationsRepository(db).saveMigration("epic4-list-seed", true)

        val itemId = UUID.randomUUID()
        db.getCollection<Document>("items").insertOne(
            Document(
                mapOf(
                    "_id" to itemId.toString(), "name" to "Milk", "checked" to false,
                    "listId" to UUID.randomUUID().toString(), "store" to "Lidl",
                )
            )
        )

        runMigrations(db)
        // Re-record the legacy field the way a rolled-back image would. The SECOND run must not
        // touch it, because the migration is gated on its own record and not on the data.
        db.getCollection<Document>("items")
            .updateOne(Filters.eq("_id", itemId.toString()), Updates.set("store", "Aldi"))
        runMigrations(db)

        storesOf(db, itemId).getList("stores", String::class.java) shouldBe listOf("Lidl")
        storesOf(db, itemId).getString("store") shouldBe "Aldi"

        // A fresh (empty) database completes cleanly and still records the migration, so the next
        // boot does not re-scan — with `epic4-list-seed` NOT recorded, which is the arrangement that
        // used to make the whole block return before reaching this migration at all.
        clearCollections(db)
        runMigrations(db)
        AppMigrationsRepository(db).findMigration("epic9-multi-store")!!.complete shouldBe true
        AppMigrationsRepository(db).findMigration("epic4-list-seed") shouldBe null
    }
})
