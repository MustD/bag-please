package com.bagplease.plugins

import com.bagplease.entity.category.mongo.CategoryRepository
import com.bagplease.entity.item.StoreNames
import com.bagplease.entity.item.mongo.ItemRepository
import com.bagplease.entity.list.List
import com.bagplease.entity.list.mongo.ListRepository
import com.bagplease.entity.user.mongo.UserRepository
import com.bagplease.mongo.AppMigrationsRepository
import com.mongodb.client.model.Filters
import com.mongodb.client.model.Updates
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import io.ktor.util.logging.KtorSimpleLogger
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.bson.Document
import java.time.Instant

private val logger = KtorSimpleLogger("Migration")

/**
 * Startup migrations, in DECLARED ORDER: `[epic4-list-seed, epic9-multi-store]`.
 *
 * Story 9.6 / AR-E9-5 restructured this. Each migration is now its own suspend function that checks
 * ONLY its own `app_migrations` record, and neither can skip the other. Before, every early exit
 * here — "epic 4 already complete", "no unscoped data", and falling off the end of the epic-4 body —
 * returned from the WHOLE `runBlocking`, so a second migration appended after epic 4 would never
 * have run on any database that had already seen it, i.e. on every real one.
 *
 * It is called from `Application.module()` BEFORE `configureGql`, and therefore before any
 * `ItemStorage.sync()` can cache a pre-migration row.
 */
fun configureMigration(
    db: MongoDatabase,
    userRepository: UserRepository,
    itemRepository: ItemRepository,
    categoryRepository: CategoryRepository,
    listRepository: ListRepository,
    migrationTargetUsername: String,
) {
    runBlocking {
        val migrationsRepository = AppMigrationsRepository(db)
        migrateEpic4ListSeed(db, migrationsRepository, userRepository, listRepository, migrationTargetUsername)
        migrateEpic9MultiStore(db, migrationsRepository)
    }
}

/**
 * Epic 4 — give every unscoped item and category a `listId` by seeding one default list for
 * `MIGRATION_TARGET_USER`. Body unchanged from before the 9.6 restructure; only the early exits are
 * now `return` from THIS function rather than from the whole block.
 */
private suspend fun migrateEpic4ListSeed(
    db: MongoDatabase,
    migrationsRepository: AppMigrationsRepository,
    userRepository: UserRepository,
    listRepository: ListRepository,
    migrationTargetUsername: String,
) {
    // Step 1: check if migration already completed
    if (migrationsRepository.findMigration("epic4-list-seed") != null) {
        logger.info("Epic 4 migration already complete, skipping.")
        return
    }

    // Step 2: check if there are items or categories without listId (pre-migration data exists)
    val itemsCol = db.getCollection<Document>("items")
    val categoriesCol = db.getCollection<Document>("categories")
    val noListIdFilter = Filters.not(Filters.exists("listId"))

    val unmigratedItem = itemsCol.find(noListIdFilter).firstOrNull()
    val unmigratedCategory = if (unmigratedItem == null) categoriesCol.find(noListIdFilter).firstOrNull() else null

    if (unmigratedItem == null && unmigratedCategory == null) {
        // Fresh install or all data already has listId — skip migration
        logger.info("No unscoped items or categories found, migration not needed.")
        return
    }

    // Step 3: unscoped data exists — validate MIGRATION_TARGET_USER
    if (migrationTargetUsername.isBlank()) {
        error("Epic 4 migration required but MIGRATION_TARGET_USER env var is not set. Set this to the username of the list owner before deploying.")
    }

    val targetUser = userRepository.findByUsername(migrationTargetUsername)
        ?: error("Epic 4 migration failed: MIGRATION_TARGET_USER '$migrationTargetUsername' not found in users collection. Create this user before deploying Epic 4.")

    logger.info("Running Epic 4 migration for user: $migrationTargetUsername")

    // Step 4: create default list
    val defaultList = List(
        name = "Groceries",
        emoji = "🛒",
        ownerId = targetUser.id,
        ownerUsername = targetUser.username,
        members = listOf(targetUser.id),
        memberUsernames = listOf(targetUser.username),
        origin = "MIGRATED",
        createdAt = Instant.now(),
    )
    listRepository.save(defaultList)

    // Step 5: update all items and categories with the new listId
    val listIdStr = defaultList.id.toString()
    itemsCol.updateMany(noListIdFilter, Updates.set("listId", listIdStr))
    categoriesCol.updateMany(noListIdFilter, Updates.set("listId", listIdStr))

    // Step 6: write completion record
    migrationsRepository.saveMigration("epic4-list-seed", true)

    logger.info("Epic 4 migration completed. Created list ${defaultList.id}, migrated items/categories.")
}

/**
 * Story 9.6 / AR-E9-5 — fold the legacy single-value `store` field into `stores` and unset it.
 *
 * Keyed on the legacy field's PRESENCE (`Filters.exists("store")`), so a fresh database matches
 * nothing and still records completion; a row that has already been converted, or was written by
 * this version, carries no `store` and is not touched.
 *
 * Deliberately per-document and NOT a bulk `updateMany`: the value written is a function of the
 * row's own `stores` + `store`, which no single update expression can express. Each document goes
 * through [StoreNames.normalize] with the EXISTING list first, so a legacy value that duplicates a
 * key already present loses to the stored casing — and `Updates.unset` rides in the same update, so
 * a document is never left converted-but-still-carrying-the-legacy-field.
 *
 * The completion record is written LAST. An interrupted run therefore re-runs and finishes the job;
 * recording first would strand whatever was left.
 */
private suspend fun migrateEpic9MultiStore(db: MongoDatabase, migrationsRepository: AppMigrationsRepository) {
    if (migrationsRepository.findMigration("epic9-multi-store") != null) {
        logger.info("Epic 9 multi-store migration already complete, skipping.")
        return
    }

    val itemsCol = db.getCollection<Document>("items")
    // Read the matching documents out BEFORE writing any of them. Updating inside the cursor writes
    // to the very collection being iterated, and a document the server re-fetches after the write no
    // longer matches `exists("store")` — a class of cursor surprise with nothing to gain here.
    val legacyDocs = itemsCol.find(Filters.exists("store")).toList()
    for (doc in legacyDocs) {
        val existing = doc.getList("stores", String::class.java) ?: emptyList()
        val legacy = doc.getString("store")
        // Existing FIRST: a legacy value whose key is already present is a duplicate and loses, so
        // the casing a user last saved survives the migration.
        val stores = StoreNames.normalize(existing + listOfNotNull(legacy))
        itemsCol.updateOne(
            Filters.eq("_id", doc["_id"]),
            Updates.combine(Updates.set("stores", stores), Updates.unset("store")),
        )
    }

    migrationsRepository.saveMigration("epic9-multi-store", true)
    logger.info("Epic 9 multi-store migration completed. Converted ${legacyDocs.size} item(s).")
}
