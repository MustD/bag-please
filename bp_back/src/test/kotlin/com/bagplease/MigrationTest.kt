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
import com.mongodb.kotlin.client.coroutine.MongoClient
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
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
        db.getCollection<Document>("app_migrations").find().toList().size shouldBe 1
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
})
