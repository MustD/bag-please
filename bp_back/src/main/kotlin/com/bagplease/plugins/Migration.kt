package com.bagplease.plugins

import com.bagplease.entity.category.mongo.CategoryRepository
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
import kotlinx.coroutines.runBlocking
import org.bson.Document
import java.time.Instant
import java.util.UUID

private val logger = KtorSimpleLogger("Migration")

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

        // Step 1: check if migration already completed
        if (migrationsRepository.findMigration("epic4-list-seed") != null) {
            logger.info("Epic 4 migration already complete, skipping.")
            return@runBlocking
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
            return@runBlocking
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
}
